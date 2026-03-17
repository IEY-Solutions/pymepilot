---
name: supabase-edge-functions
description: Edge Functions serverless con tenant context en Deno
---

\# Skill: Supabase Edge Functions

\#\# 🎯 Qué es  
Guía completa para desarrollar Edge Functions (serverless) en Supabase usando Deno. Cubre desde setup local hasta deployment, incluyendo integración con Claude API, webhooks, y best practices de performance y seguridad.

\*\*Analogía Simple:\*\*  
Edge Functions son como empleados especializados que trabajan a demanda:  
\- No están todo el tiempo (solo cuando se necesitan)  
\- Hacen una tarea específica (procesar pedido, llamar API)  
\- Se pagan por uso (no hay costo fijo)  
\- Escalan automáticamente (1 o 1000 requests, funciona igual)

En PymePilot:  
\- generate-prediction: Llama Claude API para generar mensaje  
\- webhook-kommo: Recibe notificaciones de Kommo CRM  
\- webhook-whatsapp: Recibe mensajes de WhatsApp  
\- send-whatsapp: Envía mensajes por WhatsApp API

\*\*Por qué es CRÍTICO:\*\*  
\- Backend sin servidor propio (menos mantenimiento)  
\- Escalamiento automático (de 1 a 1000 clientes)  
\- Integración directa con Supabase (DB, Auth, Storage)  
\- Costos solo por uso real

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al crear Edge Function nueva  
\- ✅ Al modificar lógica de Edge Function existente  
\- ✅ Al integrar APIs third-party (Claude, Kommo, WhatsApp)  
\- ✅ Antes de deployment a producción

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Necesitás lógica backend asíncrona  
\- ⚠️ Integrás webhooks externos  
\- ⚠️ Procesás tareas que toman \>1 segundo  
\- ⚠️ Necesitás secrets protegidos del frontend

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Setup Local

