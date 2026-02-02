# Veritabanı Kurulum Rehberi

## 1. PostgreSQL Kurulumu

PostgreSQL'in yüklü olduğundan emin olun. Eğer yoksa:
- Windows: https://www.postgresql.org/download/windows/
- Mac: `brew install postgresql`
- Linux: `sudo apt-get install postgresql`

## 2. Veritabanı Oluşturma

PostgreSQL'e bağlanın ve veritabanı oluşturun:

```bash
# PostgreSQL'e bağlan
psql -U postgres

# Veritabanı oluştur
CREATE DATABASE dentalappdb;

# Kullanıcı oluştur (opsiyonel)
CREATE USER dentaluser WITH PASSWORD 'StrongPass123!';
GRANT ALL PRIVILEGES ON DATABASE dentalappdb TO dentaluser;

# Çıkış
\q
```

## 3. Environment Variables (.env dosyası)

Proje kök dizininde `.env` dosyası oluşturun:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dentalappdb
DB_USER=dentaluser
DB_PASS=StrongPass123!
DB_SSL=false

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server
PORT=3000
NODE_ENV=development

# CORS (virgülle ayrılmış)
CORS_ORIGINS=http://localhost:3000,http://localhost:4200

# Email (opsiyonel)
EMAIL_ENABLED=false
```

## 4. Schema'yı Çalıştırma

### Yöntem 1: npm Script (ÖNERİLEN) ✅

```bash
# Proje dizinine gidin
cd MultiPlatformDentalApp

# Dependencies yükleyin (ilk kez)
npm install

# Schema'yı çalıştırın
npm run db:migrate
```

### Yöntem 2: psql ile Direkt

```bash
# Windows PowerShell/CMD
psql -U dentaluser -d dentalappdb -f db/schema_postgres.sql

# Mac/Linux
psql -U dentaluser -d dentalappdb -f db/schema_postgres.sql
```

Eğer şifre sorarsa, `PGPASSWORD` environment variable kullanın:
```bash
# Windows PowerShell
$env:PGPASSWORD="StrongPass123!"; psql -U dentaluser -d dentalappdb -f db/schema_postgres.sql

# Mac/Linux
PGPASSWORD=StrongPass123! psql -U dentaluser -d dentalappdb -f db/schema_postgres.sql
```

### Yöntem 3: pgAdmin ile

1. pgAdmin'i açın
2. `dentalappdb` veritabanına sağ tıklayın
3. "Query Tool" seçin
4. `db/schema_postgres.sql` dosyasının içeriğini kopyalayıp yapıştırın
5. Execute (F5) tuşuna basın

### Yöntem 4: Node.js Script ile Direkt

```bash
node scripts/dbMigrate.js
```

## 5. Admin Kullanıcı Oluşturma (Opsiyonel)

İlk admin kullanıcıyı oluşturmak için:

```bash
npm run db:seed:admin
```

## 6. Veritabanı Bağlantısını Test Etme

Backend'i başlatarak test edin:

```bash
npm run dev
```

Eğer hata alırsanız, `.env` dosyasındaki veritabanı bilgilerini kontrol edin.

## Sorun Giderme

### "relation already exists" hatası
- Normal, schema `IF NOT EXISTS` kullanıyor, güvenli.

### "password authentication failed"
- `.env` dosyasındaki `DB_USER` ve `DB_PASS` değerlerini kontrol edin.
- PostgreSQL'de kullanıcı şifresini kontrol edin.

### "database does not exist"
- Önce veritabanını oluşturun (Yukarıdaki adım 2).

### "permission denied"
- Kullanıcıya veritabanı üzerinde yetki verin:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE dentalappdb TO dentaluser;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dentaluser;
  ```

## Schema İçeriği

Schema şunları içerir:
- ✅ Users tablosu (doktor/sekreter/patron bilgileri ile)
- ✅ Patients tablosu (postal_code kaldırıldı, institution_agreement_id eklendi)
- ✅ Appointments tablosu
- ✅ Treatments ve Treatment Plans tabloları
- ✅ Institution Agreements tablosu
- ✅ Discount Reasons tablosu
- ✅ Payments tablosu
- ✅ Patient Debts tablosu
- ✅ Seed data (discount reasons)

## Migration Notları

- Schema mevcut veritabanlarında `postal_code` kolonunu otomatik kaldırır
- Yeni tablolar ve kolonlar `IF NOT EXISTS` ile güvenli şekilde eklenir
- Seed data (`discount_reasons`) otomatik eklenir
