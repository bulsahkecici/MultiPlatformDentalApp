import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_repository.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';

/// Rol bazlı kontrol paneli:
///  - Herkes: bugünkü randevular
///  - Admin: klinik istatistikleri + finansal özet
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<Appointment> _todayAppointments = [];
  AdminStatistics? _stats;
  double _totalIncome = 0;
  double _totalReceivables = 0;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = context.read<ApiRepository>();
    final user = context.read<AuthProvider>().currentUser;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final appointments =
          await repo.getAppointments(startDate: today, endDate: today);
      AdminStatistics? stats;
      double income = 0, receivables = 0;
      if (user?.isAdmin ?? false) {
        try {
          stats = await repo.getAdminStatistics();
          income = await repo.getTotalIncome();
          receivables = await repo.getTotalReceivables();
        } catch (_) {
          // İstatistik yüklenemezse randevular yine gösterilir
        }
      }
      if (!mounted) return;
      setState(() {
        _todayAppointments =
            appointments.where((a) => a.status != 'cancelled').toList();
        _stats = stats;
        _totalIncome = income;
        _totalReceivables = receivables;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺');

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return _ErrorRetry(message: _error!, onRetry: _load);
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Hoş geldiniz, ${user?.displayName ?? ''}',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 16),
          if (_stats != null) ...[
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    icon: Icons.people,
                    label: 'Toplam Hasta',
                    value: '${_stats!.totalPatients}',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    icon: Icons.event,
                    label: 'Yaklaşan Randevu',
                    value: '${_stats!.upcomingAppointmentsCount}',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    icon: Icons.payments,
                    label: 'Toplam Gelir',
                    value: money.format(_totalIncome),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    icon: Icons.account_balance_wallet,
                    label: 'Toplam Alacak',
                    value: money.format(_totalReceivables),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
          ],
          Text(
            'Bugünkü Randevular (${_todayAppointments.length})',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          if (_todayAppointments.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('Bugün için randevu yok.'),
              ),
            ),
          for (final appt in _todayAppointments)
            Card(
              child: ListTile(
                leading: const Icon(Icons.schedule),
                title: Text(appt.patientFullName.isEmpty
                    ? 'Hasta #${appt.patientId}'
                    : appt.patientFullName),
                subtitle: Text(
                    '${appt.startTime.substring(0, 5)} - ${appt.endTime.substring(0, 5)}'
                    '${appt.appointmentType != null ? ' · ${appt.appointmentType}' : ''}'),
                trailing: _StatusChip(status: appt.status),
              ),
            ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: const Color(0xFF1E3A8A)),
            const SizedBox(height: 8),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            Text(
              value,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    const labels = {
      'scheduled': 'Planlandı',
      'confirmed': 'Onaylandı',
      'completed': 'Tamamlandı',
      'cancelled': 'İptal',
      'no_show': 'Gelmedi',
    };
    const colors = {
      'scheduled': Colors.blue,
      'confirmed': Colors.teal,
      'completed': Colors.green,
      'cancelled': Colors.red,
      'no_show': Colors.orange,
    };
    return Chip(
      label: Text(labels[status] ?? status,
          style: const TextStyle(fontSize: 12, color: Colors.white)),
      backgroundColor: colors[status] ?? Colors.grey,
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorRetry({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Tekrar Dene')),
          ],
        ),
      ),
    );
  }
}
