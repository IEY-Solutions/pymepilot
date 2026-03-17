---
name: supabase-realtime
description: Subscriptions realtime con tenant filtering y broadcast
---

\# Skill: Supabase Realtime

\#\# 🎯 Qué es  
Configuración de Supabase Realtime para sincronizar datos en tiempo real entre clientes. Útil para dashboards que se actualizan automáticamente cuando hay cambios en la base de datos.

\*\*Analogía Simple:\*\*  
Realtime es como notificaciones push:  
\- Algo cambia en DB → todos los clientes conectados se enteran  
\- No necesitás hacer polling (preguntar cada X segundos)  
\- Actualización instantánea  
\- Como WhatsApp Web (ves mensajes en tiempo real)

En PymePilot (opcional):  
\- Dashboard muestra nueva prediction automáticamente  
\- Notificación cuando mensaje fue enviado  
\- KPIs se actualizan en vivo  
\- Colaboración entre usuarios del mismo tenant

\*\*Por qué es OPCIONAL:\*\*  
\- No es crítico para funcionamiento básico  
\- Agrega complejidad  
\- Polling cada 30 segundos puede ser suficiente  
\- Implementar solo si es necesario

\#\# 📋 Cuándo usar este skill

\#\#\# Usar cuando:  
\- ✅ Dashboard necesita updates en vivo  
\- ✅ Múltiples usuarios colaborando  
\- ✅ Notificaciones en tiempo real importantes  
\- ✅ Estado de proceso (ej: "prediction generándose...")

\#\#\# NO usar cuando:  
\- ❌ Datos cambian raramente  
\- ❌ Un solo usuario por tenant  
\- ❌ Polling es suficiente  
\- ❌ Complejidad no justificada

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Habilitar Realtime en Tabla

