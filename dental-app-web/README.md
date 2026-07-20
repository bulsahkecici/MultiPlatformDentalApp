# Angular Web Uygulaması - Diş Kliniği Yönetim Sistemi

Standalone bileşen mimarisiyle yazılmış, masaüstü ve mobil istemcilerle aynı
backend'i (`../src`) kullanan tam kapsamlı bir Angular uygulaması.

## Gereksinimler

- Node.js 18+ ve npm
- Angular CLI (`npm install -g @angular/cli`, opsiyonel — `npx ng` de çalışır)
- Çalışan bir backend (`../src` — bkz. kök `README.md`)

## Kurulum ve Geliştirme

```bash
cd dental-app-web
npm install
npm start          # ng serve — http://localhost:4200
```

## Build

```bash
npx ng build                                  # geliştirme build'i
npx ng build --configuration production       # prod build (dist/dental-app-web/browser)
```

Prod dağıtımından önce `src/environments/environment.prod.ts` içindeki
`apiUrl`/`socketUrl` gerçek sunucu adresiyle güncellenmelidir (bkz. kök
`deploy/DEPLOYMENT.md`).

## Proje Yapısı

```
src/app/
├── core/
│   ├── services/
│   │   ├── api.service.ts           # HttpClient sarmalayıcısı
│   │   ├── auth.service.ts          # Login, token yönetimi, /auth/me ile oturum restore
│   │   ├── socket.service.ts        # Socket.IO bildirim istemcisi
│   │   ├── notification.service.ts  # Kalıcı bildirim REST uçları
│   │   ├── patient.service.ts / appointment.service.ts / treatment.service.ts
│   │   ├── payment.service.ts / dashboard.service.ts / tariff.service.ts
│   │   ├── institution-agreement.service.ts / user.service.ts
│   ├── guards/auth.guard.ts
│   ├── interceptors/auth.interceptor.ts   # Bearer token ekler, 401'de logout
│   ├── models/models.ts
│   └── utils/data-mapper.ts               # snake_case ↔ camelCase dönüşümü
├── features/
│   ├── auth/login/
│   ├── dashboard/
│   ├── patients/
│   ├── appointments/
│   ├── treatments/
│   ├── payments/           # Özet, plan onayı, tahsilat, kurum anlaşmaları
│   ├── dentist-earnings/
│   ├── admin/
│   └── layout/main-layout/ # Rol bazlı sidenav + bildirim zili
└── shared/components/
    ├── tooth-chart/           # FDI diş şeması (mouth_chart.png üzerine)
    ├── tariff-selector/       # TDB 2026 tarife seçici
    ├── patient-form-dialog/
    ├── appointment-form-dialog/
    └── treatment-form-dialog/
```

## Yapılandırma

**Geliştirme** (`src/environments/environment.ts`):
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  socketUrl: 'http://localhost:3000'
};
```

**Prod** (`src/environments/environment.prod.ts`) — dağıtımdan önce gerçek
domain ile değiştirilmeli:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://<DOMAIN>',
  socketUrl: 'https://<DOMAIN>'
};
```

## Rol bazlı erişim

`main-layout.component.ts`, `AuthService.currentUser$`'tan gelen rollere göre
menüyü filtreler:

| Özellik | Admin | Sekreter | Dişhekimi |
|---|---|---|---|
| Kontrol Paneli, Randevular, Tedaviler | ✓ | ✓ | ✓ |
| Hastalar | ✓ | ✓ | ✓ (salt okunur) |
| Ödemeler | ✓ | ✓ | — |
| Kazançlarım | — | — | ✓ |
| Kullanıcı Yönetimi | ✓ | — | — |

## Gerçek zamanlı bildirimler

Backend Socket.IO v4 kullanır; web istemcisi **`socket.io-client`** ile
bağlanır (`core/services/socket.service.ts`) — masaüstü (`SocketIOClient`
NuGet) ve mobil (`socket_io_client`) ile aynı protokol. Kimlik doğrulama JWT
ile `auth: { token }` üzerinden yapılır. Bağlantı `main-layout.component.ts`
içinde giriş sonrası kurulur; gelen bildirimler bir MatSnackBar + bildirim
zili rozetiyle gösterilir.

## Bağımlılıklar

| Paket | Amaç |
|---|---|
| `@angular/*` ^18.2.14, `@angular/material` ^18 | Framework + UI bileşenleri |
| `socket.io-client` ^4 | Gerçek zamanlı bildirimler |
| `rxjs` ~7.8 | Reaktif programlama |

## Test

```bash
ng test    # Karma/Jasmine
```

## License
ISC
