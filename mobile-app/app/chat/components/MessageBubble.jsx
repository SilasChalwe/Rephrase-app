import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { appTheme, withOpacity } from '../../../utilities/colors';

const formatTime = (timestamp) => {
  const date = new Date(Number(timestamp) || Date.now());

  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
};

const formatDateLabel = (timestamp) => {
  const date = new Date(Number(timestamp) || Date.now());
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isSameDay) {
    return 'Today';
  }

  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) {
    return 'Yesterday';
  }

  return date.toDateString();
};

const deriveAttachmentKind = (message) => {
  const type = String(message?.type || 'TEXT').toUpperCase();

  if (type.includes('IMAGE')) {
    return 'image';
  }

  if (type.includes('VIDEO')) {
    return 'video';
  }

  if (type.includes('DOC') || type.includes('FILE') || type.includes('PDF')) {
    return 'document';
  }

  if (message?.mediaUrl) {
    return 'document';
  }

  return 'text';
};

const deriveDocumentName = (message) => {
  if (message?.fileName) {
    return String(message.fileName);
  }

  const mediaUrl = String(message?.mediaUrl || '');
  if (!mediaUrl) {
    return 'Document';
  }

  try {
    const normalizedUrl = decodeURIComponent(mediaUrl.split('?')[0] || '');
    const segments = normalizedUrl.split('/');
    const fileName = segments[segments.length - 1];
    return fileName || 'Document';
  } catch {
    return 'Document';
  }
};

const renderStatus = (status) => {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'read') {
    return <Text style={[styles.statusText, styles.statusRead]}>✓✓</Text>;
  }

  if (normalized === 'delivered') {
    return <Text style={styles.statusText}>✓✓</Text>;
  }

  if (normalized === 'sent') {
    return <Text style={styles.statusText}>✓</Text>;
  }

  if (normalized === 'failed') {
    return <Text style={[styles.statusText, styles.statusFailed]}>!</Text>;
  }

  return null;
};