\*\*En Supabase Dashboard:\*\*  
\`\`\`  
Database → Replication → \[tabla\]  
☑ Enable Realtime  
\`\`\`

\*\*O via SQL:\*\*  
\`\`\`sql  
\-- Habilitar Realtime en tabla predictions  
ALTER TABLE predictions REPLICA IDENTITY FULL;

\-- Publicar cambios  
ALTER PUBLICATION supabase\_realtime ADD TABLE predictions;  
\`\`\`

\#\#\# Práctica 2: Subscribe a Cambios (Client)

\*\*React Component con subscription:\*\*  
\`\`\`typescript  
'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'  
import { useEffect, useState } from 'react'

export default function PredictionsRealtimePage() {  
  const supabase \= createClientComponentClient()  
  const \[predictions, setPredictions\] \= useState\<any\[\]\>(\[\])  
    
  useEffect(() \=\> {  
    // Load inicial  
    loadPredictions()  
      
    // Subscribe a cambios  
    const channel \= supabase  
      .channel('predictions-changes')  
      .on(  
        'postgres\_changes',  
        {  
          event: '\*', // INSERT, UPDATE, DELETE  
          schema: 'public',  
          table: 'predictions',  
          // Filter por tenant (requiere RLS configurado)  
        },  
        (payload) \=\> {  
          console.log('Change received:', payload)  
            
          if (payload.eventType \=== 'INSERT') {  
            // Nueva prediction → agregar a lista  
            setPredictions(prev \=\> \[payload.new, ...prev\])  
          } else if (payload.eventType \=== 'UPDATE') {  
            // Prediction actualizada → reemplazar  
            setPredictions(prev \=\>  
              prev.map(p \=\> p.id \=== payload.new.id ? payload.new : p)  
            )  
          } else if (payload.eventType \=== 'DELETE') {  
            // Prediction eliminada → remover  
            setPredictions(prev \=\>  
              prev.filter(p \=\> p.id \!== payload.old.id)  
            )  
          }  
        }  
      )  
      .subscribe()  
      
    // Cleanup al desmontar  
    return () \=\> {  
      supabase.removeChannel(channel)  
    }  
  }, \[\])  
    
  async function loadPredictions() {  
    const { data } \= await supabase  
      .from('predictions')  
      .select('\*')  
      .order('created\_at', { ascending: false })  
      .limit(20)  
      
    setPredictions(data || \[\])  
  }  
    
  return (  
    \<div\>  
      \<h1\>Predictions (Realtime)\</h1\>  
      \<ul\>  
        {predictions.map(p \=\> (  
          \<li key={p.id}\>  
            {p.message\_text} \- \<em\>{p.status}\</em\>  
          \</li\>  
        ))}  
      \</ul\>  
    \</div\>  
  )  
}  
\`\`\`

\#\#\# Práctica 3: Broadcast Custom Events

\*\*Enviar evento custom:\*\*  
\`\`\`typescript  
// Desde Edge Function o cliente  
const channel \= supabase.channel('custom-events')

// Enviar evento  
await channel.send({  
  type: 'broadcast',  
  event: 'prediction-generated',  
  payload: { prediction\_id: '123', tenant\_id: 'abc' }  
})  
\`\`\`

\*\*Recibir evento:\*\*  
\`\`\`typescript  
const channel \= supabase  
  .channel('custom-events')  
  .on('broadcast', { event: 'prediction-generated' }, (payload) \=\> {  
    console.log('Prediction generated:', payload)  
      
    // Verificar que es del tenant correcto  
    if (payload.tenant\_id \=== currentTenantId) {  
      alert('Nueva prediction generada\!')  
    }  
  })  
  .subscribe()  
\`\`\`

\#\#\# Práctica 4: Presence (Online Users)

\*\*Tracking de usuarios online:\*\*  
\`\`\`typescript  
const channel \= supabase.channel('online-users', {  
  config: {  
    presence: {  
      key: user.id, // Unique key por usuario  
    },  
  },  
})

// Join channel  
channel  
  .on('presence', { event: 'sync' }, () \=\> {  
    const state \= channel.presenceState()  
    console.log('Online users:', Object.keys(state).length)  
  })  
  .on('presence', { event: 'join' }, ({ key, newPresences }) \=\> {  
    console.log('User joined:', key)  
  })  
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) \=\> {  
    console.log('User left:', key)  
  })  
  .subscribe(async (status) \=\> {  
    if (status \=== 'SUBSCRIBED') {  
      // Track presencia  
      await channel.track({  
        user\_id: user.id,  
        email: user.email,  
        online\_at: new Date().toISOString(),  
      })  
    }  
  })  
\`\`\`

\---

\#\# 🚨 Errores Comunes

\#\#\# Error 1: No filtrar por tenant  
\`\`\`typescript  
// ❌ MAL \- Recibe cambios de TODOS los tenants  
.on('postgres\_changes', { event: '\*', table: 'predictions' }, ...)

// ✅ BIEN \- Filtrar en cliente  
.on('postgres\_changes', { event: '\*', table: 'predictions' }, (payload) \=\> {  
  if (payload.new.tenant\_id \=== currentTenantId) {  
    // Procesar solo si es del tenant actual  
  }  
})

// ✅ MEJOR \- RLS filtra automáticamente (si está configurado)  
\`\`\`

\#\#\# Error 2: No hacer cleanup  
\`\`\`typescript  
// ❌ MAL \- Memory leak  
useEffect(() \=\> {  
  const channel \= supabase.channel('test').subscribe()  
  // Sin cleanup  
}, \[\])

// ✅ BIEN \- Cleanup  
useEffect(() \=\> {  
  const channel \= supabase.channel('test').subscribe()  
    
  return () \=\> {  
    supabase.removeChannel(channel)  
  }  
}, \[\])  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] Realtime habilitado en tabla  
\- \[ \] RLS configurado (para filtrar por tenant)  
\- \[ \] Subscriptions con cleanup  
\- \[ \] Filtrado por tenant en cliente  
\- \[ \] Manejo de reconexión automática

\---

\#\# 💡 Para Pato

\#\#\# Cuándo implementar Realtime

\*\*Implementar SI:\*\*  
\- Dashboard con múltiples usuarios  
\- Necesitás "feeling de app moderna"  
\- Cambios frecuentes que deben verse al instante

\*\*NO implementar SI:\*\*  
\- Un solo usuario por tenant (Pato solo en IEY)  
\- Datos cambian raramente  
\- Polling cada 30s es suficiente

\*\*Mi recomendación:\*\*  
\- Empezar SIN Realtime  
\- Si después lo necesitás, es fácil agregarlo  
\- KISS (Keep It Simple, Stupid)

\---  
