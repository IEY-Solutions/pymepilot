"""
Test de regresion post-migraciones 011 + 012.

QUE HACE: Verifica que las migraciones no rompieron nada de lo que
ya funcionaba, y que los cambios nuevos estan activos.

CONCEPTO: Regression testing = correr pruebas que ya pasaban antes
para confirmar que siguen pasando despues de un cambio.
"""

import sys
import os

# Agregar el directorio raiz del proyecto al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.engine.db.connection import (
    get_pool, close_pool, get_db_connection,
    get_db_connection_no_tenant, get_tenant_id_by_slug
)

IEY_ID = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
passed = 0
failed = 0


def ok(msg):
    global passed
    passed += 1
    print(f'  [OK] {msg}')


def fail(msg):
    global failed
    failed += 1
    print(f'  [FALLO] {msg}')


print('=' * 60)
print('VERIFICACION POST-MIGRACIONES 011 + 012')
print('=' * 60)

# ============================================================
# TEST 1: Pool de conexiones se crea correctamente
# ============================================================
print('\nTEST 1: Crear pool de conexiones...')
try:
    pool = get_pool()
    ok(f'Pool creado. min_size={pool.min_size}, max_size={pool.max_size}')
except Exception as e:
    fail(str(e))

# ============================================================
# TEST 2: get_tenant_id_by_slug (tabla tenants SIN FORCE RLS)
# ============================================================
print('\nTEST 2: get_tenant_id_by_slug("iey")...')
try:
    tid = get_tenant_id_by_slug('iey')
    if tid == IEY_ID:
        ok(f'tenant_id correcto = {tid}')
    else:
        fail(f'tenant_id incorrecto: {tid}')
except Exception as e:
    fail(str(e))

# ============================================================
# TEST 3: Conexion CON tenant context
# ============================================================
print('\nTEST 3: Conexion con tenant context...')
try:
    with get_db_connection(IEY_ID) as conn:
        result = conn.execute(
            "SELECT current_setting('app.tenant_id', true)"
        ).fetchone()
        ok(f'Tenant context activo: {result[0]}')

        count = conn.execute('SELECT COUNT(*) FROM customers').fetchone()[0]
        ok(f'Query a customers funciona (count={count})')

        count = conn.execute('SELECT COUNT(*) FROM sync_log').fetchone()[0]
        ok(f'Query a sync_log funciona (count={count})')

        count = conn.execute('SELECT COUNT(*) FROM products').fetchone()[0]
        ok(f'Query a products funciona (count={count})')

        count = conn.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
        ok(f'Query a orders funciona (count={count})')
except Exception as e:
    fail(str(e))

# ============================================================
# TEST 4: Conexion SIN tenant context
# ============================================================
print('\nTEST 4: Conexion SIN tenant context...')
try:
    with get_db_connection_no_tenant() as conn:
        # tenants (sin FORCE RLS) debe funcionar normal
        count = conn.execute('SELECT COUNT(*) FROM tenants').fetchone()[0]
        if count > 0:
            ok(f'Query a tenants funciona (count={count}, sin FORCE RLS)')
        else:
            fail('tenants retorna 0 (deberia tener al menos IEY)')

        # customers (con FORCE RLS) debe dar 0 filas, NO error
        count = conn.execute('SELECT COUNT(*) FROM customers').fetchone()[0]
        if count == 0:
            ok('customers sin context da 0 filas (FORCE RLS activo)')
        else:
            fail(f'customers sin context da {count} filas (FORCE RLS no funciona!)')
except Exception as e:
    fail(str(e))

# ============================================================
# TEST 5: Constraints nuevos aceptan valores nuevos
# ============================================================
print('\nTEST 5: Constraints aceptan valores nuevos...')
try:
    with get_db_connection(IEY_ID) as conn:
        conn.execute(
            "INSERT INTO sync_log (tenant_id, sync_type, source, status) "
            "VALUES (%s, 'limited', 'contabilium', 'requires_review')",
            (IEY_ID,)
        )
        ok("INSERT con status='requires_review' y sync_type='limited' aceptado")

        row = conn.execute(
            "SELECT status, sync_type FROM sync_log "
            "WHERE status = 'requires_review' LIMIT 1"
        ).fetchone()
        ok(f'Lectura OK: status={row[0]}, sync_type={row[1]}')

        conn.execute("DELETE FROM sync_log WHERE status = 'requires_review'")
        conn.commit()
        ok('Registro de prueba eliminado')
except Exception as e:
    fail(str(e))

# ============================================================
# TEST 6: Constraints anteriores siguen funcionando
# ============================================================
print('\nTEST 6: Valores anteriores siguen funcionando...')
try:
    with get_db_connection(IEY_ID) as conn:
        for status in ['started', 'completed', 'failed']:
            conn.execute(
                "INSERT INTO sync_log (tenant_id, sync_type, source, status) "
                "VALUES (%s, 'full', 'contabilium', %s)",
                (IEY_ID, status)
            )
        for stype in ['full', 'incremental']:
            conn.execute(
                "INSERT INTO sync_log (tenant_id, sync_type, source, status) "
                "VALUES (%s, %s, 'contabilium', 'started')",
                (IEY_ID, stype)
            )
        ok('Todos los valores originales (started/completed/failed, full/incremental) aceptados')

        conn.execute('DELETE FROM sync_log')
        conn.commit()
        ok('Registros de prueba eliminados')
