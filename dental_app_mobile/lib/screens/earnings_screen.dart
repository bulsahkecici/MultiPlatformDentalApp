import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_service.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  DentistEarningsData? _data;
  bool _isLoading = false;
  late String _startDate;
  late String _endDate;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final firstDay = DateTime(now.year, now.month, 1);
    _startDate = DateFormat('yyyy-MM-dd').format(firstDay);
    _endDate = DateFormat('yyyy-MM-dd').format(now);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadEarnings());
  }

  Future<void> _loadEarnings() async {
    setState(() => _isLoading = true);
    try {
      final api = context.read<ApiService>();
      final response = await api.get('/api/dentist/earnings', params: {
        'startDate': _startDate,
        'endDate': _endDate,
      });
      _data = DentistEarningsData.fromJson(
        Map<String, dynamic>.from(response as Map),
      );
    } catch (e) {
      debugPrint('Earnings load error: $e');
      _data = null;
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatCurrency(double amount) {
    return '₺${NumberFormat.decimalPattern('tr_TR').format(amount)}';
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    final earnings = _data;
    final cards = earnings == null
        ? <Map<String, dynamic>>[]
        : [
            {'label': 'Toplam Ciro', 'amount': earnings.totalTurnover},
            {'label': 'Ödenen Ciro Payı', 'amount': earnings.paidTurnoverShare},
            {'label': 'Toplam Kazanç', 'amount': earnings.totalEarnings},
            {'label': 'Maaş', 'amount': earnings.salary},
            {'label': 'Komisyon Oranı', 'amount': earnings.commissionRate},
          ];

    return RefreshIndicator(
      onRefresh: _loadEarnings,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Kazançlarım',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF15366A),
                ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: _startDate,
                  decoration: const InputDecoration(
                    labelText: 'Başlangıç',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (v) => _startDate = v,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  initialValue: _endDate,
                  decoration: const InputDecoration(
                    labelText: 'Bitiş',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (v) => _endDate = v,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: _loadEarnings,
            child: const Text('Yenile'),
          ),
          const SizedBox(height: 16),
          if (cards.isEmpty)
            const Center(child: Text('Kazanç verisi bulunamadı.'))
          else
            ...cards.map(
              (card) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(
                        card['label'] as String,
                        style: const TextStyle(color: Colors.grey),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        card['label'] == 'Komisyon Oranı'
                            ? '%${card['amount']}'
                            : _formatCurrency((card['amount'] as num).toDouble()),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF3B82F6),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          if (earnings != null && earnings.treatments.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              'İşlem Dökümü',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            ...earnings.treatments.map(
              (t) => Card(
                margin: const EdgeInsets.only(bottom: 4),
                child: ListTile(
                  title: Text(t.treatmentType),
                  subtitle: Text(
                    '${t.patientFullName ?? 'Hasta #${t.patientId}'} · ${DateFormat('dd.MM.yyyy', 'tr_TR').format(t.treatmentDate)}',
                  ),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(_formatCurrency(t.cost ?? 0)),
                      if (t.earnings != null)
                        Text(
                          _formatCurrency(t.earnings ?? 0),
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF3B82F6),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