\*\*Instalar Supabase CLI:\*\*  
\`\`\`bash  
\# macOS/Linux  
brew install supabase/tap/supabase

\# Windows  
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git  
scoop install supabase

\# Verificar instalación  
supabase \--version  
\`\`\`

\*\*Inicializar proyecto:\*\*  
\`\`\`bash  
cd /home/pato/pymepilot-core

\# Inicializar Supabase  
supabase init

\# Esto crea:  
\# supabase/  
\# ├─ config.toml  
\# ├─ functions/  
\# └─ migrations/

\# Linkear a proyecto remoto  
supabase link \--project-ref xyz-project-ref  
\# (obtener project-ref de Supabase Dashboard → Project Settings)  
\`\`\`

\*\*Crear primera Edge Function:\*\*  
\`\`\`bash  
\# Crear función  
supabase functions new hello-world

\# Esto crea:  
\# supabase/functions/hello-world/index.ts

\# Estructura:  
supabase/functions/  
├─ hello-world/  
│  └─ index.ts  
└─ \_shared/  (opcional, código compartido entre funciones)  
   └─ supabaseClient.ts  
\`\`\`

\#\#\# Práctica 2: Anatomía de Edge Function

\*\*Template básico:\*\*  
\`\`\`typescript  
// supabase/functions/hello-world/index.ts

// Imports  
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers (necesario para llamadas desde frontend)  
const corsHeaders \= {  
  'Access-Control-Allow-Origin': '\*',  
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',  
}

// Main handler  
serve(async (req) \=\> {  
  // Manejar OPTIONS request (CORS preflight)  
  if (req.method \=== 'OPTIONS') {  
    return new Response('ok', { headers: corsHeaders })  
  }

  try {  
    // 1\. Validar autenticación  
    const authHeader \= req.headers.get('Authorization')  
    if (\!authHeader) {  
      throw new Error('Missing authorization header')  
    }

    // 2\. Crear cliente Supabase  
    const supabaseClient \= createClient(  
      Deno.env.get('SUPABASE\_URL') ?? '',  
      Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY') ?? '',  
      {  
        global: {  
          headers: { Authorization: authHeader },  
        },  
      }  
    )

    // 3\. Obtener user autenticado  
    const { data: { user }, error: authError } \= await supabaseClient.auth.getUser()  
      
    if (authError || \!user) {  
      throw new Error('Invalid token')  
    }

    // 4\. Obtener tenant\_id del JWT  
    const tenantId \= user.user\_metadata?.tenant\_id  
      
    if (\!tenantId) {  
      throw new Error('Missing tenant\_id in JWT')  
    }

    // 5\. Setear tenant context para RLS  
    const { error: contextError } \= await supabaseClient.rpc(  
      'set\_tenant\_context',  
      { p\_tenant\_id: tenantId }  
    )  
      
    if (contextError) {  
      console.error('Failed to set tenant context:', contextError)  
      throw new Error('Internal error')  
    }

    // 6\. Lógica de negocio  
    const { data: customers, error: queryError } \= await supabaseClient  
      .from('customers')  
      .select('\*')  
      .limit(10)

    if (queryError) {  
      throw queryError  
    }

    // 7\. Retornar respuesta  
    return new Response(  
      JSON.stringify({ customers }),  
      {  
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },  
        status: 200,  
      }  
    )

  } catch (error) {  
    console.error('Error:', error)  
    return new Response(  
      JSON.stringify({ error: error.message }),  
      {  
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },  
        status: 400,  
      }  
    )  
  }  
})  
\`\`\`

\#\#\# Práctica 3: Testing Local

\*\*Servir funciones localmente:\*\*  
\`\`\`bash  
\# Iniciar Supabase local  
supabase start

\# Esto levanta:  
\# \- PostgreSQL (puerto 54322\)  
\# \- Studio (http://localhost:54323)  
\# \- API (http://localhost:54321)  
\# \- Edge Functions (http://localhost:54321/functions/v1)

\# Servir función específica  
supabase functions serve hello-world

\# O todas las funciones  
supabase functions serve

\# Con auto-reload  
supabase functions serve \--debug  
\`\`\`

\*\*Invocar función desde curl:\*\*  
\`\`\`bash  
\# GET request  
curl \-i \--location \--request GET 'http://localhost:54321/functions/v1/hello-world' \\  
  \--header 'Authorization: Bearer eyJhbGc...' \\  
  \--header 'Content-Type: application/json'

\# POST request  
curl \-i \--location \--request POST 'http://localhost:54321/functions/v1/hello-world' \\  
  \--header 'Authorization: Bearer eyJhbGc...' \\  
  \--header 'Content-Type: application/json' \\  
  \--data '{"customer\_id": "uuid-here"}'  
\`\`\`

\*\*Testing desde frontend local:\*\*  
\`\`\`typescript  
// app/test-function/page.tsx  
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function TestFunctionPage() {  
  const supabase \= createClientComponentClient()  
    
  async function testFunction() {  
    const { data, error } \= await supabase.functions.invoke('hello-world', {  
      body: { test: 'data' }  
    })  
      
    console.log('Response:', data)  
    console.log('Error:', error)  
  }  
    
  return \<button onClick={testFunction}\>Test Function\</button\>  
}  
\`\`\`

\#\#\# Práctica 4: Edge Function con Claude API

\*\*Función: generate-prediction\*\*  
\`\`\`typescript  
// supabase/functions/generate-prediction/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'  
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.20.0'

const corsHeaders \= {  
  'Access-Control-Allow-Origin': '\*',  
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',  
}

interface RequestBody {  
  customer\_id: string  
  vertical: 'activacion' | 'reposicion' | 'cross\_sell' | 'recuperacion'  
}

serve(async (req) \=\> {  
  if (req.method \=== 'OPTIONS') {  
    return new Response('ok', { headers: corsHeaders })  
  }

  try {  
    // 1\. Auth  
    const authHeader \= req.headers.get('Authorization')\!  
    const supabaseClient \= createClient(  
      Deno.env.get('SUPABASE\_URL')\!,  
      Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')\!,  
      { global: { headers: { Authorization: authHeader } } }  
    )

    const { data: { user } } \= await supabaseClient.auth.getUser()  
    if (\!user) throw new Error('Unauthorized')

    const tenantId \= user.user\_metadata?.tenant\_id  
    if (\!tenantId) throw new Error('Missing tenant\_id')

    // 2\. Setear tenant context  
    await supabaseClient.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })

    // 3\. Parse request body  
    const { customer\_id, vertical }: RequestBody \= await req.json()

    if (\!customer\_id || \!vertical) {  
      throw new Error('Missing customer\_id or vertical')  
    }

    // 4\. Obtener customer de DB  
    const { data: customer, error: customerError } \= await supabaseClient  
      .from('customers')  
      .select('id, name, email, phone, last\_purchase\_date, total\_purchases\_amount')  
      .eq('id', customer\_id)  
      .single()

    if (customerError || \!customer) {  
      throw new Error('Customer not found')  
    }

    // 5\. Obtener productos más comprados (últimos 5\)  
    const { data: topProducts } \= await supabaseClient  
      .from('order\_items')  
      .select(\`  
        product:products(name, sku),  
        quantity  
      \`)  
      .eq('order.customer\_id', customer\_id)  
      .order('quantity', { ascending: false })  
      .limit(5)

    // 6\. Construir prompt según vertical  
    const prompts \= {  
      activacion: \`Sos un asistente de ventas B2B para distribuidores mayoristas en Argentina.

Cliente inactivo:  
\- Nombre: ${customer.name}  
\- Última compra: ${customer.last\_purchase\_date}  
\- Productos más comprados: ${topProducts?.map(p \=\> p.product?.name).join(', ') || 'N/A'}

Generá un mensaje de WhatsApp corto (máx 3 líneas) para reactivar este cliente.  
Tono: amigable, directo, mencioná beneficios concretos.  
NO uses emojis. NO uses markdown.\`,  
        
      reposicion: \`Cliente activo necesita reposición de stock...\`,  
      cross\_sell: \`Cliente para cross-sell...\`,  
      recuperacion: \`Cliente inactivo para recuperar...\`  
    }

    // 7\. Llamar Claude API  
    const anthropic \= new Anthropic({  
      apiKey: Deno.env.get('ANTHROPIC\_API\_KEY')\!,  
    })

    const message \= await anthropic.messages.create({  
      model: 'claude-sonnet-4-20250514',  
      max\_tokens: 300,  
      messages: \[{  
        role: 'user',  
        content: prompts\[vertical\]  
      }\]  
    })

    const messageText \= message.content\[0\].type \=== 'text'   
      ? message.content\[0\].text   
      : ''

    // 8\. Guardar prediction en DB  
    const { data: prediction, error: predictionError } \= await supabaseClient  
      .from('predictions')  
      .insert({  
        tenant\_id: tenantId,  
        customer\_id: customer\_id,  
        vertical: vertical,  
        message\_text: messageText,  
        confidence\_score: 0.85, // Placeholder  
        status: 'pending',  
        claude\_model: 'claude-sonnet-4-20250514',  
        prompt\_tokens: message.usage.input\_tokens,  
        completion\_tokens: message.usage.output\_tokens,  
      })  
      .select()  
      .single()

    if (predictionError) {  
      console.error('Failed to save prediction:', predictionError)  
      throw new Error('Failed to save prediction')  
    }

    // 9\. Retornar resultado  
    return new Response(  
      JSON.stringify({  
        prediction\_id: prediction.id,  
        message\_text: messageText,  
        customer\_name: customer.name,  
        vertical: vertical  
      }),  
      {  
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },  
        status: 200,  
      }  
    )

  } catch (error) {  
    console.error('Error in generate-prediction:', error)  
    return new Response(  
      JSON.stringify({ error: error.message }),  
      {  
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },  
        status: 400,  
      }  
    )  
  }  
})  
\`\`\`

\#\#\# Práctica 5: Webhooks Seguros

\*\*Función: webhook-kommo\*\*  
\`\`\`typescript  
// supabase/functions/webhook-kommo/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'  
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

serve(async (req) \=\> {  
  try {  
    // 1\. Validar signature de Kommo  
    const signature \= req.headers.get('X-Kommo-Signature')  
    const body \= await req.text()  
      
    const secret \= Deno.env.get('KOMMO\_WEBHOOK\_SECRET')\!  
    const expectedSignature \= createHmac('sha256', secret)  
      .update(body)  
      .digest('hex')  
      
    if (signature \!== expectedSignature) {  
      console.error('Invalid signature')  
      return new Response('Unauthorized', { status: 401 })  
    }

    // 2\. Parse payload  
    const payload \= JSON.parse(body)  
      
    // 3\. Identificar tenant del webhook  
    // Opción A: tenant\_id en custom field del lead  
    const tenantId \= payload.leads?.add?.\[0\]?.custom\_fields?.find(  
      (f: any) \=\> f.id \=== 'tenant\_id\_field\_id'  
    )?.values?.\[0\]?.value  
      
    if (\!tenantId) {  
      console.error('Missing tenant\_id in webhook payload')  
      return new Response('Bad Request', { status: 400 })  
    }

    // 4\. Crear cliente Supabase con Service Role  
    const supabaseClient \= createClient(  
      Deno.env.get('SUPABASE\_URL')\!,  
      Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')\!  
    )

    // 5\. Setear tenant context  
    await supabaseClient.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })

    // 6\. Procesar webhook según tipo  
    if (payload.leads?.add) {  
      // Nuevo lead creado en Kommo  
      const lead \= payload.leads.add\[0\]  
        
      // Buscar/crear customer  
      const { data: customer, error } \= await supabaseClient  
        .from('customers')  
        .upsert({  
          tenant\_id: tenantId,  
          name: lead.name,  
          email: lead.custom\_fields?.find((f: any) \=\> f.code \=== 'EMAIL')?.values?.\[0\]?.value,  
          phone: lead.custom\_fields?.find((f: any) \=\> f.code \=== 'PHONE')?.values?.\[0\]?.value,  
          kommo\_lead\_id: lead.id,  
        })  
        .select()  
        .single()

      console.log('Customer created/updated:', customer?.id)  
    }

    // 7\. Retornar 200 OK (Kommo requiere esto)  
    return new Response('OK', { status: 200 })

  } catch (error) {  
    console.error('Webhook error:', error)  
    // IMPORTANTE: Retornar 200 incluso si hay error interno  
    // Para que Kommo no reintente infinitamente  
    return new Response('OK', { status: 200 })  
  }  
})  
\`\`\`

\---

\#\# 💻 Ejemplos de Código

\#\#\# Ejemplo 1: Edge Function con Retry Logic  
\`\`\`typescript  
// supabase/functions/send-whatsapp/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

async function sendWhatsAppWithRetry(  
  phone: string,  
  message: string,  
  maxRetries \= 3  
): Promise\<boolean\> {  
  let lastError: Error | null \= null  
    
  for (let attempt \= 1; attempt \<= maxRetries; attempt++) {  
    try {  
      const response \= await fetch('https://graph.facebook.com/v18.0/PHONE\_ID/messages', {  
        method: 'POST',  
        headers: {  
          'Authorization': \`Bearer ${Deno.env.get('WHATSAPP\_TOKEN')}\`,  
          'Content-Type': 'application/json',  
        },  
        body: JSON.stringify({  
          messaging\_product: 'whatsapp',  
          to: phone,  
          type: 'text',  
          text: { body: message }  
        })  
      })

      if (response.ok) {  
        return true  
      }

      const error \= await response.json()  
      throw new Error(\`WhatsApp API error: ${JSON.stringify(error)}\`)

    } catch (error) {  
      lastError \= error as Error  
      console.error(\`Attempt ${attempt}/${maxRetries} failed:\`, error)  
        
      if (attempt \< maxRetries) {  
        // Exponential backoff: 1s, 2s, 4s  
        const waitTime \= Math.pow(2, attempt \- 1\) \* 1000  
        await new Promise(resolve \=\> setTimeout(resolve, waitTime))  
      }  
    }  
  }

  // Todos los intentos fallaron  
  throw lastError\!  
}

serve(async (req) \=\> {  
  try {  
    const { prediction\_id } \= await req.json()  
      
    // ... auth y validación  
      
    // Obtener prediction  
    const { data: prediction } \= await supabaseClient  
      .from('predictions')  
      .select('\*, customer:customers(phone, name)')  
      .eq('id', prediction\_id)  
      .single()

    // Enviar con retry  
    const success \= await sendWhatsAppWithRetry(  
      prediction.customer.phone,  
      prediction.message\_text  
    )

    if (success) {  
      // Actualizar estado  
      await supabaseClient  
        .from('predictions')  
        .update({   
          status: 'sent',  
          sent\_at: new Date().toISOString()   
        })  
        .eq('id', prediction\_id)  
    }

    return new Response(JSON.stringify({ success }), { status: 200 })

  } catch (error) {  
    console.error('Error:', error)  
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })  
  }  
})  
\`\`\`

\#\#\# Ejemplo 2: Edge Function con Caching  
\`\`\`typescript  
// supabase/functions/get-kpis/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Cache simple en memoria (se resetea cuando función se reinicia)  
const cache \= new Map\<string, { data: any; timestamp: number }\>()  
const CACHE\_TTL \= 5 \* 60 \* 1000 // 5 minutos

serve(async (req) \=\> {  
  try {  
    // ... auth  
      
    const tenantId \= user.user\_metadata?.tenant\_id  
    const cacheKey \= \`kpis:${tenantId}\`  
      
    // Verificar cache  
    const cached \= cache.get(cacheKey)  
    if (cached && (Date.now() \- cached.timestamp) \< CACHE\_TTL) {  
      console.log('Cache HIT')  
      return new Response(JSON.stringify(cached.data), {  
        headers: {   
          'Content-Type': 'application/json',  
          'X-Cache': 'HIT'  
        }  
      })  
    }

    console.log('Cache MISS \- fetching from DB')

    // Calcular KPIs (query costosa)  
    const { data: kpis } \= await supabaseClient.rpc('calculate\_kpis', {  
      p\_tenant\_id: tenantId  
    })

    // Guardar en cache  
    cache.set(cacheKey, {  
      data: kpis,  
      timestamp: Date.now()  
    })

    return new Response(JSON.stringify(kpis), {  
      headers: {   
        'Content-Type': 'application/json',  
        'X-Cache': 'MISS'  
      }  
    })

  } catch (error) {  
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })  
  }  
})  
\`\`\`

\#\#\# Ejemplo 3: Deployment y Secrets

\*\*Configurar secrets:\*\*  
\`\`\`bash  
\# Secrets para desarrollo local  
\# Crear archivo .env en root del proyecto  
cat \> .env \<\< EOF  
SUPABASE\_URL=http://localhost:54321  
SUPABASE\_SERVICE\_ROLE\_KEY=eyJhbGc...  
ANTHROPIC\_API\_KEY=sk-ant-api03-...  
KOMMO\_WEBHOOK\_SECRET=abc123...  
WHATSAPP\_TOKEN=EAAabc123...  
EOF

\# Secrets para producción  
supabase secrets set ANTHROPIC\_API\_KEY=sk-ant-api03-...  
supabase secrets set KOMMO\_WEBHOOK\_SECRET=abc123...  
supabase secrets set WHATSAPP\_TOKEN=EAAabc123...

\# Listar secrets  
supabase secrets list  
\`\`\`

\*\*Deploy a producción:\*\*  
\`\`\`bash  
\# Deploy función específica  
supabase functions deploy generate-prediction

\# Deploy todas las funciones  
supabase functions deploy

\# Ver logs en producción  
supabase functions logs generate-prediction

\# Ver logs en tiempo real  
supabase functions logs generate-prediction \--follow  
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: No manejar CORS  
\`\`\`typescript  
// ❌ MAL \- Sin CORS headers  
serve(async (req) \=\> {  
  return new Response(JSON.stringify({ data: 'hello' }))  
})  
// Llamadas desde frontend fallan con CORS error

// ✅ BIEN \- Con CORS  
const corsHeaders \= {  
  'Access-Control-Allow-Origin': '\*',  
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',  
}

serve(async (req) \=\> {  
  if (req.method \=== 'OPTIONS') {  
    return new Response('ok', { headers: corsHeaders })  
  }  
    
  return new Response(  
    JSON.stringify({ data: 'hello' }),  
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }  
  )  
})  
\`\`\`

\#\#\# Error 2: No validar tenant\_id  
\`\`\`typescript  
// ❌ MAL \- Sin validar tenant  
serve(async (req) \=\> {  
  const { customer\_id } \= await req.json()  
    
  // Cualquier user puede acceder a cualquier customer  
  const { data } \= await supabaseClient  
    .from('customers')  
    .select('\*')  
    .eq('id', customer\_id)  
})

// ✅ BIEN \- Validar tenant  
serve(async (req) \=\> {  
  const { data: { user } } \= await supabaseClient.auth.getUser()  
  const tenantId \= user.user\_metadata?.tenant\_id  
    
  await supabaseClient.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  // RLS filtra automáticamente  
  const { data } \= await supabaseClient.from('customers').select('\*')  
})  
\`\`\`

\#\#\# Error 3: Hardcodear secrets  
\`\`\`typescript  
// ❌ MAL  
const CLAUDE\_API\_KEY \= 'sk-ant-api03-abc123...'

// ✅ BIEN  
const CLAUDE\_API\_KEY \= Deno.env.get('ANTHROPIC\_API\_KEY')  
if (\!CLAUDE\_API\_KEY) {  
  throw new Error('Missing ANTHROPIC\_API\_KEY')  
}  
\`\`\`

\#\#\# Error 4: No manejar errores  
\`\`\`typescript  
// ❌ MAL \- Sin try/catch  
serve(async (req) \=\> {  
  const data \= await req.json() // Puede fallar si body no es JSON  
  const result \= await callExternalAPI(data) // Puede fallar  
  return new Response(JSON.stringify(result))  
})

// ✅ BIEN \- Con error handling  
serve(async (req) \=\> {  
  try {  
    const data \= await req.json()  
    const result \= await callExternalAPI(data)  
    return new Response(JSON.stringify(result), { status: 200 })  
  } catch (error) {  
    console.error('Error:', error)  
    return new Response(  
      JSON.stringify({ error: error.message }),  
      { status: 500 }  
    )  
  }  
})  
\`\`\`

\---

\#\# ✅ Checklist de Validación

\#\#\# Antes de Deploy  
\- \[ \] Función testeada localmente  
\- \[ \] CORS headers configurados  
\- \[ \] Auth validation implementada  
\- \[ \] tenant\_id validation implementada  
\- \[ \] Error handling completo  
\- \[ \] Secrets en variables de entorno (no hardcodeados)  
\- \[ \] Logging para debugging

\#\#\# Performance  
\- \[ \] Función retorna en \<2 segundos (idealmente \<500ms)  
\- \[ \] Imports lazy (si es posible)  
\- \[ \] DB queries optimizadas  
\- \[ \] Retry logic para APIs externas  
\- \[ \] Timeout configurado

\#\#\# Security  
\- \[ \] Valida auth token  
\- \[ \] Valida tenant\_id  
\- \[ \] Valida inputs (Zod, etc.)  
\- \[ \] Webhook signatures validadas  
\- \[ \] No expone secrets en logs

\---

\#\# 📊 Métricas de Éxito

Edge Functions funcionan bien si:  
\- ✅ p95 latency \<500ms  
\- ✅ Error rate \<1%  
\- ✅ 0 secrets hardcodeados  
\- ✅ 100% de requests con tenant validation  
\- ✅ Logs útiles para debugging

\---

\#\# 💡 Para Pato (Workflow Completo)

\#\#\# Crear nueva Edge Function  
\`\`\`bash  
\# 1\. Crear función  
cd /home/pato/pymepilot-core  
supabase functions new mi-funcion

\# 2\. Editar código  
nano supabase/functions/mi-funcion/index.ts

\# 3\. Testear localmente  
supabase functions serve mi-funcion \--debug

\# 4\. Invocar desde otra terminal  
curl http://localhost:54321/functions/v1/mi-funcion \\  
  \-H "Authorization: Bearer eyJhbGc..." \\  
  \-d '{"test": "data"}'

\# 5\. Deploy a producción  
supabase functions deploy mi-funcion

\# 6\. Ver logs  
supabase functions logs mi-funcion \--follow  
\`\`\`

\#\#\# Debugging  
\`\`\`typescript  
// Agregar logs detallados  
console.log('Input:', { customer\_id, vertical })  
console.log('Tenant ID:', tenantId)  
console.log('Claude response:', messageText)

// Ver logs  
supabase functions logs generate-prediction \--follow  
\`\`\`

\#\#\# Estructura recomendada  
\`\`\`  
supabase/functions/  
├─ \_shared/  
│  ├─ supabaseClient.ts     \# Cliente compartido  
│  ├─ auth.ts               \# Helpers de auth  
│  └─ types.ts              \# Types compartidos  
│  
├─ generate-prediction/  
│  └─ index.ts  
│  
├─ webhook-kommo/  
│  └─ index.ts  
│  
├─ webhook-whatsapp/  
│  └─ index.ts  
│  
└─ send-whatsapp/  
   └─ index.ts  
\`\`\`

\---  
