import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';
import 'patient_detail_screen.dart';
import 'patient_form_screen.dart';

/// Diş hekimi hasta listesi: arama, ekleme ve detay/geçmiş erişimi.
class PatientsScreen extends StatefulWidget {
  const PatientsScreen({super.key});

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

  Future<void> _openDetails(Patient patient) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => PatientDetailScreen(patientId: patient.id),
      ),
    );
    if (mounted) _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
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
                                child: Center(child: Text('Hasta bulunamadı.')),
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
                                trailing: const Icon(Icons.chevron_right),
                                onTap: () => _openDetails(patient),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.person_add),
      ),
    );
  }
}
