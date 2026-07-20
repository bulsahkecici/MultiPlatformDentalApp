/// Uygulama yapılandırması.
///
/// API adresi derleme zamanında `--dart-define=API_URL=...` ile verilir.
/// Varsayılan `http://10.0.2.2:3000` Android emülatöründen host makinenin
/// localhost'una işaret eder (fiziksel cihazda LAN IP'si veya prod domain verin).
///
/// Örnekler:
///   flutter run --dart-define=API_URL=http://192.168.1.20:3000
///   flutter build apk --dart-define=API_URL=https://klinik.example.com
class AppConfig {
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  /// Socket.IO sunucusu API ile aynı host üzerinde çalışır.
  static const String socketUrl = apiUrl;
}
