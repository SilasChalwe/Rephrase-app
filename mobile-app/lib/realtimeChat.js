import {
  limitToLast,
  onDisconnect,
  onValue,
  query,
  ref,
  serverTimestamp,
  set,
} from 'firebase/database';

import { FIREBASE_DATABASE } from '../firebase';

const PRESENCE_ROOT = 'presence';
const TYPING_ROOT = 'typing';

export const buildChatKey = (uid1, uid2) => {
  const left = String(uid1 || '').toLowerCase();
  const right = String(uid2 || '').toLowerCase();

  return left.localeCompare(right) < 0 ? `${left}_${right}` : `${right}_${left}`;
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

export const normalizeChatMessage = (messageId = '', rawMessage = {}) => {
  const mediaUrl = deriveMediaUrl(rawMessage);
  const mimeType = deriveMimeType(rawMessage);

  return {
    messageId: rawMessage.messageId || messageId,
    clientMessageId: rawMessage.clientMessageId || '',
    senderId: rawMessage.senderId || '',
    receiverId: rawMessage.receiverId || '',
    message: rawMessage.message || '',
    status: rawMessage.status || 'SENT',
    mediaUrl,
    thumbnailUrl: rawMessage.thumbnailUrl ? String(rawMessage.thumbnailUrl) : null,
    mimeType,
    fileName: deriveFileName(rawMessage, mediaUrl),
    fileSize: Number(rawMessage.fileSize || rawMessage.size || 0) || null,
    type: normalizeMessageType(rawMessage, mimeType, mediaUrl),
    timestamp: Number(rawMessage.timestamp || Date.now()),
  };
};

const mapSnapshotToMessages = (snapshot) => {
  const rawMessages = snapshot.val() || {};

  return Object.entries(rawMessages)
    .map(([messageId, rawMessage]) => normalizeChatMessage(messageId, rawMessage))
    .sort((left, right) => left.timestamp - right.timestamp);
};

const buildConversationSummary = (currentUserId, otherUserId, snapshot) => {
  const messages = mapSnapshotToMessages(snapshot);
  const lastMessage = messages[messages.length - 1] || null;
  const unreadCount = messages.filter(
    (message) => message.receiverId === currentUserId && message.status !== 'READ'
  ).length;

  return {
    document_Id: otherUserId,
    unreadCount,
    lastMessageText:
      lastMessage?.type === 'TEXT'
        ? lastMessage.message
        : lastMessage?.mediaUrl
          ? 'Sent a media message'
          : '',
    lastMessageType: lastMessage?.type || null,
    lastMessageStatus: lastMessage?.status || null,
    lastMessageSenderId: lastMessage?.senderId || null,
    lastMessageTimestamp: lastMessage?.timestamp || null,
  };
};

const getPresenceRef = (userId) => ref(FIREBASE_DATABASE, `${PRESENCE_ROOT}/${userId}`);
const getTypingRef = (chatKey, userId) => ref(FIREBASE_DATABASE, `${TYPING_ROOT}/${chatKey}/${userId}`);

export const subscribeToConversationMessages = (currentUserId, otherUserId, onMessages, onError) => {
  const chatKey = buildChatKey(currentUserId, otherUserId);
  const messagesQuery = query(ref(FIREBASE_DATABASE, `chats/${chatKey}/messages`), limitToLast(100));

  return onValue(
    messagesQuery,
    (snapshot) => onMessages(mapSnapshotToMessages(snapshot)),
    onError
  );
};

export const subscribeToConversationSummaryMap = (
  currentUserId,
  otherUserIds,
  onSummaries,
  onError
) => {
  const targetIds = [...new Set((otherUserIds || []).map((userId) => String(userId || '')).filter(Boolean))];

  if (!currentUserId || !targetIds.length) {
    onSummaries({});
    return () => {};
  }

  const summaries = {};
  const unsubscribers = targetIds.map((otherUserId) => {
    const chatKey = buildChatKey(currentUserId, otherUserId);
    const messagesQuery = query(ref(FIREBASE_DATABASE, `chats/${chatKey}/messages`), limitToLast(50));

    return onValue(
      messagesQuery,
      (snapshot) => {
        summaries[otherUserId] = buildConversationSummary(currentUserId, otherUserId, snapshot);
        onSummaries({ ...summaries });
      },
      onError
    );
  });

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
};

export const setUserPresenceOnline = async (userId) =>
  set(getPresenceRef(userId), {
    status: 'online',
    lastChanged: serverTimestamp(),
  });

export const setUserPresenceOffline = async (userId) =>
  set(getPresenceRef(userId), {
    status: 'offline',
    lastChanged: serverTimestamp(),
  });

export const subscribeToPresenceMap = (userIds, onPresence, onError) => {
  const targetIds = new Set((userIds || []).map((userId) => String(userId || '')).filter(Boolean));

  if (!targetIds.size) {
    onPresence({});
    return () => {};
  }

  const presenceRootRef = ref(FIREBASE_DATABASE, PRESENCE_ROOT);

  return onValue(
    presenceRootRef,
    (snapshot) => {
      const rawPresence = snapshot.val() || {};
      const nextPresence = {};

      targetIds.forEach((userId) => {
        const currentPresence = rawPresence[userId];
        nextPresence[userId] = {
          status: currentPresence?.status || 'offline',
          lastChanged: currentPresence?.lastChanged ?? null,
        };
      });

      onPresence(nextPresence);
    },
    onError
  );
};

export const subscribeToUserPresence = (userId, onPresence, onError) => {
  if (!userId) {
    onPresence({ status: 'offline', lastChanged: null });
    return () => {};
  }

  return onValue(
    getPresenceRef(userId),
    (snapshot) => {
      const currentPresence = snapshot.val() || {};
      onPresence({
        status: currentPresence.status || 'offline',
        lastChanged: currentPresence.lastChanged ?? null,
      });
    },
    onError
  );
};

export const startTypingSession = (currentUserId, otherUserId) => {
  const chatKey = buildChatKey(currentUserId, otherUserId);
  const typingRef = getTypingRef(chatKey, currentUserId);
  const connectedRef = ref(FIREBASE_DATABASE, '.info/connected');

  const unsubscribe = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() !== true) {
      return;
    }

    try {
      await onDisconnect(typingRef).set({
        isTyping: false,
        lastChanged: serverTimestamp(),
      });
    } catch (error) {
      console.warn('Failed to initialize typing session:', error);
    }
  });

  const setTyping = async (isTyping) =>
    set(typingRef, {
      isTyping: !!isTyping,
      lastChanged: serverTimestamp(),
    });

  const stop = () => {
    unsubscribe();
    onDisconnect(typingRef).cancel().catch(() => {});
    setTyping(false).catch(() => {});
  };

  return { setTyping, stop };
};

