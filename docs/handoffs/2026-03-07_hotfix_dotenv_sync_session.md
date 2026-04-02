# Handoff: Hotfix — Sync Contabilium caido por backend/.env espurio

**Fecha:** 2026-03-07
**Tipo:** Hotfix (incidente de produccion)
**Commit:** `e743a20`
**Duracion:** ~30 min

---

## Sintoma reportado

Pato reporto que el sync de Contabilium programado para las 5 AM no se ejecuto.

## Investigacion

### Linea de tiempo del incidente

| Hora (CET) | Evento |
|-------------|--------|
| ~01:54 | Ultima ejecucion exitosa del upload worker |
| ~01:55 | Upload worker empieza a fallar: `Connection refused` a `127.0.0.1:5432` |
| ~02:01 | Sesion de Codex (Fase 10 Bloque C) ejecuta `setup_vapid.py` |
| 04:30 | Drive sync falla: `SUPABASE_URL no configurada` |
| 05:00 | Orquestador falla: `PoolTimeout` conectando a `127.0.0.1` |
| 05:30 | Freshness check falla: mismo error |
| 01:55 → 23:55 | Upload worker fallo ininterrumpidamente (~22 horas) |

### Causa raiz

El script `backend/scripts/setup_vapid.py` tenia un bug en el calculo de `project_root`:

```python
# BUG: 2 dirname sube a backend/, no a pymepilot/
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# __file__ = backend/scripts/setup_vapid.py
# dirname 1 = backend/scripts/
# dirname 2 = backend/        <-- INCORRECTO (deberia ser pymepilot/)
```

Esto causo que `setup_vapid.py` creara un archivo `backend/.env` con solo 3 variables VAPID.

### Mecanismo de fallo

1. `python-dotenv` tiene un comportamiento de busqueda: `find_dotenv()` sube desde el directorio del script que lo llama hasta encontrar el primer `.env`
2. Los scripts en `backend/scripts/` llamaban `load_dotenv()` sin path explicito
3. `find_dotenv()` buscaba desde `backend/scripts/` → subia a `backend/` → encontraba `backend/.env` (el espurio) → **dejaba de buscar**
4. `backend/.env` solo tenia 3 variables VAPID, no tenia `DATABASE_HOST`
5. `connection.py` usaba el default `localhost` (127.0.0.1) → puerto 5432 no expuesto en el host → `Connection refused`

### Por que no se detecto antes

- La sesion de Fase 10 Bloque C que creo el archivo fue a las ~02:01 AM
- Nadie estaba monitoreando a esa hora
- El upload worker falla silenciosamente (solo loguea, no alerta)
- No hay alertas configuradas para fallos de conexion del cron

## Fix aplicado

### 1. Eliminar archivo espurio

```bash
rm backend/.env
```

`backend/.env` solo contenia claves VAPID huerfanas (par diferente al de `.env` raiz). Nadie las usaba.

### 2. Corregir setup_vapid.py (commit e743a20)

```python
# ANTES (bug): 2 dirname
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# DESPUES (fix): 3 dirname — consistente con todos los demas scripts
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```

## Verificaciones post-fix

| Check | Resultado |
|-------|-----------|
| `backend/.env` eliminado | OK |
| `.env` raiz: 18 variables intactas | OK |
| 11 variables criticas cargando | OK |
| VAPID keys backend == frontend | OK (consistentes) |
| Conexion DB desde scripts | OK (172.18.0.10:5432) |
| RLS sin tenant context | OK (0 rows — correcto) |
| Datos IEY | OK (126 customers, 2021 products, 283 orders, 3 push subs) |
| Git diff: solo 2 lineas cambiadas | OK (sin secrets expuestos) |
| `process_uploads.py` ejecutado manual | OK (conecta) |
| `check_data_freshness.py` ejecutado manual | OK (conecta) |

## Impacto

- **Sync perdido:** 1 dia (2026-03-07). Se recupera automaticamente manana a las 5 AM (sync full).
- **Upload worker:** Estuvo caido ~22 horas. Si algun usuario subio un archivo en ese periodo, el job quedo en `pending` y se procesara automaticamente ahora que el worker volvio.
- **Datos:** Cero perdida de datos. La DB estuvo sana todo el tiempo.
- **Push notifications:** Sin impacto. Las 3 suscripciones siguen activas.

## Lecciones / mejoras futuras

1. **Alertas de fallo del cron:** No hay alerta cuando el orquestador o el upload worker fallan. Considerar agregar notificacion (push o email) cuando un job del cron falla N veces consecutivas.
2. **Patron fragil de `load_dotenv()`:** Todos los scripts usan `load_dotenv()` sin path explicito, delegando a `find_dotenv()` la busqueda. Esto es fragil — cualquier `.env` intermedio rompe todo. Considerar usar path explicito: `load_dotenv(os.path.join(project_root, '.env'))`.
3. **Test de smoke post-deploy:** No existe un script que verifique "todos los cron jobs pueden conectarse a la DB" despues de un cambio. Seria barato de implementar.

## Proximos pasos

- Manana 5 AM: verificar que el orquestador corre correctamente
- Evaluar si implementar las mejoras listadas arriba en la proxima sesion
