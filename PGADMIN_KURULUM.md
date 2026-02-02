# pgAdmin ile Schema Kurulum Rehberi

## Adım Adım Kurulum

### 1. Veritabanı Oluşturma

1. pgAdmin'i açın
2. Sol panelde **PostgreSQL** sunucusuna sağ tıklayın
3. **Create** → **Database** seçin
4. Aşağıdaki bilgileri girin:
   - **Database name:** `dentalappdb`
   - **Owner:** `postgres` (veya kendi kullanıcınız)
5. **Save** butonuna tıklayın

### 2. Schema Dosyasını Çalıştırma

#### Yöntem 1: Query Tool ile (ÖNERİLEN) ✅

1. Sol panelde yeni oluşturduğunuz **`dentalappdb`** veritabanına sağ tıklayın
2. **Query Tool** seçin (veya sağ tarafta Query Tool ikonuna tıklayın)
3. **File** menüsünden **Open File** seçin
4. Şu dosyayı seçin:
   ```
   MultiPlatformDentalApp/db/schema_postgres.sql
   ```
5. Dosya içeriği Query Tool'da açılacak
6. **Execute** butonuna tıklayın (veya **F5** tuşuna basın)
7. Alt panelde "Success" mesajını görmelisiniz

#### Yöntem 2: Dosyayı Kopyala-Yapıştır

1. **`schema_postgres.sql`** dosyasını bir metin editöründe açın
2. Tüm içeriği kopyalayın (Ctrl+A, Ctrl+C)
3. pgAdmin'de **Query Tool** açın
4. İçeriği yapıştırın (Ctrl+V)
5. **Execute** butonuna tıklayın (F5)

### 3. Kurulumu Kontrol Etme

Query Tool'da şu sorguyu çalıştırın:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Şu tabloları görmelisiniz:
- ✅ users
- ✅ patients
- ✅ appointments
- ✅ treatments
- ✅ treatment_plans
- ✅ treatment_plan_items
- ✅ institution_agreements
- ✅ discount_reasons
- ✅ patient_discount_reasons
- ✅ payments
- ✅ patient_debts
- ✅ invoices
- ✅ discounts
- ✅ refresh_tokens
- ✅ password_history
- ✅ audit_logs

### 4. Seed Data Kontrolü

İndirim nedenlerinin eklendiğini kontrol edin:

```sql
SELECT * FROM discount_reasons;
```

5 satır görmelisiniz:
- SGK Anlaşması
- Özel Sigorta
- Öğrenci İndirimi
- Yaşlı İndirimi
- Toplu İşlem

## Sorun Giderme

### "relation already exists" hatası
- ✅ Normal! Schema `IF NOT EXISTS` kullanıyor, güvenli.
- Tablolar zaten varsa atlanır.

### "permission denied" hatası
- Veritabanı sahibi olmayan bir kullanıcıyla bağlanmış olabilirsiniz.
- `postgres` kullanıcısıyla bağlanmayı deneyin.

### "syntax error" hatası
- Dosyanın tamamını kopyaladığınızdan emin olun.
- Özellikle son satırları kontrol edin.

### "column already exists" hatası
- Migration script'i çalıştı, bazı kolonlar zaten vardı.
- Normal, devam edebilirsiniz.

## Sonraki Adımlar

Schema başarıyla kurulduktan sonra:

1. **Backend'i başlatın:**
   ```bash
   cd MultiPlatformDentalApp
   npm run dev
   ```

2. **Admin kullanıcı oluşturun (opsiyonel):**
   ```bash
   npm run db:seed:admin
   ```

3. **WPF Desktop uygulamasını çalıştırın:**
   ```bash
   cd DentalApp.Desktop
   dotnet run
   ```

## Önemli Notlar

- Schema dosyası **idempotent** (tekrar çalıştırılabilir) - güvenle tekrar çalıştırabilirsiniz
- Mevcut veriler korunur (soft delete kullanılıyor)
- `postal_code` kolonu otomatik kaldırılır (varsa)
- Yeni tablolar ve kolonlar güvenli şekilde eklenir