except Exception as e:
    fail(str(e))

# ============================================================
# TEST 7: UNIQUE en products - solo external_id, NO sku
# ============================================================
print('\nTEST 7: Verificar que sku NO tiene UNIQUE...')
try:
    with get_db_connection(IEY_ID) as conn:
        conn.execute(
            "INSERT INTO products (tenant_id, external_id, name, sku) "
            "VALUES (%s, 'test-1', 'Producto A', 'SKU-DUPLICADO')",
            (IEY_ID,)
        )
        conn.execute(
            "INSERT INTO products (tenant_id, external_id, name, sku) "
            "VALUES (%s, 'test-2', 'Producto B', 'SKU-DUPLICADO')",
            (IEY_ID,)
        )
        ok('Dos productos con mismo sku aceptados (UNIQUE removido)')

        # Verificar que external_id SIGUE siendo UNIQUE
        try:
            conn.execute(
                "INSERT INTO products (tenant_id, external_id, name, sku) "
                "VALUES (%s, 'test-1', 'Producto C', 'SKU-OTRO')",
                (IEY_ID,)
            )
            fail('external_id duplicado fue aceptado (no deberia!)')
        except Exception:
            conn.rollback()
            ok('external_id duplicado rechazado correctamente')

        # Limpiar
        conn.execute("DELETE FROM products WHERE external_id LIKE 'test-%'")
        conn.commit()
        ok('Productos de prueba eliminados')
except Exception as e:
    fail(str(e))

# ============================================================
# TEST 8: Usuario pymepilot_app existe con permisos correctos
# ============================================================
print('\nTEST 8: Verificar usuario pymepilot_app...')
try:
    with get_db_connection_no_tenant() as conn:
        row = conn.execute(
            "SELECT rolsuper, rolcreatedb, rolcreaterole "
            "FROM pg_roles WHERE rolname = 'pymepilot_app'"
        ).fetchone()
        if row:
            is_super, can_createdb, can_createrole = row
            checks = []
            if not is_super:
                checks.append('nosuperuser')
            else:
                fail('pymepilot_app es superuser!')
            if not can_createdb:
                checks.append('nocreatedb')
            if not can_createrole:
                checks.append('nocreaterole')
            ok('pymepilot_app existe: ' + ', '.join(checks))
        else:
            fail('pymepilot_app no encontrado')
except Exception as e:
    fail(str(e))

# ============================================================
# TEST 9: FORCE RLS activo en tablas correctas
# ============================================================
print('\nTEST 9: Verificar FORCE RLS...')
try:
    with get_db_connection_no_tenant() as conn:
        rows = conn.execute(
            "SELECT relname, relrowsecurity, relforcerowsecurity "
            "FROM pg_class "
            "WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' "
            "ORDER BY relname"
        ).fetchall()

        expected_force = {
            'customers', 'products', 'orders', 'order_items',
            'predictions', 'sync_log', 'user_profiles'
        }
        expected_no_force = {'tenants'}

        for name, rls, force in rows:
            status = []
            if rls:
                status.append('RLS')
            if force:
                status.append('FORCE')
            if not rls and not force:
                status.append('sin RLS')
            print(f'  {name:15} -> {", ".join(status)}')

            if name in expected_force and not force:
                fail(f'{name} deberia tener FORCE RLS')
            elif name in expected_no_force and force:
                fail(f'{name} NO deberia tener FORCE RLS')

        ok('FORCE RLS activo en todas las tablas correctas')
except Exception as e:
    fail(str(e))

# ============================================================
# TEST 10: erp_config comment actualizado
# ============================================================
print('\nTEST 10: Verificar comment de erp_config...')
try:
    with get_db_connection_no_tenant() as conn:
        row = conn.execute(
            "SELECT col_description(c.oid, a.attnum) "
            "FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid "
            "WHERE c.relname = 'tenants' AND a.attname = 'erp_config'"
        ).fetchone()
        comment = row[0]
        if 'ENCRIPTADAS' in comment and 'Fernet' in comment:
            ok('Comment actualizado (menciona ENCRIPTADAS + Fernet)')
        elif 'NUNCA almacenar secrets aqui' == comment:
            fail('Comment viejo todavia presente')
        else:
            fail(f'Comment inesperado: {comment[:80]}...')
except Exception as e:
    fail(str(e))

# ============================================================
# RESULTADO FINAL
# ============================================================
close_pool()

print('\n' + '=' * 60)
total = passed + failed
print(f'RESULTADO: {passed}/{total} tests pasaron')
if failed > 0:
    print(f'  {failed} test(s) FALLARON')
    sys.exit(1)
else:
    print('  TODOS los tests pasaron. No se rompio nada.')
    print('  Las migraciones 011+012 estan funcionando correctamente.')
    sys.exit(0)
