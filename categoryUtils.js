import { 
  collection, 
  doc, 
  setDoc, 
  increment, 
  Timestamp,
  getDocs,
  query,
  orderBy 
} from 'firebase/firestore';
import { db } from './firebaseconfig';

// ฟังก์ชันสำหรับอัปเดต expense category
export const updateExpenseCategory = async (userId, categoryName, amount) => {
  try {
    const categoryRef = doc(db, `users/${userId}/expense_categories`, categoryName);
    
    // อัปเดตข้อมูลหมวดหมู่
    await setDoc(categoryRef, {
      category: categoryName,
      totalAmount: increment(amount),
      count: increment(1),
      lastUpdated: Timestamp.now(),
    }, { merge: true });

    // ตั้งค่า budget เริ่มต้นหากยังไม่มี
    const defaultBudgets = {
      'ค่าอาหารและเครื่องดื่ม': 5000,
      'ค่าน้ำ': 1000,
      'ค่าไฟ': 2000,
      'ค่าบ้าน': 8000,
      'ค่าเดินทาง': 3000,
      'ค่าอินเตอร์เน็ต': 1500,
      'ค่าช้อปปิ้ง': 5000,
      'ค่าอื่นๆ': 2000,
    };

    if (defaultBudgets[categoryName]) {
      await setDoc(categoryRef, {
        budget: defaultBudgets[categoryName],
      }, { merge: true });
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating expense category:', error);
    return { success: false, error };
  }
};

// ฟังก์ชันสำหรับอัปเดต income category
export const updateIncomeCategory = async (userId, categoryName, amount) => {
  try {
    const categoryRef = doc(db, `users/${userId}/income_categories`, categoryName);
    
    // อัปเดตข้อมูลหมวดหมู่
    await setDoc(categoryRef, {
      category: categoryName,
      totalAmount: increment(amount),
      count: increment(1),
      lastUpdated: Timestamp.now(),
    }, { merge: true });

    // ตั้งค่าเป้าหมายเริ่มต้นหากยังไม่มี
    const defaultTargets = {
      'เงินเดือน': 30000,
      'เงินโบนัส': 10000,
      'รายได้เสริม': 15000,
      'เงินปันผล': 5000,
    };

    if (defaultTargets[categoryName]) {
      await setDoc(categoryRef, {
        target: defaultTargets[categoryName],
      }, { merge: true });
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating income category:', error);
    return { success: false, error };
  }
};

// ✅ เพิ่มฟังก์ชันสำหรับ update budget ใน expense category
export const updateBudget = async (userId, categoryName, newBudget) => {
  try {
    const categoryRef = doc(db, `users/${userId}/expense_categories`, categoryName);
    await setDoc(categoryRef, {
      budget: parseFloat(newBudget),
      lastUpdated: Timestamp.now(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating budget:', error);
    return { success: false, error };
  }
};

// ✅ เพิ่มฟังก์ชันสำหรับ update target ใน income category
export const updateTarget = async (userId, categoryName, newTarget) => {
  try {
    const categoryRef = doc(db, `users/${userId}/income_categories`, categoryName);
    await setDoc(categoryRef, {
      target: parseFloat(newTarget),
      lastUpdated: Timestamp.now(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating target:', error);
    return { success: false, error };
  }
};

// ฟังก์ชันสำหรับดึงข้อมูล expense categories
export const getExpenseCategories = async (userId) => {
  try {
    const q = query(
      collection(db, `users/${userId}/expense_categories`),
      orderBy('totalAmount', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const categories = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { success: true, data: categories };
  } catch (error) {
    console.error('Error getting expense categories:', error);
    return { success: false, error };
  }
};

// ฟังก์ชันสำหรับดึงข้อมูล income categories
export const getIncomeCategories = async (userId) => {
  try {
    const q = query(
      collection(db, `users/${userId}/income_categories`),
      orderBy('totalAmount', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const categories = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { success: true, data: categories };
  } catch (error) {
    console.error('Error getting income categories:', error);
    return { success: false, error };
  }
};

// ฟังก์ชันสำหรับคำนวณ budget progress
export const calculateBudgetProgress = (spent, budget) => {
  if (!budget || budget === 0) return 0;
  return Math.min((spent / budget) * 100, 100);
};

// ฟังก์ชันสำหรับคำนวณ income target progress
export const calculateIncomeProgress = (earned, target) => {
  if (!target || target === 0) return 0;
  return Math.min((earned / target) * 100, 100);
};

// ฟังก์ชันสำหรับจัดกลุ่มรายการตามหมวดหมู่
export const groupTransactionsByCategory = (transactions, type = 'all') => {
  const grouped = {};
  
  transactions
    .filter(txn => type === 'all' || txn.type === type)
    .forEach(txn => {
      const category = txn.category;
      if (!grouped[category]) {
        grouped[category] = {
          category,
          transactions: [],
          totalAmount: 0,
          count: 0
        };
      }
      grouped[category].transactions.push(txn);
      grouped[category].totalAmount += parseFloat(txn.amount);
      grouped[category].count += 1;
    });

  return Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
};

// ฟังก์ชันสำหรับหา top categories
export const getTopCategories = (categories, limit = 5) => {
  return categories
    .sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0))
    .slice(0, limit);
};

// ฟังก์ชันสำหรับคำนวณสถิติรายเดือน
export const getMonthlyStats = (transactions, month = new Date().getMonth(), year = new Date().getFullYear()) => {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  
  const monthlyTransactions = transactions.filter(txn => {
    const txnDate = txn.date.toDate ? txn.date.toDate() : new Date(txn.date);
    return txnDate >= monthStart && txnDate <= monthEnd;
  });

  const income = monthlyTransactions
    .filter(txn => txn.type === 'income')
    .reduce((sum, txn) => sum + parseFloat(txn.amount), 0);
    
  const expenses = monthlyTransactions
    .filter(txn => txn.type === 'expense')
    .reduce((sum, txn) => sum + parseFloat(txn.amount), 0);

  return {
    income,
    expenses,
    balance: income - expenses,
    transactions: monthlyTransactions,
    incomeByCategory: groupTransactionsByCategory(monthlyTransactions, 'income'),
    expensesByCategory: groupTransactionsByCategory(monthlyTransactions, 'expense')
  };
};

// ฟังก์ชันสำหรับสร้าง default categories
export const createDefaultCategories = async (userId) => {
  try {
    // Default expense categories
    const expenseCategories = [
      { name: 'ค่าอาหารและเครื่องดื่ม', budget: ''},
      { name: 'ค่าน้ำ', budget: '' },
      { name: 'ค่าไฟ', budget: '' },
      { name: 'ค่าบ้าน', budget: '' },
      { name: 'ค่าเดินทาง', budget:  '' },
      { name: 'ค่าอินเตอร์เน็ต', budget: '' },
      { name: 'ค่าช้อปปิ้ง', budget: ''  },
      { name: 'ค่าอื่นๆ', budget: '' },
    ];

    // Default income categories
    const incomeCategories = [
      { name: 'เงินเดือน', target: '' },
      { name: 'เงินโบนัส', target: '' },
      { name: 'รายได้เสริม', target: ''  },
      { name: 'เงินปันผล', target: ''  },
    ];

    // Create expense categories
    for (const category of expenseCategories) {
      const categoryRef = doc(db, `users/${userId}/expense_categories`, category.name);
      await setDoc(categoryRef, {
        category: category.name,
        budget: category.budget,
        totalAmount: 0,
        count: 0,
        lastUpdated: Timestamp.now(),
      });
    }

    // Create income categories
    for (const category of incomeCategories) {
      const categoryRef = doc(db, `users/${userId}/income_categories`, category.name);
      await setDoc(categoryRef, {
        category: category.name,
        target: category.target,
        totalAmount: 0,
        count: 0,
        lastUpdated: Timestamp.now(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating default categories:', error);
    return { success: false, error };
  }
};

// Export all functions
export default {
  updateExpenseCategory,
  updateIncomeCategory,
  updateBudget,
  updateTarget,
  getExpenseCategories,
  getIncomeCategories,
  calculateBudgetProgress,
  calculateIncomeProgress,
  groupTransactionsByCategory,
  getTopCategories,
  getMonthlyStats,
  createDefaultCategories,
};