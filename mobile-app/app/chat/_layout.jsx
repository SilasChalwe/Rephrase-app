import React from 'react';
import { Stack } from 'expo-router';

const ChatLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 220,
      }}
    >
      <Stack.Screen
        name="[userId]"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 220,
        }}
      />
    </Stack>
  );
};

export default ChatLayout;
