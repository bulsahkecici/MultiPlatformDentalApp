# pgAdmin'de Veritabanı Oluşturma - Detaylı Rehber

## Sorun: "Create" tıkladığınızda sadece "Server Group" görünüyor

Bu, PostgreSQL sunucusuna bağlanmadığınız veya sunucu kapalı olduğu anlamına gelir.

## Çözüm Adımları

### 1. PostgreSQL Sunucusunu Bulun ve Açın

1. **Sol panelde** (Object Browser) şunları görmelisiniz:
   ```
   Servers
   └── PostgreSQL 15 (veya başka bir versiyon numarası)
       ├── Databases
       ├── Login/Group Roles
       └── ...
   ```

2. **PostgreSQL 15** (veya versiyon numaranız) yanında bir **ok işareti (▶)** varsa:
   - **Sol tıklayın** veya **çift tıklayın** - Sunucu açılacak
   - Şifre isteyebilir (PostgreSQL kurulumunda belirlediğiniz şifre)

3. Sunucu açıldığında ok işareti **aşağı (▼)** döner

### 2. "Databases" Klasörüne Sağ Tıklayın

1. Sol panelde **"Databases"** klasörünü bulun
2. **Sağ tıklayın**
3. Şimdi şu menüyü görmelisiniz:
   ```
   Create
   ├── Database... ✅ (BUNU GÖRMELİSİNİZ)
   └── ...
   Refresh
   ```

### 3. Alternatif: Doğrudan Sunucuya Sağ Tıklayın

Eğer hala "Database" seçeneğini göremiyorsanız:

1. **PostgreSQL 15** (sunucu adı) üzerine **sağ tıklayın**
2. **"Create"** → **"Database..."** seçin

### 4. Veritabanı Oluşturma Formu

Açılan pencerede:

1. **General** sekmesi:
   - **Database:** `dentalappdb` yazın
   - **Owner:** `postgres` seçin (dropdown'dan)

2. **Save** butonuna tıklayın

3. Sol panelde **Databases** altında **`dentalappdb`** görünmeli

## Eğer PostgreSQL Sunucusu Görünmüyorsa

### Yeni Sunucu Ekleme

1. Sol panelde **"Servers"** üzerine **sağ tıklayın**
2. **"Create"** → **"Server..."**
3. **General** sekmesi:
   - **Name:** `PostgreSQL Local` (istediğiniz isim)
4. **Connection** sekmesi:
   - **Host name/address:** `localhost`
   - **Port:** `5432`
   - **Maintenance database:** `postgres`
   - **Username:** `postgres`
   - **Password:** PostgreSQL kurulumunda belirlediğiniz şifre
5. **Save** butonuna tıklayın

## Hızlı Kontrol Listesi

- ✅ PostgreSQL servisi çalışıyor mu? (Windows Services'te kontrol edin)
- ✅ pgAdmin'de sunucu açık mı? (ok işareti aşağı mı?)
- ✅ "Databases" klasörüne mi tıkladınız?
- ✅ Şifre doğru mu? (bağlantı hatası alıyorsanız)

## PostgreSQL Servisini Kontrol Etme (Windows)

1. **Windows + R** tuşlarına basın
2. `services.msc` yazın ve Enter
3. **"postgresql"** servisini bulun
4. Durum **"Running"** olmalı
5. Değilse, sağ tıklayıp **"Start"** seçin

## Şifre Unuttuysanız

PostgreSQL şifresini sıfırlamak için:

1. Windows Services'te PostgreSQL servisini durdurun
2. `pg_hba.conf` dosyasını düzenleyin (genellikle `C:\Program Files\PostgreSQL\15\data\` klasöründe)
3. `md5` yerine `trust` yapın (geçici olarak)
4. Servisi başlatın
5. pgAdmin'den bağlanın
6. Şifreyi değiştirin
7. `pg_hba.conf`'u geri alın

## Sonraki Adım

Veritabanı oluşturduktan sonra:
1. **`dentalappdb`** üzerine sağ tıklayın
2. **Query Tool** seçin
3. **File** → **Open File**
4. `schema_postgres.sql` dosyasını seçin
5. **Execute (F5)**
