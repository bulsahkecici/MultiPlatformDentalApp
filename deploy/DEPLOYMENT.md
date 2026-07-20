# VPS Dağıtım Rehberi (Ubuntu 22.04+)

Tüm istemcilerin (web, desktop, mobil) internet üzerinden tek bir sunucuya
bağlanması için uçtan uca kurulum.

> ⚠️ **ÖNEMLİ:** Bu rehberdeki komutlar **Ubuntu VPS sunucusunda** (SSH ile
> bağlanarak) çalıştırılır — **Windows geliştirme makinenizde DEĞİL**.
> Windows PowerShell'de `curl -fsSL` ve `sudo` çalışmaz.
>
> Akış şöyledir:
> 1. Bir VPS kiralayın (Hetzner, DigitalOcean, Contabo vb. — Ubuntu 22.04+).
> 2. Windows'tan sunucuya bağlanın: `ssh root@<sunucu-ip>`
> 3. Aşağıdaki adımları SSH oturumunun İÇİNDE çalıştırın.
>
> Yerel geliştirme için bunların hiçbiri gerekmez — Windows'ta sadece
> `npm run dev` (backend) + `npx ng serve` (web) yeterlidir.

## 1. Sunucu hazırlığı

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx postgresql certbot python3-certbot-nginx

# Güvenlik duvarı: sadece SSH + HTTP(S)
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## 2. PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER dentaluser WITH PASSWORD '<GUCLU_SIFRE>';
CREATE DATABASE dentalappdb OWNER dentaluser;
SQL
```

PostgreSQL varsayılan olarak yalnızca localhost dinler — böyle kalmalı.

## 3. Backend

```bash
git clone <repo> /opt/dentalapp && cd /opt/dentalapp
npm ci --omit=dev

# .env oluştur (bkz. .env.example) — ZORUNLU alanlar:
#   NODE_ENV=production
#   JWT_SECRET=<openssl rand -hex 32 çıktısı>
#   DB_PASS=<GUCLU_SIFRE>
#   CORS_ORIGINS=https://<DOMAIN>
#   APP_URL=https://<DOMAIN>
# Not: config, production'da dev fallback sırlarıyla açılmayı REDDEDER.

npm run db:migrate
npm run db:seed:admin      # ADMIN_EMAIL/ADMIN_PASSWORD .env'den okunur

npm install -g pm2
pm2 start deploy/ecosystem.config.js
pm2 save && pm2 startup
```

## 4. Web (Angular)

Yerel makinede:

```bash
cd dental-app-web
# src/environments/environment.prod.ts içindeki apiUrl/socketUrl'i
# https://<DOMAIN> yapın, sonra:
npx ng build --configuration production
scp -r dist/dental-app-web/browser/* user@sunucu:/var/www/dentalapp/
```

## 5. nginx + TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/dentalapp
sudo sed -i 's/<DOMAIN>/klinik.example.com/g' /etc/nginx/sites-available/dentalapp
sudo ln -s /etc/nginx/sites-available/dentalapp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d klinik.example.com
```

## 6. İstemcileri sunucuya yönlendirme

| İstemci | Ayar |
|---|---|
| Web | nginx'ten servis edilir (same-origin, ek ayar yok) |
| Desktop | Exe yanındaki `appsettings.json`: `"ApiBaseUrl": "https://<DOMAIN>/api"`, `"SocketUrl": "https://<DOMAIN>"` |
| Mobil | `flutter build apk --release --dart-define=API_URL=https://<DOMAIN>` |

## 7. Doğrulama

```bash
curl https://<DOMAIN>/healthz          # → {"status":"ok"}
curl https://<DOMAIN>/readyz           # → {"status":"ready"} (DB bağlı)
```

- Tarayıcı DevTools → Network → WS: `wss://<DOMAIN>/socket.io/` bağlantısının
  `transport=websocket` olduğunu doğrulayın (long-polling'e düşmemeli).
- `pm2 logs dentalapp-api` — pino loglarında gerçek istemci IP'leri görünmeli
  (trust proxy sayesinde; nginx IP'si değil).
- İki farklı istemciden girip birinden randevu oluşturun → diğerine bildirim
  anında düşmeli.

## Sorun giderme

- **Bildirim gelmiyor:** nginx `/socket.io/` bloğundaki `Upgrade`/`Connection`
  header'larını kontrol edin; `pm2 logs`'ta "Socket authenticated" satırı
  görünmeli.
- **Herkes rate-limit'e takılıyor:** `app.set('trust proxy', 1)` src/server.js'te
  mevcut olmalı; nginx `X-Forwarded-For` gönderiyor olmalı.
- **Migrate hatası 28P01:** .env'deki DB_PASS PostgreSQL kullanıcı şifresiyle
  eşleşmiyor.
