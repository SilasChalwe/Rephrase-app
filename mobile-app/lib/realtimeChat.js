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

export const buildChatKey = (uid1, uid2) => {
  const left = String(uid1 || '').toLowerCase();
  const right = String(uid2 || '').toLowerCase();

  return left.localeCompare(right) < 0 ? `${left}_${right}` : `${right}_${left}`;
};

export const normalizeChatMessage = (messageId = '', rawMessage = {}) => ({
  messageId: rawMessage.messageId || messageId,
  senderId: rawMessage.senderId || '',
  receiverId: rawMessage.receiverId || '',
  message: rawMessage.message || '',
  status: rawMessage.status || 'SENT',
  mediaUrl: rawMessage.mediaUrl ?? null,
  type: rawMessage.type ?? 'TEXT',
  timestamp: Number(rawMessage.timestamp || Date.now()),
});

const mapSnapshotToMessages = (snapshot) => {
  const rawMessages = snapshot.val() || {};

  return Object.entries(rawMessages)
    .map(([messageId, rawMessage]) => normalizeChatMessage(messageId, rawMessage))
    .sort((left, right) => left.timestamp - right.timestamp);
};

const getPresenceRef = (userId) => ref(FIREBASE_DATABASE, `${PRESENCE_ROOT}/${userId}`);

export const subscribeToConversationMessages = (currentUserId, otherUserId, onMessages, onError) => {
  const chatKey = buildChatKey(currentUserId, otherUserId);
  const messagesQuery = query(ref(FIREBASE_DATABASE, `chats/${chatKey}/messages`), limitToLast(100));

  return onValue(
    messagesQuery,
    (snapshot) => onMessages(mapSnapshotToMessages(snapshot)),
    onError
  );
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
