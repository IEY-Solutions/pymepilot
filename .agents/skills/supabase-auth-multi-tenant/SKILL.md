\# Skill: Supabase Auth Multi-Tenant

\#\# 🎯 Qué es  
Configuración completa de Supabase Auth para arquitectura multi-tenant en PymePilot. Incluye signup/login con tenant\_id en JWT, roles por tenant, y protección de rutas.

\*\*Analogía Simple:\*\*  
Auth multi-tenant es como un edificio de oficinas:  
\- Cada empresa (tenant) tiene su piso  
\- Al entrar, recibís credencial que dice "empresa X, empleado Y"  
\- La credencial solo abre puertas de TU empresa  
\- No podés entrar a oficinas de otras empresas

En Supabase:  
\- User signup → asignamos tenant\_id  
\- Login → JWT incluye tenant\_id en metadata  
\- Cada request → validamos tenant del user  
\- RLS \+ Auth \= doble protección

\*\*Por qué es CRÍTICO para PymePilot:\*\*  
\- IEY necesita que solo su equipo vea sus datos  
\- Cada distribuidor tiene sus propios usuarios  
\- Un bug \= user de tenant A ve datos de tenant B  
\- Auth es la PRIMERA capa de defensa

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al configurar Supabase por primera vez  
\- ✅ Al agregar métodos de auth nuevos (OAuth, magic links)  
\- ✅ Al modificar estructura de users/roles  
\- ✅ Al cambiar lógica de signup/login

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Onboardeás nuevo tenant  
\- ⚠️ Agregás roles nuevos  
\- ⚠️ Modificás claims del JWT  
\- ⚠️ Detectás problemas de auth en producción

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Schema de Auth con Tenant

