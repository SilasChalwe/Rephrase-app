import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import Mymodal from '../../components/modal';
import { custom_colors } from '../../utilities/colors';
import { buildApiUrl, getAuthToken, getStoredUser } from '../../lib/api';
import { preloadLatestChatWindow } from '../../lib/chatPreload';
import {
  subscribeToConversationSummaryMap,
  subscribeToPresenceMap,
  subscribeToTypingMap,
} from '../../lib/realtimeChat';

const HOME_CONVERSATIONS_CACHE_KEY = 'home_conversation_summaries';

const getNameParts = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const getSearchScore = (user, query) => {
  const normalizedQuery = query.trim().toLowerCase();
  const fullName = String(user?.fullName || '').toLowerCase().trim();
  const nameParts = getNameParts(fullName);

  if (!normalizedQuery || !fullName) {
    return Number.NEGATIVE_INFINITY;
  }

  if (fullName === normalizedQuery) {
    return 1000;
  }

  if (nameParts.some((part) => part === normalizedQuery)) {
    return 920;
  }

  if (fullName.startsWith(normalizedQuery)) {
    return 860 - Math.max(fullName.length - normalizedQuery.length, 0);
  }

  const matchingWord = nameParts.find((part) => part.startsWith(normalizedQuery));
  if (matchingWord) {
    return 780 - Math.max(matchingWord.length - normalizedQuery.length, 0);
  }

  const includesIndex = fullName.indexOf(normalizedQuery);
  if (includesIndex !== -1) {
    return 640 - includesIndex * 8 - Math.max(fullName.length - normalizedQuery.length, 0);
  }

  const queryParts = getNameParts(normalizedQuery);
  if (queryParts.length > 1 && queryParts.every((part) => fullName.includes(part))) {
    return 520 - fullName.length;
  }

  return Number.NEGATIVE_INFINITY;
};

const rankSearchResults = (users, query) => {
  const normalizedQuery = query.trim().toLowerCase();

  return [...users].sort((left, right) => {
    const leftScore = getSearchScore(left, normalizedQuery);
    const rightScore = getSearchScore(right, normalizedQuery);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const leftName = String(left.fullName || '').toLowerCase();
    const rightName = String(right.fullName || '').toLowerCase();
    const leftIndex = leftName.indexOf(normalizedQuery);
    const rightIndex = rightName.indexOf(normalizedQuery);

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return leftName.localeCompare(rightName);
  });
};

