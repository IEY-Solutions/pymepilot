# Design: 3 Fixes/Mejoras Pipeline + Chatbot

**Fecha:** 2026-03-11
**Estado:** Aprobado

---

## 1. Excel Propuesta — Formula + Colores IEY

**Archivo:** `frontend/src/lib/exports/export-proposal.ts`

**Cambios:**
- Columna "Cantidad sugerida": celdas editables (sin proteccion de hoja)
- Total al final: formula `=SUM(C2:CN)` en vez de valor hardcodeado
- Colores: reemplazar teal (#81b5a1) por azul IEY (#04a9ff)
- Proteger el resto de celdas para que el cliente solo edite cantidades

## 2. Card "Vendido" — Celebracion + Contenido + Expiracion

### Animacion
- Al confirmar venta: card se anima al centro de pantalla
- Confetti (canvas-confetti, ~3 segundos)
- Sonido caja registradora (.mp3 libre de derechos, ~1-2s)
- Despues de ~4s, card se ubica en columna vendido

### Contenido card vendido
- Icono check/trofeo
- Titulo: "Venta cerrada"
- Mensaje felicitatorio + recordatorio circuito reposicion
- next_reposition_estimate si existe

### Expiracion
- Cards en vendido expiran a los 7 dias (is_expired = true)
- Mismo mecanismo que a_contactar pero con 7 dias
- Boton X para descartar

## 3. Chatbot Mobile — Fix Z-index

**Problema:** Panel chat z-40, BottomNav z-50 — menu tapa input
**Solucion:** Panel chat mobile sube a z-[60] cuando esta abierto
**Archivos:** `frontend/src/components/chat/chat-bubble.tsx`
