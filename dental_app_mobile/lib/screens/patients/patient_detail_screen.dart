import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';
import '../appointments/appointment_form_screen.dart';
import '../treatments/treatment_form_screen.dart';
import 'patient_form_screen.dart';

/// Hasta kimlik/sağlık bilgileri ile randevu ve tedavi geçmişini bir arada
/// gösterir. Bu ekran yalnızca diş hekimi menüsünden açılır.
class PatientDetailScreen extends StatefulWidget {
  final int patientId;

  const PatientDetailScreen({super.key, required this.patientId});

  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen> {
  Patient? _patient;
  List<Appointment> _appointments = [];
  List<Treatment> _treatments = [];
  bool _loading = true;
  String? _error;

  static const _statusLabels = {
    'scheduled': 'Planlandı',
    'confirmed': 'Onaylandı',
    'completed': 'Tamamlandı',
    'cancelled': 'İptal',
    'no_show': 'Gelmedi',
    'planned': 'Planlandı',
    'in_progress': 'Devam Ediyor',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = context.read<ApiRepository>();
      final patient = await repo.getPatient(widget.patientId);
      final history = await Future.wait([
        repo.getAppointments(patientId: widget.patientId, limit: 100),
        repo.getTreatments(patientId: widget.patientId, limit: 100),
      ]);
      if (!mounted) return;
      setState(() {
        _patient = patient;
        _appointments = history[0] as List<Appointment>;
        _treatments = history[1] as List<Treatment>;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
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

  Future<void> _editPatient() async {
    final patient = _patient;
    if (patient == null) return;
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => PatientFormScreen(patient: patient)),
    );
    if (changed == true) {
      _load();
    }
  }

  Future<void> _openAppointment({Appointment? appointment}) async {
    final patient = _patient;
    if (patient == null) return;
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AppointmentFormScreen(
          initialDate: DateTime.now(),
          appointment: appointment,
          initialPatient: appointment == null ? patient : null,
        ),
      ),
    );
    if (changed == true) {
      _load();
    }
  }

  Future<void> _openTreatment({Treatment? treatment}) async {
    final patient = _patient;
    if (patient == null) return;
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => TreatmentFormScreen(
          treatment: treatment,
          initialPatient: treatment == null ? patient : null,
        ),
      ),
    );
    if (changed == true) {
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_patient?.fullName ?? 'Hasta Detayı'),
        backgroundColor: const Color(0xFF134E4A),
        foregroundColor: Colors.white,
        actions: [
          if (_patient != null)
            IconButton(
              tooltip: 'Hasta bilgilerini düzenle',
              onPressed: _editPatient,
              icon: const Icon(Icons.edit),
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: _load, child: const Text('Tekrar Dene')),
            ],
          ),
        ),
      );
    }

    final patient = _patient!;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _PatientInfoCard(patient: patient),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonalIcon(
                  onPressed: () => _openAppointment(),
                  icon: const Icon(Icons.event_available),
                  label: const Text('Randevu Ekle'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.tonalIcon(
                  onPressed: () => _openTreatment(),
                  icon: const Icon(Icons.medical_services),
                  label: const Text('Tedavi Ekle'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            'Randevu Geçmişi (${_appointments.length})',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (_appointments.isEmpty)
            const ListTile(title: Text('Randevu kaydı yok.'))
          else
            for (final appointment in _appointments)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.event_note),
                  title: Text(
                    '${_formatDate(appointment.appointmentDate)} · ${_shortTime(appointment.startTime)}',
                  ),
                  subtitle: Text([
                    appointment.appointmentType ?? 'Randevu',
                    _statusLabels[appointment.status] ?? appointment.status,
                  ].join(' · ')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: appointment.status == 'cancelled'
                      ? null
                      : () => _openAppointment(appointment: appointment),
                ),
              ),
          const SizedBox(height: 20),
          Text(
            'Tedavi Geçmişi (${_treatments.length})',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (_treatments.isEmpty)
            const ListTile(title: Text('Tedavi kaydı yok.'))
          else
            for (final treatment in _treatments)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.medical_services),
                  title: Text(treatment.treatmentType ?? 'Tedavi'),
                  subtitle: Text([
                    _formatDate(treatment.treatmentDate),
                    if (treatment.toothNumber?.isNotEmpty ?? false)
                      'Diş ${treatment.toothNumber}',
                    _statusLabels[treatment.status] ?? treatment.status,
                  ].join(' · ')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _openTreatment(treatment: treatment),
                ),
              ),
        ],
      ),
    );
  }

  String _formatDate(String value) {
    final date = DateTime.tryParse(value);
    return date == null ? value : DateFormat('dd.MM.yyyy').format(date);
  }

  String _shortTime(String value) =>
      value.length >= 5 ? value.substring(0, 5) : value;
}

class _PatientInfoCard extends StatelessWidget {
  final Patient patient;

  const _PatientInfoCard({required this.patient});

  @override
  Widget build(BuildContext context) {
    final rows = <(IconData, String, String?)>[
      (Icons.phone, 'Telefon', patient.phone),
      (Icons.email_outlined, 'E-posta', patient.email),
      (Icons.badge_outlined, 'Protokol no', patient.protocolNumber),
      (Icons.fingerprint, 'Kimlik no', patient.identityNumber),
      (Icons.cake_outlined, 'Doğum tarihi', patient.dateOfBirth),
      (Icons.location_on_outlined, 'Adres', _address(patient)),
      (Icons.warning_amber, 'Alerjiler', patient.allergies),
      (Icons.report_problem, 'Kritik klinik uyarılar', patient.criticalAlerts),
      (
        Icons.health_and_safety_outlined,
        'Tıbbi durumlar',
        patient.medicalConditions
      ),
      (Icons.medication_outlined, 'Mevcut ilaçlar', patient.currentMedications),
      (Icons.notes, 'Notlar', patient.notes),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Hasta Bilgileri',
                style: Theme.of(context).textTheme.titleMedium),
            const Divider(),
            for (final row in rows)
              if (row.$3?.trim().isNotEmpty ?? false)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(row.$1),
                  title: Text(row.$2),
                  subtitle: Text(row.$3!),
                ),
          ],
        ),
      ),
    );
  }

  String? _address(Patient patient) {
    final parts = [patient.address, patient.city]
        .where((value) => value?.trim().isNotEmpty ?? false)
        .cast<String>()
        .toList();
    return parts.isEmpty ? null : parts.join(', ');
  }
}