\*\*Estructura en auth.users (Supabase):\*\*  
\`\`\`sql  
\-- Tabla users (managed por Supabase Auth)  
auth.users  
├─ id (UUID, PK)  
├─ email (TEXT)  
├─ encrypted\_password (TEXT)  
├─ email\_confirmed\_at (TIMESTAMP)  
├─ raw\_user\_meta\_data (JSONB) ← AQUÍ va tenant\_id  
└─ raw\_app\_meta\_data (JSONB)   ← AQUÍ van roles

\-- Estructura de raw\_user\_meta\_data:  
{  
  "tenant\_id": "123e4567-e89b-12d3-a456-426614174000",  
  "tenant\_name": "IEY",  
  "full\_name": "Patricio Usuario"  
}

\-- Estructura de raw\_app\_meta\_data:  
{  
  "provider": "email",  
  "roles": \["user"\]  // o \["admin"\]  
}  
\`\`\`

\*\*Tabla users extendida (tu schema público):\*\*  
\`\`\`sql  
\-- Tabla pública para data adicional de users  
CREATE TABLE public.user\_profiles (  
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  
    tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
      
    full\_name TEXT NOT NULL,  
    avatar\_url TEXT,  
    phone TEXT,  
      
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),  
    is\_active BOOLEAN NOT NULL DEFAULT true,  
      
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

\-- Index  
CREATE INDEX idx\_user\_profiles\_tenant ON user\_profiles(tenant\_id);

\-- RLS  
ALTER TABLE user\_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user\_profiles\_isolation ON user\_profiles  
    FOR ALL  
    USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

\-- Trigger  
CREATE TRIGGER set\_updated\_at  
    BEFORE UPDATE ON user\_profiles  
    FOR EACH ROW  
    EXECUTE FUNCTION trigger\_set\_updated\_at();  
\`\`\`

\#\#\# Práctica 2: Signup Multi-Tenant

\*\*Edge Function: signup.ts\*\*  
\`\`\`typescript  
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) \=\> {  
  try {  
    const { email, password, tenant\_id, full\_name } \= await req.json()  
      
    // Validar inputs  
    if (\!email || \!password || \!tenant\_id || \!full\_name) {  
      return new Response(  
        JSON.stringify({ error: 'Missing required fields' }),  
        { status: 400, headers: { 'Content-Type': 'application/json' } }  
      )  
    }  
      
    // Crear cliente con Service Role Key  
    const supabase \= createClient(  
      Deno.env.get('SUPABASE\_URL')\!,  
      Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')\!  
    )  
      
    // Verificar que tenant existe  
    const { data: tenant, error: tenantError } \= await supabase  
      .from('tenants')  
      .select('id, name')  
      .eq('id', tenant\_id)  
      .single()  
      
    if (tenantError || \!tenant) {  
      return new Response(  
        JSON.stringify({ error: 'Invalid tenant\_id' }),  
        { status: 400, headers: { 'Content-Type': 'application/json' } }  
      )  
    }  
      
    // Crear usuario en auth.users  
    const { data: authData, error: authError } \= await supabase.auth.admin.createUser({  
      email,  
      password,  
      email\_confirm: false, // Requiere confirmación de email  
      user\_metadata: {  
        tenant\_id: tenant\_id,  
        tenant\_name: tenant.name,  
        full\_name: full\_name  
      }  
    })  
      
    if (authError) {  
      console.error('Auth error:', authError)  
      return new Response(  
        JSON.stringify({ error: authError.message }),  
        { status: 400, headers: { 'Content-Type': 'application/json' } }  
      )  
    }  
      
    // Crear perfil en user\_profiles  
    const { error: profileError } \= await supabase  
      .from('user\_profiles')  
      .insert({  
        id: authData.user.id,  
        tenant\_id: tenant\_id,  
        full\_name: full\_name,  
        role: 'user' // Default role  
      })  
      
    if (profileError) {  
      console.error('Profile creation error:', profileError)  
        
      // Rollback: eliminar usuario de auth  
      await supabase.auth.admin.deleteUser(authData.user.id)  
        
      return new Response(  
        JSON.stringify({ error: 'Failed to create user profile' }),  
        { status: 500, headers: { 'Content-Type': 'application/json' } }  
      )  
    }  
      
    return new Response(  
      JSON.stringify({  
        message: 'User created successfully. Please check email to confirm.',  
        user\_id: authData.user.id  
      }),  
      { status: 201, headers: { 'Content-Type': 'application/json' } }  
    )  
      
  } catch (error) {  
    console.error('Signup error:', error)  
    return new Response(  
      JSON.stringify({ error: 'Internal server error' }),  
      { status: 500, headers: { 'Content-Type': 'application/json' } }  
    )  
  }  
})  
\`\`\`

\*\*Uso desde frontend:\*\*  
\`\`\`typescript  
// app/signup/page.tsx  
'use client'

import { useState } from 'react'

export default function SignupPage() {  
  const \[email, setEmail\] \= useState('')  
  const \[password, setPassword\] \= useState('')  
  const \[fullName, setFullName\] \= useState('')  
  const \[loading, setLoading\] \= useState(false)  
    
  async function handleSignup(e: React.FormEvent) {  
    e.preventDefault()  
    setLoading(true)  
      
    try {  
      const response \= await fetch('/api/auth/signup', {  
        method: 'POST',  
        headers: { 'Content-Type': 'application/json' },  
        body: JSON.stringify({  
          email,  
          password,  
          full\_name: fullName,  
          tenant\_id: 'uuid-de-iey' // Hardcoded por ahora (1 tenant)  
        })  
      })  
        
      const data \= await response.json()  
        
      if (response.ok) {  
        alert('Cuenta creada\! Revisá tu email para confirmar.')  
      } else {  
        alert(\`Error: ${data.error}\`)  
      }  
    } catch (error) {  
      console.error('Signup error:', error)  
      alert('Error al crear cuenta')  
    } finally {  
      setLoading(false)  
    }  
  }  
    
  return (  
    \<form onSubmit={handleSignup}\>  
      \<input  
        type="text"  
        placeholder="Nombre completo"  
        value={fullName}  
        onChange={(e) \=\> setFullName(e.target.value)}  
        required  
      /\>  
      \<input  
        type="email"  
        placeholder="Email"  
        value={email}  
        onChange={(e) \=\> setEmail(e.target.value)}  
        required  
      /\>  
      \<input  
        type="password"  
        placeholder="Password"  
        value={password}  
        onChange={(e) \=\> setPassword(e.target.value)}  
        required  
      /\>  
      \<button type="submit" disabled={loading}\>  
        {loading ? 'Creando...' : 'Crear cuenta'}  
      \</button\>  
    \</form\>  
  )  
}  
\`\`\`

\#\#\# Práctica 3: Login y JWT con Tenant

\*\*Login estándar (desde Next.js):\*\*  
\`\`\`typescript  
// app/login/page.tsx  
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'  
import { useState } from 'react'  
import { useRouter } from 'next/navigation'

export default function LoginPage() {  
  const \[email, setEmail\] \= useState('')  
  const \[password, setPassword\] \= useState('')  
  const \[loading, setLoading\] \= useState(false)  
  const router \= useRouter()  
  const supabase \= createClientComponentClient()  
    
  async function handleLogin(e: React.FormEvent) {  
    e.preventDefault()  
    setLoading(true)  
      
    try {  
      const { data, error } \= await supabase.auth.signInWithPassword({  
        email,  
        password  
      })  
        
      if (error) {  
        alert(\`Error: ${error.message}\`)  
        return  
      }  
        
      // Verificar que user tiene tenant\_id  
      const tenantId \= data.user?.user\_metadata?.tenant\_id  
        
      if (\!tenantId) {  
        alert('Error: Usuario sin tenant asignado')  
        await supabase.auth.signOut()  
        return  
      }  
        
      // Login exitoso  
      router.push('/dashboard')  
      router.refresh()  
        
    } catch (error) {  
      console.error('Login error:', error)  
      alert('Error al iniciar sesión')  
    } finally {  
      setLoading(false)  
    }  
  }  
    
  return (  
    \<form onSubmit={handleLogin}\>  
      \<input  
        type="email"  
        placeholder="Email"  
        value={email}  
        onChange={(e) \=\> setEmail(e.target.value)}  
        required  
      /\>  
      \<input  
        type="password"  
        placeholder="Password"  
        value={password}  
        onChange={(e) \=\> setPassword(e.target.value)}  
        required  
      /\>  
      \<button type="submit" disabled={loading}\>  
        {loading ? 'Iniciando...' : 'Iniciar sesión'}  
      \</button\>  
    \</form\>  
  )  
}  
\`\`\`

\*\*Leer tenant\_id del JWT (en Edge Function):\*\*  
\`\`\`typescript  
// supabase/functions/example/index.ts  
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) \=\> {  
  // 1\. Obtener token del header  
  const authHeader \= req.headers.get('Authorization')  
    
  if (\!authHeader) {  
    return new Response('Unauthorized', { status: 401 })  
  }  
    
  const token \= authHeader.replace('Bearer ', '')  
    
  // 2\. Validar token y obtener user  
  const supabase \= createClient(  
    Deno.env.get('SUPABASE\_URL')\!,  
    Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')\!  
  )  
    
  const { data: { user }, error } \= await supabase.auth.getUser(token)  
    
  if (error || \!user) {  
    return new Response('Unauthorized', { status: 401 })  
  }  
    
  // 3\. Obtener tenant\_id del JWT  
  const tenantId \= user.user\_metadata?.tenant\_id  
    
  if (\!tenantId) {  
    return new Response('Missing tenant\_id in JWT', { status: 400 })  
  }  
    
  // 4\. Setear tenant context en DB  
  const { error: contextError } \= await supabase.rpc(  
    'set\_tenant\_context',  
    { p\_tenant\_id: tenantId }  
  )  
    
  if (contextError) {  
    console.error('Failed to set tenant context:', contextError)  
    return new Response('Internal error', { status: 500 })  
  }  
    
  // 5\. Ahora queries respetan RLS automáticamente  
  const { data: customers } \= await supabase  
    .from('customers')  
    .select('\*')  
    
  return new Response(  
    JSON.stringify(customers),  
    { headers: { 'Content-Type': 'application/json' } }  
  )  
})  
\`\`\`

\#\#\# Práctica 4: Roles y Permisos

\*\*Definir roles en signup:\*\*  
\`\`\`typescript  
// Edge Function: signup-admin.ts (solo para admins)  
// Crear usuario con role 'admin'

const { data: authData, error: authError } \= await supabase.auth.admin.createUser({  
  email,  
  password,  
  user\_metadata: {  
    tenant\_id: tenant\_id,  
    tenant\_name: tenant.name,  
    full\_name: full\_name  
  },  
  app\_metadata: {  
    roles: \['admin'\] // Role de admin  
  }  
})

// Crear perfil con role admin  
await supabase.from('user\_profiles').insert({  
  id: authData.user.id,  
  tenant\_id: tenant\_id,  
  full\_name: full\_name,  
  role: 'admin' // ← Role  
})  
\`\`\`

\*\*Verificar role en Edge Function:\*\*  
\`\`\`typescript  
Deno.serve(async (req) \=\> {  
  const { data: { user } } \= await supabase.auth.getUser(token)  
    
  // Leer role de user\_metadata o app\_metadata  
  const userRole \= user.app\_metadata?.roles?.\[0\] || 'user'  
    
  // Verificar que es admin  
  if (userRole \!== 'admin') {  
    return new Response(  
      JSON.stringify({ error: 'Admin access required' }),  
      { status: 403 }  
    )  
  }  
    
  // Continuar con lógica de admin...  
})  
\`\`\`

\*\*RLS Policy basada en role:\*\*  
\`\`\`sql  
\-- Policy: Solo admins pueden eliminar customers  
CREATE POLICY customers\_delete\_admin\_only ON customers  
    FOR DELETE  
    USING (  
        tenant\_id \= current\_setting('app.tenant\_id')::uuid  
        AND (  
            SELECT role FROM user\_profiles   
            WHERE id \= auth.uid()  
        ) \= 'admin'  
    );  
\`\`\`

\#\#\# Práctica 5: Email Templates Personalizados

\*\*Configurar en Supabase Dashboard:\*\*  
\`\`\`  
Authentication → Email Templates

1\. Confirm Signup:  
   Subject: Confirmá tu cuenta en PymePilot  
   Body:  
   Hola {{ .ConfirmationURL }}\!  
     
   Hacé click en el link para confirmar tu cuenta:  
   {{ .ConfirmationURL }}  
     
   Si no creaste esta cuenta, ignorá este email.

2\. Reset Password:  
   Subject: Restablecé tu contraseña  
   Body:  
   Hacé click en el link para restablecer tu contraseña:  
   {{ .ConfirmationURL }}  
     
   El link expira en 1 hora.

3\. Magic Link:  
   Subject: Tu link de acceso a PymePilot  
   Body:  
   Hacé click para iniciar sesión:  
   {{ .ConfirmationURL }}  
\`\`\`

\*\*Configurar Redirect URLs:\*\*  
\`\`\`  
Authentication → URL Configuration

Site URL: https://pymepilot.cloud  
Redirect URLs:  
  \- https://pymepilot.cloud/auth/callback  
  \- http://localhost:3000/auth/callback (desarrollo)  
\`\`\`

\---

\#\# 💻 Ejemplos de Código

\#\#\# Ejemplo 1: Signup Completo (Admin crea usuario)  
\`\`\`typescript  
// app/admin/users/new/page.tsx  
'use client'

export default function NewUserPage() {  
  async function createUser(formData: FormData) {  
    const email \= formData.get('email') as string  
    const fullName \= formData.get('full\_name') as string  
    const role \= formData.get('role') as 'admin' | 'user'  
      
    // Generar password temporal  
    const tempPassword \= crypto.randomUUID()  
      
    const response \= await fetch('/api/admin/create-user', {  
      method: 'POST',  
      headers: { 'Content-Type': 'application/json' },  
      body: JSON.stringify({  
        email,  
        full\_name: fullName,  
        role,  
        temp\_password: tempPassword  
      })  
    })  
      
    if (response.ok) {  
      alert(\`Usuario creado. Password temporal: ${tempPassword}\`)  
    }  
  }  
    
  return (  
    \<form action={createUser}\>  
      \<input name="email" type="email" placeholder="Email" required /\>  
      \<input name="full\_name" placeholder="Nombre completo" required /\>  
      \<select name="role" required\>  
        \<option value="user"\>Usuario\</option\>  
        \<option value="admin"\>Administrador\</option\>  
      \</select\>  
      \<button type="submit"\>Crear usuario\</button\>  
    \</form\>  
  )  
}  
\`\`\`

\#\#\# Ejemplo 2: Middleware de Auth en Next.js  
\`\`\`typescript  
// middleware.ts  
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'  
import { NextResponse } from 'next/server'  
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {  
  const res \= NextResponse.next()  
  const supabase \= createMiddlewareClient({ req, res })  
    
  // Refresh session si existe  
  const { data: { session } } \= await supabase.auth.getSession()  
    
  // Rutas protegidas  
  const protectedPaths \= \['/dashboard', '/customers', '/predictions', '/admin'\]  
  const isProtectedPath \= protectedPaths.some(path \=\>   
    req.nextUrl.pathname.startsWith(path)  
  )  
    
  if (isProtectedPath && \!session) {  
    // No autenticado → redirect a login  
    return NextResponse.redirect(new URL('/login', req.url))  
  }  
    
  // Rutas de admin  
  const isAdminPath \= req.nextUrl.pathname.startsWith('/admin')  
    
  if (isAdminPath && session) {  
    // Verificar role  
    const userRole \= session.user.app\_metadata?.roles?.\[0\] || 'user'  
      
    if (userRole \!== 'admin') {  
      // No es admin → redirect a dashboard  
      return NextResponse.redirect(new URL('/dashboard', req.url))  
    }  
  }  
    
  return res  
}

export const config \= {  
  matcher: \['/dashboard/:path\*', '/customers/:path\*', '/predictions/:path\*', '/admin/:path\*'\]  
}  
\`\`\`

\#\#\# Ejemplo 3: Server Component con Auth  
\`\`\`typescript  
// app/dashboard/page.tsx  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'  
import { redirect } from 'next/navigation'

export default async function DashboardPage() {  
  const supabase \= createServerComponentClient({ cookies })  
    
  // Obtener sesión  
  const { data: { session } } \= await supabase.auth.getSession()  
    
  if (\!session) {  
    redirect('/login')  
  }  
    
  // Obtener tenant\_id del JWT  
  const tenantId \= session.user.user\_metadata?.tenant\_id  
    
  // Setear tenant context  
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  // Queries ahora respetan RLS  
  const { data: customers } \= await supabase  
    .from('customers')  
    .select('\*')  
    .limit(10)  
    
  return (  
    \<div\>  
      \<h1\>Dashboard \- {session.user.user\_metadata?.tenant\_name}\</h1\>  
      \<p\>Bienvenido, {session.user.user\_metadata?.full\_name}\</p\>  
        
      \<h2\>Clientes recientes\</h2\>  
      \<ul\>  
        {customers?.map(c \=\> (  
          \<li key={c.id}\>{c.name}\</li\>  
        ))}  
      \</ul\>  
    \</div\>  
  )  
}  
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: No incluir tenant\_id en signup  
\`\`\`typescript  
// ❌ MAL  
const { data } \= await supabase.auth.signUp({  
  email,  
  password  
})  
// Usuario sin tenant\_id → problema

// ✅ BIEN  
const { data } \= await supabase.auth.admin.createUser({  
  email,  
  password,  
  user\_metadata: {  
    tenant\_id: tenant\_id // ← OBLIGATORIO  
  }  
})  
\`\`\`

\#\#\# Error 2: No validar tenant\_id en Edge Functions  
\`\`\`typescript  
// ❌ MAL  
Deno.serve(async (req) \=\> {  
  const { customer\_id } \= await req.json()  
    
  // Sin validar tenant → cualquiera accede a cualquier customer  
  const { data } \= await supabase  
    .from('customers')  
    .select('\*')  
    .eq('id', customer\_id)  
})

// ✅ BIEN  
Deno.serve(async (req) \=\> {  
  const { data: { user } } \= await supabase.auth.getUser(token)  
  const tenantId \= user.user\_metadata?.tenant\_id  
    
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  // Ahora RLS filtra por tenant automáticamente  
  const { data } \= await supabase.from('customers').select('\*')  
})  
\`\`\`

\#\#\# Error 3: Usar client en Server Component  
\`\`\`typescript  
// ❌ MAL \- Server Component  
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default async function Page() {  
  const supabase \= createClientComponentClient() // ← ERROR  
  // ...  
}

// ✅ BIEN \- Server Component  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'

export default async function Page() {  
  const supabase \= createServerComponentClient({ cookies })  
  // ...  
}  
\`\`\`

\#\#\# Error 4: No refrescar session  
\`\`\`typescript  
// ❌ MAL \- Session expira y user se desloguea  
// Sin refresh automático

// ✅ BIEN \- Middleware refresca session  
// middleware.ts  
export async function middleware(req: NextRequest) {  
  const supabase \= createMiddlewareClient({ req, res })  
  await supabase.auth.getSession() // ← Refresca automáticamente  
}  
\`\`\`

\---

\#\# ✅ Checklist de Validación

\#\#\# Setup Inicial  
\- \[ \] Supabase project creado  
\- \[ \] Auth habilitado  
\- \[ \] Email provider configurado  
\- \[ \] Redirect URLs configuradas  
\- \[ \] Email templates personalizados

\#\#\# Multi-Tenant Configuration  
\- \[ \] tenant\_id en user\_metadata al signup  
\- \[ \] Tabla user\_profiles creada  
\- \[ \] RLS en user\_profiles  
\- \[ \] Validación de tenant\_id en Edge Functions  
\- \[ \] Roles configurados (admin, user)

\#\#\# Next.js Integration  
\- \[ \] Middleware de auth configurado  
\- \[ \] Server Components usan createServerComponentClient  
\- \[ \] Client Components usan createClientComponentClient  
\- \[ \] Rutas protegidas funcionan  
\- \[ \] Redirect a login si no auth

\#\#\# Security  
\- \[ \] Passwords con requisitos mínimos (8+ chars)  
\- \[ \] Email confirmation habilitado  
\- \[ \] JWT expira en tiempo razonable (1 hora)  
\- \[ \] Refresh tokens funcionando  
\- \[ \] No hay tenant\_id hardcodeados

\---

\#\# 📊 Métricas de Éxito

Auth funciona correctamente si:  
\- ✅ 100% de users tienen tenant\_id en JWT  
\- ✅ 0 users pueden acceder a data de otros tenants  
\- ✅ Login/signup \<2 segundos  
\- ✅ Session refresh automático funciona  
\- ✅ Email confirmation funciona

\---

\#\# 💡 Para Pato (Setup Inicial)

\#\#\# Paso 1: Crear proyecto Supabase  
\`\`\`bash  
\# 1\. Ir a https://supabase.com  
\# 2\. New Project  
\# 3\. Nombre: pymepilot  
\# 4\. Database Password: \[generar fuerte\]  
\# 5\. Region: South America (São Paulo)  
\# 6\. Pricing: Free (por ahora)

\# 7\. Guardar credenciales en .env.local  
NEXT\_PUBLIC\_SUPABASE\_URL=https://xyz.supabase.co  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=eyJhbGc...  
SUPABASE\_SERVICE\_ROLE\_KEY=eyJhbGc... (NO expongas en frontend)  
\`\`\`

\#\#\# Paso 2: Configurar Auth  
\`\`\`bash  
\# En Supabase Dashboard:  
\# Authentication → Providers → Email  
\# Enable email provider  
\# Enable email confirmations

\# Authentication → Email Templates  
\# Personalizar templates (español)

\# Authentication → URL Configuration  
\# Site URL: https://pymepilot.cloud  
\# Redirect URLs: https://pymepilot.cloud/auth/callback  
\`\`\`

\#\#\# Paso 3: Primer usuario (manual)  
\`\`\`sql  
\-- Crear tenant IEY  
INSERT INTO tenants (id, name, email)  
VALUES (  
  '123e4567-e89b-12d3-a456-426614174000',  
  'IEY',  
  'contacto@iey.com.ar'  
);

\-- Crear usuario admin en Supabase Dashboard  
\-- Authentication → Users → Add user  
\-- Email: pato@iey.com.ar  
\-- Password: \[temporal\]

\-- Agregar tenant\_id manualmente  
\-- Authentication → Users → \[click user\] → User Metadata  
{  
  "tenant\_id": "123e4567-e89b-12d3-a456-426614174000",  
  "tenant\_name": "IEY",  
  "full\_name": "Pato"  
}

\-- Crear perfil  
INSERT INTO user\_profiles (id, tenant\_id, full\_name, role)  
VALUES (  
  '\[user-id-de-supabase\]',  
  '123e4567-e89b-12d3-a456-426614174000',  
  'Pato',  
  'admin'  
);  
\`\`\`

\#\#\# Comandos útiles  
\`\`\`typescript  
// Logout programático  
await supabase.auth.signOut()

// Obtener user actual  
const { data: { user } } \= await supabase.auth.getUser()

// Cambiar password  
await supabase.auth.updateUser({ password: 'new-password' })

// Reset password (enviar email)  
await supabase.auth.resetPasswordForEmail('email@example.com')  
\`\`\`

\---  
