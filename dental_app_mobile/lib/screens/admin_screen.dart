import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_service.dart';
import '../utils/constants.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  List<User> _users = [];
  bool _isLoading = false;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadUsers());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    setState(() => _isLoading = true);
    try {
      final api = context.read<ApiService>();
      final params = <String, String>{
        'page': '1',
        'limit': '${ApiConstants.defaultPageSize}',
      };
      if (_searchController.text.isNotEmpty) {
        params['search'] = _searchController.text;
      }
      final response = await api.get('/api/users', params: params);
      final list = (response as Map<String, dynamic>)['users'] as List? ?? [];
      _users = list
          .map((e) => User.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      debugPrint('loadUsers error: $e');
      _users = [];
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _roleLabel(List<String> roles) {
    if (roles.contains('admin')) return 'Admin';
    if (roles.contains('secretary')) return 'Sekreter';
    if (roles.contains('dentist')) return 'Diş Hekimi';
    return roles.join(', ');
  }

  Future<void> _showCreateUserDialog() async {
    final emailController = TextEditingController();
    final passwordController = TextEditingController();
    final firstNameController = TextEditingController();
    final lastNameController = TextEditingController();
    final phoneController = TextEditingController();
    String role = 'secretary';

    final created = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Yeni Kullanıcı'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: emailController,
                  decoration: const InputDecoration(labelText: 'E-posta'),
                ),
                TextField(
                  controller: passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Şifre'),
                ),
                TextField(
                  controller: firstNameController,
                  decoration: const InputDecoration(labelText: 'Ad'),
                ),
                TextField(
                  controller: lastNameController,
                  decoration: const InputDecoration(labelText: 'Soyad'),
                ),
                TextField(
                  controller: phoneController,
                  decoration: const InputDecoration(labelText: 'Telefon'),
                ),
                DropdownButtonFormField<String>(
                  value: role,
                  decoration: const InputDecoration(labelText: 'Rol'),
                  items: const [
                    DropdownMenuItem(value: 'secretary', child: Text('Sekreter')),
                    DropdownMenuItem(value: 'dentist', child: Text('Diş Hekimi')),
                    DropdownMenuItem(value: 'admin', child: Text('Admin')),
                  ],
                  onChanged: (v) => setDialogState(() => role = v ?? 'secretary'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('İptal')),
            FilledButton(
              onPressed: () async {
                try {
                  final api = context.read<ApiService>();
                  await api.post('/api/users', {
                    'email': emailController.text,
                    'password': passwordController.text,
                    'roles': [role],
                    'firstName': firstNameController.text,
                    'lastName': lastNameController.text,
                    'phone': phoneController.text,
                    if (role == 'dentist') 'tcNo': '00000000000',
                    if (role == 'dentist') 'university': 'Üniversite',
                    if (role == 'dentist') 'diplomaNo': '000',
                    if (role == 'secretary') 'tcNo': '00000000000',
                  });
                  if (ctx.mounted) Navigator.pop(ctx, true);
                } catch (e) {
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(content: Text('Hata: $e')),
                    );
                  }
                }
              },
              child: const Text('Oluştur'),
            ),
          ],
        ),
      ),
    );

    if (created == true) await _loadUsers();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            'Kullanıcı Yönetimi',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF15366A),
                ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  decoration: const InputDecoration(
                    labelText: 'Ara',
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: (_) => _loadUsers(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: _loadUsers,
                icon: const Icon(Icons.refresh),
                tooltip: 'Yenile',
              ),
              IconButton(
                onPressed: _showCreateUserDialog,
                icon: const Icon(Icons.person_add),
                tooltip: 'Yeni Kullanıcı',
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _loadUsers,
                  child: _users.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 80),
                            Center(child: Text('Kullanıcı bulunamadı.')),
                          ],
                        )
                      : ListView.builder(
                          itemCount: _users.length,
                          itemBuilder: (context, index) {
                            final user = _users[index];
                            return Card(
                              margin: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 4,
                              ),
                              child: ListTile(
                                leading: const Icon(Icons.person),
                                title: Text(user.displayName),
                                subtitle: Text(user.email),
                                trailing: Chip(label: Text(_roleLabel(user.roles))),
                              ),
                            );
                          },
                        ),
                ),
        ),
      ],
    );
  }
}
