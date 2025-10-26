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

  if (data.connected) {
    Logger.info(Logger.Events.WEBSOCKET_CONNECTED, 'WebSocket 연결됨', { message: data.message });
  } else {
    Logger.warn(Logger.Events.WEBSOCKET_DISCONNECTED, 'WebSocket 연결 끊김', { message: data.message });
  }

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
      console.log('[CONNECTED] 서버에 연결되었습니다:', message.message);
      break;

    case 'HEARTBEAT_ACK':
      console.log('Heartbeat acknowledged');
      break;

    case 'SYNC_REQUEST':
      console.log('[SYNC_REQUEST] 서버에서 동기화를 요청했습니다');
      // Trigger auto-sync (no popup)
      if (window.syncVideos) {
        console.log('[SYNC_REQUEST] 자동 동기화 시작 (팝업 없음)');
        window.syncVideos(true); // isAutoSync = true
      } else {
        console.warn('[SYNC_REQUEST] syncVideos 함수를 찾을 수 없습니다');
      }
      break;

    case 'SYNC_COMMAND':
      console.log('[SYNC_COMMAND] 관리자가 영상 동기화를 요청했습니다:', message.message);
      Logger.info(Logger.Events.SYNC_COMMAND_RECEIVED, '관리자가 영상 동기화를 요청함', {
        message: message.message
      });
      // Trigger auto-sync (no popup)
      if (window.syncVideos) {
        console.log('[SYNC_COMMAND] 자동 동기화 시작 (팝업 없음)');
        window.syncVideos(true); // isAutoSync = true
      } else {
        console.warn('[SYNC_COMMAND] syncVideos 함수를 찾을 수 없습니다');
      }
      break;

    case 'CONFIG_UPDATE':
      console.log('[WebSocket] Config update notification:', message.message);
      Logger.info(Logger.Events.CONFIG_UPDATED, '서버에서 설정 업데이트 알림 수신', {
        message: message.message
      });
      // Dispatch event to app.js to reload configuration
      window.dispatchEvent(new CustomEvent('websocket-config-update', { detail: message }));
      break;

    case 'SYNC_RESPONSE':
      console.log('[SYNC_RESPONSE] 동기화 응답 수신:', message);
      Logger.info(Logger.Events.WEBSOCKET_MESSAGE, '동기화 응답 수신', {
        success: message.success,
        videoCount: message.data ? message.data.length : 0
      });
      // Dispatch sync response event to app.js
      window.dispatchEvent(new CustomEvent('websocket-sync-response', { detail: message }));
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
