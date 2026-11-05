import React, { useEffect } from 'react';
import { TouchableOpacity, Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function AnimatedFAB({ isExpanded, onToggle, onPressMain, onPressRed, onPressGreen }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim1 = React.useRef(new Animated.Value(0)).current;
  const scaleAnim3 = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const toValue = isExpanded ? 1 : 0;

    Animated.timing(fadeAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Animated.timing(rotateAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (isExpanded) {
      Animated.stagger(100, [
        Animated.spring(scaleAnim1, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim3, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.stagger(50, [
        Animated.timing(scaleAnim3, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim1, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isExpanded]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <>
      {/* Overlay */}
      {isExpanded && (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.overlayTouch} onPress={onToggle} />
        </Animated.View>
      )}

      {/* ปุ่มแดง - รายจ่าย */}
      <Animated.View
        style={[
          styles.coloredCircle,
          styles.redCircle,
          { transform: [{ scale: scaleAnim1 }], bottom: 120 },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (isExpanded && onPressRed) {
              onPressRed();
              onToggle();
            }
          }}
          style={styles.innerButton}
        >
          <Feather name="minus" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.label}>รายจ่าย</Text>
      </Animated.View>

      {/* ปุ่มเขียว - รายรับ */}
      <Animated.View
        style={[
          styles.coloredCircle,
          styles.greenCircle,
          { transform: [{ scale: scaleAnim3 }], bottom: 200 }, // ปรับให้ห่างขึ้น
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (isExpanded && onPressGreen) {
              onPressGreen();
              onToggle();
            }
          }}
          style={styles.innerButton}
        >
          <Feather name="plus" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.label}>รายรับ</Text>
      </Animated.View>

      {/* ปุ่มหลัก */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          onToggle();
          if (onPressMain) onPressMain();
        }}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Feather name="plus" size={24} color="white" />
        </Animated.View>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 998,
  },
  overlayTouch: {
    flex: 1,
  },
  coloredCircle: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    right: 30,
  },
  redCircle: {
    backgroundColor: '#EF4444',
  },
  greenCircle: {
    backgroundColor: '#22C55E',
  },
  innerButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    position: 'absolute',
    right: 70,
    backgroundColor: '#ffffffee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    color: '#333',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});
