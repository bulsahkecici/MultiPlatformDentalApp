import 'package:flutter/material.dart';

/// FDI diş numaraları — üst ve alt çene (18-48)
const List<int> fdiTeeth = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  38, 37, 36, 35, 34, 33, 32, 31,
  41, 42, 43, 44, 45, 46, 47, 48,
];

class ToothChartWidget extends StatelessWidget {
  final List<int> selectedTeeth;
  final ValueChanged<List<int>> onChanged;
  final bool readOnly;

  const ToothChartWidget({
    super.key,
    required this.selectedTeeth,
    required this.onChanged,
    this.readOnly = false,
  });

  void _toggle(int tooth) {
    if (readOnly) return;
    final updated = List<int>.from(selectedTeeth);
    if (updated.contains(tooth)) {
      updated.remove(tooth);
    } else {
      updated.add(tooth);
    }
    onChanged(updated);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(12),
            color: Colors.white,
          ),
          child: Column(
            children: [
              _buildRow(fdiTeeth.sublist(0, 16)),
              const SizedBox(height: 8),
              Container(height: 2, color: Colors.blue.shade100),
              const SizedBox(height: 8),
              _buildRow(fdiTeeth.sublist(16)),
            ],
          ),
        ),
        if (selectedTeeth.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Seçili: ${selectedTeeth.toList()..sort()}',
              style: TextStyle(
                color: Colors.blue.shade800,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildRow(List<int> teeth) {
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      alignment: WrapAlignment.center,
      children: teeth.map((tooth) {
        final selected = selectedTeeth.contains(tooth);
        return GestureDetector(
          onTap: () => _toggle(tooth),
          child: Container(
            width: 36,
            height: 44,
            decoration: BoxDecoration(
              color: selected ? Colors.blue.shade600 : Colors.blue.shade50,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: selected ? Colors.blue.shade800 : Colors.blue.shade200,
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              '$tooth',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: selected ? Colors.white : Colors.blue.shade900,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
