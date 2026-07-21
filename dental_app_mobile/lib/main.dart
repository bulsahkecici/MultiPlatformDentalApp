import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'core/api_repository.dart';
import 'core/socket_service.dart';
import 'providers/auth_provider.dart';
import 'providers/notification_provider.dart';
import 'screens/home/home_shell.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Türkçe tarih biçimleri (DateFormat 'tr_TR') için gerekli
  await initializeDateFormatting('tr_TR');
  runApp(const DentalApp());
}

/// "Aqua Mint" marka teması — turkuaz (ana), nane (ikincil), mercan (vurgu).
/// Kartlar/butonlar çok yuvarlak köşelerle (pill'e yakın) ferah bir his verir.
ThemeData _buildTheme() {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: const Color(0xFF0D9488), // teal-600
    secondary: const Color(0xFFFB7185), // mercan (coral-400)
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: const Color(0xFFF0FDFA),
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(shape: const StadiumBorder()),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(shape: const StadiumBorder()),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(shape: const StadiumBorder()),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: colorScheme.outlineVariant),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: colorScheme.primary, width: 2),
      ),
    ),
    chipTheme: const ChipThemeData(
      shape: StadiumBorder(),
      side: BorderSide.none,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: colorScheme.primary,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: colorScheme.secondary,
      foregroundColor: Colors.white,
      shape: const StadiumBorder(),
    ),
  );
}

class DentalApp extends StatelessWidget {
  const DentalApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Bağımlılıklar tek noktada kurulur; API adresi core/config.dart'tan gelir
    final apiClient = ApiClient();
    final repository = ApiRepository(apiClient);
    final socketService = SocketService();

    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        Provider<ApiRepository>.value(value: repository),
        Provider<SocketService>.value(value: socketService),
        ChangeNotifierProvider<AuthProvider>(
          create: (_) => AuthProvider(apiClient, repository, socketService),
        ),
        ChangeNotifierProvider<NotificationProvider>(
          create: (_) => NotificationProvider(repository, socketService),
        ),
      ],
      child: MaterialApp(
        title: 'Bulka Dental',
        debugShowCheckedModeBanner: false,
        theme: _buildTheme(),
        home: const AuthWrapper(),
      ),
    );
  }
}

/// Oturum durumuna göre Login veya ana kabuk gösterir.
/// Açılışta checkAuth ile saklanan token backend'de doğrulanır.
class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (mounted) {
        context.read<AuthProvider>().checkAuth();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        if (!auth.initialized) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return auth.isAuthenticated ? const HomeShell() : const LoginScreen();
      },
    );
  }
}
