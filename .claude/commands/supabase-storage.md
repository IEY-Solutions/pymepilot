---
name: supabase-storage
description: Buckets de Storage con RLS policies y signed URLs
---

\# Skill: Supabase Storage

\#\# 🎯 Qué es  
Configuración y uso de Supabase Storage para almacenar archivos de forma segura con aislamiento multi-tenant. Incluye buckets, policies de acceso (RLS para archivos), upload/download, y optimización.

\*\*Analogía Simple:\*\*  
Storage es como un depósito de archivos con casilleros:  
\- Cada tenant tiene su casillero (folder)  
\- Solo puede abrir SU casillero (RLS policies)  
\- Puede guardar documentos, fotos, PDFs  
\- Todo está organizado y protegido

En PymePilot:  
\- Logos de tenants  
\- Documentos de clientes (contratos, facturas)  
\- Imágenes de productos  
\- Exports de reportes (CSV, PDF)

\*\*Por qué es ÚTIL (no crítico):\*\*  
\- Almacenar archivos sin servidor propio  
\- CDN incluido (archivos se sirven rápido)  
\- Integración con Auth y RLS  
\- Costos bajos (storage barato)

\#\# 📋 Cuándo usar este skill

\#\#\# Usar cuando:  
\- ✅ Necesitás almacenar logos, imágenes  
\- ✅ Generas reportes descargables (PDF, CSV)  
\- ✅ Clientes suben documentos  
\- ✅ Necesitás CDN para assets

\#\#\# NO usar cuando:  
\- ❌ Datos estructurados (va en PostgreSQL)  
\- ❌ Archivos temporales (\<1 hora de vida)  
\- ❌ Archivos gigantes (\>5GB)

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Crear Buckets con Policies

