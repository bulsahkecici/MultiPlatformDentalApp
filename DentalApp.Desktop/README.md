# WPF Masaüstü Uygulaması - Diş Kliniği Yönetim Sistemi

MVVM mimarisiyle yazılmış, web ve mobil istemcilerle aynı backend'i
(`../src`) kullanan tam kapsamlı bir masaüstü uygulaması.

## Gereksinimler

- .NET 8.0 SDK veya üzeri
- Visual Studio 2022 (önerilen) veya `dotnet` CLI
- Çalışan bir backend (`../src` — bkz. kök `README.md`)
- NuGet kaynağı olarak nuget.org tanımlı olmalı (`dotnet nuget list source`
  ile kontrol edin; yalnızca "Microsoft Visual Studio Offline Packages"
  varsa `dotnet nuget add source https://api.nuget.org/v3/index.json -n nuget.org`)

## Proje Yapısı

```
DentalApp.Desktop/
├── Models/
│   ├── Models.cs            # User, Patient, Appointment, Treatment, ...
│   ├── TariffModels.cs       # TDB tarife modelleri
│   ├── ToothHotspot.cs       # Diş şeması hotspot koordinatları
│   └── UserResponse.cs
├── ViewModels/               # Her View için bir ViewModel (MVVM)
│   ├── LoginViewModel.cs
│   ├── MainViewModel.cs              # Navigasyon, rol bazlı erişim, bildirim
│   ├── DashboardViewModel.cs         # Bugünkü randevular + finansal özet
│   ├── PatientsViewModel.cs / PatientFormViewModel.cs
│   ├── AppointmentsViewModel.cs / AppointmentFormViewModel.cs / AppointmentDetailsViewModel.cs
│   ├── TreatmentsViewModel.cs / TreatmentFormViewModel.cs   # Diş şeması + tarife seçici
│   ├── PaymentsViewModel.cs          # Tahsilat, plan onayı, borç/gelir özeti
│   ├── DentistEarningsViewModel.cs   # Dişhekimi kazanç ekranı
│   ├── AdminManagementViewModel.cs   # Kullanıcı yönetimi + istatistikler
│   └── InstitutionAgreementsViewModel.cs
├── Views/                    # XAML görünümleri (yukarıdaki ViewModel'lerle 1:1)
├── Services/
│   ├── ApiService.cs         # HTTP istemcisi; appsettings.json'dan adres okur
│   ├── AuthService.cs        # Login/logout (logout backend'de refresh token iptal eder)
│   ├── NotificationService.cs # Socket.IO istemcisi (SocketIOClient NuGet)
│   ├── PatientService.cs / AppointmentService.cs / TreatmentService.cs
│   ├── InstitutionAgreementService.cs / TariffService.cs
│   └── UnauthorizedException.cs
├── Helpers/
│   ├── ObservableObject.cs   # INotifyPropertyChanged temel sınıfı
│   ├── RelayCommand.cs       # ICommand implementasyonu
│   ├── Converters.cs         # XAML value converter'ları
│   └── StatusItem.cs
├── Assets/                   # Logo, mouth_chart.png
├── Data/tdb_2026_tarife_full.json
├── appsettings.json           # ApiBaseUrl, SocketUrl (exe ile aynı klasörde)
└── App.xaml / App.xaml.cs     # Uygulama girişi, global exception handler
```

## Yapılandırma

Backend adresi `appsettings.json`'dan okunur (dosya yoksa `localhost:3000`
varsayılanına düşer):

```json
{
  "ApiBaseUrl": "http://localhost:3000/api",
  "SocketUrl": "http://localhost:3000"
}
```

Prod dağıtımında bu dosyayı exe'nin yanına koyup gerçek sunucu adresiyle
güncelleyin (bkz. kök `deploy/DEPLOYMENT.md`).

## Derleme ve Çalıştırma

```bash
cd DentalApp.Desktop
dotnet restore
dotnet build
dotnet run
```

Veya Visual Studio'da açıp F5.

## NuGet Paketleri

- **SocketIOClient** (3.1.2) — Socket.IO v4 istemcisi (backend'le aynı
  protokol; web `socket.io-client`, mobil `socket_io_client` ile eşleşir)
- **Newtonsoft.Json** (13.0.3) — JSON serileştirme
- **MaterialDesignThemes** (5.0.0) / **MaterialDesignColors** (3.0.0) —
  Material Design arayüz bileşenleri

## Rol bazlı erişim

`MainViewModel` içindeki `IsAdmin`/`IsSecretary`/`IsDentist` bayrakları
navigasyon menüsünü ve düzenleme yetkilerini belirler:

| Özellik | Admin/Patron | Sekreter | Dişhekimi |
|---|---|---|---|
| Kontrol Paneli, Randevular, Tedaviler | ✓ | ✓ | ✓ |
| Hastalar | ✓ (düzenle) | ✓ (düzenle) | ✓ (salt okunur) |
| Ödemeler, Kurum Anlaşmaları | ✓ | ✓ | — |
| Kazançlarım | — | — | ✓ |
| Kullanıcı Yönetimi | ✓ | — | — |
| Protez İş Süreçleri, SMS | "Yakında" (placeholder) | | |

## Gerçek zamanlı bildirimler

`NotificationService`, `SocketIOClient` ile backend'in Socket.IO sunucusuna
(`src/services/notificationHub.js`) `handshake.auth.token` üzerinden JWT
kimlik doğrulamasıyla bağlanır; gelen bildirimler `MainViewModel` üzerinden
bir Material Design Snackbar olarak gösterilir.

## Test

Ayrı bir test projesi yok; doğrulama `dotnet build` (0 hata/uyarı olmalı) ve
manuel uçtan uca test ile yapılır (bkz. kök `README.md` → Testing).

## License
ISC
