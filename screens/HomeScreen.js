import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import Collapsible from 'react-native-collapsible';
import * as Progress from 'react-native-progress';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedFAB from '../AnimatedFAB';
import { auth, db } from '../firebaseconfig';
import { collection, getDocs, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

export default function HomeScreen() {
  const navigation = useNavigation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Data states
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountBalances, setAccountBalances] = useState({});
  const [accountIncomes, setAccountIncomes] = useState({});
  const [accountExpenses, setAccountExpenses] = useState({});
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [expensesByCategory, setExpensesByCategory] = useState({});
  const [incomeByCategory, setIncomeByCategory] = useState({});
  const [todayIncome, setTodayIncome] = useState(0);
  const [todayExpense, setTodayExpense] = useState(0);
  const [yesterdayIncome, setYesterdayIncome] = useState(0);
  const [yesterdayExpense, setYesterdayExpense] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);

  const user = auth.currentUser;
  
  // Use ref to prevent duplicate calls
  const isFetching = useRef(false);
  const unsubscribes = useRef([]);
  const dataCache = useRef({});

  // Helper function to format date and time
  const formatDateTime = (dateInput) => {
    let date;
    try {
      date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    } catch (e) {
      return 'วันที่ไม่ถูกต้อง';
    }

    const thaiMonths = [
      'ม.ค.', 'ก.ฟ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day} ${month} ${year} ${hours}:${minutes}`;
  };

  // Cleanup listeners when component unmounts
  useEffect(() => {
    return () => {
      unsubscribes.current.forEach(unsub => unsub());
      unsubscribes.current = [];
    };
  }, []);

  // Main data fetching effect - optimized with faster initial load
  useFocusEffect(
    React.useCallback(() => {
      if (!user) {
        Alert.alert('ข้อผิดพลาด', 'ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
        navigation.navigate('Login');
        return;
      }

      // Skip if already initialized or fetching
      if (isFetching.current) {
        return;
      }

      // Fast initial load from cache if available
      if (dataCache.current.accounts && !initialized) {
        console.log('🚀 Loading from cache...');
        setAccounts(dataCache.current.accounts);
        setTransactions(dataCache.current.transactions || []);
        setExpenseCategories(dataCache.current.expenseCategories || []);
        setIncomeCategories(dataCache.current.incomeCategories || []);
        setLoading(false);
        setInitialized(true);
      }

      console.log('🚀 Starting optimized data fetch...');
      isFetching.current = true;
      
      fetchAllDataOptimized();
      
      return () => {
        // Cleanup when screen loses focus
        unsubscribes.current.forEach(unsub => unsub());
        unsubscribes.current = [];
      };
    }, [user])
  );

  // Optimized fetch with parallel loading and limits
  const fetchAllDataOptimized = async () => {
    try {
      console.log('📊 Starting optimized fetch...');
      const startTime = performance.now();
      
      // Show data immediately, then update with real-time
      await Promise.all([
        loadAccountsOptimized(),
        loadTransactionsOptimized(),
        loadCategoriesOptimized(),
      ]);

      const endTime = performance.now();
      console.log(`✅ Optimized load completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      setInitialized(true);
      setLoading(false);
      isFetching.current = false;
      
    } catch (error) {
      console.error('❌ Error in optimized fetch:', error);
      setLoading(false);
      isFetching.current = false;
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้');
    }
  };

  // Optimized accounts loading with immediate response
  const loadAccountsOptimized = async () => {
    try {
      // First, try to get data once for immediate display
      const q = query(collection(db, `users/${user.uid}/accounts`));
      const snapshot = await getDocs(q);
      
      const accts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        initialBalance: parseFloat(doc.data().initialBalance) || 0,
      }));
      
      console.log(`✅ Accounts loaded: ${accts.length} items`);
      setAccounts(accts);
      dataCache.current.accounts = accts;

      // Then setup real-time listener for updates
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const updatedAccts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          initialBalance: parseFloat(doc.data().initialBalance) || 0,
        }));
        
        setAccounts(updatedAccts);
        dataCache.current.accounts = updatedAccts;
      });
      
      unsubscribes.current.push(unsubscribe);
    } catch (error) {
      console.error('❌ Accounts loading error:', error);
    }
  };

  // Optimized transactions loading with limit
  const loadTransactionsOptimized = async () => {
    try {
      // Load recent transactions first with limit for speed
      const recentQuery = query(
        collection(db, `users/${user.uid}/transactions`),
        orderBy('date', 'desc'),
        limit(100) // Limit for faster initial load
      );
      
      const snapshot = await getDocs(recentQuery);
      const txns = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        amount: parseFloat(doc.data().amount) || 0
      }));
      
      console.log(`✅ Transactions loaded: ${txns.length} items`);
      setTransactions(txns);
      dataCache.current.transactions = txns;

      // Setup real-time listener for all transactions
      const fullQuery = query(
        collection(db, `users/${user.uid}/transactions`),
        orderBy('date', 'desc')
      );
      
      const unsubscribe = onSnapshot(fullQuery, (snapshot) => {
        const allTxns = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          amount: parseFloat(doc.data().amount) || 0
        }));
        
        setTransactions(allTxns);
        dataCache.current.transactions = allTxns;
      });
      
      unsubscribes.current.push(unsubscribe);
    } catch (error) {
      console.error('❌ Transactions loading error:', error);
    }
  };

  // Combined categories loading
  const loadCategoriesOptimized = async () => {
    try {
      // Load both expense and income categories in parallel
      const [expenseSnapshot, incomeSnapshot] = await Promise.all([
        getDocs(query(collection(db, `users/${user.uid}/expense_categories`))),
        getDocs(query(collection(db, `users/${user.uid}/income_categories`)))
      ]);

      const expenseCategories = expenseSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        displayKey: `${doc.data().wallet || 'ไม่ระบุ'} - ${doc.data().category}`
      }));

      const incomeCategories = incomeSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));

      console.log(`✅ Categories loaded: ${expenseCategories.length + incomeCategories.length} items`);
      setExpenseCategories(expenseCategories);
      setIncomeCategories(incomeCategories);
      dataCache.current.expenseCategories = expenseCategories;
      dataCache.current.incomeCategories = incomeCategories;

      // Setup real-time listeners
      const expenseUnsub = onSnapshot(
        query(collection(db, `users/${user.uid}/expense_categories`)),
        (snapshot) => {
          const categories = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            displayKey: `${doc.data().wallet || 'ไม่ระบุ'} - ${doc.data().category}`
          }));
          setExpenseCategories(categories);
          dataCache.current.expenseCategories = categories;
        }
      );

      const incomeUnsub = onSnapshot(
        query(collection(db, `users/${user.uid}/income_categories`)),
        (snapshot) => {
          const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setIncomeCategories(categories);
          dataCache.current.incomeCategories = categories;
        }
      );

      unsubscribes.current.push(expenseUnsub, incomeUnsub);
    } catch (error) {
      console.error('❌ Categories loading error:', error);
    }
  };

  // Optimized calculations with memoization
  const calculateAllDataMemo = React.useMemo(() => {
    if (accounts.length === 0) return null;

    console.log('🧮 Calculating data...');
    const startTime = performance.now();

    // Initialize data structures
    const balances = {};
    const incomes = {};
    const expenses = {};
    const expenseByCat = {};
    
    let totalExp = 0;
    let todayInc = 0, todayExp = 0;
    let yestInc = 0, yestExp = 0;

    // Pre-calculate date ranges
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Initialize account balances
    accounts.forEach(acct => {
      balances[acct.name] = parseFloat(acct.initialBalance) || 0;
      incomes[acct.name] = 0;
      expenses[acct.name] = 0;
    });

    // Process transactions efficiently
    transactions.forEach(txn => {
      let txnDate;
      try {
        txnDate = txn.date.toDate ? txn.date.toDate() : new Date(txn.date);
      } catch (e) {
        return;
      }

      const amount = parseFloat(txn.amount);
      if (isNaN(amount) || amount < 0) return;

      const wallet = txn.wallet || 'Unknown';
      
      // Initialize wallet if not exists
      if (!balances[wallet]) {
        balances[wallet] = 0;
        incomes[wallet] = 0;
        expenses[wallet] = 0;
      }

      // Update balances and calculate daily stats
      if (txn.type === 'income') {
        balances[wallet] += amount;
        incomes[wallet] += amount;
        
        if (txnDate >= todayStart) todayInc += amount;
        else if (txnDate >= yesterdayStart && txnDate < todayStart) yestInc += amount;
        
      } else if (txn.type === 'expense') {
        balances[wallet] -= amount;
        expenses[wallet] += amount;
        
        if (txnDate >= monthStart) totalExp += amount;
        if (txnDate >= todayStart) todayExp += amount;
        else if (txnDate >= yesterdayStart && txnDate < todayStart) yestExp += amount;
      }
    });

    // Process expense categories for chart
    expenseCategories.forEach(cat => {
      const categoryName = cat.category;
      if (!expenseByCat[categoryName]) {
        expenseByCat[categoryName] = 0;
      }
      expenseByCat[categoryName] += cat.totalAmount || 0;
    });

    const endTime = performance.now();
    console.log(`✅ Calculations completed in ${(endTime - startTime).toFixed(2)}ms`);

    return {
      balances,
      incomes,
      expenses,
      totalExp,
      expenseByCat,
      todayInc,
      todayExp,
      yestInc,
      yestExp,
      recentTxns: transactions.slice(0, 5)
    };
  }, [accounts, transactions, expenseCategories]);

  // Update states when calculations complete
  useEffect(() => {
    if (calculateAllDataMemo) {
      setAccountBalances(calculateAllDataMemo.balances);
      setAccountIncomes(calculateAllDataMemo.incomes);
      setAccountExpenses(calculateAllDataMemo.expenses);
      setTotalExpenses(calculateAllDataMemo.totalExp);
      setExpensesByCategory(calculateAllDataMemo.expenseByCat);
      setTodayIncome(calculateAllDataMemo.todayInc);
      setTodayExpense(calculateAllDataMemo.todayExp);
      setYesterdayIncome(calculateAllDataMemo.yestInc);
      setYesterdayExpense(calculateAllDataMemo.yestExp);
      setRecentTransactions(calculateAllDataMemo.recentTxns);
    }
  }, [calculateAllDataMemo]);

  const barChartData = {
    labels: Object.keys(expensesByCategory).slice(0, 5),
    datasets: [
      {
        data: Object.keys(expensesByCategory).length > 0 
          ? Object.values(expensesByCategory).slice(0, 5)
          : [0],
      },
    ],
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(224, 79, 74, ${opacity})`,
    fillShadowGradient: '#e04f4a',
    fillShadowGradientOpacity: 1,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
  };

  const calculateBudgetProgress = (categoryItem) => {
    const spent = categoryItem.totalAmount || 0;
    const budget = categoryItem.budget || 0;
    return budget > 0 ? Math.min(spent / budget, 1) : 0;
  };

  const handleAddBudget = () => {
    navigation.navigate('AddBudget');
  };

  // Optimized Loading Screen - show faster
  if (loading && accounts.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#bd9e67" />
          <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container}>
        <View style={styles.chartWrapper}>
          <Text style={styles.chartTitle}>ภาพรวมรายจ่ายวันนี้</Text>
          {Object.keys(expensesByCategory).length > 0 ? (
            <BarChart
              data={barChartData}
              width={screenWidth - 60}
              height={220}
              yAxisLabel="฿"
              chartConfig={chartConfig}
              style={{ marginVertical: 8, borderRadius: 16 }}
            />
          ) : (
            <Text style={styles.noDataText}>ไม่มีข้อมูลรายจ่าย</Text>
          )}
        </View>

        <View style={styles.dailyCards}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>วันนี้</Text>
            <Text style={styles.income}>+฿{todayIncome.toLocaleString()}</Text>
            <Text style={styles.expense}>-฿{todayExpense.toLocaleString()}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>เมื่อวาน</Text>
            <Text style={styles.income}>+฿{yesterdayIncome.toLocaleString()}</Text>
            <Text style={styles.expense}>-฿{yesterdayExpense.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.categorySection}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setIsCollapsed(!isCollapsed)}
          >
            <Text style={styles.accordionText}>รายรับ - รายจ่ายล่าสุด</Text>
            <Ionicons
              name={isCollapsed ? 'chevron-down' : 'chevron-up'}
              style={styles.accordionIcon}
            />
          </TouchableOpacity>
          
          <Collapsible collapsed={isCollapsed}>
            <View style={styles.transactionContainer}>
              {recentTransactions.map((txn, index) => (
                <View key={txn.id || index}>
                  <View style={styles.transactionItem}>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionCategory}>{txn.category}</Text>
                      <Text style={styles.transactionDescription}>{txn.description}</Text>
                      <Text style={styles.transactionDateTime}>
                        {formatDateTime(txn.date)}
                      </Text>
                    </View>
                    <View style={styles.transactionAmountContainer}>
                      <Text style={txn.type === 'income' ? styles.income : styles.expense}>
                        {txn.type === 'income' ? '+' : '-'}฿{parseFloat(txn.amount).toLocaleString()}
                      </Text>
                      <Text style={styles.transactionWallet}>{txn.wallet}</Text>
                    </View>
                  </View>
                  {index < recentTransactions.length - 1 && (
                    <View style={styles.transactionDivider} />
                  )}
                </View>
              ))}
            </View>
          </Collapsible>
        </View>

        {accounts.map((acct, index) => (
          <TouchableOpacity
            key={acct.id || index}
            style={styles.accountItem}
            onPress={() => navigation.navigate('Expense', { 
              accountId: acct.id, 
              accountName: acct.name 
            })}
          >
            <View style={styles.accountRow}>
              <Text style={styles.accountName}>{acct.name}</Text>
              <View style={styles.accountDetails}>
                <Text style={styles.income}>+฿{(accountIncomes[acct.name] || 0).toLocaleString()}</Text>
                <Text style={styles.expense}>-฿{(accountExpenses[acct.name] || 0).toLocaleString()}</Text>
                <Text style={styles.accountBalance}>฿{(accountBalances[acct.name] || 0).toLocaleString()}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.addAccountButton}
            onPress={() => navigation.navigate('AddAccount')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addAccountText}>เพิ่มบัญชี</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.budgetTitle}>วงเงินงบประมาณ</Text>

        {expenseCategories
          .filter(category => category.budget > 0)
          .slice(0, 10)
          .map((category, index) => {
            const progress = calculateBudgetProgress(category);
            const spent = category.totalAmount || 0;
            const budget = category.budget || 1000;
            const isOverBudget = spent > budget;
            
            return (
              <View key={category.id} style={styles.budgetItem}>
                <View style={styles.budgetHeader}>
                  <View>
                    <Text style={styles.budgetLabel}>{category.category}</Text>
                    <Text style={styles.budgetWallet}>กระเป๋า: {category.wallet}</Text>
                  </View>
                  <Text style={[styles.budgetStatus, isOverBudget && styles.overBudgetStatus]}>
                    {isOverBudget ? 'เกินงบประมาณ!' : 'ปกติ'}
                  </Text>
                </View>
                <Progress.Bar
                  progress={progress}
                  width={screenWidth - 60}
                  color={isOverBudget ? '#FF6B6B' : progress > 0.8 ? '#FFA726' : '#e85443'}
                  unfilledColor="#E0E0E0"
                  borderWidth={0}
                  height={8}
                />
                <View style={styles.budgetDetails}>
                  <Text style={styles.budgetPercent}>
                    {Math.round(progress * 100)}%
                  </Text>
                  <Text style={styles.budgetAmount}>
                    ฿{spent.toLocaleString()} / ฿{budget.toLocaleString()}
                  </Text>
                </View>
              </View>
            );
        })}

        <TouchableOpacity
          style={styles.addBudgetButton}
          onPress={handleAddBudget}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.addBudgetText}>เพิ่มงบประมาณ</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#EFE8CE',
  },
  container: {
    padding: 15,
  },
  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 20,
    color: '#666',
    textAlign: 'center',
  },
  chartWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  dailyCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    marginBottom: 10,
  },
  income: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 16,
  },
  expense: {
    color: '#F44336',
    fontWeight: 'bold',
    fontSize: 16,
  },
  categorySection: {
    marginBottom: 20,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  accordionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  accordionIcon: {
    fontSize: 18,
  },
  transactionContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  transactionItem: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 10,
  },
  transactionCategory: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  transactionDescription: {
    fontSize: 12,
    color: '#7d7c7c',
    marginBottom: 4,
  },
  transactionDateTime: {
    fontSize: 12,
    color: '#7d7c7c',
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionWallet: {
    fontSize: 12,
    color: '#7d7c7c',
    marginTop: 2,
  },
  transactionDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 15,
  },
  accountItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'left',
  },
  accountDetails: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  addAccountButton: {
    backgroundColor: '#bd9e67',
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  addAccountText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  addBudgetButton: {
    backgroundColor: '#8eab3e',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginTop: 20,
    marginBottom: 20,
  },
  addBudgetText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  budgetTitle: {
    fontSize: 16,
    marginBottom: 15,
    fontWeight: '600',
  },
  budgetItem: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  budgetWallet: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  budgetStatus: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  overBudgetStatus: {
    color: '#F44336',
  },
  budgetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  budgetPercent: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  budgetAmount: {
    fontSize: 12,
    color: '#666',
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});