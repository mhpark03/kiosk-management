// WebSocket client using STOMP over SockJS
let stompClient = null;
let isConnected = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectDelay = 3000;
let heartbeatInterval = null;

// WebSocket connection status callback
let onConnectionStatusChange = null;

/**
 * Initialize WebSocket connection
 */
function connectWebSocket(apiUrl, kioskId, statusCallback) {
  if (!apiUrl || !kioskId) {
    console.warn('Cannot connect WebSocket: missing apiUrl or kioskId');
    return;
  }

  onConnectionStatusChange = statusCallback;

  // Extract base URL (remove /api suffix if present)
  const baseUrl = apiUrl.replace('/api', '');
  const wsUrl = `${baseUrl}/ws`;

  console.log('Connecting to WebSocket:', wsUrl);

  // Import SockJS and STOMP (for browser environment)
  const SockJS = require('sockjs-client');
  const { Client } = require('@stomp/stompjs');

  // Create STOMP client
  stompClient = new Client({
    webSocketFactory: () => new SockJS(wsUrl),

    connectHeaders: {
      kioskId: kioskId
    },

    debug: (str) => {
      console.log('STOMP Debug:', str);
    },

    reconnectDelay: reconnectDelay,
    heartbeatIncoming: 20000,
    heartbeatOutgoing: 20000,

    onConnect: (frame) => {
      console.log('WebSocket Connected:', frame);
      isConnected = true;
      reconnectAttempts = 0;

      if (onConnectionStatusChange) {
        onConnectionStatusChange(true, 'Connected to server');
      }

      // Subscribe to kiosk-specific topic
      stompClient.subscribe(`/topic/kiosk/${kioskId}`, (message) => {
        handleKioskMessage(JSON.parse(message.body));
      });

      // Subscribe to broadcast topic
      stompClient.subscribe('/topic/kiosk/broadcast', (message) => {
        handleBroadcastMessage(JSON.parse(message.body));
      });

      // Send initial connection message
      stompClient.publish({
        destination: '/app/kiosk/connect',
        body: JSON.stringify({ kioskId: kioskId })
      });

      // Start heartbeat
      startHeartbeat(kioskId);
    },

    onStompError: (frame) => {
      console.error('STOMP Error:', frame.headers['message']);
      console.error('Details:', frame.body);
      handleDisconnection();
    },

    onWebSocketClose: () => {
      console.log('WebSocket connection closed');
      handleDisconnection();
    },

    onWebSocketError: (error) => {
      console.error('WebSocket error:', error);
      handleDisconnection();
    }
  });

  // Activate the STOMP client
  stompClient.activate();
}

/**
 * Handle disconnection and reconnection logic
 */
function handleDisconnection() {
  isConnected = false;
  stopHeartbeat();

  if (onConnectionStatusChange) {
    onConnectionStatusChange(false, 'Disconnected from server');
  }

  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}...`);

    setTimeout(() => {
      if (!isConnected && stompClient) {
        stompClient.activate();
      }
    }, reconnectDelay * reconnectAttempts);
  } else {
    console.error('Max reconnection attempts reached');
    if (onConnectionStatusChange) {
      onConnectionStatusChange(false, 'Connection failed - max retries reached');
    }
  }
}

/**
 * Start sending periodic heartbeats
 */
function startHeartbeat(kioskId) {
  stopHeartbeat();

  heartbeatInterval = setInterval(() => {
    if (isConnected && stompClient) {
      stompClient.publish({
        destination: '/app/kiosk/heartbeat',
        body: JSON.stringify({
          kioskId: kioskId,
          timestamp: new Date().toISOString()
        })
      });
    }
  }, 30000); // Every 30 seconds
}

/**
 * Stop heartbeat
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Send status update to server
 */
function sendStatusUpdate(kioskId, status, details = {}) {
  if (!isConnected || !stompClient) {
    console.warn('Cannot send status: not connected');
    return;
  }

  stompClient.publish({
    destination: '/app/kiosk/status',
    body: JSON.stringify({
      kioskId: kioskId,
      status: status,
      details: details,
      timestamp: new Date().toISOString()
    })
  });
}

/**
 * Handle messages sent to specific kiosk
 */
function handleKioskMessage(message) {
  console.log('Received kiosk message:', message);

  switch (message.type) {
    case 'CONNECTED':
      showNotification('서버 연결됨', message.message, 'success');
      break;

    case 'HEARTBEAT_ACK':
      console.log('Heartbeat acknowledged');
      break;

    case 'SYNC_REQUEST':
      showNotification('동기화 요청', '서버에서 동기화를 요청했습니다.', 'info');
      // Trigger sync if auto-sync button exists
      const syncBtn = document.getElementById('sync-btn');
      if (syncBtn) {
        syncBtn.click();
      }
      break;

    case 'CONFIG_UPDATE':
      showNotification('설정 업데이트', message.message, 'info');
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
}

/**
 * Handle broadcast messages to all kiosks
 */
function handleBroadcastMessage(message) {
  console.log('Received broadcast message:', message);
  showNotification('전체 공지', message.message, 'info');
}

/**
 * Show notification to user
 */
function showNotification(title, message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);

  // You can integrate with a toast notification library here
  // For now, just alert
  if (type === 'success' || type === 'info') {
    // Only show important notifications
    if (window.Notification && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  }
}

/**
 * Disconnect WebSocket
 */
function disconnectWebSocket() {
  console.log('Disconnecting WebSocket...');

  stopHeartbeat();

  if (stompClient) {
    stompClient.deactivate();
    stompClient = null;
  }

  isConnected = false;

  if (onConnectionStatusChange) {
    onConnectionStatusChange(false, 'Disconnected');
  }
}

/**
 * Check if WebSocket is connected
 */
function isWebSocketConnected() {
  return isConnected;
}

// Export functions for use in app.js
window.WebSocketClient = {
  connect: connectWebSocket,
  disconnect: disconnectWebSocket,
  isConnected: isWebSocketConnected,
  sendStatus: sendStatusUpdate
};
