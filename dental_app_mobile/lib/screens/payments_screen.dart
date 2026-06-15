import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_service.dart';

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  List<PendingPlan> _plans = [];
  double _totalReceivables = 0;
  double _totalIncome = 0;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final api = context.read<ApiService>();

    try {
      final plansResponse = await api.get('/api/payments/pending-plans');
      final plansList =
          (plansResponse as Map<String, dynamic>)['plans'] as List? ?? [];
      _plans = plansList
          .map((e) => PendingPlan.fromJson(Map<String, dynamic>.from(e)))
          .toList();

      try {
        final receivables = await api.get('/api/payments/total-receivables');
        _totalReceivables =
            (receivables as Map)['totalReceivables']?.toDouble() ?? 0;
      } catch (_) {
        _totalReceivables = 0;
      }

      try {
        final income = await api.get('/api/payments/total-income');
        _totalIncome = (income as Map)['totalIncome']?.toDouble() ?? 0;
      } catch (_) {
        _totalIncome = 0;
      }
    } catch (e) {
      debugPrint('Payments load error: $e');
      _plans = [];
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _approvePlan(PendingPlan plan, bool approved) async {
    try {
      final api = context.read<ApiService>();
      await api.post('/api/payments/approve-plan/${plan.id}', {
        'approved': approved,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(approved ? 'Plan onaylandı.' : 'Plan reddedildi.'),
          ),
        );
        await _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('İşlem başarısız: $e')),
        );
      }
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

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Ödeme ve İndirim Yönetimi',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF15366A),
                ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Toplam Alacak'),
                        const SizedBox(height: 8),
                        Text(
                          _formatCurrency(_totalReceivables),
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Toplam Tahsilat'),
                        const SizedBox(height: 8),
                        Text(
                          _formatCurrency(_totalIncome),
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Onay Bekleyen Planlar',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          if (_plans.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('Bekleyen plan bulunmamaktadır.')),
            )
          else
            ..._plans.map((plan) {
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ExpansionTile(
                  title: Text(plan.title),
                  subtitle: Text(
                    '${plan.patientName ?? 'Hasta #${plan.patientId}'} · ${_formatCurrency(plan.totalEstimatedCost ?? 0)}',
                  ),
                  children: [
                    if (plan.description != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(plan.description!),
                      ),
                    ...plan.items.map(
                      (item) => ListTile(
                        dense: true,
                        title: Text(item.treatmentType),
                        subtitle: Text('Diş ${item.toothNumber}'),
                        trailing: Text(_formatCurrency(item.cost)),
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton(
                          onPressed: () => _approvePlan(plan, false),
                          child: const Text('Reddet'),
                        ),
                        ElevatedButton(
                          onPressed: () => _approvePlan(plan, true),
                          child: const Text('Onayla'),
                        ),
                        const SizedBox(width: 8),
                      ],
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
