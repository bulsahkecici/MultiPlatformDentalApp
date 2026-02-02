-- Grant permissions to dentaluser
-- Run this as postgres superuser in pgAdmin
-- Make sure you're connected to 'dentalappdb' database

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO dentaluser;
GRANT CREATE ON SCHEMA public TO dentaluser;

-- Grant all privileges on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dentaluser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dentaluser;

-- Grant privileges on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dentaluser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dentaluser;

-- Also grant database-level privileges
GRANT ALL PRIVILEGES ON DATABASE dentalappdb TO dentaluser;

-- Verify permissions
SELECT 
    table_name,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'dentaluser'
ORDER BY table_name;
