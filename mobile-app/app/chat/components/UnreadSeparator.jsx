import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { appTheme } from '../../../utilities/colors';

const UnreadSeparator = ({ count }) => {
  const safeCount = Math.max(1, Number(count) || 0);
  const label = safeCount === 1 ? '1 unread message' : `${safeCount} unread messages`;

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
};

export default React.memo(UnreadSeparator);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  line: {
    backgroundColor: appTheme.colors.borderOnDarkSoft,
    flex: 1,
    height: 1,
  },
  label: {
    backgroundColor: appTheme.chat.unreadBg,
    borderColor: appTheme.chat.unreadBorder,
    borderRadius: 999,
    borderWidth: 1,
    color: appTheme.chat.unreadText,
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 10,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
});
