/**
 * PM2 süreç yapılandırması — MultiPlatformDentalApp backend.
 *
 * Kurulum (VPS):
 *   npm install -g pm2
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 save && pm2 startup   # açılışta otomatik başlat
 *
 * ÖNEMLİ: Gizli değerleri (JWT_SECRET, DB_PASS) bu dosyaya YAZMAYIN.
 * Sunucuda proje kökünde bir .env dosyası oluşturun (bkz. .env.example) —
 * src/config/index.js .env'i otomatik yükler ve production'da dev
 * fallback'leriyle çalışmayı reddeder (fail-fast).
 */
module.exports = {
  apps: [
    {
      name: 'dentalapp-api',
      script: 'src/server.js',
      cwd: __dirname + '/..',
      instances: 1, // Socket.IO oda durumu process-içi olduğundan tek instance
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '512M',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
