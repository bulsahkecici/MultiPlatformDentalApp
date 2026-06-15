import 'package:flutter/material.dart';

import 'main_shell.dart';

/// Kimliği doğrulanmış ana giriş noktası — rol bazlı navigasyon kabuğunu sarmalar.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const MainShell();
  }
}
