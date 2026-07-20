import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/api_repository.dart';
import '../core/socket_service.dart';
import '../models/models.dart';

/// Bildirim rozeti + canlı bildirim akışı.
class NotificationProvider extends ChangeNotifier {
  final ApiRepository _repository;
  final SocketService _socketService;

  int _unreadCount = 0;
  List<AppNotification> _notifications = [];
  StreamSubscription<LiveNotification>? _subscription;

  /// UI'nin snackbar göstermesi için son canlı bildirim.
  LiveNotification? lastLive;

  NotificationProvider(this._repository, this._socketService) {
    _subscription = _socketService.notifications.listen((notification) {
      _unreadCount++;
      lastLive = notification;
      notifyListeners();
    });
  }

  int get unreadCount => _unreadCount;
  List<AppNotification> get notifications => _notifications;

  Future<void> refreshUnreadCount() async {
    try {
      _unreadCount = await _repository.getUnreadCount();
      notifyListeners();
    } catch (_) {
      // Sunucu erişilemezse rozet güncellenmez
    }
  }

  Future<void> loadNotifications() async {
    try {
      _notifications = await _repository.getNotifications();
      notifyListeners();
    } catch (_) {
      _notifications = [];
      notifyListeners();
    }
  }

  Future<void> markAllRead() async {
    try {
      await _repository.markAllNotificationsRead();
      _unreadCount = 0;
      await loadNotifications();
    } catch (_) {}
  }

  Future<void> markRead(int id) async {
    try {
      await _repository.markNotificationRead(id);
      if (_unreadCount > 0) _unreadCount--;
      notifyListeners();
    } catch (_) {}
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
