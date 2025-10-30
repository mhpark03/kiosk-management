import 'dart:async';
import 'dart:convert';
import 'package:stomp_dart_client/stomp_dart_client.dart';

class WebSocketService {
  StompClient? _stompClient;
  String? _kioskId;
  String? _authToken;
  String? _serverUrl;
  Timer? _heartbeatTimer;
  bool _isConnected = false;

  // Callback for sync command from admin
  Function()? onSyncCommand;

  // Callback for connection status changes
  Function(bool)? onConnectionStatusChanged;

  bool get isConnected => _isConnected;

  void configure(String serverUrl, String kioskId, String? authToken) {
    _serverUrl = serverUrl;
    _kioskId = kioskId;
    _authToken = authToken;
  }

  void connect() {
    if (_serverUrl == null || _kioskId == null) {
      print('WebSocket: Cannot connect - server URL or kiosk ID not configured');
      return;
    }

    if (_isConnected) {
      print('WebSocket: Already connected');
      return;
    }

    // For SockJS, keep HTTP/HTTPS URL (don't convert to ws://)
    // Just replace /api with /ws
    final wsUrl = _serverUrl!.replaceFirst('/api', '/ws');

    print('WebSocket: Connecting to $wsUrl');

    _stompClient = StompClient(
      config: StompConfig.sockJS(
        url: wsUrl,
        onConnect: _onConnect,
        onDisconnect: _onDisconnect,
        onStompError: _onStompError,
        onWebSocketError: _onWebSocketError,
        beforeConnect: () async {
          print('WebSocket: Connecting...');
        },
        stompConnectHeaders: _authToken != null
            ? {'Authorization': 'Bearer $_authToken'}
            : {},
        webSocketConnectHeaders: _authToken != null
            ? {'Authorization': 'Bearer $_authToken'}
            : {},
      ),
    );

    _stompClient!.activate();
  }

  void _onConnect(StompFrame frame) {
    print('WebSocket: Connected successfully');
    _isConnected = true;
    onConnectionStatusChanged?.call(true);

    // Subscribe to kiosk-specific topic for commands
    _stompClient!.subscribe(
      destination: '/topic/kiosk/$_kioskId',
      callback: (StompFrame frame) {
        if (frame.body != null) {
          try {
            final message = jsonDecode(frame.body!);
            _handleMessage(message);
          } catch (e) {
            print('WebSocket: Error parsing message: $e');
          }
        }
      },
    );

    // Send connect message
    _stompClient!.send(
      destination: '/app/kiosk/connect',
      body: jsonEncode({'kioskId': _kioskId}),
    );

    // Start heartbeat
    _startHeartbeat();
  }

  void _onDisconnect(StompFrame frame) {
    print('WebSocket: Disconnected');
    _isConnected = false;
    onConnectionStatusChanged?.call(false);
    _stopHeartbeat();
  }

  void _onStompError(StompFrame frame) {
    print('WebSocket STOMP Error: ${frame.body}');
    _isConnected = false;
    onConnectionStatusChanged?.call(false);
  }

  void _onWebSocketError(dynamic error) {
    print('WebSocket Error: $error');
    _isConnected = false;
    onConnectionStatusChanged?.call(false);
  }

  void _handleMessage(Map<String, dynamic> message) {
    final type = message['type'] as String?;
    print('WebSocket: Received message type: $type');

    switch (type) {
      case 'SYNC_COMMAND':
        print('WebSocket: Sync command received from admin');
        onSyncCommand?.call();
        break;
      case 'HEARTBEAT_ACK':
        print('WebSocket: Heartbeat acknowledged');
        break;
      case 'CONNECTED':
        print('WebSocket: Connection confirmed by server');
        break;
      default:
        print('WebSocket: Unknown message type: $type');
    }
  }

  void _startHeartbeat() {
    _stopHeartbeat();

    // Send heartbeat every 30 seconds
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      if (_isConnected && _stompClient != null) {
        try {
          _stompClient!.send(
            destination: '/app/kiosk/heartbeat',
            body: jsonEncode({'kioskId': _kioskId}),
          );
          print('WebSocket: Heartbeat sent');
        } catch (e) {
          print('WebSocket: Error sending heartbeat: $e');
        }
      }
    });
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  void requestSync() {
    if (!_isConnected || _stompClient == null) {
      print('WebSocket: Cannot request sync - not connected');
      return;
    }

    try {
      _stompClient!.send(
        destination: '/app/kiosk/sync',
        body: jsonEncode({'kioskId': _kioskId}),
      );
      print('WebSocket: Sync request sent');
    } catch (e) {
      print('WebSocket: Error requesting sync: $e');
    }
  }

  void disconnect() {
    print('WebSocket: Disconnecting...');
    _stopHeartbeat();

    if (_stompClient != null) {
      _stompClient!.deactivate();
      _stompClient = null;
    }

    _isConnected = false;
    onConnectionStatusChanged?.call(false);
  }

  void dispose() {
    disconnect();
    onSyncCommand = null;
    onConnectionStatusChanged = null;
  }
}
