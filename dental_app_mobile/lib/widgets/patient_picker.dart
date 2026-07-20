import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_repository.dart';
import '../models/models.dart';

/// Aramalı hasta seçici (bottom sheet).
/// Kullanım: `final patient = await showPatientPicker(context);`
Future<Patient?> showPatientPicker(BuildContext context) {
  return showModalBottomSheet<Patient>(
    context: context,
    isScrollControlled: true,
    builder: (_) => const _PatientPickerSheet(),
  );
}

class _PatientPickerSheet extends StatefulWidget {
  const _PatientPickerSheet();

  @override
  State<_PatientPickerSheet> createState() => _PatientPickerSheetState();
}

class _PatientPickerSheetState extends State<_PatientPickerSheet> {
  List<Patient> _results = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  Future<void> _search(String term) async {
    setState(() => _loading = true);
    try {
      final results = await context
          .read<ApiRepository>()
          .getPatients(limit: 25, search: term.isEmpty ? null : term);
      if (!mounted) return;
      setState(() {
        _results = results;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _results = [];
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Hasta ara',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: _search,
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      itemCount: _results.length,
                      itemBuilder: (context, i) {
                        final patient = _results[i];
                        return ListTile(
                          title: Text(patient.fullName),
                          subtitle: Text(patient.phone ?? '-'),
                          onTap: () => Navigator.pop(context, patient),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
