import 'dart:async';
import 'dart:convert';
import 'package:stomp_dart_client/stomp_dart_client.dart';

class WebSocketService {
  StompClient? _stompClient;
  String? _kioskId;
  String? _authToken;
  String? _serverUrl;
  Timer? _heartbeatTimer;
  Timer? _offlineTimer;
  bool _isConnected = false;
  bool _wasCompletelyOffline = true; // Track if we were completely offline (not just temporarily disconnected)

  // Callback for sync command from admin
  Function()? onSyncCommand;

  // Callback for config update from server
  Function()? onConfigUpdate;

  // Callback for connection status changes
  // Parameters: (isConnected, wasOfflineToOnlineTransition)
  Function(bool, bool)? onConnectionStatusChanged;

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

    // Check if this is a transition from completely offline to online
    final wasOfflineToOnline = _wasCompletelyOffline;

    if (wasOfflineToOnline) {
      print('WebSocket: Offline -> Online transition detected');
    } else {
      print('WebSocket: Reconnected (was temporarily disconnected)');
    }

    // Cancel offline timer if reconnected before becoming completely offline
    _offlineTimer?.cancel();
    _offlineTimer = null;

    _isConnected = true;
    _wasCompletelyOffline = false;

    // Notify with connection status and whether this was an offline->online transition
    onConnectionStatusChanged?.call(true, wasOfflineToOnline);

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
    _handleDisconnection();
    _stopHeartbeat();
  }

  void _onStompError(StompFrame frame) {
    print('WebSocket STOMP Error: ${frame.body}');
    _handleDisconnection();
  }

  void _onWebSocketError(dynamic error) {
    print('WebSocket Error: $error');
    _handleDisconnection();
  }

  void _handleDisconnection() {
    _isConnected = false;

    // Start timer to mark as completely offline after 1 hour
    // If reconnected within 1 hour, this is considered a temporary disconnect
    _offlineTimer?.cancel();
    _offlineTimer = Timer(const Duration(hours: 1), () {
      print('WebSocket: Marked as completely offline (disconnected for >1 hour)');
      _wasCompletelyOffline = true;
    });

    // Notify immediately about disconnection (but don't trigger sync)
    onConnectionStatusChanged?.call(false, false);
  }

  void _handleMessage(Map<String, dynamic> message) {
    final type = message['type'] as String?;
    print('WebSocket: Received message type: $type');

    switch (type) {
      case 'SYNC_COMMAND':
        print('WebSocket: Sync command received from admin');
        onSyncCommand?.call();
        break;
      case 'SYNC_RESPONSE':
        print('WebSocket: Sync response received');
        // Check if server requires reconnection to clear old sessions
        final requireReconnect = message['requireReconnect'] as bool?;
        if (requireReconnect == true) {
          print('WebSocket: Server requires reconnection - refreshing connection');
          // Disconnect and reconnect to ensure we have a fresh session
          _reconnect();
        }
        break;
      case 'CONFIG_UPDATE':
        print('WebSocket: Config update notification received from server');
        onConfigUpdate?.call();
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
    _offlineTimer?.cancel();
    _offlineTimer = null;

    if (_stompClient != null) {
      _stompClient!.deactivate();
      _stompClient = null;
    }

    _isConnected = false;
    _wasCompletelyOffline = true; // Manual disconnect = completely offline
    onConnectionStatusChanged?.call(false, false);
  }

  void _reconnect() {
    print('WebSocket: Reconnecting...');
    disconnect();
    // Wait a short moment before reconnecting to ensure clean disconnect
    Future.delayed(const Duration(milliseconds: 500), () {
      connect();
    });
  }

  void dispose() {
    _offlineTimer?.cancel();
    _offlineTimer = null;
    disconnect();
    onSyncCommand = null;
    onConfigUpdate = null;
    onConnectionStatusChanged = null;
  }
}