\*\*Crear bucket en Supabase Dashboard:\*\*  
\`\`\`  
Storage → New Bucket

Name: customer-documents  
Public: No (privado)  
File size limit: 10 MB  
Allowed MIME types: application/pdf, image/jpeg, image/png  
\`\`\`

\*\*O via SQL:\*\*  
\`\`\`sql  
\-- Crear bucket  
INSERT INTO storage.buckets (id, name, public)  
VALUES ('customer-documents', 'customer-documents', false);

\-- Crear policy para upload (solo su tenant)  
CREATE POLICY "Tenant can upload own files"  
ON storage.objects  
FOR INSERT  
TO authenticated  
WITH CHECK (  
  bucket\_id \= 'customer-documents'  
  AND (storage.foldername(name))\[1\] \= auth.jwt()-\>\>'tenant\_id'  
);

\-- Policy para download (solo su tenant)  
CREATE POLICY "Tenant can download own files"  
ON storage.objects  
FOR SELECT  
TO authenticated  
USING (  
  bucket\_id \= 'customer-documents'  
  AND (storage.foldername(name))\[1\] \= auth.jwt()-\>\>'tenant\_id'  
);

\-- Policy para delete (solo su tenant)  
CREATE POLICY "Tenant can delete own files"  
ON storage.objects  
FOR DELETE  
TO authenticated  
USING (  
  bucket\_id \= 'customer-documents'  
  AND (storage.foldername(name))\[1\] \= auth.jwt()-\>\>'tenant\_id'  
);  
\`\`\`

\#\#\# Práctica 2: Estructura de Folders

\*\*Organización recomendada:\*\*  
\`\`\`  
customer-documents/  
├─ {tenant\_id}/  
│  ├─ logos/  
│  │  └─ logo.png  
│  ├─ customers/  
│  │  ├─ {customer\_id}/  
│  │  │  ├─ contract.pdf  
│  │  │  └─ invoice\_001.pdf  
│  └─ reports/  
│     ├─ monthly\_report\_2025\_01.pdf  
│     └─ export\_customers\_2025\_02.csv  
\`\`\`

\*\*Path format:\*\*  
\`\`\`  
{tenant\_id}/{category}/{entity\_id?}/{filename}

Ejemplos:  
\- 123e4567.../logos/logo.png  
\- 123e4567.../customers/abc123.../contract.pdf  
\- 123e4567.../reports/monthly\_2025\_01.pdf  
\`\`\`

\#\#\# Práctica 3: Upload de Archivos

\*\*Desde Next.js Client Component:\*\*  
\`\`\`typescript  
// app/upload/page.tsx  
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'  
import { useState } from 'react'

export default function UploadPage() {  
  const supabase \= createClientComponentClient()  
  const \[uploading, setUploading\] \= useState(false)  
    
  async function uploadFile(event: React.ChangeEvent\<HTMLInputElement\>) {  
    try {  
      setUploading(true)  
        
      const file \= event.target.files?.\[0\]  
      if (\!file) return  
        
      // Validar tipo  
      const allowedTypes \= \['image/jpeg', 'image/png', 'application/pdf'\]  
      if (\!allowedTypes.includes(file.type)) {  
        alert('Tipo de archivo no permitido')  
        return  
      }  
        
      // Validar tamaño (10MB)  
      if (file.size \> 10 \* 1024 \* 1024\) {  
        alert('Archivo muy grande (máx 10MB)')  
        return  
      }  
        
      // Obtener user y tenant  
      const { data: { user } } \= await supabase.auth.getUser()  
      const tenantId \= user?.user\_metadata?.tenant\_id  
        
      if (\!tenantId) {  
        alert('Error: Missing tenant\_id')  
        return  
      }  
        
      // Generar path único  
      const fileExt \= file.name.split('.').pop()  
      const fileName \= \`${Math.random()}.${fileExt}\`  
      const filePath \= \`${tenantId}/logos/${fileName}\`  
        
      // Upload  
      const { data, error } \= await supabase.storage  
        .from('customer-documents')  
        .upload(filePath, file, {  
          cacheControl: '3600',  
          upsert: false  
        })  
        
      if (error) {  
        throw error  
      }  
        
      console.log('File uploaded:', data.path)  
      alert('Archivo subido exitosamente\!')  
        
      // Obtener URL pública (si bucket es público)  
      // const { data: { publicUrl } } \= supabase.storage  
      //   .from('customer-documents')  
      //   .getPublicUrl(filePath)  
        
      // O signed URL (si bucket es privado)  
      const { data: signedUrl } \= await supabase.storage  
        .from('customer-documents')  
        .createSignedUrl(filePath, 60 \* 60\) // 1 hora  
        
      console.log('Signed URL:', signedUrl?.signedUrl)  
        
    } catch (error) {  
      console.error('Upload error:', error)  
      alert('Error al subir archivo')  
    } finally {  
      setUploading(false)  
    }  
  }  
    
  return (  
    \<div\>  
      \<h1\>Upload Logo\</h1\>  
      \<input  
        type="file"  
        accept="image/jpeg,image/png,application/pdf"  
        onChange={uploadFile}  
        disabled={uploading}  
      /\>  
      {uploading && \<p\>Subiendo...\</p\>}  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 4: Download de Archivos

\*\*Listar archivos del tenant:\*\*  
\`\`\`typescript  
'use client'

export default function FilesListPage() {  
  const supabase \= createClientComponentClient()  
  const \[files, setFiles\] \= useState\<any\[\]\>(\[\])  
    
  async function loadFiles() {  
    const { data: { user } } \= await supabase.auth.getUser()  
    const tenantId \= user?.user\_metadata?.tenant\_id  
      
    const { data, error } \= await supabase.storage  
      .from('customer-documents')  
      .list(\`${tenantId}/logos\`, {  
        limit: 100,  
        offset: 0,  
        sortBy: { column: 'created\_at', order: 'desc' }  
      })  
      
    if (error) {  
      console.error('Error loading files:', error)  
      return  
    }  
      
    setFiles(data)  
  }  
    
  async function downloadFile(filePath: string) {  
    const { data, error } \= await supabase.storage  
      .from('customer-documents')  
      .download(filePath)  
      
    if (error) {  
      console.error('Download error:', error)  
      return  
    }  
      
    // Crear blob URL y descargar  
    const url \= URL.createObjectURL(data)  
    const a \= document.createElement('a')  
    a.href \= url  
    a.download \= filePath.split('/').pop() || 'file'  
    a.click()  
    URL.revokeObjectURL(url)  
  }  
    
  async function deleteFile(filePath: string) {  
    const { error } \= await supabase.storage  
      .from('customer-documents')  
      .remove(\[filePath\])  
      
    if (error) {  
      console.error('Delete error:', error)  
      return  
    }  
      
    alert('Archivo eliminado')  
    loadFiles() // Reload  
  }  
    
  return (  
    \<div\>  
      \<button onClick={loadFiles}\>Cargar archivos\</button\>  
        
      \<ul\>  
        {files.map(file \=\> (  
          \<li key={file.name}\>  
            {file.name} ({(file.metadata.size / 1024).toFixed(2)} KB)  
            \<button onClick={() \=\> downloadFile(file.name)}\>Descargar\</button\>  
            \<button onClick={() \=\> deleteFile(file.name)}\>Eliminar\</button\>  
          \</li\>  
        ))}  
      \</ul\>  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 5: Upload desde Edge Function

\*\*Generar reporte y guardarlo:\*\*  
\`\`\`typescript  
// supabase/functions/generate-report/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) \=\> {  
  try {  
    const supabaseClient \= createClient(  
      Deno.env.get('SUPABASE\_URL')\!,  
      Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')\!  
    )  
      
    // Auth y tenant\_id  
    const { data: { user } } \= await supabaseClient.auth.getUser()  
    const tenantId \= user.user\_metadata?.tenant\_id  
      
    // Generar CSV de customers  
    await supabaseClient.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
      
    const { data: customers } \= await supabaseClient  
      .from('customers')  
      .select('name, email, phone, status')  
      
    // Construir CSV  
    const csv \= \[  
      'Nombre,Email,Teléfono,Estado',  
      ...customers.map(c \=\> \`${c.name},${c.email},${c.phone},${c.status}\`)  
    \].join('\\n')  
      
    // Upload a Storage  
    const fileName \= \`export\_customers\_${new Date().toISOString().split('T')\[0\]}.csv\`  
    const filePath \= \`${tenantId}/reports/${fileName}\`  
      
    const { data: uploadData, error: uploadError } \= await supabaseClient.storage  
      .from('customer-documents')  
      .upload(filePath, csv, {  
        contentType: 'text/csv',  
        upsert: true  
      })  
      
    if (uploadError) {  
      throw uploadError  
    }  
      
    // Crear signed URL para download  
    const { data: signedUrl } \= await supabaseClient.storage  
      .from('customer-documents')  
      .createSignedUrl(filePath, 60 \* 60 \* 24\) // 24 horas  
      
    return new Response(  
      JSON.stringify({  
        message: 'Report generated',  
        download\_url: signedUrl?.signedUrl  
      }),  
      { status: 200, headers: { 'Content-Type': 'application/json' } }  
    )  
      
  } catch (error) {  
    return new Response(  
      JSON.stringify({ error: error.message }),  
      { status: 500 }  
    )  
  }  
})  
\`\`\`

\---

\#\# 🚨 Errores Comunes

\#\#\# Error 1: No validar tenant en path  
\`\`\`typescript  
// ❌ MAL \- User controla path  
const filePath \= \`${customerId}/document.pdf\` // User puede poner cualquier ID

// ✅ BIEN \- Tenant del JWT  
const tenantId \= user.user\_metadata?.tenant\_id  
const filePath \= \`${tenantId}/customers/${customerId}/document.pdf\`  
\`\`\`

\#\#\# Error 2: Bucket público sin querer  
\`\`\`typescript  
// ❌ MAL \- Bucket público  
// Cualquiera con URL puede descargar

// ✅ BIEN \- Bucket privado \+ signed URLs  
const { data } \= await supabase.storage  
  .from('customer-documents')  
  .createSignedUrl(filePath, 3600\) // Expira en 1 hora  
\`\`\`

\#\#\# Error 3: No validar tipo de archivo  
\`\`\`typescript  
// ❌ MAL \- Acepta cualquier archivo  
await supabase.storage.from('docs').upload(path, file)

// ✅ BIEN \- Validar MIME type  
const allowedTypes \= \['image/jpeg', 'image/png', 'application/pdf'\]  
if (\!allowedTypes.includes(file.type)) {  
  throw new Error('File type not allowed')  
}  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] Bucket creado con policies  
\- \[ \] Estructura de folders definida  
\- \[ \] RLS policies protegen por tenant  
\- \[ \] Validación de tipo de archivo  
\- \[ \] Validación de tamaño (\<10MB)  
\- \[ \] Signed URLs para archivos privados  
\- \[ \] CDN configurado (automático en Supabase)

\---

\#\# 💡 Para Pato

\#\#\# Setup inicial  
\`\`\`bash  
\# Crear bucket via Supabase CLI  
supabase storage create customer-documents \--public false

\# O en Dashboard:  
\# Storage → New Bucket → customer-documents  
\`\`\`

\#\#\# Comandos útiles  
\`\`\`typescript  
// Listar buckets  
const { data: buckets } \= await supabase.storage.listBuckets()

// Obtener metadata de archivo  
const { data } \= await supabase.storage  
  .from('customer-documents')  
  .list('tenant-id/logos')

// Mover archivo  
await supabase.storage  
  .from('customer-documents')  
  .move('old/path.pdf', 'new/path.pdf')

// Copiar archivo  
await supabase.storage  
  .from('customer-documents')  
  .copy('source.pdf', 'destination.pdf')  
\`\`\`

\---  
