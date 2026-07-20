import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';
import '../../widgets/patient_picker.dart';

/// Yeni randevu formu.
/// Backend çakışma kontrolü yapar; 409 dönerse mesaj gösterilir.
class AppointmentFormScreen extends StatefulWidget {
  final DateTime initialDate;

  const AppointmentFormScreen({super.key, required this.initialDate});

  @override
  State<AppointmentFormScreen> createState() => _AppointmentFormScreenState();
}

class _AppointmentFormScreenState extends State<AppointmentFormScreen> {
  Patient? _patient;
  DentistSummary? _dentist;
  List<DentistSummary> _dentists = [];
  late DateTime _date;
  TimeOfDay _startTime = const TimeOfDay(hour: 9, minute: 0);
  int _durationMinutes = 30;
  final _typeController = TextEditingController();
  final _notesController = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _date = widget.initialDate;
    _loadDentists();
  }

  @override
  void dispose() {
    _typeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadDentists() async {
    try {
      final dentists = await context.read<ApiRepository>().getDentists();
      if (!mounted) return;
      setState(() => _dentists = dentists);
    } catch (_) {
      // Liste yüklenemezse hekim seçimi opsiyonel kalır
    }
  }

  String _formatTime(TimeOfDay time) =>
      '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}:00';

  TimeOfDay get _endTime {
    final total = _startTime.hour * 60 + _startTime.minute + _durationMinutes;
    return TimeOfDay(hour: (total ~/ 60) % 24, minute: total % 60);
  }

  Future<void> _save() async {
    if (_patient == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen hasta seçin')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await context.read<ApiRepository>().createAppointment(Appointment(
            id: 0,
            patientId: _patient!.id,
            dentistId: _dentist?.id,
            appointmentDate: DateFormat('yyyy-MM-dd').format(_date),
            startTime: _formatTime(_startTime),
            endTime: _formatTime(_endTime),
            appointmentType: _typeController.text.trim().isEmpty
                ? null
                : _typeController.text.trim(),
            notes: _notesController.text.trim(),
          ));
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      // 409 = çakışma; backend Türkçe mesaj döner
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Yeni Randevu'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Hasta seçimi
          Card(
            child: ListTile(
              leading: const Icon(Icons.person),
              title: Text(_patient?.fullName ?? 'Hasta seçin *'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                final selected = await showPatientPicker(context);
                if (selected != null) setState(() => _patient = selected);
              },
            ),
          ),
          const SizedBox(height: 8),
          // Dişhekimi seçimi
          DropdownButtonFormField<DentistSummary>(
            initialValue: _dentist,
            decoration: const InputDecoration(
              labelText: 'Dişhekimi',
              border: OutlineInputBorder(),
            ),
            items: _dentists
                .map((d) => DropdownMenuItem(
                    value: d, child: Text(d.displayName)))
                .toList(),
            onChanged: (v) => setState(() => _dentist = v),
          ),
          const SizedBox(height: 12),
          // Tarih
          Card(
            child: ListTile(
              leading: const Icon(Icons.calendar_today),
              title: Text(DateFormat('d MMMM yyyy', 'tr_TR').format(_date)),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime.now().subtract(const Duration(days: 1)),
                  lastDate: DateTime(2035),
                );
                if (picked != null) setState(() => _date = picked);
              },
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Card(
                  child: ListTile(
                    leading: const Icon(Icons.access_time),
                    title: Text(_startTime.format(context)),
                    subtitle: const Text('Başlangıç'),
                    onTap: () async {
                      final picked = await showTimePicker(
                          context: context, initialTime: _startTime);
                      if (picked != null) {
                        setState(() => _startTime = picked);
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<int>(
                  initialValue: _durationMinutes,
                  decoration: const InputDecoration(
                    labelText: 'Süre',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 15, child: Text('15 dk')),
                    DropdownMenuItem(value: 30, child: Text('30 dk')),
                    DropdownMenuItem(value: 45, child: Text('45 dk')),
                    DropdownMenuItem(value: 60, child: Text('1 saat')),
                    DropdownMenuItem(value: 90, child: Text('1,5 saat')),
                    DropdownMenuItem(value: 120, child: Text('2 saat')),
                  ],
                  onChanged: (v) =>
                      setState(() => _durationMinutes = v ?? 30),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _typeController,
            decoration: const InputDecoration(
              labelText: 'Randevu Türü (muayene, dolgu...)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notesController,
            decoration: const InputDecoration(
              labelText: 'Notlar',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.event_available),
            label: const Text('Randevu Oluştur'),
          ),
        ],
      ),
    );
  }
}
