const { admin, database } = require('../config/firebase');
const { generateChatKey, normalizeChatMessage } = require('../utils/chat');
const friendsService = require('./friendsService');

const CHAT_ROOT = 'chats';
const PRESENCE_ROOT = 'presence';
const TYPING_ROOT = 'typing';
const READ_ANCHOR_ROOT = 'readAnchors';

const getMessagesRef = (chatKey) => database.ref(`${CHAT_ROOT}/${chatKey}/messages`);

const getPresenceRef = (userId) => database.ref(`${PRESENCE_ROOT}/${userId}`);

const getTypingRef = (chatKey, userId) => database.ref(`${TYPING_ROOT}/${chatKey}/${userId}`);
const getReadAnchorRef = (chatKey, userId) =>
  database.ref(`${CHAT_ROOT}/${chatKey}/${READ_ANCHOR_ROOT}/${userId}`);

const mapSnapshotToMessages = (snapshot) => {
  const rawMessages = snapshot.val() || {};

  return Object.entries(rawMessages)
    .map(([messageId, rawMessage]) => normalizeChatMessage(messageId, rawMessage))
    .sort((left, right) => left.timestamp - right.timestamp);
};

const getMessageById = async (chatKey, messageId) => {
  if (!messageId) {
    return null;
  }

  const snapshot = await getMessagesRef(chatKey).child(messageId).once('value');
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeChatMessage(snapshot.key, snapshot.val());
};

const getMessageByClientMessageId = async (chatKey, clientMessageId) => {
  if (!clientMessageId) {
    return null;
  }

  const snapshot = await getMessagesRef(chatKey)
    .orderByChild('clientMessageId')
    .equalTo(clientMessageId)
    .limitToFirst(1)
    .once('value');

  if (!snapshot.exists()) {
    return null;
  }

  const [messageId, rawMessage] = Object.entries(snapshot.val() || {})[0] || [];
  if (!messageId || !rawMessage) {
    return null;
  }

  return normalizeChatMessage(messageId, rawMessage);
};

const sendMessage = async (payload) => {
  const chatKey = generateChatKey(payload.senderId, payload.receiverId);

  if (payload.clientMessageId) {
    const existingMessage = await getMessageByClientMessageId(chatKey, payload.clientMessageId);
    if (existingMessage) {
      return existingMessage;
    }
  }

  const messageRef = getMessagesRef(chatKey).push();
  const receiverIsOnline = await isUserOnline(payload.receiverId);

  const message = normalizeChatMessage(messageRef.key, {
    ...payload,
    messageId: messageRef.key,
    clientMessageId: payload.clientMessageId || '',
    status: receiverIsOnline ? 'DELIVERED' : 'SENT',
    timestamp: Date.now(),
  });

  await messageRef.set(message);
  return message;
};

const sendTextMessage = async (senderId, receiverId, text, clientMessageId = '') =>
  sendMessage({
    senderId,
    receiverId,
    message: text,
    type: 'TEXT',
    clientMessageId,
  });

const sendMediaMessage = async (senderId, receiverId, mediaUrl, mediaType) =>
  sendMessage({
    senderId,
    receiverId,
    mediaUrl,
    type: mediaType,
  });

const dedupeMessages = (messages) => {
  const seenIds = new Set();

  return messages.filter((message) => {
    const messageId = String(message.messageId || '');
    if (!messageId || seenIds.has(messageId)) {
      return false;
    }

    seenIds.add(messageId);
    return true;
  });
};

const getConversationReadAnchor = async (userId, otherUserId) => {
  const chatKey = generateChatKey(userId, otherUserId);
  const snapshot = await getReadAnchorRef(chatKey, userId).once('value');

  if (!snapshot.exists()) {
    return {
      lastReadMessageId: '',
      lastReadTimestamp: null,
      updatedAt: null,
    };
  }

  return {
    lastReadMessageId: String(snapshot.child('lastReadMessageId').val() || ''),
    lastReadTimestamp: Number(snapshot.child('lastReadTimestamp').val() || 0) || null,
    updatedAt: Number(snapshot.child('updatedAt').val() || 0) || null,
  };
};

