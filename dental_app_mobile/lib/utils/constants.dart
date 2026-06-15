import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConstants {
  static const int defaultPageSize = 50;

  /// Backend API base URL (no trailing slash).
  /// Android emulator uses 10.0.2.2 to reach host localhost:3000.
  static String get baseUrl {
    if (kIsWeb) return 'http://localhost:3000';
    if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }
}

class AppStrings {
  static const appTitle = 'BULKA DENTAL';
  static const appSubtitle = 'Klinik Operasyon Paneli';
  static const panelTitle = 'Klinik Paneli';
  static const panelSubtitle = 'Hasta, randevu ve finans takibi';

  // Menu
  static const menuDashboard = 'Kontrol Paneli';
  static const menuPatients = 'Hastalar';
  static const menuAppointments = 'Randevular';
  static const menuTreatments = 'Tedaviler';
  static const menuPayments = 'Ödemeler';
  static const menuEarnings = 'Kazançlarım';
  static const menuAdmin = 'Kullanıcı Yönetimi';
  static const logout = 'Çıkış';
}
