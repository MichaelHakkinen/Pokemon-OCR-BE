-- Initialize PostgreSQL Extensions for Pokemon OCR
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Verification notice
DO $$
BEGIN
    RAISE NOTICE 'Pokemon OCR Database initialized with uuid-ossp, pg_trgm, and unaccent extensions.';
END $$;

