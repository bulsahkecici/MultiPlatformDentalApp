import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/patient_picker.dart';

/// Yeni randevu formu.
/// Backend çakışma kontrolü yapar; 409 dönerse mesaj gösterilir.
class AppointmentFormScreen extends StatefulWidget {
  final DateTime initialDate;
  final Appointment? appointment;
  final Patient? initialPatient;

  const AppointmentFormScreen({
    super.key,
    required this.initialDate,
    this.appointment,
    this.initialPatient,
  });

  @override
  State<AppointmentFormScreen> createState() => _AppointmentFormScreenState();
}

class _AppointmentFormScreenState extends State<AppointmentFormScreen> {
  Patient? _patient;
  late DateTime _date;
  TimeOfDay _startTime = const TimeOfDay(hour: 9, minute: 0);
  int _durationMinutes = 30;
  final _typeController = TextEditingController();
  final _notesController = TextEditingController();
  String _status = 'scheduled';
  bool _saving = false;

  bool get _isEdit => widget.appointment != null;

  @override
  void initState() {
    super.initState();
    final appointment = widget.appointment;
    _date = appointment == null
        ? widget.initialDate
        : DateTime.tryParse(appointment.appointmentDate) ?? widget.initialDate;
    _patient = widget.initialPatient;
    if (appointment != null) {
      _patient = Patient(
        id: appointment.patientId,
        firstName: appointment.patientFirstName,
        lastName: appointment.patientLastName,
      );
      _startTime = _parseTime(appointment.startTime);
      final end = _parseTime(appointment.endTime);
      final duration = (end.hour * 60 + end.minute) -
          (_startTime.hour * 60 + _startTime.minute);
      if ([15, 30, 45, 60, 90, 120].contains(duration)) {
        _durationMinutes = duration;
      }
      _typeController.text = appointment.appointmentType ?? '';
      _notesController.text = appointment.notes ?? '';
      _status = appointment.status;
    }
  }

  TimeOfDay _parseTime(String value) {
    final parts = value.split(':');
    return TimeOfDay(
      hour: int.tryParse(parts.first) ?? 9,
      minute: parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0,
    );
  }

  @override
  void dispose() {
    _typeController.dispose();
    _notesController.dispose();
    super.dispose();
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
      final repo = context.read<ApiRepository>();
      final appointmentType = _typeController.text.trim();
      final notes = _notesController.text.trim();
      if (_isEdit) {
        await repo.updateAppointment(widget.appointment!.id, {
          'appointmentDate': DateFormat('yyyy-MM-dd').format(_date),
          'startTime': _formatTime(_startTime),
          'endTime': _formatTime(_endTime),
          'appointmentType': appointmentType.isEmpty ? null : appointmentType,
          'notes': notes,
          'status': _status,
        });
      } else {
        final currentUser = context.read<AuthProvider>().currentUser;
        await repo.createAppointment(Appointment(
          id: 0,
          patientId: _patient!.id,
          // Diş hekimi mobilde yalnızca kendi adına randevu oluşturur.
          dentistId: currentUser?.id,
          appointmentDate: DateFormat('yyyy-MM-dd').format(_date),
          startTime: _formatTime(_startTime),
          endTime: _formatTime(_endTime),
          appointmentType: appointmentType.isEmpty ? null : appointmentType,
          notes: notes,
        ));
      }
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
        title: Text(_isEdit ? 'Randevuyu Düzenle' : 'Yeni Randevu'),
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
              trailing: _isEdit ? null : const Icon(Icons.chevron_right),
              onTap: _isEdit
                  ? null
                  : () async {
                      final selected = await showPatientPicker(context);
                      if (selected != null) setState(() => _patient = selected);
                    },
            ),
          ),
          const SizedBox(height: 8),
          // Tarih
          Card(
            child: ListTile(
              leading: const Icon(Icons.calendar_today),
              title: Text(DateFormat('d MMMM yyyy', 'tr_TR').format(_date)),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2020),
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
                  onChanged: (v) => setState(() => _durationMinutes = v ?? 30),
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
          if (_isEdit) ...[
            DropdownButtonFormField<String>(
              initialValue: _status,
              decoration: const InputDecoration(
                labelText: 'Durum',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'scheduled', child: Text('Planlandı')),
                DropdownMenuItem(value: 'confirmed', child: Text('Onaylandı')),
                DropdownMenuItem(value: 'completed', child: Text('Tamamlandı')),
                DropdownMenuItem(value: 'no_show', child: Text('Gelmedi')),
              ],
              onChanged: (value) =>
                  setState(() => _status = value ?? 'scheduled'),
            ),
            const SizedBox(height: 12),
          ],
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
            label: Text(_isEdit ? 'Değişiklikleri Kaydet' : 'Randevu Oluştur'),
          ),
        ],
      ),
    );
  }
}
