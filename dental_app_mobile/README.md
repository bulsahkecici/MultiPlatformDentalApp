# Flutter Mobil Uygulama - Diş Kliniği Yönetim Sistemi

Web ve masaüstü istemcilerle aynı backend'i (`../src`) kullanan, rol bazlı
tam kapsamlı bir Flutter mobil uygulaması.

## Gereksinimler

- Flutter SDK 3.44+ (proje kökündeki `flutter/` yerine ayrı bir konumda
  kurulu olmalı — repoya dahil edilmez, bkz. kök `.gitignore`)
- Android Studio (Android SDK) ve/veya Xcode (iOS, sadece macOS)
- Çalışan bir backend (`../src` — bkz. kök `README.md`)

## Kurulum

```bash
cd dental_app_mobile
flutter pub get
```

Platform klasörleri (`android/`, `ios/`, `windows/`) `flutter create .` ile
üretildi ve repoya dahildir.

## Çalıştırma

API adresi derleme zamanında `--dart-define=API_URL=...` ile verilir
(bkz. `lib/core/config.dart`). Varsayılan `http://10.0.2.2:3000`, Android
emülatöründen host makinenin `localhost:3000` adresine işaret eder.

```bash
# Android emülatör (varsayılan adres yeterli)
flutter run

# Fiziksel cihaz — bilgisayarınızın LAN IP'sini kullanın
flutter run --dart-define=API_URL=http://192.168.1.20:3000

# Prod derleme
flutter build apk --release --dart-define=API_URL=https://<DOMAIN>
```

## Mimari

```
lib/
├── core/
│   ├── config.dart          # API_URL (--dart-define ile)
│   ├── api_client.dart      # Dio istemcisi: token saklama, 401→refresh→retry
│   ├── api_repository.dart  # Tüm backend uçlarının tipli sarmalayıcısı
│   └── socket_service.dart  # Socket.IO bildirim istemcisi
├── models/
│   └── models.dart          # User, Patient, Appointment, Treatment,
│                             # PendingPlan, PatientDebt, EarningsSummary,
│                             # InstitutionAgreement, AppNotification, ...
│                             # (fromJson hem snake_case hem camelCase kabul eder)
├── providers/
│   ├── auth_provider.dart         # Oturum durumu, checkAuth (/api/auth/me)
│   └── notification_provider.dart # Rozet sayısı + canlı bildirim akışı
├── screens/
│   ├── login_screen.dart
│   ├── home/home_shell.dart       # Rol bazlı drawer navigasyonu
│   ├── dashboard/                 # Bugünkü randevular + (admin) istatistik
│   ├── patients/                  # Liste/arama + ekle/düzenle
│   ├── appointments/              # Günlük liste + randevu formu
│   ├── treatments/                # Liste + diş şeması + TDB tarife formu
│   ├── payments/                  # Özet, plan onayı, tahsilat
│   ├── earnings/                  # Dişhekimi kazanç ekranı
│   ├── admin/                     # Kullanıcı yönetimi
│   ├── agreements/                # Kurum anlaşmaları (salt görüntüleme)
│   └── notifications/             # Bildirim merkezi
└── widgets/
    ├── patient_picker.dart        # Aramalı hasta seçici (bottom sheet)
    ├── tooth_chart.dart           # FDI diş şeması (mouth_chart.png üzerine)
    └── tariff_selector.dart       # TDB 2026 tarife seçici (bottom sheet)

assets/
├── images/mouth_chart.png            # Web/desktop ile aynı kaynak görsel
└── data/tdb_2026_tarife_full.json    # Web/desktop ile aynı tarife verisi
```

## Rol bazlı özellik erişimi

`home_shell.dart` menüsü backend'deki rol modeliyle birebir eşleşir:

| Özellik | admin | secretary | dentist |
|---|---|---|---|
| Kontrol Paneli, Randevular, Tedaviler | ✓ | ✓ | ✓ |
| Hastalar | ✓ (düzenle) | ✓ (düzenle) | ✓ (salt okunur) |
| Ödemeler, Anlaşmalı Kurumlar | ✓ | ✓ | — |
| Kazançlarım | — | — | ✓ |
| Kullanıcı Yönetimi | ✓ | — | — |

## Gerçek zamanlı bildirimler

Backend Socket.IO v4 kullanır (`src/services/notificationHub.js`); mobil
istemci `socket_io_client` paketiyle bağlanır (`lib/core/socket_service.dart`).
Kimlik doğrulama JWT ile `handshake.auth.token` üzerinden yapılır. Web
(`socket.io-client`) ve masaüstü (`SocketIOClient` NuGet) ile aynı protokol.

## Paketler

| Paket | Amaç |
|---|---|
| `provider` | State management |
| `dio` | HTTP istemcisi (interceptor, timeout, 401 retry) |
| `socket_io_client` | Gerçek zamanlı bildirimler |
| `flutter_secure_storage` | Access/refresh token saklama |
| `shared_preferences` | Token dışı basit yerel ayarlar |
| `intl` | Türkçe tarih/para biçimlendirme |

## Test

```bash
flutter test      # lib/models/models.dart fromJson testleri
flutter analyze   # statik analiz — temiz olmalı
```

## Bilinen sınırlamalar

- Kurum anlaşmaları ekranı salt görüntüleme; düzenleme web/desktop'ta yapılır.
- Push notification (arka planda uygulama kapalıyken) entegrasyonu yok —
  bildirimler yalnızca uygulama açıkken Socket.IO üzerinden anlık gelir.
