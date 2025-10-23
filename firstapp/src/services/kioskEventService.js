import api from './api';

/**
 * Get all kiosk events
 */
export const getAllKioskEvents = async () => {
  try {
    const response = await api.get('/kiosk-events');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch all kiosk events:', error);
    throw error;
  }
};

/**
 * Get events for a specific kiosk by kioskid
 */
export const getKioskEventsByKioskid = async (kioskid) => {
  try {
    const response = await api.get(`/kiosk-events/kiosk/${kioskid}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch events for kiosk ${kioskid}:`, error);
    throw error;
  }
};

/**
 * Get recent events for a specific kiosk (last 50)
 */
export const getRecentKioskEvents = async (kioskid) => {
  try {
    const response = await api.get(`/kiosk-events/kiosk/${kioskid}/recent`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch recent events for kiosk ${kioskid}:`, error);
    throw error;
  }
};

/**
 * Get events by event type
 */
export const getKioskEventsByType = async (eventType) => {
  try {
    const response = await api.get(`/kiosk-events/type/${eventType}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch events of type ${eventType}:`, error);
    throw error;
  }
};

/**
 * Get events for a kiosk by event type
 */
export const getKioskEventsByKioskidAndType = async (kioskid, eventType) => {
  try {
    const response = await api.get(`/kiosk-events/kiosk/${kioskid}/type/${eventType}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch events for kiosk ${kioskid} of type ${eventType}:`, error);
    throw error;
  }
};

/**
 * Get events by POS ID
 */
export const getKioskEventsByPosid = async (posid) => {
  try {
    const response = await api.get(`/kiosk-events/pos/${posid}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch events for POS ${posid}:`, error);
    throw error;
  }
};

/**
 * Get events within a date range
 */
export const getKioskEventsByDateRange = async (start, end) => {
  try {
    const response = await api.get('/kiosk-events/range', {
      params: { start, end }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch events by date range:', error);
    throw error;
  }
};

/**
 * Get events for a kiosk within a date range
 */
export const getKioskEventsByKioskidAndDateRange = async (kioskid, start, end) => {
  try {
    const response = await api.get(`/kiosk-events/kiosk/${kioskid}/range`, {
      params: { start, end }
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch events for kiosk ${kioskid} by date range:`, error);
    throw error;
  }
};

/**
 * Get event count for a kiosk
 */
export const getKioskEventCount = async (kioskid) => {
  try {
    const response = await api.get(`/kiosk-events/kiosk/${kioskid}/count`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch event count for kiosk ${kioskid}:`, error);
    throw error;
  }
};

/**
 * Record a new kiosk event
 */
export const recordKioskEvent = async (eventData) => {
  try {
    const response = await api.post('/kiosk-events', eventData);
    return response.data;
  } catch (error) {
    console.error('Failed to record kiosk event:', error);
    throw error;
  }
};
