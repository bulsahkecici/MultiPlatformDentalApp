import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/appointment_provider.dart';
import '../providers/patient_provider.dart';
import '../services/api_service.dart';

class AppointmentFormScreen extends StatefulWidget {
  const AppointmentFormScreen({super.key});

  @override
  State<AppointmentFormScreen> createState() => _AppointmentFormScreenState();
}

class _AppointmentFormScreenState extends State<AppointmentFormScreen> {
  final _formKey = GlobalKey<FormState>();
  int? _patientId;
  int? _dentistId;
  DateTime _date = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 9, minute: 30);
  final _typeController = TextEditingController();
  final _notesController = TextEditingController();
  List<Map<String, dynamic>> _dentists = [];
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await context.read<PatientProvider>().fetchPatients();
      await _loadDentists();
    });
  }

  @override
  void dispose() {
    _typeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadDentists() async {
    try {
      final api = context.read<ApiService>();
      final response = await api.get('/api/users', params: {
        'role': 'dentist',
        'limit': '100',
      });
      final list = (response as Map<String, dynamic>)['users'] as List? ?? [];
      setState(() {
        _dentists = list.map((e) => Map<String, dynamic>.from(e)).toList();
        if (_dentists.isNotEmpty && _dentistId == null) {
          _dentistId = _dentists.first['id'] as int?;
        }
      });
    } catch (e) {
      debugPrint('loadDentists error: $e');
    }
  }

  String _formatTime(TimeOfDay time) {
    final h = time.hour.toString().padLeft(2, '0');
    final m = time.minute.toString().padLeft(2, '0');
    return '$h:$m:00';
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _patientId == null) return;

    setState(() => _isSaving = true);
    try {
      final provider = context.read<AppointmentProvider>();
      final ok = await provider.createAppointment({
        'patientId': _patientId,
        'dentistId': _dentistId,
        'appointmentDate': DateFormat('yyyy-MM-dd').format(_date),
        'startTime': _formatTime(_startTime),
        'endTime': _formatTime(_endTime),
        'appointmentType': _typeController.text.isEmpty ? null : _typeController.text,
        'notes': _notesController.text.isEmpty ? null : _notesController.text,
        'status': 'scheduled',
      });
      if (ok && mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Randevu oluşturuldu')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final patients = context.watch<PatientProvider>().patients;

    return Scaffold(
      appBar: AppBar(title: const Text('Yeni Randevu')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField<int>(
              value: _patientId,
              decoration: const InputDecoration(
                labelText: 'Hasta *',
                border: OutlineInputBorder(),
              ),
              items: patients
                  .map((p) => DropdownMenuItem(value: p.id, child: Text(p.fullName)))
                  .toList(),
              onChanged: (v) => setState(() => _patientId = v),
              validator: (v) => v == null ? 'Hasta seçin' : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              value: _dentistId,
              decoration: const InputDecoration(
                labelText: 'Diş Hekimi',
                border: OutlineInputBorder(),
              ),
              items: _dentists
                  .map((d) => DropdownMenuItem(
                        value: d['id'] as int,
                        child: Text(d['email']?.toString() ?? 'Doktor'),
                      ))
                  .toList(),
              onChanged: (v) => setState(() => _dentistId = v),
            ),
            const SizedBox(height: 12),
            ListTile(
              title: const Text('Tarih'),
              subtitle: Text(DateFormat('dd.MM.yyyy').format(_date)),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime.now(),
                  lastDate: DateTime(2030),
                );
                if (picked != null) setState(() => _date = picked);
              },
            ),
            Row(
              children: [
                Expanded(
                  child: ListTile(
                    title: const Text('Başlangıç'),
                    subtitle: Text(_startTime.format(context)),
                    onTap: () async {
                      final t = await showTimePicker(
                        context: context,
                        initialTime: _startTime,
                      );
                      if (t != null) setState(() => _startTime = t);
                    },
                  ),
                ),
                Expanded(
                  child: ListTile(
                    title: const Text('Bitiş'),
                    subtitle: Text(_endTime.format(context)),
                    onTap: () async {
                      final t = await showTimePicker(
                        context: context,
                        initialTime: _endTime,
                      );
                      if (t != null) setState(() => _endTime = t);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _typeController,
              decoration: const InputDecoration(
                labelText: 'Randevu Türü',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notesController,
              decoration: const InputDecoration(
                labelText: 'Notlar',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _isSaving ? null : _save,
              child: _isSaving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Kaydet'),
            ),
          ],
        ),
      ),
    );
  }
}
