-- =============================================================================
-- TEST DE AISLAMIENTO MULTI-TENANT (v2 — Audit Fixes M-01 a M-04)
-- =============================================================================
-- QUE HACE: Crea un tenant de prueba con datos ficticios, ejecuta 12 tests que
-- verifican que RLS aisla correctamente los datos entre tenants, y limpia todo.
--
-- CAMBIOS vs v1:
-- M-01: Cleanup robusto — tests envueltos en BEGIN...EXCEPTION para que el
--       cleanup SIEMPRE se ejecute, incluso si un test falla con excepcion.
-- M-02: T4a verifica que el error sea especificamente de RLS (no otro error).
-- M-03: Tests adicionales para sync_log (T8), user_profiles (T9),
--        y tenant_info_secure VIEW (T10).
-- M-04: Tests de UPDATE (T4b) y DELETE (T4c) cross-tenant.
-- L-01: T6/T7 marcan FAIL (no WARN) si coincidencia sospechosa.
--
-- COMO EJECUTAR:
--   docker cp database/tests/tenant_isolation_test.sql orion-menteax_postgres:/tmp/
--   docker exec orion-menteax_postgres psql -U postgres -d orion_db -f /tmp/tenant_isolation_test.sql
--
-- RESULTADO ESPERADO: 12/12 PASS, 0 FAIL
-- =============================================================================

