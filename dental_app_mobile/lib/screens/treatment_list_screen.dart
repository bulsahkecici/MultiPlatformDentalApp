import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../providers/patient_provider.dart';
import '../services/api_service.dart';
import '../utils/constants.dart';
import 'treatment_form_screen.dart';

class TreatmentListScreen extends StatefulWidget {
  const TreatmentListScreen({super.key});

  @override
  State<TreatmentListScreen> createState() => _TreatmentListScreenState();
}

class _TreatmentListScreenState extends State<TreatmentListScreen> {
  List<Treatment> _treatments = [];
  bool _isLoading = false;
  int? _selectedPatientId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await context.read<PatientProvider>().fetchPatients();
      await _loadTreatments();
    });
  }

  Future<void> _loadTreatments() async {
    setState(() => _isLoading = true);
    try {
      final api = context.read<ApiService>();
      final params = <String, String>{
        'page': '1',
        'limit': '${ApiConstants.defaultPageSize}',
      };
      if (_selectedPatientId != null) {
        params['patientId'] = '$_selectedPatientId';
      }
      final response = await api.get('/api/treatments', params: params);
      final list =
          (response as Map<String, dynamic>)['treatments'] as List? ?? [];
      _treatments = list
          .map((e) => Treatment.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      debugPrint('loadTreatments error: $e');
      _treatments = [];
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatCurrency(double? amount) {
    return '₺${NumberFormat.decimalPattern('tr_TR').format(amount ?? 0)}';
  }

  @override
  Widget build(BuildContext context) {
    final patients = context.watch<PatientProvider>().patients;

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final created = await Navigator.push<bool>(
            context,
            MaterialPageRoute(
              builder: (_) => TreatmentFormScreen(
                initialPatientId: _selectedPatientId,
              ),
            ),
          );
          if (created == true) await _loadTreatments();
        },
        tooltip: 'Yeni Tedavi',
        child: const Icon(Icons.add),
      ),
      body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            'Tedavi Yönetimi',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF15366A),
                ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: DropdownButtonFormField<int?>(
            value: _selectedPatientId,
            decoration: const InputDecoration(
              labelText: 'Hasta',
              border: OutlineInputBorder(),
            ),
            items: [
              const DropdownMenuItem<int?>(
                value: null,
                child: Text('Tüm Hastalar'),
              ),
              ...patients.map(
                (p) => DropdownMenuItem<int?>(
                  value: p.id,
                  child: Text(p.fullName),
                ),
              ),
            ],
            onChanged: (value) async {
              setState(() => _selectedPatientId = value);
              await _loadTreatments();
            },
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _loadTreatments,
                  child: _treatments.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 80),
                            Center(child: Text('Tedavi kaydı bulunamadı.')),
                          ],
                        )
                      : ListView.builder(
                          itemCount: _treatments.length,
                          itemBuilder: (context, index) {
                            final t = _treatments[index];
                            return Card(
                              margin: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 4,
                              ),
                              child: ListTile(
                                leading: const Icon(Icons.medical_services),
                                title: Text(t.treatmentType),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      t.patientFullName ??
                                          'Hasta #${t.patientId}',
                                    ),
                                    Text(
                                      DateFormat('dd.MM.yyyy', 'tr_TR')
                                          .format(t.treatmentDate),
                                    ),
                                    if (t.toothNumber != null)
                                      Text('Diş: ${t.toothNumber}'),
                                  ],
                                ),
                                trailing: Text(_formatCurrency(t.cost)),
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
