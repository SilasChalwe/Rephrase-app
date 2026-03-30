import { buildApiUrl } from './api';

export const CHAT_PAGE_SIZE = 30;

const buildHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const buildUploadHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

const readErrorMessage = async (response, fallbackMessage) => {
  try {
    const payload = await response.json();
    return String(payload?.message || fallbackMessage);
  } catch {
    return fallbackMessage;
  }
};

const deriveMediaUrl = (rawMessage = {}) => {
  const value =
    rawMessage.mediaUrl ??
    rawMessage.MediaUrl ??
    rawMessage.fileUrl ??
    rawMessage.url ??
    null;

  return value ? String(value) : null;
};

const deriveMimeType = (rawMessage = {}) =>
  String(rawMessage.mimeType || rawMessage.contentType || '').toLowerCase();

const deriveFileName = (rawMessage = {}, mediaUrl) => {
  if (rawMessage.fileName || rawMessage.name) {
    return String(rawMessage.fileName || rawMessage.name);
  }

  if (!mediaUrl) {
    return '';
  }

  try {
    const normalizedUrl = decodeURIComponent(String(mediaUrl).split('?')[0] || '');
    const segments = normalizedUrl.split('/');
    return String(segments[segments.length - 1] || '');
  } catch {
    return '';
  }
};

const normalizeMessageType = (rawMessage = {}, mimeType = '', mediaUrl = null) => {
  const normalizedType = String(rawMessage.type || rawMessage.Type || '').toUpperCase();

  if (normalizedType.includes('IMAGE') || mimeType.startsWith('image/')) {
    return 'IMAGE';
  }

  if (normalizedType.includes('VIDEO') || mimeType.startsWith('video/')) {
    return 'VIDEO';
  }

  if (
    normalizedType.includes('DOC') ||
    normalizedType.includes('FILE') ||
    normalizedType.includes('PDF') ||
    normalizedType.includes('MEDIA')
  ) {
    return 'DOCUMENT';
  }

  if (mediaUrl) {
    return 'DOCUMENT';
  }

  return 'TEXT';
};

const normalizeStatus = (status, localState) => {
  const normalizedLocalState = String(localState || '').toUpperCase();
  if (normalizedLocalState === 'PENDING') {
    return 'pending';
  }

  if (normalizedLocalState === 'FAILED') {
    return 'failed';
  }

  switch (String(status || '').toUpperCase()) {
    case 'READ':
      return 'read';
    case 'DELIVERED':
      return 'delivered';
    case 'FAILED':
      return 'failed';
    default:
      return 'sent';
  }
};

export const normalizeChatMessage = (rawMessage = {}) => {
  const fallbackId = String(
    rawMessage.messageId || rawMessage.id || rawMessage.clientMessageId || ''
  );
  const mediaUrl = deriveMediaUrl(rawMessage);
  const mimeType = deriveMimeType(rawMessage);

  return {
    id: fallbackId,
    messageId: fallbackId,
    clientMessageId: String(rawMessage.clientMessageId || ''),
    text: String(rawMessage.message || rawMessage.text || ''),
    senderId: String(rawMessage.senderId || ''),
    receiverId: String(rawMessage.receiverId || ''),
    createdAt: Number(rawMessage.timestamp || rawMessage.createdAt || Date.now()),
    status: normalizeStatus(rawMessage.status, rawMessage.localState),
    mediaUrl,
    thumbnailUrl: rawMessage.thumbnailUrl ? String(rawMessage.thumbnailUrl) : null,
    mimeType,
    fileName: deriveFileName(rawMessage, mediaUrl),
    fileSize: Number(rawMessage.fileSize || rawMessage.size || 0) || null,
    type: normalizeMessageType(rawMessage, mimeType, mediaUrl),
  };
};

const chooseCanonicalMessage = (currentMessage, nextMessage) => {
  if (!currentMessage) {
    return nextMessage;
  }

  const currentIsServerMessage =
    !!currentMessage.id && currentMessage.id !== currentMessage.clientMessageId;
  const nextIsServerMessage = !!nextMessage.id && nextMessage.id !== nextMessage.clientMessageId;

  if (nextIsServerMessage && !currentIsServerMessage) {
    return nextMessage;
  }

  if (currentIsServerMessage && !nextIsServerMessage) {
    return currentMessage;
  }

  if (nextMessage.createdAt >= currentMessage.createdAt) {
    return { ...currentMessage, ...nextMessage };
  }

  return currentMessage;
};

