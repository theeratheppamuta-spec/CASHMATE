import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text, Image, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseconfig';  // เพิ่ม db

export default function RegisterScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        // ตรวจสอบข้อมูลก่อนส่ง
        if (!username.trim()) {
            Alert.alert('ผิดพลาด', 'กรุณากรอกชื่อผู้ใช้');
            return;
        }
        if (!email.trim()) {
            Alert.alert('ผิดพลาด', 'กรุณากรอกอีเมล');
            return;
        }
        if (password.length < 6) {
            Alert.alert('ผิดพลาด', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
            return;
        }

        setLoading(true);

        try {
            // 1. สร้างบัญชีผู้ใช้
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. อัปเดต Display Name ใน Firebase Auth
            await updateProfile(user, {
                displayName: username
            });

            // 3. บันทึกข้อมูลเพิ่มเติมลง Firestore
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                username: username,
                email: email,
                displayName: username,
                createdAt: new Date(),
                photoURL: user.photoURL || null
            });

            Alert.alert(
                'สำเร็จ', 
                'สร้างบัญชีเรียบร้อยแล้ว',
                [
                    {
                        text: 'ตกลง',
                        onPress: () => navigation.navigate('Login')
                    }
                ]
            );

        } catch (error) {
            console.error('Registration error:', error);
            
            let errorMessage = 'เกิดข้อผิดพลาดในการสร้างบัญชี';
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'รหัสผ่านไม่ปลอดภัยเพียงพอ';
            }
            
            Alert.alert('ผิดพลาด', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Image
                source={require('../photo/Logo.png')}
                style={styles.logo}
                resizeMode="contain"
            />
            
            <Text style={styles.title}>สร้างบัญชีผู้ใช้</Text>

            <TextInput
                placeholder="ชื่อผู้ใช้"
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                autoCapitalize="words"
            />

            <TextInput
                placeholder="กรอกอีเมล"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
            />

            <TextInput
                placeholder="ตั้งรหัสผ่าน"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
            />

            <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]} 
                onPress={handleRegister}
                disabled={loading}
            >
                <Text style={styles.buttonText}>
                    {loading ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี'}
                </Text>
            </TouchableOpacity>

            <Text style={styles.footerText}>
                หากคุณมีบัญชีอยู่แล้ว,{' '}
                <Text style={styles.linkText} onPress={() => navigation.navigate('Login')}>
                    เข้าสู่ระบบ
                </Text>
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        backgroundColor: '#fff7d1',
    },
    logo: {
        width: '80%',
        height: 150,
        alignSelf: 'center',
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
    title: {
        fontSize: 28,
        fontFamily: 'NotoSansThai-Regular', // Updated to use Noto Sans Thai
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#3e3e00',
        textAlign: 'center',
    },
    buttonText: {
        color: '#fff',
        textAlign: 'center',
        fontWeight: '600',
    },
    footerText: {
        marginTop: 15,
        textAlign: 'center',
        fontSize: 12,
    },
    linkText: {
        fontWeight: 'bold',
        color: '#000',
    },
});