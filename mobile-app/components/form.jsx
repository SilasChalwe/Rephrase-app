import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet,Image, TouchableOpacity } from 'react-native';
import { custom_colors } from '../utilities/colors';
export const FormField = ({ title, value, handleChangeText, keyboardType, style,inputStyle,inputs }) => {
 const eyeOpen = require('../app/assets/icons/eye.png');
 const eyeClose = require('../app/assets/icons/Eyeclose.png');
  const [showPassword,setshowPassword] =useState(false)
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{title}</Text>
      <View style={[styles.inputContainer, inputStyle]}>
      <TextInput
        style={[styles.input, inputs]}
        value={value}
        onChangeText={handleChangeText}
        keyboardType={keyboardType}
        secureTextEntry={title==='Password' && !showPassword}
        placeholder={title}
        placeholderTextColor="#aaa"
        autoCapitalize="none"
        autoCorrect={false}

      />
     
      {title === 'Password' && (
          <TouchableOpacity onPress={() => setshowPassword(!showPassword)} style={styles.iconContainer}>
            <Image
              source={!showPassword ? eyeOpen : eyeClose}
              style={styles.icon}
            />
          </TouchableOpacity>
          
        )}
         </View>
    
       
    </View>
    
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    justifyContent:'center',
  
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 5,
    marginLeft: 15,
    marginRight:15,
  },
  input: {
    backgroundColor: custom_colors.peimary_aut,
    borderRadius: 5,
    padding: 12,
    width:'100%',
    marginLeft: 0,
    marginRight:15,
    fontSize: 16,
    color:'white',
  },
  iconContainer: {
    position: 'absolute',
    right: 12,
    top: 8,
    padding: 4,
    alignItems:'center',
    justifyContent:'center'
  },
  icon: {
    width: 30,
    height: 30,
    tintColor: 'white',
    
  },
  inputContainer: {
    flexDirection: 'row',
    
    alignItems: 'center',
    marginLeft: 15,
    marginRight: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
});