export const normalizeChatMessages = (rawMessages = []) => {
  const messageMap = [...rawMessages]
    .map(normalizeChatMessage)
    .filter((message) => message.id)
    .reduce((currentMap, message) => {
      const identityKey = String(message.clientMessageId || message.id || '');
      if (!identityKey) {
        return currentMap;
      }

      currentMap.set(identityKey, chooseCanonicalMessage(currentMap.get(identityKey), message));
      return currentMap;
    }, new Map());

  return [...messageMap.values()].sort((left, right) => right.createdAt - left.createdAt);
};

const requestChatPage = async ({ token, otherUserId, queryString }) => {
  const response = await fetch(
    buildApiUrl(`/api/chat/messages/${otherUserId}${queryString ? `?${queryString}` : ''}`),
    {
      headers: buildHeaders(token),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to load messages.');
  }

  const payload = await response.json();
  const messages = normalizeChatMessages(payload?.messages);

  return {
    messages,
    hasOlder: !!payload?.hasOlder,
    hasNewer: !!payload?.hasNewer,
    oldestCursor: messages[messages.length - 1]?.id || null,
    newestCursor: messages[0]?.id || null,
    readAnchorMessageId: String(payload?.readAnchorMessageId || ''),
    readAnchorTimestamp: Number(payload?.readAnchorTimestamp || 0) || null,
    unreadCount: Number(payload?.unreadCount || 0) || 0,
  };
};

export const fetchInitialMessagesPage = async ({
  token,
  otherUserId,
  limit = CHAT_PAGE_SIZE,
}) =>
  requestChatPage({
    token,
    otherUserId,
    queryString: `windowSize=${Number(limit || CHAT_PAGE_SIZE)}`,
  });

export const fetchOlderMessagesPage = async ({
  token,
  otherUserId,
  beforeMessageId,
  limit = CHAT_PAGE_SIZE,
}) =>
  requestChatPage({
    token,
    otherUserId,
    queryString: `beforeMessageId=${encodeURIComponent(
      beforeMessageId
    )}&batchSize=${Number(limit || CHAT_PAGE_SIZE)}`,
  });

export const sendTextMessageRequest = async ({
  token,
  otherUserId,
  text,
  clientMessageId,
}) => {
  const response = await fetch(buildApiUrl('/api/chat/messages/text'), {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({
      receiverId: otherUserId,
      text,
      clientMessageId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message.');
  }

  return normalizeChatMessage(await response.json());
};

export const uploadChatAttachmentRequest = async ({ token, file }) => {
  const formData = new FormData();

  formData.append('file', {
    uri: file.uri,
    name: file.name || `attachment-${Date.now()}`,
    type: file.type || 'application/octet-stream',
  });

  const response = await fetch(buildApiUrl('/api/chat/attachments/upload'), {
    method: 'POST',
    headers: buildUploadHeaders(token),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to upload chat attachment.'));
  }

  return response.json();
};

export const sendMediaMessageRequest = async ({
  token,
  otherUserId,
  mediaUrl,
  mediaType,
  mimeType,
  fileName,
  fileSize,
  thumbnailUrl,
}) => {
  const response = await fetch(buildApiUrl('/api/chat/messages/media'), {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({
      receiverId: otherUserId,
      mediaUrl,
      mediaType,
      mimeType,
      fileName,
      fileSize,
      thumbnailUrl,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to send media message.'));
  }

  return normalizeChatMessage(await response.json());
};

export const markConversationReadRequest = async ({ token, otherUserId, lastReadMessageId }) => {
  const response = await fetch(buildApiUrl(`/api/chat/conversations/read?id=${otherUserId}`), {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({
      lastReadMessageId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to mark conversation as read.');
  }
};

export const saveConversationAnchorRequest = async ({
  token,
  otherUserId,
  lastReadMessageId,
  lastReadTimestamp,
}) => {
  const response = await fetch(buildApiUrl('/api/chat/conversations/anchor'), {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({
      receiverId: otherUserId,
      lastReadMessageId,
      lastReadTimestamp,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save conversation anchor.');
  }

  return response.json();
};
