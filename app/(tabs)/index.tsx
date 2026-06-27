import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useNavigation } from 'expo-router';
import { useNetInfo } from '@react-native-community/netinfo';

import { useAppStore } from '../../store/app';
import { api } from '../../lib/api';
import { DeliveryItem } from '../../types';
import ScreenBackground from '../../components/ScreenBackground';
import OrderCard from '../../components/OrderCard';
import ProgressBar from '../../components/ProgressBar';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';

type FilterType = 'active' | 'history';

export default function OrdersScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;

  const [activeFilter, setActiveFilter] = useState<FilterType>('active');
  const [editingItem, setEditingItem] = useState<DeliveryItem | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editWeight, setEditWeight] = useState('');

  const logout = useAppStore((s) => s.logout);
  const updateLastOrderReceived = useAppStore((s) => s.updateLastOrderReceived);
  const deductStock = useAppStore((s) => s.deductStock);
  const session = useAppStore((s) => s.session);

  // ── Header Logout Button (Wrapped in useCallback to fix stale closure) ──
  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logout();
          Toast.show({ type: 'info', text1: 'Logged out successfully' });
        },
      },
    ]);
  }, [logout]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: 'My Orders',
      headerRight: () => (
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.7}
          className="mr-4 px-3 py-1.5 bg-red-900/30 rounded-full flex-row items-center gap-1 active:scale-95"
        >
          <Icon
            name={{ ios: 'power', android: 'logout', web: 'logout' }}
            size={14}
            tintColor="#F87171"
          />
          <Text className="text-red-400 font-bold text-xs">Logout</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleLogout]);

  // ── Query for deliveries (polls every 15 seconds, pauses in background) ──
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['my-deliveries'],
    queryFn: async () => {
      const response = await api.getMyDeliveries();
      // Keep auto-logout alive since we successfully pulled data
      await updateLastOrderReceived();
      return response;
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  // ── Optimistic Status Mutation (Done / Reject) ──
  const statusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: 'done' | 'rejected'; qty: number; weight: number }) => {
      const result = await api.updateDeliveryItemStatus(itemId, status);
      if (!result.ok) {
        throw new Error('Server rejected status update');
      }
      return result;
    },
    onMutate: async ({ itemId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['my-deliveries'] });
      const previous = queryClient.getQueryData(['my-deliveries']);

      if (previous) {
        queryClient.setQueryData(['my-deliveries'], {
          deliveries: (previous as any).deliveries.map((d: any) => ({
            ...d,
            items: d.items.map((item: any) =>
              item.id === itemId ? { ...item, status } : item
            ),
          })),
        });
      }
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['my-deliveries'], context.previous);
      }
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: 'Please check your internet connection.',
      });
    },
    onSuccess: (res, variables) => {
      if (variables.status === 'done') {
        deductStock(variables.qty, variables.weight);
        Toast.show({
          type: 'success',
          text1: 'Order completed ✓',
          text2: `Deducted ${variables.qty} qty from stock.`,
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Order marked as rejected ✗',
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
    },
  });

  // ── Optimistic Edit Mutation (Qty / Weight) ──
  const editMutation = useMutation({
    mutationFn: async ({ itemId, qty, weight }: { itemId: string; qty: number; weight: number | null }) => {
      const result = await api.editDeliveryItem(itemId, { qty, weight: weight ?? undefined });
      if (!result.ok) {
        throw new Error('Server rejected edit');
      }
      return result;
    },
    onMutate: async ({ itemId, qty, weight }) => {
      await queryClient.cancelQueries({ queryKey: ['my-deliveries'] });
      const previous = queryClient.getQueryData(['my-deliveries']);

      if (previous) {
        queryClient.setQueryData(['my-deliveries'], {
          deliveries: (previous as any).deliveries.map((d: any) => ({
            ...d,
            items: d.items.map((item: any) =>
              item.id === itemId ? { ...item, qty, weight } : item
            ),
          })),
        });
      }
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['my-deliveries'], context.previous);
      }
      Toast.show({
        type: 'error',
        text1: 'Failed to save edits',
      });
    },
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: 'Order updated ✓',
      });
      setEditingItem(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
    },
  });

  // ── Process and Flatten items ──
  const allItems = data?.deliveries?.flatMap((d) => d.items) || [];

  // Sort: Pending first, then Done, then Rejected
  const sortedItems = [...allItems].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    if (a.status === 'done' && b.status === 'rejected') return -1;
    if (a.status === 'rejected' && b.status === 'done') return 1;
    return 0;
  });

  const filteredItems = sortedItems.filter((item) => {
    if (activeFilter === 'active') return item.status === 'pending';
    if (activeFilter === 'history') return item.status === 'done' || item.status === 'rejected';
    return true;
  });

  // Progress computation (for Active Progress Card)
  const totalItemsCount = allItems.length;
  const completedItemsCount = allItems.filter((i) => i.status === 'done' || i.status === 'rejected').length;
  const doneCount = allItems.filter((i) => i.status === 'done').length;
  const rejectedCount = allItems.filter((i) => i.status === 'rejected').length;
  const pendingCount = allItems.filter((i) => i.status === 'pending').length;

  const handleDoneAction = async (itemId: string, qty: number, weight: number) => {
    if (isOffline) {
      Toast.show({
        type: 'error',
        text1: 'You need internet to update orders.',
      });
      return;
    }
    await statusMutation.mutateAsync({ itemId, status: 'done', qty, weight });
  };

  const handleRejectAction = async (itemId: string) => {
    if (isOffline) {
      Toast.show({
        type: 'error',
        text1: 'You need internet to update orders.',
      });
      return;
    }
    await statusMutation.mutateAsync({ itemId, status: 'rejected', qty: 0, weight: 0 });
  };

  const handleOpenEdit = (item: DeliveryItem) => {
    setEditingItem(item);
    setEditQty(item.qty != null ? item.qty.toString() : '');
    setEditWeight(item.weight != null ? item.weight.toString() : '');
  };

  const handleSaveEdit = async () => {
    if (isOffline) {
      Toast.show({
        type: 'error',
        text1: 'You need internet to update orders.',
      });
      return;
    }
    if (!editingItem) return;

    const qty = parseInt(editQty.trim(), 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Input', 'Quantity must be at least 1');
      return;
    }

    const weight = editWeight.trim() !== '' ? parseFloat(editWeight.trim()) : null;
    if (weight !== null && (isNaN(weight) || weight < 0)) {
      Alert.alert('Invalid Input', 'Weight must be a positive number');
      return;
    }

    await editMutation.mutateAsync({
      itemId: editingItem.id,
      qty,
      weight,
    });
  };

  const renderFilterPill = (filter: FilterType, label: string) => {
    const isSelected = activeFilter === filter;
    return (
      <TouchableOpacity
        key={filter}
        onPress={() => setActiveFilter(filter)}
        activeOpacity={0.8}
        className={`px-5 py-2.5 rounded-full border ${isSelected
            ? 'bg-[#0D9488] border-[#0D9488]'
            : 'bg-slate-800 border-slate-700'
          } active:scale-95`}
      >
        <Text
          className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-400'
            }`}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <ScreenBackground className="justify-center items-center">
        <ActivityIndicator size="large" color="#0D9488" />
        <Text className="text-slate-500 font-bold mt-4 text-sm">
          Loading orders...
        </Text>
      </ScreenBackground>
    );
  }

  // ── Error State UI block (resolves Issue #17) ──
  if (error) {
    return (
      <ScreenBackground className="justify-center items-center p-6">
        <Icon name={{ ios: 'exclamationmark.triangle.fill', android: 'report-problem', web: 'report-problem' }} size={48} tintColor="#EF4444" />
        <Text className="text-slate-100 text-lg font-bold mt-4 text-center">
          Failed to load orders
        </Text>
        <Text className="text-slate-400 text-sm mt-2 text-center max-w-[280px] mb-4">
          {error instanceof Error ? error.message : 'Please check your connection and try again.'}
        </Text>

        <View className="flex-row gap-4 w-full px-4">
          <TouchableOpacity
            onPress={() => refetch()}
            activeOpacity={0.8}
            className="bg-[#0D9488] py-4 rounded-2xl active:scale-95 flex-1 items-center"
          >
            <Text className="text-white font-bold text-base">Retry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.8}
            className="bg-red-900/30 border border-red-900/50 py-4 rounded-2xl active:scale-95 flex-1 items-center"
          >
            <Text className="text-red-400 font-bold text-base">Logout</Text>
          </TouchableOpacity>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      {/* ── Active Progress Card (Misleading label fixed to All Delivery Progress) ── */}
      {totalItemsCount > 0 && (
        <Animated.View entering={FadeInDown.duration(400)} className="bg-slate-800 m-4 p-5 rounded-3xl border border-slate-700 shadow-sm flex flex-col gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              All Delivery Progress
            </Text>
            <Text className="text-slate-100 text-sm font-extrabold">
              {completedItemsCount} / {totalItemsCount} Done
            </Text>
          </View>
          <ProgressBar completed={completedItemsCount} total={totalItemsCount} />
          <View className="flex-row justify-between border-t border-slate-700 pt-3">
            <View className="flex-row items-center gap-1.5 bg-amber-900/30 px-3 py-1.5 rounded-full">
              <Icon name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={12} tintColor="#FBBF24" />
              <Text className="text-amber-400 font-bold text-xs">{pendingCount} Pending</Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-emerald-900/30 px-3 py-1.5 rounded-full">
              <Icon name={{ ios: 'checkmark.circle.fill', android: 'check-circle', web: 'check-circle' }} size={12} tintColor="#34D399" />
              <Text className="text-emerald-400 font-bold text-xs">{doneCount} Done</Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-red-900/30 px-3 py-1.5 rounded-full">
              <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={12} tintColor="#F87171" />
              <Text className="text-red-400 font-bold text-xs">{rejectedCount} Rejected</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── Filter row ── */}
      <View className="px-4 pb-3 flex-row gap-2.5">
        {renderFilterPill('active', 'Active')}
        {renderFilterPill('history', 'History')}
      </View>

      {/* ── Delivery Item list ── */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OrderCard
            item={item}
            onDone={handleDoneAction}
            onReject={handleRejectAction}
            onEdit={handleOpenEdit}
            isMutating={statusMutation.isPending && statusMutation.variables?.itemId === item.id}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState
            icon={{ ios: 'list.bullet.clipboard', android: 'assignment', web: 'assignment' }}
            title={activeFilter === 'active' ? 'No active orders' : 'No order history'}
            subtitle={
              activeFilter === 'active'
                ? 'Pending assignments will appear here.'
                : 'Completed or rejected orders will appear here.'
            }
          />
        }
      />

      {/* ── Edit Order details modal ── */}
      <Modal
        visible={editingItem !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingItem(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="bg-slate-900 rounded-t-[32dp] px-6 py-8 flex flex-col gap-6">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xl font-extrabold text-slate-100">
                Edit Order Details
              </Text>
              <TouchableOpacity
                onPress={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-slate-800 justify-center items-center"
              >
                <Icon
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={16}
                  tintColor="#64748B"
                />
              </TouchableOpacity>
            </View>

            <View className="flex flex-col gap-4">
              <View>
                <Text className="text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Quantity (Required)
                </Text>
                <TextInput
                  value={editQty}
                  onChangeText={setEditQty}
                  keyboardType="number-pad"
                  placeholder="Enter Quantity"
                  placeholderTextColor="#94A3B8"
                  className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3.5 text-base text-white font-bold"
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Weight in kg (Optional)
                </Text>
                <TextInput
                  value={editWeight}
                  onChangeText={setEditWeight}
                  keyboardType="decimal-pad"
                  placeholder="Enter Weight"
                  placeholderTextColor="#94A3B8"
                  className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3.5 text-base text-white font-bold"
                />
              </View>
            </View>

            <View className="flex flex-col gap-3 mt-2">
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={editMutation.isPending}
                activeOpacity={0.8}
                className={`w-full bg-[#0D9488] py-4 rounded-2xl items-center justify-center active:scale-95 ${editMutation.isPending ? 'opacity-50' : ''
                  }`}
              >
                {editMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-lg">Save Changes</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditingItem(null)}
                activeOpacity={0.8}
                className="w-full py-4 rounded-2xl items-center justify-center border border-slate-700 active:scale-95"
              >
                <Text className="text-slate-300 font-bold text-base">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenBackground>
  );
}
