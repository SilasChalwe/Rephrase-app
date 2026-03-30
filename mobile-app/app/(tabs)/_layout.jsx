import { View, Image } from 'react-native';
import React from 'react';
import { Tabs } from 'expo-router';


const TabsIcon = ({ icon, color, focused,extraStyles }) => (
  <View>
    <Image
      source={icon}
      resizeMode="contain"
      style={[extraStyles,{
        width: 20,
        height: 20,
        tintColor: focused ? 'blue' : color,
      }]}
    />
  </View>
);
const TabsLayout = () => {
  return (
      <Tabs>
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ focused, color }) => (
              <TabsIcon
                icon={require('../assets/icons/home.png')}
                color={color}
                focused={focused}
              />
            ),

            
          }}
        />
<Tabs.Screen
          name="friends"
          options={{
            title: 'friends',
            headerShown: false,
           
            tabBarIcon: ({ focused, color }) => (
              <TabsIcon
                icon={require('../assets/icons/friends.png')}
                color={color}
                focused={focused}
                extraStyles={{with:40,height:40}}

              />
            ),
           

              headerSearchBarOptions:{
             headerIconColor:'#8686DB',
              placeholder:'Seach for a friend',
              
            },
            
          
            headerStyle:{
              backgroundColor:'#8686DB',
              alignItems:'center',
              
            },
            
        
            headerTintColor:'white',
          }}
/>
      </Tabs>
  );
};

export default TabsLayout;
