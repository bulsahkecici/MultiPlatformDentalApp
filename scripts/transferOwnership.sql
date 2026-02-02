-- Transfer table ownership to dentaluser
-- Run this as postgres superuser in pgAdmin
-- Make sure you're connected to 'dentalappdb' database

-- Transfer ownership of all tables to dentaluser
ALTER TABLE appointments OWNER TO dentaluser;
ALTER TABLE audit_logs OWNER TO dentaluser;
ALTER TABLE discount_reasons OWNER TO dentaluser;
ALTER TABLE discounts OWNER TO dentaluser;
ALTER TABLE institution_agreements OWNER TO dentaluser;
ALTER TABLE invoices OWNER TO dentaluser;
ALTER TABLE password_history OWNER TO dentaluser;
ALTER TABLE patient_debts OWNER TO dentaluser;
ALTER TABLE patient_discount_reasons OWNER TO dentaluser;
ALTER TABLE patients OWNER TO dentaluser;
ALTER TABLE payments OWNER TO dentaluser;
ALTER TABLE refresh_tokens OWNER TO dentaluser;
ALTER TABLE treatment_plan_items OWNER TO dentaluser;
ALTER TABLE treatment_plans OWNER TO dentaluser;
ALTER TABLE treatments OWNER TO dentaluser;
ALTER TABLE users OWNER TO dentaluser;

-- Also transfer sequences ownership
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || quote_ident(r.sequence_name) || ' OWNER TO dentaluser';
    END LOOP;
END $$;

-- Verify ownership
SELECT 
    t.table_name,
    pg_get_userbyid(c.relowner) as owner
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name
WHERE t.table_schema = 'public'
ORDER BY t.table_name;
