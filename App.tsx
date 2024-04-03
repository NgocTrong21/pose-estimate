import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
// import {CustomTensorCamera} from './src/CustomTensorCamera';
import {Camera} from 'expo-camera';
import React from 'react';
import {CameraMovenet} from './src/CameraMovenet';
export default function App() {
  const [permission, requestPermission] = Camera.useCameraPermissions();

  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      {/* <VisionCamera /> */}
      <TouchableOpacity
        onPress={requestPermission}
        style={styles.requestCamera}>
        <Text>Request permission</Text>
      </TouchableOpacity>
      {/* {permission?.status && (
        <CustomTensorCamera style={styles.camera} key={'tensorCamera'} />
      )} */}
      {permission?.status && <CameraMovenet />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  requestCamera: {
    borderWidth: 2,
    backgroundColor: 'red',
    borderRadius: 20,
    padding: 10,
  },
});
