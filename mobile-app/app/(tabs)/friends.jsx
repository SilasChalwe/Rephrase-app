import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FriendRequest from '../../components/friendRequest';
import MyFriends from '../../components/myFriends';
import { custom_colors } from '../../utilities/colors';
import { buildApiUrl, getAuthToken } from '../../lib/api';

const profileColors = ['#FFCC00', '#33CC33', '#FF3399'];

const chooseProfileColor = (seed = '') => {
  const normalizedSeed = String(seed || '');
  if (!normalizedSeed) {
    return profileColors[0];
  }

  const sum = normalizedSeed.split('').reduce((total, value) => total + value.charCodeAt(0), 0);
  return profileColors[sum % profileColors.length];
};

const buildHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const FriendsScreen = () => {
  const [activeTab, setActiveTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const loadPendingRequests = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      const response = await fetch(buildApiUrl('/api/friends/requests/pending'), {
        method: 'GET',
        headers: buildHeaders(token),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Failed to load friend requests.');
      }

      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Pending friend requests load failed:', error);
    }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      const response = await fetch(buildApiUrl('/api/friends'), {
        method: 'GET',
        headers: buildHeaders(token),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Failed to load friends.');
      }

      const data = await response.json();
      setFriends(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Friends load failed:', error);
    }
  }, []);

  const loadFriendsContext = useCallback(async () => {
    await Promise.all([loadPendingRequests(), loadFriends()]);
  }, [loadFriends, loadPendingRequests]);

  useEffect(() => {
    loadFriendsContext();
  }, [loadFriendsContext]);

  const upsertFriend = useCallback((nextFriend) => {
    if (!nextFriend?.document_Id) {
      return;
    }

    setFriends((currentFriends) => {
      const hasFriend = currentFriends.some(
        (friend) => String(friend.document_Id) === String(nextFriend.document_Id)
      );

      if (hasFriend) {
        return currentFriends.map((friend) =>
          String(friend.document_Id) === String(nextFriend.document_Id) ? nextFriend : friend
        );
      }

      return [...currentFriends, nextFriend].sort((left, right) =>
        String(left.fullName || '').localeCompare(String(right.fullName || ''))
      );
    });
  }, []);

  const handleApproveRequest = useCallback(
    async (requestUser) => {
      if (!requestUser?.document_Id) {
        return;
      }

      try {
        const token = await getAuthToken();
        if (!token) {
          return;
        }

        const response = await fetch(
          buildApiUrl(`/api/friends/requests/${requestUser.document_Id}`),
          {
            method: 'PUT',
            headers: buildHeaders(token),
          }
        );

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message || 'Failed to approve friend request.');
        }

        setRequests((currentRequests) =>
          currentRequests.filter(
            (user) => String(user.document_Id) !== String(requestUser.document_Id)
          )
        );
        upsertFriend(payload?.friend || requestUser);
      } catch (error) {
        console.error('Friend request approval failed:', error);
        Alert.alert('Friend Request', String(error?.message || 'Failed to approve request.'));
      }
    },
    [upsertFriend]
  );

  const handleDeclineRequest = useCallback(async (requestUser) => {
    if (!requestUser?.document_Id) {
      return;
    }

    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      const response = await fetch(
        buildApiUrl(`/api/friends/requests/${requestUser.document_Id}`),
        {
          method: 'DELETE',
          headers: buildHeaders(token),
        }
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to remove friend request.');
      }

      setRequests((currentRequests) =>
        currentRequests.filter(
          (user) => String(user.document_Id) !== String(requestUser.document_Id)
        )
      );
    } catch (error) {
      console.error('Friend request decline failed:', error);
      Alert.alert('Friend Request', String(error?.message || 'Failed to remove request.'));
    }
  }, []);

  const openBottomSheet = useCallback((user) => {
    setSelectedFriend(user);
    setShowProfileModal(true);
  }, []);

  const requestListEmptyState = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No pending requests</Text>
        <Text style={styles.emptyText}>Incoming friend requests will appear here.</Text>
      </View>
    ),
    []
  );

  const friendsListEmptyState = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No friends yet</Text>
        <Text style={styles.emptyText}>Search for people on the home tab and send a request.</Text>
      </View>
    ),
    []
  );

  const renderRequestItem = useCallback(
    ({ item }) => (
      <FriendRequest
        Color={chooseProfileColor(item.document_Id)}
        confirmRequest={() => handleApproveRequest(item)}
        cancelRequest={() => handleDeclineRequest(item)}
        isRequest
        name={item.fullName}
        profile={item.profilePictureUrl}
      />
    ),
    [handleApproveRequest, handleDeclineRequest]
  );

  const renderFriendItem = useCallback(
    ({ item }) => (
      <MyFriends
        Color={chooseProfileColor(item.document_Id)}
        name={item.fullName}
        pressed={() => openBottomSheet(item)}
        profilePic={item.profilePictureUrl}
      />
    ),
    [openBottomSheet]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>

        <View style={styles.tabsRow}>
          <TouchableOpacity
            onPress={() => setActiveTab('requests')}
            style={[styles.tabButton, activeTab === 'requests' ? styles.tabButtonActive : null]}
          >
            <Text
              style={[styles.tabButtonText, activeTab === 'requests' ? styles.tabButtonTextActive : null]}
            >
              Requests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('friends')}
            style={[styles.tabButton, activeTab === 'friends' ? styles.tabButtonActive : null]}
          >
            <Text
              style={[styles.tabButtonText, activeTab === 'friends' ? styles.tabButtonTextActive : null]}
            >
              Your Friends
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === 'requests' ? (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={requests}
            keyExtractor={(item) => String(item.document_Id)}
            ListEmptyComponent={requestListEmptyState}
            renderItem={renderRequestItem}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={friends}
            keyExtractor={(item) => String(item.document_Id)}
            ListEmptyComponent={friendsListEmptyState}
            renderItem={renderFriendItem}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowProfileModal(false)}
        transparent
        visible={showProfileModal}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowProfileModal(false)} />
          <View style={styles.bottomSheet}>
            <ScrollView style={styles.bottomOuter}>
              <View style={styles.userProfile}>
                <Image
                  source={require('../assets/images/profile-bg.png')}
                  style={styles.profileCover}
                />
                <Image
                  source={
                    selectedFriend?.profilePictureUrl
                      ? { uri: selectedFriend.profilePictureUrl }
                      : require('../assets/icons/profile.png')
                  }
                  style={selectedFriend?.profilePictureUrl ? styles.profileImage : styles.profileFallback}
                />
              </View>

              <Text style={styles.profileLine}>
                Name: <Text style={styles.profileValue}>{selectedFriend?.fullName ?? ''}</Text>
              </Text>
              <Text style={styles.profileLine}>
                Email: <Text style={styles.profileValue}>{selectedFriend?.emailAddress ?? ''}</Text>
              </Text>
              <Text style={styles.profileLine}>
                Phone: <Text style={styles.profileValue}>{selectedFriend?.phoneNumber ?? ''}</Text>
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default FriendsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: custom_colors.secondary,
  },
  header: {
    alignItems: 'center',
    backgroundColor: custom_colors.primary_dark,
    borderBottomLeftRadius: 40,
    minHeight: 200,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  headerTitle: {
    alignSelf: 'center',
    color: '#FFFFFF',
    fontFamily: 'Colonna',
    fontSize: 52,
    marginTop: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  tabButton: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFD6AE',
  },
  tabButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: custom_colors.primary_dark,
  },
  content: {
    flex: 1,
    marginTop: -10,
    paddingTop: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  emptyTitle: {
    color: '#49566F',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#7B889E',
    fontSize: 14,
    textAlign: 'center',
  },
  userProfile: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 20,
    height: 200,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '90%',
  },
  profileCover: {
    borderRadius: 15,
    height: 200,
    position: 'absolute',
    width: '100%',
    zIndex: -1,
  },
  profileImage: {
    borderRadius: 16,
    height: 170,
    width: 170,
  },
  profileFallback: {
    height: 90,
    tintColor: '#FFFFFF',
    width: 90,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 22, 46, 0.24)',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingVertical: 20,
  },
  bottomOuter: {
    paddingBottom: 30,
  },
  profileLine: {
    color: '#6B778D',
    fontSize: 18,
    marginLeft: 40,
    marginTop: 12,
  },
  profileValue: {
    color: '#1F5FA6',
  },
});
