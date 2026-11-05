// 📄 CalendarScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Feather } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AnimatedFAB from '../AnimatedFAB';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { auth, db } from '../firebaseconfig';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function CalendarScreen() {
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [isExpanded, setIsExpanded] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  
  const user = auth.currentUser;

  // Get today's date in YYYY-MM-DD format
  function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Fetch transactions for selected date
  const fetchTransactionsForDate = async (dateString) => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Create start and end of day timestamps
      const startOfDay = new Date(dateString);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(dateString);
      endOfDay.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, `users/${user.uid}/transactions`),
        where('date', '>=', startOfDay),
        where('date', '<=', endOfDay),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const transactions = [];
      let incomeSum = 0;
      let expenseSum = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const transaction = {
          id: doc.id,
          ...data,
          // Convert Firestore timestamp to Date
          dateTime: data.date.toDate(),
        };
        
        transactions.push(transaction);
        
        // Calculate totals
        if (data.type === 'income') {
          incomeSum += parseFloat(data.amount);
        } else if (data.type === 'expense') {
          expenseSum += parseFloat(data.amount);
        }
      });

      setRecords(transactions);
      setTotalIncome(incomeSum);
      setTotalExpense(expenseSum);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch transactions when date changes or screen focuses
  useEffect(() => {
    if (user) {
      fetchTransactionsForDate(selectedDate);
    }
  }, [selectedDate, user]);

  // Refresh data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchTransactionsForDate(selectedDate);
      }
    }, [selectedDate, user])
  );

  // Get category icon using Material Icons (same as ExpenseTracker)
  const getCategoryIcon = (category, type) => {
    const iconMap = {
      // รายรับ
      'เงินเดือน': 'attach-money',
      'เงินโบนัส': 'star',
      'รายได้เสริม': 'add-business',
      'เงินปันผล': 'trending-up',
      
      // รายจ่าย
      'ค่าอาหารและเครื่องดื่ม': 'restaurant',
      'ค่าน้ำ': 'water-drop',
      'ค่าไฟ': 'bolt',
      'ค่าบ้าน': 'home',
      'ค่าเดินทาง': 'directions-car',
      'ค่าอินเตอร์เน็ต': 'wifi',
      'ค่าช้อปปิ้ง': 'shopping-cart',
      'ค่าอื่นๆ': 'more-horiz',
    };

    return iconMap[category] || (type === 'income' ? 'attach-money' : 'shopping-cart');
  };

  // Format time from date
  const getTimeFromDate = (date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH').format(amount);
  };

  const renderTransactionItem = ({ item }) => (
    <View style={styles.recordItem}>
      <View style={styles.recordHeader}>
        <View style={styles.recordTimeContainer}>
          <Text style={styles.recordTime}>
            เมื่อเวลา {getTimeFromDate(item.dateTime)}
          </Text>
          <Text style={styles.recordWallet}>
            📱 {item.wallet}
          </Text>
        </View>
      </View>
      
      <View style={styles.recordContent}>
        <View style={styles.recordLeft}>
          <Icon
            name={getCategoryIcon(item.category, item.type)}
            size={24}
            color={item.type === 'income' ? '#22C55E' : '#EF4444'}
          />
          <View style={styles.recordInfo}>
            <Text style={styles.recordTitle}>{item.category}</Text>
            {item.description ? (
              <Text style={styles.recordDescription}>{item.description}</Text>
            ) : null}
          </View>
        </View>
        
        <Text style={[
          styles.recordAmount,
          { color: item.type === 'income' ? '#22C55E' : '#EF4444' }
        ]}>
          {item.type === 'income' ? '+' : '-'}฿{formatCurrency(item.amount)}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="#EFE8CE" />
      
      {/* Header วันที่ */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {formatDateThai(selectedDate)}
        </Text>
      </View>

      {/* ปฎิทิน */}
      <Calendar
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{
          [selectedDate]: { selected: true, selectedColor: '#C4D69F' },
        }}
        theme={{
          backgroundColor: '#EFE8CE',
          calendarBackground: '#EFE8CE',
          todayTextColor: '#22C55E',
        }}
      />

      {/* สรุปรายรับ/รายจ่าย */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>รายรับ</Text>
          <Text style={[styles.summaryText, { color: '#22C55E' }]}>
            ฿{formatCurrency(totalIncome)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>รายจ่าย</Text>
          <Text style={[styles.summaryText, { color: '#EF4444' }]}>
            ฿{formatCurrency(totalExpense)}
          </Text>
        </View>
      </View>

      {/* ประวัติรายการ */}
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>ประวัติการบันทึก</Text>
        <Text style={styles.historyCount}>{records.length} รายการ</Text>
      </View>

      {/* Loading indicator */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C4D69F" />
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        </View>
      ) : (
        <>
          {/* รายการ */}
          {records.length > 0 ? (
            <FlatList
              data={records}
              keyExtractor={(item) => item.id}
              renderItem={renderTransactionItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="event-note" size={48} color="#ccc" />
              <Text style={styles.emptyText}>ไม่มีรายการในวันนี้</Text>
              <Text style={styles.emptySubText}>
                เริ่มบันทึกรายรับรายจ่ายของคุณได้เลย
              </Text>
            </View>
          )}
        </>
      )}

      {/* ปุ่มลอย */}
      <AnimatedFAB
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        onPressMain={() => {}}
        onPressRed={() => navigation.navigate('Expenses')}
        onPressGreen={() => navigation.navigate('Income')}
      />
    </SafeAreaView>
  );
}

// 🧠 ฟังก์ชันแปลงวันที่
function formatDateThai(dateString) {
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const date = new Date(dateString);
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day < 10 ? '0' + day : day} ${month} ${year}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFE8CE',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  header: {
    backgroundColor: '#E7E7C2',
    paddingVertical: 15,
    alignItems: 'center',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },

  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  historyCount: {
    fontSize: 14,
    color: '#555',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  listContainer: {
    paddingBottom: 100,
  },

  recordItem: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  recordHeader: {
    marginBottom: 4,
  },
  recordTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordTime: {
    fontSize: 12,
    color: '#666',
  },
  recordWallet: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },

  recordContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recordInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recordTitle: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  recordDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  recordAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
});