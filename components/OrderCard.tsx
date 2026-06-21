import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
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
  const isPending = item.status === 'pending';

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

  const confirmDone = () => {
    Alert.alert(
      'Mark as Done?',
      `${item.customer_name || 'Unknown Customer'}\nQuantity: ${item.qty ?? 0}${item.weight ? ` · Weight: ${item.weight} kg` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => onDone(item.id, item.qty ?? 0, item.weight ?? 0),
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
    <Animated.View entering={FadeInDown.duration(300)} style={{ borderLeftWidth: 3, borderLeftColor: isPending ? '#0D9488' : item.status === 'done' ? '#10B981' : '#EF4444' }} className="bg-white rounded-3xl p-5 mb-4 border border-slate-100 shadow-md flex flex-col gap-4">
      {/* Top row: Customer name & status badge */}
      <View className="flex-row justify-between items-start">
        <View className="flex-row items-center gap-3 flex-1 mr-2">
          {/* Status Indicator Dot */}
          <View className="w-10 h-10 rounded-full items-center justify-center bg-slate-50">
            {item.status === 'done' ? (
              <Icon name={{ ios: 'checkmark.circle.fill', android: 'check-circle', web: 'check-circle' }} size={24} tintColor="#10B981" />
            ) : item.status === 'rejected' ? (
              <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={24} tintColor="#EF4444" />
            ) : (
              <Icon name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={24} tintColor="#F59E0B" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-slate-800 leading-snug">
              {item.customer_name || 'Unknown Customer'}
            </Text>
            {item.customer_phone ? (
              <TouchableOpacity onPress={handleCall} className="flex-row items-center gap-1.5 mt-0.5">
                <Icon name={{ ios: 'phone.fill', android: 'call', web: 'call' }} size={13} tintColor="#0D9488" />
                <Text className="text-[#0D9488] font-bold text-sm">
                  {item.customer_phone}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Status Badge */}
        <View
          className={`px-3 py-1.5 rounded-full ${
            item.status === 'done'
              ? 'bg-emerald-50'
              : item.status === 'rejected'
              ? 'bg-red-50'
              : 'bg-amber-50'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              item.status === 'done'
                ? 'text-emerald-700'
                : item.status === 'rejected'
                ? 'text-red-700'
                : 'text-amber-700'
            }`}
          >
            {item.status === 'done'
              ? 'Done ✓'
              : item.status === 'rejected'
              ? 'Rejected ✗'
              : 'Pending'}
          </Text>
        </View>
      </View>

      {/* Address */}
      {item.address ? (
        <View className="flex-row items-start gap-1.5 bg-slate-50 p-3.5 rounded-2xl">
          <Text className="text-slate-500 mt-0.5">📍</Text>
          <Text className="text-slate-600 text-sm flex-1 leading-relaxed">
            {item.address}
          </Text>
        </View>
      ) : null}

      {/* Items Details: Qty, Weight, Price Badges */}
      <View className="flex-row flex-wrap gap-2">
        <View className="bg-slate-100 px-3.5 py-2 rounded-xl">
          <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Qty</Text>
          <Text className="text-base font-extrabold text-slate-800 mt-0.5">{item.qty ?? 0}</Text>
        </View>

        {item.weight !== null && item.weight !== undefined ? (
          <View className="bg-slate-100 px-3.5 py-2 rounded-xl">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weight</Text>
            <Text className="text-base font-extrabold text-slate-800 mt-0.5">{item.weight} kg</Text>
          </View>
        ) : null}

        {item.total_price !== null && item.total_price !== undefined ? (
          <View className="bg-slate-100 px-3.5 py-2 rounded-xl">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Price</Text>
            <Text className="text-base font-extrabold text-[#0D9488] mt-0.5">
              {formatPrice(item.total_price)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Notes */}
      {item.notes ? (
        <View className="border-t border-slate-100 pt-3 flex-row gap-1">
          <Text className="text-xs italic text-slate-500 font-medium leading-relaxed">
            Note: {item.notes}
          </Text>
        </View>
      ) : null}

      {/* Action Buttons (Only shown if pending & not read-only) */}
      {isPending && !isReadOnly && (
        <View className="flex-row gap-2.5 mt-2 border-t border-slate-100 pt-4">
          <TouchableOpacity
            onPress={confirmDone}
            disabled={isMutating}
            activeOpacity={0.8}
            className={`flex-1 py-3.5 bg-emerald-600 rounded-2xl items-center justify-center active:scale-95 ${
              isMutating ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-white text-base font-bold">Done ✓</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={confirmReject}
            disabled={isMutating}
            activeOpacity={0.8}
            className={`flex-1 py-3.5 bg-red-600 rounded-2xl items-center justify-center active:scale-95 ${
              isMutating ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-white text-base font-bold">Reject ✗</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onEdit(item)}
            disabled={isMutating}
            activeOpacity={0.8}
            className={`px-5 py-3.5 bg-slate-100 rounded-2xl items-center justify-center active:scale-95 ${
              isMutating ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-slate-700 text-base font-bold">Edit ✎</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}
