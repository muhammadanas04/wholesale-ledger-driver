import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from '../../components/Icon';
import Toast from 'react-native-toast-message';

import { useAppStore } from '../../store/app';
import ScreenBackground from '../../components/ScreenBackground';

export default function StockScreen() {
  const stock = useAppStore((s) => s.stock);
  const setStock = useAppStore((s) => s.setStock);

  const [inputQty, setInputQty] = useState('');
  const [inputWeight, setInputWeight] = useState('');

  const handleUpdateStock = () => {
    const qty = parseInt(inputQty.trim(), 10);
    if (inputQty.trim() === '' || isNaN(qty) || qty < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive quantity');
      return;
    }

    const weight = parseFloat(inputWeight.trim());
    if (inputWeight.trim() === '' || isNaN(weight) || weight < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive weight');
      return;
    }

    setStock({ qty, weight });
    Toast.show({
      type: 'success',
      text1: 'Stock updated successfully ✓',
      text2: `Carrying ${qty} items (${weight} kg)`,
    });

    // Clear inputs
    setInputQty('');
    setInputWeight('');
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          className="p-4"
          keyboardShouldPersistTaps="handled"
        >
          {/* Current Stock Dashboard */}
          <Animated.View entering={FadeInDown.duration(400)} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4 mb-6">
            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
              Current Carried Stock
            </Text>

            <View className="flex-row gap-4">
              {/* Qty Card */}
              <View className="flex-1 bg-[#0D9488]/5 p-5 rounded-2xl border border-[#0D9488]/10 items-center justify-center gap-1.5">
                <Icon name={{ ios: 'shippingbox.fill', android: 'inventory-2', web: 'inventory-2' }} size={24} tintColor="#0D9488" />
                <Text className="text-[#0D9488] text-3xl font-extrabold mt-1">
                  {stock.qty}
                </Text>
                <Text className="text-slate-600 font-bold text-sm">
                  Items
                </Text>
              </View>

              {/* Weight Card */}
              <View className="flex-1 bg-[#0284C7]/5 p-5 rounded-2xl border border-[#0284C7]/10 items-center justify-center gap-1.5">
                <Icon name={{ ios: 'scalemass.fill', android: 'fitness-center', web: 'fitness-center' }} size={24} tintColor="#0284C7" />
                <Text className="text-[#0284C7] text-3xl font-extrabold mt-1">
                  {Number(stock.weight.toFixed(2))}
                </Text>
                <Text className="text-slate-600 font-bold text-sm">
                  kg Carrying
                </Text>
              </View>
            </View>

            <Text className="text-slate-400 text-xs font-bold text-center mt-1">
              Values decrease automatically as deliveries are marked Done.
            </Text>
          </Animated.View>

          {/* Update Stock Form */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5 mb-6">
            <Text className="text-slate-800 text-lg font-extrabold mb-1">
              Load Carrying Stock
            </Text>

            <View className="flex flex-col gap-4">
              <View>
                <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Quantity
                </Text>
                <TextInput
                  value={inputQty}
                  onChangeText={setInputQty}
                  keyboardType="number-pad"
                  placeholder="Enter total items carrying"
                  placeholderTextColor="#94A3B8"
                  className="w-full bg-slate-50 text-[#111115] px-4 py-3.5 rounded-2xl border border-slate-200 text-base font-bold"
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Weight (kg)
                </Text>
                <TextInput
                  value={inputWeight}
                  onChangeText={setInputWeight}
                  keyboardType="decimal-pad"
                  placeholder="Enter total weight in kg"
                  placeholderTextColor="#94A3B8"
                  className="w-full bg-slate-50 text-[#111115] px-4 py-3.5 rounded-2xl border border-slate-200 text-base font-bold"
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleUpdateStock}
              disabled={false}
              activeOpacity={0.8}
              className="w-full bg-[#0D9488] py-4 rounded-2xl items-center justify-center active:scale-95 mt-2"
            >
              <Text className="text-white text-lg font-bold">Set Stock</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Info Card */}
          <View className="bg-slate-100 p-5 rounded-3xl border border-slate-200/50 flex-row gap-3 items-center">
            <Icon
              name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }}
              size={24}
              tintColor="#475569"
            />
            <Text className="text-slate-600 text-xs font-bold leading-relaxed flex-1">
              Note: This sets the exact stock amount carried. There is only one type of wholesale item.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