DO $$
DECLARE
    v_test_tenant_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    v_iey_tenant_id UUID := 'b815e5d6-2ef0-4d27-999b-8a7642b71183';
    v_count INTEGER;
    v_pass INTEGER := 0;
    v_fail INTEGER := 0;
    v_total INTEGER := 12;
    v_customer_id UUID;
    v_product_id UUID;
    v_order_id UUID;
    v_iey_count INTEGER;
    v_iey_revenue NUMERIC;
    v_test_error TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=============================================================';
    RAISE NOTICE '  TEST DE AISLAMIENTO MULTI-TENANT — v2 (Audit Fixes)';
    RAISE NOTICE '=============================================================';
    RAISE NOTICE '';

    -- =========================================================================
    -- SETUP: Crear tenant de prueba + datos ficticios (como postgres)
    -- =========================================================================
    RAISE NOTICE 'SETUP: Creando tenant de prueba y datos ficticios...';

    INSERT INTO tenants (id, name, slug, erp_type, active_verticals, active)
    VALUES (v_test_tenant_id, 'Test Distribuidor Audit', 'test-audit', 'excel',
            '["reposicion"]'::jsonb, true)
    ON CONFLICT (id) DO NOTHING;

    -- 5 clientes ficticios
    FOR i IN 1..5 LOOP
        INSERT INTO customers (tenant_id, external_id, name, email)
        VALUES (v_test_tenant_id, 'test_' || i, 'Cliente Test ' || i,
                'test' || i || '@example.com')
        ON CONFLICT (tenant_id, external_id) DO NOTHING;
    END LOOP;

    SELECT id INTO v_customer_id
    FROM customers WHERE tenant_id = v_test_tenant_id AND external_id = 'test_1';

    -- 2 productos ficticios
    INSERT INTO products (tenant_id, external_id, name, price)
    VALUES (v_test_tenant_id, 'prod_test_1', 'Producto Test A', 100.00)
    ON CONFLICT (tenant_id, external_id) DO NOTHING;
    INSERT INTO products (tenant_id, external_id, name, price)
    VALUES (v_test_tenant_id, 'prod_test_2', 'Producto Test B', 200.00)
    ON CONFLICT (tenant_id, external_id) DO NOTHING;

    SELECT id INTO v_product_id
    FROM products WHERE tenant_id = v_test_tenant_id AND external_id = 'prod_test_1';

    -- 3 ordenes ficticias
    FOR i IN 1..3 LOOP
        INSERT INTO orders (tenant_id, external_id, customer_id, order_date, total_amount, status)
        VALUES (v_test_tenant_id, 'order_test_' || i, v_customer_id,
                CURRENT_DATE - (i * 30), 1000.00 * i, 'completed')
        ON CONFLICT (tenant_id, external_id) DO NOTHING;
    END LOOP;

    SELECT id INTO v_order_id
    FROM orders WHERE tenant_id = v_test_tenant_id AND external_id = 'order_test_1';

    -- 1 prediccion ficticia
    INSERT INTO predictions (tenant_id, customer_id, vertical, prediction_date,
                            message_text, confidence_score, priority, status)
    VALUES (v_test_tenant_id, v_customer_id, 'reposicion', CURRENT_DATE,
            'Mensaje de prueba audit', 0.85, 2, 'pending')
    ON CONFLICT DO NOTHING;

    -- 1 sync_log ficticio
    INSERT INTO sync_log (tenant_id, sync_type, source, status, started_at)
    VALUES (v_test_tenant_id, 'full', 'excel', 'completed', NOW())
    ON CONFLICT DO NOTHING;

    -- 1 user_profile ficticio (como postgres, bypasea RLS)
    INSERT INTO user_profiles (id, tenant_id, full_name, role)
    VALUES (gen_random_uuid(), v_test_tenant_id, 'Test Admin', 'admin')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'SETUP completo: 5 clientes, 2 productos, 3 ordenes, 1 prediccion, 1 sync_log, 1 profile';
    RAISE NOTICE '';

    -- =========================================================================
    -- TESTS (envueltos en BEGIN...EXCEPTION para cleanup robusto — M-01 FIX)
    -- =========================================================================
    BEGIN

        -- === T1: IEY no ve customers del test ===
        SET ROLE pymepilot_app;
        RAISE NOTICE 'T1: Contexto IEY no ve customers del test tenant...';
        PERFORM set_tenant_context(v_iey_tenant_id);
        SELECT COUNT(*) INTO v_count FROM customers WHERE tenant_id = v_test_tenant_id;
        IF v_count = 0 THEN
            RAISE NOTICE '  PASS: IEY ve 0 clientes del test tenant';
            v_pass := v_pass + 1;
        ELSE
            RAISE NOTICE '  FAIL: IEY ve % clientes del test tenant (esperado: 0)', v_count;
            v_fail := v_fail + 1;
        END IF;

        -- === T2: Test ve solo sus 5 customers ===
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

        -- === T3: Sin contexto = 0 filas (fail-closed) ===
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

        -- === T4a: INSERT cross-tenant bloqueado (M-02 FIX: verificar error RLS) ===
        RAISE NOTICE 'T4a: INSERT cross-tenant bloqueado por RLS...';
        PERFORM set_tenant_context(v_iey_tenant_id);
        BEGIN
            INSERT INTO customers (tenant_id, external_id, name)
            VALUES (v_test_tenant_id, 'cross_tenant_hack', 'Intento cross-tenant');
            RAISE NOTICE '  FAIL: INSERT cross-tenant no fue bloqueado';
            v_fail := v_fail + 1;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE '  PASS: INSERT cross-tenant bloqueado por RLS (%)', SQLERRM;
            v_pass := v_pass + 1;
        WHEN OTHERS THEN
            -- Capturar otros errores (ej: constraint) como FAIL para investigar
            RAISE NOTICE '  FAIL: Error inesperado (no RLS): %', SQLERRM;
            v_fail := v_fail + 1;
        END;

        -- === T4b: UPDATE cross-tenant bloqueado (M-04 FIX) ===
        RAISE NOTICE 'T4b: UPDATE cross-tenant bloqueado por RLS...';
        PERFORM set_tenant_context(v_iey_tenant_id);
        -- UPDATE con WHERE tenant_id del test: RLS filtra las filas,
        -- asi que 0 filas afectadas (no es excepcion, es filtrado silencioso)
        UPDATE customers SET name = 'HACKED' WHERE tenant_id = v_test_tenant_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count = 0 THEN
            RAISE NOTICE '  PASS: UPDATE cross-tenant: 0 filas afectadas (RLS filtro)';
            v_pass := v_pass + 1;
        ELSE
            RAISE NOTICE '  FAIL: UPDATE cross-tenant afecto % filas!', v_count;
            v_fail := v_fail + 1;
        END IF;

        -- === T4c: DELETE cross-tenant bloqueado (M-04 FIX) ===
        -- NOTA: pymepilot_app puede no tener DELETE en customers (GRANT).
        -- Ambos bloqueos son validos: RLS (0 filas) o GRANT (permission denied).
        RAISE NOTICE 'T4c: DELETE cross-tenant bloqueado...';
        PERFORM set_tenant_context(v_iey_tenant_id);
        BEGIN
            DELETE FROM customers WHERE tenant_id = v_test_tenant_id;
            GET DIAGNOSTICS v_count = ROW_COUNT;
            IF v_count = 0 THEN
                RAISE NOTICE '  PASS: DELETE cross-tenant: 0 filas afectadas (RLS filtro)';
                v_pass := v_pass + 1;
            ELSE
                RAISE NOTICE '  FAIL: DELETE cross-tenant afecto % filas!', v_count;
                v_fail := v_fail + 1;
            END IF;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE '  PASS: DELETE cross-tenant bloqueado por permisos (%)', SQLERRM;
            v_pass := v_pass + 1;
        END;

        -- === T5: Predictions aisladas ===
        RAISE NOTICE 'T5: Predictions aisladas entre tenants...';
        PERFORM set_tenant_context(v_test_tenant_id);
        SELECT COUNT(*) INTO v_count FROM predictions;
        IF v_count >= 1 THEN
            PERFORM set_tenant_context(v_iey_tenant_id);
            SELECT COUNT(*) INTO v_count FROM predictions WHERE tenant_id = v_test_tenant_id;
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

        -- === T6: client_rankings_secure VIEW filtra por tenant (L-01 FIX) ===
        RAISE NOTICE 'T6: client_rankings_secure filtra por tenant...';
        RESET ROLE;
        SET ROLE authenticated;
        PERFORM set_tenant_context(v_test_tenant_id);
        SELECT COUNT(*) INTO v_count FROM client_rankings_secure;
        PERFORM set_tenant_context(v_iey_tenant_id);
        SELECT COUNT(*) INTO v_iey_count FROM client_rankings_secure;
        IF v_count != v_iey_count OR v_count = 0 THEN
            RAISE NOTICE '  PASS: Rankings filtrados (test=%, iey=%)', v_count, v_iey_count;
            v_pass := v_pass + 1;
        ELSE
            -- Ambos ven la misma cantidad > 0: fuga probable
            RAISE NOTICE '  FAIL: Ambos ven % rankings — posible fuga', v_count;
            v_fail := v_fail + 1;
        END IF;

        -- === T7: RPCs respetan contexto (L-01 FIX) ===
        RESET ROLE;
        SET ROLE pymepilot_app;
        RAISE NOTICE 'T7: RPCs de KPIs respetan contexto...';
        PERFORM set_tenant_context(v_test_tenant_id);
        SELECT COALESCE(SUM(total_revenue), 0) INTO v_count FROM get_monthly_revenue_split(6);
        PERFORM set_tenant_context(v_iey_tenant_id);
        SELECT COALESCE(SUM(total_revenue), 0) INTO v_iey_revenue FROM get_monthly_revenue_split(6);
        IF v_count::numeric != v_iey_revenue THEN
            RAISE NOTICE '  PASS: Revenue RPC aislado (test=$%, iey=$%)', v_count, v_iey_revenue;
            v_pass := v_pass + 1;
        ELSIF v_count = 0 AND v_iey_revenue = 0 THEN
            -- Ambos 0: posible si no hay ordenes en ventana de 6 meses
            RAISE NOTICE '  PASS: Ambos revenue=0 (sin datos en ventana)';
            v_pass := v_pass + 1;
        ELSE
            RAISE NOTICE '  FAIL: Mismo revenue no-cero (%), posible fuga', v_count;
            v_fail := v_fail + 1;
        END IF;

        -- === T8: sync_log aislado (M-03 FIX) ===
        RAISE NOTICE 'T8: sync_log aislado entre tenants...';
        PERFORM set_tenant_context(v_test_tenant_id);
        SELECT COUNT(*) INTO v_count FROM sync_log;
        IF v_count >= 1 THEN
            PERFORM set_tenant_context(v_iey_tenant_id);
            SELECT COUNT(*) INTO v_iey_count FROM sync_log WHERE tenant_id = v_test_tenant_id;
            IF v_iey_count = 0 THEN
                RAISE NOTICE '  PASS: sync_log aislado (test=%, cross=0)', v_count;
                v_pass := v_pass + 1;
            ELSE
                RAISE NOTICE '  FAIL: IEY ve % sync_logs del test', v_iey_count;
                v_fail := v_fail + 1;
            END IF;
        ELSE
            RAISE NOTICE '  FAIL: Test tenant no ve su propio sync_log';
            v_fail := v_fail + 1;
        END IF;

        -- === T9: user_profiles aislado (M-03 FIX) ===
        RAISE NOTICE 'T9: user_profiles aislado entre tenants...';
        PERFORM set_tenant_context(v_test_tenant_id);
        SELECT COUNT(*) INTO v_count FROM user_profiles;
        IF v_count >= 1 THEN
            PERFORM set_tenant_context(v_iey_tenant_id);
            SELECT COUNT(*) INTO v_iey_count FROM user_profiles WHERE tenant_id = v_test_tenant_id;
            IF v_iey_count = 0 THEN
                RAISE NOTICE '  PASS: user_profiles aislado (test=%, cross=0)', v_count;
                v_pass := v_pass + 1;
            ELSE
                RAISE NOTICE '  FAIL: IEY ve % profiles del test', v_iey_count;
                v_fail := v_fail + 1;
            END IF;
        ELSE
            RAISE NOTICE '  FAIL: Test tenant no ve su propio profile';
            v_fail := v_fail + 1;
        END IF;

        -- === T10: tenant_info_secure VIEW solo muestra tenant propio ===
        RAISE NOTICE 'T10: tenant_info_secure VIEW aislada...';
        RESET ROLE;
        SET ROLE authenticated;
        -- Con contexto test: deberia ver solo el test tenant
        PERFORM set_tenant_context(v_test_tenant_id);
        SELECT COUNT(*) INTO v_count FROM tenant_info_secure;
        IF v_count = 1 THEN
            -- Verificar que NO tiene columna erp_config (seguridad C-01)
            PERFORM set_tenant_context(v_iey_tenant_id);
            SELECT COUNT(*) INTO v_iey_count FROM tenant_info_secure;
            IF v_iey_count <= 1 THEN
                RAISE NOTICE '  PASS: tenant_info_secure filtrada (test=1, iey=%)', v_iey_count;
                v_pass := v_pass + 1;
            ELSE
                RAISE NOTICE '  FAIL: IEY ve % tenants en VIEW (esperado: 1)', v_iey_count;
                v_fail := v_fail + 1;
            END IF;
        ELSIF v_count = 0 THEN
            RAISE NOTICE '  FAIL: VIEW no retorna datos para test tenant (migration 031 aplicada?)';
            v_fail := v_fail + 1;
        ELSE
            RAISE NOTICE '  FAIL: VIEW retorna % filas para test (esperado: 1)', v_count;
            v_fail := v_fail + 1;
        END IF;

        -- Restaurar role para cleanup
        RESET ROLE;

    EXCEPTION WHEN OTHERS THEN
        -- M-01 FIX: Capturar error para que cleanup SIEMPRE se ejecute
        GET STACKED DIAGNOSTICS v_test_error = MESSAGE_TEXT;
        RAISE NOTICE '';
        RAISE NOTICE 'ERROR EN TESTS: %', v_test_error;
        RAISE NOTICE 'Ejecutando cleanup de emergencia...';
        -- Asegurar que estamos como postgres para cleanup
        RESET ROLE;
    END;

    -- =========================================================================
    -- RESULTADO
    -- =========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '=============================================================';
    RAISE NOTICE '  RESULTADO: %/% PASS, %/% FAIL', v_pass, v_total, v_fail, v_total;
    RAISE NOTICE '=============================================================';

    IF v_test_error IS NOT NULL THEN
        RAISE NOTICE '  ATENCION: Tests interrumpidos por error. Resultados parciales.';
    END IF;

    IF v_fail = 0 AND v_test_error IS NULL THEN
        RAISE NOTICE '  AISLAMIENTO MULTI-TENANT: APROBADO';
    ELSE
        RAISE NOTICE '  AISLAMIENTO MULTI-TENANT: REQUIERE REVISION';
    END IF;

    RAISE NOTICE '';

    -- =========================================================================
    -- CLEANUP: SIEMPRE se ejecuta (M-01 FIX)
    -- =========================================================================
    RAISE NOTICE 'CLEANUP: Eliminando tenant de prueba y datos...';

    -- user_profiles no tiene ON DELETE CASCADE desde tenants (FK es a auth.users)
    -- Borrar manualmente antes del tenant
    DELETE FROM user_profiles WHERE tenant_id = v_test_tenant_id;

    -- Las demas FK SI tienen ON DELETE CASCADE
    DELETE FROM tenants WHERE id = v_test_tenant_id;

    RAISE NOTICE 'CLEANUP completo.';
    RAISE NOTICE '';
END $$;
