import React from 'react'
import { Stack } from 'expo-router'

const AuthLayout = () => {
  return (
    <Stack>

       <Stack.Screen name='signin' options={{title: 'signIn',headerShown:false}}/>
      <Stack.Screen name='signup'options={{title: 'Sign Up',headerShown:false}}/>

    </Stack>
  )
}

export default AuthLayout
