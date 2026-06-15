import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../providers/patient_provider.dart';
import 'patient_form_screen.dart';

class PatientListScreen extends StatefulWidget {
  const PatientListScreen({super.key});

  @override
  State<PatientListScreen> createState() => _PatientListScreenState();
}

class _PatientListScreenState extends State<PatientListScreen> {
  final _searchController = TextEditingController();
  Patient? _selectedPatient;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PatientProvider>().fetchPatients();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openForm({Patient? patient}) async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => PatientFormScreen(patient: patient),
      ),
    );
    if (result == true && mounted) {
      context.read<PatientProvider>().fetchPatients(search: _searchController.text);
    }
  }

  Future<void> _deletePatient(Patient patient) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hastayı Sil'),
        content: Text('${patient.fullName} kaydını silmek istiyor musunuz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Vazgeç'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final ok = await context.read<PatientProvider>().deletePatient(patient.id);
      if (!ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Hasta silinemedi.')),
        );
      } else if (mounted) {
        setState(() {
          if (_selectedPatient?.id == patient.id) _selectedPatient = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PatientProvider>();
    final isAdmin = context.watch<AuthProvider>().isAdmin;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Hasta Yönetimi',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF15366A),
                      ),
                ),
              ),
              ElevatedButton.icon(
                onPressed: () => _openForm(),
                icon: const Icon(Icons.add),
                label: const Text('Yeni Hasta'),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              labelText: 'Ara',
              hintText: 'Hasta ara...',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
            onSubmitted: (value) => provider.fetchPatients(search: value),
            onChanged: (value) {
              if (value.isEmpty) provider.fetchPatients(search: '');
            },
          ),
        ),
        Expanded(
          child: provider.isLoading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: () =>
                      provider.fetchPatients(search: _searchController.text),
                  child: provider.patients.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 80),
                            Center(child: Text('Hasta bulunamadı.')),
                          ],
                        )
                      : ListView.builder(
                          itemCount: provider.patients.length,
                          itemBuilder: (context, index) {
                            final patient = provider.patients[index];
                            final selected = _selectedPatient?.id == patient.id;
                            return Card(
                              margin: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 4,
                              ),
                              color: selected
                                  ? const Color(0xFFEFF5FF)
                                  : null,
                              child: ListTile(
                                title: Text(patient.fullName),
                                subtitle: Text(
                                  '${patient.phone ?? '-'} · ${patient.email ?? '-'}',
                                ),
                                onTap: () =>
                                    setState(() => _selectedPatient = patient),
                                trailing: PopupMenuButton<String>(
                                  onSelected: (action) {
                                    if (action == 'edit') {
                                      _openForm(patient: patient);
                                    } else if (action == 'delete' && isAdmin) {
                                      _deletePatient(patient);
                                    }
                                  },
                                  itemBuilder: (context) => [
                                    const PopupMenuItem(
                                      value: 'edit',
                                      child: Text('Düzenle'),
                                    ),
                                    if (isAdmin)
                                      const PopupMenuItem(
                                        value: 'delete',
                                        child: Text('Sil'),
                                      ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
        ),
        if (_selectedPatient != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            color: const Color(0xFFF8FBFF),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _selectedPatient!.fullName,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                Text('Telefon: ${_selectedPatient!.phone ?? '-'}'),
                Text('E-posta: ${_selectedPatient!.email ?? '-'}'),
                Text('Şehir: ${_selectedPatient!.city ?? '-'}'),
              ],
            ),
          ),
      ],
    );
  }
}
