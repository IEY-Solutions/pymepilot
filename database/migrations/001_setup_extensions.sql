-- Migration 001: Setup PostgreSQL Extensions
-- Fecha: 2026-02-19
-- Descripcion: Habilita extensiones necesarias para el proyecto
--
-- QUE SON LAS EXTENSIONES:
-- PostgreSQL tiene funcionalidades "extra" que vienen desactivadas por defecto.
-- Las extensiones son como "plugins" que agregan capacidades.
-- uuid-ossp y pgcrypto nos permiten generar IDs unicos (UUID) de forma segura.

-- uuid-ossp: Genera UUIDs (identificadores unicos universales)
-- Los usamos como ID de cada registro en vez de numeros secuenciales (1, 2, 3...)
-- Ventaja: Son unicos globalmente, no predecibles, y funcionan bien en multi-tenant
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgcrypto: Funciones de encriptacion y generacion aleatoria
-- Nos da gen_random_uuid() que es mas seguro que uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
