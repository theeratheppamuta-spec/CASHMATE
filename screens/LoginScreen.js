import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, SafeAreaView } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseconfig';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                navigation.navigate('MainTabs');
            })
            .catch((error) => {
                alert(error.message);
            });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Image
                    source={require('../photo/Logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />

                <Text style={styles.title}>เข้าสู่ระบบ</Text>

                <TextInput
                    style={styles.input}
                    placeholder="อีเมล"
                    onChangeText={setEmail}
                    value={email}
                />
                <TextInput
                    style={styles.input}
                    placeholder="รหัสผ่าน"
                    secureTextEntry
                    onChangeText={setPassword}
                    value={password}
                />

                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                    <Text style={styles.buttonText}>เข้าสู่ระบบ</Text>
                </TouchableOpacity>

                <Text style={styles.footerText}>
                    หากคุณยังไม่มีบัญชี,{' '}
                    <Text style={styles.linkText} onPress={() => navigation.navigate('Register')}>
                        สร้างบัญชีผู้ใช้
                    </Text>
                </Text>
                <Text style={styles.footerText}>
                    หากคุณลืมรหัสผ่าน,{' '}
                    <Text style={styles.linkText} onPress={() => navigation.navigate('Forgot')}>
                        รีเซ็ตรหัสผ่าน
                    </Text>
                </Text>
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
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#3e3e00',
        textAlign: 'center',
        fontFamily: 'NotoSansThai-Regular',
    },
    input: {
        backgroundColor: '#c8dc8f',
        padding: 10,
        marginVertical: 8,
        borderRadius: 4,
        fontFamily: 'NotoSansThai-Regular',
    },
    button: {
        backgroundColor: '#6b744e',
        padding: 12,
        borderRadius: 6,
        marginTop: 10,
    },
    buttonText: {
        color: '#fff',
        textAlign: 'center',
        fontFamily: 'NotoSansThai-Regular',
    },
    footerText: {
        marginTop: 10,
        textAlign: 'center',
        fontSize: 12,
        fontFamily: 'NotoSansThai-Regular',
    },
    linkText: {
        fontWeight: 'bold',
        color: '#000',
        fontFamily: 'NotoSansThai-Regular',
    },
});

export default LoginScreen;