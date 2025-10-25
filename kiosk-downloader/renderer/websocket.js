// WebSocket client using IPC to communicate with main process
let isConnected = false;
let onConnectionStatusChange = null;

/**
 * Initialize WebSocket connection via IPC
 */
async function connectWebSocket(apiUrl, kioskId, posId, kioskNo, statusCallback) {
  if (!apiUrl || !kioskId || !posId || kioskNo === null || kioskNo === undefined) {
    console.warn('Cannot connect WebSocket: missing required parameters');
    console.warn('apiUrl:', apiUrl, 'kioskId:', kioskId, 'posId:', posId, 'kioskNo:', kioskNo);
    return;
  }

  onConnectionStatusChange = statusCallback;

  console.log('Requesting WebSocket connection via IPC:', apiUrl, kioskId, posId, kioskNo);

  try {
    // Request connection via IPC with kiosk credentials for token authentication
    const result = await window.electronAPI.connectWebSocket(apiUrl, kioskId, posId, kioskNo);

    if (!result.success) {
      console.error('Failed to connect WebSocket:', result.error);
      if (onConnectionStatusChange) {
        onConnectionStatusChange(false, result.error || 'Connection failed');
      }
    }
  } catch (error) {
    console.error('Error connecting WebSocket:', error);
    if (onConnectionStatusChange) {
      onConnectionStatusChange(false, error.message);
    }
  }
}

/**
 * Send status update to server via IPC
 */
async function sendStatusUpdate(kioskId, status, details = {}) {
  try {
    await window.electronAPI.sendWebSocketStatus(kioskId, status, details);
  } catch (error) {
    console.warn('Failed to send status:', error);
  }
}

/**
 * Handle WebSocket status changes from main process
 */
function handleWebSocketStatus(data) {
  console.log('WebSocket status changed:', data);
  isConnected = data.connected;

  if (onConnectionStatusChange) {
    onConnectionStatusChange(data.connected, data.message);
  }
}

/**
 * Handle messages from WebSocket
 */
function handleKioskMessage(message) {
  console.log('Received WebSocket message:', message);

  switch (message.type) {
    case 'CONNECTED':
      showNotification('서버 연결됨', message.message, 'success');
      break;

    case 'HEARTBEAT_ACK':
      console.log('Heartbeat acknowledged');
      break;

    case 'SYNC_REQUEST':
      showNotification('동기화 요청', '서버에서 동기화를 요청했습니다.', 'info');
      // Trigger sync if button exists
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
 * Show notification to user
 */
function showNotification(title, message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);

  // Desktop notification if permitted
  if (window.Notification && Notification.permission === 'granted') {
    new Notification(title, { body: message });
  }
}

/**
 * Disconnect WebSocket via IPC
 */
async function disconnectWebSocket() {
  console.log('Disconnecting WebSocket via IPC...');

  try {
    await window.electronAPI.disconnectWebSocket();
    isConnected = false;

    if (onConnectionStatusChange) {
      onConnectionStatusChange(false, 'Disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting WebSocket:', error);
  }
}

/**
 * Check if WebSocket is connected
 */
function isWebSocketConnected() {
  return isConnected;
}

// Setup listeners for IPC events
if (window.electronAPI) {
  window.electronAPI.onWebSocketStatus(handleWebSocketStatus);
  window.electronAPI.onWebSocketMessage(handleKioskMessage);
}

// Export functions for use in app.js
window.WebSocketClient = {
  connect: connectWebSocket,
  disconnect: disconnectWebSocket,
  isConnected: isWebSocketConnected,
  sendStatus: sendStatusUpdate
};
