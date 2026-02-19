---
name: data-fetching-patterns
description: Patterns de data fetching en Server y Client Components
---

\# Skill: Data Fetching Patterns

\#\# 🎯 Qué es  
Patrones de data fetching en Next.js 14+ para PymePilot. Server Components, Client Components, cache strategies, loading states, y error handling.

\*\*Analogía Simple:\*\*  
Data fetching es como pedir comida en un restaurant:  
\- Server Component \= chef trae el plato listo desde la cocina  
\- Client Component \= mesero que va y viene con pedidos  
\- Cache \= platos que ya están listos (más rápido)  
\- Loading \= "su pedido está siendo preparado"

En PymePilot:  
\- Dashboard KPIs \= Server Component (datos al cargar página)  
\- Búsqueda en tiempo real \= Client Component (interactivo)  
\- Lista de customers \= Server Component con cache  
\- Realtime predictions \= Client Component con subscriptions

\*\*Por qué es CRÍTICO:\*\*  
\- Server Components \= mejor performance (menos JS al cliente)  
\- Client Components \= interactividad cuando necesaria  
\- Cache correcto \= app rápida  
\- Loading states \= buena UX

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al crear páginas nuevas  
\- ✅ Al fetch data de Supabase  
\- ✅ Al optimizar performance

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Server Component Fetching (DEFAULT)  
\`\`\`typescript  
// app/(dashboard)/customers/page.tsx  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'  
import CustomersTable from '@/components/features/customers/CustomersTable'

// Server Component (por defecto \- NO 'use client')  
export default async function CustomersPage() {  
  const supabase \= createServerComponentClient({ cookies })  
    
  // 1\. Get user y tenant  
  const { data: { user } } \= await supabase.auth.getUser()  
    
  if (\!user) {  
    redirect('/login')  
  }  
    
  const tenantId \= user.user\_metadata?.tenant\_id  
    
  // 2\. Setear tenant context  
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  // 3\. Fetch data (directo, sin useEffect)  
  const { data: customers, error } \= await supabase  
    .from('customers')  
    .select('\*')  
    .order('created\_at', { ascending: false })  
    .limit(50)  
    
  if (error) {  
    throw new Error(error.message)  
  }  
    
  // 4\. Render (sin loading state, Next.js maneja con loading.tsx)  
  return (  
    \<div\>  
      \<h1 className="text-2xl font-bold mb-6"\>Customers\</h1\>  
      \<CustomersTable customers={customers} /\>  
    \</div\>  
  )  
}  
\`\`\`

\*\*Ventajas:\*\*  
\- ✅ Sin useEffect, useState  
\- ✅ Fetch en servidor (más rápido)  
\- ✅ No envía JS del fetch al cliente  
\- ✅ SEO friendly

\#\#\# Práctica 2: Server Component con Parallel Fetching  
\`\`\`typescript  
// app/(dashboard)/page.tsx  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'  
import KPICard from '@/components/features/dashboard/KPICard'

export default async function DashboardPage() {  
  const supabase \= createServerComponentClient({ cookies })  
    
  const { data: { user } } \= await supabase.auth.getUser()  
  const tenantId \= user?.user\_metadata?.tenant\_id  
    
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  // Fetch PARALELO (más rápido que secuencial)  
  const \[  
    { count: customersCount },  
    { count: predictionsCount },  
    { data: recentPredictions },  
  \] \= await Promise.all(\[  
    supabase.from('customers').select('\*', { count: 'exact', head: true }),  
    supabase.from('predictions').select('\*', { count: 'exact', head: true }),  
    supabase  
      .from('predictions')  
      .select('\*, customer:customers(name)')  
      .order('created\_at', { ascending: false })  
      .limit(5),  
  \])  
    
  return (  
    \<div className="space-y-6"\>  
      \<h1 className="text-2xl font-bold"\>Dashboard\</h1\>  
        
      \<div className="grid grid-cols-1 md:grid-cols-3 gap-4"\>  
        \<KPICard title="Customers" value={customersCount || 0} /\>  
        \<KPICard title="Predictions" value={predictionsCount || 0} /\>  
        \<KPICard title="Success Rate" value="85%" /\>  
      \</div\>  
        
      \<div\>  
        \<h2 className="text-xl font-bold mb-4"\>Predictions Recientes\</h2\>  
        \<PredictionsList predictions={recentPredictions || \[\]} /\>  
      \</div\>  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 3: Client Component Fetching  
\`\`\`typescript  
// app/(dashboard)/predictions/realtime/page.tsx  
'use client'

import { useEffect, useState } from 'react'  
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'  
import { Skeleton } from '@/components/ui/skeleton'

export default function RealtimePredictionsPage() {  
  const \[predictions, setPredictions\] \= useState\<any\[\]\>(\[\])  
  const \[loading, setLoading\] \= useState(true)  
  const supabase \= createClientComponentClient()  
    
  useEffect(() \=\> {  
    // Fetch inicial  
    async function fetchPredictions() {  
      const { data } \= await supabase  
        .from('predictions')  
        .select('\*, customer:customers(name)')  
        .order('created\_at', { ascending: false })  
        .limit(50)  
        
      setPredictions(data || \[\])  
      setLoading(false)  
    }  
      
    fetchPredictions()  
      
    // Subscribe a cambios en tiempo real  
    const channel \= supabase  
      .channel('predictions-changes')  
      .on(  
        'postgres\_changes',  
        {  
          event: '\*',  
          schema: 'public',  
          table: 'predictions',  
        },  
        (payload) \=\> {  
          console.log('Change received:', payload)  
            
          if (payload.eventType \=== 'INSERT') {  
            setPredictions((prev) \=\> \[payload.new, ...prev\])  
          } else if (payload.eventType \=== 'UPDATE') {  
            setPredictions((prev) \=\>  
              prev.map((p) \=\> (p.id \=== payload.new.id ? payload.new : p))  
            )  
          } else if (payload.eventType \=== 'DELETE') {  
            setPredictions((prev) \=\> prev.filter((p) \=\> p.id \!== payload.old.id))  
          }  
        }  
      )  
      .subscribe()  
      
    // Cleanup  
    return () \=\> {  
      supabase.removeChannel(channel)  
    }  
  }, \[\])  
    
  if (loading) {  
    return \<PredictionsSkeleton /\>  
  }  
    
  return (  
    \<div\>  
      \<h1 className="text-2xl font-bold mb-6"\>Predictions (Tiempo Real)\</h1\>  
      \<PredictionsList predictions={predictions} /\>  
    \</div\>  
  )  
}

function PredictionsSkeleton() {  
  return (  
    \<div className="space-y-4"\>  
      \<Skeleton className="h-8 w-1/4" /\>  
      {\[1, 2, 3, 4, 5\].map((i) \=\> (  
        \<Skeleton key={i} className="h-20 w-full" /\>  
      ))}  
    \</div\>  
  )  
}  
\`\`\`

\*\*Cuándo usar Client Component:\*\*  
\- ✅ Realtime subscriptions  
\- ✅ Interactividad (búsqueda, filtros)  
\- ✅ useState, useEffect necesarios  
\- ✅ Event handlers (onClick, onChange)

\#\#\# Práctica 4: Hybrid Pattern (Server \+ Client)  
\`\`\`typescript  
// app/(dashboard)/predictions/page.tsx (Server Component)  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'  
import PredictionsClient from './PredictionsClient'

export default async function PredictionsPage() {  
  const supabase \= createServerComponentClient({ cookies })  
    
  const { data: { user } } \= await supabase.auth.getUser()  
  const tenantId \= user?.user\_metadata?.tenant\_id  
    
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  // Fetch inicial en servidor  
  const { data: initialPredictions } \= await supabase  
    .from('predictions')  
    .select('\*, customer:customers(name)')  
    .order('created\_at', { ascending: false })  
    .limit(50)  
    
  // Pasar data inicial a Client Component  
  return (  
    \<div\>  
      \<h1 className="text-2xl font-bold mb-6"\>Predictions\</h1\>  
      \<PredictionsClient initialData={initialPredictions || \[\]} /\>  
    \</div\>  
  )  
}  
\`\`\`  
\`\`\`typescript  
// app/(dashboard)/predictions/PredictionsClient.tsx (Client Component)  
'use client'

import { useState } from 'react'  
import { Input } from '@/components/ui/input'  
import PredictionsTable from '@/components/features/predictions/PredictionsTable'

interface Props {  
  initialData: any\[\]  
}

export default function PredictionsClient({ initialData }: Props) {  
  const \[predictions\] \= useState(initialData)  
  const \[search, setSearch\] \= useState('')  
    
  // Filtrar en cliente  
  const filtered \= predictions.filter((p) \=\>  
    p.customer?.name.toLowerCase().includes(search.toLowerCase())  
  )  
    
  return (  
    \<div className="space-y-4"\>  
      \<Input  
        placeholder="Buscar por customer..."  
        value={search}  
        onChange={(e) \=\> setSearch(e.target.value)}  
      /\>  
      \<PredictionsTable predictions={filtered} /\>  
    \</div\>  
  )  
}  
\`\`\`

\*\*Ventajas del Hybrid:\*\*  
\- ✅ Fetch inicial en servidor (rápido)  
\- ✅ Interactividad en cliente (búsqueda)  
\- ✅ Mejor de ambos mundos

\#\#\# Práctica 5: Cache Strategies  
\`\`\`typescript  
// app/(dashboard)/customers/page.tsx

// ❌ Cache por defecto (puede ser muy agresivo)  
export default async function CustomersPage() {  
  const { data } \= await supabase.from('customers').select('\*')  
  // Se cachea indefinidamente  
}

// ✅ Revalidar cada 60 segundos  
export const revalidate \= 60

export default async function CustomersPage() {  
  const { data } \= await supabase.from('customers').select('\*')  
  // Se revalida cada 60s  
}

// ✅ No cachear (siempre fresh)  
export const revalidate \= 0

export default async function CustomersPage() {  
  const { data } \= await supabase.from('customers').select('\*')  
  // Siempre fetch fresco  
}

// ✅ Dynamic (no cachear si usa cookies/headers)  
export const dynamic \= 'force-dynamic'

export default async function CustomersPage() {  
  const { data } \= await supabase.from('customers').select('\*')  
  // No cachea porque usa auth  
}  
\`\`\`

\#\#\# Práctica 6: Loading UI con Suspense  
\`\`\`typescript  
// app/(dashboard)/customers/page.tsx  
import { Suspense } from 'react'  
import CustomersList from './CustomersList'  
import CustomersListSkeleton from './CustomersListSkeleton'

export default function CustomersPage() {  
  return (  
    \<div\>  
      \<h1 className="text-2xl font-bold mb-6"\>Customers\</h1\>  
        
      \<Suspense fallback={\<CustomersListSkeleton /\>}\>  
        \<CustomersList /\>  
      \</Suspense\>  
    \</div\>  
  )  
}  
\`\`\`  
\`\`\`typescript  
// app/(dashboard)/customers/CustomersList.tsx  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'

export default async function CustomersList() {  
  // Artificial delay para testing (remover en prod)  
  await new Promise((resolve) \=\> setTimeout(resolve, 2000))  
    
  const supabase \= createServerComponentClient({ cookies })  
    
  const { data: customers } \= await supabase  
    .from('customers')  
    .select('\*')  
    .order('created\_at', { ascending: false })  
    
  return (  
    \<div className="space-y-2"\>  
      {customers?.map((c) \=\> (  
        \<div key={c.id} className="p-4 bg-white rounded shadow"\>  
          \<h3 className="font-bold"\>{c.name}\</h3\>  
          \<p className="text-sm text-gray-600"\>{c.email}\</p\>  
        \</div\>  
      ))}  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 7: Error Handling  
\`\`\`typescript  
// app/(dashboard)/predictions/page.tsx  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'

export default async function PredictionsPage() {  
  const supabase \= createServerComponentClient({ cookies })  
    
  const { data: predictions, error } \= await supabase  
    .from('predictions')  
    .select('\*')  
    
  // Error handling  
  if (error) {  
    // Trigger error boundary  
    throw new Error(\`Failed to fetch predictions: ${error.message}\`)  
  }  
    
  if (\!predictions || predictions.length \=== 0\) {  
    return (  
      \<div className="text-center py-12"\>  
        \<p className="text-gray-600"\>No hay predictions aún.\</p\>  
        \<Button className="mt-4"\>Generar Primera Prediction\</Button\>  
      \</div\>  
    )  
  }  
    
  return \<PredictionsList predictions={predictions} /\>  
}  
\`\`\`  
\`\`\`typescript  
// app/(dashboard)/predictions/error.tsx  
'use client'

export default function Error({  
  error,  
  reset,  
}: {  
  error: Error  
  reset: () \=\> void  
}) {  
  return (  
    \<div className="flex flex-col items-center justify-center py-12"\>  
      \<h2 className="text-xl font-bold mb-2"\>Error al cargar predictions\</h2\>  
      \<p className="text-gray-600 mb-4"\>{error.message}\</p\>  
      \<Button onClick={reset}\>Reintentar\</Button\>  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 8: Pagination  
\`\`\`typescript  
// app/(dashboard)/customers/page.tsx  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'  
import Pagination from '@/components/ui/Pagination'

interface Props {  
  searchParams: {  
    page?: string  
  }  
}

export default async function CustomersPage({ searchParams }: Props) {  
  const supabase \= createServerComponentClient({ cookies })  
    
  const page \= Number(searchParams.page) || 1  
  const pageSize \= 20  
  const from \= (page \- 1\) \* pageSize  
  const to \= from \+ pageSize \- 1  
    
  const { data: { user } } \= await supabase.auth.getUser()  
  const tenantId \= user?.user\_metadata?.tenant\_id  
    
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  // Fetch con pagination  
  const { data: customers, count } \= await supabase  
    .from('customers')  
    .select('\*', { count: 'exact' })  
    .order('created\_at', { ascending: false })  
    .range(from, to)  
    
  const totalPages \= Math.ceil((count || 0\) / pageSize)  
    
  return (  
    \<div className="space-y-4"\>  
      \<h1 className="text-2xl font-bold"\>Customers\</h1\>  
        
      \<CustomersTable customers={customers || \[\]} /\>  
        
      \<Pagination  
        currentPage={page}  
        totalPages={totalPages}  
        baseUrl="/dashboard/customers"  
      /\>  
    \</div\>  
  )  
}  
\`\`\`  
\`\`\`typescript  
// components/ui/Pagination.tsx  
import Link from 'next/link'  
import { Button } from '@/components/ui/button'

interface Props {  
  currentPage: number  
  totalPages: number  
  baseUrl: string  
}

export default function Pagination({ currentPage, totalPages, baseUrl }: Props) {  
  return (  
    \<div className="flex items-center justify-center gap-2"\>  
      \<Button  
        variant="outline"  
        disabled={currentPage \=== 1}  
        asChild={currentPage \> 1}  
      \>  
        {currentPage \> 1 ? (  
          \<Link href={\`${baseUrl}?page=${currentPage \- 1}\`}\>Anterior\</Link\>  
        ) : (  
          \<span\>Anterior\</span\>  
        )}  
      \</Button\>  
        
      \<span className="text-sm text-gray-600"\>  
        Página {currentPage} de {totalPages}  
      \</span\>  
        
      \<Button  
        variant="outline"  
        disabled={currentPage \=== totalPages}  
        asChild={currentPage \< totalPages}  
      \>  
        {currentPage \< totalPages ? (  
          \<Link href={\`${baseUrl}?page=${currentPage \+ 1}\`}\>Siguiente\</Link\>  
        ) : (  
          \<span\>Siguiente\</span\>  
        )}  
      \</Button\>  
    \</div\>  
  )  
}  
\`\`\`

\---

\#\# 🚨 Errores Comunes

\#\#\# Error 1: useEffect en Server Component  
\`\`\`typescript  
// ❌ MAL \- Server Component no puede usar useEffect  
export default async function Page() {  
  useEffect(() \=\> {  
    // ERROR: useEffect solo en Client Components  
  }, \[\])  
}

// ✅ BIEN \- Fetch directo en Server Component  
export default async function Page() {  
  const data \= await fetchData()  
  return \<Display data={data} /\>  
}  
\`\`\`

\#\#\# Error 2: Client Component innecesario  
\`\`\`typescript  
// ❌ MAL \- 'use client' sin razón  
'use client'

export default function Page() {  
  // No hay interactividad, no necesita ser cliente  
  return \<StaticContent /\>  
}

// ✅ BIEN \- Server Component por defecto  
export default async function Page() {  
  const data \= await fetchData()  
  return \<StaticContent data={data} /\>  
}  
\`\`\`

\#\#\# Error 3: No manejar loading/error  
\`\`\`typescript  
// ❌ MAL \- Sin loading ni error handling  
export default async function Page() {  
  const data \= await fetchData()  
  return \<Display data={data} /\>  
}

// ✅ BIEN \- Con loading.tsx y error.tsx  
// app/page.tsx  
export default async function Page() {  
  const data \= await fetchData()  
  if (\!data) throw new Error('No data')  
  return \<Display data={data} /\>  
}

// app/loading.tsx  
export default function Loading() {  
  return \<Skeleton /\>  
}

// app/error.tsx  
export default function Error({ error, reset }) {  
  return \<ErrorDisplay error={error} reset={reset} /\>  
}  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] Server Components por defecto  
\- \[ \] 'use client' solo cuando necesario  
\- \[ \] Parallel fetching con Promise.all  
\- \[ \] Loading states (loading.tsx o Suspense)  
\- \[ \] Error boundaries (error.tsx)  
\- \[ \] Cache strategy definida (revalidate)  
\- \[ \] Pagination implementada  
\- \[ \] Empty states manejados

\---

\#\# 💡 Para Pato

\#\#\# Decision Tree: Server vs Client Component  
\`\`\`  
¿Necesitás interactividad? (onClick, onChange, useState)  
├─ NO → Server Component (fetch con async/await)  
└─ SÍ → Client Component ('use client' \+ useEffect)

¿Necesitás realtime?  
├─ NO → Server Component  
└─ SÍ → Client Component (Supabase subscriptions)

¿Es solo presentación de data?  
├─ SÍ → Server Component  
└─ NO → Client Component  
\`\`\`

\#\#\# Testing  
\`\`\`bash  
\# Verificar que Server Component funciona  
\# 1\. Desactivar JS en DevTools  
\# 2\. Página debe cargar igual

\# Verificar cache  
\# 1\. Agregar console.log en fetch  
\# 2\. Recargar página  
\# 3\. Si no aparece log → está cacheado  
\`\`\`

\---  
