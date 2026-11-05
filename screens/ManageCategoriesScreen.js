// screens/ManageCategoriesScreen.js
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
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebaseconfig';

const categoryIcons = {
  'ดอกเบี้ย': { name: 'flower-outline', color: '#E91E63' },
  'เงินฝาก': { name: 'bank-outline', color: '#00BCD4' },
  'โบนัส/เงินรางวัล': { name: 'gift-outline', color: '#FF9800' },
  'อื่นๆ': { name: 'folder-outline', color: '#9C27B0' },
  'เงินเดือน/เงินรางวัล': { name: 'cash-multiple', color: '#4CAF50' },
};

export default function ManageCategoriesScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedType, setSelectedType] = useState('รายรับ'); // 'รายรับ' หรือ 'รายจ่าย'

  // ตรวจสอบผู้ใช้และดึงข้อมูลหมวดหมู่
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadCategories(currentUser.uid);
      } else {
        navigation.navigate('Login');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [navigation]);

  // ดึงข้อมูลหมวดหมู่แบบ real-time
  const loadCategories = (userId) => {
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(categoriesQuery, (snapshot) => {
      const categoriesData = [];
      snapshot.forEach((doc) => {
        categoriesData.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // จัดเรียงตาม type และ name
      categoriesData.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'รายรับ' ? -1 : 1;
        }
        return a.name.localeCompare(b.name, 'th');
      });

      setCategories(categoriesData);
    }, (error) => {
      console.error('Error loading categories:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถโหลดข้อมูลหมวดหมู่ได้');
    });

    return unsubscribe;
  };

  // เพิ่มหมวดหมู่ใหม่
  const addCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('กรุณากรอกชื่อหมวดหมู่');
      return;
    }

    // ตรวจสอบว่าชื่อหมวดหมู่ซ้ำหรือไม่
    const existingCategory = categories.find(
      cat => cat.name === newCategoryName.trim() && cat.type === selectedType
    );

    if (existingCategory) {
      Alert.alert('ชื่อหมวดหมู่ซ้ำ', 'กรุณาใช้ชื่ออื่น');
      return;
    }

    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        type: selectedType,
        userId: user.uid,
        createdAt: new Date(),
      });

      setNewCategoryName('');
      setShowAddModal(false);
      Alert.alert('สำเร็จ', 'เพิ่มหมวดหมู่เรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error adding category:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถเพิ่มหมวดหมู่ได้');
    }
  };

  // ลบหมวดหมู่
  const deleteCategory = (categoryId, categoryName) => {
    Alert.alert(
      'ยืนยันการลบ',
      `คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่ "${categoryName}"?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'categories', categoryId));
              Alert.alert('สำเร็จ', 'ลบหมวดหมู่เรียบร้อยแล้ว');
            } catch (error) {
              console.error('Error deleting category:', error);
              Alert.alert('ผิดพลาด', 'ไม่สามารถลบหมวดหมู่ได้');
            }
          },
        },
      ]
    );
  };

  // แสดงไอคอนตามชื่อหมวดหมู่
  const getCategoryIcon = (categoryName, type) => {
    const iconData = categoryIcons[categoryName];
    if (iconData) {
      return (
        <MaterialCommunityIcons 
          name={iconData.name} 
          size={24} 
          color={iconData.color} 
        />
      );
    }
    
    // ไอคอนเริ่มต้นตามประเภท
    return type === 'รายรับ' ? (
      <MaterialCommunityIcons name="plus" size={24} color="#4CAF50" />
    ) : (
      <MaterialCommunityIcons name="minus" size={24} color="#F44336" />
    );
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

  const incomeCategories = categories.filter(cat => cat.type === 'รายรับ');
  const expenseCategories = categories.filter(cat => cat.type === 'รายจ่าย');

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
        <Text style={styles.headerTitle}>จัดการหมวดหมู่</Text>
        <Pressable
          style={styles.gridBtn}
          onPress={() => setShowAddModal(true)}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#000" />
        </Pressable>
      </View>

      <ScrollView style={styles.container}>
        {/* แสดงปุ่มเปลี่ยนประเภท */}
        <View style={styles.typeSelector}>
          <Pressable
            style={[
              styles.typeBtn,
              selectedType === 'รายรับ' && styles.typeBtnActive
            ]}
            onPress={() => setSelectedType('รายรับ')}
          >
            <MaterialCommunityIcons name="plus" size={16} color={selectedType === 'รายรับ' ? '#fff' : '#4CAF50'} />
            <Text style={[
              styles.typeBtnText,
              selectedType === 'รายรับ' && styles.typeBtnTextActive
            ]}>รายรับ</Text>
          </Pressable>

          <Pressable
            style={[
              styles.typeBtn,
              selectedType === 'รายจ่าย' && styles.typeBtnActive
            ]}
            onPress={() => setSelectedType('รายจ่าย')}
          >
            <MaterialCommunityIcons name="minus" size={16} color={selectedType === 'รายจ่าย' ? '#fff' : '#F44336'} />
            <Text style={[
              styles.typeBtnText,
              selectedType === 'รายจ่าย' && styles.typeBtnTextActive
            ]}>รายจ่าย</Text>
          </Pressable>
        </View>

        {/* รายการหมวดหมู่ */}
        <View style={styles.categoriesList}>
          {(selectedType === 'รายรับ' ? incomeCategories : expenseCategories).map((category, index) => (
            <View key={category.id} style={styles.categoryCard}>
              <View style={styles.categoryLeft}>
                <Text style={styles.categoryNumber}>{index}</Text>
              </View>
              
              <View style={styles.categoryContent}>
                <View style={styles.categoryIcon}>
                  {getCategoryIcon(category.name, category.type)}
                </View>
                <Text style={styles.categoryName}>{category.name}</Text>
              </View>

              <View style={styles.categoryActions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {/* TODO: แก้ไข */}}
                >
                  <MaterialCommunityIcons name="pencil" size={20} color="#666" />
                </Pressable>
                
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => deleteCategory(category.id, category.name)}
                >
                  <MaterialCommunityIcons name="delete-outline" size={20} color="#666" />
                </Pressable>
                
                <Pressable style={styles.actionBtn}>
                  <MaterialCommunityIcons name="menu" size={20} color="#666" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* ปุ่มเพิ่มรายการ */}
        <Pressable 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#666" />
          <Text style={styles.addButtonText}>เพิ่มรายการใหม่</Text>
        </Pressable>
      </ScrollView>

      {/* Modal เพิ่มหมวดหมู่ */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>เพิ่มหมวดหมู่ใหม่</Text>
            
            <TextInput
              style={styles.input}
              placeholder="ชื่อหมวดหมู่"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />

            <View style={styles.typeSelector}>
              <Pressable
                style={[
                  styles.typeBtn,
                  selectedType === 'รายรับ' && styles.typeBtnActive
                ]}
                onPress={() => setSelectedType('รายรับ')}
              >
                <MaterialCommunityIcons name="plus" size={16} color={selectedType === 'รายรับ' ? '#fff' : '#4CAF50'} />
                <Text style={[
                  styles.typeBtnText,
                  selectedType === 'รายรับ' && styles.typeBtnTextActive
                ]}>รายรับ</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.typeBtn,
                  selectedType === 'รายจ่าย' && styles.typeBtnActive
                ]}
                onPress={() => setSelectedType('รายจ่าย')}
              >
                <MaterialCommunityIcons name="minus" size={16} color={selectedType === 'รายจ่าย' ? '#fff' : '#F44336'} />
                <Text style={[
                  styles.typeBtnText,
                  selectedType === 'รายจ่าย' && styles.typeBtnTextActive
                ]}>รายจ่าย</Text>
              </Pressable>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowAddModal(false);
                  setNewCategoryName('');
                }}
              >
                <Text style={styles.cancelBtnText}>ยกเลิก</Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, styles.addBtn]}
                onPress={addCategory}
              >
                <Text style={styles.addBtnText}>เพิ่ม</Text>
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
  gridBtn: {
    padding: 8,
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
  typeSelector: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  typeBtnActive: {
    backgroundColor: '#D4B896',
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  typeBtnTextActive: {
    color: '#fff',
  },
  categoriesList: {
    paddingHorizontal: 16,
  },
  categoryCard: {
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
  categoryLeft: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  categoryActions: {
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
});