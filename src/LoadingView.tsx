import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

export function LoadingView({children}: {children: any}) {
  return (
    <View style={styles.container}>
      <View style={styles.container}>
        <Text style={styles.text}>{children}</Text>
        <ActivityIndicator />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  text: {fontSize: 18, textAlign: 'center', marginRight: 8},
});
