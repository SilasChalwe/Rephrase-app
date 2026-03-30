import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { appTheme } from '../../../utilities/colors';

const ScrollToBottomButton = ({ bottomOffset = 88, count, onPress }) => {
  const safeCount = Math.max(1, Number(count) || 0);
  const label = safeCount === 1 ? '1 new message' : `${safeCount} new messages`;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[styles.button, { bottom: Number(bottomOffset) || 88 }]}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{safeCount > 99 ? '99+' : safeCount}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

export default React.memo(ScrollToBottomButton);

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: appTheme.chat.floatingButton,
    borderRadius: 999,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    shadowColor: appTheme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: appTheme.chat.floatingBadge,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    marginRight: 8,
    minWidth: 20,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: appTheme.chat.floatingBadgeText,
    fontSize: 11,
    fontWeight: '800',
  },
  label: {
    color: appTheme.colors.textOnDark,
    fontSize: 12,
    fontWeight: '700',
  },
});
