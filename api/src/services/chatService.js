const { admin, database } = require('../config/firebase');
const { generateChatKey, normalizeChatMessage } = require('../utils/chat');
const friendsService = require('./friendsService');

const CHAT_ROOT = 'chats';
const PRESENCE_ROOT = 'presence';
const TYPING_ROOT = 'typing';

const getMessagesRef = (chatKey) => database.ref(`${CHAT_ROOT}/${chatKey}/messages`);

const getPresenceRef = (userId) => database.ref(`${PRESENCE_ROOT}/${userId}`);

const getTypingRef = (chatKey, userId) => database.ref(`${TYPING_ROOT}/${chatKey}/${userId}`);

const mapSnapshotToMessages = (snapshot) => {
  const rawMessages = snapshot.val() || {};

  return Object.entries(rawMessages)
    .map(([messageId, rawMessage]) => normalizeChatMessage(messageId, rawMessage))
    .sort((left, right) => left.timestamp - right.timestamp);
};

const sendMessage = async (payload) => {
  const chatKey = generateChatKey(payload.senderId, payload.receiverId);
  const messageRef = getMessagesRef(chatKey).push();
  const receiverIsOnline = await isUserOnline(payload.receiverId);

  const message = normalizeChatMessage(messageRef.key, {
    ...payload,
    messageId: messageRef.key,
    status: receiverIsOnline ? 'DELIVERED' : 'SENT',
    timestamp: Date.now(),
  });

  await messageRef.set(message);
  return message;
};

const sendTextMessage = async (senderId, receiverId, text) =>
  sendMessage({
    senderId,
    receiverId,
    message: text,
    type: 'TEXT',
  });

const sendMediaMessage = async (senderId, receiverId, mediaUrl, mediaType) =>
  sendMessage({
    senderId,
    receiverId,
    mediaUrl,
    type: mediaType,
  });

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

  if (beforeMessageId) {
    const boundaryMessage = await getMessageById(chatKey, beforeMessageId);
    if (!boundaryMessage) {
      return { messages: [], hasOlder: false, hasNewer: true };
    }

    const snapshot = await getMessagesRef(chatKey)
      .orderByChild('timestamp')
      .endAt(boundaryMessage.timestamp - 1)
      .limitToLast(safeBatchSize + 1)
      .once('value');

    const messages = mapSnapshotToMessages(snapshot);
    return {
      messages: messages.slice(-safeBatchSize),
      hasOlder: messages.length > safeBatchSize,
      hasNewer: true,
    };
  }

  if (afterMessageId) {
    const boundaryMessage = await getMessageById(chatKey, afterMessageId);
    if (!boundaryMessage) {
      return { messages: [], hasOlder: true, hasNewer: false };
    }

    const snapshot = await getMessagesRef(chatKey)
      .orderByChild('timestamp')
      .startAt(boundaryMessage.timestamp + 1)
      .limitToFirst(safeBatchSize + 1)
      .once('value');

    const messages = mapSnapshotToMessages(snapshot);
    return {
      messages: messages.slice(0, safeBatchSize),
      hasOlder: true,
      hasNewer: messages.length > safeBatchSize,
    };
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

    return {
      messages,
      hasOlder: beforeMessages.length > beforeCount,
      hasNewer: afterMessages.length > 0,
    };
  }

  const latestSnapshot = await getMessagesRef(chatKey)
    .orderByChild('timestamp')
    .limitToLast(safeWindowSize + 1)
    .once('value');

  const latestMessages = mapSnapshotToMessages(latestSnapshot);
  return {
    messages: latestMessages.slice(-safeWindowSize),
    hasOlder: latestMessages.length > safeWindowSize,
    hasNewer: false,
  };
};

const buildConversationSummary = async (currentUserId, friend) => {
  const chatKey = generateChatKey(currentUserId, friend.document_Id);
  const snapshot = await getMessagesRef(chatKey)
    .orderByChild('timestamp')
    .limitToLast(50)
    .once('value');

  const messages = mapSnapshotToMessages(snapshot);
  const lastMessage = messages[messages.length - 1] || null;
  const unreadCount = messages.filter(
    (message) => message.receiverId === currentUserId && message.status !== 'READ'
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

const markConversationAsRead = async (userId, otherUserId) => {
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
  getConversationSummaries,
  isUserOnline,
  listenForMessages,
  loadChatHistoryByUsers,
  loadChatHistoryWindowByUsers,
  markConversationAsRead,
  sendMediaMessage,
  sendTextMessage,
  sendTypingIndicator,
  updateMessageStatus,
};
