// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';  // เพิ่ม Firestore
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyA0ezSHXv5iPuQN78tBHLJF5wjxCCXwx9I",
  authDomain: "cashmate-97413.firebaseapp.com",
  projectId: "cashmate-97413",
  storageBucket: "cashmate-97413.firebasestorage.app",
  messagingSenderId: "817943651304",
  appId: "1:817943651304:web:2cef5a12d7e11b816ffa5d"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ ใช้ AsyncStorage เพื่อให้สถานะผู้ใช้จำอยู่
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// ✅ เพิ่ม Firestore
export const db = getFirestore(app);