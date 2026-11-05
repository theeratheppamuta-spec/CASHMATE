import React, { useEffect, useState } from 'react';
import { View, Image, Animated, Easing } from 'react-native';
import Navigator from './Nav/Navigator';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start(() => setIsLoading(false));
  }, [fadeAnim, scaleAnim]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#c8dc8f' }}>
        <Animated.Image
          source={require('./photo/Logo.png')}
          style={{
            width: 350,
            height: 350,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return <Navigator />;
}