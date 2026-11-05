// screens/ManageBudgetsScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { collection, addDoc, deleteDoc, doc, getDocs, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebaseconfig';

export default function ManageBudgetsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ตรวจสอบผู้ใช้และดึงข้อมูลงบประมาณ
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadBudgets(currentUser.uid);
      } else {
        navigation.navigate('Login');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [navigation]);

  // ดึงข้อมูลงบประมาณแบบ real-time
  const loadBudgets = (userId) => {
    const budgetsQuery = query(
      collection(db, 'budgets'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(budgetsQuery, (snapshot) => {
      const budgetsData = [];
      snapshot.forEach((doc) => {
        budgetsData.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // จัดเรียงตาม createdAt
      budgetsData.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        }
        return 0;
      });

      setBudgets(budgetsData);
    }, (error) => {
      console.error('Error loading budgets:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถโหลดข้อมูลงบประมาณได้');
    });

    return unsubscribe;
  };

  // ฟังก์ชันจัดรูปแบบวันที่
  const formatDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return 'ไม่ระบุ';
    
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
    
    const startStr = `${start.getDate()} ${getThaiMonth(start.getMonth())} ${start.getFullYear()}`;
    const endStr = `${end.getDate()} ${getThaiMonth(end.getMonth())} ${end.getFullYear()}`;
    
    return `${startStr} - ${endStr}`;
  };

  const getThaiMonth = (month) => {
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    return months[month];
  };

  // ฟังก์ชันจัดรูปแบบตัวเลข
  const formatNumber = (number) => {
    if (!number) return '0.00';
    return Number(number).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // รีเซ็ตฟอร์ม
  const resetForm = () => {
    setBudgetName('');
    setBudgetAmount('');
    setStartDate('');
    setEndDate('');
    setEditingBudget(null);
  };

  // เพิ่มงบประมาณใหม่
  const addBudget = async () => {
    if (!budgetName.trim()) {
      Alert.alert('กรุณากรอกชื่องบประมาณ');
      return;
    }

    if (!budgetAmount.trim() || isNaN(parseFloat(budgetAmount))) {
      Alert.alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
      return;
    }

    try {
      // สร้างช่วงวันที่เริ่มต้น (เดือนปัจจุบัน)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      await addDoc(collection(db, 'budgets'), {
        name: budgetName.trim(),
        amount: parseFloat(budgetAmount),
        spent: 0,
        startDate: startOfMonth,
        endDate: endOfMonth,
        userId: user.uid,
        createdAt: new Date(),
      });

      resetForm();
      setShowAddModal(false);
      Alert.alert('สำเร็จ', 'เพิ่มงบประมาณเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error adding budget:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถเพิ่มงบประมาณได้');
    }
  };

  // แก้ไขงบประมาณ
  const editBudget = async () => {
    if (!budgetName.trim()) {
      Alert.alert('กรุณากรอกชื่องบประมาณ');
      return;
    }

    if (!budgetAmount.trim() || isNaN(parseFloat(budgetAmount))) {
      Alert.alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
      return;
    }

    try {
      await updateDoc(doc(db, 'budgets', editingBudget.id), {
        name: budgetName.trim(),
        amount: parseFloat(budgetAmount),
        updatedAt: new Date(),
      });

      resetForm();
      setShowEditModal(false);
      Alert.alert('สำเร็จ', 'แก้ไขงบประมาณเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error updating budget:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถแก้ไขงบประมาณได้');
    }
  };

  // ลบงบประมาณ
  const deleteBudget = (budgetId, budgetName) => {
    Alert.alert(
      'ยืนยันการลบ',
      `คุณแน่ใจหรือไม่ว่าต้องการลบงบประมาณ "${budgetName}"?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'budgets', budgetId));
              Alert.alert('สำเร็จ', 'ลบงบประมาณเรียบร้อยแล้ว');
            } catch (error) {
              console.error('Error deleting budget:', error);
              Alert.alert('ผิดพลาด', 'ไม่สามารถลบงบประมาณได้');
            }
          },
        },
      ]
    );
  };

  // เปิดโมดอลแก้ไข
  const openEditModal = (budget) => {
    setEditingBudget(budget);
    setBudgetName(budget.name);
    setBudgetAmount(budget.amount.toString());
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerContainer}>
          <Text>กำลังโหลด...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>จัดการงบประมาณ</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container}>
        {/* แสดงรายการงบประมาณ */}
        <View style={styles.budgetsList}>
          {budgets.map((budget, index) => {
            const percentage = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
            const remaining = budget.amount - budget.spent;
            
            return (
              <View key={budget.id} style={styles.budgetCard}>
                <View style={styles.budgetLeft}>
                  <Text style={styles.budgetNumber}>{index}</Text>
                </View>
                
                <View style={styles.budgetContent}>
                  <View style={styles.budgetHeader}>
                    <MaterialCommunityIcons name="calendar" size={16} color="#666" />
                    <Text style={styles.budgetDate}>
                      {formatDateRange(budget.startDate, budget.endDate)}
                    </Text>
                  </View>
                  <Text style={styles.budgetTitle}>{budget.name}</Text>
                  <Text style={styles.budgetAmount}>
                    งบประมาณ ฿{formatNumber(budget.amount)}
                  </Text>
                </View>

                <View style={styles.budgetActions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => openEditModal(budget)}
                  >
                    <MaterialCommunityIcons name="pencil" size={20} color="#666" />
                  </Pressable>
                  
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => deleteBudget(budget.id, budget.name)}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={20} color="#666" />
                  </Pressable>
                  
                  <Pressable style={styles.actionBtn}>
                    <MaterialCommunityIcons name="menu" size={20} color="#666" />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* ปุ่มเพิ่มงบประมาณ */}
        <Pressable 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#666" />
          <Text style={styles.addButtonText}>เพิ่มรายการงบประมาณ</Text>
        </Pressable>
      </ScrollView>

      {/* Modal เพิ่มงบประมาณ */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>เพิ่มงบประมาณใหม่</Text>
            
            <TextInput
              style={styles.input}
              placeholder="ชื่องบประมาณ"
              value={budgetName}
              onChangeText={setBudgetName}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder="จำนวนเงิน"
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelBtnText}>ยกเลิก</Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, styles.addBtn]}
                onPress={addBudget}
              >
                <Text style={styles.addBtnText}>เพิ่ม</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal แก้ไขงบประมาณ */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowEditModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>แก้ไขงบประมาณ</Text>
            
            <TextInput
              style={styles.input}
              placeholder="ชื่องบประมาณ"
              value={budgetName}
              onChangeText={setBudgetName}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder="จำนวนเงิน"
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowEditModal(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelBtnText}>ยกเลิก</Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={editBudget}
              >
                <Text style={styles.saveBtnText}>บันทึก</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#EFE8CE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#EFE8CE',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#EFE8CE',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetsList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  budgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  budgetLeft: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  budgetNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  budgetContent: {
    flex: 1,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  budgetDate: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  budgetTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  budgetAmount: {
    fontSize: 14,
    color: '#666',
  },
  budgetActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 8,
    marginLeft: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f3f4f6',
  },
  addBtn: {
    backgroundColor: '#D4B896',
  },
  saveBtn: {
    backgroundColor: '#4CAF50',
  },
  cancelBtnText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});