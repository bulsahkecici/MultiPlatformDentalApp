# Dağıtım Rehberi

Tüm istemcilerin (web, desktop, mobil) internet üzerinden tek bir sunucuya
bağlanması için uçtan uca kurulum.

Ana yol **Windows** (Server veya 10/11 Pro) hedefler — geliştirme makineniz
zaten Windows olduğu için sunucu tarafında da aynı araç setiyle (PowerShell)
çalışabilirsiniz, ayrı bir Linux/SSH öğrenme eğrisine gerek kalmaz. Bir Linux
VPS kiralamayı tercih ederseniz dokümanın sonundaki **Alternatif: Ubuntu/Linux
VPS** bölümünü kullanın.

> Yerel geliştirme için bunların hiçbiri gerekmez — Windows'ta sadece
> `npm run dev` (backend) + `npx ng serve` (web) yeterlidir. Bu rehber sadece
> **internet üzerinden erişilebilir bir sunucuya** dağıtım için gereklidir.

---

## Windows ile Dağıtım (Önerilen)

### Mimari

```
İnternet ──▶ Caddy (80/443, otomatik HTTPS) ──▶ Node.js backend (127.0.0.1:3000)
                    │                                   │
                    └── Angular statik build ──         └── PostgreSQL (127.0.0.1:5432)
```

Caddy hem Angular'ın statik dosyalarını servis eder hem de `/api` ve
`/socket.io` isteklerini backend'e yönlendirir — nginx'in Windows'taki
karşılığı ama kurulumu çok daha basit (tek exe, otomatik Let's Encrypt TLS).
Node backend ve Caddy, **NSSM** ile Windows servisi olarak çalıştırılır ki
sunucu yeniden başlasa bile otomatik ayağa kalksınlar.

### 1. Gerekli araçları kurun (PowerShell, Yönetici olarak)

```powershell
winget install OpenJS.NodeJS.LTS
winget install PostgreSQL.PostgreSQL
winget install CaddyServer.Caddy
winget install NSSM.NSSM
```

(`winget` yoksa her birini ilgili sitesinden indirip kurabilirsiniz:
nodejs.org, postgresql.org/download/windows, caddyserver.com/download,
nssm.cc.)

### 2. PostgreSQL

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```

```sql
CREATE USER dentaluser WITH PASSWORD '<GUCLU_SIFRE>';
CREATE DATABASE dentalappdb OWNER dentaluser;
\q
```

PostgreSQL kurulumda sadece `localhost` dinleyecek şekilde bırakılmalı —
`postgresql.conf`'taki `listen_addresses` değerini değiştirmeyin.

### 3. Backend

```powershell
git clone <repo-url> C:\dentalapp
cd C:\dentalapp
npm ci --omit=dev
```

Proje kökünde `.env` dosyası oluşturun (bkz. `.env.example`) — **ZORUNLU**
alanlar:

```env
NODE_ENV=production
JWT_SECRET=<güçlü_rastgele_değer>
DB_PASS=<GUCLU_SIFRE>
CORS_ORIGINS=https://<DOMAIN>
APP_URL=https://<DOMAIN>
```

`JWT_SECRET` üretmek için PowerShell'de:

```powershell
-join ((48..57)+(97..102) | Get-Random -Count 64 | % {[char]$_})
```

Not: `src/config/index.js`, `NODE_ENV=production` iken `JWT_SECRET`/`DB_PASS`
geliştirme varsayılanlarıyla açılmayı **reddeder** (fail-fast).

```powershell
npm run db:migrate
npm run db:seed:admin      # ADMIN_EMAIL/ADMIN_PASSWORD .env'den okunur
```

Backend'i NSSM ile Windows servisi yapın:

```powershell
nssm install DentalAppAPI "C:\Program Files\nodejs\node.exe" "C:\dentalapp\src\server.js"
nssm set DentalAppAPI AppDirectory "C:\dentalapp"
nssm set DentalAppAPI AppStdout "C:\dentalapp\logs\api-out.log"
nssm set DentalAppAPI AppStderr "C:\dentalapp\logs\api-err.log"
nssm start DentalAppAPI
```

### 4. Web (Angular)

Kendi geliştirme makinenizde (ya da sunucuda) build alıp Caddy'nin servis
edeceği klasöre kopyalayın:

```powershell
cd dental-app-web
# src/environments/environment.prod.ts içindeki apiUrl/socketUrl'i
# https://<DOMAIN> yapın, sonra:
npx ng build --configuration production
New-Item -ItemType Directory -Force C:\dentalapp-web | Out-Null
Copy-Item -Recurse -Force "dist\dental-app-web\browser\*" "C:\dentalapp-web\"
```

### 5. Caddy (reverse proxy + otomatik HTTPS)

`deploy/Caddyfile` içindeki `<DOMAIN>` ve `C:/dentalapp-web` yollarını kendi
değerlerinizle değiştirin, sonra NSSM ile servis yapın:

```powershell
nssm install DentalAppCaddy "C:\ProgramData\chocolatey\bin\caddy.exe" "run" "--config" "C:\dentalapp\deploy\Caddyfile"
nssm start DentalAppCaddy
```

(`caddy.exe`'nin gerçek yolu kurulum yönteminize göre değişir — `where.exe
caddy` ile bulun.)

Caddy, alan adınız gerçek bir domain olduğu ve 80/443 portları internetten
erişilebilir olduğu sürece Let's Encrypt sertifikasını **otomatik** alır ve
yeniler — Certbot gibi ayrı bir araca gerek yoktur.

### 6. Windows Firewall

```powershell
New-NetFirewallRule -DisplayName "HTTP (Caddy)" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "HTTPS (Caddy)" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

Backend'in 3000 portunu **dışarıya açmayın** — sadece Caddy üzerinden
(127.0.0.1) erişilmeli.

### 7. İstemcileri sunucuya yönlendirme

| İstemci | Ayar |
|---|---|
| Web | Caddy'den servis edilir (same-origin, ek ayar yok) |
| Desktop | Exe yanındaki `appsettings.json`: `"ApiBaseUrl": "https://<DOMAIN>/api"`, `"SocketUrl": "https://<DOMAIN>"` |
| Mobil | `flutter build apk --release --dart-define=API_URL=https://<DOMAIN>` |

### 8. Doğrulama

Tarayıcıda veya PowerShell'de:

```powershell
Invoke-WebRequest https://<DOMAIN>/healthz   # → {"status":"ok"}
Invoke-WebRequest https://<DOMAIN>/readyz    # → {"status":"ready"} (DB bağlı)
```

- Tarayıcı DevTools → Network → WS: `wss://<DOMAIN>/socket.io/` bağlantısının
  `101 Switching Protocols` ile açıldığını doğrulayın.
- `Get-Content C:\dentalapp\logs\api-out.log -Tail 50` — pino loglarında
  gerçek istemci IP'leri görünmeli (trust proxy sayesinde; Caddy IP'si değil).
