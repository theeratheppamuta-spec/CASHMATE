import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator
} from 'react-native';
import { PieChart, LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AnimatedFAB from '../AnimatedFAB';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { auth, db } from '../firebaseconfig';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

const { width } = Dimensions.get('window');

const ReportScreen = () => {
   const navigation = useNavigation();
   const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('เดือนนี้');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({
    totalIncome: 0,
    totalExpense: 0,
    categories: [],
    lineData: { labels: [], datasets: [] }
  });

  const user = auth.currentUser;

  const periodOptions = [
    '7 วันล่าสุด',
    '30 วันล่าสุด',
    'เดือนนี้',
    'เดือนที่แล้ว',
    'ปีนี้',
    'ปีที่แล้ว',
    'ตลอดเวลา',
  ];

  useEffect(() => {
    if (user) {
      fetchReportData();
    }
  }, [selectedPeriod, user]);

  // สร้างช่วงวันที่ตามที่เลือก
  const getDateRange = (period) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate, endDate;

    switch (period) {
      case '7 วันล่าสุด':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '30 วันล่าสุด':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'เดือนนี้':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'เดือนที่แล้ว':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'ปีนี้':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      case 'ปีที่แล้ว':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'ตลอดเวลา':
        startDate = new Date(2020, 0, 1);
        endDate = new Date(2030, 11, 31);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return { startDate, endDate };
  };

  // ดึงข้อมูลธุรกรรมจากฐานข้อมูล
  const fetchReportData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(selectedPeriod);
      
      // ดึงข้อมูลธุรกรรมในช่วงวันที่ที่เลือก
      const transactionsRef = collection(db, `users/${user.uid}/transactions`);
      const q = query(
        transactionsRef,
        where('date', '>=', startDate),
        where('date', '<', endDate),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const transactions = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        transactions.push({
          id: doc.id,
          ...data,
          date: data.date.toDate() // Convert Timestamp to Date
        });
      });

      // คำนวดข้อมูลสำหรับรายงาน
      const processedData = processTransactionData(transactions);
      setReportData(processedData);

    } catch (error) {
      console.error('Error fetching report data:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลรายงานได้');
    } finally {
      setLoading(false);
    }
  };

  // ประมวลผลข้อมูลธุรกรรม
  const processTransactionData = (transactions) => {
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap = new Map();

    // รวมข้อมูลตามหมวดหมู่
    transactions.forEach(transaction => {
      const { type, category, amount } = transaction;
      const numAmount = parseFloat(amount);

      if (type === 'income') {
        totalIncome += numAmount;
      } else {
        totalExpense += numAmount;
      }

      // รวมตามหมวดหมู่
      const key = `${category}_${type}`;
      if (categoryMap.has(key)) {
        categoryMap.set(key, categoryMap.get(key) + numAmount);
      } else {
        categoryMap.set(key, numAmount);
      }
    });

    // สร้าง categories array สำหรับ pie chart
    const categories = [];
    const colors = {
      income: ['#4CAF50', '#00BCD4', '#2196F3', '#9C27B0'],
      expense: ['#FF6B6B', '#FF9800', '#E91E63', '#607D8B', '#795548', '#3F51B5', '#673AB7', '#009688']
    };

    let incomeColorIndex = 0;
    let expenseColorIndex = 0;

    // สร้างข้อมูล categories
    categoryMap.forEach((amount, key) => {
      const [category, type] = key.split('_');
      const color = type === 'income' 
        ? colors.income[incomeColorIndex++ % colors.income.length]
        : colors.expense[expenseColorIndex++ % colors.expense.length];

      categories.push({
        name: category,
        amount,
        color,
        type,
        icon: getCategoryIcon(category, type)
      });
    });

    // เรียงตามจำนวนเงินมากไปน้อย
    categories.sort((a, b) => b.amount - a.amount);

    // สร้าง line chart data
    const lineData = createLineChartData(transactions, selectedPeriod);

    return {
      totalIncome,
      totalExpense,
      categories,
      lineData,
      recentTransactions: transactions.slice(0, 10) // 10 รายการล่าสุด
    };
  };

  // สร้างข้อมูล Line Chart ตามช่วงเวลา
  const createLineChartData = (transactions, period) => {
    let labels = [];
    let incomeData = [];
    let expenseData = [];

    if (period === 'เดือนนี้') {
      // แบ่งตามสัปดาห์
      labels = ['สัปดาห์ 1', 'สัปดาห์ 2', 'สัปดาห์ 3', 'สัปดาห์ 4'];
      incomeData = [0, 0, 0, 0];
      expenseData = [0, 0, 0, 0];

      transactions.forEach(tx => {
        const weekOfMonth = Math.ceil(tx.date.getDate() / 7) - 1;
        const amount = parseFloat(tx.amount);
        
        if (weekOfMonth >= 0 && weekOfMonth < 4) {
          if (tx.type === 'income') {
            incomeData[weekOfMonth] += amount;
          } else {
            expenseData[weekOfMonth] += amount;
          }
        }
      });

    } else if (period === '7 วันล่าสุด') {
      // แบ่งตามวัน
      const days = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
      labels = days;
      incomeData = new Array(7).fill(0);
      expenseData = new Array(7).fill(0);

      transactions.forEach(tx => {
        const dayOfWeek = tx.date.getDay();
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0
        const amount = parseFloat(tx.amount);
        
        if (tx.type === 'income') {
          incomeData[adjustedDay] += amount;
        } else {
          expenseData[adjustedDay] += amount;
        }
      });

    } else if (period === 'ปีนี้') {
      // แบ่งตามเดือน
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      labels = months;
      incomeData = new Array(12).fill(0);
      expenseData = new Array(12).fill(0);

      transactions.forEach(tx => {
        const month = tx.date.getMonth();
        const amount = parseFloat(tx.amount);
        
        if (tx.type === 'income') {
          incomeData[month] += amount;
        } else {
          expenseData[month] += amount;
        }
      });

    } else {
      // Default: แสดงรวมทั้งหมด
      labels = [period];
      const totalIncome = transactions
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const totalExpense = transactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      
      incomeData = [totalIncome];
      expenseData = [totalExpense];
    }

    return {
      labels,
      datasets: [
        {
          data: incomeData,
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, // สีเขียวสำหรับรายรับ
          strokeWidth: 3
        },
        {
          data: expenseData,
          color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`, // สีแดงสำหรับรายจ่าย
          strokeWidth: 3
        }
      ],
      legend: ['รายรับ', 'รายจ่าย']
    };
  };

  // กำหนดไอคอนตามหมวดหมู่ (เดียวกันกับ ExpenseTracker)
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

  // แยกข้อมูลรายรับและรายจ่าย
  const incomeCategories = reportData.categories.filter(cat => cat.type === 'income');
  const expenseCategories = reportData.categories.filter(cat => cat.type === 'expense');

  // เตรียมข้อมูลสำหรับ Pie Chart
  const pieData = reportData.categories.map(cat => ({
    name: cat.name,
    amount: cat.amount,
    color: cat.color,
    legendFontColor: '#7F7F7F',
    legendFontSize: 12,
  }));

  // คำนวดเปอร์เซ็นต์
  const totalAmount = reportData.categories.reduce((sum, cat) => sum + cat.amount, 0);
  const pieDataWithPercentage = pieData.map(item => ({
    ...item,
    percentage: totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(1) : 0
  }));

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
    }
  };

  const balance = reportData.totalIncome - reportData.totalExpense;

  const handleFABToggle = () => {
    setFabExpanded(prev => !prev);
  };

  const formatDateRange = (period) => {
    const now = new Date();
    const { startDate, endDate } = getDateRange(period);
    
    const formatDate = (date) => {
      return `${date.getDate()} ${['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][date.getMonth()]} ${date.getFullYear()}`;
    };

    if (period === 'ตลอดเวลา') {
      return 'ทุกช่วงเวลา';
    }
    
    return `[${formatDate(startDate)}-${formatDate(new Date(endDate.getTime() - 24 * 60 * 60 * 1000))}]`;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#c8dc8f" />
        <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="event" size={24} color="white" />
          <TouchableOpacity
            style={styles.periodSelector}
            onPress={() => setShowPeriodMenu(!showPeriodMenu)}
          >
            <Text style={styles.periodText}>
              {selectedPeriod} {formatDateRange(selectedPeriod)}
            </Text>
            <Icon name="keyboard-arrow-down" size={20} color="white" />
          </TouchableOpacity>
        </View>
        <Icon name="more-vert" size={24} color="white" />
      </View>

      {/* Period Menu */}
      {showPeriodMenu && (
        <View style={styles.periodMenu}>
          {periodOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={styles.periodOption}
              onPress={() => {
                setSelectedPeriod(option);
                setShowPeriodMenu(false);
              }}
            >
              <Text style={styles.periodOptionText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView style={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>รายรับ-รายจ่าย</Text>

          {/* Line Chart */}
          {reportData.lineData.datasets.length > 0 && (
            <View style={styles.chartContainer}>
              <LineChart
                data={reportData.lineData}
                width={width - 60}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16
                }}
                withDots={true}
                withShadow={false}
                withInnerLines={false}
                withOuterLines={true}
                yAxisLabel="฿"
                yAxisSuffix=""
                segments={4}
              />
            </View>
          )}

          {/* Summary Values */}
          <View style={styles.summaryValues}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>รายจ่าย</Text>
              <Text style={[styles.summaryAmount, styles.expense]}>
                ฿{reportData.totalExpense.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>รายรับ</Text>
              <Text style={[styles.summaryAmount, styles.income]}>
                ฿{reportData.totalIncome.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>คงเหลือ</Text>
              <Text style={[styles.summaryAmount, balance >= 0 ? styles.income : styles.expense]}>
                {balance >= 0 ? '+' : ''}฿{balance.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Pie Chart Section */}
        {pieDataWithPercentage.length > 0 && (
          <View style={styles.pieChartContainer}>
            <Text style={styles.sectionTitle}>รายรับ-รายจ่าย</Text>

            <View style={styles.pieChartWrapper}>
              <PieChart
                data={pieDataWithPercentage}
                width={width - 60}
                height={220}
                chartConfig={chartConfig}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="100"
                center={[0, 0]}
                hasLegend={false}
                absolute={false}
              />
            </View>

            <Text style={styles.centerText}>หมวดหมู่</Text>

            {/* Income Legend */}
            {incomeCategories.length > 0 && (
              <>
                <Text style={styles.legendTitle}>รายรับ</Text>
                <View style={styles.legendContainer}>
                  {incomeCategories.map((cat, index) => {
                    const percentage = totalAmount > 0 ? ((cat.amount / totalAmount) * 100).toFixed(1) : 0;
                    return (
                      <View key={index} style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: cat.color }]} />
                        <Icon name={cat.icon} size={18} color={cat.color} />
                        <Text style={styles.legendText}>{cat.name}</Text>
                        <Text style={styles.legendPercentage}>{percentage}%</Text>
                        <Text style={styles.legendAmount}>฿{cat.amount.toLocaleString()}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Expense Legend */}
            {expenseCategories.length > 0 && (
              <>
                <Text style={styles.legendTitle}>รายจ่าย</Text>
                <View style={styles.legendContainer}>
                  {expenseCategories.map((cat, index) => {
                    const percentage = totalAmount > 0 ? ((cat.amount / totalAmount) * 100).toFixed(1) : 0;
                    return (
                      <View key={index} style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: cat.color }]} />
                        <Icon name={cat.icon} size={18} color={cat.color} />
                        <Text style={styles.legendText}>{cat.name}</Text>
                        <Text style={styles.legendPercentage}>{percentage}%</Text>
                        <Text style={styles.legendAmount}>฿{cat.amount.toLocaleString()}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}

        {/* Recent Transactions */}
        {reportData.recentTransactions && reportData.recentTransactions.length > 0 && (
          <View style={styles.transactionContainer}>
            <Text style={styles.sectionTitle}>รายรับ-รายจ่ายล่าสุด</Text>

            {reportData.recentTransactions.slice(0, 10).map((transaction, index) => (
              <View key={index} style={styles.transactionItem}>
                <View style={styles.transactionLeft}>
                  <Icon
                    name={getCategoryIcon(transaction.category, transaction.type)}
                    size={24}
                    color={transaction.type === 'income' ? '#4CAF50' : '#FF6B6B'}
                  />
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionCategory}>{transaction.category}</Text>
                    <Text style={styles.transactionDate}>
                      {transaction.date.toLocaleDateString('th-TH')} {transaction.date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {transaction.description && (
                      <Text style={styles.transactionDescription}>{transaction.description}</Text>
                    )}
                  </View>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  transaction.type === 'expense' ? styles.expense : styles.income
                ]}>
                  {transaction.type === 'expense' ? '-' : '+'}฿{parseFloat(transaction.amount).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {reportData.categories.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Icon name="receipt" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>ไม่มีข้อมูลในช่วงเวลาที่เลือก</Text>
            <Text style={styles.emptyStateSubtext}>ลองเปลี่ยนช่วงเวลาหรือเพิ่มรายการใหม่</Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
     <AnimatedFAB
           isExpanded={isExpanded}
           onToggle={() => setIsExpanded(!isExpanded)}
           onPressMain={() => {}}
           onPressRed={() => navigation.navigate('Expenses')}
           onPressGreen={() => navigation.navigate('Income')}
         />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFE8CE',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#c8dc8f',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  periodText: {
    color: '#495834',
    fontSize: 16,
    marginRight: 4,
  },
  periodMenu: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  periodOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  periodOptionText: {
    fontSize: 16,
    color: '#495834',
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryValues: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
    fontWeight: 'bold',
    color: '#333',
  },
  expense: {
    color: '#FF6B6B',
  },
  income: {
    color: '#4CAF50',
  },
  pieChartContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  pieChartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  centerText: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  legendContainer: {
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  legendPercentage: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  legendAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 80,
    textAlign: 'right',
  },
  transactionContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 80,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  transactionCategory: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  transactionDescription: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ReportScreen;