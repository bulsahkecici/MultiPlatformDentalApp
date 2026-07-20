import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';

/// Anlaşmalı kurum listesi (salt görüntüleme — düzenleme web/desktop'ta).
class AgreementsScreen extends StatefulWidget {
  const AgreementsScreen({super.key});

  @override
  State<AgreementsScreen> createState() => _AgreementsScreenState();
}

class _AgreementsScreenState extends State<AgreementsScreen> {
  List<InstitutionAgreement> _agreements = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final agreements =
          await context.read<ApiRepository>().getAgreements();
      if (!mounted) return;
      setState(() {
        _agreements = agreements;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: _agreements.isEmpty
          ? ListView(
              children: const [
                Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: Text('Anlaşmalı kurum yok.')),
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: _agreements.length,
              itemBuilder: (context, i) {
                final agreement = _agreements[i];
                return Card(
                  child: ExpansionTile(
                    leading: const Icon(Icons.business),
                    title: Text(agreement.institutionName),
                    subtitle: Text(
                        'İndirim: %${agreement.discountPercentage.toStringAsFixed(0)}'),
                    children: [
                      if (agreement.contactPerson != null)
                        ListTile(
                          dense: true,
                          leading: const Icon(Icons.person, size: 20),
                          title: Text(agreement.contactPerson!),
                        ),
                      if (agreement.contactPhone != null)
                        ListTile(
                          dense: true,
                          leading: const Icon(Icons.phone, size: 20),
                          title: Text(agreement.contactPhone!),
                        ),
                      if (agreement.contactEmail != null)
                        ListTile(
                          dense: true,
                          leading: const Icon(Icons.email, size: 20),
                          title: Text(agreement.contactEmail!),
                        ),
                      if (agreement.notes != null)
                        ListTile(
                          dense: true,
                          leading: const Icon(Icons.notes, size: 20),
                          title: Text(agreement.notes!),
                        ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
