import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';

/// Hasta ekleme/düzenleme formu.
class PatientFormScreen extends StatefulWidget {
  final Patient? patient;

  const PatientFormScreen({super.key, this.patient});

  @override
  State<PatientFormScreen> createState() => _PatientFormScreenState();
}

class _PatientFormScreenState extends State<PatientFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  late final TextEditingController _city;
  late final TextEditingController _address;
  late final TextEditingController _allergies;
  late final TextEditingController _medicalConditions;
  late final TextEditingController _notes;
  DateTime? _dateOfBirth;
  String? _gender;
  bool _saving = false;

  bool get _isEdit => widget.patient != null;

  @override
  void initState() {
    super.initState();
    final p = widget.patient;
    _firstName = TextEditingController(text: p?.firstName ?? '');
    _lastName = TextEditingController(text: p?.lastName ?? '');
    _phone = TextEditingController(text: p?.phone ?? '');
    _email = TextEditingController(text: p?.email ?? '');
    _city = TextEditingController(text: p?.city ?? '');
    _address = TextEditingController(text: p?.address ?? '');
    _allergies = TextEditingController(text: p?.allergies ?? '');
    _medicalConditions =
        TextEditingController(text: p?.medicalConditions ?? '');
    _notes = TextEditingController(text: p?.notes ?? '');
    _gender = p?.gender;
    if (p?.dateOfBirth != null && p!.dateOfBirth!.length >= 10) {
      _dateOfBirth = DateTime.tryParse(p.dateOfBirth!.substring(0, 10));
    }
  }

  @override
  void dispose() {
    for (final c in [
      _firstName,
      _lastName,
      _phone,
      _email,
      _city,
      _address,
      _allergies,
      _medicalConditions,
      _notes
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final repo = context.read<ApiRepository>();
    final patient = Patient(
      id: widget.patient?.id ?? 0,
      firstName: _firstName.text.trim(),
      lastName: _lastName.text.trim(),
      dateOfBirth: _dateOfBirth != null
          ? DateFormat('yyyy-MM-dd').format(_dateOfBirth!)
          : null,
      gender: _gender,
      phone: _phone.text.trim(),
      email: _email.text.trim(),
      city: _city.text.trim(),
      address: _address.text.trim(),
      allergies: _allergies.text.trim(),
      medicalConditions: _medicalConditions.text.trim(),
      notes: _notes.text.trim(),
    );
    try {
      if (_isEdit) {
        await repo.updatePatient(widget.patient!.id, patient);
      } else {
        await repo.createPatient(patient);
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
        title: Text(_isEdit ? 'Hastayı Düzenle' : 'Yeni Hasta'),
        backgroundColor: const Color(0xFF134E4A),
        foregroundColor: Colors.white,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _firstName,
              decoration: const InputDecoration(labelText: 'Ad *'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Ad zorunludur' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _lastName,
              decoration: const InputDecoration(labelText: 'Soyad *'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Soyad zorunludur' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _dateOfBirth ?? DateTime(1990),
                        firstDate: DateTime(1900),
                        lastDate: DateTime.now(),
                      );
                      if (picked != null) {
                        setState(() => _dateOfBirth = picked);
                      }
                    },
                    child: InputDecorator(
                      decoration:
                          const InputDecoration(labelText: 'Doğum Tarihi'),
                      child: Text(_dateOfBirth != null
                          ? DateFormat('dd.MM.yyyy').format(_dateOfBirth!)
                          : 'Seçiniz'),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _gender,
                    decoration: const InputDecoration(labelText: 'Cinsiyet'),
                    items: const [
                      DropdownMenuItem(value: 'male', child: Text('Erkek')),
                      DropdownMenuItem(value: 'female', child: Text('Kadın')),
                      DropdownMenuItem(value: 'other', child: Text('Diğer')),
                    ],
                    onChanged: (v) => setState(() => _gender = v),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              decoration: const InputDecoration(labelText: 'Telefon'),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              decoration: const InputDecoration(labelText: 'E-posta'),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _city,
              decoration: const InputDecoration(labelText: 'Şehir'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _address,
              decoration: const InputDecoration(labelText: 'Adres'),
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _allergies,
              decoration: const InputDecoration(labelText: 'Alerjiler'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _medicalConditions,
              decoration:
                  const InputDecoration(labelText: 'Tıbbi Durumlar'),
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notes,
              decoration: const InputDecoration(labelText: 'Notlar'),
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
      ),
    );
  }
}
