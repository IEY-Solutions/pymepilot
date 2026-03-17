\# Skill: shadcn/ui Setup

\#\# 🎯 Qué es  
Configuración completa de shadcn/ui en PymePilot. Librería de componentes UI para Next.js con Tailwind CSS, accesibles, customizables, y copiables (no npm package).

\*\*Analogía Simple:\*\*  
shadcn/ui es como un catálogo de muebles IKEA para tu app:  
\- Componentes pre-diseñados (Button, Card, Table)  
\- Los copiás a tu proyecto (no dependencia externa)  
\- Los customizás como querés  
\- Todo con Tailwind CSS

En PymePilot:  
\- Buttons para todas las acciones  
\- Cards para KPIs y contenido  
\- Tables para listados de customers/predictions  
\- Forms con validación integrada  
\- Dialogs para confirmaciones

\*\*Por qué es ÚTIL:\*\*  
\- Ahorra tiempo (no diseñar desde cero)  
\- Accesibilidad built-in (a11y)  
\- Customizable 100%  
\- No dependencia (código es tuyo)  
\- TypeScript friendly

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al configurar proyecto Next.js nuevo  
\- ✅ Al necesitar componentes UI nuevos  
\- ✅ Al diseñar interfaces

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Instalación Inicial  
\`\`\`bash  
\# 1\. Instalar shadcn/ui CLI  
npx shadcn-ui@latest init

\# Responder configuración:  
✔ Would you like to use TypeScript? … yes  
✔ Which style would you like to use? › Default  
✔ Which color would you like to use as base color? › Slate  
✔ Where is your global CSS file? … app/globals.css  
✔ Would you like to use CSS variables for colors? … yes  
✔ Are you using a custom tailwind prefix? … no  
✔ Where is your tailwind.config.js located? … tailwind.config.ts  
✔ Configure the import alias for components: … @/components  
✔ Configure the import alias for utils: … @/lib/utils  
✔ Are you using React Server Components? … yes  
\`\`\`

\*\*Esto crea:\*\*  
\`\`\`  
components/  
└─ ui/            \# Carpeta para componentes shadcn

lib/  
└─ utils.ts       \# Función cn() para merge de clases

components.json   \# Config de shadcn  
\`\`\`

\#\#\# Práctica 2: Instalar Componentes Básicos  
\`\`\`bash  
\# Componentes esenciales para PymePilot  
npx shadcn-ui@latest add button  
npx shadcn-ui@latest add card  
npx shadcn-ui@latest add table  
npx shadcn-ui@latest add form  
npx shadcn-ui@latest add input  
npx shadcn-ui@latest add label  
npx shadcn-ui@latest add select  
npx shadcn-ui@latest add dialog  
npx shadcn-ui@latest add badge  
npx shadcn-ui@latest add skeleton  
npx shadcn-ui@latest add dropdown-menu  
npx shadcn-ui@latest add alert  
npx shadcn-ui@latest add toast  
\`\`\`

\*\*Estructura después:\*\*  
\`\`\`  
components/ui/  
├─ button.tsx  
├─ card.tsx  
├─ table.tsx  
├─ form.tsx  
├─ input.tsx  
├─ label.tsx  
├─ select.tsx  
├─ dialog.tsx  
├─ badge.tsx  
├─ skeleton.tsx  
├─ dropdown-menu.tsx  
├─ alert.tsx  
└─ toast.tsx  
\`\`\`

\#\#\# Práctica 3: Uso Básico de Componentes

\*\*Button:\*\*  
\`\`\`typescript  
import { Button } from '@/components/ui/button'

export default function Example() {  
  return (  
    \<div className="space-x-2"\>  
      \<Button\>Default\</Button\>  
      \<Button variant="destructive"\>Delete\</Button\>  
      \<Button variant="outline"\>Cancel\</Button\>  
      \<Button variant="ghost"\>Ghost\</Button\>  
      \<Button size="sm"\>Small\</Button\>  
      \<Button size="lg"\>Large\</Button\>  
    \</div\>  
  )  
}  
\`\`\`

\*\*Card:\*\*  
\`\`\`typescript  
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'  
import { Button } from '@/components/ui/button'

export default function KPICard() {  
  return (  
    \<Card\>  
      \<CardHeader\>  
        \<CardTitle\>Total Customers\</CardTitle\>  
      \</CardHeader\>  
      \<CardContent\>  
        \<p className="text-4xl font-bold"\>1,234\</p\>  
        \<p className="text-sm text-gray-600"\>+12% desde el mes pasado\</p\>  
      \</CardContent\>  
      \<CardFooter\>  
        \<Button variant="outline" size="sm"\>Ver detalles\</Button\>  
      \</CardFooter\>  
    \</Card\>  
  )  
}  
\`\`\`

\*\*Table:\*\*  
\`\`\`typescript  
import {  
  Table,  
  TableBody,  
  TableCell,  
  TableHead,  
  TableHeader,  
  TableRow,  
} from '@/components/ui/table'  
import { Badge } from '@/components/ui/badge'

export default function CustomersTable({ customers }: { customers: any\[\] }) {  
  return (  
    \<Table\>  
      \<TableHeader\>  
        \<TableRow\>  
          \<TableHead\>Nombre\</TableHead\>  
          \<TableHead\>Email\</TableHead\>  
          \<TableHead\>Status\</TableHead\>  
        \</TableRow\>  
      \</TableHeader\>  
      \<TableBody\>  
        {customers.map((customer) \=\> (  
          \<TableRow key={customer.id}\>  
            \<TableCell className="font-medium"\>{customer.name}\</TableCell\>  
            \<TableCell\>{customer.email}\</TableCell\>  
            \<TableCell\>  
              \<Badge variant={customer.status \=== 'active' ? 'default' : 'secondary'}\>  
                {customer.status}  
              \</Badge\>  
            \</TableCell\>  
          \</TableRow\>  
        ))}  
      \</TableBody\>  
    \</Table\>  
  )  
}  
\`\`\`

\*\*Form con Validación:\*\*  
\`\`\`typescript  
'use client'

import { zodResolver } from '@hookform/resolvers/zod'  
import { useForm } from 'react-hook-form'  
import \* as z from 'zod'  
import { Button } from '@/components/ui/button'  
import {  
  Form,  
  FormControl,  
  FormField,  
  FormItem,  
  FormLabel,  
  FormMessage,  
} from '@/components/ui/form'  
import { Input } from '@/components/ui/input'

const formSchema \= z.object({  
  name: z.string().min(1, 'Nombre requerido'),  
  email: z.string().email('Email inválido'),  
})

export default function CustomerFormWithValidation() {  
  const form \= useForm\<z.infer\<typeof formSchema\>\>({  
    resolver: zodResolver(formSchema),  
    defaultValues: {  
      name: '',  
      email: '',  
    },  
  })

  function onSubmit(values: z.infer\<typeof formSchema\>) {  
    console.log(values)  
  }

  return (  
    \<Form {...form}\>  
      \<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4"\>  
        \<FormField  
          control={form.control}  
          name="name"  
          render={({ field }) \=\> (  
            \<FormItem\>  
              \<FormLabel\>Nombre\</FormLabel\>  
              \<FormControl\>  
                \<Input {...field} /\>  
              \</FormControl\>  
              \<FormMessage /\>  
            \</FormItem\>  
          )}  
        /\>  
          
        \<FormField  
          control={form.control}  
          name="email"  
          render={({ field }) \=\> (  
            \<FormItem\>  
              \<FormLabel\>Email\</FormLabel\>  
              \<FormControl\>  
                \<Input type="email" {...field} /\>  
              \</FormControl\>  
              \<FormMessage /\>  
            \</FormItem\>  
          )}  
        /\>  
          
        \<Button type="submit"\>Submit\</Button\>  
      \</form\>  
    \</Form\>  
  )  
}  
\`\`\`

\*\*Dialog:\*\*  
\`\`\`typescript  
'use client'

import { useState } from 'react'  
import {  
  Dialog,  
  DialogContent,  
  DialogDescription,  
  DialogHeader,  
  DialogTitle,  
  DialogTrigger,  
} from '@/components/ui/dialog'  
import { Button } from '@/components/ui/button'

export default function DeleteDialog({ onConfirm }: { onConfirm: () \=\> void }) {  
  const \[open, setOpen\] \= useState(false)

  return (  
    \<Dialog open={open} onOpenChange={setOpen}\>  
      \<DialogTrigger asChild\>  
        \<Button variant="destructive"\>Eliminar\</Button\>  
      \</DialogTrigger\>  
      \<DialogContent\>  
        \<DialogHeader\>  
          \<DialogTitle\>¿Estás seguro?\</DialogTitle\>  
          \<DialogDescription\>  
            Esta acción no se puede deshacer. El customer será eliminado permanentemente.  
          \</DialogDescription\>  
        \</DialogHeader\>  
        \<div className="flex justify-end gap-2 mt-4"\>  
          \<Button variant="outline" onClick={() \=\> setOpen(false)}\>  
            Cancelar  
          \</Button\>  
          \<Button  
            variant="destructive"  
            onClick={() \=\> {  
              onConfirm()  
              setOpen(false)  
            }}  
          \>  
            Eliminar  
          \</Button\>  
        \</div\>  
      \</DialogContent\>  
    \</Dialog\>  
  )  
}  
\`\`\`

\*\*Badge:\*\*  
\`\`\`typescript  
import { Badge } from '@/components/ui/badge'

export default function StatusBadge({ status }: { status: string }) {  
  const variants \= {  
    pending: 'default',  
    sent: 'default',  
    failed: 'destructive',  
    active: 'default',  
    inactive: 'secondary',  
  } as const

  return (  
    \<Badge variant={variants\[status as keyof typeof variants\] || 'default'}\>  
      {status}  
    \</Badge\>  
  )  
}  
\`\`\`

\*\*Skeleton (Loading):\*\*  
\`\`\`typescript  
import { Skeleton } from '@/components/ui/skeleton'

export default function CustomersSkeleton() {  
  return (  
    \<div className="space-y-4"\>  
      \<Skeleton className="h-8 w-1/4" /\>  
      \<div className="space-y-2"\>  
        {\[1, 2, 3, 4, 5\].map((i) \=\> (  
          \<Skeleton key={i} className="h-16 w-full" /\>  
        ))}  
      \</div\>  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 4: Customización de Theme  
\`\`\`typescript  
// tailwind.config.ts  
import type { Config } from 'tailwindcss'

const config: Config \= {  
  darkMode: \['class'\],  
  content: \[  
    './pages/\*\*/\*.{ts,tsx}',  
    './components/\*\*/\*.{ts,tsx}',  
    './app/\*\*/\*.{ts,tsx}',  
  \],  
  theme: {  
    extend: {  
      colors: {  
        border: 'hsl(var(--border))',  
        background: 'hsl(var(--background))',  
        foreground: 'hsl(var(--foreground))',  
        primary: {  
          DEFAULT: 'hsl(var(--primary))',  
          foreground: 'hsl(var(--primary-foreground))',  
        },  
        // Customizar colores de PymePilot  
        brand: {  
          50: '\#f0f9ff',  
          100: '\#e0f2fe',  
          500: '\#0ea5e9',  
          600: '\#0284c7',  
          700: '\#0369a1',  
        },  
      },  
    },  
  },  
  plugins: \[require('tailwindcss-animate')\],  
}

export default config  
\`\`\`  
\`\`\`css  
/\* app/globals.css \*/  
@layer base {  
  :root {  
    \--background: 0 0% 100%;  
    \--foreground: 222.2 84% 4.9%;  
    \--primary: 199 89% 48%; /\* Color brand de PymePilot \*/  
    \--primary-foreground: 210 40% 98%;  
    /\* ... resto de variables \*/  
  }  
}  
\`\`\`

\#\#\# Práctica 5: Componentes Compuestos

\*\*KPI Dashboard:\*\*  
\`\`\`typescript  
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'  
import { TrendingUp, TrendingDown, Users, Target } from 'lucide-react'

interface KPI {  
  title: string  
  value: string | number  
  trend?: number  
  icon: React.ReactNode  
}

function KPICard({ title, value, trend, icon }: KPI) {  
  return (  
    \<Card\>  
      \<CardHeader className="flex flex-row items-center justify-between pb-2"\>  
        \<CardTitle className="text-sm font-medium text-gray-600"\>  
          {title}  
        \</CardTitle\>  
        \<div className="text-gray-400"\>{icon}\</div\>  
      \</CardHeader\>  
      \<CardContent\>  
        \<div className="text-3xl font-bold"\>{value}\</div\>  
        {trend \!== undefined && (  
          \<div className={\`flex items-center text-sm ${trend \>= 0 ? 'text-green-600' : 'text-red-600'}\`}\>  
            {trend \>= 0 ? \<TrendingUp className="w-4 h-4 mr-1" /\> : \<TrendingDown className="w-4 h-4 mr-1" /\>}  
            \<span\>{Math.abs(trend)}%\</span\>  
          \</div\>  
        )}  
      \</CardContent\>  
    \</Card\>  
  )  
}

export default function DashboardKPIs() {  
  return (  
    \<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"\>  
      \<KPICard  
        title="Total Customers"  
        value="1,234"  
        trend={12}  
        icon={\<Users className="w-5 h-5" /\>}  
      /\>  
      \<KPICard  
        title="Predictions"  
        value="567"  
        trend={-5}  
        icon={\<Target className="w-5 h-5" /\>}  
      /\>  
      \<KPICard  
        title="Success Rate"  
        value="85%"  
        trend={3}  
        icon={\<TrendingUp className="w-5 h-5" /\>}  
      /\>  
      \<KPICard  
        title="Active"  
        value="892"  
        icon={\<Users className="w-5 h-5" /\>}  
      /\>  
    \</div\>  
  )  
}  
\`\`\`

\---

\#\# 💻 Componentes Útiles para PymePilot

\#\#\# Alert para Notifications  
\`\`\`bash  
npx shadcn-ui@latest add alert  
\`\`\`  
\`\`\`typescript  
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'  
import { Info } from 'lucide-react'

export default function InfoAlert() {  
  return (  
    \<Alert\>  
      \<Info className="h-4 w-4" /\>  
      \<AlertTitle\>Heads up\!\</AlertTitle\>  
      \<AlertDescription\>  
        Tenés 5 predictions pendientes de enviar.  
      \</AlertDescription\>  
    \</Alert\>  
  )  
}  
\`\`\`

\#\#\# Toast para Success/Error Messages  
\`\`\`bash  
npx shadcn-ui@latest add toast  
\`\`\`  
\`\`\`typescript  
'use client'

import { useToast } from '@/components/ui/use-toast'  
import { Button } from '@/components/ui/button'

export default function ToastExample() {  
  const { toast } \= useToast()

  return (  
    \<Button  
      onClick={() \=\> {  
        toast({  
          title: 'Customer creado',  
          description: 'El customer fue agregado exitosamente.',  
        })  
      }}  
    \>  
      Show Toast  
    \</Button\>  
  )  
}  
\`\`\`

\*\*Agregar Toaster en layout:\*\*  
\`\`\`typescript  
// app/layout.tsx  
import { Toaster } from '@/components/ui/toaster'

export default function RootLayout({ children }) {  
  return (  
    \<html\>  
      \<body\>  
        {children}  
        \<Toaster /\>  
      \</body\>  
    \</html\>  
  )  
}  
\`\`\`

\#\#\# Dropdown Menu para Actions  
\`\`\`bash  
npx shadcn-ui@latest add dropdown-menu  
\`\`\`  
\`\`\`typescript  
import {  
  DropdownMenu,  
  DropdownMenuContent,  
  DropdownMenuItem,  
  DropdownMenuLabel,  
  DropdownMenuSeparator,  
  DropdownMenuTrigger,  
} from '@/components/ui/dropdown-menu'  
import { Button } from '@/components/ui/button'  
import { MoreVertical, Edit, Trash } from 'lucide-react'

export default function CustomerActions({ customerId }: { customerId: string }) {  
  return (  
    \<DropdownMenu\>  
      \<DropdownMenuTrigger asChild\>  
        \<Button variant="ghost" size="sm"\>  
          \<MoreVertical className="w-4 h-4" /\>  
        \</Button\>  
      \</DropdownMenuTrigger\>  
      \<DropdownMenuContent align="end"\>  
        \<DropdownMenuLabel\>Acciones\</DropdownMenuLabel\>  
        \<DropdownMenuSeparator /\>  
        \<DropdownMenuItem\>  
          \<Edit className="w-4 h-4 mr-2" /\>  
          Editar  
        \</DropdownMenuItem\>  
        \<DropdownMenuItem className="text-red-600"\>  
          \<Trash className="w-4 h-4 mr-2" /\>  
          Eliminar  
        \</DropdownMenuItem\>  
      \</DropdownMenuContent\>  
    \</DropdownMenu\>  
  )  
}  
\`\`\`

\---

\#\# 🚨 Errores Comunes

\#\#\# Error 1: No instalar dependencias necesarias  
\`\`\`bash  
\# Si sale error de react-hook-form  
npm install react-hook-form @hookform/resolvers zod

\# Si sale error de lucide-react  
npm install lucide-react  
\`\`\`

\#\#\# Error 2: Import incorrecto  
\`\`\`typescript  
// ❌ MAL  
import { Button } from 'shadcn-ui'

// ✅ BIEN  
import { Button } from '@/components/ui/button'  
\`\`\`

\#\#\# Error 3: No usar cn() para merge de clases  
\`\`\`typescript  
// ❌ MAL  
\<Button className="bg-red-500 text-white"\>Click\</Button\>  
// Puede sobrescribir estilos del Button

// ✅ BIEN  
import { cn } from '@/lib/utils'

\<Button className={cn('bg-red-500')}\>Click\</Button\>  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] shadcn/ui inicializado  
\- \[ \] Componentes básicos instalados (button, card, table, form)  
\- \[ \] Toaster agregado en layout  
\- \[ \] Theme customizado (colores de PymePilot)  
\- \[ \] Iconos (lucide-react) instalados

\---

\#\# 💡 Para Pato

\#\#\# Setup completo  
\`\`\`bash  
\# 1\. Init  
npx shadcn-ui@latest init

\# 2\. Componentes esenciales  
npx shadcn-ui@latest add button card table form input label select dialog badge skeleton dropdown-menu alert toast

\# 3\. Dependencias  
npm install react-hook-form @hookform/resolvers zod lucide-react  
\`\`\`

\#\#\# Agregar componente nuevo  
\`\`\`bash  
\# Ver componentes disponibles  
npx shadcn-ui@latest add

\# Agregar específico  
npx shadcn-ui@latest add \[nombre\]  
\`\`\`

\#\#\# Customizar componente  
\`\`\`typescript  
// Editar directamente el archivo en components/ui/  
// Ejemplo: components/ui/button.tsx  
// El código es TUYO, modificalo como quieras  
\`\`\`

\---  
