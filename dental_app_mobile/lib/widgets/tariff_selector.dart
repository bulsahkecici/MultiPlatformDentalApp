import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;

import '../models/models.dart';

/// TDB 2026 tarifesinden işlem seçici (bottom sheet).
/// Diğer istemcilerle aynı bundled JSON'u kullanır
/// (assets/data/tdb_2026_tarife_full.json).
Future<TariffItem?> showTariffSelector(BuildContext context) {
  return showModalBottomSheet<TariffItem>(
    context: context,
    isScrollControlled: true,
    builder: (_) => const _TariffSelectorSheet(),
  );
}

class _TariffSelectorSheet extends StatefulWidget {
  const _TariffSelectorSheet();

  @override
  State<_TariffSelectorSheet> createState() => _TariffSelectorSheetState();
}

class _TariffSelectorSheetState extends State<_TariffSelectorSheet> {
  static List<TariffCategory>? _cache;

  List<TariffCategory> _categories = [];
  TariffCategory? _selectedCategory;
  String _search = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_cache == null) {
      final raw = await rootBundle
          .loadString('assets/data/tdb_2026_tarife_full.json');
      final json = jsonDecode(raw) as Map<String, dynamic>;
      _cache = (json['categories'] as List)
          .map((c) => TariffCategory.fromJson(c as Map<String, dynamic>))
          .toList();
    }
    if (!mounted) return;
    setState(() {
      _categories = _cache!;
      _loading = false;
    });
  }

  List<TariffItem> get _visibleItems {
    Iterable<TariffItem> items;
    if (_selectedCategory != null) {
      items = _selectedCategory!.items;
    } else {
      items = _categories.expand((c) => c.items);
    }
    if (_search.isNotEmpty) {
      final term = _search.toLowerCase();
      items = items.where((i) =>
          i.name.toLowerCase().contains(term) || i.code.contains(term));
    }
    return items.toList();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.85,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: TextField(
                    decoration: const InputDecoration(
                      hintText: 'İşlem ara (ad veya kod)',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (v) => setState(() => _search = v.trim()),
                  ),
                ),
                SizedBox(
                  height: 44,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: const Text('Tümü'),
                          selected: _selectedCategory == null,
                          onSelected: (_) =>
                              setState(() => _selectedCategory = null),
                        ),
                      ),
                      for (final category in _categories)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(category.name,
                                overflow: TextOverflow.ellipsis),
                            selected: _selectedCategory == category,
                            onSelected: (_) => setState(
                                () => _selectedCategory = category),
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    itemCount: _visibleItems.length,
                    itemBuilder: (context, i) {
                      final item = _visibleItems[i];
                      return ListTile(
                        title: Text(item.name),
                        subtitle: Text('Kod: ${item.code}'),
                        trailing: Text(
                          '${item.priceInclVat.toStringAsFixed(2)} ₺',
                          style:
                              const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        onTap: () => Navigator.pop(context, item),
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }
}
