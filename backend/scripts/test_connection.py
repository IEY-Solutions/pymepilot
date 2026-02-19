"""
Script de prueba para verificar que la conexion a PostgreSQL funciona.

COMO EJECUTAR:
    cd ~/projects/pymepilot/backend
    source venv/bin/activate
    python scripts/test_connection.py

QUE HACE:
1. Se conecta a PostgreSQL
2. Verifica que las tablas existen
3. Busca el tenant IEY
4. Configura el tenant context
5. Hace una query de prueba

Si todo imprime OK, la conexion esta funcionando correctamente.
"""

import sys
import os

# Agregar el directorio padre al path para poder importar nuestros modulos
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.db.connection import (
    get_pool,
    get_db_connection,
    get_db_connection_no_tenant,
    get_tenant_id_by_slug,
    close_pool,
)


def main():
    print("=" * 50)
    print("PymePilot - Test de Conexion a PostgreSQL")
    print("=" * 50)

    # Test 1: Conexion basica
    print("\n[1/5] Probando conexion basica...")
    try:
        pool = get_pool()
        print("  OK - Pool de conexiones creado")
    except Exception as e:
        print(f"  FALLO - {e}")
        return

    # Test 2: Verificar tablas
    print("\n[2/5] Verificando tablas...")
    try:
        with get_db_connection_no_tenant() as conn:
            result = conn.execute("""
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public'
                AND tablename IN ('tenants', 'customers', 'products', 'orders',
                                  'order_items', 'predictions', 'sync_log', 'user_profiles')
                ORDER BY tablename
            """).fetchall()

            tables = [row[0] for row in result]
            print(f"  OK - {len(tables)} tablas encontradas: {', '.join(tables)}")

            if len(tables) < 8:
                print("  ADVERTENCIA: Faltan tablas. Ejecutar migraciones primero.")
    except Exception as e:
        print(f"  FALLO - {e}")
        return

    # Test 3: Buscar tenant IEY
    print("\n[3/5] Buscando tenant IEY...")
    try:
        tenant_id = get_tenant_id_by_slug("iey")
        print(f"  OK - Tenant IEY encontrado (ID: {tenant_id})")
    except ValueError as e:
        print(f"  FALLO - {e}")
        print("  Ejecutar: INSERT INTO tenants (...) VALUES (...) primero")
        return

    # Test 4: Conexion con tenant context
    print("\n[4/5] Probando conexion con tenant context...")
    try:
        with get_db_connection(tenant_id) as conn:
            result = conn.execute(
                "SELECT current_setting('app.tenant_id')"
            ).fetchone()
            print(f"  OK - Tenant context configurado: {result[0]}")
    except Exception as e:
        print(f"  FALLO - {e}")
        return

    # Test 5: Query de conteo
    print("\n[5/5] Contando registros (todo deberia estar en 0)...")
    try:
        with get_db_connection(tenant_id) as conn:
            for table in ["customers", "products", "orders", "predictions"]:
                # Nota: con RLS activo, solo cuenta registros de este tenant
                result = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
                print(f"  {table}: {result[0]} registros")
    except Exception as e:
        print(f"  FALLO - {e}")
        return

    # Cleanup
    close_pool()

    print("\n" + "=" * 50)
    print("RESULTADO: Todos los tests pasaron correctamente!")
    print("La conexion a PostgreSQL esta funcionando.")
    print("=" * 50)


if __name__ == "__main__":
    main()
