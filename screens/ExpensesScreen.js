// ExpensesScreen.js (แก้ไขให้ดึง wallets จาก DB เหมือน IncomeScreen, ปรับ categories ให้ตรง, เพิ่ม notifications และเสียง)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  Vibration,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { auth, db } from '../firebaseconfig';
import { collection, addDoc, doc, setDoc, increment, Timestamp, getDocs, query } from 'firebase/firestore';
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

export default function ExpensesScreen({ navigation }) {
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState('');
  const [category, setCategory] = useState('ค่าอาหารและเครื่องดื่ม');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [sound, setSound] = useState();

  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      fetchWallets();
      requestNotificationPermission();
    }

    // Cleanup sound on unmount
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permission denied');
    }
  };

  const playNotificationSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/CashsoundEdit.mp3') // หรือใช้เสียงจาก system
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
    }
  };

  const handleAddExpense = async () => {
    if (!amount || isNaN(amount) || !wallet) {
      await showNotification('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกจำนวนเงินและเลือกบัญชี');
      return;
    }

    if (!user) {
      await showNotification('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบก่อน');
      return;
    }

    try {
      const amountNum = parseFloat(amount);
      const transactionData = {
        type: 'expense',
        amount: amountNum,
        wallet,
        category,
        description,
        date: Timestamp.fromDate(date),
        updatedAt: Timestamp.now(),
      };

      // บันทึกลง transactions
      await addDoc(collection(db, `users/${user.uid}/transactions`), transactionData);

      // อัปเดตหรือสร้างหมวดหมู่ใน expense_categories โดยใช้ composite key
      const docId = `${wallet}_${category}`;
      const categoryRef = doc(db, `users/${user.uid}/expense_categories`, docId);
      await setDoc(categoryRef, {
        category,
        wallet,
        totalAmount: increment(amountNum),
        count: increment(1),
        lastUpdated: Timestamp.now(),
        budget: increment(0),
      }, { merge: true });

      // ถ้าต้องการตั้ง default budget สำหรับหมวดหมู่ใหม่
      const defaultBudgets = {
        'ค่าอาหารและเครื่องดื่ม': '',
        'ค่าน้ำ': '',
        'ค่าไฟ': '',
        'ค่าบ้าน': '',
        'ค่าเดินทาง': '',
        'ค่าอินเตอร์เน็ต': '',
        'ค่าช้อปปิ้ง': '',
        'ค่าอื่นๆ': '',
      };

      // ตั้งค่า budget เริ่มต้นหากยังไม่มี
      if (defaultBudgets[category]) {
        await setDoc(categoryRef, {
          budget: defaultBudgets[category],
        }, { merge: true });
      }

      // แสดง notification แทน toast
      await showNotification(
        'บันทึกสำเร็จ!', 
        `เพิ่มรายจ่าย ${amountNum.toLocaleString()} บาท ในหมวด ${category}`
      );

      // Reset form
      setAmount('');
      setDescription('');

      // กลับไปหน้าหลักหลังจาก delay เล็กน้อย
      setTimeout(() => {
        navigation.navigate('MainTabs');
      }, 1500);

    } catch (error) {
      console.error('Error adding expense:', error);
      await showNotification('ข้อผิดพลาด', 'ไม่สามารถบันทึกรายจ่ายได้');
    }
  };

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const categories = [
    { label: 'ค่าอาหารและเครื่องดื่ม', value: 'ค่าอาหารและเครื่องดื่ม', icon: '🍲' },
    { label: 'ค่าน้ำ', value: 'ค่าน้ำ', icon: '💧' },
    { label: 'ค่าไฟ', value: 'ค่าไฟ', icon: '⚡' },
    { label: 'ค่าบ้าน', value: 'ค่าบ้าน', icon: '🏠' },
    { label: 'ค่าเดินทาง', value: 'ค่าเดินทาง', icon: '🚗' },
    { label: 'ค่าอินเตอร์เน็ต', value: 'ค่าอินเตอร์เน็ต', icon: '🌐' },
    { label: 'ค่าช้อปปิ้ง', value: 'ค่าช้อปปิ้ง', icon: '🛒' },
    { label: 'ค่าอื่นๆ', value: 'ค่าอื่นๆ', icon: '❓' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#EF4444" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}> + เพิ่มรายจ่าย</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.section, styles.inlineSection]}>
          <Text style={styles.inlineLabel}>จำนวน</Text>
          <View style={styles.amountInputContainer}>
            <TextInput
              style={styles.amountInput}
              placeholder="จำนวนเงิน (฿)"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <View style={styles.bankIcon}>
              <Text style={{ fontSize: 20 }}>💵</Text>
            </View>
          </View>
        </View>

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

        <View style={styles.section}>
          <Text style={styles.label}>วันที่</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateButtonText}>เลือกวันที่</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode="date"
              is24Hour={true}
              display="default"
              onChange={onChangeDate}
            />
          )}
          <Text style={styles.dateText}>วันที่เลือก: {date.toLocaleDateString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>รายละเอียด</Text>
          <TextInput
            style={styles.input}
            placeholder="รายละเอียดเพิ่มเติม"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleAddExpense}>
          <Text style={styles.saveButtonText}>บันทึก</Text>
        </TouchableOpacity>
      </ScrollView>

      {showToast && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>เพิ่มรายจ่ายสำเร็จ</Text>
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
    backgroundColor: '#d88589ff',
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
    fontWeight: '500',
    color: '#212020ff',
    marginLeft: 12,
  },
  container: {
    padding: 15,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
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
  picker: {
    flex: 1,
  },
  walletContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    borderRadius: 8,
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
    backgroundColor: '#d88589ff',
  },
  categoryIcon: {
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
  },
  input: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  dateButton: {
    backgroundColor: '#BEE3F8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  dateButtonText: {
    color: '#1E3A8A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#d88589ff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 500,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  toastText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
});