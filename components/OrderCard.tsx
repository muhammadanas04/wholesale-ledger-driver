import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert, TextInput } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from './Icon';
import { DeliveryItem } from '../types';

interface OrderCardProps {
  item: DeliveryItem;
  onDone: (itemId: string, qty: number, weight: number) => Promise<void>;
  onReject: (itemId: string) => Promise<void>;
  onEdit: (item: DeliveryItem) => void;
  isReadOnly?: boolean;
  isMutating?: boolean;
}

export default function OrderCard({
  item,
  onDone,
  onReject,
  onEdit,
  isReadOnly = false,
  isMutating = false,
}: OrderCardProps) {
  const [isEnteringWeight, setIsEnteringWeight] = useState(false);
  const [tempWeight, setTempWeight] = useState('');

  const isPending = item.status === 'pending';
  const isDone = item.status === 'done';
  const isRejected = item.status === 'rejected';

  const formatPrice = (paise: number) => {
    const rupees = paise / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(rupees);
  };

  const handleCall = () => {
    if (item.customer_phone) {
      Linking.openURL(`tel:${item.customer_phone}`);
    }
  };

  const handleDoneClick = () => {
    if (!item.weight) {
      setIsEnteringWeight(true);
    } else {
      confirmDone();
    }
  };

  const confirmDone = (customWeight?: number) => {
    const finalWeight = customWeight !== undefined ? customWeight : (item.weight ?? 0);
    Alert.alert(
      'Mark as Done?',
      `${item.customer_name || 'Unknown Customer'}\nQuantity: ${item.qty ?? item.stock_amount ?? 0}${finalWeight ? ` · Weight: ${finalWeight} kg` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => onDone(item.id, item.qty ?? item.stock_amount ?? 0, finalWeight),
        },
      ]
    );
  };

  const confirmReject = () => {
    Alert.alert(
      'Reject this order?',
      `${item.customer_name || 'Unknown Customer'}\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => onReject(item.id),
        },
      ]
    );
  };

  return (
    <Animated.View 
      entering={FadeInDown.duration(300)} 
      className={`relative p-5 bg-brand-deep border ${
        isDone 
          ? 'border-brand-petrol/65' 
          : isRejected 
          ? 'border-brand-brown/40' 
          : 'border-brand-petrol/30'
      } rounded-3xl shadow-lg overflow-hidden flex-col mb-4`}
    >
      <View 
        className={`absolute top-0 left-0 bottom-0 w-1.5 ${
          isDone 
            ? 'bg-brand-petrol' 
            : isRejected 
            ? 'bg-brand-brown' 
            : 'bg-brand-steel'
        }`} 
      />

      <View className="flex-row justify-between items-start">
        <View className="flex-row items-center gap-3 flex-1 mr-2">
          <View 
            className={`w-6 h-6 rounded-full items-center justify-center border-2 ${
              isDone 
                ? 'bg-brand-petrol/20 border-brand-petrol' 
                : isRejected 
                ? 'bg-brand-brown/20 border-brand-brown' 
                : 'bg-brand-darkest border-brand-steel/40'
            }`}
          >
            {isDone && <Icon name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={12} tintColor="#C9C2C2" />}
            {isPending && <Icon name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={12} tintColor="#7F8C94" />}
            {isRejected && <Icon name={{ ios: 'xmark', android: 'close', web: 'close' }} size={12} tintColor="#7F8C94" />}
          </View>
          <View className="flex-1">
            <Text className="text-brand-silver font-bold text-base tracking-tight leading-tight">
              {item.customer_name || 'Unknown Customer'}
            </Text>
            {item.customer_phone ? (
              <TouchableOpacity onPress={handleCall} className="flex-row items-center gap-1.5 mt-0.5">
                <Icon name={{ ios: 'phone.fill', android: 'call', web: 'call' }} size={12} tintColor="#7F8C94" />
                <Text className="text-brand-steel font-bold text-xs">
                  {item.customer_phone}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <View 
            className={`px-2.5 py-1 rounded-full border flex-row items-center gap-1 ${
              isDone 
                ? 'bg-brand-petrol/10 border-brand-petrol/40' 
                : isRejected 
                ? 'bg-brand-brown/10 border-brand-brown/30' 
                : 'bg-brand-darkest border-brand-steel/20'
            }`}
          >
            <Text 
              className={`text-[11px] font-semibold ${
                isDone 
                  ? 'text-brand-silver' 
                  : 'text-brand-steel'
              }`}
            >
              {item.status === 'done' ? 'Done' : item.status === 'rejected' ? 'Rejected' : 'Pending'}
            </Text>
            {isDone && <Text className="text-[10px] text-brand-silver opacity-60">✓</Text>}
          </View>
        </View>
      </View>

      {item.address ? (
        <View className="mt-4 bg-brand-darkest border border-brand-petrol/30 rounded-xl px-3 py-2 flex-row items-center gap-2 self-start">
          <Icon name={{ ios: 'mappin.and.ellipse', android: 'location-on', web: 'location-on' }} size={12} tintColor="#7F8C94" />
          <Text className="text-xs text-brand-silver font-medium">{item.address}</Text>
        </View>
      ) : null}

      <View className="mt-4 flex-row items-center gap-2.5">
        <View className="bg-brand-darkest/60 border border-brand-petrol/30 rounded-xl px-3.5 py-1.5 items-center">
          <Text className="text-[10px] uppercase font-bold tracking-wider text-brand-steel">QTY</Text>
          <Text className="text-sm font-bold text-brand-silver">{item.qty ?? item.stock_amount ?? 0}</Text>
        </View>
        
        {item.weight !== null && item.weight !== undefined ? (
          <View className="bg-brand-darkest/60 border border-brand-petrol/30 rounded-xl px-3.5 py-1.5 items-center">
            <Text className="text-[10px] uppercase font-bold tracking-wider text-brand-steel">WEIGHT</Text>
            <Text className="text-sm font-bold text-brand-silver">{item.weight} kg</Text>
          </View>
        ) : null}

        {item.total_price !== null && item.total_price !== undefined ? (
          <View className="bg-brand-darkest/60 border border-brand-petrol/30 rounded-xl px-3.5 py-1.5 items-center">
            <Text className="text-[10px] uppercase font-bold tracking-wider text-brand-steel">PRICE</Text>
            <Text className="text-sm font-bold text-brand-silver">{formatPrice(item.total_price)}</Text>
          </View>
        ) : null}
      </View>

      {item.notes ? (
        <View className="mt-3 pt-3 border-t border-brand-petrol/30">
          <Text className="text-xs italic text-brand-steel font-medium leading-relaxed">
            Note: {item.notes}
          </Text>
        </View>
      ) : null}

      {isPending && !isReadOnly && (
        <View className="flex-col gap-2.5 mt-3 border-t border-brand-petrol/30 pt-4">
          {isEnteringWeight ? (
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-brand-darkest border border-brand-petrol/40 rounded-2xl px-4 py-3 text-brand-silver text-sm font-bold"
                placeholder="Weight (kg)"
                placeholderTextColor="#7F8C94"
                keyboardType="numeric"
                value={tempWeight}
                onChangeText={setTempWeight}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => {
                  if (!tempWeight) {
                    Alert.alert('Error', 'Please enter a valid weight');
                    return;
                  }
                  const weightNum = parseFloat(tempWeight);
                  if (isNaN(weightNum)) {
                    Alert.alert('Error', 'Please enter a valid number');
                    return;
                  }
                  setIsEnteringWeight(false);
                  onDone(item.id, item.qty ?? item.stock_amount ?? 0, weightNum);
                }}
                disabled={isMutating}
                className={`px-5 py-3 bg-brand-petrol rounded-2xl items-center justify-center active:scale-95 ${
                  isMutating ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-brand-silver text-sm font-bold">Save ✓</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsEnteringWeight(false);
                  setTempWeight('');
                }}
                disabled={isMutating}
                className={`px-5 py-3 bg-brand-darkest border border-brand-brown/40 rounded-2xl items-center justify-center active:scale-95 ${
                  isMutating ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-brand-steel text-sm font-bold">Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={handleDoneClick}
                disabled={isMutating}
                activeOpacity={0.8}
                className={`flex-1 py-3 bg-brand-petrol rounded-2xl items-center justify-center active:scale-95 ${
                  isMutating ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-brand-silver text-sm font-bold">Done ✓</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmReject}
                disabled={isMutating}
                activeOpacity={0.8}
                className={`flex-1 py-3 bg-brand-darkest border border-brand-brown/40 rounded-2xl items-center justify-center active:scale-95 ${
                  isMutating ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-brand-steel text-sm font-bold">Reject ✗</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onEdit(item)}
                disabled={isMutating}
                activeOpacity={0.8}
                className={`px-5 py-3 bg-brand-darkest border border-brand-petrol/40 rounded-2xl items-center justify-center active:scale-95 ${
                  isMutating ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-brand-silver text-sm font-bold">Edit ✎</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}
