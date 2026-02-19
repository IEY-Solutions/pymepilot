-- Rollback 001: Remove extensions
-- NOTA: Cuidado al ejecutar esto, puede afectar otras tablas que usen UUID
DROP EXTENSION IF EXISTS "pgcrypto";
DROP EXTENSION IF EXISTS "uuid-ossp";
