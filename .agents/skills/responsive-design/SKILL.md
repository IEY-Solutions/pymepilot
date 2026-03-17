\# Skill: Responsive Design

\#\# 🎯 Qué es  
Diseño responsive en PymePilot usando Tailwind CSS. Mobile-first approach, breakpoints, sidebar responsive, y componentes adaptables.

\*\*Analogía Simple:\*\*  
Responsive design es como un mueble transformable:  
\- Mobile \= configuración compacta (plegado)  
\- Tablet \= configuración media (semi-expandido)  
\- Desktop \= configuración completa (totalmente expandido)  
\- Se adapta al espacio disponible

En PymePilot:  
\- Dashboard en mobile \= cards apiladas  
\- Dashboard en desktop \= grid de 3 columnas  
\- Sidebar en mobile \= menú hamburguesa  
\- Sidebar en desktop \= siempre visible

\*\*Por qué es CRÍTICO:\*\*  
\- 40%+ del tráfico es mobile  
\- Google prioriza mobile-first  
\- Mejor UX \= más uso  
\- IEY puede usar en tablet en depósito

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al crear componentes nuevos  
\- ✅ Al diseñar layouts  
\- ✅ Al testear UI

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Breakpoints de Tailwind  
\`\`\`typescript  
// Tailwind breakpoints (mobile-first)  
// sm:  640px  (tablet pequeña)  
// md:  768px  (tablet)  
// lg:  1024px (desktop)  
// xl:  1280px (desktop grande)  
// 2xl: 1536px (desktop muy grande)

// Ejemplo:  
\<div className="  
  w-full           // Mobile: ancho completo  
  md:w-1/2         // Tablet: mitad del ancho  
  lg:w-1/3         // Desktop: tercio del ancho  
"\>  
\`\`\`

\#\#\# Práctica 2: Grid Responsive  
\`\`\`typescript  
// components/features/dashboard/DashboardKPIs.tsx  
export default function DashboardKPIs() {  
  return (  
    \<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"\>  
      {/\* Mobile: 1 columna  
          Tablet: 2 columnas    
          Desktop: 4 columnas \*/}  
      \<KPICard title="Customers" value="1,234" /\>  
      \<KPICard title="Predictions" value="567" /\>  
      \<KPICard title="Success Rate" value="85%" /\>  
      \<KPICard title="Active" value="892" /\>  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 3: Sidebar Responsive  
\`\`\`typescript  
// components/layout/Sidebar.tsx  
'use client'

import { useState } from 'react'  
import Link from 'next/link'  
import { usePathname } from 'next/navigation'  
import { Menu, X, Home, Users, Target, Settings } from 'lucide-react'  
import { Button } from '@/components/ui/button'

export default function Sidebar() {  
  const \[open, setOpen\] \= useState(false)  
  const pathname \= usePathname()  
    
  const links \= \[  
    { href: '/dashboard', label: 'Dashboard', icon: Home },  
    { href: '/dashboard/customers', label: 'Customers', icon: Users },  
    { href: '/dashboard/predictions', label: 'Predictions', icon: Target },  
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },  
  \]  
    
  return (  
    \<\>  
      {/\* Mobile: Hamburger button \*/}  
      \<button  
        onClick={() \=\> setOpen(\!open)}  
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"  
      \>  
        {open ? \<X className="w-6 h-6" /\> : \<Menu className="w-6 h-6" /\>}  
      \</button\>  
        
      {/\* Sidebar \*/}  
      \<aside  
        className={\`  
          fixed lg:static  
          inset-y-0 left-0  
          z-40  
          w-64  
          bg-white  
          border-r border-gray-200  
          transform transition-transform duration-200 ease-in-out  
          ${open ? 'translate-x-0' : '-translate-x-full'}  
          lg:translate-x-0  
        \`}  
      \>  
        \<div className="flex flex-col h-full"\>  
          {/\* Logo \*/}  
          \<div className="p-6 border-b"\>  
            \<h1 className="text-xl font-bold text-blue-600"\>PymePilot\</h1\>  
          \</div\>  
            
          {/\* Navigation \*/}  
          \<nav className="flex-1 p-4 space-y-1"\>  
            {links.map((link) \=\> (  
              \<Link  
                key={link.href}  
                href={link.href}  
                onClick={() \=\> setOpen(false)}  
                className={\`  
                  flex items-center gap-3 px-4 py-3 rounded-lg  
                  transition-colors  
                  ${  
                    pathname \=== link.href  
                      ? 'bg-blue-50 text-blue-600'  
                      : 'text-gray-700 hover:bg-gray-100'  
                  }  
                \`}  
              \>  
                \<link.icon className="w-5 h-5" /\>  
                \<span className="font-medium"\>{link.label}\</span\>  
              \</Link\>  
            ))}  
          \</nav\>  
        \</div\>  
      \</aside\>  
        
      {/\* Mobile: Overlay \*/}  
      {open && (  
        \<div  
          onClick={() \=\> setOpen(false)}  
          className="lg:hidden fixed inset-0 bg-black/20 z-30"  
        /\>  
      )}  
    \</\>  
  )  
}  
\`\`\`

\#\#\# Práctica 4: Table Responsive  
\`\`\`typescript  
// components/features/customers/CustomersTable.tsx  
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'  
import { Badge } from '@/components/ui/badge'

export default function CustomersTable({ customers }: { customers: any\[\] }) {  
  return (  
    \<div className="overflow-x-auto"\>  
      \<Table\>  
        \<TableHeader\>  
          \<TableRow\>  
            \<TableHead\>Nombre\</TableHead\>  
            \<TableHead className="hidden md:table-cell"\>Email\</TableHead\>  
            \<TableHead className="hidden lg:table-cell"\>Teléfono\</TableHead\>  
            \<TableHead\>Status\</TableHead\>  
          \</TableRow\>  
        \</TableHeader\>  
        \<TableBody\>  
          {customers.map((customer) \=\> (  
            \<TableRow key={customer.id}\>  
              \<TableCell className="font-medium"\>{customer.name}\</TableCell\>  
              \<TableCell className="hidden md:table-cell"\>{customer.email}\</TableCell\>  
              \<TableCell className="hidden lg:table-cell"\>{customer.phone || '-'}\</TableCell\>  
              \<TableCell\>  
                \<Badge variant={customer.status \=== 'active' ? 'default' : 'secondary'}\>  
                  {customer.status}  
                \</Badge\>  
              \</TableCell\>  
            \</TableRow\>  
          ))}  
        \</TableBody\>  
      \</Table\>  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 5: Cards Responsive  
\`\`\`typescript  
// components/features/dashboard/KPICard.tsx  
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {  
  title: string  
  value: string | number  
  icon?: React.ReactNode  
  trend?: number  
}

export default function KPICard({ title, value, icon, trend }: Props) {  
  return (  
    \<Card\>  
      \<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0"\>  
        \<CardTitle className="text-sm font-medium text-gray-600"\>  
          {title}  
        \</CardTitle\>  
        {icon && \<div className="text-gray-400"\>{icon}\</div\>}  
      \</CardHeader\>  
      \<CardContent\>  
        \<div className="text-2xl md:text-3xl font-bold"\>{value}\</div\>  
        {trend \!== undefined && (  
          \<p className={\`text-xs md:text-sm ${trend \>= 0 ? 'text-green-600' : 'text-red-600'}\`}\>  
            {trend \>= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs mes anterior  
          \</p\>  
        )}  
      \</CardContent\>  
    \</Card\>  
  )  
}  
\`\`\`

\#\#\# Práctica 6: Forms Responsive  
\`\`\`typescript  
// components/features/customers/CustomerForm.tsx  
import { Input } from '@/components/ui/input'  
import { Label } from '@/components/ui/label'  
import { Button } from '@/components/ui/button'

export default function CustomerForm() {  
  return (  
    \<form className="space-y-4"\>  
      {/\* Grid responsive para campos \*/}  
      \<div className="grid grid-cols-1 md:grid-cols-2 gap-4"\>  
        \<div\>  
          \<Label htmlFor="name"\>Nombre \*\</Label\>  
          \<Input id="name" name="name" required /\>  
        \</div\>  
          
        \<div\>  
          \<Label htmlFor="email"\>Email \*\</Label\>  
          \<Input id="email" name="email" type="email" required /\>  
        \</div\>  
      \</div\>  
        
      \<div\>  
        \<Label htmlFor="phone"\>Teléfono\</Label\>  
        \<Input id="phone" name="phone" type="tel" /\>  
      \</div\>  
        
      {/\* Botones stacked en mobile, inline en desktop \*/}  
      \<div className="flex flex-col md:flex-row gap-2 md:justify-end"\>  
        \<Button type="button" variant="outline" className="w-full md:w-auto"\>  
          Cancelar  
        \</Button\>  
        \<Button type="submit" className="w-full md:w-auto"\>  
          Guardar  
        \</Button\>  
      \</div\>  
    \</form\>  
  )  
}  
\`\`\`

\#\#\# Práctica 7: Modal/Dialog Responsive  
\`\`\`typescript  
// components/features/predictions/PredictionDialog.tsx  
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function PredictionDialog({   
  open,   
  onOpenChange,   
  prediction   
}: {   
  open: boolean  
  onOpenChange: (open: boolean) \=\> void  
  prediction: any   
}) {  
  return (  
    \<Dialog open={open} onOpenChange={onOpenChange}\>  
      \<DialogContent className="  
        max-w-\[95vw\] md:max-w-2xl   
        max-h-\[90vh\]   
        overflow-y-auto  
      "\>  
        \<DialogHeader\>  
          \<DialogTitle\>Prediction Details\</DialogTitle\>  
        \</DialogHeader\>  
          
        \<div className="space-y-4"\>  
          \<div className="grid grid-cols-1 md:grid-cols-2 gap-4"\>  
            \<div\>  
              \<p className="text-sm text-gray-600"\>Customer\</p\>  
              \<p className="font-medium"\>{prediction.customer?.name}\</p\>  
            \</div\>  
              
            \<div\>  
              \<p className="text-sm text-gray-600"\>Vertical\</p\>  
              \<p className="font-medium"\>{prediction.vertical}\</p\>  
            \</div\>  
          \</div\>  
            
          \<div\>  
            \<p className="text-sm text-gray-600"\>Mensaje\</p\>  
            \<p className="mt-1 p-3 bg-gray-50 rounded"\>  
              {prediction.message\_text}  
            \</p\>  
          \</div\>  
        \</div\>  
      \</DialogContent\>  
    \</Dialog\>  
  )  
}  
\`\`\`

\#\#\# Práctica 8: Header Responsive  
\`\`\`typescript  
// components/layout/Header.tsx  
import { User } from '@supabase/supabase-js'  
import { LogOut, Menu } from 'lucide-react'  
import { Button } from '@/components/ui/button'

export default function Header({ user }: { user: User }) {  
  return (  
    \<header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4"\>  
      \<div className="flex items-center justify-between"\>  
        {/\* Mobile: Solo nombre \*/}  
        \<div className="flex-1"\>  
          \<h2 className="text-base md:text-lg font-semibold"\>  
            Hola, {user.user\_metadata?.full\_name || user.email}  
          \</h2\>  
          \<p className="text-xs md:text-sm text-gray-600 hidden sm:block"\>  
            {user.user\_metadata?.tenant\_name}  
          \</p\>  
        \</div\>  
          
        {/\* Logout button \*/}  
        \<form action="/api/auth/signout" method="post"\>  
          \<Button variant="ghost" size="sm" type="submit"\>  
            \<LogOut className="w-4 h-4 md:mr-2" /\>  
            \<span className="hidden md:inline"\>Salir\</span\>  
          \</Button\>  
        \</form\>  
      \</div\>  
    \</header\>  
  )  
}  
\`\`\`

\#\#\# Práctica 9: Dashboard Layout Responsive  
\`\`\`typescript  
// app/(dashboard)/layout.tsx  
import Sidebar from '@/components/layout/Sidebar'  
import Header from '@/components/layout/Header'

export default async function DashboardLayout({ children }) {  
  // ... auth check  
    
  return (  
    \<div className="flex h-screen bg-gray-50"\>  
      \<Sidebar /\>  
        
      \<div className="flex-1 flex flex-col overflow-hidden"\>  
        \<Header user={session.user} /\>  
          
        \<main className="flex-1 overflow-y-auto p-4 md:p-6"\>  
          {/\* Padding diferente en mobile vs desktop \*/}  
          {children}  
        \</main\>  
      \</div\>  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 10: Utility Classes Útiles  
\`\`\`typescript  
// Spacing responsive  
\<div className="p-4 md:p-6 lg:p-8"\>

// Font size responsive  
\<h1 className="text-xl md:text-2xl lg:text-3xl"\>

// Gap responsive  
\<div className="flex gap-2 md:gap-4 lg:gap-6"\>

// Hidden/visible según breakpoint  
\<div className="hidden md:block"\>Desktop only\</div\>  
\<div className="block md:hidden"\>Mobile only\</div\>

// Flex direction responsive  
\<div className="flex flex-col md:flex-row"\>

// Max width responsive  
\<div className="max-w-full md:max-w-2xl lg:max-w-4xl"\>  
\`\`\`

\---

\#\# 💻 Ejemplos Completos

\#\#\# Dashboard Completo Responsive  
\`\`\`typescript  
// app/(dashboard)/page.tsx  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'  
import KPICard from '@/components/features/dashboard/KPICard'  
import RecentPredictions from '@/components/features/dashboard/RecentPredictions'  
import { Users, Target, TrendingUp, CheckCircle } from 'lucide-react'

export default async function DashboardPage() {  
  const supabase \= createServerComponentClient({ cookies })  
    
  // ... fetch data  
    
  return (  
    \<div className="space-y-4 md:space-y-6"\>  
      {/\* Title \*/}  
      \<h1 className="text-2xl md:text-3xl font-bold"\>Dashboard\</h1\>  
        
      {/\* KPIs Grid \*/}  
      \<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"\>  
        \<KPICard  
          title="Total Customers"  
          value="1,234"  
          icon={\<Users className="w-5 h-5" /\>}  
          trend={12}  
        /\>  
        \<KPICard  
          title="Predictions"  
          value="567"  
          icon={\<Target className="w-5 h-5" /\>}  
          trend={-5}  
        /\>  
        \<KPICard  
          title="Success Rate"  
          value="85%"  
          icon={\<TrendingUp className="w-5 h-5" /\>}  
          trend={3}  
        /\>  
        \<KPICard  
          title="Sent Today"  
          value="42"  
          icon={\<CheckCircle className="w-5 h-5" /\>}  
        /\>  
      \</div\>  
        
      {/\* Recent Predictions \*/}  
      \<div\>  
        \<h2 className="text-lg md:text-xl font-bold mb-4"\>  
          Predictions Recientes  
        \</h2\>  
        \<RecentPredictions predictions={recentPredictions} /\>  
      \</div\>  
    \</div\>  
  )  
}  
\`\`\`

\---

\#\# 🚨 Errores Comunes

\#\#\# Error 1: No mobile-first  
\`\`\`typescript  
// ❌ MAL \- Desktop first  
\<div className="w-1/3 sm:w-full"\>  
// Mobile hereda w-1/3 (mal)

// ✅ BIEN \- Mobile first  
\<div className="w-full sm:w-1/3"\>  
// Mobile: w-full, luego sm: w-1/3  
\`\`\`

\#\#\# Error 2: Olvidar overflow en tablas  
\`\`\`typescript  
// ❌ MAL \- Tabla se sale en mobile  
\<Table\>...\</Table\>

// ✅ BIEN \- Con overflow-x  
\<div className="overflow-x-auto"\>  
  \<Table\>...\</Table\>  
\</div\>  
\`\`\`

\#\#\# Error 3: Fixed widths  
\`\`\`typescript  
// ❌ MAL \- Width fijo  
\<div className="w-\[500px\]"\>  
// Se sale en mobile

// ✅ BIEN \- Width responsive  
\<div className="w-full max-w-2xl"\>  
\`\`\`

\#\#\# Error 4: Texto muy grande en mobile  
\`\`\`typescript  
// ❌ MAL \- Mismo tamaño siempre  
\<h1 className="text-4xl"\>

// ✅ BIEN \- Responsive  
\<h1 className="text-2xl md:text-3xl lg:text-4xl"\>  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] Mobile-first approach  
\- \[ \] Sidebar responsive (hamburger en mobile)  
\- \[ \] Tables con overflow-x  
\- \[ \] Grid responsive (1 col mobile, múltiples desktop)  
\- \[ \] Forms stacked en mobile, grid en desktop  
\- \[ \] Botones full-width en mobile  
\- \[ \] Spacing responsive (p-4 md:p-6)  
\- \[ \] Font sizes responsive  
\- \[ \] Tested en 320px, 768px, 1024px

\---

\#\# 💡 Para Pato

\#\#\# Testing Responsive  
\`\`\`bash  
\# Chrome DevTools  
\# 1\. F12 → Toggle device toolbar (Ctrl+Shift+M)  
\# 2\. Probar en:  
\#    \- iPhone SE (375px)  
\#    \- iPad (768px)  
\#    \- Desktop (1024px+)

\# O usar responsive mode y arrastrar para ver breakpoints  
\`\`\`

\#\#\# Breakpoints comunes  
\`\`\`  
Mobile:  \< 640px   (sm)  
Tablet:  640-1024px (sm-lg)  
Desktop: \> 1024px  (lg+)  
\`\`\`

\#\#\# Template responsive  
\`\`\`typescript  
\<div className="  
  p-4 md:p-6                    // Padding  
  max-w-full md:max-w-4xl       // Max width  
  grid grid-cols-1 md:grid-cols-2  // Grid  
  gap-4 md:gap-6                // Gap  
  text-sm md:text-base          // Font size  
"\>  
\`\`\`

\---  