const mergeConversationState = (baseConversations, summaryMap, presenceMap, typingMap) => {
  const items = (baseConversations || []).map((conversation) => {
    const userId = String(conversation.document_Id || '');
    const realtimeSummary = summaryMap[userId] || {};
    const presence = presenceMap[userId] || { status: 'offline', lastChanged: null };
    const isTyping = !!typingMap[userId];
    const lastMessageText = realtimeSummary.lastMessageText ?? conversation.lastMessageText ?? '';
    const lastMessageTimestamp =
      realtimeSummary.lastMessageTimestamp ?? conversation.lastMessageTimestamp ?? null;

    return {
      ...conversation,
      ...realtimeSummary,
      lastMessageText,
      lastMessageTimestamp,
      unreadCount: realtimeSummary.unreadCount ?? conversation.unreadCount ?? 0,
      presence,
      isTyping,
    };
  });

  return items.sort((left, right) => {
    const leftTimestamp = Number(left.lastMessageTimestamp || 0);
    const rightTimestamp = Number(right.lastMessageTimestamp || 0);

    if (leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    return String(left.fullName || '').localeCompare(String(right.fullName || ''));
  });
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) {
    return `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const buildPreviewText = (conversation) => {
  if (conversation.isTyping) {
    return 'typing...';
  }

  if (conversation.lastMessageText) {
    return conversation.lastMessageText;
  }

  return 'No messages yet';
};

const getMessageStatusMeta = (status) => {
  if (status === 'READ') {
    return { text: '✓✓', color: '#2CC069' };
  }

  if (status === 'DELIVERED') {
    return { text: '✓✓', color: '#9AA3B7' };
  }

  return null;
};

const Home = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [conversationSeed, setConversationSeed] = useState([]);
  const [conversationSummaries, setConversationSummaries] = useState({});
  const [presenceMap, setPresenceMap] = useState({});
  const [typingMap, setTypingMap] = useState({});
  const [foundSearch, setFoundSearch] = useState(false);
  const [showModal, setShowmodal] = useState(false);
  const [openingChatUserId, setOpeningChatUserId] = useState('');
  const [friendActionStateMap, setFriendActionStateMap] = useState({});

  const trimmedSearchTerm = searchTerm.trim();
  const showSearchResults = !!trimmedSearchTerm;
  const limitedSearchResults = useMemo(() => searchResults.slice(0, 12), [searchResults]);
  const conversations = useMemo(
    () => mergeConversationState(conversationSeed, conversationSummaries, presenceMap, typingMap),
    [conversationSeed, conversationSummaries, presenceMap, typingMap]
  );
  const currentUserId = String(currentUser?.uid || currentUser?.document_Id || '');
  const conversationUserIds = useMemo(
    () =>
      conversationSeed.map((conversation) => String(conversation.document_Id || '')).filter(Boolean),
    [conversationSeed]
  );
  const conversationUserIdsKey = useMemo(
    () => conversationUserIds.join('|'),
    [conversationUserIds]
  );

  const persistConversationCache = useCallback(async (userId, items) => {
    if (!userId) {
      return;
    }

    try {
      await AsyncStorage.setItem(`${HOME_CONVERSATIONS_CACHE_KEY}:${userId}`, JSON.stringify(items));
    } catch {}
  }, []);

  const loadConversationCache = useCallback(async (userId) => {
    if (!userId) {
      return;
    }

    try {
      const cachedValue = await AsyncStorage.getItem(`${HOME_CONVERSATIONS_CACHE_KEY}:${userId}`);
      if (!cachedValue) {
        return;
      }

      const parsed = JSON.parse(cachedValue);
      if (Array.isArray(parsed)) {
        setConversationSeed(parsed);
      }
    } catch {}
  }, []);

  const handlePress = useCallback(
    async (user) => {
      const targetUserId = String(user?.document_Id || '');

      if (!targetUserId || openingChatUserId) {
        return;
      }

      setOpeningChatUserId(targetUserId);
      let activeUserId = '';
      let preloadedChatKey = '';

      try {
        const storedUser = currentUserId ? null : await getStoredUser();
        activeUserId =
          currentUserId || String(storedUser?.uid || storedUser?.document_Id || '');
        const token = await getAuthToken();

        if (activeUserId && token) {
          const preloadedWindow = await preloadLatestChatWindow({
            currentUserId: activeUserId,
            otherUserId: targetUserId,
            token,
          });
          preloadedChatKey = preloadedWindow.chatKey;
        }
      } catch (error) {
        console.warn('Chat preload failed:', error);
      }

      router.push({
        pathname: `/chat/${targetUserId}`,
        params: {
          name: user.fullName,
          avatar: user.profilePictureUrl,
          currentUserId: activeUserId,
          preloadedChatKey,
        },
      });

      setOpeningChatUserId('');
    },
    [currentUserId, openingChatUserId]
  );

  const loadContext = useCallback(async () => {
    try {
      const [storedUser, token] = await Promise.all([getStoredUser(), getAuthToken()]);

      if (!storedUser?.uid || !token) {
        return;
      }

      setCurrentUser(storedUser);
      await loadConversationCache(storedUser.uid);

      const requestHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      let nextSeed = [];
      const summariesResponse = await fetch(buildApiUrl('/api/chat/conversations'), {
        headers: requestHeaders,
      });

      if (summariesResponse.ok) {
        const summariesData = await summariesResponse.json();
        nextSeed = Array.isArray(summariesData) ? summariesData : [];
      } else {
        console.warn('Conversation summaries route failed, falling back to friends list.');
      }

      if (!nextSeed.length) {
        const friendsResponse = await fetch(buildApiUrl('/api/friends'), {
          headers: requestHeaders,
        });

        if (friendsResponse.ok) {
          const friendsData = await friendsResponse.json();
          nextSeed = Array.isArray(friendsData)
            ? friendsData.map((friend) => ({
                ...friend,
                unreadCount: 0,
                lastMessageText: '',
                lastMessageType: null,
                lastMessageStatus: null,
                lastMessageSenderId: null,
                lastMessageTimestamp: null,
              }))
            : [];
        }
      }

      setConversationSeed(nextSeed);
      await persistConversationCache(storedUser.uid, nextSeed);
    } catch {
    }
  }, [loadConversationCache, persistConversationCache]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!trimmedSearchTerm) {
      setSearchResults([]);
      setFoundSearch(false);
      setIsSearching(false);
      return;
    }

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);

      try {
        const response = await fetch(
          buildApiUrl(`/api/public/users/search?q=${encodeURIComponent(trimmedSearchTerm)}`)
        );
        const data = await response.json();

        if (!isActive) {
          return;
        }

        if (response.ok && Array.isArray(data) && data.length > 0) {
          setSearchResults(rankSearchResults(data, trimmedSearchTerm));
          setFoundSearch(false);
        } else {
          setSearchResults([]);
          setFoundSearch(true);
        }
      } catch {
        if (!isActive) {
          return;
        }

        setSearchResults([]);
        setFoundSearch(true);
      } finally {
        if (isActive) {
          setIsSearching(false);
        }
      }
    }, 180);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [trimmedSearchTerm]);

  useEffect(() => {
    if (!currentUserId || !conversationUserIds.length) {
      setConversationSummaries((currentValue) =>
        Object.keys(currentValue).length ? {} : currentValue
      );
      setPresenceMap((currentValue) => (Object.keys(currentValue).length ? {} : currentValue));
      setTypingMap((currentValue) => (Object.keys(currentValue).length ? {} : currentValue));
      return;
    }

    const unsubscribeSummaryMap = subscribeToConversationSummaryMap(
      currentUserId,
      conversationUserIds,
      setConversationSummaries,
      () => {}
    );

    const unsubscribePresenceMap = subscribeToPresenceMap(
      conversationUserIds,
      setPresenceMap,
      () => {}
    );

    const unsubscribeTypingMap = subscribeToTypingMap(
      currentUserId,
      conversationUserIds,
      setTypingMap,
      () => {}
    );

    return () => {
      unsubscribeSummaryMap();
      unsubscribePresenceMap();
      unsubscribeTypingMap();
    };
  }, [currentUserId, conversationUserIdsKey]);

  useEffect(() => {
    if (!currentUserId || !conversationSeed.length) {
      return;
    }

    persistConversationCache(currentUserId, conversations);
  }, [conversations, currentUserId, persistConversationCache, conversationSeed.length]);

  useEffect(() => {
    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      if (searchOpen && !trimmedSearchTerm) {
        setSearchOpen(false);
      }
    });

    return () => {
      keyboardHideSubscription.remove();
    };
  }, [searchOpen, trimmedSearchTerm]);

  const handleAddFriend = useCallback(async (user) => {
    if (!user) {
      return;
    }

    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      const response = await fetch(buildApiUrl('/api/friends/requests'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId: user.document_Id }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        Alert.alert('Friends', String(payload?.message || 'Could not send friend request.'));
        return;
      }

      const nextStatus = String(payload?.status || 'sent');
      setFriendActionStateMap((currentMap) => ({
        ...currentMap,
        [String(user.document_Id)]: nextStatus,
      }));

      if (nextStatus === 'accepted_existing_request' || nextStatus === 'already_friends') {
        await loadContext();
      }

      if (payload?.message) {
        Alert.alert('Friends', String(payload.message));
      }
    } catch (error) {
      console.error('Send friend request failed:', error);
      Alert.alert('Friends', 'Could not send friend request.');
    }
  }, [loadContext]);

  const handleOpenSearch = () => {
    setSearchOpen(true);
  };

  const handleCloseSearch = () => {
    Keyboard.dismiss();
    setSearchOpen(false);
    setSearchTerm('');
    setSearchResults([]);
    setFoundSearch(false);
    setIsSearching(false);
  };

  const handleOutsideSearchPress = () => {
    Keyboard.dismiss();

    if (!trimmedSearchTerm) {
      handleCloseSearch();
    }
  };

  const renderConversationRow = ({ item }) => {
    const isOnline = item.presence?.status === 'online';
    const isOpeningChat = openingChatUserId === String(item.document_Id);
    const previewText = buildPreviewText(item);
    const timestampLabel = formatTimestamp(item.lastMessageTimestamp);
    const unreadCount = Number(item.unreadCount || 0);
    const isOwnLastMessage =
      !!currentUserId &&
      !item.isTyping &&
      !!item.lastMessageText &&
      String(item.lastMessageSenderId || '') === currentUserId;
    const statusMeta = isOwnLastMessage ? getMessageStatusMeta(item.lastMessageStatus) : null;

    return (
      <TouchableOpacity
        style={[styles.conversationRow, isOpeningChat ? styles.conversationRowOpening : null]}
        onPress={() => handlePress(item)}
        disabled={!!openingChatUserId}
      >
        <View style={[styles.avatarRing, isOnline ? styles.avatarRingOnline : styles.avatarRingOffline]}>
          <Image
            source={
              item.profilePictureUrl
                ? { uri: item.profilePictureUrl }
                : require('../assets/icons/profile.png')
            }
            style={item.profilePictureUrl ? styles.conversationAvatar : styles.conversationAvatarFallback}
          />
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeaderRow}>
            <Text numberOfLines={1} style={styles.conversationName}>
              {item.fullName}
            </Text>
            {timestampLabel ? <Text style={styles.conversationTime}>{timestampLabel}</Text> : null}
          </View>

          <View style={styles.conversationMetaRow}>
            <View style={styles.conversationPreviewWrap}>
              {statusMeta ? (
                <Text style={[styles.conversationStatusTicks, { color: statusMeta.color }]}>
                  {statusMeta.text}
                </Text>
              ) : null}
              <Text
                numberOfLines={1}
                style={[styles.conversationPreview, item.isTyping ? styles.conversationPreviewTyping : null]}
              >
                {previewText}
              </Text>
            </View>

            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchResult = ({ item }) => {
    const isCurrentUser = !!currentUserId && String(item.document_Id) === currentUserId;
    const actionState = String(friendActionStateMap[String(item.document_Id)] || '');
    const isFriend =
      conversationUserIds.includes(String(item.document_Id)) ||
      actionState === 'accepted_existing_request' ||
      actionState === 'already_friends';
    const isPendingRequest = actionState === 'sent' || actionState === 'already_sent';

    return (
      <View style={styles.resultCard}>
        <View style={styles.resultRow}>
          <View style={styles.resultIdentity}>
            <View style={styles.avatarWrap}>
              <Image
                source={
                  item.profilePictureUrl
                    ? { uri: item.profilePictureUrl }
                    : require('../assets/icons/profile.png')
                }
                style={item.profilePictureUrl ? styles.resultAvatar : styles.avatarFallback}
              />
            </View>

            <View style={styles.resultMeta}>
              <Text style={styles.resultName}>{item.fullName}</Text>
            </View>
          </View>

          {isCurrentUser ? (
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowmodal(true)}>
              <Image
                source={require('../assets/icons/profile.png')}
                style={styles.actionIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ) : null}

          {!isCurrentUser && isFriend ? (
            <TouchableOpacity
              style={[
                styles.actionButton,
                openingChatUserId === String(item.document_Id) ? styles.actionButtonDisabled : null,
              ]}
              onPress={() => handlePress(item)}
              disabled={!!openingChatUserId}
            >
              <Image
                source={require('../assets/icons/chat.png')}
                style={styles.actionIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ) : null}

          {!isCurrentUser && !isFriend && !isPendingRequest ? (
            <TouchableOpacity style={styles.actionButton} onPress={() => handleAddFriend(item)}>
              <Image
                source={require('../assets/icons/friends.png')}
                style={styles.actionIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ) : null}

          {!isCurrentUser && isPendingRequest ? (
            <View style={[styles.actionButton, styles.pendingActionButton]}>
              <Text style={styles.pendingActionText}>Sent</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Pressable
        style={styles.topContainer}
        onPressIn={searchOpen ? handleOutsideSearchPress : undefined}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setShowmodal(true)} style={styles.menu}>
            <Image
              source={require('../assets/icons/menueBars.png')}
              style={{ width: 32, height: 23 }}
            />
          </TouchableOpacity>

          {searchOpen ? (
            <Pressable style={styles.searchBox} onPress={(event) => event.stopPropagation()}>
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search people"
                placeholderTextColor="#8A8FA3"
                style={styles.searchInput}
                autoFocus
              />
              <TouchableOpacity onPress={handleCloseSearch} style={styles.searchIconButton}>
                <Image
                  source={require('../assets/icons/search.png')}
                  resizeMode="contain"
                  style={styles.searchIconButtonImage}
                />
              </TouchableOpacity>
            </Pressable>
          ) : (
            <TouchableOpacity onPress={handleOpenSearch} style={styles.searchTrigger}>
              <Image
                source={require('../assets/icons/search.png')}
                resizeMode="contain"
                style={styles.searchTriggerIcon}
              />
            </TouchableOpacity>
          )}
        </View>
      </Pressable>

      <Pressable
        style={styles.downContainer}
        onPressIn={searchOpen ? handleOutsideSearchPress : undefined}
      >
        <View style={styles.contentWrap}>
          {showSearchResults ? (
            <FlatList
              data={limitedSearchResults}
              keyExtractor={(item) => String(item.document_Id)}
              renderItem={renderSearchResult}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.resultsContent}
              ListEmptyComponent={
                foundSearch ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No results</Text>
                    <Text style={styles.emptyText}>Try another name.</Text>
                  </View>
                ) : null
              }
            />
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => String(item.document_Id)}
              renderItem={renderConversationRow}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.resultsContent}
              ListEmptyComponent={
                <View style={styles.emptyListState}>
                  <Text style={styles.emptyListTitle}>No conversations yet</Text>
                  <Text style={styles.emptyListText}>
                    Search for a friend to send a request or jump into chat when you are already
                    connected.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Pressable>

      {showModal && (
        <View style={{ margin: 0, padding: 0 }}>
          <Mymodal visible={showModal} onClose={() => setShowmodal(false)} />
        </View>
      )}
    </SafeAreaView>
  );
};

export default Home;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topContainer: {
    width: '100%',
    height: 130,
    backgroundColor: custom_colors.primary_dark,
    alignItems: 'center',
    paddingTop: 18,
  },
  headerRow: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  menu: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTrigger: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTriggerIcon: {
    width: 18,
    height: 18,
    tintColor: '#FFFFFF',
  },
  searchBox: {
    flex: 1,
    height: 46,
    position: 'relative',
    backgroundColor: '#F7F8FD',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E6F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1B0333',
    paddingVertical: 0,
    paddingRight: 44,
  },
  searchIconButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconButtonImage: {
    width: 18,
    height: 18,
    tintColor: custom_colors.primary_dark,
  },
  downContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: custom_colors.secondary,
    marginTop: -12,
    paddingTop: 12,
    alignItems: 'center',
  },
  contentWrap: {
    flex: 1,
    width: '92%',
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF6',
  },
  conversationRowOpening: {
    opacity: 0.72,
  },
  avatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  avatarRingOnline: {
    borderColor: '#2CC069',
  },
  avatarRingOffline: {
    borderColor: '#D8DDE8',
  },
  conversationAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  conversationAvatarFallback: {
    width: 28,
    height: 28,
    tintColor: '#8A92A8',
  },
  conversationContent: {
    flex: 1,
    minWidth: 0,
  },
  conversationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  conversationName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1B0333',
  },
  conversationTime: {
    fontSize: 12,
    color: '#7A8195',
  },
  conversationMetaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conversationPreviewWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  conversationPreview: {
    flex: 1,
    fontSize: 13,
    color: '#6F768A',
  },
  conversationStatusTicks: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
  conversationPreviewTyping: {
    color: '#2A7FFF',
    fontStyle: 'italic',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#2A7FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  resultsContent: {
    paddingBottom: 28,
  },
  emptyListState: {
    marginTop: 48,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyListTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B0333',
    marginBottom: 8,
  },
  emptyListText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#75758A',
  },
  resultCard: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E3E7F0',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resultIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DDF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  resultAvatar: {
    width: 52,
    height: 52,
  },
  avatarFallback: {
    width: 30,
    height: 30,
    tintColor: custom_colors.primary_dark,
  },
  resultMeta: {
    flex: 1,
    minWidth: 0,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B0333',
  },
  actionButton: {
    backgroundColor: custom_colors.primary_dark,
    borderRadius: 14,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.72,
  },
  pendingActionButton: {
    backgroundColor: '#E9EEF7',
    width: 58,
  },
  pendingActionText: {
    color: custom_colors.primary_dark,
    fontSize: 12,
    fontWeight: '700',
  },
  actionIcon: {
    width: 20,
    height: 20,
    tintColor: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B0333',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#687083',
  },
});
