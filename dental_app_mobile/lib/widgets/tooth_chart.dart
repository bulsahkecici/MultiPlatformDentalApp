import 'package:flutter/material.dart';

class _Hotspot {
  final int tooth;
  final double x;
  final double y;
  final double w;
  final double h;

  const _Hotspot(this.tooth, this.x, this.y, this.w, this.h);
}

/// FDI numaralandırmalı diş şeması.
///
/// Koordinatlar mouth_chart.png'nin doğal boyutlarına (1024x482) göre piksel
/// cinsindendir — web tooth-chart bileşeni ve desktop TreatmentFormViewModel
/// ile AYNI kaynak tablo. Widget herhangi bir genişlikte ölçeklenir.
class ToothChart extends StatelessWidget {
  final Set<int> selectedTeeth;
  final ValueChanged<int> onToothTap;

  const ToothChart({
    super.key,
    required this.selectedTeeth,
    required this.onToothTap,
  });

  static const double _imgW = 1024;
  static const double _imgH = 482;

  // Üst sıra soldan sağa: 18..11 | 21..28 — Alt sıra: 38..31 | 41..48
  static const List<_Hotspot> _hotspots = [
    // Üst çene (y: 95, h: 135)
    _Hotspot(18, 86, 95, 52, 135),
    _Hotspot(17, 141, 95, 54, 135),
    _Hotspot(16, 200, 95, 56, 135),
    _Hotspot(15, 257, 95, 48, 135),
    _Hotspot(14, 306, 95, 48, 135),
    _Hotspot(13, 355, 95, 48, 135),
    _Hotspot(12, 405, 95, 50, 135),
    _Hotspot(11, 457, 95, 52, 135),
    _Hotspot(21, 517, 95, 52, 135),
    _Hotspot(22, 569, 95, 50, 135),
    _Hotspot(23, 621, 95, 48, 135),
    _Hotspot(24, 669, 95, 48, 135),
    _Hotspot(25, 717, 95, 48, 135),
    _Hotspot(26, 768, 95, 56, 135),
    _Hotspot(27, 829, 95, 54, 135),
    _Hotspot(28, 884, 95, 52, 135),
    // Alt çene (y: 252, h: 170)
    _Hotspot(38, 96, 252, 62, 170),
    _Hotspot(37, 160, 252, 64, 170),
    _Hotspot(36, 231, 252, 66, 170),
    _Hotspot(35, 297, 252, 50, 170),
    _Hotspot(34, 349, 252, 46, 170),
    _Hotspot(33, 396, 252, 40, 170),
    _Hotspot(32, 440, 252, 36, 170),
    _Hotspot(31, 475, 252, 34, 170),
    _Hotspot(41, 520, 252, 34, 170),
    _Hotspot(42, 553, 252, 34, 170),
    _Hotspot(43, 589, 252, 38, 170),
    _Hotspot(44, 630, 252, 44, 170),
    _Hotspot(45, 677, 252, 46, 170),
    _Hotspot(46, 729, 252, 62, 170),
    _Hotspot(47, 801, 252, 62, 170),
    _Hotspot(48, 867, 252, 60, 170),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final scale = constraints.maxWidth / _imgW;
            return SizedBox(
              width: constraints.maxWidth,
              height: _imgH * scale,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Image.asset(
                      'assets/images/mouth_chart.png',
                      fit: BoxFit.fill,
                    ),
                  ),
                  for (final spot in _hotspots)
                    Positioned(
                      left: spot.x * scale,
                      top: spot.y * scale,
                      width: spot.w * scale,
                      height: spot.h * scale,
                      child: GestureDetector(
                        onTap: () => onToothTap(spot.tooth),
                        child: Container(
                          decoration: BoxDecoration(
                            color: selectedTeeth.contains(spot.tooth)
                                ? const Color(0x883B82F6)
                                : const Color(0x113B82F6),
                            border: Border.all(
                              color: selectedTeeth.contains(spot.tooth)
                                  ? const Color(0xFF0F766E)
                                  : const Color(0x333B82F6),
                              width:
                                  selectedTeeth.contains(spot.tooth) ? 2 : 1,
                            ),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
        if (selectedTeeth.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Seçili dişler: ${(selectedTeeth.toList()..sort()).join(', ')}',
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
      ],
    );
  }
}
