import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    StyleSheet, 
    Image, 
    SafeAreaView,
    Alert
} from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseconfig';

const ForgotScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleResetPassword = async () => {
        // ตรวจสอบอีเมล
        if (!email.trim()) {
            Alert.alert('ผิดพลาด', 'กรุณากรอกอีเมล');
            return;
        }

        // ตรวจสอบรูปแบบอีเมล
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Alert.alert('ผิดพลาด', 'รูปแบบอีเมลไม่ถูกต้อง');
            return;
        }

        setLoading(true);

        try {
            // ส่งอีเมลรีเซ็ตรหัสผ่าน
            await sendPasswordResetEmail(auth, email);
            
            Alert.alert(
                'สำเร็จ',
                `ได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง ${email} แล้ว\nกรุณาตรวจสอบอีเมล (รวมถึงในกล่องสแปมด้วย)`,
                [
                    {
                        text: 'ตกลง',
                        onPress: () => navigation.navigate('Login')
                    }
                ]
            );

        } catch (error) {
            console.error('Password reset error:', error);
            
            let errorMessage = 'เกิดข้อผิดพลาดในการส่งอีเมลรีเซ็ต';
            
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'ไม่พบบัญชีผู้ใช้ที่ใช้อีเมลนี้';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'มีการร้องขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่';
            }
            
            Alert.alert('ผิดพลาด', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Image
                    source={require('../photo/Logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />

                <Text style={styles.title}>รีเซ็ตรหัสผ่าน</Text>
                
                <Text style={styles.description}>
                    กรอกอีเมลของคุณ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="กรอกอีเมล"
                    onChangeText={setEmail}
                    value={email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                <TouchableOpacity 
                    style={[styles.button, loading && styles.buttonDisabled]} 
                    onPress={handleResetPassword}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'กำลังส่งอีเมล...' : 'ส่งเพื่อรีเซ็ต'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>กลับไปหน้าเข้าสู่ระบบ</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff7d1',
    },
    container: {
        flex: 1,
        backgroundColor: '#fff7d1',
        padding: 20,
        justifyContent: 'center',
    },
    logo: {
        width: '80%',
        height: 150,
        alignSelf: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#3e3e00',
        textAlign: 'center',
    },
    description: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    input: {
        backgroundColor: '#c8dc8f',
        padding: 10,
        marginVertical: 8,
        borderRadius: 4,
    },
    button: {
        backgroundColor: '#6b744e',
        padding: 12,
        borderRadius: 6,
        marginTop: 10,
    },
    buttonDisabled: {
        backgroundColor: '#a5a5a5',
    },
    buttonText: {
        color: '#fff',
        textAlign: 'center',
        fontWeight: '600',
    },
    backButton: {
        marginTop: 20,
        padding: 10,
    },
    backButtonText: {
        color: '#3e3e00',
        textAlign: 'center',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
});

export default ForgotScreen;