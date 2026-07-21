import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';
import '../../widgets/patient_picker.dart';
import '../../widgets/tariff_selector.dart';
import '../../widgets/tooth_chart.dart';

/// Tedavi ekleme/düzenleme formu: diş şeması + TDB tarife seçici.
class TreatmentFormScreen extends StatefulWidget {
  final Treatment? treatment;
  final Patient? initialPatient;

  const TreatmentFormScreen({
    super.key,
    this.treatment,
    this.initialPatient,
  });

  @override
  State<TreatmentFormScreen> createState() => _TreatmentFormScreenState();
}

class _TreatmentFormScreenState extends State<TreatmentFormScreen> {
  Patient? _patient;
  String? _patientLabel;
  final Set<int> _selectedTeeth = {};
  TariffItem? _tariffItem;
  late final TextEditingController _typeController;
  late final TextEditingController _costController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _diagnosisController;
  DateTime _date = DateTime.now();
  String _status = 'planned';
  bool _saving = false;

  bool get _isEdit => widget.treatment != null;

  @override
  void initState() {
    super.initState();
    final t = widget.treatment;
    _patient = widget.initialPatient;
    _typeController = TextEditingController(text: t?.treatmentType ?? '');
    _costController =
        TextEditingController(text: t?.cost?.toStringAsFixed(2) ?? '');
    _descriptionController =
        TextEditingController(text: t?.description ?? '');
    _diagnosisController = TextEditingController(text: t?.diagnosis ?? '');
    if (t != null) {
      _status = t.status;
      _patientLabel = t.patientFullName.isNotEmpty
          ? t.patientFullName
          : 'Hasta #${t.patientId}';
      _date = DateTime.tryParse(t.treatmentDate) ?? DateTime.now();
      // "36, 37" biçimindeki diş numaralarını yükle
      if (t.toothNumber != null) {
        for (final part in t.toothNumber!.split(',')) {
          final tooth = int.tryParse(part.trim());
          if (tooth != null) _selectedTeeth.add(tooth);
        }
      }
    }
  }

  @override
  void dispose() {
    _typeController.dispose();
    _costController.dispose();
    _descriptionController.dispose();
    _diagnosisController.dispose();
    super.dispose();
  }

  Future<void> _pickTariff() async {
    final item = await showTariffSelector(context);
    if (item != null) {
      setState(() {
        _tariffItem = item;
        _typeController.text = item.name;
        _costController.text = item.priceInclVat.toStringAsFixed(2);
      });
    }
  }

  Future<void> _save() async {
    final patientId = _patient?.id ?? widget.treatment?.patientId;
    if (patientId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen hasta seçin')),
      );
      return;
    }
    if (_typeController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen işlem türü girin')),
      );
      return;
    }
    setState(() => _saving = true);
    final repo = context.read<ApiRepository>();
    final toothNumbers =
        (_selectedTeeth.toList()..sort()).join(', ');
    try {
      if (_isEdit) {
        await repo.updateTreatment(widget.treatment!.id, {
          'treatmentType': _typeController.text.trim(),
          'toothNumber': toothNumbers,
          'description': _descriptionController.text.trim(),
          'diagnosis': _diagnosisController.text.trim(),
          'cost': double.tryParse(
              _costController.text.replaceAll(',', '.')),
          'status': _status,
        });
      } else {
        await repo.createTreatment(Treatment(
          id: 0,
          patientId: patientId,
          treatmentDate: DateFormat('yyyy-MM-dd').format(_date),
          treatmentType: _typeController.text.trim(),
          toothNumber: toothNumbers.isEmpty ? null : toothNumbers,
          description: _descriptionController.text.trim(),
          diagnosis: _diagnosisController.text.trim(),
          cost:
              double.tryParse(_costController.text.replaceAll(',', '.')),
          status: _status,
        ));
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Tedaviyi Düzenle' : 'Yeni Tedavi'),
        backgroundColor: const Color(0xFF134E4A),
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: const Icon(Icons.person),
              title: Text(
                  _patient?.fullName ?? _patientLabel ?? 'Hasta seçin *'),
              trailing: _isEdit ? null : const Icon(Icons.chevron_right),
              onTap: _isEdit
                  ? null
                  : () async {
                      final selected = await showPatientPicker(context);
                      if (selected != null) {
                        setState(() => _patient = selected);
                      }
                    },
            ),
          ),
          const SizedBox(height: 12),
          Text('Diş Seçimi',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: ToothChart(
                selectedTeeth: _selectedTeeth,
                onToothTap: (tooth) {
                  setState(() {
                    if (_selectedTeeth.contains(tooth)) {
                      _selectedTeeth.remove(tooth);
                    } else {
                      _selectedTeeth.add(tooth);
                    }
                  });
                },
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _typeController,
                  decoration: const InputDecoration(
                    labelText: 'İşlem Türü *',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.tonalIcon(
                onPressed: _pickTariff,
                icon: const Icon(Icons.menu_book),
                label: const Text('Tarife'),
              ),
            ],
          ),
          if (_tariffItem != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('TDB kodu: ${_tariffItem!.code}',
                  style: Theme.of(context).textTheme.bodySmall),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _costController,
            decoration: const InputDecoration(
              labelText: 'Ücret (₺)',
              border: OutlineInputBorder(),
            ),
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _status,
            decoration: const InputDecoration(
              labelText: 'Durum',
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(value: 'planned', child: Text('Planlandı')),
              DropdownMenuItem(
                  value: 'in_progress', child: Text('Devam Ediyor')),
              DropdownMenuItem(
                  value: 'completed', child: Text('Tamamlandı')),
              DropdownMenuItem(value: 'cancelled', child: Text('İptal')),
            ],
            onChanged: (v) => setState(() => _status = v ?? 'planned'),
          ),
          const SizedBox(height: 12),
          if (!_isEdit)
            Card(
              child: ListTile(
                leading: const Icon(Icons.calendar_today),
                title:
                    Text(DateFormat('d MMMM yyyy', 'tr_TR').format(_date)),
                subtitle: const Text('Tedavi tarihi'),
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
          const SizedBox(height: 12),
          TextField(
            controller: _diagnosisController,
            decoration: const InputDecoration(
              labelText: 'Tanı',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionController,
            decoration: const InputDecoration(
              labelText: 'Açıklama',
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
                : const Icon(Icons.save),
            label: Text(_isEdit ? 'Güncelle' : 'Kaydet'),
          ),
        ],
      ),
    );
  }
}
