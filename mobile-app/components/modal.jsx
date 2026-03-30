import React, { useState, useEffect } from 'react';
import { Alert, View, Text, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import * as ImagePicker from 'expo-image-picker';
import { signOut } from 'firebase/auth';
import { FIREBASE_AUTH } from '../firebase';
import { router } from 'expo-router';
import { buildApiUrl, clearStoredUser, getStoredUser, persistStoredUser } from '../lib/api';

const { height } = Dimensions.get('window');

export default function Mymodal({ visible, onClose }) {

  const [isChangeProfile, setIsChangeProfle] = useState(false);
  const [profileImage, seProfileImage] = useState('');
  const [userData, setUserData] = useState(null)
  const [loading,setLoading]= useState(false);
  useEffect(() => {
    loadUser();

  }, [])
  const loadUser = async () => {
    const user = await getStoredUser();
    setUserData(user);
  };

  const uploadProfileImage = async (imageUri) => {
    const user = await getStoredUser();
    if (!user?.token) {
      Alert.alert('Error', 'Please sign in again.');
      return;
    }

    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: 'profile.jpg',
      type: 'image/jpeg',
    });

    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/api/users/media/profile'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const payload = await response.json();
      const nextUserData = {
        ...user,
        photoURL: payload.imageUrl,
      };

      await persistStoredUser(nextUserData);
      setUserData(nextUserData);
      seProfileImage(imageUri);
      Alert.alert('Success', 'Profile image uploaded successfully.');
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Error', 'Could not upload the profile image.');
    } finally {
      setLoading(false);
    }
  };

