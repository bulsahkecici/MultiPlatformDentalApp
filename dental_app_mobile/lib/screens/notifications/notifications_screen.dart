import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/notification_provider.dart';

/// Bildirim merkezi: liste + okundu işaretleme.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (mounted) {
        context.read<NotificationProvider>().loadNotifications();
      }
    });
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'appointment':
        return Icons.event;
      case 'treatment':
      case 'treatment_plan':
        return Icons.medical_services;
      case 'payment':
        return Icons.payments;
      default:
        return Icons.notifications;
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bildirimler'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
        actions: [
          if (provider.notifications.isNotEmpty)
            TextButton(
              onPressed: () => provider.markAllRead(),
              child: const Text(
                'Tümünü okundu işaretle',
                style: TextStyle(color: Colors.white),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => provider.loadNotifications(),
        child: provider.notifications.isEmpty
            ? ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: Text('Bildirim yok.')),
                  ),
                ],
              )
            : ListView.builder(
                itemCount: provider.notifications.length,
                itemBuilder: (context, i) {
                  final notification = provider.notifications[i];
                  return ListTile(
                    leading: Icon(
                      _iconFor(notification.type),
                      color: notification.isRead
                          ? Colors.grey
                          : const Color(0xFF1E3A8A),
                    ),
                    title: Text(
                      notification.title,
                      style: TextStyle(
                        fontWeight: notification.isRead
                            ? FontWeight.normal
                            : FontWeight.bold,
                      ),
                    ),
                    subtitle: Text(notification.message),
                    trailing: Text(
                      notification.createdAt.length >= 10
                          ? notification.createdAt.substring(0, 10)
                          : notification.createdAt,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    onTap: notification.isRead
                        ? null
                        : () => provider.markRead(notification.id),
                  );
                },
              ),
      ),
    );
  }
}
