import { useNetInfo } from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import OrderCard from '../../components/OrderCard';
import ProgressBar from '../../components/ProgressBar';
import ScreenBackground from '../../components/ScreenBackground';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/app';
import { DeliveryItem } from '../../types';

type FilterType = 'active' | 'history';

export default function OrdersScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;

  const [activeFilter, setActiveFilter] = useState<FilterType>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<DeliveryItem | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [hasSubmittedEdit, setHasSubmittedEdit] = useState(false);

  // ── Create Order State ──
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createQty, setCreateQty] = useState('');
  const [createWeight, setCreateWeight] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasSubmittedCreate, setHasSubmittedCreate] = useState(false);

  const logout = useAppStore((s) => s.logout);
  const stock = useAppStore((s) => s.stock);
  const setStock = useAppStore((s) => s.setStock);
  const [isStockModalVisible, setIsStockModalVisible] = useState(false);
  const [stockInputQty, setStockInputQty] = useState('');
  const [stockInputWeight, setStockInputWeight] = useState('');
  
  const handleUpdateStock = () => {
    const qty = parseInt(stockInputQty.trim(), 10);
    if (stockInputQty.trim() === '' || isNaN(qty) || qty < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive quantity');
      return;
    }
    const weight = parseFloat(stockInputWeight.trim());
    if (stockInputWeight.trim() === '' || isNaN(weight) || weight < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive weight');
      return;
    }
    setStock({ qty, weight });
    Toast.show({
      type: 'success',
      text1: 'Stock updated successfully ✓',
    });
    setIsStockModalVisible(false);
  };
  
  const openStockEdit = () => {
    setStockInputQty(stock.qty.toString());
    setStockInputWeight(stock.weight.toString());
    setIsStockModalVisible(true);
  };
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
      headerShown: false,
    });
  }, [navigation]);

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

  // ── Query for customers ──
  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      return await api.getCustomers();
    },
    enabled: isCreateModalVisible,
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

  // ── Optimistic Create Mutation ──
  const createMutation = useMutation({
    mutationFn: async (data: { customer_name: string; address: string; qty: number; weight: number }) => {
      const result = await api.createDeliveryItem(data);
      if (!result.ok) {
        throw new Error('Server rejected creation');
      }
      return result;
    },
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: 'Order created ✓',
      });
      setIsCreateModalVisible(false);
      setCreateName('');
      setCreateAddress('');
      setCreateQty('');
      setCreateWeight('');
      setHasSubmittedCreate(false);
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: 'Failed to create order',
      });
    }
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
    if (activeFilter === 'active' && item.status !== 'pending') return false;
    if (activeFilter === 'history' && item.status !== 'done' && item.status !== 'rejected') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = item.customer_name?.toLowerCase().includes(q);
      const addressMatch = item.address?.toLowerCase().includes(q);
      if (!nameMatch && !addressMatch) return false;
    }
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
    const initialQty = item.qty ?? item.stock_amount;
    setEditQty(initialQty != null ? initialQty.toString() : '');
    setEditWeight(item.weight != null ? item.weight.toString() : '');
    setHasSubmittedEdit(false);
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

    setHasSubmittedEdit(true);
    if (editQty.trim() === '' || editWeight.trim() === '') {
      return;
    }

    const qty = parseInt(editQty.trim(), 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Input', 'Quantity must be at least 1');
      return;
    }

    const weight = parseFloat(editWeight.trim());
    if (isNaN(weight) || weight < 0) {
      Alert.alert('Invalid Input', 'Weight must be a positive number');
      return;
    }

    await editMutation.mutateAsync({
      itemId: editingItem.id,
      qty,
      weight,
    });
  };

  const filteredCustomers = customersData?.customers.filter(c =>
    c.name.toLowerCase().includes(createName.toLowerCase())
  ) || [];

  const handleSelectCustomer = (customer: { name: string; address: string }) => {
    setCreateName(customer.name);
    setCreateAddress(customer.address);
    setShowSuggestions(false);
  };

  const handleSaveCreate = async () => {
    if (isOffline) {
      Toast.show({ type: 'error', text1: 'You need internet to create orders.' });
      return;
    }
    setHasSubmittedCreate(true);
    if (!createName.trim() || !createQty.trim() || !createWeight.trim()) return;

    const qty = parseInt(createQty.trim(), 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Input', 'Quantity must be at least 1');
      return;
    }

    const weight = parseFloat(createWeight.trim());
    if (isNaN(weight) || weight < 0) {
      Alert.alert('Invalid Input', 'Weight must be a positive number');
      return;
    }

    await createMutation.mutateAsync({
      customer_name: createName.trim(),
      address: createAddress.trim(),
      qty,
      weight,
    });
  };


  if (isLoading) {
    return (
      <ScreenBackground className="justify-center items-center">
        <ActivityIndicator size="large" color="#234C58" />
        <Text className="text-brand-steel font-bold mt-4 text-sm">
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
        <Text className="text-brand-silver text-lg font-bold mt-4 text-center">
          Failed to load orders
        </Text>
        <Text className="text-brand-steel text-sm mt-2 text-center max-w-[280px] mb-4">
          {error instanceof Error ? error.message : 'Please check your connection and try again.'}
        </Text>

        <View className="flex-row gap-4 w-full px-4">
          <TouchableOpacity
            onPress={() => refetch()}
            activeOpacity={0.8}
            className="bg-brand-petrol py-4 rounded-2xl active:scale-95 flex-1 items-center"
          >
            <Text className="text-brand-silver font-bold text-base">Retry</Text>
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
      {/* ── Custom Header ── */}
      <View className="px-6 pt-6 pb-2">
        <Text className="text-brand-steel text-[10px] font-bold tracking-[0.15em] mb-1">
          OPERATIONAL DISPATCH
        </Text>
        <View className="flex-row justify-between items-center">
          <Text className="text-brand-silver text-[28px] font-extrabold tracking-tight">
            My Orders
          </Text>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => refetch()}
              className="w-10 h-10 bg-brand-deep rounded-2xl border border-brand-petrol/40 items-center justify-center active:scale-95"
            >
              <Icon name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} size={16} tintColor="#7F8C94" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('expenses')}
              className="w-10 h-10 bg-brand-deep rounded-2xl border border-brand-petrol/40 items-center justify-center active:scale-95"
            >
              <Icon name={{ ios: 'indianrupeesign.circle', android: 'receipt', web: 'receipt' }} size={16} tintColor="#7F8C94" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              className="w-10 h-10 bg-brand-deep rounded-2xl border border-brand-petrol/40 items-center justify-center active:scale-95"
            >
              <Icon name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={16} tintColor="#7F8C94" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Stock Information ── */}
      <Animated.View entering={FadeInDown.duration(400)} className="bg-brand-deep m-4 mb-0 p-5 rounded-3xl border border-brand-petrol/40 shadow-sm flex flex-col gap-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-brand-steel text-xs font-bold tracking-[0.1em] uppercase">
            Current Stock
          </Text>
          <TouchableOpacity onPress={openStockEdit} className="bg-brand-darkest px-4 py-1.5 rounded-full flex-row items-center gap-1.5 border border-brand-petrol/40">
            <Icon name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={10} tintColor="#C9C2C2" />
            <Text className="text-brand-silver font-bold text-[11px]">Edit</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-4">
          <View className="flex-1 bg-brand-darkest p-5 rounded-[24px] items-center justify-center gap-2">
            <View className="w-10 h-10 rounded-full border border-brand-petrol/40 items-center justify-center bg-brand-petrol/10 mb-1">
              <Icon name={{ ios: 'shippingbox.fill', android: 'inventory-2', web: 'inventory-2' }} size={16} tintColor="#C9C2C2" />
            </View>
            <Text className="text-brand-silver text-[28px] font-extrabold tracking-tight leading-none">{stock.qty}</Text>
            <Text className="text-brand-steel font-mono text-[11px]">Items</Text>
          </View>
          <View className="flex-1 bg-brand-darkest p-5 rounded-[24px] items-center justify-center gap-2">
            <View className="w-10 h-10 rounded-full border border-brand-petrol/40 items-center justify-center bg-brand-petrol/10 mb-1">
              <Icon name={{ ios: 'scalemass.fill', android: 'fitness-center', web: 'fitness-center' }} size={16} tintColor="#C9C2C2" />
            </View>
            <Text className="text-brand-silver text-[28px] font-extrabold tracking-tight leading-none">{Number(stock.weight.toFixed(2))}</Text>
            <Text className="text-brand-steel font-mono text-[11px]">kg</Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Active Progress Card (Misleading label fixed to All Delivery Progress) ── */}
      {totalItemsCount > 0 && (
        <Animated.View entering={FadeInDown.duration(400)} className="bg-brand-deep m-4 p-5 rounded-3xl border border-brand-petrol/40 shadow-sm flex flex-col gap-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-brand-steel text-xs font-bold tracking-[0.1em] uppercase">
              Delivery Progress
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-brand-silver text-[11px] font-bold">
                {completedItemsCount} / {totalItemsCount} Done
              </Text>
              <View className="bg-brand-petrol/20 px-2 py-0.5 rounded border border-brand-petrol/40">
                <Text className="text-brand-silver text-[10px] font-bold">{Math.round((completedItemsCount / totalItemsCount) * 100)}%</Text>
              </View>
            </View>
          </View>
          <ProgressBar completed={completedItemsCount} total={totalItemsCount} />
          <View className="flex-row justify-between pt-1">
            <View className="flex-row items-center gap-1.5 bg-brand-darkest px-3 py-2 rounded-xl border border-brand-petrol/20">
              <Icon name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={12} tintColor="#7F8C94" />
              <Text className="text-brand-silver font-bold text-[11px]">{pendingCount} Pending</Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-brand-darkest px-3 py-2 rounded-xl border border-brand-petrol/20">
              <Icon name={{ ios: 'checkmark.circle.fill', android: 'check-circle', web: 'check-circle' }} size={12} tintColor="#C9C2C2" />
              <Text className="text-brand-silver font-bold text-[11px]">{doneCount} Done</Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-brand-darkest px-3 py-2 rounded-xl border border-brand-petrol/20">
              <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={12} tintColor="#7F8C94" />
              <Text className="text-brand-silver font-bold text-[11px]">{rejectedCount} Rejected</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── Filter & Search row ── */}
      <View className="px-4 pb-2 flex-col gap-3">
        <View className="bg-brand-deep border border-brand-petrol/40 rounded-[20px] p-1 flex-row">
          <TouchableOpacity
            onPress={() => setActiveFilter('active')}
            activeOpacity={0.8}
            className={`flex-1 py-2 rounded-[16px] items-center justify-center ${activeFilter === 'active' ? 'bg-brand-petrol' : ''}`}
          >
            <Text className={`text-[13px] font-bold ${activeFilter === 'active' ? 'text-brand-silver' : 'text-brand-steel'}`}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveFilter('history')}
            activeOpacity={0.8}
            className={`flex-1 py-2 rounded-[16px] items-center justify-center ${activeFilter === 'history' ? 'bg-brand-petrol' : ''}`}
          >
            <Text className={`text-[13px] font-bold ${activeFilter === 'history' ? 'text-brand-silver' : 'text-brand-steel'}`}>History</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-brand-deep border border-brand-petrol/40 rounded-2xl px-4 py-3 flex-row items-center gap-2 mb-2">
          <Icon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} tintColor="#7F8C94" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search Customer / Location..."
            placeholderTextColor="#7F8C94"
            className="flex-1 text-sm text-brand-silver font-medium py-0"
          />
        </View>
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

      {/* ── Create Order FAB ── */}
      <TouchableOpacity
        onPress={() => setIsCreateModalVisible(true)}
        activeOpacity={0.8}
        className="absolute bottom-10 right-6 w-14 h-14 bg-[#E0D8D8] rounded-[24px] items-center justify-center shadow-lg flex-row z-10 active:scale-95"
      >
        <Icon name={{ ios: 'plus', android: 'add', web: 'add' }} size={24} tintColor="#0F1516" />
      </TouchableOpacity>

      {/* ── Edit Order details modal ── */}
      <Modal
        visible={editingItem !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingItem(null)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1 justify-end bg-brand-darkest/70"
        >
          <View className="bg-brand-darkest rounded-t-[32dp] px-6 py-8 flex flex-col gap-6">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xl font-extrabold text-brand-silver">
                Edit Order Details
              </Text>
              <TouchableOpacity
                onPress={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-brand-deep justify-center items-center"
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
                <Text className="text-xs font-bold text-brand-silver mb-1.5 uppercase tracking-wider">
                  Quantity
                </Text>
                <TextInput
                  value={editQty}
                  onChangeText={setEditQty}
                  keyboardType="number-pad"
                  placeholder="Enter Quantity"
                  placeholderTextColor="#94A3B8"
                  className={`bg-brand-deep border rounded-2xl px-4 py-3.5 text-base text-brand-silver font-bold ${hasSubmittedEdit && editQty.trim() === '' ? 'border-red-500' : 'border-brand-petrol/40'
                    }`}
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-brand-silver mb-1.5 uppercase tracking-wider">
                  Weight in kg
                </Text>
                <TextInput
                  value={editWeight}
                  onChangeText={setEditWeight}
                  keyboardType="decimal-pad"
                  placeholder="Enter Weight"
                  placeholderTextColor="#94A3B8"
                  className={`bg-brand-deep border rounded-2xl px-4 py-3.5 text-base text-brand-silver font-bold ${hasSubmittedEdit && editWeight.trim() === '' ? 'border-red-500' : 'border-brand-petrol/40'
                    }`}
                />
              </View>
            </View>

            <View className="flex flex-col gap-3 mt-2">
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={editMutation.isPending}
                activeOpacity={0.8}
                className={`w-full bg-brand-petrol py-4 rounded-2xl items-center justify-center active:scale-95 ${editMutation.isPending ? 'opacity-50' : ''
                  }`}
              >
                {editMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-brand-silver font-bold text-lg">Save Changes</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditingItem(null)}
                activeOpacity={0.8}
                className="w-full py-4 rounded-2xl items-center justify-center border border-brand-petrol/40 active:scale-95"
              >
                <Text className="text-brand-silver font-bold text-base">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Stock Modal ── */}
      <Modal visible={isStockModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsStockModalVisible(false)}>
        <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end bg-brand-darkest/70">
          <View className="bg-brand-deep rounded-t-[32dp] px-6 py-8 flex flex-col gap-6">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xl font-extrabold text-brand-silver">Edit Stock</Text>
              <TouchableOpacity onPress={() => setIsStockModalVisible(false)} className="w-8 h-8 rounded-full bg-brand-darkest justify-center items-center">
                <Icon name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} tintColor="#C9C2C2" />
              </TouchableOpacity>
            </View>
            <View className="flex flex-col gap-4">
              <View>
                <Text className="text-xs font-bold text-brand-steel mb-1.5 uppercase tracking-wider">Quantity</Text>
                <TextInput value={stockInputQty} onChangeText={setStockInputQty} keyboardType="number-pad" placeholder="Qty" placeholderTextColor="#7F8C94" className="bg-brand-darkest border border-brand-petrol/40 rounded-2xl px-4 py-3.5 text-base text-brand-silver font-bold" />
              </View>
              <View>
                <Text className="text-xs font-bold text-brand-steel mb-1.5 uppercase tracking-wider">Weight (kg)</Text>
                <TextInput value={stockInputWeight} onChangeText={setStockInputWeight} keyboardType="decimal-pad" placeholder="Weight" placeholderTextColor="#7F8C94" className="bg-brand-darkest border border-brand-petrol/40 rounded-2xl px-4 py-3.5 text-base text-brand-silver font-bold" />
              </View>
            </View>
            <TouchableOpacity onPress={handleUpdateStock} className="w-full bg-brand-petrol py-4 rounded-2xl items-center justify-center mt-2">
              <Text className="text-brand-silver text-lg font-bold">Save Stock</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Create Order Modal ── */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1 justify-end bg-brand-darkest/70"
        >
          <View className="bg-brand-darkest rounded-t-[32dp] px-6 py-8 flex flex-col gap-5 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xl font-extrabold text-brand-silver">
                Create Order
              </Text>
              <TouchableOpacity
                onPress={() => setIsCreateModalVisible(false)}
                className="w-8 h-8 rounded-full bg-brand-deep justify-center items-center"
              >
                <Icon
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={16}
                  tintColor="#64748B"
                />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
              <View className="flex flex-col gap-4">
                <View>
                  <Text className="text-xs font-bold text-brand-silver mb-1.5 uppercase tracking-wider">
                    Customer Name
                  </Text>
                  <TextInput
                    value={createName}
                    onChangeText={(text) => {
                      setCreateName(text);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Enter customer name"
                    placeholderTextColor="#94A3B8"
                    className={`bg-brand-deep border rounded-2xl px-4 py-3.5 text-base text-brand-silver font-bold ${hasSubmittedCreate && !createName.trim() ? 'border-red-500' : 'border-brand-petrol/40'
                      }`}
                  />

                  {/* Autocomplete Suggestions */}
                  {showSuggestions && createName.length > 0 && filteredCustomers.length > 0 && (
                    <View className="bg-brand-deep border border-brand-petrol/40 rounded-xl mt-2 overflow-hidden max-h-48">
                      {filteredCustomers.slice(0, 5).map(item => (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => handleSelectCustomer(item)}
                          className="px-4 py-3 border-b border-brand-petrol/40/50"
                        >
                          <Text className="text-brand-silver font-bold text-base">{item.name}</Text>
                          {item.address ? <Text className="text-brand-steel text-sm mt-0.5" numberOfLines={1}>{item.address}</Text> : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View>
                  <Text className="text-xs font-bold text-brand-silver mb-1.5 uppercase tracking-wider">
                    Address
                  </Text>
                  <TextInput
                    value={createAddress}
                    onChangeText={setCreateAddress}
                    placeholder="Enter address"
                    placeholderTextColor="#94A3B8"
                    className={`bg-brand-deep border rounded-2xl px-4 py-3.5 text-base text-brand-silver font-bold border-brand-petrol/40`}
                  />
                </View>

                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-brand-silver mb-1.5 uppercase tracking-wider">
                      Quantity
                    </Text>
                    <TextInput
                      value={createQty}
                      onChangeText={setCreateQty}
                      keyboardType="number-pad"
                      placeholder="Qty"
                      placeholderTextColor="#94A3B8"
                      className={`bg-brand-deep border rounded-2xl px-4 py-3.5 text-base text-brand-silver font-bold ${hasSubmittedCreate && !createQty.trim() ? 'border-red-500' : 'border-brand-petrol/40'
                        }`}
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-xs font-bold text-brand-silver mb-1.5 uppercase tracking-wider">
                      Weight (kg)
                    </Text>
                    <TextInput
                      value={createWeight}
                      onChangeText={setCreateWeight}
                      keyboardType="decimal-pad"
                      placeholder="Weight"
                      placeholderTextColor="#94A3B8"
                      className={`bg-brand-deep border rounded-2xl px-4 py-3.5 text-base text-brand-silver font-bold ${hasSubmittedCreate && !createWeight.trim() ? 'border-red-500' : 'border-brand-petrol/40'
                        }`}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View className="flex flex-col gap-3 mt-2">
              <TouchableOpacity
                onPress={handleSaveCreate}
                disabled={createMutation.isPending}
                activeOpacity={0.8}
                className={`w-full bg-brand-petrol py-4 rounded-2xl items-center justify-center active:scale-95 ${createMutation.isPending ? 'opacity-50' : ''}`}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-brand-silver font-bold text-lg">Create Order</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenBackground>
  );
}
