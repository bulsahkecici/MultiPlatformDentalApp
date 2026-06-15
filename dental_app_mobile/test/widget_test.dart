import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dental_app_mobile/screens/login_screen.dart';

void main() {
  testWidgets('Login screen shows email and password fields', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: LoginScreen()),
    );

    expect(find.text('Giriş Yap'), findsOneWidget);
    expect(find.byType(TextField), findsAtLeast(2));
  });
}
