import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../providers/notification_provider.dart';
import '../../core/mobile_access_policy.dart';
import '../appointments/appointments_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../financial/financial_overview_screen.dart';
import '../notifications/notifications_screen.dart';
import '../patients/patients_screen.dart';
import '../treatments/treatments_screen.dart';

class _MenuEntry {
  final String label;
  final IconData icon;
  final Widget Function() builder;

  const _MenuEntry(this.label, this.icon, this.builder);
}

/// Rol bazlı ana kabuk: Drawer navigasyonu + bildirim rozeti.
/// Mobil rol matrisi:
///  - patron (admin): finansal durum ve randevular, tamamen salt okunur
///  - diş hekimi: kendi randevuları ile hasta bilgisi/geçmişi işlemleri
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (mounted) {
        context.read<NotificationProvider>().refreshUnreadCount();
      }
    });
  }

  List<_MenuEntry> _menuFor(AuthProvider auth) {
    final access = MobileAccessPolicy.forUser(auth.currentUser);

    return [
      _MenuEntry(
          'Kontrol Paneli', Icons.dashboard, () => const DashboardScreen()),
      _MenuEntry('Randevular', Icons.event, () => const AppointmentsScreen()),
      if (access.canViewFinancials)
        _MenuEntry('Finansal Durum', Icons.account_balance_wallet,
            () => const FinancialOverviewScreen()),
      if (access.canManagePatients)
        _MenuEntry('Hastalar', Icons.people, () => const PatientsScreen()),
      if (access.canManageTreatments)
        _MenuEntry('Tedaviler', Icons.medical_services,
            () => const TreatmentsScreen()),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final menu = _menuFor(auth);
    final index = _selectedIndex < menu.length ? _selectedIndex : 0;

    // Canlı bildirim geldiğinde snackbar göster
    context.watch<NotificationProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text(menu[index].label),
        backgroundColor: const Color(0xFF134E4A),
        foregroundColor: Colors.white,
        actions: [
          Consumer<NotificationProvider>(
            builder: (context, notif, _) => IconButton(
              tooltip: 'Bildirimler',
              icon: Badge(
                isLabelVisible: notif.unreadCount > 0,
                label: Text('${notif.unreadCount}'),
                child: const Icon(Icons.notifications),
              ),
              onPressed: () {
                Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => NotificationsScreen(
                    readOnly:
                        MobileAccessPolicy.forUser(auth.currentUser).isOwner,
                  ),
                ));
              },
            ),
          ),
          IconButton(
            tooltip: 'Çıkış',
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF134E4A)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  const Text(
                    'BULKA DENTAL',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    auth.currentUser?.displayName ?? '',
                    style: const TextStyle(color: Colors.white70),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    MobileAccessPolicy.forUser(auth.currentUser).roleLabel,
                    style: const TextStyle(color: Colors.white60, fontSize: 12),
                  ),
                ],
              ),
            ),
            for (var i = 0; i < menu.length; i++)
              ListTile(
                leading: Icon(menu[i].icon),
                title: Text(menu[i].label),
                selected: i == index,
                onTap: () {
                  setState(() => _selectedIndex = i);
                  Navigator.of(context).pop();
                },
              ),
          ],
        ),
      ),
      body: _LiveNotificationListener(child: menu[index].builder()),
    );
  }
}

/// Canlı bildirimleri SnackBar olarak gösterir.
class _LiveNotificationListener extends StatefulWidget {
  final Widget child;

  const _LiveNotificationListener({required this.child});

  @override
  State<_LiveNotificationListener> createState() =>
      _LiveNotificationListenerState();
}

class _LiveNotificationListenerState extends State<_LiveNotificationListener> {
  @override
  void initState() {
    super.initState();
    final socketService = context.read<AuthProvider>().socketService;
    socketService.notifications.listen((notification) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${notification.title}: ${notification.message}'),
          duration: const Duration(seconds: 4),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
