import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'providers/appointment_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/patient_provider.dart';
import 'providers/treatment_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_service.dart';
import 'utils/constants.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('tr_TR');
  runApp(const DentalApp());
}

class DentalApp extends StatelessWidget {
  const DentalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiService>(
          create: (_) => ApiService(baseUrl: ApiConstants.baseUrl),
        ),
        ChangeNotifierProxyProvider<ApiService, AuthProvider>(
          create: (context) => AuthProvider(context.read<ApiService>()),
          update: (context, api, auth) => auth ?? AuthProvider(api),
        ),
        ChangeNotifierProxyProvider<ApiService, PatientProvider>(
          create: (context) => PatientProvider(context.read<ApiService>()),
          update: (context, api, provider) =>
              provider ?? PatientProvider(api),
        ),
        ChangeNotifierProxyProvider<ApiService, AppointmentProvider>(
          create: (context) =>
              AppointmentProvider(context.read<ApiService>()),
          update: (context, api, provider) =>
              provider ?? AppointmentProvider(api),
        ),
        ChangeNotifierProxyProvider<ApiService, TreatmentProvider>(
          create: (context) =>
              TreatmentProvider(context.read<ApiService>()),
          update: (context, api, provider) =>
              provider ?? TreatmentProvider(api),
        ),
      ],
      child: const DentalAppView(),
    );
  }
}

class DentalAppView extends StatelessWidget {
  const DentalAppView({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppStrings.appTitle,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1976D2),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => context.read<AuthProvider>().checkAuth());
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        if (auth.isLoading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (auth.isAuthenticated) {
          return const HomeScreen();
        }
        return const LoginScreen();
      },
    );
  }
}
