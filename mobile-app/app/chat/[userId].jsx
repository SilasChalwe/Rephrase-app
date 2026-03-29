import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';

import { custom_colors } from '../utilities/colors';
import { buildApiUrl, getStoredUser } from '../../lib/api';
import { subscribeToConversationMessages } from '../../lib/realtimeChat';

const ChatScreen = () => {
  const { userId, name, avatar } = useLocalSearchParams();
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);
  const markReadInFlightRef = useRef(false);

  const otherUserId = String(userId || '');

  useFocusEffect(
    React.useCallback(() => {
      let unsubscribeMessages = () => {};
      let isActive = true;

      const initializeChat = async () => {
        const user = await getStoredUser();

        if (!isActive || !user?.uid || !user?.token || !otherUserId) {
          setIsLoading(false);
          return;
        }

        setSession(user);
        setIsLoading(true);

        unsubscribeMessages = subscribeToConversationMessages(
          user.uid,
          otherUserId,
          async (messages) => {
            if (!isActive) {
              return;
            }

            setChatMessages(messages);
            setIsLoading(false);

            const hasUnreadIncomingMessages = messages.some(
              (message) =>
                message.senderId === otherUserId &&
                message.receiverId === user.uid &&
                message.status !== 'READ'
            );

            if (!hasUnreadIncomingMessages || markReadInFlightRef.current) {
              return;
            }

            markReadInFlightRef.current = true;

            try {
              await fetch(buildApiUrl(`/api/chat/conversations/read?id=${otherUserId}`), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${user.token}`,
                },
              });
            } catch (error) {
              console.warn('Failed to mark conversation as read:', error);
            } finally {
              markReadInFlightRef.current = false;
            }
          },
          (error) => {
            console.error('Realtime message subscription failed:', error);
            if (isActive) {
              setIsLoading(false);
            }
          }
        );
      };

      initializeChat();

      return () => {
        isActive = false;
        unsubscribeMessages();
      };
    }, [otherUserId])
  );

  useEffect(() => {
    if (!chatMessages.length) {
      return;
    }

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, [chatMessages]);

  const handleSend = async () => {
    const trimmedMessage = inputText.trim();

    if (!trimmedMessage || !session?.token || !otherUserId || isSending) {
      return;
    }

    setIsSending(true);
    setInputText('');

    try {
      const response = await fetch(buildApiUrl('/api/chat/messages/text'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          receiverId: otherUserId,
          text: trimmedMessage,
        }),
      });

      if (!response.ok) {
        throw new Error('Message failed to send.');
      }
    } catch (error) {
      console.error('Send error:', error);
      setInputText(trimmedMessage);
    } finally {
      setIsSending(false);
    }
  };

  const sortedMessages = useMemo(
    () => [...chatMessages].sort((left, right) => left.timestamp - right.timestamp),
    [chatMessages]
  );

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  };

  const formatDate = (timestamp) => new Date(timestamp).toDateString();

  const renderMessage = ({ item, index }) => {
    const isMine = item.senderId === session?.uid;
    const showDate =
      index === 0 || formatDate(item.timestamp) !== formatDate(sortedMessages[index - 1]?.timestamp);

    return (
      <>
        {showDate ? <Text style={styles.dateLabel}>{formatDate(item.timestamp)}</Text> : null}
        <View style={[styles.messageContainer, isMine ? styles.mine : styles.theirs]}>
          {!isMine ? <Text style={styles.senderName}>{name}</Text> : null}
          <Text style={styles.messageText}>{item.message}</Text>
          <Text style={styles.timeStamp}>{formatTime(item.timestamp)}</Text>
        </View>
      </>
    );
  };

  const handleBack = () => router.push('/home');

  return (
    <View style={styles.container}>
      <Image source={require('../assets/icons/chatbg.png')} style={styles.imageBg} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Image
            style={{ tintColor: '#ffff' }}
            source={require('../assets/icons/left-arrow.png')}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={styles.profileContainer}>
          <Image
            source={avatar ? { uri: avatar } : require('../assets/icons/profile.png')}
            style={avatar ? styles.profileImage : { width: 40, height: 40 }}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.nameText}>{name}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#8686DB" style={styles.loadingIndicator} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={sortedMessages}
            keyExtractor={(item) => item.messageId}
            renderItem={renderMessage}
            contentContainerStyle={styles.chatContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}
      </KeyboardAvoidingView>

      <View style={styles.inputContainer}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          style={styles.input}
          editable={!isSending}
        />
        <TouchableOpacity
          onPress={handleSend}
          style={[styles.sendButton, isSending ? styles.sendButtonDisabled : null]}
          disabled={isSending}
        >
          <Text style={{ color: 'white' }}>{isSending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  imageBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  topBar: {
    width: '100%',
    height: 100,
    backgroundColor: custom_colors.primary_dark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 50,
    paddingTop: 10,
  },
  backButton: {
    position: 'absolute',
    left: 10,
    tintColor: 'white',
    top: 40,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
    zIndex: 10,
  },
  profileContainer: {
    backgroundColor: custom_colors.primary_aut,
    borderColor: 'white',
    borderWidth: 2,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignSelf: 'center',
    marginTop: 5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: 80,
    height: 80,
  },
  nameText: {
    color: 'white',
    alignSelf: 'center',
    marginTop: 6,
    fontWeight: '600',
    fontSize: 16,
  },
  chatContainer: {
    paddingHorizontal: 12,
    paddingBottom: 80,
    paddingTop: 10,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 6,
    padding: 10,
    borderRadius: 12,
    position: 'relative',
  },
  mine: {
    backgroundColor: custom_colors.primary_dark,
    alignSelf: 'flex-end',
  },
  theirs: {
    backgroundColor: '#FF8C00',
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#1B0333',
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
  },
  timeStamp: {
    fontSize: 10,
    color: '#ccc',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  dateLabel: {
    alignSelf: 'center',
    backgroundColor: '#EAEAEA',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 8,
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  sendButton: {
    backgroundColor: custom_colors.primary_dark,
    paddingHorizontal: 20,
    marginLeft: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
    zIndex: 1000,
  },
});
