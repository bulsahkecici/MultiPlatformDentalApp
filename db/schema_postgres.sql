-- Enhanced users table with security fields
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  roles TEXT NOT NULL DEFAULT '',
  
  -- Diş hekimi için kazanç oranı (0-100 arası yüzde)
  commission_rate DECIMAL(5, 2) DEFAULT NULL, -- NULL ise kazanç hesaplanmaz
  
  -- Email verification
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verification_token TEXT,
  email_verification_expires TIMESTAMPTZ,
  
  -- Password reset
  password_reset_token TEXT,
  password_reset_expires TIMESTAMPTZ,
  
  -- Account lockout
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  account_locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users (email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users (password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens (token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

-- Password history table (prevent password reuse)
CREATE TABLE IF NOT EXISTS password_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history (user_id);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  resource_type VARCHAR(50),
  resource_id INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  email VARCHAR(320),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  
  -- Medical information
  blood_type VARCHAR(10),
  allergies TEXT,
  medical_conditions TEXT,
  current_medications TEXT,
  emergency_contact_name VARCHAR(200),
  emergency_contact_phone VARCHAR(50),
  
  -- Insurance
  insurance_provider VARCHAR(200),
  insurance_policy_number VARCHAR(100),
  
  -- Notes
  notes TEXT,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients (email);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients (phone);
CREATE INDEX IF NOT EXISTS idx_patients_deleted_at ON patients (deleted_at);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  dentist_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled, no_show
  appointment_type VARCHAR(100), -- checkup, cleaning, filling, extraction, etc.
  
  notes TEXT,
  cancellation_reason TEXT,
  
  -- Reminders
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_dentist_id ON appointments (dentist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);

-- Treatments table
CREATE TABLE IF NOT EXISTS treatments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  dentist_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  treatment_date DATE NOT NULL,
  treatment_type VARCHAR(200) NOT NULL,
  tooth_number VARCHAR(20), -- e.g., "16", "21", "32-33"
  
  description TEXT,
  diagnosis TEXT,
  procedure_notes TEXT,
  
  -- Cost
  cost DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'completed', -- planned, in_progress, completed, cancelled
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON treatments (patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_appointment_id ON treatments (appointment_id);
CREATE INDEX IF NOT EXISTS idx_treatments_dentist_id ON treatments (dentist_id);
CREATE INDEX IF NOT EXISTS idx_treatments_date ON treatments (treatment_date);

-- Treatment plans table (multi-step treatment plans)
CREATE TABLE IF NOT EXISTS treatment_plans (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  dentist_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  title VARCHAR(200) NOT NULL,
  description TEXT,
  
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, completed, cancelled
  
  total_estimated_cost DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  
  start_date DATE,
  estimated_completion_date DATE,
  actual_completion_date DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_id ON treatment_plans (patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_dentist_id ON treatment_plans (dentist_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_status ON treatment_plans (status);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_id INTEGER REFERENCES treatments(id) ON DELETE SET NULL,
  
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  due_date DATE,
  
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled
  payment_method VARCHAR(50), -- cash, credit_card, insurance, etc.
  payment_date DATE,
  
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices (patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices (invoice_date);

-- Discounts table (indirimler)
CREATE TABLE IF NOT EXISTS discounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  discount_type VARCHAR(50) NOT NULL, -- 'percentage' or 'fixed'
  discount_value DECIMAL(10, 2) NOT NULL,
  min_amount DECIMAL(10, 2) DEFAULT NULL, -- Minimum tutar
  max_discount DECIMAL(10, 2) DEFAULT NULL, -- Maksimum indirim tutarı
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts (is_active, start_date, end_date);

-- Institution agreements table (kurum anlaşmaları)
CREATE TABLE IF NOT EXISTS institution_agreements (
  id SERIAL PRIMARY KEY,
  institution_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(200),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(320),
  discount_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_institution_agreements_active ON institution_agreements (is_active);

-- Patient institution link (hastanın hangi kuruma bağlı olduğu)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS institution_agreement_id INTEGER REFERENCES institution_agreements(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_patients_institution ON patients (institution_agreement_id);

-- Treatment plan items (tedavi planındaki kalemler - 32 diş şeması için)
CREATE TABLE IF NOT EXISTS treatment_plan_items (
  id SERIAL PRIMARY KEY,
  treatment_plan_id INTEGER NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  tooth_number VARCHAR(20) NOT NULL, -- 1-32 arası diş numarası
  treatment_type VARCHAR(200) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'TRY',
  status VARCHAR(50) NOT NULL DEFAULT 'planned', -- planned, in_progress, completed, cancelled
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_plan_id ON treatment_plan_items (treatment_plan_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_items_tooth ON treatment_plan_items (tooth_number);

-- Discount reasons table (indirim nedenleri)
CREATE TABLE IF NOT EXISTS discount_reasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_reasons_active ON discount_reasons (is_active);

-- Patient discount reasons link (many-to-many)
CREATE TABLE IF NOT EXISTS patient_discount_reasons (
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  discount_reason_id INTEGER NOT NULL REFERENCES discount_reasons(id) ON DELETE CASCADE,
  PRIMARY KEY (patient_id, discount_reason_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_discount_reasons_patient ON patient_discount_reasons (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_discount_reasons_reason ON patient_discount_reasons (discount_reason_id);

-- Payments table (ödeme kayıtları)
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_plan_id INTEGER REFERENCES treatment_plans(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'card', 'cash'
  dentist_commission DECIMAL(10, 2), -- Hekimin ciro payı
  dentist_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments (patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_treatment_plan_id ON payments (treatment_plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_dentist_id ON payments (dentist_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at);

-- Patient debts table (hasta borçları)
CREATE TABLE IF NOT EXISTS patient_debts (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  total_debt DECIMAL(10, 2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  remaining_debt DECIMAL(10, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_debts_patient_id ON patient_debts (patient_id);

-- Users table'a doktor/sekreter bilgileri için alanlar ekle
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tc_no VARCHAR(11);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS iban VARCHAR(34);
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary DECIMAL(10, 2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS university VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS diploma_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS diploma_no VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS specializations TEXT; -- Comma-separated uzmanlık alanları

CREATE INDEX IF NOT EXISTS idx_users_name ON users (last_name, first_name);

-- Treatment plans status güncellemesi (pending approval için)
ALTER TABLE treatment_plans ALTER COLUMN status SET DEFAULT 'pending';
-- Status değerleri: pending, approved, active, completed, cancelled

-- Migration: Remove postal_code column if it exists (for existing databases)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'postal_code'
    ) THEN
        ALTER TABLE patients DROP COLUMN postal_code;
    END IF;
END $$;

-- Seed discount reasons
INSERT INTO discount_reasons (name, description) VALUES
  ('SGK Anlaşması', 'SGK ile yapılan anlaşma kapsamında indirim'),
  ('Özel Sigorta', 'Özel sigorta şirketi anlaşması'),
  ('Öğrenci İndirimi', 'Öğrencilere özel indirim'),
  ('Yaşlı İndirimi', '65 yaş üstü hastalara indirim'),
  ('Toplu İşlem', 'Birden fazla işlem için toplu indirim')
ON CONFLICT (name) DO NOTHING;