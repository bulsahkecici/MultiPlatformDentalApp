import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';
import 'appointment_form_screen.dart';

/// Günlük randevu listesi: tarih seçici + iptal + yeni randevu.
class AppointmentsScreen extends StatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  State<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends State<AppointmentsScreen> {
  DateTime _selectedDate = DateTime.now();
  List<Appointment> _appointments = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final repo = context.read<ApiRepository>();
    final date = DateFormat('yyyy-MM-dd').format(_selectedDate);
    try {
      final results =
          await repo.getAppointments(startDate: date, endDate: date);
      if (!mounted) return;
      results.sort((a, b) => a.startTime.compareTo(b.startTime));
      setState(() {
        _appointments = results;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _load();
    }
  }

  Future<void> _cancel(Appointment appointment) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Randevuyu İptal Et'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('${appointment.patientFullName} — '
                '${appointment.startTime.substring(0, 5)}'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration:
                  const InputDecoration(labelText: 'İptal sebebi (opsiyonel)'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Vazgeç')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('İptal Et')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await context.read<ApiRepository>().cancelAppointment(
            appointment.id,
            reason: reasonController.text.trim().isEmpty
                ? null
                : reasonController.text.trim(),
          );
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _openForm() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AppointmentFormScreen(initialDate: _selectedDate),
      ),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final dateLabel = DateFormat('d MMMM yyyy, EEEE', 'tr_TR');

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  onPressed: () {
                    setState(() => _selectedDate =
                        _selectedDate.subtract(const Duration(days: 1)));
                    _load();
                  },
                ),
                Expanded(
                  child: InkWell(
                    onTap: _pickDate,
                    child: Center(
                      child: Text(
                        dateLabel.format(_selectedDate),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  onPressed: () {
                    setState(() => _selectedDate =
                        _selectedDate.add(const Duration(days: 1)));
                    _load();
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _appointments.isEmpty
                        ? ListView(
                            children: const [
                              Padding(
                                padding: EdgeInsets.all(32),
                                child: Center(
                                    child: Text('Bu tarihte randevu yok.')),
                              ),
                            ],
                          )
                        : ListView.builder(
                            itemCount: _appointments.length,
                            itemBuilder: (context, i) {
                              final appt = _appointments[i];
                              final cancelled = appt.status == 'cancelled';
                              return Card(
                                margin: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 4),
                                child: ListTile(
                                  leading: Column(
                                    mainAxisAlignment:
                                        MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        appt.startTime.substring(0, 5),
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold),
                                      ),
                                      Text(appt.endTime.substring(0, 5),
                                          style: const TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey)),
                                    ],
                                  ),
                                  title: Text(
                                    appt.patientFullName.isEmpty
                                        ? 'Hasta #${appt.patientId}'
                                        : appt.patientFullName,
                                    style: cancelled
                                        ? const TextStyle(
                                            decoration:
                                                TextDecoration.lineThrough)
                                        : null,
                                  ),
                                  subtitle: Text([
                                    if (appt.appointmentType != null)
                                      appt.appointmentType!,
                                    if (appt.dentistEmail != null)
                                      appt.dentistEmail!,
                                    if (cancelled &&
                                        appt.cancellationReason != null)
                                      'İptal: ${appt.cancellationReason}',
                                  ].join(' · ')),
                                  trailing: cancelled
                                      ? const Icon(Icons.event_busy,
                                          color: Colors.red)
                                      : IconButton(
                                          icon: const Icon(Icons.cancel_outlined),
                                          tooltip: 'İptal et',
                                          onPressed: () => _cancel(appt),
                                        ),
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openForm,
        child: const Icon(Icons.add),
      ),
    );
  }
}
