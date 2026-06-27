import React, { useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { api, WORKER_URL } from '../lib/api';
import { useAppStore } from '../store/app';
import Toast from 'react-native-toast-message';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  const loginAction = useAppStore((s) => s.login);

  const handleLogin = async () => {
    setError(null);

    // ── Input Validation ──
    const cleanPhone = phone.trim();
    if (cleanPhone.length !== 10 || !/^\d+$/.test(cleanPhone)) {
      setError('Phone number must be 10 digits');
      return;
    }

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d+$/.test(cleanOtp)) {
      setError('OTP must be 6 digits');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.authenticate(WORKER_URL, cleanPhone, cleanOtp);

      if (response.ok && response.driver_id && response.name && response.token) {
        await loginAction({
          driverId: response.driver_id,
          driverName: response.name,
          phone: cleanPhone,
          workerUrl: WORKER_URL,
          token: response.token,
          loginTimestamp: new Date().toISOString(),
          lastOrderReceivedAt: new Date().toISOString(),
        });
        Toast.show({
          type: 'success',
          text1: `Welcome, ${response.name}!`,
        });
      } else {
        setError(response.error || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      console.log('[Login] Authentication failed:', err);
      setError('Cannot reach server. Check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6"
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.duration(400)} className="items-center mb-8">
            <View className="absolute -top-6 w-40 h-40 bg-[#0D9488]/5 rounded-full" />
            <View className="w-20 h-20 bg-[#0D9488]/10 rounded-3xl justify-center items-center mb-4">
              <Icon
                name={{ ios: 'car.fill', android: 'local-shipping', web: 'local-shipping' }}
                size={44}
                tintColor="#0D9488"
              />
            </View>
            <Text className="text-3xl font-extrabold text-[#0D9488]">
              Wholesale Driver
            </Text>
            <Text className="text-sm text-slate-400 mt-1">
              Enter your details to get started
            </Text>
          </Animated.View>

          {/* Form Fields */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} className="flex flex-col gap-4 mb-6">
            <View>
              <Text className="text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Phone Number
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter 10-digit phone number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                maxLength={10}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                className={`w-full bg-[#1C1C1E] text-white px-4 py-3.5 rounded-2xl border ${phoneFocused ? 'border-[#0D9488]' : 'border-[#2C2C2E]'} text-base`}
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                OTP
              </Text>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="Enter 6-digit OTP from admin"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={6}
                onFocus={() => setOtpFocused(true)}
                onBlur={() => setOtpFocused(false)}
                className={`w-full bg-[#1C1C1E] text-white px-4 py-3.5 rounded-2xl border ${otpFocused ? 'border-[#0D9488]' : 'border-[#2C2C2E]'} text-base`}
              />
            </View>
          </Animated.View>

          {/* Error message */}
          {error && (
            <View className="bg-red-900/30 border border-red-900/50 px-4 py-3 rounded-2xl mb-6">
              <Text className="text-sm text-red-400 font-semibold text-center">
                {error}
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)}>
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
              className={`w-full py-4 rounded-2xl items-center justify-center bg-[#0D9488] active:scale-95 ${
                isLoading ? 'opacity-80' : ''
              }`}
            >
              {isLoading ? (
                <View className="flex-row items-center justify-center gap-2">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white text-lg font-bold">
                    Logging in...
                  </Text>
                </View>
              ) : (
                <Text className="text-white text-lg font-bold">Login</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
