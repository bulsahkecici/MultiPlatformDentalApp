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
        theme: ThemeData(
          useMaterial3: true,
          colorScheme:
              ColorScheme.fromSeed(seedColor: const Color(0xFF1E3A8A)),
        ),
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
