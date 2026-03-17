**\# Skill: Next.js App Router**

**\#\# 🎯 Qué es**  
**Estructura completa de Next.js 14+ App Router para PymePilot. Layouts anidados, route groups, loading states, error boundaries, y metadata.**

**\*\*Analogía Simple:\*\***  
**App Router es como el plano arquitectónico de un edificio:**  
**\- Layouts \= estructura de pisos y pasillos**  
**\- Pages \= habitaciones individuales**  
**\- Loading \= carteles "en construcción"**  
**\- Errors \= salidas de emergencia**

**En PymePilot:**  
**\- Dashboard layout con sidebar permanente**  
**\- Auth layout sin sidebar**  
**\- Loading states en cada sección**  
**\- Error boundaries para failures**

**\*\*Por qué es CRÍTICO:\*\***  
**\- Estructura clara \= fácil mantener**  
**\- Layouts compartidos \= menos código duplicado**  
**\- Loading/error states \= mejor UX**  
**\- SEO optimizado con metadata**

**\#\# 📋 Cuándo usar este skill**

**\#\#\# Usar SIEMPRE:**  
**\- ✅ Al crear proyecto Next.js nuevo**  
**\- ✅ Al agregar rutas nuevas**  
**\- ✅ Al modificar layouts**

**\#\#\# Usar ESPECIALMENTE cuando:**  
**\- ⚠️ Necesitás layouts diferentes (auth vs dashboard)**  
**\- ⚠️ Querés loading states específicos por ruta**  
**\- ⚠️ Necesitás error handling granular**

**\#\# 🛠️ Mejores Prácticas**

