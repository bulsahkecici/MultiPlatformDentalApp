import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';
import 'treatment_form_screen.dart';

/// Tedavi listesi + durum filtresi + yeni tedavi kaydı.
class TreatmentsScreen extends StatefulWidget {
  const TreatmentsScreen({super.key});

  @override
  State<TreatmentsScreen> createState() => _TreatmentsScreenState();
}

class _TreatmentsScreenState extends State<TreatmentsScreen> {
  List<Treatment> _treatments = [];
  bool _loading = true;
  String? _statusFilter;

  static const _statusLabels = {
    'planned': 'Planlandı',
    'in_progress': 'Devam Ediyor',
    'completed': 'Tamamlandı',
    'cancelled': 'İptal',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await context
          .read<ApiRepository>()
          .getTreatments(limit: 100, status: _statusFilter);
      if (!mounted) return;
      setState(() {
        _treatments = results;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _openForm({Treatment? treatment}) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
          builder: (_) => TreatmentFormScreen(treatment: treatment)),
    );
    if (changed == true) _load();
  }

  Future<void> _markCompleted(Treatment treatment) async {
    try {
      await context
          .read<ApiRepository>()
          .updateTreatment(treatment.id, {'status': 'completed'});
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.all(8),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: const Text('Tümü'),
                    selected: _statusFilter == null,
                    onSelected: (_) {
                      setState(() => _statusFilter = null);
                      _load();
                    },
                  ),
                ),
                for (final entry in _statusLabels.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(entry.value),
                      selected: _statusFilter == entry.key,
                      onSelected: (_) {
                        setState(() => _statusFilter = entry.key);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _treatments.isEmpty
                        ? ListView(
                            children: const [
                              Padding(
                                padding: EdgeInsets.all(32),
                                child:
                                    Center(child: Text('Tedavi kaydı yok.')),
                              ),
                            ],
                          )
                        : ListView.builder(
                            itemCount: _treatments.length,
                            itemBuilder: (context, i) {
                              final treatment = _treatments[i];
                              return Card(
                                margin: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 4),
                                child: ListTile(
                                  leading: const Icon(Icons.medical_services),
                                  title: Text(
                                      treatment.treatmentType ?? 'Tedavi'),
                                  subtitle: Text([
                                    treatment.patientFullName.isNotEmpty
                                        ? treatment.patientFullName
                                        : 'Hasta #${treatment.patientId}',
                                    treatment.treatmentDate,
                                    if (treatment.toothNumber != null &&
                                        treatment.toothNumber!.isNotEmpty)
                                      'Diş: ${treatment.toothNumber}',
                                    if (treatment.cost != null)
                                      '${treatment.cost!.toStringAsFixed(2)} ₺',
                                  ].join(' · ')),
                                  trailing: PopupMenuButton<String>(
                                    onSelected: (action) {
                                      if (action == 'edit') {
                                        _openForm(treatment: treatment);
                                      } else if (action == 'complete') {
                                        _markCompleted(treatment);
                                      }
                                    },
                                    itemBuilder: (_) => [
                                      const PopupMenuItem(
                                          value: 'edit',
                                          child: Text('Düzenle')),
                                      if (treatment.status != 'completed')
                                        const PopupMenuItem(
                                            value: 'complete',
                                            child:
                                                Text('Tamamlandı işaretle')),
                                    ],
                                  ),
                                  onTap: () =>
                                      _openForm(treatment: treatment),
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add),
      ),
    );
  }
}