- İki farklı istemciden girip birinden randevu oluşturun → diğerine bildirim
  anında düşmeli.

### Sorun giderme (Windows)

- **Servis başlamıyor:** `nssm status DentalAppAPI` / `Get-EventLog -LogName Application -Source nssm -Newest 20`
  ile hata mesajına bakın; genellikle yanlış `AppDirectory` veya eksik `.env`.
- **Bildirim gelmiyor:** Caddy loglarında `/socket.io/` isteklerinin 101 ile
  yükseldiğini kontrol edin; backend loglarında "Socket authenticated"
  satırı görünmeli.
- **Herkes rate-limit'e takılıyor:** `app.set('trust proxy', 1)`
  `src/server.js`'te mevcut olmalı; Caddy varsayılan olarak
  `X-Forwarded-For` gönderir.
- **Migrate hatası 28P01:** `.env`'deki `DB_PASS` PostgreSQL kullanıcı
  şifresiyle eşleşmiyor.
- **Caddy sertifika alamıyor:** DNS kaydınızın (A/AAAA) sunucunun genel
  IP'sine işaret ettiğinden ve 80/443'ün gerçekten dışarıdan erişilebilir
  olduğundan emin olun (ev/ofis ağındaysanız router'da port yönlendirmesi
  gerekebilir).

---

## Alternatif: Ubuntu/Linux VPS ile Dağıtım

Bir Linux VPS kiralamayı tercih ederseniz aynı mimariyi nginx + PM2 + Certbot
ile kurabilirsiniz. Aşağıdaki komutlar **VPS'e SSH ile bağlandıktan sonra o
oturumun içinde** çalıştırılır — Windows makinenizde değil.

### 1. Sunucu hazırlığı

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx postgresql certbot python3-certbot-nginx
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### 2. PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER dentaluser WITH PASSWORD '<GUCLU_SIFRE>';
CREATE DATABASE dentalappdb OWNER dentaluser;
SQL
```

### 3. Backend

```bash
git clone <repo> /opt/dentalapp && cd /opt/dentalapp
npm ci --omit=dev
# .env oluştur (3. bölümdeki Windows adımıyla aynı içerik)
npm run db:migrate
npm run db:seed:admin

npm install -g pm2
pm2 start deploy/ecosystem.config.js
pm2 save && pm2 startup
```

### 4. Web (Angular)

```bash
cd dental-app-web
npx ng build --configuration production
scp -r dist/dental-app-web/browser/* user@sunucu:/var/www/dentalapp/
```

### 5. nginx + TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/dentalapp
sudo sed -i 's/<DOMAIN>/klinik.example.com/g' /etc/nginx/sites-available/dentalapp
sudo ln -s /etc/nginx/sites-available/dentalapp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d klinik.example.com
```

### 6. Doğrulama

```bash
curl https://<DOMAIN>/healthz
curl https://<DOMAIN>/readyz
pm2 logs dentalapp-api
```

### Sorun giderme (Linux)

- **Bildirim gelmiyor:** nginx `/socket.io/` bloğundaki `Upgrade`/`Connection`
  header'larını kontrol edin.
- **Herkes rate-limit'e takılıyor:** `app.set('trust proxy', 1)` mevcut
  olmalı; nginx `X-Forwarded-For` gönderiyor olmalı.
- **Migrate hatası 28P01:** `.env`'deki `DB_PASS` PostgreSQL şifresiyle
  eşleşmiyor.
