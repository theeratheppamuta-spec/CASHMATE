// AddAccountScreen.js (ปรับ incomeCategories และ expenseCategories ให้ตรงตามที่ระบุ, เพิ่ม icon ใน render ถ้าต้องการ แต่เนื่องจากเป็น switch, ไม่มี icon ใน UI แต่ DB จะสร้างตามนี้)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Switch,
  Platform,
  StatusBar,
  Vibration,
} from 'react-native';
import { auth, db } from '../firebaseconfig';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  Timestamp,
  getDocs 
} from 'firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Ionicons } from '@expo/vector-icons';
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

export default function AddAccountScreen({ navigation }) {
  const [accountName, setAccountName] = useState('');
  const [accountDescription, setAccountDescription] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [selectedIncomeCategories, setSelectedIncomeCategories] = useState([]);
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState([]);
  const [isIncomeSelected, setIsIncomeSelected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [sound, setSound] = useState();

  const user = auth.currentUser;

  // หมวดหมู่เริ่มต้นสำหรับรายรับ (4 หมวดหมู่)
  const incomeCategories = [
    'เงินเดือน',
    'เงินโบนัส',
    'รายได้เสริม',
    'เงินปันผล',
  ];

  // หมวดหมู่เริ่มต้นสำหรับรายจ่าย (8 หมวดหมู่)
  const expenseCategories = [
    'ค่าอาหารและเครื่องดื่ม',
    'ค่าน้ำ',
    'ค่าไฟ',
    'ค่าบ้าน',
    'ค่าเดินทาง',
    'ค่าอินเตอร์เน็ต',
    'ค่าช้อปปิ้ง',
    'ค่าอื่นๆ',
  ];

  useEffect(() => {
    if (user) {
      loadExistingCategories();
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

  const loadExistingCategories = async () => {
    try {
      const categoriesRef = collection(db, `users/${user.uid}/categories`);
      const querySnapshot = await getDocs(categoriesRef);
      const loadedCategories = querySnapshot.docs.map(doc => doc.data());
      const incomeCats = loadedCategories.filter(cat => cat.type === 'income').map(cat => cat.name);
      const expenseCats = loadedCategories.filter(cat => cat.type === 'expense').map(cat => cat.name);
      setSelectedIncomeCategories(incomeCats);
      setSelectedExpenseCategories(expenseCats);
    } catch (error) {
      console.error('Error loading categories:', error);
      await showNotification('ข้อผิดพลาด', 'ไม่สามารถโหลดหมวดหมู่เดิมได้');
    }
  };

  const toggleCategory = (category, type) => {
    const setFunction = type === 'income' ? setSelectedIncomeCategories : setSelectedExpenseCategories;
    setFunction(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const createAccountCategories = async (accountId) => {
    const categoriesRef = collection(db, `users/${user.uid}/accounts/${accountId}/categories`);
    const promises = [];
    selectedIncomeCategories.forEach(category => {
      promises.push(setDoc(doc(categoriesRef), {
        name: category,
        type: 'income',
        defaultBudget: getDefaultBudget(category),
        defaultTarget: getDefaultTarget(category),
        createdAt: Timestamp.now(),
      }));
    });
    selectedExpenseCategories.forEach(category => {
      promises.push(setDoc(doc(categoriesRef), {
        name: category,
        type: 'expense',
        defaultBudget: getDefaultBudget(category),
        defaultTarget: getDefaultTarget(category),
        createdAt: Timestamp.now(),
      }));
    });
    await Promise.all(promises);
  };

  const getDefaultBudget = (category) => {
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
    return defaultBudgets[category] || 0;
  };

  const getDefaultTarget = (category) => {
    const defaultTargets = {
      'เงินเดือน': 30000,
      'เงินโบนัส': 10000,
      'รายได้เสริม': 15000,
      'เงินปันผล': 5000,
    };
    return defaultTargets[category] || 0;
  };

  const handleCreateAccount = async () => {
    if (isLoading) return;

    if (!accountName.trim()) {
      await showNotification('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อบัญชี');
      return;
    }

    if (selectedIncomeCategories.length === 0 || selectedExpenseCategories.length === 0) {
      await showNotification('ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกอย่างน้อยหนึ่งหมวดหมู่สำหรับรายรับและรายจ่าย');
      return;
    }

    setIsLoading(true);

    try {
      const accountsRef = collection(db, `users/${user.uid}/accounts`);
      const accountDoc = await addDoc(accountsRef, {
        name: accountName,
        description: accountDescription,
        initialBalance: parseFloat(initialBalance) || 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      await createAccountCategories(accountDoc.id);

      if (parseFloat(initialBalance) > 0) {
        const transactionsRef = collection(db, `users/${user.uid}/transactions`);
        await addDoc(transactionsRef, {
          amount: parseFloat(initialBalance),
          category: 'ยอดเริ่มต้น',
          date: Timestamp.now(),
          description: `ยอดเงินเริ่มต้นสำหรับบัญชี ${accountName}`,
          type: 'income',
          wallet: accountName,
          createdAt: Timestamp.now(),
        });
      }

      // แสดง notification เมื่อเพิ่มบัญชีสำเร็จ
      await showNotification(
        'เพิ่มบัญชีสำเร็จ!', 
        `เพิ่มบัญชี "${accountName}" เรียบร้อยแล้ว\nหมวดหมู่รายรับ: ${selectedIncomeCategories.length} หมวดหมู่\nหมวดหมู่รายจ่าย: ${selectedExpenseCategories.length} หมวดหมู่`
      );

      // กลับไปหน้า Home หลังจาก notification แสดงเสร็จ
      setTimeout(() => {
        navigation.navigate('MainTabs');
      }, 2000);

    } catch (error) {
      console.error('Error creating account:', error);
      await showNotification('ข้อผิดพลาด', 'ไม่สามารถเพิ่มบัญชีได้ กรุณาลองอีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCategorySection = (title, categories, selected, onToggle) => (
    <View style={styles.categorySection}>
      {categories.map(category => (
        <View key={category} style={styles.categoryItem}>
          <Switch
            onValueChange={() => onToggle(category, title.includes('รายรับ') ? 'income' : 'expense')}
            value={selected.includes(category)}
          />
          <Text style={styles.categoryText}>{category}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EFE8CE" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>เพิ่มบัญชี</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อมูลบัญชี</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>ชื่อบัญชี</Text>
            <TextInput
              style={styles.textInput}
              placeholder="เช่น เงินหลัก, เงินสำรอง"
              value={accountName}
              onChangeText={setAccountName}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>คำอธิบาย</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="คำอธิบายเกี่ยวกับบัญชี (ไม่บังคับ)"
              value={accountDescription}
              onChangeText={setAccountDescription}
              multiline
            />
          </View>
        </View>

        <View style={styles.categorySection}>
          <Text style={styles.sectionTitle}>เลือกหมวดหมู่เริ่มต้น</Text>
          <View style={styles.categoryHeader}>
            <TouchableOpacity
              style={[styles.categoryButton, isIncomeSelected && styles.incomeButtonSelected]}
              onPress={() => setIsIncomeSelected(true)}
            >
              <Icon name="add-circle" size={16} color={isIncomeSelected ? "white" : "#22C55E"} />
              <Text style={styles.categoryButtonText}>รายรับ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoryButton, !isIncomeSelected && styles.expenseButtonSelected]}
              onPress={() => setIsIncomeSelected(false)}
            >
              <Icon name="remove-circle" size={16} color={!isIncomeSelected ? "white" : "#EF4444"} />
              <Text style={styles.categoryButtonText}>รายจ่าย</Text>
            </TouchableOpacity>
          </View>
          {isIncomeSelected
            ? renderCategorySection('หมวดหมู่เริ่มต้นรายรับ', incomeCategories, selectedIncomeCategories, toggleCategory)
            : renderCategorySection('หมวดหมู่เริ่มต้นรายจ่าย', expenseCategories, selectedExpenseCategories, toggleCategory)}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>สรุป</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>ชื่อบัญชี:</Text>
            <Text style={styles.summaryValue}>{accountName || 'ยังไม่ได้ตั้งชื่อ'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>หมวดหมู่รายรับ:</Text>
            <Text style={styles.summaryValue}>{selectedIncomeCategories.length} หมวดหมู่</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>หมวดหมู่รายจ่าย:</Text>
            <Text style={styles.summaryValue}>{selectedExpenseCategories.length} หมวดหมู่</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.createButton, isLoading && styles.createButtonDisabled]}
            onPress={handleCreateAccount}
            disabled={isLoading}
          >
            <Text style={styles.createButtonText}>
              {isLoading ? 'กำลังเพิ่ม...' : 'เพิ่มบัญชี'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EFE8CE',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#bd9e67ff',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  placeholder: {
    width: 24,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categorySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
  },
  expenseButtonSelected: {
    backgroundColor: '#EF4444',
  },
  incomeButtonSelected: {
    backgroundColor: '#22C55E',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 4,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 14,
    marginLeft: 8,
  },
  summarySection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  buttonContainer: {
    paddingHorizontal: 16,
  },
  createButton: {
    backgroundColor: '#bd9e67ff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  createButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});