const saveConversationReadAnchor = async (
  userId,
  otherUserId,
  { lastReadMessageId = '', lastReadTimestamp = null } = {}
) => {
  const chatKey = generateChatKey(userId, otherUserId);
  let nextTimestamp = Number(lastReadTimestamp || 0) || null;
  let nextMessageId = String(lastReadMessageId || '');

  if (nextMessageId && !nextTimestamp) {
    const anchorMessage = await getMessageById(chatKey, nextMessageId);
    if (anchorMessage) {
      nextTimestamp = anchorMessage.timestamp;
      nextMessageId = anchorMessage.messageId;
    }
  }

  await getReadAnchorRef(chatKey, userId).set({
    lastReadMessageId: nextMessageId,
    lastReadTimestamp: nextTimestamp,
    updatedAt: Date.now(),
  });

  return {
    lastReadMessageId: nextMessageId,
    lastReadTimestamp: nextTimestamp,
  };
};

const loadChatHistoryByUsers = async (userId, otherUserId, limit = 100) => {
  const chatKey = generateChatKey(userId, otherUserId);
  const snapshot = await getMessagesRef(chatKey)
    .orderByChild('timestamp')
    .limitToLast(limit)
    .once('value');

  return mapSnapshotToMessages(snapshot);
};

const loadChatHistoryWindowByUsers = async (
  userId,
  otherUserId,
  { anchorMessageId = '', beforeMessageId = '', afterMessageId = '', windowSize = 10, batchSize = 24 } = {}
) => {
  const chatKey = generateChatKey(userId, otherUserId);
  const safeWindowSize = Math.max(1, Math.min(Number(windowSize || 10), 40));
  const safeBatchSize = Math.max(1, Math.min(Number(batchSize || 24), 60));
  const readAnchor = await getConversationReadAnchor(userId, otherUserId);

  const buildWindowPayload = (messages, hasOlder, hasNewer) => {
    const unreadCount = messages.filter(
      (message) =>
        message.receiverId === userId &&
        message.senderId === otherUserId &&
        (!readAnchor.lastReadTimestamp || message.timestamp > readAnchor.lastReadTimestamp)
    ).length;

    return {
      messages,
      hasOlder,
      hasNewer,
      readAnchorMessageId: readAnchor.lastReadMessageId,
      readAnchorTimestamp: readAnchor.lastReadTimestamp,
      unreadCount,
    };
  };

  if (beforeMessageId) {
    const boundaryMessage = await getMessageById(chatKey, beforeMessageId);
    if (!boundaryMessage) {
      return buildWindowPayload([], false, true);
    }

    const snapshot = await getMessagesRef(chatKey)
      .orderByChild('timestamp')
      .endAt(boundaryMessage.timestamp - 1)
      .limitToLast(safeBatchSize + 1)
      .once('value');

    const messages = mapSnapshotToMessages(snapshot);
    return buildWindowPayload(messages.slice(-safeBatchSize), messages.length > safeBatchSize, true);
  }

  if (afterMessageId) {
    const boundaryMessage = await getMessageById(chatKey, afterMessageId);
    if (!boundaryMessage) {
      return buildWindowPayload([], true, false);
    }

    const snapshot = await getMessagesRef(chatKey)
      .orderByChild('timestamp')
      .startAt(boundaryMessage.timestamp + 1)
      .limitToFirst(safeBatchSize + 1)
      .once('value');

    const messages = mapSnapshotToMessages(snapshot);
    return buildWindowPayload(messages.slice(0, safeBatchSize), true, messages.length > safeBatchSize);
  }

  const anchorMessage = await getMessageById(chatKey, anchorMessageId);

  if (anchorMessage) {
    const beforeCount = Math.max(safeWindowSize - 1, 0);
    const [beforeSnapshot, afterSnapshot] = await Promise.all([
      getMessagesRef(chatKey)
        .orderByChild('timestamp')
        .endAt(anchorMessage.timestamp)
        .limitToLast(beforeCount + 1)
        .once('value'),
      getMessagesRef(chatKey)
        .orderByChild('timestamp')
        .startAt(anchorMessage.timestamp + 1)
        .limitToFirst(1)
        .once('value'),
    ]);

    const beforeMessages = mapSnapshotToMessages(beforeSnapshot);
    const afterMessages = mapSnapshotToMessages(afterSnapshot);
    const messages = dedupeMessages([...beforeMessages, ...afterMessages]).slice(-safeWindowSize);

    return buildWindowPayload(messages, beforeMessages.length > beforeCount, afterMessages.length > 0);
  }

  const latestSnapshot = await getMessagesRef(chatKey)
    .orderByChild('timestamp')
    .limitToLast(safeWindowSize + 1)
    .once('value');

  const latestMessages = mapSnapshotToMessages(latestSnapshot);
  return buildWindowPayload(
    latestMessages.slice(-safeWindowSize),
    latestMessages.length > safeWindowSize,
    false
  );
};

