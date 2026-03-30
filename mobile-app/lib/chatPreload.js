import { CHAT_PAGE_SIZE, fetchInitialMessagesPage } from './chatMessages';
import { buildChatKey } from './realtimeChat';

export const CHAT_VISIBLE_WINDOW_PREFIX = 'chat_visible_window';
export const INITIAL_RECENT_WINDOW = CHAT_PAGE_SIZE;
export const OLDER_MESSAGES_BATCH = CHAT_PAGE_SIZE;

const PRELOAD_TTL_MS = 15000;
const preloadedChatWindows = new Map();

const normalizeWindowPayload = (chatKey, payload, windowSize) => ({
  chatKey,
  messages: Array.isArray(payload?.messages) ? payload.messages : [],
  hasOlder: !!payload?.hasOlder,
  hasNewer: false,
  windowSize: Number(windowSize || INITIAL_RECENT_WINDOW),
  readAnchorMessageId: String(payload?.readAnchorMessageId || ''),
  readAnchorTimestamp: Number(payload?.readAnchorTimestamp || 0) || null,
  unreadCount: Number(payload?.unreadCount || 0) || 0,
  createdAt: Date.now(),
});

export const getSavedVisibleWindowCount = async (chatKey) => {
  return INITIAL_RECENT_WINDOW;
};

export const preloadLatestChatWindow = async ({ currentUserId, otherUserId, token, windowSize }) => {
  const chatKey = buildChatKey(currentUserId, otherUserId);
  const resolvedWindowSize = windowSize || (await getSavedVisibleWindowCount(chatKey));
  const payload = await fetchInitialMessagesPage({
    token,
    otherUserId,
    limit: resolvedWindowSize,
  });
  const normalizedPayload = normalizeWindowPayload(chatKey, payload, resolvedWindowSize);
  preloadedChatWindows.set(chatKey, normalizedPayload);
  return normalizedPayload;
};

export const consumePreloadedChatWindow = (chatKey) => {
  if (!chatKey) {
    return null;
  }

  const preloadedWindow = preloadedChatWindows.get(chatKey);
  if (!preloadedWindow) {
    return null;
  }

  preloadedChatWindows.delete(chatKey);

  if (Date.now() - Number(preloadedWindow.createdAt || 0) > PRELOAD_TTL_MS) {
    return null;
  }

  return preloadedWindow;
};
