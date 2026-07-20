import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import 'patient_form_screen.dart';

/// Hasta listesi: arama + sonsuz kaydırma + ekleme/düzenleme.
/// Dişhekimi rolü salt okunur görür (canEdit=false), silme sadece admin.
class PatientsScreen extends StatefulWidget {
  final bool canEdit;

  const PatientsScreen({super.key, this.canEdit = true});

  @override
  State<PatientsScreen> createState() => _PatientsScreenState();
}

class _PatientsScreenState extends State<PatientsScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  List<Patient> _patients = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _page = 1;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
              _scrollController.position.maxScrollExtent - 200 &&
          !_loadingMore &&
          _hasMore) {
        _load();
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    final repo = context.read<ApiRepository>();
    if (reset) {
      setState(() {
        _loading = true;
        _page = 1;
        _hasMore = true;
      });
    } else {
      setState(() => _loadingMore = true);
    }
    try {
      final results = await repo.getPatients(
          page: _page, limit: 25, search: _search.isEmpty ? null : _search);
      if (!mounted) return;
      setState(() {
        if (reset) {
          _patients = results;
        } else {
          _patients.addAll(results);
        }
        _hasMore = results.length == 25;
        _page++;
        _loading = false;
        _loadingMore = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _openForm({Patient? patient}) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => PatientFormScreen(patient: patient)),
    );
    if (changed == true) _load(reset: true);
  }

  Future<void> _delete(Patient patient) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hastayı Sil'),
        content: Text(
            '${patient.fullName} silinecek (arşivlenecek). Emin misiniz?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Vazgeç')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Sil')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await context.read<ApiRepository>().deletePatient(patient.id);
      _load(reset: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin =
        context.watch<AuthProvider>().currentUser?.isAdmin ?? false;

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Hasta ara (ad, soyad, telefon)',
                prefixIcon: const Icon(Icons.search),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                isDense: true,
              ),
              onSubmitted: (value) {
                _search = value.trim();
                _load(reset: true);
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: () => _load(reset: true),
                    child: _patients.isEmpty
                        ? ListView(
                            children: const [
                              Padding(
                                padding: EdgeInsets.all(32),
                                child:
                                    Center(child: Text('Hasta bulunamadı.')),
                              ),
                            ],
                          )
                        : ListView.builder(
                            controller: _scrollController,
                            itemCount:
                                _patients.length + (_loadingMore ? 1 : 0),
                            itemBuilder: (context, i) {
                              if (i >= _patients.length) {
                                return const Padding(
                                  padding: EdgeInsets.all(16),
                                  child: Center(
                                      child: CircularProgressIndicator()),
                                );
                              }
                              final patient = _patients[i];
                              return ListTile(
                                leading: CircleAvatar(
                                  child: Text(patient.firstName.isNotEmpty
                                      ? patient.firstName[0].toUpperCase()
                                      : '?'),
                                ),
                                title: Text(patient.fullName),
                                subtitle: Text(patient.phone ?? '-'),
                                trailing: isAdmin && widget.canEdit
                                    ? IconButton(
                                        icon: const Icon(Icons.delete_outline),
                                        onPressed: () => _delete(patient),
                                      )
                                    : null,
                                onTap: widget.canEdit
                                    ? () => _openForm(patient: patient)
                                    : () => _openForm(patient: patient),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
      floatingActionButton: widget.canEdit
          ? FloatingActionButton(
              onPressed: () => _openForm(),
              child: const Icon(Icons.person_add),
            )
          : null,
    );
  }
}
