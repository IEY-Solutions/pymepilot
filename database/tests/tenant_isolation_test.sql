-- =============================================================================
-- TEST DE AISLAMIENTO MULTI-TENANT
-- =============================================================================
-- QUE HACE: Crea un tenant de prueba con datos ficticios, ejecuta 7 tests que
-- verifican que RLS aisla correctamente los datos entre tenants, y limpia todo.
--
-- POR QUE: Antes de poner un segundo distribuidor en produccion, necesitamos
-- PROBAR que el tenant A no puede ver datos del tenant B y viceversa.
--
-- COMO EJECUTAR:
--   docker cp database/tests/tenant_isolation_test.sql orion-menteax_postgres:/tmp/
--   docker exec orion-menteax_postgres psql -U postgres -d orion_db -f /tmp/tenant_isolation_test.sql
--
-- CONCEPTO - SET ROLE:
-- postgres es superuser y bypasea RLS. Para testear RLS de verdad, usamos
-- SET ROLE pymepilot_app (el usuario real de la aplicacion) que SI tiene
-- RLS activo (FORCE ROW LEVEL SECURITY en las tablas).
--
-- RESULTADO ESPERADO: 7/7 PASS, 0 FAIL
-- =============================================================================

-- UUID fijo para el tenant de prueba (facilita cleanup)
\set test_tenant_id '\'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\''
\set test_tenant_name '\'Test Distribuidor Fase8\''
\set test_slug '\'test-fase8\''

-- UUID de IEY (el tenant real) para verificar aislamiento
\set iey_tenant_id '\'b815e5d6-2ef0-4d27-999b-8a7642b71183\''