export const subscribeToTypingStatus = (currentUserId, otherUserId, onTyping, onError) => {
  if (!currentUserId || !otherUserId) {
    onTyping(false);
    return () => {};
  }

  const chatKey = buildChatKey(currentUserId, otherUserId);

  return onValue(
    getTypingRef(chatKey, otherUserId),
    (snapshot) => {
      const currentTyping = snapshot.val() || {};
      onTyping(!!currentTyping.isTyping);
    },
    onError
  );
};

export const subscribeToTypingMap = (currentUserId, otherUserIds, onTypingMap, onError) => {
  const targetIds = [...new Set((otherUserIds || []).map((userId) => String(userId || '')).filter(Boolean))];

  if (!currentUserId || !targetIds.length) {
    onTypingMap({});
    return () => {};
  }

  const typingMap = {};
  const unsubscribers = targetIds.map((otherUserId) =>
    subscribeToTypingStatus(
      currentUserId,
      otherUserId,
      (isTyping) => {
        typingMap[otherUserId] = !!isTyping;
        onTypingMap({ ...typingMap });
      },
      onError
    )
  );

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
};

export const startUserPresenceSession = (userId) => {
  const presenceRef = getPresenceRef(userId);
  const connectedRef = ref(FIREBASE_DATABASE, '.info/connected');

  const unsubscribe = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() !== true) {
      return;
    }

    try {
      await onDisconnect(presenceRef).set({
        status: 'offline',
        lastChanged: serverTimestamp(),
      });

      await setUserPresenceOnline(userId);
    } catch (error) {
      console.warn('Failed to initialize presence session:', error);
    }
  });

  return () => {
    unsubscribe();
    onDisconnect(presenceRef).cancel().catch(() => {});
  };
};
