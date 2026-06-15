import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../providers/appointment_provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _isLoading = false;
  DashboardStats? _adminStats;
  List<Appointment> _upcomingAppointments = [];
  int _todayCount = 0;
  DateTime _now = DateTime.now();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _loadData() async {
    final auth = context.read<AuthProvider>();
    setState(() => _isLoading = true);

    try {
      if (auth.isAdmin) {
        final api = context.read<ApiService>();
        final response = await api.get('/api/admin/statistics');
        _adminStats = DashboardStats.fromAdminResponse(
          Map<String, dynamic>.from(response as Map),
        );
      } else {
        final today = DateTime.now();
        final start = _formatDate(today);
        final end = _formatDate(
          today.add(Duration(days: auth.isSecretary ? 1 : 7)),
        );

        await context.read<AppointmentProvider>().fetchAppointments(
              startDate: start,
              endDate: end,
            );
        final appointments = context.read<AppointmentProvider>().appointments;
        _upcomingAppointments = List.from(appointments)
          ..sort((a, b) {
            final aDate = DateTime.parse(
              '${a.appointmentDate.toIso8601String().split('T').first}T${a.startTime}',
            );
            final bDate = DateTime.parse(
              '${b.appointmentDate.toIso8601String().split('T').first}T${b.startTime}',
            );
            return aDate.compareTo(bDate);
          });
        _todayCount = _upcomingAppointments
            .where(
              (a) =>
                  a.appointmentDate.toIso8601String().split('T').first == start,
            )
            .length;
      }
    } catch (e) {
      debugPrint('Dashboard load error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatDate(DateTime date) =>
      DateFormat('yyyy-MM-dd').format(date);

  String _formatCurrency(double? amount) {
    if (amount == null || amount == 0) return '₺0';
    return '₺${NumberFormat.decimalPattern('tr_TR').format(amount)}';
  }

  String _formatDisplayDate(DateTime date) =>
      DateFormat('dd.MM.yyyy', 'tr_TR').format(date);

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (auth.isDentist || auth.isSecretary)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFFE7F0FF),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.schedule, color: Color(0xFF1E3A8A), size: 18),
                  const SizedBox(width: 8),
                  Text(
                    DateFormat('dd.MM.yyyy HH:mm:ss').format(_now),
                    style: const TextStyle(
                      color: Color(0xFF1E3A8A),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          if (auth.isAdmin) ...[
            Text(
              'Admin Kontrol Paneli',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: const Color(0xFF15366A),
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 16),
            if (_adminStats != null) ...[
              _StatCard(label: 'Toplam Hasta', value: '${_adminStats!.totalPatients}'),
              _StatCard(
                label: 'Geçen Ay Finansal',
                value: _formatCurrency(_adminStats!.lastMonthFinancial),
              ),
              _StatCard(
                label: 'Geçen Ay Hasta',
                value: '${_adminStats!.lastMonthPatients}',
              ),
              _StatCard(
                label: 'Geçen Ay İşlem',
                value: '${_adminStats!.lastMonthTransactions}',
              ),
              _StatCard(
                label: 'Bu Ay Hasta',
                value: '${_adminStats!.thisMonthPatients}',
              ),
              _StatCard(
                label: 'Bu Ay Finansal',
                value: _formatCurrency(_adminStats!.thisMonthFinancial),
              ),
              _StatCard(
                label: 'Yaklaşan Randevu',
                value: '${_adminStats!.upcomingAppointmentsCount}',
              ),
            ],
          ],
          if (auth.isDentist || auth.isSecretary) ...[
            Text(
              auth.isDentist
                  ? 'Diş Hekimi Kontrol Paneli'
                  : 'Sekreter Kontrol Paneli',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: const Color(0xFF15366A),
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    label: 'Yaklaşan Randevu',
                    value: '${_upcomingAppointments.length}',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    label: 'Bugün Randevu',
                    value: '$_todayCount',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      auth.isSecretary
                          ? 'Bugün ve Yarın Randevuları'
                          : 'Yaklaşan Randevular',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (_upcomingAppointments.isEmpty)
                      const Text('Randevu bulunmamaktadır.')
                    else
                      ..._upcomingAppointments.take(20).map(
                            (apt) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.event),
                              title: Text(
                                '${_formatDisplayDate(apt.appointmentDate)} ${apt.startTime}',
                              ),
                              subtitle: Text(
                                apt.patientFullName ?? 'Hasta #${apt.patientId}',
                              ),
                            ),
                          ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;

  const _StatCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1253A2),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(color: Color(0xFF576380)),
            ),
          ],
        ),
      ),
    );
  }
}
