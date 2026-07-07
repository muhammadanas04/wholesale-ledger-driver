import '../global.css';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { View, Text, ActivityIndicator, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { checkGitHubUpdate, downloadAndInstallApk } from '../lib/githubUpdates';

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

  const { isUpdatePending, isDownloading } = Updates.useUpdates();
  const [isApkDownloading, setIsApkDownloading] = useState(false);
  const [apkUpdateReady, setApkUpdateReady] = useState<string | null>(null);

  // ── Auto-Updates checking ──
  useEffect(() => {
    const checkAndDownloadUpdate = async () => {
      // 1. Check EAS updates if enabled
      if (Updates.isEnabled) {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            return; // If EAS has an update, prioritize it and don't check GitHub
          }
        } catch (err) {
          console.log('[Updates] Error checking/downloading EAS update:', err);
        }
      }

      // 2. Check GitHub APK updates
      try {
        const ghUpdate = await checkGitHubUpdate();
        if (ghUpdate) {
          setApkUpdateReady(ghUpdate.downloadUrl);
        }
      } catch (err) {
        console.log('[GitHubUpdates] Error checking GitHub:', err);
      }
    };

    // Run an initial check on mount
    checkAndDownloadUpdate();

    // Check again whenever the app comes back to the foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkAndDownloadUpdate();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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

        {/* Downloading updates banner */}
        {(isDownloading || isApkDownloading) && (
          <View style={{ paddingTop: insets.top }} className="bg-brand-petrol">
            <View className="px-4 py-2 flex-row items-center justify-center gap-2">
              <ActivityIndicator size="small" color="#C9C2C2" />
              <Text className="text-white text-xs font-bold text-center">
                {isApkDownloading ? 'Downloading latest APK...' : 'Downloading latest updates in background...'}
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

        {/* ── Auto-Update Reload Prompt Overlay ── */}
        {isUpdatePending && (
          <View className="absolute inset-0 bg-brand-darkest/95 z-[10000] justify-center items-center px-6">
            <View className="bg-brand-deep border border-[#1b282b] p-6 rounded-3xl w-full max-w-sm items-center shadow-2xl">
              <View className="w-16 h-16 bg-brand-petrol/30 rounded-full items-center justify-center mb-4 border border-brand-petrol/50">
                <Icon
                  name={{ ios: 'arrow.clockwise.circle.fill', android: 'update', web: 'update' }}
                  size={36}
                  tintColor="#C9C2C2"
                />
              </View>
              <Text className="text-xl font-bold text-white text-center mb-2">
                Update Available
              </Text>
              <Text className="text-sm text-brand-steel text-center mb-6 leading-relaxed">
                A new version of Wholesale Driver has been downloaded. Restart the app to apply the update and continue.
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await Updates.reloadAsync();
                  } catch (err) {
                    console.error('[Updates] Failed to reload app:', err);
                  }
                }}
                activeOpacity={0.8}
                className="w-full bg-[#0D9488] py-4 rounded-2xl items-center justify-center active:scale-95 shadow-md"
              >
                <Text className="text-white font-bold text-base">Restart Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── APK Update Ready Prompt Overlay ── */}
        {apkUpdateReady && (
          <View className="absolute inset-0 bg-brand-darkest/95 z-[10000] justify-center items-center px-6">
            <View className="bg-brand-deep border border-[#1b282b] p-6 rounded-3xl w-full max-w-sm items-center shadow-2xl">
              <View className="w-16 h-16 bg-brand-petrol/30 rounded-full items-center justify-center mb-4 border border-brand-petrol/50">
                <Icon
                  name={{ ios: 'arrow.down.circle.fill', android: 'system-update', web: 'system-update' }}
                  size={36}
                  tintColor="#C9C2C2"
                />
              </View>
              <Text className="text-xl font-bold text-white text-center mb-2">
                New App Version Available
              </Text>
              <Text className="text-sm text-brand-steel text-center mb-6 leading-relaxed">
                A new version of Wholesale Driver is available on GitHub. Would you like to download and install it now?
              </Text>
              
              <View className="flex-row gap-3 w-full">
                <TouchableOpacity
                  onPress={() => setApkUpdateReady(null)}
                  activeOpacity={0.8}
                  disabled={isApkDownloading}
                  className="flex-1 bg-slate-800 border border-slate-750 py-4 rounded-2xl items-center justify-center active:scale-95"
                >
                  <Text className="text-white font-bold text-base">Later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    setIsApkDownloading(true);
                    try {
                      await downloadAndInstallApk(apkUpdateReady);
                      setApkUpdateReady(null);
                    } catch (err) {
                      Toast.show({ type: 'error', text1: 'Update Failed', text2: 'Could not download or install the APK.' });
                    } finally {
                      setIsApkDownloading(false);
                    }
                  }}
                  activeOpacity={0.8}
                  disabled={isApkDownloading}
                  className="flex-1 bg-[#0D9488] py-4 rounded-2xl items-center justify-center active:scale-95 shadow-md flex-row gap-2"
                >
                  {isApkDownloading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text className="text-white font-bold text-base">Install</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
      <Toast />
    </QueryClientProvider>
  );
}

