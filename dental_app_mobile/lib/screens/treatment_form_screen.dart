import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/patient_provider.dart';
import '../providers/treatment_provider.dart';
import '../widgets/tooth_chart_widget.dart';

class TreatmentFormScreen extends StatefulWidget {
  final int? initialPatientId;

  const TreatmentFormScreen({super.key, this.initialPatientId});

  @override
  State<TreatmentFormScreen> createState() => _TreatmentFormScreenState();
}

class _TreatmentFormScreenState extends State<TreatmentFormScreen> {
  final _formKey = GlobalKey<FormState>();
  int? _patientId;
  DateTime _date = DateTime.now();
  final _typeController = TextEditingController();
  final _notesController = TextEditingController();
  final _costController = TextEditingController();
  List<int> _selectedTeeth = [];
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _patientId = widget.initialPatientId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PatientProvider>().fetchPatients();
    });
  }

  @override
  void dispose() {
    _typeController.dispose();
    _notesController.dispose();
    _costController.dispose();
    super.dispose();
  }

  bool get _canViewPrices {
    final auth = context.read<AuthProvider>();
    return auth.isAdmin || auth.isSecretary;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _patientId == null) return;

    setState(() => _isSaving = true);
    try {
      final provider = context.read<TreatmentProvider>();
      final auth = context.read<AuthProvider>();
      final body = <String, dynamic>{
        'patientId': _patientId,
        'treatmentDate': DateFormat('yyyy-MM-dd').format(_date),
        'treatmentType': _typeController.text,
        'toothNumber': _selectedTeeth.isEmpty ? null : _selectedTeeth.join(','),
        'procedureNotes': _notesController.text.isEmpty ? null : _notesController.text,
        'status': 'completed',
        'currency': 'TRY',
      };
      if (_canViewPrices && _costController.text.isNotEmpty) {
        body['cost'] = double.tryParse(_costController.text);
      }
      if (auth.isDentist) {
        body['dentistId'] = auth.currentUser?.id;
      }

      final ok = await provider.createTreatment(body);
      if (ok && mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tedavi kaydedildi')),
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
      appBar: AppBar(title: const Text('Yeni Tedavi')),
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
            ListTile(
              title: const Text('Tedavi Tarihi'),
              subtitle: Text(DateFormat('dd.MM.yyyy').format(_date)),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now(),
                );
                if (picked != null) setState(() => _date = picked);
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _typeController,
              decoration: const InputDecoration(
                labelText: 'Tedavi Türü *',
                border: OutlineInputBorder(),
              ),
              validator: (v) => v == null || v.isEmpty ? 'Zorunlu alan' : null,
            ),
            if (_canViewPrices) ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _costController,
                decoration: const InputDecoration(
                  labelText: 'Ücret (₺)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.number,
              ),
            ],
            const SizedBox(height: 12),
            TextFormField(
              controller: _notesController,
              decoration: const InputDecoration(
                labelText: 'Notlar',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            const Text('Diş Seçimi', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ToothChartWidget(
              selectedTeeth: _selectedTeeth,
              onChanged: (teeth) => setState(() => _selectedTeeth = teeth),
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
