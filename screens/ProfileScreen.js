// screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseconfig';

const BG = '#EAEDD2';

export default function ProfileScreen({ navigation, route }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [loading, setLoading] = useState(true);

  // ดึงข้อมูลผู้ใช้จาก Firebase Auth และ Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        try {
          // ดึงข้อมูลเพิ่มเติมจาก Firestore
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserProfile(userData);
            setPhotoUri(userData.photoURL || currentUser.photoURL);
          } else {
            // ถ้าไม่มีข้อมูลใน Firestore ใช้ข้อมูลจาก Auth
            setUserProfile({
              username: currentUser.displayName || 'ผู้ใช้',
              email: currentUser.email,
              displayName: currentUser.displayName || 'ผู้ใช้'
            });
            setPhotoUri(currentUser.photoURL);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          // ใช้ข้อมูลจาก Auth เป็น fallback
          setUserProfile({
            username: currentUser.displayName || 'ผู้ใช้',
            email: currentUser.email,
            displayName: currentUser.displayName || 'ผู้ใช้'
          });
          setPhotoUri(currentUser.photoURL);
        }
      } else {
        // ถ้าไม่มี user ให้ไปหน้า Login
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [navigation]);

  // ไปยังหน้าต่าง ๆ
  const goManageCategories = () => navigation?.navigate?.('ManageCategories');
  const goManageBudgets = () => navigation?.navigate?.('ManageBudgets');

  // ออกจากระบบ
  const onSignOut = async () => {
    Alert.alert(
      'ออกจากระบบ',
      'คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?',
      [
        {
          text: 'ยกเลิก',
          style: 'cancel',
        },
        {
          text: 'ออกจากระบบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('ผิดพลาด', 'ไม่สามารถออกจากระบบได้');
            }
          },
        },
      ]
    );
  };

  // อัปเดตรูปโปรไฟล์ใน Firestore
  const updateProfilePhoto = async (newPhotoUri) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: newPhotoUri
      });
      console.log('Profile photo updated successfully');
    } catch (error) {
      console.error('Error updating profile photo:', error);
    }
  };

  // ----- เปลี่ยนรูปโปรไฟล์ (กล้อง/แกลเลอรี) -----
  const requestCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const requestMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const openCamera = async () => {
    const ok = await requestCamera();
    if (!ok) {
      Alert.alert('ต้องการสิทธิ์กล้อง', 'โปรดอนุญาตการใช้งานกล้องก่อน');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!res.canceled) {
      const newUri = res.assets[0].uri;
      setPhotoUri(newUri);
      await updateProfilePhoto(newUri);
    }
  };

  const openGallery = async () => {
    const ok = await requestMedia();
    if (!ok) {
      Alert.alert('ต้องการสิทธิ์รูปภาพ', 'โปรดอนุญาตการเข้าถึงรูปภาพก่อน');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!res.canceled) {
      const newUri = res.assets[0].uri;
      setPhotoUri(newUri);
      await updateProfilePhoto(newUri);
    }
  };

  const onAvatarPress = () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'เปลี่ยนรูปโปรไฟล์',
        'เลือกรูปจากแกลเลอรี (กล้องอาจไม่รองรับบนเว็บ)',
        [
          { text: 'แกลเลอรี', onPress: openGallery },
          { text: 'ยกเลิก', style: 'cancel' },
        ]
      );
      return;
    }
    Alert.alert('เปลี่ยนรูปโปรไฟล์', 'เลือกรูปจากที่ใด', [
      { text: 'กล้อง', onPress: openCamera },
      { text: 'แกลเลอรี', onPress: openGallery },
      { text: 'ยกเลิก', style: 'cancel' },
    ]);
  };
  // -----------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text>กำลังโหลด...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ถ้าไม่มีข้อมูลผู้ใช้
  if (!user || !userProfile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text>ไม่พบข้อมูลผู้ใช้</Text>
        </View>
      </SafeAreaView>
    );
  }

  const defaultAvatar = 'https://images.unsplash.com/photo-1670739368045-7f09844fc862?q=80&w=763&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ส่วนโปรไฟล์: อยู่กลางและขนาดใหญ่ */}
        <View style={styles.headerCenter}>
          <Pressable onPress={onAvatarPress} style={styles.avatarWrap}>
            <Image 
              source={{ uri: photoUri || defaultAvatar }} 
              style={styles.avatar} 
            />
          </Pressable>
          <Text style={styles.name}>
            {userProfile.username || userProfile.displayName || 'ผู้ใช้'}
          </Text>
          <Text style={styles.email}>{userProfile.email}</Text>
        </View>

        {/* กลุ่มเมนู */}
        <View style={styles.menuGroup}>
          <MenuItem
            icon={<MaterialCommunityIcons name="view-grid-outline" size={24} />}
            label="จัดการหมวดหมู่"
            onPress={goManageCategories}
          />
          <Divider />
          <MenuItem
            icon={<MaterialCommunityIcons name="chart-donut" size={24} />}
            label="จัดการงบประมาณ"
            onPress={goManageBudgets}
          />
        </View>

        {/* ปุ่มออกจากระบบ */}
        <View style={styles.signOutWrap}>
          <Pressable
            style={styles.signOutBtn}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            onPress={onSignOut}
          >
            <Text style={styles.signOutText}>ออกจากระบบ</Text>
          </Pressable>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, onPress }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <View style={styles.left}>
        <View style={styles.icon}>{icon}</View>
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#6b7280" />
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#EFE8CE',
  },
  scroll: {
    paddingBottom: 40,
  },
  container: {
    flex: 1,
  },

  // โปรไฟล์กึ่งกลางขนาดใหญ่
  headerCenter: {
    alignItems: 'center',
    paddingTop: 86,
    paddingBottom: 16,
  },
  avatarWrap: {
    width: 200,
    height: 200,
    borderRadius: 120,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  name: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },

  // เมนู
  menuGroup: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  menuRow: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuLabel: {
    fontSize: 16,
    color: '#111827',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginLeft: 16 + 34 + 14,
  },

  // ปุ่มออกจากระบบ (ดีไซน์เดิม แต่อยู่ใต้เมนู)
  signOutWrap: {
    alignItems: 'center',
    marginTop: 16,
  },
  signOutBtn: {
    backgroundColor: '#E53935',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});