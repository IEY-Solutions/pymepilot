-- =============================================
-- PymePilot - Datos de Prueba (Development Only)
-- =============================================
-- DOBLE GUARD DE SEGURIDAD:
-- Guard 1: app.environment debe ser 'development'
-- Guard 2: tablas customers/orders deben estar VACIAS
-- AMBOS deben pasar. Si CUALQUIERA falla, se aborta.
-- =============================================

-- Guard 1: Verificar variable de entorno
DO $$
BEGIN
  IF current_setting('app.environment', true) IS DISTINCT FROM 'development' THEN
    RAISE EXCEPTION 'GUARD 1 FALLÓ: app.environment no es development. Valor: %',
      COALESCE(current_setting('app.environment', true), 'NO CONFIGURADO');
  END IF;
END $$;

-- Guard 2: Verificar que la base de datos esta vacia
DO $$
DECLARE
  customer_count INTEGER;
  order_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO customer_count FROM customers;
  SELECT COUNT(*) INTO order_count FROM orders;

  IF customer_count > 0 OR order_count > 0 THEN
    RAISE EXCEPTION 'GUARD 2 FALLÓ: La base de datos ya contiene datos reales (% clientes, % ordenes). El seed solo se puede ejecutar en una base de datos VACIA. Si esto es produccion, NO ejecutes este archivo.',
      customer_count, order_count;
  END IF;
END $$;

-- =============================================
-- Si llegamos aca, ambos guards pasaron.
-- Insertamos datos ficticios para desarrollo.
-- =============================================

-- Usar el tenant IEY existente
-- tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'

-- Setear tenant context para RLS
SELECT set_tenant_context('b815e5d6-2ef0-4d27-999b-8a7642b71183'::uuid);

-- 20 Clientes ficticios
INSERT INTO customers (tenant_id, external_id, name, email, phone, city) VALUES
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1001', 'Tech Store Buenos Aires', 'techstore@example.com', '11-5555-0001', 'CABA'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1002', 'MobilePlaza Cordoba', 'mobileplaza@example.com', '351-555-0002', 'Cordoba'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1003', 'Accesorios Sur', 'accsur@example.com', '11-5555-0003', 'Avellaneda'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1004', 'PhoneCase Rosario', 'phonecase@example.com', '341-555-0004', 'Rosario'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1005', 'Digital Mendoza', 'digital@example.com', '261-555-0005', 'Mendoza'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1006', 'Gadget Zone La Plata', 'gadgetzone@example.com', '221-555-0006', 'La Plata'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1007', 'MagSafe World', 'magsafe@example.com', '11-5555-0007', 'CABA'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1008', 'Distribuidora Norte', 'distnorte@example.com', '381-555-0008', 'Tucuman'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1009', 'Electro Litoral', 'electro@example.com', '342-555-0009', 'Santa Fe'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1010', 'CaseTech Mar del Plata', 'casetech@example.com', '223-555-0010', 'Mar del Plata'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1011', 'ProCase Neuquen', 'procase@example.com', '299-555-0011', 'Neuquen'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1012', 'AccesoriosMobile CABA', 'accmobile@example.com', '11-5555-0012', 'CABA'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1013', 'Funda Express', 'fundaexpress@example.com', '11-5555-0013', 'CABA'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1014', 'TechPoint Salta', 'techpoint@example.com', '387-555-0014', 'Salta'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1015', 'Smart Accesorios', 'smartacc@example.com', '11-5555-0015', 'CABA'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1016', 'PhoneShield Bahia Blanca', 'phoneshield@example.com', '291-555-0016', 'Bahia Blanca'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1017', 'CaseMasters', 'casemasters@example.com', '11-5555-0017', 'CABA'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1018', 'ProTech Resistencia', 'protech@example.com', '362-555-0018', 'Resistencia'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1019', 'MobileArg San Juan', 'mobilarg@example.com', '264-555-0019', 'San Juan'),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '1020', 'AccesoriosPro Parana', 'accpro@example.com', '343-555-0020', 'Parana');

-- 10 Productos ficticios (accesorios MagSafe)
INSERT INTO products (tenant_id, external_id, sku, name, category, price) VALUES
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '2001', 'MS-CASE-14', 'Funda MagSafe iPhone 14', 'Fundas', 15000),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '2002', 'MS-CASE-15', 'Funda MagSafe iPhone 15', 'Fundas', 18000),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '2003', 'MS-CASE-16', 'Funda MagSafe iPhone 16', 'Fundas', 22000),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '2004', 'MS-CHARGER', 'Cargador MagSafe', 'Cargadores', 25000),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '2005', 'MS-WALLET', 'Billetera MagSafe Cuero', 'Accesorios', 20000),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '2006', 'MS-STAND', 'Soporte MagSafe Escritorio', 'Soportes', 12000),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '2007', 'MS-MOUNT-CAR', 'Soporte MagSafe Auto', 'Soportes', 16000),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '2008', 'MS-BATTERY', 'Battery Pack MagSafe', 'Baterias', 30000),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '2009', 'MS-GRIP', 'PopGrip MagSafe', 'Accesorios', 8000),
('b815e5d6-2ef0-4d27-999b-8a7642b71183', '2010', 'MS-PROTECTOR', 'Vidrio Templado iPhone 15', 'Protectores', 5000);

-- Nota: No se generan ordenes ficticias porque requeririan IDs de customers
-- que se generan dinamicamente (UUIDs). Las ordenes se prueban con el sync real
-- o se agregan manualmente despues de verificar los IDs de customers insertados.

SELECT 'SEED COMPLETADO: 20 clientes + 10 productos insertados para desarrollo' AS resultado;
