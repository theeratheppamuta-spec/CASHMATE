import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  Vibration,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../firebaseconfig';
import { collection, getDocs, query, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

// ตั้งค่า notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function AddBudgetScreen() {
  const navigation = useNavigation();
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState('');
  const [category, setCategory] = useState('ค่าอาหารและเครื่องดื่ม');
  const [availableWallets, setAvailableWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [sound, setSound] = useState();
  
  const user = auth.currentUser;

  // หมวดหมู่รายจ่ายพร้อมไอคอน (เหมือน ExpensesScreen)
  const categories = [
    { label: 'ค่าอาหารและเครื่องดื่ม', value: 'ค่าอาหารและเครื่องดื่ม', icon: '🲲' },
    { label: 'ค่าน้ำ', value: 'ค่าน้ำ', icon: '💧' },
    { label: 'ค่าไฟ', value: 'ค่าไฟ', icon: '⚡' },
    { label: 'ค่าบ้าน', value: 'ค่าบ้าน', icon: '🏠' },
    { label: 'ค่าเดินทาง', value: 'ค่าเดินทาง', icon: '🚗' },
    { label: 'ค่าอินเตอร์เน็ต', value: 'ค่าอินเตอร์เน็ต', icon: '🌐' },
    { label: 'ค่าช็อปปิ้ง', value: 'ค่าช็อปปิ้ง', icon: '🛒' },
    { label: 'ค่าอื่นๆ', value: 'ค่าอื่นๆ', icon: '❓' },
  ];

  useEffect(() => {
    if (user) {
      fetchWallets();
      requestNotificationPermission();
    } else {
      Alert.alert('ข้อผิดพลาด', 'ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      navigation.navigate('Login');
    }

    // Cleanup sound on unmount
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [user, navigation, sound]);

  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permission denied');
    }
  };

  const playNotificationSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/Add.mp3') // หรือใช้เสียงจาก system
      );
      setSound(sound);
      await sound.playAsync();
    } catch (error) {
      // หากไม่มีไฟล์เสียง จะใช้ vibration แทน
      Vibration.vibrate([0, 250, 250, 250]);
    }
  };

  const showNotification = async (title, body) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // แสดงทันที
    });
    
    // เล่นเสียงและสั่น
    await playNotificationSound();
    Vibration.vibrate(200);
  };

  const fetchWallets = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, `users/${user.uid}/accounts`));
      const querySnapshot = await getDocs(q);
      const wallets = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { label: data.name, value: data.name };
      });
      setAvailableWallets(wallets);
      if (wallets.length > 0) {
        setWallet(wallets[0].value);
      }
    } catch (error) {
      console.error('Error fetching wallets:', error);
      await showNotification('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลบัญชีได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBudget = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      await showNotification('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกจำนวนเงินที่ถูกต้องและมากกว่า 0');
      return;
    }

    if (!wallet) {
      await showNotification('ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกบัญชี');
      return;
    }

    if (!category) {
      await showNotification('ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกหมวดหมู่');
      return;
    }

    if (!user) {
      await showNotification('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบก่อน');
      return;
    }

    try {
      const budgetAmount = parseFloat(amount);
      
      // ใช้ composite key: wallet_category เป็น document ID
      const docId = `${wallet}_${category}`;
      const categoryRef = doc(db, `users/${user.uid}/expense_categories`, docId);
      
      // ตรวจสอบข้อมูลหมวดหมู่ที่มีอยู่
      const categoryDoc = await getDoc(categoryRef);
      let existingData = { totalAmount: 0, count: 0 };
      if (categoryDoc.exists()) {
        existingData = categoryDoc.data();
      }

      // อัปเดตหรือสร้างเอกสารใหม่
      await setDoc(categoryRef, {
        category: category,
        wallet: wallet,
        budget: budgetAmount,
        lastUpdated: Timestamp.now(),
        totalAmount: existingData.totalAmount || 0,
        count: existingData.count || 0,
      }, { merge: true });

      // แสดง notification แทน toast
      await showNotification(
        'บันทึกสำเร็จ!', 
        `เพิ่มงบประมาณ ${budgetAmount.toLocaleString()} บาท ในหมวด ${category}`
      );

      // Reset form
      setAmount('');

      // กลับไปหน้าหลักหลังจาก delay เล็กน้อย
      setTimeout(() => {
        navigation.goBack();
      }, 1500);

    } catch (error) {
      console.error('Error adding budget:', error);
      await showNotification('ข้อผิดพลาด', 'ไม่สามารถบันทึกงบประมาณได้');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#EF4444" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>เพิ่มงบประมาณ</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        
        {/* จำนวนเงิน */}
        <View style={[styles.section, styles.inlineSection]}>
          <Text style={styles.inlineLabel}>จำนวน</Text>
          <View style={styles.amountInputContainer}>
            <TextInput
              style={styles.amountInput}
              placeholder="จำนวนเงินงบประมาณ (฿)"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <View style={styles.bankIcon}>
              <Text style={{ fontSize: 20 }}>💵</Text>
            </View>
          </View>
        </View>

        {/* เลือกบัญชี */}
        <View style={styles.section}>
          <Text style={styles.label}>บัญชี</Text>
          <View style={styles.walletContainer}>
            <Ionicons name="wallet" size={24} color="black" />
            <Picker
              selectedValue={wallet}
              onValueChange={(itemValue) => setWallet(itemValue)}
              style={styles.picker}
            >
              {availableWallets.length === 0 ? (
                <Picker.Item label="ไม่มีบัญชี" value="" />
              ) : (
                availableWallets.map((w, index) => (
                  <Picker.Item key={index} label={w.label} value={w.value} />
                ))
              )}
            </Picker>
          </View>
        </View>

        {/* เลือกหมวดหมู่ */}
        <View style={styles.section}>
          <Text style={styles.label}>หมวดหมู่</Text>
          <View style={styles.categoriesWrapper}>
            {categories.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.categoryButton,
                  category === item.value && styles.selectedCategory,
                ]}
                onPress={() => setCategory(item.value)}
              >
                <Text style={styles.categoryIcon}>{item.icon}</Text>
                <Text style={styles.categoryText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ปุ่มบันทึก */}
        <TouchableOpacity style={styles.saveButton} onPress={handleAddBudget}>
          <Text style={styles.saveButtonText}>บันทึก</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Toast แสดงความสำเร็จ */}
      {showToast && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>เพิ่มงบประมาณสำเร็จ</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EFE8CE',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#8eab3eff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  container: {
    padding: 15,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inlineSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginRight: 10,
    width: 60,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 10,
  },
  amountInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    marginRight: 10,
  },
  bankIcon: {
    backgroundColor: '#CDE4C6',
    padding: 6,
    borderRadius: 6,
  },
  walletContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  picker: {
    flex: 1,
  },
  categoriesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 5,
  },
  selectedCategory: {
    backgroundColor: '#c8dc8f',
  },
  categoryIcon: {
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#8eab3eff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 25,
    elevation: 5,
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});