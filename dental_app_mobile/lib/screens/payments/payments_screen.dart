import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';
import '../../widgets/patient_picker.dart';

/// Ödeme yönetimi: özet, bekleyen plan onayı, tahsilat.
/// Web payments bileşeni ve desktop PaymentsViewModel ile aynı /payments API'si.
class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  // Özet
  double _totalReceivables = 0;
  double _totalIncome = 0;

  // Bekleyen planlar
  List<PendingPlan> _pendingPlans = [];
  bool _loadingPlans = false;

  // Tahsilat
  Patient? _selectedPatient;
  PatientDebt? _debt;
  List<PaymentRecord> _payments = [];
  final _amountController = TextEditingController();
  final _notesController = TextEditingController();
  String _paymentMethod = 'cash';
  bool _processing = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadSummary();
    _loadPendingPlans();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _amountController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadSummary() async {
    final repo = context.read<ApiRepository>();
    try {
      final receivables = await repo.getTotalReceivables();
      final income = await repo.getTotalIncome();
      if (!mounted) return;
      setState(() {
        _totalReceivables = receivables;
        _totalIncome = income;
      });
    } catch (_) {}
  }

  Future<void> _loadPendingPlans() async {
    setState(() => _loadingPlans = true);
    try {
      final plans = await context.read<ApiRepository>().getPendingPlans();
      if (!mounted) return;
      setState(() {
        _pendingPlans = plans;
        _loadingPlans = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingPlans = false);
    }
  }

  Future<void> _approvePlan(PendingPlan plan, bool approved) async {
    try {
      await context.read<ApiRepository>().approvePlan(plan.id, approved);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(approved
              ? 'Tedavi planı onaylandı'
              : 'Tedavi planı reddedildi')));
      _loadPendingPlans();
      _loadSummary();
      if (_selectedPatient?.id == plan.patientId) {
        _refreshPatientFinancials();
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _selectPatient() async {
    final patient = await showPatientPicker(context);
    if (patient != null) {
      setState(() {
        _selectedPatient = patient;
        _debt = null;
        _payments = [];
      });
      _refreshPatientFinancials();
    }
  }

  Future<void> _refreshPatientFinancials() async {
    final patient = _selectedPatient;
    if (patient == null) return;
    final repo = context.read<ApiRepository>();
    try {
      final debt = await repo.getPatientDebt(patient.id);
      final payments = await repo.getPatientPayments(patient.id);
      if (!mounted) return;
      setState(() {
        _debt = debt;
        _payments = payments;
      });
    } catch (_) {}
  }

  Future<void> _processPayment() async {
    final patient = _selectedPatient;
    final amount =
        double.tryParse(_amountController.text.replaceAll(',', '.'));
    if (patient == null || amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Hasta ve geçerli tutar girin')),
      );
      return;
    }
    setState(() => _processing = true);
    try {
      await context.read<ApiRepository>().processPayment(
            patientId: patient.id,
            amount: amount,
            paymentMethod: _paymentMethod,
            notes: _notesController.text.trim(),
          );
      if (!mounted) return;
      setState(() {
        _processing = false;
        _amountController.clear();
        _notesController.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ödeme başarıyla alındı')));
      _refreshPatientFinancials();
      _loadSummary();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _processing = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺');

    return Column(
      children: [
        Material(
          color: Theme.of(context).colorScheme.surface,
          child: TabBar(
            controller: _tabController,
            labelColor: const Color(0xFF1E3A8A),
            tabs: const [
              Tab(text: 'Özet'),
              Tab(text: 'Plan Onayı'),
              Tab(text: 'Tahsilat'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              // --- Özet ---
              RefreshIndicator(
                onRefresh: () async {
                  await _loadSummary();
                },
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.account_balance_wallet,
                            color: Colors.red),
                        title: const Text('Toplam Alacak'),
                        trailing: Text(
                          money.format(_totalReceivables),
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    Card(
                      child: ListTile(
                        leading:
                            const Icon(Icons.payments, color: Colors.green),
                        title: const Text('Toplam Gelir'),
                        trailing: Text(
                          money.format(_totalIncome),
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // --- Plan Onayı ---
              RefreshIndicator(
                onRefresh: _loadPendingPlans,
                child: _loadingPlans
                    ? const Center(child: CircularProgressIndicator())
                    : _pendingPlans.isEmpty
                        ? ListView(
                            children: const [
                              Padding(
                                padding: EdgeInsets.all(32),
                                child: Center(
                                    child: Text(
                                        'Onay bekleyen tedavi planı yok.')),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(8),
                            itemCount: _pendingPlans.length,
                            itemBuilder: (context, i) {
                              final plan = _pendingPlans[i];
                              return Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${plan.patientName} — ${plan.title ?? 'Plan #${plan.id}'}',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold),
                                      ),
                                      const SizedBox(height: 4),
                                      for (final item in plan.items)
                                        Text(
                                          '• ${item.treatmentType ?? '-'}'
                                          '${item.toothNumber != null ? ' (Diş ${item.toothNumber})' : ''}'
                                          ' — ${money.format(item.cost)}',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        ),
                                      const SizedBox(height: 8),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            money.format(plan.total),
                                            style: const TextStyle(
                                                fontWeight: FontWeight.bold),
                                          ),
                                          Row(
                                            children: [
                                              TextButton(
                                                onPressed: () =>
                                                    _approvePlan(plan, false),
                                                child: const Text('Reddet'),
                                              ),
                                              const SizedBox(width: 8),
                                              FilledButton(
                                                onPressed: () =>
                                                    _approvePlan(plan, true),
                                                child: const Text('Onayla'),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
              ),
              // --- Tahsilat ---
              ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.person),
                      title: Text(
                          _selectedPatient?.fullName ?? 'Hasta seçin'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: _selectPatient,
                    ),
                  ),
                  if (_debt != null) ...[
                    const SizedBox(height: 8),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          children: [
                            _DebtRow(
                                label: 'Toplam Borç',
                                value: money.format(_debt!.totalDebt)),
                            _DebtRow(
                                label: 'Ödenen',
                                value: money.format(_debt!.paidAmount)),
                            _DebtRow(
                              label: 'Kalan Borç',
                              value: money.format(_debt!.remainingDebt),
                              highlight: true,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _amountController,
                      decoration: const InputDecoration(
                        labelText: 'Tutar (₺)',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: _paymentMethod,
                      decoration: const InputDecoration(
                        labelText: 'Ödeme Yöntemi',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(
                            value: 'cash', child: Text('Nakit')),
                        DropdownMenuItem(value: 'card', child: Text('Kart')),
                      ],
                      onChanged: (v) =>
                          setState(() => _paymentMethod = v ?? 'cash'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _notesController,
                      decoration: const InputDecoration(
                        labelText: 'Not (opsiyonel)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _processing ? null : _processPayment,
                      icon: _processing
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.point_of_sale),
                      label: const Text('Ödemeyi Al'),
                    ),
                    if (_payments.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text('Ödeme Geçmişi',
                          style: Theme.of(context).textTheme.titleMedium),
                      for (final payment in _payments)
                        ListTile(
                          dense: true,
                          leading: Icon(payment.paymentMethod == 'cash'
                              ? Icons.money
                              : Icons.credit_card),
                          title: Text(money.format(payment.amount)),
                          subtitle: Text(
                              '${payment.methodLabel} · ${payment.createdAt.length >= 10 ? payment.createdAt.substring(0, 10) : payment.createdAt}'),
                        ),
                    ],
                  ],
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DebtRow extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;

  const _DebtRow({
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
          Text(label),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: highlight ? 18 : 14,
              color: highlight ? Colors.red : null,
            ),
          ),
        ],
      ),
    );
  }
}
