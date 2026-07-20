import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';

/// Dişhekimi kazanç ekranı — GET /api/dentist/earnings
/// (web dentist-earnings ve desktop DentistEarnings ile aynı sözleşme).
class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  EarningsSummary? _summary;
  List<EarningsTreatment> _treatments = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final (summary, treatments) =
          await context.read<ApiRepository>().getEarnings();
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _treatments = treatments;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺');

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text(_error!));
    }
    final summary = _summary ?? EarningsSummary();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _Row(label: 'Maaş', value: money.format(summary.salary)),
                  _Row(
                      label: 'Toplam Ciro',
                      value: money.format(summary.totalTurnover)),
                  _Row(
                      label: 'Komisyon Oranı',
                      value: '%${summary.commissionRate.toStringAsFixed(0)}'),
                  _Row(
                      label: 'Ödenen Ciro Payı',
                      value: money.format(summary.paidTurnoverShare)),
                  const Divider(),
                  _Row(
                    label: 'Toplam Kazanç',
                    value: money.format(summary.totalEarnings),
                    highlight: true,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Tamamlanan Tedaviler (${_treatments.length})',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (_treatments.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('Tamamlanmış tedavi kaydı yok.'),
              ),
            ),
          for (final treatment in _treatments)
            Card(
              child: ListTile(
                title: Text(treatment.treatmentType),
                subtitle: Text(
                    '${treatment.patientFullName} · ${treatment.treatmentDate}'),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(money.format(treatment.cost)),
                    Text(
                      '+${money.format(treatment.earnings)}',
                      style: const TextStyle(
                          color: Colors.green, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;

  const _Row({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontWeight:
                      highlight ? FontWeight.bold : FontWeight.normal)),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: highlight ? 18 : 14,
              color: highlight ? const Color(0xFF1E3A8A) : null,
            ),
          ),
        ],
      ),
    );
  }
}
