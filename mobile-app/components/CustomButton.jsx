import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const CustomButton = ({ title, onPress, styling, textStyle, disabled = false }) => {
  return (
    <TouchableOpacity
      style={[styles.button, styling, disabled ? styles.buttonDisabled : null]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <Text style={[styles.buttonText, textStyle, disabled ? styles.buttonTextDisabled : null]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

export default CustomButton;

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#000066',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 22,
    width: 300,
    height:50,
    marginLeft:15,
    marginRight:15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextDisabled: {
    opacity: 0.95,
  },
});
