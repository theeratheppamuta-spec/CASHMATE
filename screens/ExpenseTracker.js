import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AnimatedFAB from '../AnimatedFAB';
import { auth, db } from '../firebaseconfig';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

export default function ExpenseTracker() {
  const navigation = useNavigation();
  const route = useRoute();
  const { accountId, accountName } = route.params || {};
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [showIncomeCategories, setShowIncomeCategories] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [rotateAnim] = useState(new Animated.Value(0));
  const [scaleAnim1] = useState(new Animated.Value(0));
  const [scaleAnim2] = useState(new Animated.Value(0));
  const [scaleAnim3] = useState(new Animated.Value(0));
  
  // New state for dropdown
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [dropdownAnim] = useState(new Animated.Value(0));
  
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [dateFilter, setDateFilter] = useState('7days'); // 'today', 'thisMonth', '7days', 'lastMonth', 'thisYear', 'lastYear'
  const [chartData, setChartData] = useState({
    labels: ['Loading...'],
    datasets: [
      { data: [0], color: () => '#22C55E', strokeWidth: 2 },
      { data: [0], color: () => '#EF4444', strokeWidth: 2 }
    ]
  });
  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const user = auth.currentUser;

  // Date filter options
  const dateFilterOptions = [
    { key: 'today', label: 'วันนี้' },
    { key: '7days', label: '7วันล่าสุด' },
    { key: 'thisMonth', label: 'เดือนนี้' },
    { key: 'lastMonth', label: 'เดือนที่แล้ว' },
    { key: 'thisYear', label: 'ปีนี้' },
    { key: 'lastYear', label: 'ปีที่แล้ว' }
  ];

  useEffect(() => {
    console.log('Received params:', { accountId, accountName });
  }, [accountId, accountName]);

  if (!accountId || !accountName) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#EFE8CE" />
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>ไม่พบข้อมูลบัญชี กรุณากลับไปเลือกบัญชีใหม่</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.backButtonText}>กลับไปหน้าหลัก</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  useFocusEffect(
    React.useCallback(() => {
      if (user && accountId) {
        fetchAccountData();
      }
    }, [user, accountId])
  );

  // Apply date filter when dateFilter changes
  useEffect(() => {
    if (transactions.length > 0) {
      applyDateFilter();
    }
  }, [dateFilter, transactions]);

  const applyDateFilter = () => {
    const now = new Date();
    let startDate, endDate;

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
    }

    const filtered = transactions.filter(txn => {
      let txnDate;
      try {
        txnDate = txn.date.toDate ? txn.date.toDate() : new Date(txn.date);
      } catch (e) {
        console.warn('Invalid date in txn:', txn);
        return false;
      }
      return txnDate >= startDate && txnDate <= endDate;
    });

    setFilteredTransactions(filtered);
    calculateTotals(filtered);
    createChartData(filtered);
  };

  const fetchAccountData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await Promise.all([fetchTransactions(), fetchCategories()]);
    } catch (error) {
      console.error('Error fetching account data:', error);
      setErrorMessage('เกิดข้อผิดพลาดในการดึงข้อมูล');
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่ภายหลัง');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const q = query(
        collection(db, `users/${user.uid}/transactions`),
        where('wallet', '==', accountName),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const txns = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        amount: parseFloat(doc.data().amount) || 0
      }));
      setTransactions(txns);
      console.log('Fetched transactions:', txns);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setErrorMessage('ไม่สามารถดึงข้อมูลธุรกรรมได้');
    }
  };

  const fetchCategories = async () => {
    try {
      const expenseQ = query(
        collection(db, `users/${user.uid}/expense_categories`),
        where('wallet', '==', accountName)
      );
      const incomeQ = query(
        collection(db, `users/${user.uid}/income_categories`),
        where('wallet', '==', accountName)
      );
      const [expenseSnapshot, incomeSnapshot] = await Promise.all([getDocs(expenseQ), getDocs(incomeQ)]);
      
      const expenseCats = expenseSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        totalAmount: parseFloat(doc.data().totalAmount) || 0,
        category: doc.data().category || doc.id
      }));
      const incomeCats = incomeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        totalAmount: parseFloat(doc.data().totalAmount) || 0,
        category: doc.data().category || doc.id
      }));
      
      setExpenseCategories(expenseCats);
      setIncomeCategories(incomeCats);
      console.log('Fetched categories - Income:', incomeCats, 'Expense:', expenseCats);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setErrorMessage('ไม่สามารถดึงข้อมูลหมวดหมู่ได้');
    }
  };

  const calculateTotals = (txns) => {
    let income = 0;
    let expense = 0;
    const incomeCatMap = {};
    const expenseCatMap = {};

    txns.forEach(txn => {
      const amount = parseFloat(txn.amount) || 0;
      if (txn.type === 'income') {
        income += amount;
        incomeCatMap[txn.category] = (incomeCatMap[txn.category] || 0) + amount;
      } else if (txn.type === 'expense') {
        expense += amount;
        expenseCatMap[txn.category] = (expenseCatMap[txn.category] || 0) + amount;
      }
    });

    setTotalIncome(income);
    setTotalExpense(expense);

    // Update categories with current period data
    const updatedIncomeCats = incomeCategories.map(cat => ({
      ...cat,
      currentAmount: incomeCatMap[cat.category] || 0
    }));
    const updatedExpenseCats = expenseCategories.map(cat => ({
      ...cat,
      currentAmount: expenseCatMap[cat.category] || 0
    }));

    // Add categories that exist in transactions but not in stored categories
    Object.keys(incomeCatMap).forEach(catName => {
      if (!updatedIncomeCats.find(cat => cat.category === catName)) {
        updatedIncomeCats.push({
          category: catName,
          currentAmount: incomeCatMap[catName],
          totalAmount: 0
        });
      }
    });

    Object.keys(expenseCatMap).forEach(catName => {
      if (!updatedExpenseCats.find(cat => cat.category === catName)) {
        updatedExpenseCats.push({
          category: catName,
          currentAmount: expenseCatMap[catName],
          totalAmount: 0
        });
      }
    });
    
    setIncomeCategories(updatedIncomeCats);
    setExpenseCategories(updatedExpenseCats);
  };

  const createChartData = (txns) => {
    if (txns.length === 0) {
      setChartData({
        labels: ['ไม่มีข้อมูล'],
        datasets: [
          { data: [0], color: () => '#22C55E', strokeWidth: 2 },
          { data: [0], color: () => '#EF4444', strokeWidth: 2 }
        ]
      });
      return;
    }

    const dailyData = {};
    let labels = [];

    // Generate labels based on date filter
    if (dateFilter === 'today') {
      // Show hourly data for today
      const now = new Date();
      for (let i = 0; i < 24; i += 4) {
        const hour = i.toString().padStart(2, '0') + ':00';
        labels.push(hour);
        dailyData[hour] = { income: 0, expense: 0 };
      }
    } else if (dateFilter === '7days') {
      // Show daily data for 7 days
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(now.getDate() - i);
        const dateStr = date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
        labels.push(dateStr);
        dailyData[dateStr] = { income: 0, expense: 0 };
      }
    } else {
      // Show monthly data for longer periods
      const now = new Date();
      let months = [];
      
      if (dateFilter === 'thisMonth' || dateFilter === 'lastMonth') {
        // Show weekly data within the month
        for (let i = 0; i < 4; i++) {
          const weekLabel = `สัปดาห์ ${i + 1}`;
          labels.push(weekLabel);
          dailyData[weekLabel] = { income: 0, expense: 0 };
        }
      } else {
        // Show monthly data for year
        for (let i = 0; i < 12; i++) {
          const monthName = new Date(2024, i).toLocaleDateString('th-TH', { month: 'short' });
          labels.push(monthName);
          dailyData[monthName] = { income: 0, expense: 0 };
        }
      }
    }

    // Process transactions
    txns.forEach(txn => {
      let txnDate;
      try {
        txnDate = txn.date.toDate ? txn.date.toDate() : new Date(txn.date);
      } catch (e) {
        console.warn('Invalid date in txn:', txn);
        return;
      }

      let key;
      if (dateFilter === 'today') {
        const hour = Math.floor(txnDate.getHours() / 4) * 4;
        key = hour.toString().padStart(2, '0') + ':00';
      } else if (dateFilter === '7days') {
        key = txnDate.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
      } else if (dateFilter === 'thisMonth' || dateFilter === 'lastMonth') {
        const weekOfMonth = Math.ceil(txnDate.getDate() / 7);
        key = `สัปดาห์ ${weekOfMonth}`;
      } else {
        key = txnDate.toLocaleDateString('th-TH', { month: 'short' });
      }

      if (dailyData[key]) {
        const amount = parseFloat(txn.amount) || 0;
        if (txn.type === 'income') {
          dailyData[key].income += amount;
        } else if (txn.type === 'expense') {
          dailyData[key].expense += amount;
        }
      }
    });

    const incomeData = labels.map(label => dailyData[label]?.income || 0);
    const expenseData = labels.map(label => dailyData[label]?.expense || 0);

    setChartData({
      labels,
      datasets: [
        { data: incomeData, color: () => '#22C55E', strokeWidth: 2, withDots: true, withScrollableDot: true },
        { data: expenseData, color: () => '#EF4444', strokeWidth: 2, withDots: true, withScrollableDot: true }
      ]
    });
  };

  // Dropdown animation functions
  const toggleDropdown = () => {
    const toValue = showDateDropdown ? 0 : 1;
    setShowDateDropdown(!showDateDropdown);
    
    Animated.spring(dropdownAnim, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const selectDateFilter = (filterKey) => {
    setDateFilter(filterKey);
    toggleDropdown();
  };

  const iconMap = {
    'ค่าอาหารและเครื่องดื่ม': 'restaurant',
    'ค่าน้ำ': 'water-drop',
    'ค่าไฟ': 'bolt',
    'ค่าบ้าน': 'home',
    'ค่าเดินทาง': 'directions-car',
    'ค่าอินเตอร์เน็ต': 'wifi',
    'ค่าช้อปปิ้ง': 'shopping-cart',
    'ค่าอื่นๆ': 'more-horiz',
    'เงินเดือน': 'attach-money',
    'เงินโบนัส': 'star',
    'รายได้เสริม': 'add-business',
    'เงินปันผล': 'trending-up',
  };

  const currentCategories = showIncomeCategories ? incomeCategories : expenseCategories;
  const filteredCategories = currentCategories.filter(cat => (cat.currentAmount || 0) > 0);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>กำลังโหลดข้อมูล...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EFE8CE" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{accountName}</Text>
        <View style={styles.placeholder} />
      </View>

      {errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <View style={styles.summaryCard}>
        <View style={styles.cardHeader}>
          <Feather name="pie-chart" size={20} color="#333" />
          <Text style={styles.cardTitle}>ภาพรวมบัญชี</Text>
          <View style={styles.dateSelector}>
            <TouchableOpacity
              style={styles.dateSelectorButton}
              onPress={toggleDropdown}
            >
              <Text style={styles.dateText}>
                {dateFilterOptions.find(opt => opt.key === dateFilter)?.label}
              </Text>
              <Animated.View
                style={{
                  transform: [{
                    rotate: dropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg']
                    })
                  }]
                }}
              >
                <Feather name="chevron-down" size={16} color="#666" />
              </Animated.View>
            </TouchableOpacity>
            
            {showDateDropdown && (
              <Animated.View
                style={[
                  styles.dropdown,
                  {
                    opacity: dropdownAnim,
                    transform: [{
                      translateY: dropdownAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0]
                      })
                    }, {
                      scale: dropdownAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1]
                      })
                    }]
                  }
                ]}
              >
                {dateFilterOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.dropdownItem,
                      dateFilter === option.key && styles.dropdownItemActive
                    ]}
                    onPress={() => selectDateFilter(option.key)}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      dateFilter === option.key && styles.dropdownItemTextActive
                    ]}>
                      {option.label}
                    </Text>
                    {dateFilter === option.key && (
                      <Feather name="check" size={16} color="#4A90E2" />
                    )}
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}
          </View>
        </View>
        
        <View style={styles.chartContainer}>
          <LineChart
            data={chartData}
            width={width - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: '4', strokeWidth: '2', stroke: '#ffffff' }
            }}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.legendText}>รายรับ</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>รายจ่าย</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryValues}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>รายรับ</Text>
            <Text style={[styles.summaryAmount, styles.incomeText]}>
              ฿{totalIncome.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>รายจ่าย</Text>
            <Text style={[styles.summaryAmount, styles.expenseText]}>
              ฿{totalExpense.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>คงเหลือ</Text>
            <Text style={[styles.summaryAmount, 
              (totalIncome - totalExpense) >= 0 ? styles.incomeText : styles.expenseText
            ]}>
              ฿{(totalIncome - totalExpense).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryTitle}>หมวดหมู่</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, showIncomeCategories && styles.activeToggle]}
            onPress={() => setShowIncomeCategories(true)}
          >
            <Text style={[styles.toggleText, showIncomeCategories && styles.activeToggleText]}>รายรับ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, !showIncomeCategories && styles.activeToggleExpense]}
            onPress={() => setShowIncomeCategories(false)}
          >
            <Text style={[styles.toggleText, !showIncomeCategories && styles.activeToggleText]}>รายจ่าย</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.categoryList}>
        {filteredCategories.length > 0 ? (
          filteredCategories.map((category, index) => (
            <View key={`${category.category}-${index}`} style={styles.categoryItem}>
              <View style={styles.categoryLeft}>
                <Icon
                  name={iconMap[category.category] || 'category'}
                  size={24}
                  color={showIncomeCategories ? '#22C55E' : '#EF4444'}
                />
                <Text style={styles.categoryName}>{category.category}</Text>
              </View>
              <Text style={[
                styles.categoryAmount,
                showIncomeCategories ? styles.incomeText : styles.expenseText
              ]}>
                ฿{(category.currentAmount || 0).toLocaleString()}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.noCategoryContainer}>
            <Text style={styles.noCategoryText}>
              ไม่มีข้อมูล{showIncomeCategories ? 'รายรับ' : 'รายจ่าย'}สำหรับช่วงเวลาที่เลือก
            </Text>
            <Text style={styles.noCategorySubText}>
              ช่วงเวลา: {dateFilterOptions.find(opt => opt.key === dateFilter)?.label}
            </Text>
          </View>
        )}
      </View>
      
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

const styles = StyleSheet.create({
  container: {
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 13,
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
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  errorContainer: {
    backgroundColor: '#FFCCCB',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  dateSelector: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
  },
  dateSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minWidth: 120,
  },
  dateText: {
    fontSize: 13,
    color: '#495057',
    marginRight: 6,
    fontWeight: '500',
  },
  dropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    minWidth: 160,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingVertical: 8,
    zIndex: 1001,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  dropdownItemActive: {
    backgroundColor: '#f0f8ff',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '400',
  },
  dropdownItemTextActive: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  noDataContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryValues: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  incomeText: {
    color: '#22C55E',
  },
  expenseText: {
    color: '#EF4444',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    elevation: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    padding: 2,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  activeToggle: {
    backgroundColor: '#22C55E',
  },
  activeToggleExpense: {
    backgroundColor: '#EF4444',
  },
  toggleText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  activeToggleText: {
    color: 'white',
  },
  categoryList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  categoryItem: {
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  noCategoryContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  noCategoryText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  noCategorySubText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});