---
name: supabase-client-setup
description: Setup de cliente Supabase en Next.js con SSR y cookies
---

\# Skill: Supabase Client Setup (Next.js)

\#\# 🎯 Qué es  
Configuración completa del cliente de Supabase en Next.js 14+ con App Router. Incluye Server Components, Client Components, middleware de auth, y types generation.

\*\*Analogía Simple:\*\*  
Setup del cliente es como instalar "enchufes" en tu casa:  
\- Server Components \= enchufes directos (más seguros)  
\- Client Components \= enchufes con interruptor (interactivos)  
\- Middleware \= fusible (protege rutas)  
\- Types \= etiquetas (sabes qué va en cada enchufe)

En PymePilot:  
\- Conexión a Supabase desde Next.js  
\- Auth automático en Server Components  
\- Protección de rutas privadas  
\- TypeScript con types de DB

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al configurar proyecto Next.js nuevo  
\- ✅ Al migrar a App Router  
\- ✅ Al actualizar versión de Supabase  
\- ✅ Al agregar tables nuevas (regenerar types)

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Instalación  
\`\`\`bash  
cd /home/pato/pymepilot-core

\# Instalar dependencias  
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs

\# Instalar Supabase CLI (si no está)  
npm install supabase \--save-dev  
\`\`\`

\#\#\# Práctica 2: Variables de Entorno  
\`\`\`bash  
\# .env.local  
NEXT\_PUBLIC\_SUPABASE\_URL=https://xyz.supabase.co  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=eyJhbGc...  
SUPABASE\_SERVICE\_ROLE\_KEY=eyJhbGc... \# NO expongas en frontend  
\`\`\`

\#\#\# Práctica 3: Types Generation  
\`\`\`bash  
\# Generar types de PostgreSQL  
npx supabase gen types typescript \--project-id xyz \> types/supabase.ts

\# Re-generar después de migrations  
npx supabase gen types typescript \--project-id xyz \> types/supabase.ts  
\`\`\`

\*\*Usar types:\*\*  
\`\`\`typescript  
// types/supabase.ts (generado automáticamente)  
export type Database \= {  
  public: {  
    Tables: {  
      customers: {  
        Row: {  
          id: string  
          tenant\_id: string  
          name: string  
          email: string  
          // ...  
        }  
        Insert: {  
          id?: string  
          tenant\_id: string  
          name: string  
          // ...  
        }  
        Update: {  
          name?: string  
          email?: string  
          // ...  
        }  
      }  
      // ... otras tablas  
    }  
  }  
}

// Usar en código  
import { Database } from '@/types/supabase'

const supabase \= createClient\<Database\>(url, key)

// Ahora TypeScript conoce la estructura  
const { data } \= await supabase.from('customers').select('\*')  
// data es tipo Customer\[\]  
\`\`\`

\#\#\# Práctica 4: Client para Server Components  
\`\`\`typescript  
// utils/supabase/server.ts  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'  
import { Database } from '@/types/supabase'

export const createClient \= () \=\> {  
  return createServerComponentClient\<Database\>({ cookies })  
}  
\`\`\`

\*\*Usar en Server Component:\*\*  
\`\`\`typescript  
// app/dashboard/page.tsx  
import { createClient } from '@/utils/supabase/server'  
import { redirect } from 'next/navigation'

export default async function DashboardPage() {  
  const supabase \= createClient()  
    
  const { data: { session } } \= await supabase.auth.getSession()  
    
  if (\!session) {  
    redirect('/login')  
  }  
    
  const tenantId \= session.user.user\_metadata?.tenant\_id  
    
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  const { data: customers } \= await supabase  
    .from('customers')  
    .select('\*')  
    .limit(10)  
    
  return (  
    \<div\>  
      \<h1\>Customers\</h1\>  
      \<ul\>  
        {customers?.map(c \=\> \<li key={c.id}\>{c.name}\</li\>)}  
      \</ul\>  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 5: Client para Client Components  
\`\`\`typescript  
// utils/supabase/client.ts  
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'  
import { Database } from '@/types/supabase'

export const createClient \= () \=\> {  
  return createClientComponentClient\<Database\>()  
}  
\`\`\`

\*\*Usar en Client Component:\*\*  
\`\`\`typescript  
// app/customers/new/page.tsx  
'use client'

import { createClient } from '@/utils/supabase/client'  
import { useState } from 'react'

export default function NewCustomerPage() {  
  const supabase \= createClient()  
  const \[name, setName\] \= useState('')  
    
  async function handleSubmit(e: React.FormEvent) {  
    e.preventDefault()  
      
    const { data: { user } } \= await supabase.auth.getUser()  
    const tenantId \= user?.user\_metadata?.tenant\_id  
      
    const { error } \= await supabase  
      .from('customers')  
      .insert({   
        tenant\_id: tenantId,  
        name: name   
      })  
      
    if (error) {  
      alert('Error: ' \+ error.message)  
    } else {  
      alert('Customer created\!')  
    }  
  }  
    
  return (  
    \<form onSubmit={handleSubmit}\>  
      \<input value={name} onChange={e \=\> setName(e.target.value)} /\>  
      \<button type="submit"\>Create\</button\>  
    \</form\>  
  )  
}  
\`\`\`

\#\#\# Práctica 6: Middleware de Auth  
\`\`\`typescript  
// middleware.ts  
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'  
import { NextResponse } from 'next/server'  
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {  
  const res \= NextResponse.next()  
  const supabase \= createMiddlewareClient({ req, res })  
    
  // Refresh session  
  const { data: { session } } \= await supabase.auth.getSession()  
    
  // Rutas protegidas  
  const protectedPaths \= \['/dashboard', '/customers', '/predictions'\]  
  const isProtected \= protectedPaths.some(path \=\>   
    req.nextUrl.pathname.startsWith(path)  
  )  
    
  if (isProtected && \!session) {  
    return NextResponse.redirect(new URL('/login', req.url))  
  }  
    
  return res  
}

export const config \= {  
  matcher: \['/dashboard/:path\*', '/customers/:path\*', '/predictions/:path\*'\]  
}  
\`\`\`

\#\#\# Práctica 7: Route Handler (API Routes)  
\`\`\`typescript  
// app/api/predictions/route.ts  
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'  
import { NextResponse } from 'next/server'

export async function GET(request: Request) {  
  const supabase \= createRouteHandlerClient({ cookies })  
    
  const { data: { session } } \= await supabase.auth.getSession()  
    
  if (\!session) {  
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })  
  }  
    
  const tenantId \= session.user.user\_metadata?.tenant\_id  
    
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  const { data: predictions } \= await supabase  
    .from('predictions')  
    .select('\*')  
    .order('created\_at', { ascending: false })  
    .limit(50)  
    
  return NextResponse.json({ predictions })  
}

export async function POST(request: Request) {  
  const supabase \= createRouteHandlerClient({ cookies })  
    
  const { data: { session } } \= await supabase.auth.getSession()  
    
  if (\!session) {  
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })  
  }  
    
  const body \= await request.json()  
    
  // ... lógica de creación  
    
  return NextResponse.json({ success: true })  
}  
\`\`\`

\---

\#\# 🚨 Errores Comunes

\#\#\# Error 1: Usar client incorrecto  
\`\`\`typescript  
// ❌ MAL \- Client component en Server Component  
import { createClientComponentClient } from '...'  
export default async function Page() { // async \= Server Component  
  const supabase \= createClientComponentClient() // ERROR  
}

// ✅ BIEN  
import { createServerComponentClient } from '...'  
export default async function Page() {  
  const supabase \= createServerComponentClient({ cookies })  
}  
\`\`\`

\#\#\# Error 2: No regenerar types  
\`\`\`sql  
\-- Agregaste columna nueva  
ALTER TABLE customers ADD COLUMN phone\_verified BOOLEAN;  
\`\`\`  
\`\`\`typescript  
// Types desactualizados  
const { data } \= await supabase.from('customers').select('phone\_verified')  
// TypeScript no conoce phone\_verified

// ✅ FIX: Regenerar types  
npx supabase gen types typescript \--project-id xyz \> types/supabase.ts  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] Dependencias instaladas  
\- \[ \] Variables de entorno configuradas  
\- \[ \] Types generados de PostgreSQL  
\- \[ \] Middleware de auth configurado  
\- \[ \] Server Components usan createServerComponentClient  
\- \[ \] Client Components usan createClientComponentClient  
\- \[ \] Route Handlers usan createRouteHandlerClient

\---

\#\# 💡 Para Pato

\#\#\# Setup completo (paso a paso)  
\`\`\`bash  
\# 1\. Instalar deps  
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs

\# 2\. Crear .env.local  
cat \> .env.local \<\< EOF  
NEXT\_PUBLIC\_SUPABASE\_URL=https://xyz.supabase.co  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=eyJhbGc...  
SUPABASE\_SERVICE\_ROLE\_KEY=eyJhbGc...  
EOF

\# 3\. Generar types  
mkdir \-p types  
npx supabase gen types typescript \--project-id xyz \> types/supabase.ts

\# 4\. Crear utils  
mkdir \-p utils/supabase  
\# Crear utils/supabase/server.ts  
\# Crear utils/supabase/client.ts

\# 5\. Crear middleware.ts

\# 6\. Listo para usar\!  
\`\`\`

\#\#\# Regenerar types después de migrations  
\`\`\`bash  
\# Después de cada migration  
npx supabase gen types typescript \--project-id xyz \> types/supabase.ts  
\`\`\`

\---  