const MessageBubble = ({
  isMine,
  isTyping = false,
  message,
  onPressAttachment,
  senderName,
  showDateHeader,
  showSenderName,
}) => {
  const [typingStep, setTypingStep] = useState(1);

  useEffect(() => {
    if (!isTyping) {
      setTypingStep(1);
      return undefined;
    }

    const intervalId = setInterval(() => {
      setTypingStep((currentStep) => (currentStep % 4) + 1);
    }, 380);

    return () => {
      clearInterval(intervalId);
    };
  }, [isTyping]);

  if (isTyping) {
    return (
      <View style={[styles.row, styles.rowTheirs]}>
        <View style={[styles.messageContainer, styles.theirs, styles.typingBubble]}>
          {showSenderName ? <Text style={styles.senderName}>{senderName}</Text> : null}
          <Text style={styles.typingLabel}>{`typing${'.'.repeat(typingStep)}`}</Text>
        </View>
      </View>
    );
  }

  const attachmentKind = deriveAttachmentKind(message);
  const hasAttachment = attachmentKind !== 'text' && !!message?.mediaUrl;
  const captionText = String(message?.text || '').trim();
  const documentName = deriveDocumentName(message);

  return (
    <View>
      {showDateHeader ? <Text style={styles.dateLabel}>{formatDateLabel(message?.createdAt)}</Text> : null}

      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.messageContainer, isMine ? styles.mine : styles.theirs]}>
          {!isMine && showSenderName ? <Text style={styles.senderName}>{senderName}</Text> : null}

          {hasAttachment ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onPressAttachment?.(message)}
              style={styles.attachmentTouchable}
            >
              {attachmentKind === 'image' ? (
                <Image source={{ uri: message.mediaUrl }} style={styles.imageAttachment} />
              ) : null}

              {attachmentKind === 'video' ? (
                <View style={styles.videoContainer}>
                  {message?.thumbnailUrl ? (
                    <Image source={{ uri: message.thumbnailUrl }} style={styles.videoThumbnail} />
                  ) : (
                    <View style={styles.videoFallback}>
                      <Text style={styles.videoFallbackLabel}>Video</Text>
                    </View>
                  )}
                  <View style={styles.videoOverlay}>
                    <Image
                      resizeMode="contain"
                      source={require('../../assets/icons/right-arrow.png')}
                      style={styles.playIcon}
                    />
                  </View>
                </View>
              ) : null}

              {attachmentKind === 'document' ? (
                <View style={styles.documentCard}>
                  <View style={styles.documentIconWrap}>
                    <Image
                      resizeMode="contain"
                      source={require('../../assets/icons/upload.png')}
                      style={styles.documentIcon}
                    />
                  </View>
                  <View style={styles.documentTextWrap}>
                    <Text numberOfLines={1} style={styles.documentName}>
                      {documentName}
                    </Text>
                    <Text style={styles.documentHint}>Open document</Text>
                  </View>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}

          {captionText ? (
            <Text style={[styles.messageText, isMine ? styles.messageTextMine : null]}>
              {captionText}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <Text style={[styles.timeStamp, isMine ? styles.timeStampMine : null]}>
              {formatTime(message?.createdAt)}
            </Text>
            {isMine ? renderStatus(message?.status) : null}
          </View>
        </View>
      </View>
    </View>
  );
};

const areEqual = (previousProps, nextProps) => {
  return (
    previousProps.isMine === nextProps.isMine &&
    previousProps.isTyping === nextProps.isTyping &&
    previousProps.showDateHeader === nextProps.showDateHeader &&
    previousProps.showSenderName === nextProps.showSenderName &&
    previousProps.senderName === nextProps.senderName &&
    previousProps.message?.id === nextProps.message?.id &&
    previousProps.message?.text === nextProps.message?.text &&
    previousProps.message?.status === nextProps.message?.status &&
    previousProps.message?.createdAt === nextProps.message?.createdAt &&
    previousProps.message?.mediaUrl === nextProps.message?.mediaUrl &&
    previousProps.message?.thumbnailUrl === nextProps.message?.thumbnailUrl &&
    previousProps.message?.fileName === nextProps.message?.fileName &&
    previousProps.message?.type === nextProps.message?.type
  );
};

export default React.memo(MessageBubble, areEqual);

const styles = StyleSheet.create({
  row: {
    marginVertical: 3,
    width: '100%',
  },
  rowMine: {
    alignItems: 'flex-end',
  },
  rowTheirs: {
    alignItems: 'flex-start',
  },
  messageContainer: {
    borderRadius: 12,
    maxWidth: '84%',
    minWidth: 92,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  mine: {
    backgroundColor: appTheme.chat.bubbleMine,
    borderTopRightRadius: 4,
  },
  theirs: {
    backgroundColor: appTheme.chat.bubbleTheirs,
    borderTopLeftRadius: 4,
  },
  senderName: {
    color: appTheme.chat.senderName,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  attachmentTouchable: {
    marginBottom: 6,
  },
  imageAttachment: {
    backgroundColor: appTheme.chat.mediaSurface,
    borderRadius: 10,
    height: 220,
    width: 220,
  },
  videoContainer: {
    alignItems: 'center',
    backgroundColor: appTheme.chat.mediaSurface,
    borderRadius: 10,
    height: 220,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 220,
  },
  videoThumbnail: {
    height: '100%',
    opacity: 0.9,
    width: '100%',
  },
  videoFallback: {
    alignItems: 'center',
    backgroundColor: appTheme.chat.mediaSurface,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  videoFallbackLabel: {
    color: appTheme.colors.textOnDark,
    fontSize: 18,
    fontWeight: '700',
  },
  videoOverlay: {
    alignItems: 'center',
    backgroundColor: withOpacity('#000000', 0.38),
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    position: 'absolute',
    width: 52,
  },
  playIcon: {
    height: 22,
    tintColor: appTheme.colors.textOnDark,
    width: 22,
  },
  documentCard: {
    alignItems: 'center',
    backgroundColor: appTheme.chat.attachmentSurface,
    borderRadius: 10,
    flexDirection: 'row',
    minWidth: 210,
    padding: 12,
  },
  documentIconWrap: {
    alignItems: 'center',
    backgroundColor: appTheme.auth.input,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },
  documentIcon: {
    height: 18,
    tintColor: appTheme.colors.textOnDark,
    width: 18,
  },
  documentTextWrap: {
    flex: 1,
  },
  documentName: {
    color: appTheme.colors.textOnDark,
    fontSize: 14,
    fontWeight: '700',
  },
  documentHint: {
    color: appTheme.colors.textOnDarkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  messageText: {
    color: appTheme.chat.bubbleTheirsText,
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextMine: {
    color: appTheme.chat.bubbleMineText,
  },
  typingBubble: {
    minWidth: 84,
  },
  typingLabel: {
    color: appTheme.chat.typingDot,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 20,
  },
  metaRow: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    marginTop: 4,
  },
  timeStamp: {
    color: appTheme.chat.bubbleTheirsMeta,
    fontSize: 11,
  },
  timeStampMine: {
    color: appTheme.chat.bubbleMineMeta,
  },
  statusText: {
    color: appTheme.chat.bubbleMineMeta,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  statusRead: {
    color: appTheme.colors.accentSoft,
  },
  statusFailed: {
    color: appTheme.colors.danger,
  },
  dateLabel: {
    alignSelf: 'center',
    backgroundColor: appTheme.chat.datePill,
    borderRadius: 8,
    color: appTheme.chat.datePillText,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
});
