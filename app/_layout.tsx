import '../global.css';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';

import { useAppStore } from '../store/app';
import { api } from '../lib/api';
import Icon from '../components/Icon';
import {
  LOCATION_TASK_NAME,
  startLocationTracking,
  stopLocationTracking,
  requestLocationPermission,
} from '../lib/location';

// ── Define Global Background Location Task ──
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[BackgroundLocationTask] Error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    if (locations && locations.length > 0) {
      const latestLocation = locations[locations.length - 1];
      const { latitude, longitude } = latestLocation.coords;
      try {
        const { session } = useAppStore.getState();
        if (!session) {
          await useAppStore.getState().initStore();
        }
        await api.reportLocation(latitude, longitude);
        console.log('[BackgroundLocationTask] Reported successfully:', latitude, longitude);
      } catch (err: any) {
        console.log('[BackgroundLocationTask] Failed to report location (offline or server down):', err);
        // Toast works in foreground to show network/token errors that were previously swallowed
        Toast.show({
          type: 'error',
          text1: 'Location Sync Failed',
          text2: err.message,
        });
      }
    }
  }
});

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          retry: 2,
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        },
      },
    })
  );

  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const [isStoreReady, setIsStoreReady] = useState(false);
  const [locationError, setLocationError] = useState<'permission_denied' | 'services_disabled' | null>(null);

  const initStore = useAppStore((s) => s.initStore);
  const checkAutoLogout = useAppStore((s) => s.checkAutoLogout);
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;

  // ── Init store from SecureStore ──
  useEffect(() => {
    initStore()
      .catch((err) => console.error('[InitStore] Error:', err))
      .finally(() => {
        setIsStoreReady(true);
      });
  }, []);

  // ── Hide splash screen once fonts and store are ready ──
  useEffect(() => {
    if (loaded && isStoreReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isStoreReady]);

  // ── Check auto-logout on every app open ──
  useEffect(() => {
    if (loaded && isStoreReady && isLoggedIn) {
      checkAutoLogout();
    }
  }, [loaded, isStoreReady, isLoggedIn]);

  // ── Auth-based routing ──
  useEffect(() => {
    if (!loaded || !isStoreReady) return;
    const inTabsGroup = segments[0] === '(tabs)';

    if (!isLoggedIn && inTabsGroup) {
      router.replace('/login');
    } else if (isLoggedIn && !inTabsGroup) {
      router.replace('/(tabs)');
    }
  }, [loaded, isStoreReady, isLoggedIn, segments]);

  // ── Location permission and services check loop ──
  const checkLocationStatus = useCallback(async () => {
    if (!isLoggedIn) {
      setLocationError(null);
      return;
    }

    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocationError('services_disabled');
        return;
      }

      const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();

      if (fgStatus !== 'granted' || bgStatus !== 'granted') {
        setLocationError('permission_denied');
        return;
      }

      setLocationError(null);
      await startLocationTracking();
    } catch (err) {
      console.warn('[LocationCheck] Error checking status:', err);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!loaded || !isStoreReady || !isLoggedIn) {
      if (isStoreReady) {
        stopLocationTracking().catch((err) => console.log('[Location] stopLocationTracking failed:', err));
      }
      setLocationError(null);
      return;
    }

    checkLocationStatus();

    const interval = setInterval(checkLocationStatus, 2000);
    return () => clearInterval(interval);
  }, [loaded, isStoreReady, isLoggedIn, checkLocationStatus]);

  const handleRequestPermission = async () => {
    const success = await requestLocationPermission();
    if (success) {
      setLocationError(null);
      await startLocationTracking();
    } else {
      Toast.show({
        type: 'error',
        text1: 'Permission Denied',
        text2: 'Background location permission is required.',
      });
    }
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  if (!loaded || !isStoreReady) {
    return (
      <View className="flex-1 justify-center items-center bg-[#121212]">
        <ActivityIndicator size="large" color="#0D9488" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <View className="flex-1">
        {/* Offline banner */}
        {isOffline && (
          <View style={{ paddingTop: insets.top }} className="bg-amber-500">
            <View className="px-4 py-2 flex-row items-center justify-center">
              <Text className="text-white text-xs font-bold text-center">
                You're offline — changes will sync when connected
              </Text>
            </View>
          </View>
        )}

        {/* ── Blocking Full-Screen Location Overlay ── */}
        {isLoggedIn && locationError && (
          <View className="absolute inset-0 bg-slate-900 z-[9999] justify-center items-center px-6 flex flex-col gap-6">
            <View className="w-20 h-20 bg-slate-800 rounded-full items-center justify-center border border-slate-700">
              <Icon
                name={{ ios: 'location.slash.fill', android: 'location-off', web: 'location-off' }}
                size={40}
                tintColor="#E2E8F0"
              />
            </View>
            <Text className="text-2xl font-extrabold text-white text-center leading-snug">
              Location Required
            </Text>
            <Text className="text-sm text-slate-400 text-center max-w-[290px] leading-relaxed">
              {locationError === 'services_disabled'
                ? 'Device location services are disabled. Please turn on your location to continue using the app.'
                : "Please grant location permissions with 'Allow all the time' to track your active delivery status."}
            </Text>
            
            <View className="w-full flex flex-col gap-3 mt-4">
              {locationError === 'permission_denied' && (
                <TouchableOpacity
                  onPress={handleRequestPermission}
                  activeOpacity={0.8}
                  className="bg-[#0D9488] py-4 rounded-2xl items-center justify-center active:scale-95"
                >
                  <Text className="text-white font-bold text-base">Grant Permission</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleOpenSettings}
                activeOpacity={0.8}
                className="bg-slate-800 border border-slate-750 py-4 rounded-2xl items-center justify-center active:scale-95"
              >
                <Text className="text-white font-bold text-base">Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </View>
      <Toast />
    </QueryClientProvider>
  );
}

