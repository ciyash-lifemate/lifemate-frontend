// Mirrors the backend's message_type enum.
export const MESSAGE_TYPES = ['text', 'image', 'video', 'audio', 'voice', 'document', 'location'];

// Shown as a chat list preview when the last message has no text content of its own.
export const labelForMessageType = (type) => {
  switch (type) {
    case 'image':
      return '📷 Photo';
    case 'video':
      return '🎥 Video';
    case 'audio':
      return '🎵 Audio';
    case 'voice':
      return '🎤 Voice message';
    case 'document':
      return '📄 Document';
    case 'location':
      return '📍 Location';
    default:
      return 'Say hello 👋';
  }
};

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB'];

// e.g. 234322 -> "228.8 KB"
export const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '';
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), SIZE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(1)} ${SIZE_UNITS[exponent]}`;
};

// e.g. 75 -> "1:15"
export const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};
