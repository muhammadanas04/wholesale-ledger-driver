import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useNetInfo } from '@react-native-community/netinfo';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAppStore } from '../../store/app';
import { api } from '../../lib/api';
import { ExpenseCategory, EXPENSE_CATEGORIES } from '../../types';
import ScreenBackground from '../../components/ScreenBackground';
import CategoryPicker from '../../components/CategoryPicker';
import CameraCapture from '../../components/CameraCapture';
import Icon from '../../components/Icon';

export default function ExpensesScreen() {
  const session = useAppStore((s) => s.session);
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;
  const queryClient = useQueryClient();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const selectedCategoryMeta = EXPENSE_CATEGORIES.find((c) => c.key === category);

  // ── Query for past expenses ──
  const { data: expensesData, isLoading: isHistoryLoading, error: historyError } = useQuery({
    queryKey: ['expenses', session?.driverId],
    queryFn: async () => {
      if (!session) return { expenses: [] };
      return api.getExpenses();
    },
    enabled: !!session,
  });

  const handleCapturePhoto = (uri: string) => {
    setImageUri(uri);
    setIsCameraVisible(false);
  };

  const handleSubmitExpense = async () => {
    if (!session) return;

    if (isOffline) {
      Toast.show({
        type: 'error',
        text1: 'You need internet to submit expenses.',
      });
      return;
    }

    // ── Validations ──
    if (!imageUri) {
      Alert.alert('Missing Photo', 'Please take a photo of the expense receipt');
      return;
    }
    if (!category) {
      Alert.alert('Missing Category', 'Please select an expense category');
      return;
    }
    const cleanAmount = amount.trim();
    if (!cleanAmount || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // 1. Upload to Backblaze B2 via Cloudflare Worker Proxy
      const uploadResult = await api.uploadReceipt(imageUri);
      if (!uploadResult.ok || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // 2. Map and submit payload to worker
      const numericAmount = Number(cleanAmount);
      // If it's a price category, convert to paise, otherwise send raw count
      const apiAmount =
        selectedCategoryMeta?.amountType === 'price'
          ? Math.round(numericAmount * 100)
          : Math.round(numericAmount);

      const response = await api.submitExpense({
        category,
        amount: apiAmount,
        note: note.trim() || null,
        image_url: uploadResult.url,
      });

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Expense reported successfully ✓',
        });

        // Invalidate history query to load fresh data
        queryClient.invalidateQueries({ queryKey: ['expenses', session.driverId] });

        // Reset Form
        setImageUri(null);
        setCategory(null);
        setAmount('');
        setNote('');
      } else {
        Alert.alert('Submission Failed', 'Failed to submit expense details to the server.');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Submission Error', err.message || 'Failed to upload photo or reach server. Check your connection.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
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
          {/* Main Expense Form */}
          <Animated.View entering={FadeInDown.duration(400)} className="bg-palette-darker p-6 rounded-3xl border border-palette-dark shadow-sm flex flex-col gap-5 mb-6">
            {/* 1. Camera Section */}
            <View>
              <Text className="text-xs font-bold text-palette-lightest mb-1.5 uppercase tracking-wider">
                Receipt Photo (Required)
              </Text>

              {imageUri ? (
                <View className="relative w-full h-44 rounded-2xl overflow-hidden border border-palette-dark">
                  <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => setIsCameraVisible(true)}
                    activeOpacity={0.8}
                    className="absolute right-3 bottom-3 bg-palette-primary p-2.5 rounded-full shadow-md active:scale-95"
                  >
                    <Icon name={{ ios: 'camera.fill', android: 'photo-camera', web: 'photo-camera' }} size={16} tintColor="#DAF1DE" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsCameraVisible(true)}
                  activeOpacity={0.8}
                  className="w-full h-44 border border-dashed border-palette-primary/30 bg-palette-primary/5 rounded-2xl flex-col items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <View className="w-12 h-12 rounded-full bg-palette-primary/10 items-center justify-center">
                    <Icon name={{ ios: 'camera.fill', android: 'photo-camera', web: 'photo-camera' }} size={24} tintColor="#235347" />
                  </View>
                  <Text className="text-palette-primary text-sm font-bold">Take Receipt Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 2. Category Section */}
            <View>
              <Text className="text-xs font-bold text-palette-lightest mb-1.5 uppercase tracking-wider">
                Category
              </Text>
              <CategoryPicker selectedCategory={category} onSelect={setCategory} />
            </View>

            {/* 3. Dynamic Field Section (Litres vs Amount) */}
            {category && (
              <View>
                <Text className="text-xs font-bold text-palette-lightest mb-1.5 uppercase tracking-wider">
                  {selectedCategoryMeta?.amountType === 'price' ? 'Amount (₹)' : 'Quantity'}
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType={selectedCategoryMeta?.amountType === 'price' ? 'decimal-pad' : 'number-pad'}
                  placeholder={selectedCategoryMeta?.amountPlaceholder}
                  placeholderTextColor="#94A3B8"
                  className="w-full bg-palette-darkest text-palette-lightest px-4 py-3.5 rounded-2xl border border-palette-dark text-base font-bold"
                />
              </View>
            )}

            {/* 4. Note Section */}
            <View>
              <Text className="text-xs font-bold text-palette-lightest mb-1.5 uppercase tracking-wider">
                Note (Optional)
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
                placeholder="Add any specific details about the expense"
                placeholderTextColor="#94A3B8"
                style={{ textAlignVertical: 'top' }}
                className="w-full bg-palette-darkest text-palette-lightest px-4 py-3.5 rounded-2xl border border-palette-dark text-base font-bold h-24"
              />
            </View>

            {/* 5. Uploading Progress */}
            {isSubmitting && uploadProgress > 0 && (
              <View className="flex flex-col gap-1 mt-1">
                <Text className="text-xs text-palette-light font-bold text-right">
                  Uploading Image: {Math.round(uploadProgress * 100)}%
                </Text>
                <View className="w-full h-2 bg-palette-dark rounded-full overflow-hidden">
                  <View style={{ width: `${uploadProgress * 100}%` }} className="h-full bg-palette-primary" />
                </View>
              </View>
            )}

            {/* 6. Submit Button */}
            <TouchableOpacity
              onPress={handleSubmitExpense}
              disabled={isSubmitting}
              activeOpacity={0.8}
              className={`w-full py-4 rounded-2xl items-center justify-center bg-palette-primary active:scale-95 mt-2 ${
                isSubmitting ? 'opacity-70' : ''
              }`}
            >
              {isSubmitting ? (
                <View className="flex-row items-center justify-center gap-2">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-palette-lightest text-lg font-bold">Uploading...</Text>
                </View>
              ) : (
                <Text className="text-palette-lightest text-lg font-bold">Submit Expense</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Submitted Expenses History */}
          {isHistoryLoading && (
            <View className="p-6 items-center">
              <ActivityIndicator size="small" color="#0D9488" />
              <Text className="text-palette-light text-xs font-bold mt-2">Loading expense history...</Text>
            </View>
          )}

          {expensesData?.expenses && expensesData.expenses.length > 0 && (
            <Animated.View entering={FadeInDown.duration(400).delay(100)} className="bg-palette-darker p-5 rounded-3xl border border-palette-dark shadow-sm flex flex-col gap-4 mb-6">
              <Text className="text-palette-lightest text-base font-extrabold">
                Expense History
              </Text>
              <View className="flex flex-col gap-3">
                {expensesData.expenses.map((item: any) => {
                  const catMeta = EXPENSE_CATEGORIES.find((c) => c.key === item.category);
                  const displayAmount = catMeta?.amountType === 'price'
                    ? `₹${(item.amount / 100).toFixed(2)}`
                    : `${item.amount} units`;

                  // Format standard readable timestamp
                  const formattedTime = new Date(item.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  }) + ' ' + new Date(item.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <View key={item.id} className="flex-row items-center justify-between border-b border-palette-dark pb-3">
                      <View className="flex-row items-center gap-3 flex-1">
                        <Image source={{ uri: item.image_url }} className="w-10 h-10 rounded-lg bg-palette-dark" />
                        <View className="flex-1 mr-2">
                          <Text className="text-sm font-bold text-palette-lightest">{catMeta?.label || item.category}</Text>
                          {item.note ? (
                            <Text className="text-xs text-palette-light italic mt-0.5" numberOfLines={2}>{item.note}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View className="items-end shrink-0">
                        <Text className="text-sm font-extrabold text-palette-primary">{displayAmount}</Text>
                        <Text className="text-palette-light text-[10px] mt-0.5">{formattedTime}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Camera Modal */}
      <CameraCapture
        visible={isCameraVisible}
        onCapture={handleCapturePhoto}
        onCancel={() => setIsCameraVisible(false)}
      />
    </ScreenBackground>
  );
}