**\#\#\# Práctica 1: Estructura Base**  
**\`\`\`**  
**app/**  
**├─ layout.tsx                    \# Root layout (global)**  
**├─ page.tsx                      \# Homepage (redirect a /dashboard)**  
**├─ globals.css                   \# Tailwind \+ custom CSS**  
**│**  
**├─ (auth)/                       \# Route group (sin afectar URL)**  
**│  ├─ layout.tsx                 \# Layout de auth (sin sidebar)**  
**│  ├─ login/**  
**│  │  └─ page.tsx**  
**│  └─ signup/**  
**│     └─ page.tsx**  
**│**  
**├─ (dashboard)/                  \# Route group (dashboard con sidebar)**  
**│  ├─ layout.tsx                 \# Layout con Sidebar \+ Header**  
**│  ├─ loading.tsx                \# Loading global del dashboard**  
**│  ├─ error.tsx                  \# Error boundary**  
**│  │**  
**│  ├─ page.tsx                   \# /dashboard (KPIs)**  
**│  │**  
**│  ├─ customers/**  
**│  │  ├─ page.tsx                \# /dashboard/customers**  
**│  │  ├─ loading.tsx**  
**│  │  ├─ new/**  
**│  │  │  └─ page.tsx             \# /dashboard/customers/new**  
**│  │  └─ \[id\]/**  
**│  │     └─ page.tsx             \# /dashboard/customers/\[id\]**  
**│  │**  
**│  ├─ predictions/**  
**│  │  ├─ page.tsx                \# /dashboard/predictions**  
**│  │  ├─ loading.tsx**  
**│  │  └─ \[id\]/**  
**│  │     └─ page.tsx             \# /dashboard/predictions/\[id\]**  
**│  │**  
**│  └─ settings/**  
**│     └─ page.tsx                \# /dashboard/settings**  
**│**  
**└─ api/                          \# API Routes (si necesario)**  
   **└─ webhooks/**  
      **└─ route.ts**  
**\`\`\`**

**\#\#\# Práctica 2: Root Layout**  
**\`\`\`typescript**  
**// app/layout.tsx**  
**import { Inter } from 'next/font/google'**  
**import './globals.css'**

**const inter \= Inter({ subsets: \['latin'\] })**

**export const metadata \= {**  
  **title: 'PymePilot \- BI para Distribuidores',**  
  **description: 'Sistema de inteligencia de negocios para distribuidores B2B',**  
**}**

**export default function RootLayout({**  
  **children,**  
**}: {**  
  **children: React.ReactNode**  
**}) {**  
  **return (**  
    **\<html lang="es" className={inter.className}\>**  
      **\<body\>{children}\</body\>**  
    **\</html\>**  
  **)**  
**}**  
**\`\`\`**

**\#\#\# Práctica 3: Dashboard Layout (con Sidebar)**  
**\`\`\`typescript**  
**// app/(dashboard)/layout.tsx**  
**import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'**  
**import { cookies } from 'next/headers'**  
**import { redirect } from 'next/navigation'**  
**import Sidebar from '@/components/layout/Sidebar'**  
**import Header from '@/components/layout/Header'**

**export default async function DashboardLayout({**  
  **children,**  
**}: {**  
  **children: React.ReactNode**  
**}) {**  
  **const supabase \= createServerComponentClient({ cookies })**  
    
  **const { data: { session } } \= await supabase.auth.getSession()**  
    
  **if (\!session) {**  
    **redirect('/login')**  
  **}**  
    
  **return (**  
    **\<div className="flex h-screen bg-gray-50"\>**  
      **\<Sidebar /\>**  
      **\<div className="flex-1 flex flex-col overflow-hidden"\>**  
        **\<Header user={session.user} /\>**  
        **\<main className="flex-1 overflow-y-auto p-6"\>**  
          **{children}**  
        **\</main\>**  
      **\</div\>**  
    **\</div\>**  
  **)**  
**}**  
**\`\`\`**

**\#\#\# Práctica 4: Auth Layout (sin Sidebar)**  
**\`\`\`typescript**  
**// app/(auth)/layout.tsx**  
**import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'**  
**import { cookies } from 'next/headers'**  
**import { redirect } from 'next/navigation'**

**export default async function AuthLayout({**  
  **children,**  
**}: {**  
  **children: React.ReactNode**  
**}) {**  
  **const supabase \= createServerComponentClient({ cookies })**  
    
  **const { data: { session } } \= await supabase.auth.getSession()**  
    
  **// Si ya está autenticado, redirect a dashboard**  
  **if (session) {**  
    **redirect('/dashboard')**  
  **}**  
    
  **return (**  
    **\<div className="min-h-screen flex items-center justify-center bg-gray-50"\>**  
      **\<div className="max-w-md w-full"\>**  
        **{children}**  
      **\</div\>**  
    **\</div\>**  
  **)**  
**}**  
**\`\`\`**

**\#\#\# Práctica 5: Loading State**  
**\`\`\`typescript**  
**// app/(dashboard)/loading.tsx**  
**export default function Loading() {**  
  **return (**  
    **\<div className="flex items-center justify-center h-full"\>**  
      **\<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"\>\</div\>**  
    **\</div\>**  
  **)**  
**}**

**// Loading más elaborado con skeleton**  
**export default function Loading() {**  
  **return (**  
    **\<div className="space-y-4"\>**  
      **\<div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"\>\</div\>**  
      **\<div className="grid grid-cols-3 gap-4"\>**  
        **{\[1, 2, 3\].map(i \=\> (**  
          **\<div key={i} className="h-32 bg-gray-200 rounded animate-pulse"\>\</div\>**  
        **))}**  
      **\</div\>**  
    **\</div\>**  
  **)**  
**}**  
**\`\`\`**

**\#\#\# Práctica 6: Error Boundary**  
**\`\`\`typescript**  
**// app/(dashboard)/error.tsx**  
**'use client'**

**export default function Error({**  
  **error,**  
  **reset,**  
**}: {**  
  **error: Error & { digest?: string }**  
  **reset: () \=\> void**  
**}) {**  
  **return (**  
    **\<div className="flex flex-col items-center justify-center h-full"\>**  
      **\<h2 className="text-2xl font-bold mb-4"\>Algo salió mal\</h2\>**  
      **\<p className="text-gray-600 mb-6"\>{error.message}\</p\>**  
      **\<button**  
        **onClick={reset}**  
        **className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"**  
      **\>**  
        **Reintentar**  
      **\</button\>**  
    **\</div\>**  
  **)**  
**}**  
**\`\`\`**

**\#\#\# Práctica 7: Homepage (Redirect)**  
**\`\`\`typescript**  
**// app/page.tsx**  
**import { redirect } from 'next/navigation'**

**export default function HomePage() {**  
  **redirect('/dashboard')**  
**}**  
**\`\`\`**

**\#\#\# Práctica 8: Dashboard Page (KPIs)**  
**\`\`\`typescript**  
**// app/(dashboard)/page.tsx**  
**import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'**  
**import { cookies } from 'next/headers'**  
**import KPICard from '@/components/features/dashboard/KPICard'**

**export default async function DashboardPage() {**  
  **const supabase \= createServerComponentClient({ cookies })**  
    
  **const { data: { user } } \= await supabase.auth.getUser()**  
  **const tenantId \= user?.user\_metadata?.tenant\_id**  
    
  **// Setear tenant context**  
  **await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })**  
    
  **// Fetch KPIs**  
  **const \[**  
    **{ count: customersCount },**  
    **{ count: predictionsCount },**  
  **\] \= await Promise.all(\[**  
    **supabase.from('customers').select('\*', { count: 'exact', head: true }),**  
    **supabase.from('predictions').select('\*', { count: 'exact', head: true }),**  
  **\])**  
    
  **return (**  
    **\<div\>**  
      **\<h1 className="text-2xl font-bold mb-6"\>Dashboard\</h1\>**  
        
      **\<div className="grid grid-cols-1 md:grid-cols-3 gap-4"\>**  
        **\<KPICard**  
          **title="Customers"**  
          **value={customersCount || 0}**  
          **icon="👥"**  
        **/\>**  
        **\<KPICard**  
          **title="Predictions"**  
          **value={predictionsCount || 0}**  
          **icon="🎯"**  
        **/\>**  
        **\<KPICard**  
          **title="Success Rate"**  
          **value="85%"**  
          **icon="✅"**  
        **/\>**  
      **\</div\>**  
    **\</div\>**  
  **)**  
**}**  
**\`\`\`**

**\#\#\# Práctica 9: Dynamic Route**  
**\`\`\`typescript**  
**// app/(dashboard)/customers/\[id\]/page.tsx**  
**import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'**  
**import { cookies } from 'next/headers'**  
**import { notFound } from 'next/navigation'**

**export default async function CustomerDetailPage({**  
  **params,**  
**}: {**  
  **params: { id: string }**  
**}) {**  
  **const supabase \= createServerComponentClient({ cookies })**  
    
  **const { data: { user } } \= await supabase.auth.getUser()**  
  **const tenantId \= user?.user\_metadata?.tenant\_id**  
    
  **await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })**  
    
  **const { data: customer, error } \= await supabase**  
    **.from('customers')**  
    **.select('\*')**  
    **.eq('id', params.id)**  
    **.single()**  
    
  **if (error || \!customer) {**  
    **notFound()**  
  **}**  
    
  **return (**  
    **\<div\>**  
      **\<h1 className="text-2xl font-bold mb-6"\>{customer.name}\</h1\>**  
      **\<div className="bg-white p-6 rounded shadow"\>**  
        **\<p\>\<strong\>Email:\</strong\> {customer.email}\</p\>**  
        **\<p\>\<strong\>Phone:\</strong\> {customer.phone}\</p\>**  
        **\<p\>\<strong\>Status:\</strong\> {customer.status}\</p\>**  
      **\</div\>**  
    **\</div\>**  
  **)**  
**}**  
**\`\`\`**

**\#\#\# Práctica 10: Not Found Page**  
**\`\`\`typescript**  
**// app/(dashboard)/customers/\[id\]/not-found.tsx**  
**export default function NotFound() {**  
  **return (**  
    **\<div className="flex flex-col items-center justify-center h-full"\>**  
      **\<h2 className="text-2xl font-bold mb-4"\>Customer no encontrado\</h2\>**  
      **\<p className="text-gray-600"\>El customer que buscás no existe.\</p\>**  
    **\</div\>**  
  **)**  
**}**  
**\`\`\`**

**\---**

**\#\# 💻 Componentes Base**

**\#\#\# Sidebar Component**  
**\`\`\`typescript**  
**// components/layout/Sidebar.tsx**  
**import Link from 'next/link'**  
**import { Home, Users, Target, Settings } from 'lucide-react'**

**export default function Sidebar() {**  
  **return (**  
    **\<aside className="w-64 bg-white border-r border-gray-200 flex flex-col"\>**  
      **\<div className="p-6"\>**  
        **\<h1 className="text-xl font-bold text-blue-600"\>PymePilot\</h1\>**  
      **\</div\>**  
        
      **\<nav className="flex-1 px-4 space-y-2"\>**  
        **\<SidebarLink href="/dashboard" icon={Home}\>**  
          **Dashboard**  
        **\</SidebarLink\>**  
        **\<SidebarLink href="/dashboard/customers" icon={Users}\>**  
          **Customers**  
        **\</SidebarLink\>**  
        **\<SidebarLink href="/dashboard/predictions" icon={Target}\>**  
          **Predictions**  
        **\</SidebarLink\>**  
        **\<SidebarLink href="/dashboard/settings" icon={Settings}\>**  
          **Settings**  
        **\</SidebarLink\>**  
      **\</nav\>**  
    **\</aside\>**  
  **)**  
**}**

**function SidebarLink({**  
  **href,**  
  **icon: Icon,**  
  **children,**  
**}: {**  
  **href: string**  
  **icon: any**  
  **children: React.ReactNode**  
**}) {**  
  **return (**  
    **\<Link**  
      **href={href}**  
      **className="flex items-center gap-3 px-4 py-2 text-gray-700 rounded hover:bg-gray-100"**  
    **\>**  
      **\<Icon className="w-5 h-5" /\>**  
      **\<span\>{children}\</span\>**  
    **\</Link\>**  
  **)**  
**}**  
**\`\`\`**

**\#\#\# Header Component**  
**\`\`\`typescript**  
**// components/layout/Header.tsx**  
**import { User } from '@supabase/supabase-js'**  
**import { LogOut } from 'lucide-react'**

**export default function Header({ user }: { user: User }) {**  
  **return (**  
    **\<header className="bg-white border-b border-gray-200 px-6 py-4"\>**  
      **\<div className="flex items-center justify-between"\>**  
        **\<div\>**  
          **\<h2 className="text-lg font-semibold"\>**  
            **Hola, {user.user\_metadata?.full\_name || user.email}**  
          **\</h2\>**  
          **\<p className="text-sm text-gray-600"\>**  
            **{user.user\_metadata?.tenant\_name}**  
          **\</p\>**  
        **\</div\>**  
          
        **\<form action="/api/auth/signout" method="post"\>**  
          **\<button**  
            **type="submit"**  
            **className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"**  
          **\>**  
            **\<LogOut className="w-4 h-4" /\>**  
            **Salir**  
          **\</button\>**  
        **\</form\>**  
      **\</div\>**  
    **\</header\>**  
  **)**  
**}**  
**\`\`\`**

**\---**

**\#\# 🚨 Errores Comunes**

**\#\#\# Error 1: No usar route groups**  
**\`\`\`typescript**  
**// ❌ MAL \- Todo en raíz**  
**app/**  
**├─ dashboard/**  
**│  └─ layout.tsx  \# Layout con sidebar**  
**├─ login/**  
**│  └─ page.tsx    \# Hereda sidebar (mal\!)**

**// ✅ BIEN \- Route groups**  
**app/**  
**├─ (dashboard)/**  
**│  └─ layout.tsx  \# Layout con sidebar**  
**├─ (auth)/**  
**│  ├─ layout.tsx  \# Layout sin sidebar**  
**│  └─ login/**  
**\`\`\`**

**\#\#\# Error 2: No usar loading.tsx**  
**\`\`\`typescript**  
**// ❌ MAL \- Sin loading state**  
**// Usuario ve pantalla blanca mientras carga**

**// ✅ BIEN \- Con loading.tsx**  
**app/(dashboard)/predictions/loading.tsx**  
**// Usuario ve spinner/skeleton**  
**\`\`\`**

**\#\#\# Error 3: No usar error.tsx**  
**\`\`\`typescript**  
**// ❌ MAL \- Sin error boundary**  
**// Error crashea toda la app**

**// ✅ BIEN \- Con error.tsx**  
**app/(dashboard)/error.tsx**  
**// Error contenido, con opción de retry**  
**\`\`\`**

**\---**

**\#\# ✅ Checklist**

**\- \[ \] Route groups configurados (auth, dashboard)**  
**\- \[ \] Root layout con metadata**  
**\- \[ \] Dashboard layout con auth check**  
**\- \[ \] Sidebar component creado**  
**\- \[ \] Header component creado**  
**\- \[ \] Loading states en rutas principales**  
**\- \[ \] Error boundaries configurados**  
**\- \[ \] Homepage redirect a dashboard**  
**\- \[ \] Not found pages personalizadas**

**\---**

**\#\# 💡 Para Pato**

**\#\#\# Comandos para crear estructura**  
**\`\`\`bash**  
**cd /home/pato/pymepilot-core**

**\# Crear estructura de carpetas**  
**mkdir \-p app/\\(auth\\)/login**  
**mkdir \-p app/\\(auth\\)/signup**  
**mkdir \-p app/\\(dashboard\\)/customers/new**  
**mkdir \-p app/\\(dashboard\\)/customers/\\\[id\\\]**  
**mkdir \-p app/\\(dashboard\\)/predictions/\\\[id\\\]**  
**mkdir \-p app/\\(dashboard\\)/settings**  
**mkdir \-p components/layout**  
**mkdir \-p components/features/dashboard**  
**mkdir \-p components/features/customers**  
**mkdir \-p components/features/predictions**

**\# Crear archivos base**  
**touch app/layout.tsx**  
**touch app/page.tsx**  
**touch app/\\(auth\\)/layout.tsx**  
**touch app/\\(dashboard\\)/layout.tsx**  
**touch app/\\(dashboard\\)/loading.tsx**  
**touch app/\\(dashboard\\)/error.tsx**  
**touch components/layout/Sidebar.tsx**  
**touch components/layout/Header.tsx**  
**\`\`\`**

**\#\#\# Testing de rutas**  
**\`\`\`bash**  
**\# Desarrollo**  
**npm run dev**

**\# Verificar rutas:**  
**\# http://localhost:3000 → redirect a /dashboard**  
**\# http://localhost:3000/login → layout sin sidebar**  
**\# http://localhost:3000/dashboard → layout con sidebar**  
**\# http://localhost:3000/dashboard/customers → lista de customers**  
**\`\`\`**

**\---**  