const buildConversationSummary = async (currentUserId, friend) => {
  const chatKey = generateChatKey(currentUserId, friend.document_Id);
  const snapshot = await getMessagesRef(chatKey)
    .orderByChild('timestamp')
    .limitToLast(50)
    .once('value');
  const readAnchor = await getConversationReadAnchor(currentUserId, friend.document_Id);

  const messages = mapSnapshotToMessages(snapshot);
  const lastMessage = messages[messages.length - 1] || null;
  const unreadCount = messages.filter(
    (message) =>
      message.receiverId === currentUserId &&
      message.senderId === friend.document_Id &&
      (!readAnchor.lastReadTimestamp || message.timestamp > readAnchor.lastReadTimestamp)
  ).length;

  return {
    ...friend,
    chatKey,
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
    lastReadMessageId: readAnchor.lastReadMessageId,
    lastReadTimestamp: readAnchor.lastReadTimestamp,
  };
};

const getConversationSummaries = async (currentUserId) => {
  const friends = await friendsService.getFriends(currentUserId);
  const summaries = await Promise.all(
    friends.map((friend) => buildConversationSummary(currentUserId, friend))
  );

  return summaries.sort((left, right) => {
    const leftTimestamp = Number(left.lastMessageTimestamp || 0);
    const rightTimestamp = Number(right.lastMessageTimestamp || 0);

    if (leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    return String(left.fullName || '').localeCompare(String(right.fullName || ''));
  });
};

const updateMessageStatus = async (messageId, senderId, receiverId, status) => {
  const chatKey = generateChatKey(senderId, receiverId);
  await getMessagesRef(chatKey).child(messageId).update({ status });
};

const markConversationAsRead = async (userId, otherUserId, lastReadMessageId = '') => {
  const chatKey = generateChatKey(userId, otherUserId);
  const snapshot = await getMessagesRef(chatKey)
    .orderByChild('receiverId')
    .equalTo(userId)
    .once('value');

  const updates = {};
  snapshot.forEach((childSnapshot) => {
    const message = normalizeChatMessage(childSnapshot.key, childSnapshot.val());

    if (message.status !== 'READ') {
      updates[`${childSnapshot.key}/status`] = 'READ';
    }
  });

  if (Object.keys(updates).length > 0) {
    await getMessagesRef(chatKey).update(updates);
  }

  let anchorMessage = null;

  if (lastReadMessageId) {
    anchorMessage = await getMessageById(chatKey, lastReadMessageId);
  }

  if (!anchorMessage) {
    const latestMessages = await loadChatHistoryByUsers(userId, otherUserId, 1);
    anchorMessage = latestMessages[latestMessages.length - 1] || null;
  }

  if (anchorMessage) {
    await saveConversationReadAnchor(userId, otherUserId, {
      lastReadMessageId: anchorMessage.messageId,
      lastReadTimestamp: anchorMessage.timestamp,
    });
  }
};

const isUserOnline = async (userId) => {
  const snapshot = await getPresenceRef(userId).once('value');
  return snapshot.exists() && snapshot.child('status').val() === 'online';
};

const sendTypingIndicator = async (userId, receiverId, isTyping) => {
  const chatKey = generateChatKey(userId, receiverId);
  const typingRef = getTypingRef(chatKey, userId);

  if (isTyping) {
    await typingRef.set({
      status: 'typing',
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    });
    return;
  }

  await typingRef.remove();
};

const listenForMessages = (userId, otherUserId, onMessage, onError) => {
  const chatKey = generateChatKey(userId, otherUserId);
  const messagesQuery = getMessagesRef(chatKey).limitToLast(100);

  const handleSnapshot = (snapshot) => {
    onMessage(mapSnapshotToMessages(snapshot));
  };

  const handleError = (error) => onError(error);

  messagesQuery.on('value', handleSnapshot, handleError);

  return () => {
    messagesQuery.off('value', handleSnapshot);
  };
};

module.exports = {
  getConversationReadAnchor,
  getConversationSummaries,
  isUserOnline,
  listenForMessages,
  loadChatHistoryByUsers,
  loadChatHistoryWindowByUsers,
  markConversationAsRead,
  saveConversationReadAnchor,
  sendMediaMessage,
  sendTextMessage,
  sendTypingIndicator,
  updateMessageStatus,
};
