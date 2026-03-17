\# Skill: Server Actions

\#\# 🎯 Qué es  
Server Actions para mutations en Next.js 14+. Manejo de forms, validación con Zod, error handling, loading states con useFormStatus, y revalidación de cache.

\*\*Analogía Simple:\*\*  
Server Actions son como el sistema de pedidos de un restaurant:  
\- Form \= mesa que hace el pedido  
\- Server Action \= cocina que procesa el pedido  
\- Validation \= chef que verifica que el pedido esté completo  
\- Revalidation \= actualizar el menú cuando hay cambios

En PymePilot:  
\- Crear customers  
\- Generar predictions  
\- Enviar mensajes de WhatsApp  
\- Update de configuraciones  
\- Todo sin API routes manuales

\*\*Por qué es CRÍTICO:\*\*  
\- Progressive enhancement (funciona sin JS)  
\- Type-safe (TypeScript end-to-end)  
\- Menos código que API routes  
\- Cache revalidation automática  
\- Error handling integrado

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al crear forms  
\- ✅ Al hacer mutations (CREATE, UPDATE, DELETE)  
\- ✅ Al necesitar validación de datos

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Forms complejos con validación  
\- ⚠️ Necesitás optimistic updates  
\- ⚠️ Múltiples steps en un flow

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Action Básica con Validación  
\`\`\`typescript  
// app/actions/customers.ts  
'use server'

import { createServerActionClient } from '@supabase/auth-helpers-nextjs'  
import { cookies } from 'next/headers'  
import { revalidatePath } from 'next/cache'  
import { z } from 'zod'

// Schema de validación  
const createCustomerSchema \= z.object({  
  name: z.string().min(1, 'Nombre requerido').max(100, 'Nombre muy largo'),  
  email: z.string().email('Email inválido'),  
  phone: z.string().optional(),  
})

export async function createCustomer(formData: FormData) {  
  const supabase \= createServerActionClient({ cookies })  
    
  // 1\. Obtener user y tenant  
  const { data: { user } } \= await supabase.auth.getUser()  
    
  if (\!user) {  
    return { error: 'No autenticado' }  
  }  
    
  const tenantId \= user.user\_metadata?.tenant\_id  
    
  if (\!tenantId) {  
    return { error: 'Missing tenant\_id' }  
  }  
    
  // 2\. Validar datos del form  
  const validatedFields \= createCustomerSchema.safeParse({  
    name: formData.get('name'),  
    email: formData.get('email'),  
    phone: formData.get('phone') || undefined,  
  })  
    
  if (\!validatedFields.success) {  
    return {  
      error: validatedFields.error.flatten().fieldErrors,  
    }  
  }  
    
  const { name, email, phone } \= validatedFields.data  
    
  // 3\. Insertar en DB  
  const { data, error } \= await supabase  
    .from('customers')  
    .insert({  
      tenant\_id: tenantId,  
      name,  
      email,  
      phone,  
    })  
    .select()  
    .single()  
    
  if (error) {  
    console.error('Error creating customer:', error)  
    return { error: 'Error al crear customer' }  
  }  
    
  // 4\. Revalidar cache de la página de customers  
  revalidatePath('/dashboard/customers')  
    
  // 5\. Retornar éxito  
  return { success: true, data }  
}  
\`\`\`

\#\#\# Práctica 2: Form Component con useFormState  
\`\`\`typescript  
// components/features/customers/CustomerForm.tsx  
'use client'

import { useFormState, useFormStatus } from 'react-dom'  
import { Button } from '@/components/ui/button'  
import { Input } from '@/components/ui/input'  
import { Label } from '@/components/ui/label'

function SubmitButton() {  
  const { pending } \= useFormStatus()  
    
  return (  
    \<Button type="submit" disabled={pending}\>  
      {pending ? 'Guardando...' : 'Guardar Customer'}  
    \</Button\>  
  )  
}

export default function CustomerForm({   
  action   
}: {   
  action: (formData: FormData) \=\> Promise\<any\>   
}) {  
  const \[state, formAction\] \= useFormState(action, null)  
    
  return (  
    \<form action={formAction} className="space-y-4"\>  
      {/\* Campo Nombre \*/}  
      \<div\>  
        \<Label htmlFor="name"\>Nombre \*\</Label\>  
        \<Input  
          id="name"  
          name="name"  
          required  
          className={state?.error?.name ? 'border-red-500' : ''}  
        /\>  
        {state?.error?.name && (  
          \<p className="text-red-500 text-sm mt-1"\>  
            {state.error.name\[0\]}  
          \</p\>  
        )}  
      \</div\>  
        
      {/\* Campo Email \*/}  
      \<div\>  
        \<Label htmlFor="email"\>Email \*\</Label\>  
        \<Input  
          id="email"  
          name="email"  
          type="email"  
          required  
          className={state?.error?.email ? 'border-red-500' : ''}  
        /\>  
        {state?.error?.email && (  
          \<p className="text-red-500 text-sm mt-1"\>  
            {state.error.email\[0\]}  
          \</p\>  
        )}  
      \</div\>  
        
      {/\* Campo Teléfono \*/}  
      \<div\>  
        \<Label htmlFor="phone"\>Teléfono\</Label\>  
        \<Input  
          id="phone"  
          name="phone"  
          type="tel"  
          placeholder="+54 9 11 1234-5678"  
        /\>  
      \</div\>  
        
      {/\* Error general \*/}  
      {state?.error && typeof state.error \=== 'string' && (  
        \<div className="p-3 bg-red-50 border border-red-200 rounded"\>  
          \<p className="text-red-600 text-sm"\>{state.error}\</p\>  
        \</div\>  
      )}  
        
      {/\* Success message \*/}  
      {state?.success && (  
        \<div className="p-3 bg-green-50 border border-green-200 rounded"\>  
          \<p className="text-green-600 text-sm"\>  
            Customer creado exitosamente\!  
          \</p\>  
        \</div\>  
      )}  
        
      \<SubmitButton /\>  
    \</form\>  
  )  
}  
\`\`\`

\#\#\# Práctica 3: Página que usa el Form  
\`\`\`typescript  
// app/(dashboard)/customers/new/page.tsx  
import { createCustomer } from '@/app/actions/customers'  
import CustomerForm from '@/components/features/customers/CustomerForm'

export default function NewCustomerPage() {  
  return (  
    \<div className="max-w-2xl mx-auto"\>  
      \<h1 className="text-2xl font-bold mb-6"\>Nuevo Customer\</h1\>  
        
      \<div className="bg-white p-6 rounded shadow"\>  
        \<CustomerForm action={createCustomer} /\>  
      \</div\>  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 4: Action con Redirect  
\`\`\`typescript  
// app/actions/customers.ts  
'use server'

import { redirect } from 'next/navigation'

export async function createCustomer(formData: FormData) {  
  // ... validación e inserción  
    
  if (error) {  
    return { error: error.message }  
  }  
    
  // Redirect después de éxito  
  redirect(\`/dashboard/customers/${data.id}\`)  
}  
\`\`\`

\#\#\# Práctica 5: Action de Update  
\`\`\`typescript  
// app/actions/customers.ts  
'use server'

const updateCustomerSchema \= z.object({  
  id: z.string().uuid(),  
  name: z.string().min(1).optional(),  
  email: z.string().email().optional(),  
  phone: z.string().optional(),  
})

export async function updateCustomer(formData: FormData) {  
  const supabase \= createServerActionClient({ cookies })  
    
  const { data: { user } } \= await supabase.auth.getUser()  
  if (\!user) return { error: 'No autenticado' }  
    
  const tenantId \= user.user\_metadata?.tenant\_id  
    
  // Validar  
  const validatedFields \= updateCustomerSchema.safeParse({  
    id: formData.get('id'),  
    name: formData.get('name'),  
    email: formData.get('email'),  
    phone: formData.get('phone'),  
  })  
    
  if (\!validatedFields.success) {  
    return { error: validatedFields.error.flatten().fieldErrors }  
  }  
    
  const { id, ...updates } \= validatedFields.data  
    
  // Setear tenant context  
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  // Update  
  const { error } \= await supabase  
    .from('customers')  
    .update(updates)  
    .eq('id', id)  
    
  if (error) {  
    return { error: 'Error al actualizar' }  
  }  
    
  // Revalidar  
  revalidatePath('/dashboard/customers')  
  revalidatePath(\`/dashboard/customers/${id}\`)  
    
  return { success: true }  
}  
\`\`\`

\#\#\# Práctica 6: Action de Delete  
\`\`\`typescript  
// app/actions/customers.ts  
'use server'

export async function deleteCustomer(customerId: string) {  
  const supabase \= createServerActionClient({ cookies })  
    
  const { data: { user } } \= await supabase.auth.getUser()  
  if (\!user) return { error: 'No autenticado' }  
    
  const tenantId \= user.user\_metadata?.tenant\_id  
    
  await supabase.rpc('set\_tenant\_context', { p\_tenant\_id: tenantId })  
    
  const { error } \= await supabase  
    .from('customers')  
    .delete()  
    .eq('id', customerId)  
    
  if (error) {  
    return { error: 'Error al eliminar' }  
  }  
    
  revalidatePath('/dashboard/customers')  
    
  return { success: true }  
}  
\`\`\`  
\`\`\`typescript  
// Component que usa deleteCustomer  
'use client'

import { deleteCustomer } from '@/app/actions/customers'  
import { useTransition } from 'react'

export function DeleteButton({ customerId }: { customerId: string }) {  
  const \[isPending, startTransition\] \= useTransition()  
    
  function handleDelete() {  
    if (\!confirm('¿Estás seguro?')) return  
      
    startTransition(async () \=\> {  
      const result \= await deleteCustomer(customerId)  
        
      if (result.error) {  
        alert(result.error)  
      }  
    })  
  }  
    
  return (  
    \<button  
      onClick={handleDelete}  
      disabled={isPending}  
      className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50"  
    \>  
      {isPending ? 'Eliminando...' : 'Eliminar'}  
    \</button\>  
  )  
}  
\`\`\`

\#\#\# Práctica 7: Action con Edge Function  
\`\`\`typescript  
// app/actions/predictions.ts  
'use server'

export async function generatePrediction(customerId: string) {  
  const supabase \= createServerActionClient({ cookies })  
    
  const { data: { user } } \= await supabase.auth.getUser()  
  if (\!user) return { error: 'No autenticado' }  
    
  // Llamar Edge Function  
  const { data, error } \= await supabase.functions.invoke(  
    'generate-prediction',  
    {  
      body: {  
        customer\_id: customerId,  
        vertical: 'activacion'  
      }  
    }  
  )  
    
  if (error) {  
    console.error('Error calling Edge Function:', error)  
    return { error: 'Error al generar prediction' }  
  }  
    
  revalidatePath('/dashboard/predictions')  
    
  return { success: true, data }  
}  
\`\`\`

\#\#\# Práctica 8: Optimistic Updates  
\`\`\`typescript  
'use client'

import { updateCustomer } from '@/app/actions/customers'  
import { useOptimistic } from 'react'

export function CustomerStatus({   
  customer   
}: {   
  customer: { id: string; status: string }   
}) {  
  const \[optimisticStatus, setOptimisticStatus\] \= useOptimistic(customer.status)  
    
  async function handleToggle() {  
    const newStatus \= customer.status \=== 'active' ? 'inactive' : 'active'  
      
    // Update optimista (UI se actualiza inmediatamente)  
    setOptimisticStatus(newStatus)  
      
    // Server Action  
    const formData \= new FormData()  
    formData.append('id', customer.id)  
    formData.append('status', newStatus)  
      
    const result \= await updateCustomer(formData)  
      
    if (result.error) {  
      // Si falla, UI vuelve al estado anterior  
      alert(result.error)  
    }  
  }  
    
  return (  
    \<button  
      onClick={handleToggle}  
      className={\`px-3 py-1 rounded ${  
        optimisticStatus \=== 'active'   
          ? 'bg-green-100 text-green-800'   
          : 'bg-gray-100 text-gray-800'  
      }\`}  
    \>  
      {optimisticStatus}  
    \</button\>  
  )  
}  
\`\`\`

\---

\#\# 💻 Ejemplos Completos

\#\#\# Form Multi-Step  
\`\`\`typescript  
// app/actions/onboarding.ts  
'use server'

export async function saveOnboardingStep(  
  step: number,  
  formData: FormData  
) {  
  // Guardar progreso en DB o cookies  
  // ...  
    
  if (step \=== 3\) {  
    // Último step → crear todo  
    redirect('/dashboard')  
  }  
    
  return { success: true, nextStep: step \+ 1 }  
}  
\`\`\`

\#\#\# Batch Actions  
\`\`\`typescript  
// app/actions/predictions.ts  
'use server'

export async function sendMultiplePredictions(  
  predictionIds: string\[\]  
) {  
  const supabase \= createServerActionClient({ cookies })  
    
  const results \= await Promise.all(  
    predictionIds.map(id \=\>  
      supabase.functions.invoke('send-whatsapp', {  
        body: { prediction\_id: id }  
      })  
    )  
  )  
    
  const errors \= results.filter(r \=\> r.error)  
    
  if (errors.length \> 0\) {  
    return {   
      error: \`${errors.length} mensajes fallaron\`,  
      partialSuccess: true   
    }  
  }  
    
  revalidatePath('/dashboard/predictions')  
    
  return { success: true }  
}  
\`\`\`

\---

\#\# 🚨 Errores Comunes

\#\#\# Error 1: No usar 'use server'  
\`\`\`typescript  
// ❌ MAL \- Sin 'use server'  
export async function createCustomer(formData: FormData) {  
  // Se ejecuta en cliente (no funciona)  
}

// ✅ BIEN  
'use server'

export async function createCustomer(formData: FormData) {  
  // Se ejecuta en servidor  
}  
\`\`\`

\#\#\# Error 2: No validar datos  
\`\`\`typescript  
// ❌ MAL \- Sin validación  
const name \= formData.get('name') as string  
// name puede ser null, vacío, etc.

// ✅ BIEN \- Con Zod  
const schema \= z.object({ name: z.string().min(1) })  
const validated \= schema.safeParse({ name: formData.get('name') })  
\`\`\`

\#\#\# Error 3: No revalidar cache  
\`\`\`typescript  
// ❌ MAL \- Sin revalidate  
export async function createCustomer(formData: FormData) {  
  await supabase.from('customers').insert(...)  
  return { success: true }  
  // Lista de customers NO se actualiza  
}

// ✅ BIEN \- Con revalidate  
export async function createCustomer(formData: FormData) {  
  await supabase.from('customers').insert(...)  
  revalidatePath('/dashboard/customers')  
  return { success: true }  
}  
\`\`\`

\#\#\# Error 4: Exponer secrets  
\`\`\`typescript  
// ❌ MAL \- API key en cliente  
'use client'  
const API\_KEY \= 'sk-ant-...' // NUNCA

// ✅ BIEN \- API key en Server Action  
'use server'  
const API\_KEY \= process.env.ANTHROPIC\_API\_KEY  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] 'use server' en archivo de actions  
\- \[ \] Validación con Zod  
\- \[ \] Error handling completo  
\- \[ \] Auth check al inicio  
\- \[ \] Tenant context seteado  
\- \[ \] revalidatePath después de mutations  
\- \[ \] Loading states con useFormStatus  
\- \[ \] Success/error messages  
\- \[ \] TypeScript types completos

\---

\#\# 💡 Para Pato

\#\#\# Setup de Zod  
\`\`\`bash  
npm install zod  
\`\`\`

\#\#\# Template de Action  
\`\`\`typescript  
'use server'

import { z } from 'zod'

const schema \= z.object({  
  // fields  
})

export async function myAction(formData: FormData) {  
  // 1\. Auth check  
  // 2\. Validate  
  // 3\. Execute  
  // 4\. Revalidate  
  // 5\. Return  
}  
\`\`\`

\#\#\# Testing  
\`\`\`bash  
\# Desarrollo  
npm run dev

\# Test form submission  
\# Verificar:  
\# \- Loading state aparece  
\# \- Success/error messages  
\# \- Cache se revalida (lista se actualiza)  
\`\`\`

\---  
