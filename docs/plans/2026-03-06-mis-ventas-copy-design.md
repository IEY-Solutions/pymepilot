# Mejora Copy "Mis ventas" (ex /logros)

**Fecha:** 2026-03-06
**Estado:** Aprobado

---

## Contexto

La pagina /logros tiene copy tecnico y frio que no motiva al vendedor.
Terminos como "predicciones convertidas", "valor generado con PymePilot",
"sin racha activa" hablan en lenguaje de sistema, no de vendedor.

**Tono elegido:** Profesional calido — informativo pero humano, sin
exclamaciones excesivas.

---

## Cambios

### Titulo de pagina

`Logros` -> **`Mis ventas`**

### 3 KPI Cards (redefinidas)

| # | Titulo | Valor ejemplo | Subtitulo (con datos) | Subtitulo (en 0) |
|---|--------|---------------|----------------------|-------------------|
| 1 | Mis ventas del mes | 47 ordenes - $850,000 | "en marzo" | "PymePilot tiene clientes listos para que los contactes" |
| 2 | Ventas con PymePilot | 3 ventas - $45,000 | "clientes contactados que compraron" | "Cuando un cliente recomendado compre, lo vas a ver aca" |
| 3 | Racha de ventas | 5 dias | (ver tabla abajo) | "PymePilot te muestra a quien contactar para arrancar tu racha" |

Card 1 = ventas totales del ERP (reutiliza get_total_sales).
Card 2 = ventas atribuidas a PymePilot (datos existentes).
Card 3 = dias consecutivos con cualquier venta (modificar RPC).

### Subtitulos de racha segun valor

| Racha | Subtitulo |
|-------|-----------|
| 0 | "PymePilot te muestra a quien contactar para arrancar tu racha" |
| 1 | "Buen comienzo -- PymePilot te ayuda a mantener la racha" |
| 2-4 | "Vas bien -- PymePilot te ayuda a mantener la racha" |
| 5+ | "Gran racha -- segui asi con las recomendaciones de PymePilot" |

### AchievementCards (expandibles)

**Colapsada:** Nombre + monto + badge vertical + chevron

**Expandida (al tocar):**
- Oracion que cuenta la historia (ver tabla)
- Productos comprados (chips)
- Tiempo ("Hace 2 dias")

### Historias por patron

| Patron | Oracion expandida |
|--------|-------------------|
| Primera compra | "[Nombre] hizo su primera compra por [monto] -- nuevo cliente activado" |
| Fidelizando | "[Nombre] hizo su segunda compra por [monto] -- se esta convirtiendo en recurrente" |
| Recurrente | "[Nombre] volvio a comprar por [monto] -- compra cada ~[N] dias como siempre" |
| Recuperado | "[Nombre] volvio despues de estar inactivo y compro [monto] -- cliente recuperado" |
| Cross-sell | "[Nombre] compro [monto] en productos nuevos -- se esta diversificando" |

### Estado vacio (lista sin items)

> "Todavia sin ventas este mes"
> "Cada vez que un cliente recomendado compre, va a aparecer aca"

---

## Cambios tecnicos

1. **get_streak_days() RPC:** Cambiar para contar dias con CUALQUIER venta (no solo atribuidas)
2. **page.tsx /logros:** Agregar fetch de get_total_sales (reutilizar desde /metricas)
3. **logros-content.tsx:** Nuevos props (totalSales), copy actualizado, titulo
4. **achievement-card.tsx:** Hacer expandible (estado local), copy con oraciones completas
5. **sidebar.tsx + bottom-nav.tsx:** Cambiar label "Logros" -> "Mis ventas"

---

## Lo que NO cambia

- Colores, iconos, gradientes de las KPI cards
- Filtro por vertical
- Estructura de la pagina (KPIs arriba, lista abajo)
- Badge de vertical en cada card
