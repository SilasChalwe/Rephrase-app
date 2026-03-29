const { firestore } = require('../config/firebase');
const { generateChatKey, normalizeChatMessage } = require('../utils/chat');

const getMessagesCollection = (chatKey) =>
  firestore.collection('chats').doc(chatKey).collection('messages');

const sendMessage = async (payload) => {
  const chatKey = generateChatKey(payload.senderId, payload.receiverId);
  const messageRef = getMessagesCollection(chatKey).doc();

  const message = normalizeChatMessage(messageRef.id, {
    ...payload,
    messageId: messageRef.id,
    status: 'SENT',
    timestamp: Date.now(),
  });

  await messageRef.set(message);

  if (await isUserOnline(payload.receiverId)) {
    await messageRef.update({ status: 'DELIVERED' });
    message.status = 'DELIVERED';
  }

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

const loadChatHistoryByUsers = async (userId, otherUserId, limit = 100) => {
  const chatKey = generateChatKey(userId, otherUserId);
  const snapshot = await getMessagesCollection(chatKey)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs
    .map((document) => normalizeChatMessage(document.id, document.data()))
    .reverse();
};

const updateMessageStatus = async (messageId, senderId, receiverId, status) => {
  const chatKey = generateChatKey(senderId, receiverId);
  await getMessagesCollection(chatKey).doc(messageId).update({ status });
};

const markConversationAsRead = async (userId, otherUserId) => {
  const chatKey = generateChatKey(userId, otherUserId);
  const snapshot = await getMessagesCollection(chatKey)
    .where('receiverId', '==', userId)
    .get();

  const batch = firestore.batch();
  snapshot.docs.forEach((document) => {
    batch.update(document.ref, { status: 'READ' });
  });

  if (!snapshot.empty) {
    await batch.commit();
  }
};

const isUserOnline = async (userId) => {
  const snapshot = await firestore.collection('presence').doc(userId).get();
  return snapshot.exists && snapshot.get('status') === 'online';
};

const sendTypingIndicator = async (userId, receiverId, isTyping) => {
  const chatKey = generateChatKey(userId, receiverId);
  const typingRef = firestore.collection('typing').doc(chatKey).collection('users').doc(userId);

  if (isTyping) {
    await typingRef.set({ status: 'typing' });
    return;
  }

  await typingRef.delete();
};

const listenForMessages = (userId, otherUserId, onMessage, onError) => {
  const chatKey = generateChatKey(userId, otherUserId);

  return getMessagesCollection(chatKey)
    .orderBy('timestamp', 'asc')
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            onMessage(normalizeChatMessage(change.doc.id, change.doc.data()));
          }
        });
      },
      (error) => onError(error)
    );
};

module.exports = {
  isUserOnline,
  listenForMessages,
  loadChatHistoryByUsers,
  markConversationAsRead,
  sendMediaMessage,
  sendTextMessage,
  sendTypingIndicator,
  updateMessageStatus,
};