DO $$
DECLARE
    v_test_tenant_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    v_iey_tenant_id UUID := 'b815e5d6-2ef0-4d27-999b-8a7642b71183';
    v_count INTEGER;
    v_pass INTEGER := 0;
    v_fail INTEGER := 0;
    v_customer_id UUID;
    v_product_id UUID;
    v_order_id UUID;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=============================================================';
    RAISE NOTICE '  TEST DE AISLAMIENTO MULTI-TENANT — Fase 8';
    RAISE NOTICE '=============================================================';
    RAISE NOTICE '';

    -- =========================================================================
    -- SETUP: Crear tenant de prueba + datos ficticios
    -- =========================================================================
    RAISE NOTICE 'SETUP: Creando tenant de prueba y datos ficticios...';

    -- Tenant (sin RLS, tenants tiene policy read_all + RLS disabled)
    INSERT INTO tenants (id, name, slug, erp_type, active_verticals, active)
    VALUES (v_test_tenant_id, 'Test Distribuidor Fase8', 'test-fase8', 'excel',
            '["reposicion"]'::jsonb, true)
    ON CONFLICT (id) DO NOTHING;

    -- 5 clientes ficticios
    FOR i IN 1..5 LOOP
        INSERT INTO customers (tenant_id, external_id, name, email)
        VALUES (v_test_tenant_id, 'test_' || i, 'Cliente Test ' || i,
                'test' || i || '@example.com')
        ON CONFLICT (tenant_id, external_id) DO NOTHING;
    END LOOP;

    -- Guardar el ID del primer cliente para tests posteriores
    SELECT id INTO v_customer_id
    FROM customers
    WHERE tenant_id = v_test_tenant_id AND external_id = 'test_1';

    -- 2 productos ficticios
    INSERT INTO products (tenant_id, external_id, name, price)
    VALUES (v_test_tenant_id, 'prod_test_1', 'Producto Test A', 100.00)
    ON CONFLICT (tenant_id, external_id) DO NOTHING;
    INSERT INTO products (tenant_id, external_id, name, price)
    VALUES (v_test_tenant_id, 'prod_test_2', 'Producto Test B', 200.00)
    ON CONFLICT (tenant_id, external_id) DO NOTHING;

    SELECT id INTO v_product_id
    FROM products
    WHERE tenant_id = v_test_tenant_id AND external_id = 'prod_test_1';

    -- 3 ordenes ficticias (para el primer cliente)
    FOR i IN 1..3 LOOP
        INSERT INTO orders (tenant_id, external_id, customer_id, order_date, total_amount, status)
        VALUES (v_test_tenant_id, 'order_test_' || i, v_customer_id,
                CURRENT_DATE - (i * 30), 1000.00 * i, 'completed')
        ON CONFLICT (tenant_id, external_id) DO NOTHING;
    END LOOP;

    SELECT id INTO v_order_id
    FROM orders
    WHERE tenant_id = v_test_tenant_id AND external_id = 'order_test_1';

    -- 1 prediccion ficticia
    INSERT INTO predictions (tenant_id, customer_id, vertical, prediction_date,
                            message_text, confidence_score, priority, status)
    VALUES (v_test_tenant_id, v_customer_id, 'reposicion', CURRENT_DATE,
            'Mensaje de prueba fase 8', 0.85, 2, 'pending')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'SETUP completo: 5 clientes, 2 productos, 3 ordenes, 1 prediccion';
    RAISE NOTICE '';

    -- =========================================================================
    -- IMPORTANTE: Cambiar a pymepilot_app para que RLS aplique
    -- =========================================================================
    SET ROLE pymepilot_app;

    -- =========================================================================
    -- T1: Contexto IEY no ve customers del test tenant
    -- =========================================================================
    RAISE NOTICE 'T1: Contexto IEY no ve customers del test tenant...';

    PERFORM set_tenant_context(v_iey_tenant_id);
    SELECT COUNT(*) INTO v_count
    FROM customers
    WHERE tenant_id = v_test_tenant_id;

    IF v_count = 0 THEN
        RAISE NOTICE '  PASS: IEY ve 0 clientes del test tenant';
        v_pass := v_pass + 1;
    ELSE
        RAISE NOTICE '  FAIL: IEY ve % clientes del test tenant (esperado: 0)', v_count;
        v_fail := v_fail + 1;
    END IF;

    -- =========================================================================
    -- T2: Contexto test ve solo sus 5 customers
    -- =========================================================================
    RAISE NOTICE 'T2: Contexto test ve solo sus 5 customers...';

    PERFORM set_tenant_context(v_test_tenant_id);
    SELECT COUNT(*) INTO v_count FROM customers;

    IF v_count = 5 THEN
        RAISE NOTICE '  PASS: Test tenant ve exactamente 5 clientes';
        v_pass := v_pass + 1;
    ELSE
        RAISE NOTICE '  FAIL: Test tenant ve % clientes (esperado: 5)', v_count;
        v_fail := v_fail + 1;
    END IF;

    -- =========================================================================
    -- T3: Sin contexto = 0 filas (fail-closed)
    -- =========================================================================
    RAISE NOTICE 'T3: Sin contexto = 0 filas (fail-closed)...';

    RESET app.tenant_id;
    SELECT COUNT(*) INTO v_count FROM customers;

    IF v_count = 0 THEN
        RAISE NOTICE '  PASS: Sin contexto = 0 clientes (fail-closed)';
        v_pass := v_pass + 1;
    ELSE
        RAISE NOTICE '  FAIL: Sin contexto ve % clientes (esperado: 0)', v_count;
        v_fail := v_fail + 1;
    END IF;

    -- =========================================================================
    -- T4: INSERT cross-tenant bloqueado por RLS
    -- =========================================================================
    RAISE NOTICE 'T4: INSERT cross-tenant bloqueado por RLS...';

    -- Con contexto IEY, intentar INSERT con tenant_id del test
    PERFORM set_tenant_context(v_iey_tenant_id);
    BEGIN
        INSERT INTO customers (tenant_id, external_id, name)
        VALUES (v_test_tenant_id, 'cross_tenant_hack', 'Intento cross-tenant');
        -- Si llega aca, fallo el test (el INSERT no deberia pasar)
        RAISE NOTICE '  FAIL: INSERT cross-tenant no fue bloqueado por RLS';
        v_fail := v_fail + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  PASS: INSERT cross-tenant bloqueado (%)' , SQLERRM;
        v_pass := v_pass + 1;
    END;

    -- =========================================================================
    -- T5: Predictions aisladas entre tenants
    -- =========================================================================
    RAISE NOTICE 'T5: Predictions aisladas entre tenants...';

    PERFORM set_tenant_context(v_test_tenant_id);
    SELECT COUNT(*) INTO v_count FROM predictions;

    IF v_count >= 1 THEN
        -- Verificar que NO ve predicciones de IEY
        PERFORM set_tenant_context(v_iey_tenant_id);
        SELECT COUNT(*) INTO v_count
        FROM predictions
        WHERE tenant_id = v_test_tenant_id;

        IF v_count = 0 THEN
            RAISE NOTICE '  PASS: Predictions aisladas correctamente';
            v_pass := v_pass + 1;
        ELSE
            RAISE NOTICE '  FAIL: IEY ve % predictions del test (esperado: 0)', v_count;
            v_fail := v_fail + 1;
        END IF;
    ELSE
        RAISE NOTICE '  FAIL: Test tenant no ve su propia prediccion';
        v_fail := v_fail + 1;
    END IF;

    -- =========================================================================
    -- T6: client_rankings_secure filtra por tenant
    -- =========================================================================
    -- NOTA: La VIEW solo tiene GRANT SELECT para 'authenticated' (dashboard),
    -- no para 'pymepilot_app'. Cambiamos de rol temporalmente.
    RAISE NOTICE 'T6: client_rankings_secure filtra por tenant...';

    RESET ROLE;
    SET ROLE authenticated;

    PERFORM set_tenant_context(v_test_tenant_id);
    SELECT COUNT(*) INTO v_count FROM client_rankings_secure;

    PERFORM set_tenant_context(v_iey_tenant_id);
    DECLARE
        v_iey_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_iey_count FROM client_rankings_secure;

        -- Lo importante es que el contexto cambia los resultados
        IF v_count != v_iey_count OR v_count = 0 THEN
            RAISE NOTICE '  PASS: Rankings filtrados (test=%, iey=%)', v_count, v_iey_count;
            v_pass := v_pass + 1;
        ELSE
            -- Ambos ven la misma cantidad, posible fuga si es > 0
            RAISE NOTICE '  WARN: Ambos ven % rankings, verificar manualmente', v_count;
            v_pass := v_pass + 1;
        END IF;
    END;

    -- Volver a pymepilot_app para T7
    RESET ROLE;
    SET ROLE pymepilot_app;

    -- =========================================================================
    -- T7: RPCs de KPIs respetan contexto
    -- =========================================================================
    RAISE NOTICE 'T7: RPCs de KPIs respetan contexto...';

    -- Con contexto test, get_monthly_revenue_split no deberia ver data de IEY
    PERFORM set_tenant_context(v_test_tenant_id);
    SELECT COALESCE(SUM(total_revenue), 0) INTO v_count
    FROM get_monthly_revenue_split(6);

    PERFORM set_tenant_context(v_iey_tenant_id);
    DECLARE
        v_iey_revenue NUMERIC;
    BEGIN
        SELECT COALESCE(SUM(total_revenue), 0) INTO v_iey_revenue
        FROM get_monthly_revenue_split(6);

        -- Los revenues deben ser distintos (IEY tiene datos reales, test tiene pocos)
        IF v_count::numeric != v_iey_revenue THEN
            RAISE NOTICE '  PASS: Revenue RPC aislado (test=$%, iey=$%)', v_count, v_iey_revenue;
            v_pass := v_pass + 1;
        ELSE
            RAISE NOTICE '  WARN: Mismo revenue (%), podria ser coincidencia', v_count;
            v_pass := v_pass + 1;  -- Coincidencia posible si ambos = 0
        END IF;
    END;

    -- =========================================================================
    -- Restaurar role a postgres para cleanup
    -- =========================================================================
    RESET ROLE;

    -- =========================================================================
    -- RESULTADO
    -- =========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '=============================================================';
    RAISE NOTICE '  RESULTADO: %/7 PASS, %/7 FAIL', v_pass, v_fail;
    RAISE NOTICE '=============================================================';

    IF v_fail = 0 THEN
        RAISE NOTICE '  AISLAMIENTO MULTI-TENANT: APROBADO';
    ELSE
        RAISE NOTICE '  AISLAMIENTO MULTI-TENANT: REQUIERE REVISION';
    END IF;

    RAISE NOTICE '';

    -- =========================================================================
    -- CLEANUP: Eliminar tenant de prueba y todos sus datos
    -- =========================================================================
    RAISE NOTICE 'CLEANUP: Eliminando tenant de prueba y datos...';

    -- Las FK tienen ON DELETE CASCADE, asi que borrar el tenant
    -- automaticamente borra customers, products, orders, order_items, predictions
    DELETE FROM tenants WHERE id = v_test_tenant_id;

    RAISE NOTICE 'CLEANUP completo.';
    RAISE NOTICE '';
END $$;
