/**
 * Date utility functions for consistent KST (Korea Standard Time) formatting
 */

/**
 * Format timestamp to KST string
 * @param {string|Date|Object} timestamp - ISO timestamp, Date object, or Firebase Timestamp
 * @param {boolean} includeTime - Whether to include time (default: true)
 * @returns {string} Formatted date string in KST
 */
export const formatKSTDate = (timestamp, includeTime = true) => {
  if (!timestamp) return 'N/A';

  // Handle Firebase Timestamp objects
  let date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp);
  }

  // Check if date is valid
  if (isNaN(date.getTime())) return 'N/A';

  // Convert to KST (Korea Standard Time, UTC+9)
  const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');

  if (!includeTime) {
    return `${year}-${month}-${day}`;
  }

  const hours = String(kstDate.getHours()).padStart(2, '0');
  const minutes = String(kstDate.getMinutes()).padStart(2, '0');
  const seconds = String(kstDate.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Format timestamp to short KST date (YYYY-MM-DD)
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @returns {string} Formatted date string
 */
export const formatKSTDateShort = (timestamp) => {
  return formatKSTDate(timestamp, false);
};

/**
 * Format timestamp using Korean locale
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @returns {string} Formatted date string in Korean locale
 */
export const formatKSTLocale = (timestamp) => {
  if (!timestamp) return 'N/A';

  // Handle Firebase Timestamp objects
  let date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp);
  }

  // Check if date is valid
  if (isNaN(date.getTime())) return 'N/A';

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};