const handleLaunce = async () => {
   setIsChangeProfle(false);
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (!result.canceled && result.assets?.length) {
    const imageUri = result.assets[0].uri;
    await uploadProfileImage(imageUri);
  }
};

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(FIREBASE_AUTH);
      await clearStoredUser();
      router.replace('/signin'); // Navigate to signin screen
    } catch (error) {
      Alert.alert('Error', 'Failed to log out. Try again.');
      console.error('Logout error:', error);
    }finally{
      setLoading(false);
    }
  };

  const requestCameraPermission = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.error("Error requesting camera permission:", err);
      return false;
    }
  };

  const handleUseCamera = async () => {
 setIsChangeProfle(false);
    const status = await requestCameraPermission();

    if (status) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        base64: false,
        exif: true,
        cameraType: ImagePicker.CameraType.front,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        await uploadProfileImage(imageUri);
      }
    }
  };
  const handleSetProfile = () => {
    setIsChangeProfle(!isChangeProfile);
  }
  //displayName": "", "emai
  const name = userData?.displayName || "User";
  return (
    //the modal coming from react native library helps us to easily achieve side bar behavior
    <Modal
      isVisible={visible}
      animationIn="slideInRight"
      animationOut="slideOutRight"
      backdropOpacity={0.7}
      onBackdropPress={onClose}

      style={styles.modal}
    >
      <View style={styles.modalContainer}>
        {/*the backgrond layer for profile cover which is startic  */}
        <View style={styles.img_container}>
          <Image
            source={require('../app/assets/images/profile-bg.png')}
            style={styles.bg_image}
          />
        </View>


        <View style={styles.top_cover}></View>
        <TouchableOpacity onPress={() => { handleSetProfile() }} style={styles.edit_profileImage}>
          <Image
            source={require('../app/assets/icons/edit-camera.png')}
            style={{ width: 30, height: 30, resizeMode: 'contain' }}
          />
        </TouchableOpacity>

        <View style={styles.profile}>
          <Image
            source={ userData?.photoURL ? { uri: userData.photoURL } : require('../app/assets/icons/profile.png')}
            style={{ width: 110, height: 110, resizeMode: 'contentFit' }}
          />
        </View>
        <TouchableOpacity style={styles.btn} onPress={onClose} >
          <Image
            source={require('../app/assets/icons/close.png')}
            style={{
              resizeMode: 'center',
              width: 25,
              height: 25,
              tintColor: 'white',

            }}
          />

        </TouchableOpacity>
        <Text style={{
          top: 200,
          color: 'grey',

        }}>user infor</Text>
        <View style={styles.infoContainer}>

          <Text style={{ color: '#1B0333' }}>Name  : {name}</Text>
          <Text style={{ color: '#1B0333' }}>Email :{userData ? userData.email : "no email"} </Text>
          <Text style={{ color: '#1B0333' }}>Phone : </Text>


        </View>
        {isChangeProfile && (
          <View style={styles.changingProfile}>
            <TouchableOpacity onPress={handleUseCamera} style={styles.selectionBtn}>
              <Image
                source={require('../app/assets/icons/take-photo.png')}
                style={{
                  resizeMode: 'contain',
                  width: 60,
                  height: 60,
                }}
              />
              <Text style={{
                color: '#8686DB',
                position: 'absolute',
                top: 60,
                alignSelf: 'center'

              }}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleLaunce()} style={styles.selectionBtn}>
              <Image
                source={require('../app/assets/icons/gallery.png')}
                style={{
                  resizeMode: 'contain',
                  width: 60,
                  height: 60,
                  borderColor: 'white',
                  borderWidth: 2,
                }}
              />
              <Text style={{
                color: '#8686DB',
                position: 'absolute',
                top: 60,
                alignSelf: 'center'

              }}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleSetProfile(false)} style={styles.selectionBtn}>
              <Image
                source={require('../app/assets/icons/cancel.png')}
                style={{
                  resizeMode: 'contain',
                  width: 60,
                  height: 60,
                }}
              />

              <Text style={{
                color: '#8686DB',
                position: 'absolute',
                top: 60,
                alignSelf: 'center'

              }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity onPress={() => {logout()}} style={styles.logout}>
          <Image
            source={require('../app/assets/icons/logout.png')}
            style={{ width: 35, height: 45, resizeMode: 'contain', tintColor: 'red' }}
          />
          <Text style={{ color: 'red', fontSize: 20, marginTop: 10 }}>Logout</Text>
        </TouchableOpacity>
      </View>

    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0, // removes default margin
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  modalContainer: {
    backgroundColor: 'white',
    width: '70%',
    height: '100%',
    overflow: 'hidden',
    paddingTop: 50,
    paddingHorizontal: 20,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  top_cover: {
    width: 400,
    height: 50,
    backgroundColor: 'white',
    position: 'absolute',
    top: 180,
    marginLeft: -10,
    borderTopLeftRadius: 50,


  },
  btn: {
    width: 30,
    height: 30,
    position: 'absolute',
    top: 20,
    left: 20,

  },
  img_container: {
    width: 500,
    height: 200,
    position: 'absolute',
    padding: 0,
    margin: 0,

  },
  bg_image: {
    width: '70%',
    resizeMode: 'cover',
    height: '100%',
    position: 'absolute',
    top: 0,


  },
  profile: {
    width: 120,
    height: 120,
    backgroundColor: 'white',
    borderRadius: 60,
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    borderColor: '#8686DB',
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  edit_profileImage: {
    width: 50,
    height: 50,
    backgroundColor: 'white',
    position: 'absolute',
    top: 160,
    left: '70%',
    zIndex: 1,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#8686DB',

  },
  changingProfile: {
    width: '99%',
    height: 100,
    backgroundColor: '#EBF9FF',
    position: 'absolute',
    top: 260,
    alignSelf: 'center',
    zIndex: 11,
    borderRadius: 10,
    shadowColor: 'black',
    shadowOffset: 10,
    shadowOpacity: 1,
    display: 'flex',
    flexDirection: 'row',
    gap: 30,

    justifyContent: 'center',

  },
  selectionBtn: {
    width: 60,
    height: 60,
    marginTop: 12
  },
  infoContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#E6E6E6',
    position: 'absolute',
    top: 280,
    alignSelf: 'center',
    borderRadius: 10,
    display: 'flex',
    gap: 10,
    padding: 20,
    justifyContent: 'center',
  },
  logout: {
    width: '100%',
    height: 50,

    position: 'absolute',
    top: '90%',
    left: '10%',
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
    alignContent: 'center',
  },
});
