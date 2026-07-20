import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_repository.dart';
import '../../models/models.dart';

/// Kullanıcı yönetimi (sadece admin): liste + yeni kullanıcı oluşturma.
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  List<User> _users = [];
  bool _loading = true;

  static const _roleLabels = {
    'admin': 'Yönetici',
    'secretary': 'Sekreter',
    'dentist': 'Dişhekimi',
    'user': 'Kullanıcı',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final users = await context.read<ApiRepository>().getUsers();
      if (!mounted) return;
      setState(() {
        _users = users;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _openCreateDialog() async {
    final created = await showDialog<bool>(
      context: context,
      builder: (_) => const _CreateUserDialog(),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.builder(
                padding: const EdgeInsets.all(8),
                itemCount: _users.length,
                itemBuilder: (context, i) {
                  final user = _users[i];
                  return Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        child: Text(user.email.isNotEmpty
                            ? user.email[0].toUpperCase()
                            : '?'),
                      ),
                      title: Text(user.displayName),
                      subtitle: Text(user.email),
                      trailing: Wrap(
                        spacing: 4,
                        children: [
                          for (final role in user.roles)
                            Chip(
                              label: Text(
                                _roleLabels[role] ?? role,
                                style: const TextStyle(fontSize: 11),
                              ),
                              visualDensity: VisualDensity.compact,
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openCreateDialog,
        child: const Icon(Icons.person_add),
      ),
    );
  }
}

class _CreateUserDialog extends StatefulWidget {
  const _CreateUserDialog();

  @override
  State<_CreateUserDialog> createState() => _CreateUserDialogState();
}

class _CreateUserDialogState extends State<_CreateUserDialog> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _commissionRate = TextEditingController();
  final _salary = TextEditingController();
  String _role = 'secretary';
  bool _saving = false;

  @override
  void dispose() {
    for (final c in [
      _email,
      _password,
      _firstName,
      _lastName,
      _commissionRate,
      _salary
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await context.read<ApiRepository>().createUser({
        'email': _email.text.trim(),
        'password': _password.text,
        'roles': [_role],
        'firstName': _firstName.text.trim(),
        'lastName': _lastName.text.trim(),
        if (_role == 'dentist' && _commissionRate.text.isNotEmpty)
          'commissionRate': double.tryParse(
              _commissionRate.text.replaceAll(',', '.')),
        if (_salary.text.isNotEmpty)
          'salary': double.tryParse(_salary.text.replaceAll(',', '.')),
      });
      if (!mounted) return;
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Yeni Kullanıcı'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: _role,
                decoration: const InputDecoration(labelText: 'Rol'),
                items: const [
                  DropdownMenuItem(
                      value: 'secretary', child: Text('Sekreter')),
                  DropdownMenuItem(
                      value: 'dentist', child: Text('Dişhekimi')),
                  DropdownMenuItem(value: 'admin', child: Text('Yönetici')),
                ],
                onChanged: (v) => setState(() => _role = v ?? 'secretary'),
              ),
              TextFormField(
                controller: _firstName,
                decoration: const InputDecoration(labelText: 'Ad'),
              ),
              TextFormField(
                controller: _lastName,
                decoration: const InputDecoration(labelText: 'Soyad'),
              ),
              TextFormField(
                controller: _email,
                decoration: const InputDecoration(labelText: 'E-posta *'),
                keyboardType: TextInputType.emailAddress,
                validator: (v) => (v == null || !v.contains('@'))
                    ? 'Geçerli e-posta girin'
                    : null,
              ),
              TextFormField(
                controller: _password,
                decoration: const InputDecoration(
                  labelText: 'Şifre *',
                  helperText:
                      'En az 8 karakter; büyük/küçük harf, rakam, özel karakter',
                ),
                obscureText: true,
                validator: (v) =>
                    (v == null || v.length < 8) ? 'En az 8 karakter' : null,
              ),
              if (_role == 'dentist')
                TextFormField(
                  controller: _commissionRate,
                  decoration: const InputDecoration(
                      labelText: 'Komisyon Oranı (%)'),
                  keyboardType: TextInputType.number,
                ),
              TextFormField(
                controller: _salary,
                decoration: const InputDecoration(labelText: 'Maaş (₺)'),
                keyboardType: TextInputType.number,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Vazgeç'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Oluştur'),
        ),
      ],
    );
  }
}
