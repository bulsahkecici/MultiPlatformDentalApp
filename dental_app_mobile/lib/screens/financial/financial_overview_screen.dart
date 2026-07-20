import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';

/// Patron için yalnızca okunabilen finans özeti.
/// Bu ekran hiçbir ödeme/onay/değişiklik API'si çağırmaz.
class FinancialOverviewScreen extends StatefulWidget {
  const FinancialOverviewScreen({super.key});

  @override
  State<FinancialOverviewScreen> createState() =>
      _FinancialOverviewScreenState();
}

class _FinancialOverviewScreenState extends State<FinancialOverviewScreen> {
  double _totalIncome = 0;
  double _totalReceivables = 0;
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
      final repo = context.read<ApiRepository>();
      final values = await Future.wait([
        repo.getTotalIncome(),
        repo.getTotalReceivables(),
      ]);
      if (!mounted) return;
      setState(() {
        _totalIncome = values[0];
        _totalReceivables = values[1];
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺');
    if (_loading) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: Theme.of(context).colorScheme.primaryContainer,
            child: const ListTile(
              leading: Icon(Icons.visibility_outlined),
              title: Text('Salt okunur görünüm'),
              subtitle: Text(
                'Finansal bilgiler görüntülenebilir; ödeme, onay veya değişiklik yapılamaz.',
              ),
            ),
          ),
          if (_error != null)
            Card(
              color: Theme.of(context).colorScheme.errorContainer,
              child: ListTile(
                leading: const Icon(Icons.error_outline),
                title: Text(_error!),
                trailing: IconButton(
                  tooltip: 'Tekrar dene',
                  onPressed: _load,
                  icon: const Icon(Icons.refresh),
                ),
              ),
            )
          else ...[
            Card(
              child: ListTile(
                leading: const Icon(Icons.payments, color: Colors.green),
                title: const Text('Toplam Gelir'),
                trailing: Text(
                  money.format(_totalIncome),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            Card(
              child: ListTile(
                leading: const Icon(
                  Icons.account_balance_wallet,
                  color: Colors.red,
                ),
                title: const Text('Toplam Alacak'),
                trailing: Text(
                  money.format(_totalReceivables),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
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
