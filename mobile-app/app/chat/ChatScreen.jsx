import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { appTheme } from '../../utilities/colors';
import { getStoredUser } from '../../lib/api';
import { consumePreloadedChatWindow } from '../../lib/chatPreload';
import {
  CHAT_PAGE_SIZE,
  fetchInitialMessagesPage,
  fetchOlderMessagesPage,
  markConversationReadRequest,
  normalizeChatMessages,
  saveConversationAnchorRequest,
  sendMediaMessageRequest,
  sendTextMessageRequest,
  uploadChatAttachmentRequest,
} from '../../lib/chatMessages';
import {
  buildChatKey,
  startTypingSession,
  subscribeToConversationMessages,
  subscribeToTypingStatus,
  subscribeToUserPresence,
} from '../../lib/realtimeChat';
import MessageBubble from './components/MessageBubble';
import ScrollToBottomButton from './components/ScrollToBottomButton';
import UnreadSeparator from './components/UnreadSeparator';

const BOTTOM_OFFSET_THRESHOLD = 48;
const EMPTY_READ_BOUNDARY = {
  anchorMessageId: '',
  unreadCount: 0,
  visible: false,
};
const EMPTY_PRESENCE = {
  status: 'offline',
  lastChanged: null,
};
const DEFAULT_COMPOSER_HEIGHT = 74;

const getMessageId = (message) =>
  String(message?.id || message?.messageId || message?.clientMessageId || '');

const getMessageType = (message) => String(message?.type || 'TEXT').toUpperCase();

const mergeChatMessages = (currentMessages = [], nextMessages = []) => {
  const messageMap = new Map();

  [...currentMessages, ...nextMessages].forEach((message) => {
    const identity = getMessageId(message);

    if (!identity) {
      return;
    }

    const current = messageMap.get(identity);
    if (!current) {
      messageMap.set(identity, message);
      return;
    }

    messageMap.set(identity, {
      ...current,
      ...message,
      createdAt: Math.max(Number(current.createdAt) || 0, Number(message.createdAt) || 0),
    });
  });

  return [...messageMap.values()].sort(
    (left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0)
  );
};

const replaceLocalMessage = (currentMessages = [], localMessageId, resolvedMessage) => {
  const safeLocalMessageId = String(localMessageId || '');
  if (!safeLocalMessageId) {
    return mergeChatMessages(currentMessages, [resolvedMessage]);
  }

  const nextMessages = currentMessages.map((message) =>
    getMessageId(message) === safeLocalMessageId ? resolvedMessage : message
  );
  const didReplace = nextMessages.some((message) => getMessageId(message) === getMessageId(resolvedMessage));

  return didReplace ? mergeChatMessages(nextMessages, []) : mergeChatMessages(currentMessages, [resolvedMessage]);
};

const updateLocalMessageState = (currentMessages = [], localMessageId, patch = {}) =>
  currentMessages.map((message) =>
    getMessageId(message) === String(localMessageId || '')
      ? {
          ...message,
          ...patch,
        }
      : message
  );

