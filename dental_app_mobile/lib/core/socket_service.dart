import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import 'config.dart';

/// Gerçek zamanlı bildirim payload'ı (backend 'notification' eventi).
class LiveNotification {
  final String type;
  final String title;
  final String message;
  final Map<String, dynamic>? data;
  final String? timestamp;

  LiveNotification({
    required this.type,
    required this.title,
    required this.message,
    this.data,
    this.timestamp,
  });

  factory LiveNotification.fromJson(Map<String, dynamic> json) {
    return LiveNotification(
      type: json['type']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      data: json['data'] is Map<String, dynamic>
          ? json['data'] as Map<String, dynamic>
          : null,
      timestamp: json['timestamp']?.toString(),
    );
  }
}

/// Socket.IO bildirim istemcisi.
///
/// Backend sözleşmesi (src/services/notificationHub.js):
///  - Kimlik doğrulama: handshake auth.token içinde JWT
///  - Eventler: 'connected', 'notification'
class SocketService {
  io.Socket? _socket;
  final _controller = StreamController<LiveNotification>.broadcast();

  Stream<LiveNotification> get notifications => _controller.stream;

  void connect(String accessToken) {
    disconnect();

    final socket = io.io(
      AppConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': accessToken})
          .setPath('/socket.io/')
          .enableReconnection()
          .setReconnectionDelay(2000)
          .build(),
    );

    socket.on('notification', (data) {
      if (data is Map) {
        _controller.add(
          LiveNotification.fromJson(Map<String, dynamic>.from(data)),
        );
      }
    });

    socket.connect();
    _socket = socket;
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  void dispose() {
    disconnect();
    _controller.close();
  }
}
