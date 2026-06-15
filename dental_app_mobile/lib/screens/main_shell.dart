import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../utils/constants.dart';
import 'admin_screen.dart';
import 'appointment_list_screen.dart';
import 'dashboard_screen.dart';
import 'earnings_screen.dart';
import 'patient_list_screen.dart';
import 'payments_screen.dart';
import 'treatment_list_screen.dart';

class MenuItem {
  final String label;
  final IconData icon;
  final List<String> roles;
  final Widget screen;

  const MenuItem({
    required this.label,
    required this.icon,
    required this.roles,
    required this.screen,
  });
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  List<MenuItem> _menuItems(AuthProvider auth) => [
        MenuItem(
          label: AppStrings.menuDashboard,
          icon: Icons.dashboard,
          roles: const ['admin', 'dentist', 'secretary'],
          screen: const DashboardScreen(),
        ),
        MenuItem(
          label: AppStrings.menuPatients,
          icon: Icons.groups,
          roles: const ['admin', 'dentist', 'secretary'],
          screen: const PatientListScreen(),
        ),
        MenuItem(
          label: AppStrings.menuAppointments,
          icon: Icons.event,
          roles: const ['admin', 'dentist', 'secretary'],
          screen: const AppointmentListScreen(),
        ),
        MenuItem(
          label: AppStrings.menuTreatments,
          icon: Icons.medical_services,
          roles: const ['admin', 'dentist', 'secretary'],
          screen: const TreatmentListScreen(),
        ),
        MenuItem(
          label: AppStrings.menuPayments,
          icon: Icons.payments,
          roles: const ['admin', 'secretary'],
          screen: const PaymentsScreen(),
        ),
        MenuItem(
          label: AppStrings.menuEarnings,
          icon: Icons.show_chart,
          roles: const ['dentist'],
          screen: const EarningsScreen(),
        ),
        MenuItem(
          label: AppStrings.menuAdmin,
          icon: Icons.admin_panel_settings,
          roles: const ['admin'],
          screen: const AdminScreen(),
        ),
      ];

  List<MenuItem> _visibleItems(AuthProvider auth) {
    final roles = auth.currentUser?.roles ?? [];
    return _menuItems(auth)
        .where((item) => item.roles.any(roles.contains))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final items = _visibleItems(auth);

    if (items.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text(AppStrings.appTitle)),
        body: const Center(child: Text('Bu hesap için menü bulunamadı.')),
      );
    }

    if (_selectedIndex >= items.length) {
      _selectedIndex = 0;
    }

    final current = items[_selectedIndex];

    return Scaffold(
      key: _scaffoldKey,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(current.label, style: const TextStyle(fontSize: 18)),
            Text(
              AppStrings.panelSubtitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white70,
                  ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Center(
              child: Text(
                auth.currentUser?.email ?? '',
                style: const TextStyle(fontSize: 13),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: AppStrings.logout,
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      drawer: Drawer(
        child: Column(
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF10294F), Color(0xFF153E75)],
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(11),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF6CC1FF), Color(0xFF2E88FF)],
                      ),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'BD',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          AppStrings.appTitle,
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          AppStrings.appSubtitle,
                          style: TextStyle(color: Color(0xFFB5CFF7), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                itemCount: items.length,
                itemBuilder: (context, index) {
                  final item = items[index];
                  final selected = index == _selectedIndex;
                  return ListTile(
                    leading: Icon(item.icon),
                    title: Text(item.label),
                    selected: selected,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    onTap: () {
                      setState(() => _selectedIndex = index);
                      Navigator.pop(context);
                    },
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.verified_user, size: 18),
                  const SizedBox(width: 8),
                  Text(auth.roleLabel),
                ],
              ),
            ),
          ],
        ),
      ),
      body: current.screen,
    );
  }
}