const isSameDay = (leftTimestamp, rightTimestamp) => {
  const leftDate = new Date(Number(leftTimestamp) || 0);
  const rightDate = new Date(Number(rightTimestamp) || 0);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const buildRenderItems = (messages, readBoundary, showTypingIndicator) => {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const separatorVisible = !!readBoundary?.visible && Number(readBoundary?.unreadCount || 0) > 0;
  const separatorAnchorId = String(readBoundary?.anchorMessageId || '');
  const separatorAnchorIndex = separatorAnchorId
    ? safeMessages.findIndex((message) => getMessageId(message) === separatorAnchorId)
    : -1;
  const separatorIndex =
    separatorVisible && separatorAnchorIndex >= 0
      ? separatorAnchorIndex
      : separatorVisible
        ? safeMessages.length
        : -1;

  const items = [];

  if (showTypingIndicator) {
    items.push({
      id: 'typing-indicator',
      type: 'typing',
    });
  }

  safeMessages.forEach((message, index) => {
    if (separatorVisible && index === separatorIndex) {
      items.push({
        id: `unread-separator-${separatorAnchorId || 'edge'}`,
        type: 'separator',
        unreadCount: Number(readBoundary.unreadCount) || 0,
      });
    }

    const olderMessage = safeMessages[index + 1];

    items.push({
      id: getMessageId(message),
      type: 'message',
      message,
      showDateHeader: !olderMessage || !isSameDay(message.createdAt, olderMessage.createdAt),
    });
  });

  if (separatorVisible && separatorIndex === safeMessages.length) {
    items.push({
      id: `unread-separator-${separatorAnchorId || 'edge'}`,
      type: 'separator',
      unreadCount: Number(readBoundary.unreadCount) || 0,
    });
  }

  return items;
};

const buildVideoHtml = (videoUrl) => `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #000;
        overflow: hidden;
      }
      video {
        width: 100%;
        height: 100%;
        background: #000;
      }
    </style>
  </head>
  <body>
    <video controls autoplay playsinline webkit-playsinline preload="metadata">
      <source src="${videoUrl}" />
    </video>
  </body>
</html>`;

const deriveFileNameFromUri = (uri = '', fallbackPrefix = 'attachment') => {
  try {
    const sanitized = decodeURIComponent(String(uri || '').split('?')[0] || '');
    const segments = sanitized.split('/');
    const fileName = segments[segments.length - 1];
    return fileName || `${fallbackPrefix}-${Date.now()}`;
  } catch {
    return `${fallbackPrefix}-${Date.now()}`;
  }
};

const inferMimeTypeFromAsset = (asset = {}) => {
  if (asset?.mimeType) {
    return String(asset.mimeType);
  }

  if (asset?.type === 'image') {
    return 'image/jpeg';
  }

  if (asset?.type === 'video') {
    return 'video/mp4';
  }

  return 'application/octet-stream';
};

const inferMediaType = (mimeType = '', fallbackType = '') => {
  const normalizedMimeType = String(mimeType || '').toLowerCase();
  const normalizedFallbackType = String(fallbackType || '').toLowerCase();

  if (normalizedMimeType.startsWith('image/') || normalizedFallbackType === 'image') {
    return 'IMAGE';
  }

  if (normalizedMimeType.startsWith('video/') || normalizedFallbackType === 'video') {
    return 'VIDEO';
  }

  return 'DOCUMENT';
};

const buildOptimisticAttachmentMessage = ({
  createdAt,
  fileName,
  fileSize,
  localMessageId,
  mediaType,
  mimeType,
  receiverId,
  senderId,
  uri,
}) => ({
  id: localMessageId,
  messageId: localMessageId,
  clientMessageId: localMessageId,
  text: '',
  senderId,
  receiverId,
  createdAt,
  status: 'pending',
  mediaUrl: uri,
  thumbnailUrl: null,
  mimeType,
  fileName,
  fileSize,
  type: mediaType,
});

const ChatScreen = () => {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const otherUserId = String(params?.userId || '');
  const otherUserName = String(params?.name || 'Chat');
  const avatar = String(params?.avatar || '');
  const preloadedChatKey = String(params?.preloadedChatKey || '');
  const hintedCurrentUserId = String(params?.currentUserId || '');

  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [messages, setMessages] = useState([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [oldestCursor, setOldestCursor] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [readBoundary, setReadBoundary] = useState(EMPTY_READ_BOUNDARY);
  const [activeAttachment, setActiveAttachment] = useState(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [otherUserPresence, setOtherUserPresence] = useState(EMPTY_PRESENCE);
  const [composerHeight, setComposerHeight] = useState(DEFAULT_COMPOSER_HEIGHT);

  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef([]);
  const sessionRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const initialScrollHandledRef = useRef(false);
  const isSavingReadRef = useRef(false);
  const queuedReadUpdateRef = useRef(null);
  const typingSessionRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const initialScrollTargetRef = useRef('');
  const lastCommittedReadRef = useRef({
    id: '',
    timestamp: 0,
  });
  const keyboardVisibleRef = useRef(false);
  const keyboardEventInsetRef = useRef(0);
  const dimensionInsetRef = useRef(0);
  const layoutInsetRef = useRef(0);
  const baseWindowGapRef = useRef(0);
  const baseKeyboardContainerHeightRef = useRef(0);
  const requiresBottomReadRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const measureWindowGap = useCallback((nextDimensions = null) => {
    const windowHeight = Number(
      nextDimensions?.window?.height || Dimensions.get('window').height || 0
    );
    const screenHeight = Number(
      nextDimensions?.screen?.height || Dimensions.get('screen').height || windowHeight
    );

    return Math.max(0, screenHeight - windowHeight);
  }, []);

  const readKeyboardMetricsInset = useCallback(() => {
    const metrics = typeof Keyboard.metrics === 'function' ? Keyboard.metrics() : undefined;
    if (!metrics) {
      return 0;
    }

    const screenHeight = Number(Dimensions.get('screen').height || 0);
    const edgeInset = Math.max(0, screenHeight - Number(metrics.screenY || 0));
    const heightInset = Math.max(0, Number(metrics.height || 0) - insets.bottom);

    return Math.max(edgeInset, heightInset);
  }, [insets.bottom]);

  const applyKeyboardInset = useCallback(() => {
    const nextInset = Math.max(
      0,
      keyboardEventInsetRef.current,
      dimensionInsetRef.current,
      layoutInsetRef.current,
      readKeyboardMetricsInset()
    );

    setKeyboardInset((currentInset) =>
      Math.abs(currentInset - nextInset) < 1 ? currentInset : nextInset
    );
  }, [readKeyboardMetricsInset]);

  const syncKeyboardBaseline = useCallback(() => {
    baseWindowGapRef.current = measureWindowGap();
  }, [measureWindowGap]);

  useEffect(() => {
    syncKeyboardBaseline();

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      keyboardVisibleRef.current = true;
      keyboardEventInsetRef.current = Math.max(
        0,
        Number(event?.endCoordinates?.height || 0) - insets.bottom
      );
      dimensionInsetRef.current = Math.max(0, measureWindowGap() - baseWindowGapRef.current);
      applyKeyboardInset();
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
      keyboardEventInsetRef.current = 0;
      dimensionInsetRef.current = 0;
      layoutInsetRef.current = 0;
      syncKeyboardBaseline();
      applyKeyboardInset();
    });

    const dimensionsSubscription = Dimensions.addEventListener('change', (nextDimensions) => {
      const nextGap = measureWindowGap(nextDimensions);

      if (!keyboardVisibleRef.current) {
        baseWindowGapRef.current = nextGap;
        return;
      }

      dimensionInsetRef.current = Math.max(0, nextGap - baseWindowGapRef.current);
      applyKeyboardInset();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      dimensionsSubscription.remove();
    };
  }, [applyKeyboardInset, insets.bottom, measureWindowGap, syncKeyboardBaseline]);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        animated,
        offset: 0,
      });
    });
  }, []);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    typingSessionRef.current?.setTyping(false).catch(() => {});
  }, []);

  const handleInputChange = useCallback(
    (text) => {
      setInputText(text);

      if (!typingSessionRef.current) {
        return;
      }

      if (!String(text || '').trim()) {
        stopTyping();
        return;
      }

      typingSessionRef.current?.setTyping(true).catch(() => {});

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        typingSessionRef.current?.setTyping(false).catch(() => {});
        typingTimeoutRef.current = null;
      }, 1200);
    },
    [stopTyping]
  );

  const flushReadQueue = useCallback(async () => {
    if (isSavingReadRef.current) {
      return;
    }

    isSavingReadRef.current = true;

    try {
      while (queuedReadUpdateRef.current) {
        const nextUpdate = queuedReadUpdateRef.current;
        queuedReadUpdateRef.current = null;

        const authToken = sessionRef.current?.token;
        if (!authToken || !otherUserId || !nextUpdate?.id) {
          continue;
        }

        try {
          if (nextUpdate.markConversation) {
            await markConversationReadRequest({
              token: authToken,
              otherUserId,
              lastReadMessageId: nextUpdate.id,
            });
          }

          await saveConversationAnchorRequest({
            token: authToken,
            otherUserId,
            lastReadMessageId: nextUpdate.id,
            lastReadTimestamp: nextUpdate.timestamp,
          });

          lastCommittedReadRef.current = {
            id: nextUpdate.id,
            timestamp: nextUpdate.timestamp,
          };
        } catch (error) {
          console.warn('Failed to update conversation read state:', error);
        }
      }
    } finally {
      isSavingReadRef.current = false;
    }
  }, [otherUserId]);

  const shouldMarkConversationRead = useCallback(
    (targetMessageId) => {
      if (!targetMessageId) {
        return false;
      }

      const currentMessages = messagesRef.current;
      const targetIndex = currentMessages.findIndex(
        (message) => getMessageId(message) === targetMessageId
      );

      if (targetIndex < 0) {
        return false;
      }

      const committedId = String(lastCommittedReadRef.current?.id || '');
      const committedIndex = committedId
        ? currentMessages.findIndex((message) => getMessageId(message) === committedId)
        : -1;
      const endIndex = committedIndex >= 0 ? committedIndex : currentMessages.length;

      for (let index = targetIndex; index < endIndex; index += 1) {
        const message = currentMessages[index];
        if (String(message?.senderId || '') === otherUserId) {
          return true;
        }
      }

      return false;
    },
    [otherUserId]
  );

  const queueReadUpdate = useCallback(
    (message, options = {}) => {
      const messageId = getMessageId(message);

      if (!messageId || !sessionRef.current?.token || !otherUserId) {
        return;
      }

      const nextPayload = {
        id: messageId,
        timestamp: Number(message?.createdAt) || Date.now(),
        force: !!options.force,
        markConversation: !!options.markConversation,
      };

      const lastCommitted = lastCommittedReadRef.current;
      const queuedUpdate = queuedReadUpdateRef.current;

      if (
        !nextPayload.force &&
        lastCommitted?.id === nextPayload.id &&
        !nextPayload.markConversation &&
        !queuedUpdate
      ) {
        return;
      }

      if (!queuedUpdate) {
        queuedReadUpdateRef.current = nextPayload;
      } else {
        queuedReadUpdateRef.current =
          queuedUpdate.timestamp >= nextPayload.timestamp
            ? {
                ...queuedUpdate,
                markConversation: queuedUpdate.markConversation || nextPayload.markConversation,
                force: queuedUpdate.force || nextPayload.force,
              }
            : {
                ...nextPayload,
                markConversation: queuedUpdate.markConversation || nextPayload.markConversation,
                force: queuedUpdate.force || nextPayload.force,
              };
      }

      flushReadQueue();
    },
    [flushReadQueue, otherUserId]
  );

  const commitLatestReadAnchor = useCallback(
    (options = {}) => {
      const latestMessage = messagesRef.current[0];

      if (!latestMessage) {
        return;
      }

      queueReadUpdate(latestMessage, {
        force: !!options.force,
        markConversation:
          typeof options.markConversation === 'boolean'
            ? options.markConversation
            : shouldMarkConversationRead(getMessageId(latestMessage)),
      });
    },
    [queueReadUpdate, shouldMarkConversationRead]
  );

  const handleReachedBottom = useCallback(() => {
    isAtBottomRef.current = true;
    setNewMessagesCount(0);
    setReadBoundary(EMPTY_READ_BOUNDARY);
    requiresBottomReadRef.current = false;
    commitLatestReadAnchor();
  }, [commitLatestReadAnchor]);

  const persistReadAnchorOnExit = useCallback(() => {
    const latestMessage = messagesRef.current[0];

    if (isAtBottomRef.current && latestMessage) {
      queueReadUpdate(latestMessage, {
        force: true,
        markConversation: shouldMarkConversationRead(getMessageId(latestMessage)),
      });
      return;
    }

    const lastCommitted = lastCommittedReadRef.current;
    if (!lastCommitted?.id || !sessionRef.current?.token || !otherUserId) {
      return;
    }

    saveConversationAnchorRequest({
      token: sessionRef.current.token,
      otherUserId,
      lastReadMessageId: lastCommitted.id,
      lastReadTimestamp: lastCommitted.timestamp,
    }).catch((error) => {
      console.warn('Failed to persist read anchor on exit:', error);
    });
  }, [otherUserId, queueReadUpdate, shouldMarkConversationRead]);

  const hydrateOpeningWindow = useCallback(
    async (authToken, currentUserId) => {
      const chatKey = buildChatKey(currentUserId, otherUserId);
      const preloadedWindow =
        preloadedChatKey && preloadedChatKey === chatKey ? consumePreloadedChatWindow(chatKey) : null;

      return (
        preloadedWindow ||
        fetchInitialMessagesPage({
          token: authToken,
          otherUserId,
          limit: CHAT_PAGE_SIZE,
        })
      );
    },
    [otherUserId, preloadedChatKey]
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      let unsubscribeMessages = () => {};
      let unsubscribeTyping = () => {};
      let unsubscribePresence = () => {};

      initialScrollHandledRef.current = false;
      initialScrollTargetRef.current = '';
      isAtBottomRef.current = false;
      requiresBottomReadRef.current = false;
      setNewMessagesCount(0);
      setReadBoundary(EMPTY_READ_BOUNDARY);
      setIsOtherUserTyping(false);
      setOtherUserPresence(EMPTY_PRESENCE);

      unsubscribePresence = subscribeToUserPresence(
        otherUserId,
        (presence) => {
          if (isActive) {
            setOtherUserPresence({
              status: String(presence?.status || 'offline'),
              lastChanged: presence?.lastChanged ?? null,
            });
          }
        },
        (error) => {
          console.warn('Presence subscription failed:', error);
        }
      );

      const initializeChat = async () => {
        try {
          setIsLoading(true);

          const storedUser = await getStoredUser();
          const sessionUser = storedUser?.uid
            ? {
                ...storedUser,
                uid: String(hintedCurrentUserId || storedUser.uid),
              }
            : null;

          if (!isActive || !sessionUser?.uid || !sessionUser?.token || !otherUserId) {
            if (isActive) {
              setSession(sessionUser);
              sessionRef.current = sessionUser;
              setMessages([]);
              setHasOlder(false);
              setOldestCursor(null);
              setIsLoading(false);
            }
            return;
          }

          setSession(sessionUser);
          sessionRef.current = sessionUser;
          typingSessionRef.current = startTypingSession(sessionUser.uid, otherUserId);
          unsubscribeTyping = subscribeToTypingStatus(
            sessionUser.uid,
            otherUserId,
            (isTyping) => {
              if (isActive) {
                setIsOtherUserTyping(!!isTyping);
              }
            },
            (error) => {
              console.warn('Typing subscription failed:', error);
            }
          );

          const openingWindow = await hydrateOpeningWindow(sessionUser.token, sessionUser.uid);
          if (!isActive) {
            return;
          }

          const openingMessages = Array.isArray(openingWindow?.messages) ? openingWindow.messages : [];

          lastCommittedReadRef.current = {
            id: String(openingWindow?.readAnchorMessageId || ''),
            timestamp: Number(openingWindow?.readAnchorTimestamp || 0) || 0,
          };

          messagesRef.current = openingMessages;
          setMessages(openingMessages);
          setHasOlder(!!openingWindow?.hasOlder);
          setOldestCursor(
            openingWindow?.oldestCursor || getMessageId(openingMessages[openingMessages.length - 1])
          );
          const hasUnreadOnOpen = Number(openingWindow?.unreadCount || 0) > 0;
          requiresBottomReadRef.current = hasUnreadOnOpen;
          isAtBottomRef.current = !hasUnreadOnOpen;
          initialScrollTargetRef.current =
            hasUnreadOnOpen
              ? String(openingWindow?.readAnchorMessageId || '')
              : '';
          setReadBoundary(
            hasUnreadOnOpen
              ? {
                  anchorMessageId: String(openingWindow?.readAnchorMessageId || ''),
                  unreadCount: Number(openingWindow?.unreadCount || 0),
                  visible: true,
                }
              : EMPTY_READ_BOUNDARY
          );

          setIsLoading(false);

          unsubscribeMessages = subscribeToConversationMessages(
            sessionUser.uid,
            otherUserId,
            (snapshotMessages) => {
              if (!isActive) {
                return;
              }

              const normalizedRealtimeMessages = normalizeChatMessages(snapshotMessages);

              setMessages((currentMessages) => {
                const currentIds = new Set(currentMessages.map((message) => getMessageId(message)));
                const nextMessages = mergeChatMessages(currentMessages, normalizedRealtimeMessages);
                const incomingMessages = normalizedRealtimeMessages.filter(
                  (message) =>
                    !currentIds.has(getMessageId(message)) &&
                    String(message?.senderId || '') === otherUserId
                );

                if (incomingMessages.length > 0) {
                  if (isAtBottomRef.current && !requiresBottomReadRef.current) {
                    setNewMessagesCount(0);
                    setReadBoundary(EMPTY_READ_BOUNDARY);

                    requestAnimationFrame(() => {
                      scrollToBottom(true);
                      queueReadUpdate(nextMessages[0], {
                        markConversation: true,
                      });
                    });
                  } else {
                    const boundaryAnchorId =
                      String(lastCommittedReadRef.current?.id || '') ||
                      getMessageId(currentMessages[0]) ||
                      '';

                    setNewMessagesCount((currentCount) => currentCount + incomingMessages.length);
                    setReadBoundary((currentBoundary) =>
                      currentBoundary.visible
                        ? {
                            ...currentBoundary,
                            unreadCount: Number(currentBoundary.unreadCount || 0) + incomingMessages.length,
                          }
                        : {
                            anchorMessageId: boundaryAnchorId,
                            unreadCount: incomingMessages.length,
                            visible: true,
                          }
                    );
                  }
                }

                messagesRef.current = nextMessages;
                return nextMessages;
              });
            },
            (error) => {
              console.error('Realtime message subscription failed:', error);
              if (isActive) {
                setIsLoading(false);
              }
            }
          );
        } catch (error) {
          console.error('Failed to initialize chat screen:', error);
          if (isActive) {
            setIsLoading(false);
          }
        }
      };

      initializeChat();

      return () => {
        isActive = false;
        unsubscribeMessages();
        unsubscribeTyping();
        unsubscribePresence();
        setIsOtherUserTyping(false);
        setOtherUserPresence(EMPTY_PRESENCE);
        stopTyping();
        typingSessionRef.current?.stop?.();
        typingSessionRef.current = null;
        persistReadAnchorOnExit();
      };
    }, [
      hintedCurrentUserId,
      hydrateOpeningWindow,
      otherUserId,
      persistReadAnchorOnExit,
      scrollToBottom,
      stopTyping,
    ])
  );

  const listItems = useMemo(
    () => buildRenderItems(messages, readBoundary, isOtherUserTyping),
    [isOtherUserTyping, messages, readBoundary]
  );

  useEffect(() => {
    if (isLoading || !listItems.length || initialScrollHandledRef.current) {
      return;
    }

    initialScrollHandledRef.current = true;
    const targetMessageId = String(initialScrollTargetRef.current || '');

    if (!targetMessageId) {
      return;
    }

    const targetIndex = listItems.findIndex(
      (item) => item.type === 'message' && getMessageId(item.message) === targetMessageId
    );

    if (targetIndex < 0) {
      return;
    }

    isAtBottomRef.current = false;

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({
        animated: false,
        index: targetIndex,
        viewPosition: 0.45,
      });
    });
  }, [isLoading, listItems]);

  const handleLoadOlder = useCallback(async () => {
    if (
      isLoading ||
      isLoadingOlder ||
      !hasOlder ||
      !oldestCursor ||
      !sessionRef.current?.token ||
      !otherUserId
    ) {
      return;
    }

    setIsLoadingOlder(true);

    try {
      const olderPage = await fetchOlderMessagesPage({
        token: sessionRef.current.token,
        otherUserId,
        beforeMessageId: oldestCursor,
        limit: CHAT_PAGE_SIZE,
      });

      let resolvedOldestCursor = olderPage.oldestCursor || null;

      setMessages((currentMessages) => {
        const nextMessages = mergeChatMessages(currentMessages, olderPage.messages);
        messagesRef.current = nextMessages;
        resolvedOldestCursor =
          resolvedOldestCursor || getMessageId(nextMessages[nextMessages.length - 1]);
        return nextMessages;
      });

      setHasOlder(!!olderPage.hasOlder);
      setOldestCursor(resolvedOldestCursor);
    } catch (error) {
      console.warn('Failed to load older messages:', error);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [hasOlder, isLoading, isLoadingOlder, oldestCursor, otherUserId]);

  const handleSend = useCallback(async () => {
    const trimmedMessage = inputText.trim();

    if (!trimmedMessage || !sessionRef.current?.token || !otherUserId || isSending) {
      return;
    }

    const authToken = sessionRef.current.token;
    const clientMessageId = `local-${Date.now()}`;

    stopTyping();
    setIsSending(true);
    setInputText('');

    try {
      const sentMessage = await sendTextMessageRequest({
        token: authToken,
        otherUserId,
        text: trimmedMessage,
        clientMessageId,
      });

      setMessages((currentMessages) => {
        const nextMessages = mergeChatMessages(currentMessages, [sentMessage]);
        messagesRef.current = nextMessages;
        return nextMessages;
      });

      scrollToBottom(true);
      handleReachedBottom();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (error) {
      console.error('Send error:', error);
      setInputText(trimmedMessage);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } finally {
      setIsSending(false);
    }
  }, [handleReachedBottom, inputText, isSending, otherUserId, scrollToBottom, stopTyping]);

  const handleScroll = useCallback(
    (event) => {
      const nextIsAtBottom =
        Number(event?.nativeEvent?.contentOffset?.y || 0) <= BOTTOM_OFFSET_THRESHOLD;
      const previousIsAtBottom = isAtBottomRef.current;

      if (nextIsAtBottom === previousIsAtBottom) {
        return;
      }

      isAtBottomRef.current = nextIsAtBottom;

      if (nextIsAtBottom) {
        handleReachedBottom();
      }
    },
    [handleReachedBottom]
  );

  const handlePressScrollButton = useCallback(() => {
    scrollToBottom(true);
    handleReachedBottom();
  }, [handleReachedBottom, scrollToBottom]);

  const handleScrollToIndexFailed = useCallback((info) => {
    const targetIndex = Number(info?.index || 0);

    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        animated: false,
        index: Math.max(0, targetIndex),
        viewPosition: 0.45,
      });
    }, 180);
  }, []);

  const handleOpenAttachment = useCallback(async (message) => {
    const attachmentType = getMessageType(message);
    const mediaUrl = String(message?.mediaUrl || '');

    if (!mediaUrl) {
      return;
    }

    if (attachmentType.includes('DOC') || attachmentType.includes('FILE') || attachmentType.includes('PDF')) {
      try {
        await Linking.openURL(mediaUrl);
      } catch {
        Alert.alert('Unable to open document', 'No app was able to open this document.');
      }
      return;
    }

    if (attachmentType.includes('VIDEO')) {
      setActiveAttachment({
        type: 'VIDEO',
        url: mediaUrl,
        title: String(message?.fileName || 'Video'),
      });
      return;
    }

    if (attachmentType.includes('IMAGE')) {
      setActiveAttachment({
        type: 'IMAGE',
        url: mediaUrl,
        title: String(message?.fileName || 'Image'),
      });
      return;
    }

    try {
      await Linking.openURL(mediaUrl);
    } catch {
      Alert.alert('Unable to open attachment', 'This attachment could not be opened.');
    }
  }, []);

  const sendAttachmentAsset = useCallback(
    async (asset) => {
      if (!asset?.uri || !sessionRef.current?.token || !otherUserId || isUploadingAttachment) {
        return;
      }

      const authToken = sessionRef.current.token;
      const mimeType = inferMimeTypeFromAsset(asset);
      const mediaType = inferMediaType(mimeType, asset.type);
      const localMessageId = `local-attachment-${Date.now()}`;
      const createdAt = Date.now();
      const localFile = {
        uri: asset.uri,
        name: asset.fileName || deriveFileNameFromUri(asset.uri, asset.type || 'attachment'),
        type: mimeType,
        size: Number(asset.fileSize || asset.fileSizeBytes || 0) || null,
      };
      const optimisticMessage = buildOptimisticAttachmentMessage({
        createdAt,
        fileName: localFile.name,
        fileSize: localFile.size,
        localMessageId,
        mediaType,
        mimeType,
        receiverId: otherUserId,
        senderId: sessionRef.current?.uid || '',
        uri: localFile.uri,
      });

      try {
        stopTyping();
        setIsUploadingAttachment(true);
        setMessages((currentMessages) => {
          const nextMessages = mergeChatMessages(currentMessages, [optimisticMessage]);
          messagesRef.current = nextMessages;
          return nextMessages;
        });

        const uploadPayload = await uploadChatAttachmentRequest({
          token: authToken,
          file: localFile,
        });

        const sentMessage = await sendMediaMessageRequest({
          token: authToken,
          otherUserId,
          mediaUrl: String(uploadPayload?.mediaUrl || uploadPayload?.url || ''),
          mediaType: String(uploadPayload?.mediaType || mediaType),
          mimeType: String(uploadPayload?.mimeType || mimeType),
          fileName: String(uploadPayload?.fileName || localFile.name || ''),
          fileSize: Number(uploadPayload?.fileSize || localFile.size || 0) || null,
          thumbnailUrl: uploadPayload?.thumbnailUrl || null,
        });

        setMessages((currentMessages) => {
          const nextMessages = replaceLocalMessage(currentMessages, localMessageId, sentMessage);
          messagesRef.current = nextMessages;
          return nextMessages;
        });

        scrollToBottom(true);
        handleReachedBottom();
      } catch (error) {
        console.error('Attachment send error:', error);
        setMessages((currentMessages) => {
          const nextMessages = updateLocalMessageState(currentMessages, localMessageId, {
            status: 'failed',
          });
          messagesRef.current = nextMessages;
          return nextMessages;
        });
        Alert.alert(
          'Attachment failed',
          String(error?.message || 'This file could not be sent right now.')
        );
      } finally {
        setIsUploadingAttachment(false);
      }
    },
    [handleReachedBottom, isUploadingAttachment, otherUserId, scrollToBottom, stopTyping]
  );

  const handleAttachmentComposerPress = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow gallery access to send attachments.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      await sendAttachmentAsset(result.assets[0]);
    } catch (error) {
      console.error('Attachment picker error:', error);
      Alert.alert('Attachment failed', 'Unable to open your media library.');
    }
  }, [sendAttachmentAsset]);

  const handleCameraComposerPress = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow camera access to take an attachment.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      await sendAttachmentAsset(result.assets[0]);
    } catch (error) {
      console.error('Camera attachment error:', error);
      Alert.alert('Camera failed', 'Unable to capture an attachment right now.');
    }
  }, [sendAttachmentAsset]);

  const renderItem = useCallback(
    ({ item }) => {
      if (item.type === 'separator') {
        return <UnreadSeparator count={item.unreadCount} />;
      }

      if (item.type === 'typing') {
        return <MessageBubble isTyping message={null} senderName={otherUserName} showSenderName />;
      }

      const isMine = String(item.message?.senderId || '') === String(session?.uid || '');

      return (
        <MessageBubble
          isMine={isMine}
          message={item.message}
          onPressAttachment={handleOpenAttachment}
          senderName={otherUserName}
          showDateHeader={item.showDateHeader}
          showSenderName={!isMine}
        />
      );
    },
    [handleOpenAttachment, otherUserName, session?.uid]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const loadingOlderFooter = useMemo(() => {
    return <View style={isLoadingOlder ? styles.loadingOlderContainer : styles.loadingOlderSpacer} />;
  }, [isLoadingOlder]);

  const listBottomSpacer = useMemo(
    () => <View style={{ height: composerHeight + 18 }} />,
    [composerHeight]
  );

  const viewerHtml = useMemo(() => {
    if (activeAttachment?.type !== 'VIDEO' || !activeAttachment?.url) {
      return null;
    }

    return buildVideoHtml(activeAttachment.url);
  }, [activeAttachment]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const isOtherUserOnline = String(otherUserPresence?.status || '').toLowerCase() === 'online';
  const presenceLabel = isOtherUserOnline ? 'online' : 'offline';
  const composerOffset = keyboardInset + composerHeight;
  const handleKeyboardContainerLayout = useCallback(
    (event) => {
      const nextHeight = Number(event?.nativeEvent?.layout?.height || 0);
      const keyboardMetricsInset = readKeyboardMetricsInset();

      if (!nextHeight) {
        return;
      }

      if (!baseKeyboardContainerHeightRef.current) {
        baseKeyboardContainerHeightRef.current = nextHeight;
      }

      const isKeyboardVisible = keyboardVisibleRef.current || keyboardMetricsInset > 0;

      if (!isKeyboardVisible) {
        baseKeyboardContainerHeightRef.current = nextHeight;
        layoutInsetRef.current = 0;
        applyKeyboardInset();
        return;
      }

      layoutInsetRef.current = Math.max(0, baseKeyboardContainerHeightRef.current - nextHeight);
      keyboardVisibleRef.current =
        keyboardMetricsInset > 0 || layoutInsetRef.current > 0 || keyboardEventInsetRef.current > 0;

      if (!keyboardVisibleRef.current) {
        baseKeyboardContainerHeightRef.current = nextHeight;
      }

      applyKeyboardInset();
    },
    [applyKeyboardInset, readKeyboardMetricsInset]
  );

  return (
    <View style={styles.container}>
      <Image source={require('../assets/icons/chatbg.png')} style={styles.imageBg} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Image
            resizeMode="contain"
            source={require('../assets/icons/left-arrow.png')}
            style={styles.backIcon}
          />
        </TouchableOpacity>

        <View style={styles.profileContainer}>
          <Image
            resizeMode="cover"
            source={avatar ? { uri: avatar } : require('../assets/icons/profile.png')}
            style={avatar ? styles.profileImage : styles.profileFallback}
          />
        </View>

        <View style={styles.titleWrap}>
          <Text numberOfLines={1} style={styles.nameText}>
            {otherUserName}
          </Text>
          <View style={styles.presenceRow}>
            <View
              style={[
                styles.presenceDot,
                isOtherUserOnline ? styles.presenceDotOnline : styles.presenceDotOffline,
              ]}
            />
            <Text style={styles.presenceText}>{presenceLabel}</Text>
          </View>
        </View>
      </View>

      <View onLayout={handleKeyboardContainerLayout} style={styles.keyboardContainer}>
        <View
          style={[
            styles.listWrapper,
            {
              marginBottom: keyboardInset,
            },
          ]}
        >
          <FlatList
            ref={flatListRef}
            contentContainerStyle={[
              styles.chatContainer,
              {
                paddingBottom: 18,
              },
            ]}
            data={isLoading ? [] : listItems}
            initialNumToRender={20}
            inverted
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={listBottomSpacer}
            ListFooterComponent={loadingOlderFooter}
            maintainVisibleContentPosition={{
              autoscrollToTopThreshold: 24,
              minIndexForVisible: 1,
            }}
            maxToRenderPerBatch={10}
            onEndReached={handleLoadOlder}
            onEndReachedThreshold={0.35}
            onScroll={handleScroll}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            removeClippedSubviews
            renderItem={renderItem}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            windowSize={5}
          />

          {newMessagesCount > 0 ? (
            <ScrollToBottomButton
              bottomOffset={composerOffset + 12}
              count={newMessagesCount}
              onPress={handlePressScrollButton}
            />
          ) : null}
        </View>

        <View
          onLayout={(event) => {
            const nextHeight = Number(event?.nativeEvent?.layout?.height || 0);
            if (nextHeight > 0 && Math.abs(nextHeight - composerHeight) > 1) {
              setComposerHeight(nextHeight);
            }
          }}
          style={[
            styles.inputContainer,
            {
              bottom: keyboardInset,
              paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10),
            },
          ]}
        >
          <View style={styles.composerShell}>
            <TextInput
              blurOnSubmit={false}
              multiline
              onBlur={stopTyping}
              onChangeText={handleInputChange}
              placeholder="Message"
              placeholderTextColor="rgba(255,255,255,0.55)"
              ref={inputRef}
              style={styles.input}
              textAlignVertical="center"
              value={inputText}
            />

            <TouchableOpacity
              disabled={isUploadingAttachment}
              onPress={handleAttachmentComposerPress}
              style={styles.inlineIconButton}
            >
              <Image
                resizeMode="contain"
                source={require('../assets/icons/upload.png')}
                style={styles.inlineIcon}
              />
            </TouchableOpacity>

            <TouchableOpacity
              disabled={isUploadingAttachment}
              onPress={handleCameraComposerPress}
              style={styles.inlineIconButton}
            >
              <Image
                resizeMode="contain"
                source={require('../assets/icons/camera.png')}
                style={styles.inlineIcon}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            disabled={!inputText.trim() || isSending}
            onPress={handleSend}
            style={[
              styles.sendButton,
              !inputText.trim() || isSending ? styles.sendButtonDisabled : null,
            ]}
          >
            <Image
              resizeMode="contain"
              source={require('../assets/icons/right-arrow.png')}
              style={styles.sendIcon}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Modal animationType="fade" transparent={false} visible={!!activeAttachment}>
        <View style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <Text numberOfLines={1} style={styles.viewerTitle}>
              {activeAttachment?.title || 'Attachment'}
            </Text>

            <Pressable onPress={() => setActiveAttachment(null)} style={styles.viewerCloseButton}>
              <Text style={styles.viewerCloseText}>Close</Text>
            </Pressable>
          </View>

          {activeAttachment?.type === 'IMAGE' ? (
            <View style={styles.viewerBody}>
              <Image resizeMode="contain" source={{ uri: activeAttachment.url }} style={styles.viewerImage} />
            </View>
          ) : null}

          {activeAttachment?.type === 'VIDEO' && viewerHtml ? (
            <View style={styles.viewerBody}>
              <WebView
                allowsFullscreenVideo
                mediaPlaybackRequiresUserAction={false}
                originWhitelist={['*']}
                source={{ html: viewerHtml }}
                style={styles.viewerWebView}
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    backgroundColor: appTheme.chat.screen,
    flex: 1,
  },
  imageBg: {
    height: '100%',
    opacity: 0.08,
    position: 'absolute',
    resizeMode: 'cover',
    width: '100%',
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: appTheme.chat.header,
    borderBottomColor: appTheme.colors.borderOnDarkSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 96,
    paddingHorizontal: 14,
    paddingTop: 34,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
    width: 40,
  },
  backIcon: {
    height: 20,
    tintColor: appTheme.colors.textOnDark,
    width: 20,
  },
  profileContainer: {
    alignItems: 'center',
    backgroundColor: appTheme.auth.input,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
    width: 40,
  },
  profileImage: {
    height: '100%',
    width: '100%',
  },
  profileFallback: {
    height: 24,
    tintColor: appTheme.colors.textOnDark,
    width: 24,
  },
  titleWrap: {
    flex: 1,
  },
  nameText: {
    color: appTheme.colors.textOnDark,
    fontSize: 18,
    fontWeight: '700',
  },
  presenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 3,
  },
  presenceDot: {
    borderRadius: 4,
    height: 8,
    marginRight: 6,
    width: 8,
  },
  presenceDotOnline: {
    backgroundColor: appTheme.colors.success,
  },
  presenceDotOffline: {
    backgroundColor: appTheme.colors.textOnDarkSoft,
  },
  presenceText: {
    color: appTheme.colors.textOnDarkMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  keyboardContainer: {
    flex: 1,
  },
  listWrapper: {
    flex: 1,
  },
  chatContainer: {
    paddingHorizontal: 10,
    paddingTop: 88,
  },
  loadingOlderContainer: {
    height: 0,
  },
  loadingOlderSpacer: {
    height: 0,
  },
  inputContainer: {
    alignItems: 'center',
    backgroundColor: appTheme.chat.screen,
    flexDirection: 'row',
    left: 0,
    paddingHorizontal: 8,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  composerShell: {
    alignItems: 'center',
    backgroundColor: appTheme.chat.composer,
    borderColor: appTheme.chat.composerBorder,
    borderWidth: 1,
    borderRadius: 28,
    flex: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 6,
  },
  input: {
    color: appTheme.colors.textOnDark,
    flex: 1,
    fontSize: 16,
    minHeight: 44,
    paddingRight: 12,
  },
  inlineIconButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    marginLeft: 2,
    width: 38,
  },
  inlineIcon: {
    height: 20,
    tintColor: appTheme.colors.textOnDark,
    width: 20,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: appTheme.chat.sendButton,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginLeft: 8,
    width: 48,
  },
  sendButtonDisabled: {
    backgroundColor: appTheme.chat.sendButtonDisabled,
  },
  sendIcon: {
    height: 20,
    tintColor: appTheme.chat.screen,
    width: 20,
  },
  viewerContainer: {
    backgroundColor: appTheme.chat.screen,
    flex: 1,
  },
  viewerHeader: {
    alignItems: 'center',
    backgroundColor: appTheme.chat.header,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
  },
  viewerTitle: {
    color: appTheme.colors.textOnDark,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 12,
  },
  viewerCloseButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewerCloseText: {
    color: appTheme.colors.accentSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  viewerBody: {
    flex: 1,
  },
  viewerImage: {
    flex: 1,
    width: '100%',
  },
  viewerWebView: {
    backgroundColor: '#000000',
    flex: 1,
  },
});
