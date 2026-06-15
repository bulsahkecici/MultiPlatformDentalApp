import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/appointment_provider.dart';
import '../providers/auth_provider.dart';
import 'appointment_form_screen.dart';

class AppointmentListScreen extends StatefulWidget {
  const AppointmentListScreen({super.key});

  @override
  State<AppointmentListScreen> createState() => _AppointmentListScreenState();
}

class _AppointmentListScreenState extends State<AppointmentListScreen> {
  DateTime _selectedDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAppointments());
  }

  Future<void> _loadAppointments() async {
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    await context.read<AppointmentProvider>().fetchAppointments(
          startDate: dateStr,
          endDate: dateStr,
        );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      await _loadAppointments();
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'scheduled':
        return 'Planlandı';
      case 'completed':
        return 'Tamamlandı';
      case 'cancelled':
        return 'İptal';
      case 'no_show':
        return 'Gelmedi';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppointmentProvider>();

    return Scaffold(
      floatingActionButton: context.read<AuthProvider>().isDentist
          ? null
          : FloatingActionButton(
              onPressed: () async {
                final created = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const AppointmentFormScreen(),
                  ),
                );
                if (created == true) await _loadAppointments();
              },
              tooltip: 'Yeni Randevu',
              child: const Icon(Icons.add),
            ),
      body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Randevu Yönetimi',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF15366A),
                      ),
                ),
              ),
              OutlinedButton.icon(
                onPressed: _pickDate,
                icon: const Icon(Icons.calendar_today),
                label: Text(DateFormat('dd.MM.yyyy').format(_selectedDate)),
              ),
            ],
          ),
        ),
        Expanded(
          child: provider.isLoading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _loadAppointments,
                  child: provider.appointments.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 80),
                            Center(child: Text('Randevu bulunmamaktadır.')),
                          ],
                        )
                      : ListView.builder(
                          itemCount: provider.appointments.length,
                          itemBuilder: (context, index) {
                            final apt = provider.appointments[index];
                            return Card(
                              margin: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 4,
                              ),
                              child: ListTile(
                                leading: const Icon(Icons.event),
                                title: Text(
                                  '${apt.startTime} - ${apt.endTime}',
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      apt.patientFullName ??
                                          'Hasta #${apt.patientId}',
                                    ),
                                    if (apt.dentistEmail != null)
                                      Text(apt.dentistEmail!),
                                    if (apt.appointmentType != null)
                                      Text(apt.appointmentType!),
                                  ],
                                ),
                                trailing: Chip(
                                  label: Text(_statusLabel(apt.status)),
                                ),
                              ),
                            );
                          },
                        ),
                ),
        ),
      ],
    ),
    );
  }
}
