# Driver App — Build Plan

## Overview

Mobile app (Android-first) for wholesale delivery drivers. Receives delivery orders from the admin app, tracks stock, reports expenses, and shares live location. Connects to the same Cloudflare Worker + D1 backend as the admin app, but authenticates via phone + OTP instead of SYNC_SECRET.

**Stack:** React Native + Expo SDK 56 + NativeWind + Zustand + React Query + Cloudflare Workers/D1 + Firebase Storage (expense images)

**Design Principle:** The app should be so simple that a 10–12 year old can use it. Large buttons, minimal text, obvious icons, zero cognitive load.

**Theme:** Follows the admin app's design system — Teal primary tint, warm off-white/charcoal backgrounds, Slate grays, NativeWind (TailwindCSS).

Read [Driver App.md](file:///home/anas/Development/Projects/wholesale-mobile-app/driver-app/Driver%20App.md) for the original feature specification.
Read [CONTEXT.md](file:///home/anas/Development/Projects/wholesale-mobile-app/admin-app/CONTEXT.md) for the admin app context.
Read [API_SPEC.md](file:///home/anas/Development/Projects/wholesale-mobile-app/admin-app/API_SPEC.md) for all existing API endpoints.
Read [DATA_MODEL.md](file:///home/anas/Development/Projects/wholesale-mobile-app/admin-app/DATA_MODEL.md) for the D1 database schema.
Read [LEAFLET_OSM_PLAN.md](file:///home/anas/Development/Projects/wholesale-mobile-app/admin-app/LEAFLET_OSM_PLAN.md) for the live location tracking architecture.

---

## Milestones

| # | Milestone | Deliverable |
|---|---|---|
| 1 | Project scaffold & configuration | Expo app shell, NativeWind, navigation structure, Zustand store |
| 2 | Login screen & authentication | Phone + OTP login, session persistence, auto-logout logic |
| 3 | Orders module | Receive, view, edit, mark done/reject deliveries |
| 4 | Stock tracker | Track carried stock, auto-deduct on order completion |
| 5 | Expense reporting | Camera capture, categorized expense submission via Firebase |
| 6 | Live location groundwork | Permission setup, background location stub (implementation deferred) |
| 7 | Polish & edge cases | Offline handling, empty states, error states, animations |

---

## Milestone 1 — Project Scaffold & Configuration

### 1.1 Create the Expo Project

```bash
cd /home/anas/Development/Projects/wholesale-mobile-app/driver-app
npx -y create-expo-app@latest ./ --template tabs
```

> **Note:** If the `tabs` template is not available, use the default template and manually set up Expo Router with a tabs layout.

### 1.2 Install Dependencies

```bash
# Core UI
npx expo install nativewind tailwindcss

# State & networking
pnpm add @tanstack/react-query@^5 zustand@^4

# Secure storage (for driver session)
npx expo install expo-secure-store

# Camera (for expense reports)
npx expo install expo-camera

# Location (groundwork — not used immediately)
npx expo install expo-location

# Network status
npx expo install @react-native-community/netinfo

# Safe area
npx expo install react-native-safe-area-context

# Reanimated (for micro-animations)
npx expo install react-native-reanimated

# Toast messages
pnpm add react-native-toast-message@^2

# Firebase (for expense image upload)
npx expo install expo-file-system
# Firebase JS SDK for Storage
pnpm add firebase@^11
```

### 1.3 Final `package.json` Dependencies (expected)

```json
{
  "dependencies": {
    "expo": "~56.0.11",
    "expo-router": "~56.2.10",
    "expo-camera": "latest",
    "expo-location": "latest",
    "expo-secure-store": "latest",
    "expo-file-system": "latest",
    "expo-status-bar": "latest",
    "expo-splash-screen": "latest",
    "expo-constants": "latest",
    "expo-symbols": "latest",
    "@react-native-community/netinfo": "latest",
    "@tanstack/react-query": "^5",
    "zustand": "^4",
    "nativewind": "^4",
    "react-native-reanimated": "latest",
    "react-native-safe-area-context": "latest",
    "react-native-toast-message": "^2",
    "firebase": "^11",
    "tailwindcss": "^3"
  },
  "devDependencies": {
    "typescript": "~6.0.3",
    "postcss": "^8",
    "babel-preset-expo": "latest"
  }
}
```

### 1.4 Configure NativeWind

#### `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

#### `global.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### `babel.config.js`

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
```

#### `metro.config.js`

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

### 1.5 Configure `app.json`

```json
{
  "expo": {
    "name": "Wholesale Driver",
    "slug": "wholesale-driver",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "wholesaledriver",
    "userInterfaceStyle": "automatic",
    "android": {
      "package": "com.wholesaleledger.driver",
      "permissions": [
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ],
      "adaptiveIcon": {
        "backgroundColor": "#0D9488"
      }
    },
    "plugins": [
      "expo-router",
      [
        "expo-camera",
        {
          "cameraPermission": "Allow Wholesale Driver to use the camera to photograph expense receipts."
        }
      ],
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow Wholesale Driver to track your location for delivery tracking.",
          "locationAlwaysPermission": "Allow Wholesale Driver to track your location in the background.",
          "locationWhenInUsePermission": "Allow Wholesale Driver to use your location for delivery tracking.",
          "isAndroidBackgroundLocationEnabled": true,
          "isAndroidForegroundServiceEnabled": true
        }
      ],
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

### 1.6 Color Constants

Create `constants/Colors.ts` — **matching admin app's theme exactly:**

```typescript
const tintColorLight = '#0D9488'; // Teal 600
const tintColorDark = '#2DD4BF';  // Teal 400

export default {
  light: {
    text: '#111115',
    background: '#EAEAE6',
    surface: '#FFFFFF',
    surfaceSolid: '#FFFFFF',
    border: '#D2D2CC',
    tint: tintColorLight,
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintColorLight,
    accent: '#0284C7',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
  },
  dark: {
    text: '#F2F2F7',
    background: '#121212',
    surface: '#1C1C1E',
    surfaceSolid: '#1C1C1E',
    border: '#2C2C2E',
    tint: tintColorDark,
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintColorDark,
    accent: '#38BDF8',
    success: '#34D399',
    danger: '#F87171',
    warning: '#FBBF24',
  },
};
```

### 1.7 Folder Structure

```
driver-app/
├── app/                         ← Expo Router screens
│   ├── _layout.tsx              ← Root layout (providers, auth gate)
│   ├── login.tsx                ← Login screen (phone + OTP)
│   └── (tabs)/
│       ├── _layout.tsx          ← Tab bar configuration
│       ├── index.tsx            ← Orders screen (home tab)
│       ├── stock.tsx            ← Stock tracker screen
│       └── expenses.tsx         ← Expense reporting screen
├── components/                  ← Shared UI components
│   ├── OrderCard.tsx            ← Single delivery item card
│   ├── ProgressBar.tsx          ← Visual progress bar
│   ├── ExpenseCard.tsx          ← Expense history card
│   ├── CameraCapture.tsx        ← Camera modal for expense photos
│   ├── CategoryPicker.tsx       ← Expense category selector
│   ├── EmptyState.tsx           ← Reusable empty state component
│   └── ScreenBackground.tsx     ← Consistent screen background wrapper
├── constants/
│   └── Colors.ts                ← Color palette (matching admin app)
├── lib/
│   ├── api.ts                   ← Cloudflare Worker API client
│   ├── firebase.ts              ← Firebase config + storage helpers
│   └── location.ts              ← Location tracking utilities (stub)
├── store/
│   └── app.ts                   ← Zustand store (session, stock, etc.)
└── types/
    └── index.ts                 ← Shared TypeScript interfaces
```

### 1.8 Zustand Store (`store/app.ts`)

```typescript
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface DriverSession {
  driverId: string;
  driverName: string;
  phone: string;
  workerUrl: string;
  loginTimestamp: string;       // ISO 8601 — when OTP was entered
  lastOrderReceivedAt: string;  // ISO 8601 — for 30-day auto-logout
}

interface StockState {
  qty: number;   // integer count of items
  weight: number; // weight in kg (decimal)
}

interface AppState {
  // ── Session ──
  session: DriverSession | null;
  isLoggedIn: boolean;

  // ── Stock ──
  stock: StockState;

  // ── Actions ──
  initStore: () => Promise<void>;
  login: (session: DriverSession) => Promise<void>;
  logout: () => Promise<void>;
  checkAutoLogout: () => Promise<boolean>;
  updateLastOrderReceived: () => Promise<void>;
  setStock: (stock: Partial<StockState>) => void;
  deductStock: (qty: number, weight: number) => void;
}

const SECURE_STORE_KEY = 'driver_session';
const STOCK_STORE_KEY = 'driver_stock';
const AUTO_LOGOUT_DAYS = 30;

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  isLoggedIn: false,
  stock: { qty: 0, weight: 0 },

  initStore: async () => {
    try {
      const raw = await SecureStore.getItemAsync(SECURE_STORE_KEY);
      if (raw) {
        const session: DriverSession = JSON.parse(raw);
        set({ session, isLoggedIn: true });
      }
      const stockRaw = await SecureStore.getItemAsync(STOCK_STORE_KEY);
      if (stockRaw) {
        set({ stock: JSON.parse(stockRaw) });
      }
    } catch {
      // corrupted storage — force re-login
      await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
      set({ session: null, isLoggedIn: false });
    }
  },

  login: async (session: DriverSession) => {
    await SecureStore.setItemAsync(SECURE_STORE_KEY, JSON.stringify(session));
    set({ session, isLoggedIn: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
    await SecureStore.deleteItemAsync(STOCK_STORE_KEY);
    set({ session: null, isLoggedIn: false, stock: { qty: 0, weight: 0 } });
  },

  checkAutoLogout: async () => {
    const { session } = get();
    if (!session) return false;

    const lastOrder = new Date(session.lastOrderReceivedAt);
    const now = new Date();
    const diffDays = (now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays >= AUTO_LOGOUT_DAYS) {
      await get().logout();
      return true; // was logged out
    }
    return false; // still valid
  },

  updateLastOrderReceived: async () => {
    const { session } = get();
    if (!session) return;
    const updated = { ...session, lastOrderReceivedAt: new Date().toISOString() };
    await SecureStore.setItemAsync(SECURE_STORE_KEY, JSON.stringify(updated));
    set({ session: updated });
  },

  setStock: (partial: Partial<StockState>) => {
    const current = get().stock;
    const updated = { ...current, ...partial };
    set({ stock: updated });
    SecureStore.setItemAsync(STOCK_STORE_KEY, JSON.stringify(updated));
  },

  deductStock: (qty: number, weight: number) => {
    const current = get().stock;
    const updated = {
      qty: Math.max(0, current.qty - qty),
      weight: Math.max(0, current.weight - weight),
    };
    set({ stock: updated });
    SecureStore.setItemAsync(STOCK_STORE_KEY, JSON.stringify(updated));
  },
}));
```

### 1.9 TypeScript Types (`types/index.ts`)

```typescript
// ── Delivery item as received from the Worker ──
export interface DeliveryItem {
  id: string;                      // UUID
  delivery_id: string;
  customer_name: string;           // From joined customer record, or inline
  customer_phone: string;
  address: string;
  qty: number;                     // Required — always present
  weight: number | null;           // Optional
  total_price: number | null;      // Optional, in paise
  status: 'pending' | 'done' | 'rejected';
  notes: string | null;
  created_at: string;              // ISO 8601
  updated_at: string;
}

// ── A delivery batch (one or many items assigned to this driver) ──
export interface Delivery {
  id: string;
  driver_id: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes: string | null;
  items: DeliveryItem[];
  created_at: string;
  updated_at: string;
}

// ── Expense report ──
export type ExpenseCategory = 'petrol_diesel' | 'repair' | 'defective_item' | 'other';

export interface ExpenseReport {
  id: string;
  driver_id: string;
  category: ExpenseCategory;
  amount: number;                  // Price in paise for petrol/repair/other, quantity count for defective
  amount_label: 'price' | 'quantity'; // Derived from category
  note: string | null;
  image_url: string;               // Firebase Storage URL
  created_at: string;
}

// ── Category metadata ──
export const EXPENSE_CATEGORIES: {
  key: ExpenseCategory;
  label: string;
  amountType: 'price' | 'quantity';
  amountPlaceholder: string;
  icon: string;
}[] = [
  {
    key: 'petrol_diesel',
    label: 'Petrol / Diesel',
    amountType: 'price',
    amountPlaceholder: 'Enter amount (₹)',
    icon: 'local_gas_station',
  },
  {
    key: 'repair',
    label: 'Repair',
    amountType: 'price',
    amountPlaceholder: 'Enter amount (₹)',
    icon: 'build',
  },
  {
    key: 'defective_item',
    label: 'Defective Item',
    amountType: 'quantity',
    amountPlaceholder: 'Enter quantity',
    icon: 'report_problem',
  },
  {
    key: 'other',
    label: 'Other',
    amountType: 'price',
    amountPlaceholder: 'Enter amount (₹)',
    icon: 'more_horiz',
  },
];

// ── Auth response ──
export interface AuthResponse {
  ok: boolean;
  driver_id?: string;
  name?: string;
  error?: string;
}
```

### 1.10 API Client (`lib/api.ts`)

```typescript
import { useAppStore } from '../store/app';

class DriverApi {
  private getWorkerUrl(): string {
    const session = useAppStore.getState().session;
    if (!session) throw new Error('Not authenticated');
    return session.workerUrl;
  }

  private getDriverId(): string {
    const session = useAppStore.getState().session;
    if (!session) throw new Error('Not authenticated');
    return session.driverId;
  }

  // ── Auth (no session required) ──
  async authenticate(
    workerUrl: string,
    phone: string,
    otp: string
  ): Promise<AuthResponse> {
    const res = await fetch(`${workerUrl}/driver/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    return res.json();
  }

  // ── Deliveries ──
  async getMyDeliveries(): Promise<{ deliveries: Delivery[] }> {
    const res = await fetch(
      `${this.getWorkerUrl()}/driver/deliveries?driver_id=${this.getDriverId()}`
    );
    if (!res.ok) throw new Error('Failed to fetch deliveries');
    return res.json();
  }

  // ── Update delivery item status (done / rejected) ──
  async updateDeliveryItemStatus(
    itemId: string,
    status: 'done' | 'rejected'
  ): Promise<{ ok: boolean }> {
    const res = await fetch(
      `${this.getWorkerUrl()}/delivery-item/${itemId}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          driver_id: this.getDriverId(),
        }),
      }
    );
    if (!res.ok) throw new Error('Failed to update status');
    return res.json();
  }

  // ── Edit delivery item details (qty, weight) ──
  async editDeliveryItem(
    itemId: string,
    updates: { qty?: number; weight?: number }
  ): Promise<{ ok: boolean }> {
    const res = await fetch(
      `${this.getWorkerUrl()}/delivery-item/${itemId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          driver_id: this.getDriverId(),
        }),
      }
    );
    if (!res.ok) throw new Error('Failed to edit item');
    return res.json();
  }

  // ── Location reporting ──
  async reportLocation(
    latitude: number,
    longitude: number
  ): Promise<{ ok: boolean }> {
    const res = await fetch(`${this.getWorkerUrl()}/driver/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driver_id: this.getDriverId(),
        latitude,
        longitude,
      }),
    });
    return res.json();
  }

  // ── Submit expense report ──
  async submitExpense(expense: {
    category: string;
    amount: number;
    note: string | null;
    image_url: string;
  }): Promise<{ ok: boolean }> {
    const res = await fetch(`${this.getWorkerUrl()}/driver/expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driver_id: this.getDriverId(),
        ...expense,
      }),
    });
    if (!res.ok) throw new Error('Failed to submit expense');
    return res.json();
  }
}

export const api = new DriverApi();
```

### 1.11 Root Layout (`app/_layout.tsx`)

```typescript
import '../global.css';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/app';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: { queries: { retry: 2 } },
    })
  );
  const [isReady, setIsReady] = useState(false);
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
    initStore().then(() => {
      setIsReady(true);
      SplashScreen.hideAsync();
    });
  }, []);

  // ── Check auto-logout on every app open ──
  useEffect(() => {
    if (isReady && isLoggedIn) {
      checkAutoLogout();
    }
  }, [isReady, isLoggedIn]);

  // ── Auth-based routing ──
  useEffect(() => {
    if (!isReady) return;
    const inAuthGroup = segments[0] === '(tabs)';

    if (!isLoggedIn && inAuthGroup) {
      // Not logged in but trying to access tabs → go to login
      router.replace('/login');
    } else if (isLoggedIn && !inAuthGroup) {
      // Logged in but on login screen → go to tabs
      router.replace('/(tabs)');
    }
  }, [isReady, isLoggedIn, segments]);

  if (!isReady) {
    return (
      <View className="flex-1 justify-center items-center bg-[#EAEAE6]">
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
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </View>
      <Toast />
    </QueryClientProvider>
  );
}
```

### 1.12 Tab Bar Layout (`app/(tabs)/_layout.tsx`)

Three tabs, dead simple:

```typescript
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import Colors from '../../constants/Colors';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.surfaceSolid,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: colors.surfaceSolid,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'list.bullet.clipboard', android: 'assignment', web: 'assignment' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'cube.box', android: 'inventory_2', web: 'inventory_2' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'indianrupeesign.circle', android: 'receipt_long', web: 'receipt_long' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## Milestone 2 — Login Screen & Authentication

### 2.1 Login Screen (`app/login.tsx`)

**UI Layout (top to bottom):**

1. **App logo / icon** — centered, 80x80, teal-tinted
2. **Title**: "Wholesale Driver" — large, bold, Teal 600
3. **Subtitle**: "Enter your details to get started" — small, Slate 400
4. **Worker URL input**: Text input for the Cloudflare Worker URL
   - Label: "Server URL"
   - Placeholder: "https://your-worker.workers.dev"
   - Keyboard type: `url`
   - Auto-capitalize: `none`
   - Auto-correct: `false`
5. **Phone number input**: Numeric input, 10 digits
   - Label: "Phone Number"
   - Placeholder: "Enter 10-digit phone number"
   - Keyboard type: `phone-pad`
   - Max length: 10
   - Validation: must be exactly 10 digits, numeric only
6. **OTP input**: Numeric input, 6 digits
   - Label: "OTP"
   - Placeholder: "Enter 6-digit OTP from admin"
   - Keyboard type: `number-pad`
   - Max length: 6
   - Validation: must be exactly 6 digits
7. **Login button**: Full width, Teal 600 background, white text, rounded-2xl, 56dp height
   - Text: "Login"
   - Loading state: Show spinner, disable button, text changes to "Logging in..."
8. **Error display**: Below the button, Rose 600 text if auth fails

**Interaction flow:**

```
User enters Worker URL → enters phone → enters OTP → taps Login
                                                         │
                                              ┌──────────┴──────────┐
                                              │                     │
                                     api.authenticate()        Validation
                                     POST /driver/auth         fails → show
                                              │                inline error
                                   ┌──────────┴──────────┐
                                   │                     │
                              ok: true              ok: false
                              │                     │
                     Store session in         Show error message:
                     SecureStore:             "Invalid OTP" or
                     - driver_id             "Phone not found" or
                     - driverName            "OTP already used"
                     - phone
                     - workerUrl
                     - loginTimestamp = now
                     - lastOrderReceivedAt = now
                              │
                     Navigate to /(tabs)/
```

**Validation rules (checked BEFORE API call):**

| Field | Rule | Error message |
|---|---|---|
| Worker URL | Non-empty, starts with `http://` or `https://` | "Enter a valid server URL" |
| Phone | Exactly 10 digits, numeric | "Phone number must be 10 digits" |
| OTP | Exactly 6 digits, numeric | "OTP must be 6 digits" |

**Error handling from API:**

| API Response | UI Behaviour |
|---|---|
| `ok: false, error: "Invalid OTP"` | Show: "Wrong OTP. Please check with admin." |
| `ok: false, error: "..."` (any) | Show the error message from the API |
| Network error / timeout | Show: "Cannot reach server. Check your internet and the server URL." |
| `ok: true` | Store session → navigate to tabs |

### 2.2 Auto-Logout After 30 Days

**Logic:**
- On every app open, `checkAutoLogout()` is called in the root layout.
- It checks `session.lastOrderReceivedAt`. If `(now - lastOrderReceivedAt) >= 30 days`, the session is cleared and the user is redirected to the login screen.
- `lastOrderReceivedAt` is updated every time new deliveries are successfully fetched from the server.
- This means: if a driver receives at least one order poll response within 30 days, they stay logged in. If the server stops sending orders for 30 days, they're auto-logged out.

**Re-login:** Requires a new OTP from the admin app. The admin creates a new OTP for the driver in the admin app (by regenerating or creating a new driver entry), and the driver enters it to log in again.

### 2.3 Session Persistence

- Session is stored in `expo-secure-store` (encrypted on-device storage).
- On app startup, `initStore()` reads the session from SecureStore.
- If session exists → `isLoggedIn = true` → navigate to tabs.
- If no session → `isLoggedIn = false` → navigate to login.
- One-time login: no need to re-enter credentials on every app open.

---

## Milestone 3 — Orders Module

### 3.1 Orders Screen (`app/(tabs)/index.tsx`)

This is the **home screen** of the app. It shows all deliveries assigned to this driver.

**Screen layout (top to bottom):**

1. **Header** (via Expo Router `headerTitle`): "My Orders"
2. **Overall progress card**: Shows total progress across ALL active deliveries
   - Card with teal-tinted background
   - Large text: "5 / 12 completed"
   - `<ProgressBar>` component showing completion percentage
   - Small text: "3 pending · 4 rejected"
3. **Filter pills**: Horizontal scrollable row of filter chips
   - "All" (default, selected)
   - "Pending"
   - "Done"
   - "Rejected"
   - Selected pill: Teal 600 background, white text
   - Unselected pill: Surface background, Slate 500 text, border
4. **Delivery items list**: `FlatList` (no WatermelonDB, so no FlashList needed)
   - Each item is an `<OrderCard>` (see 3.2)
   - Pull-to-refresh: re-fetches from API
   - Sorted: pending items first, then done, then rejected
5. **Empty state**: If no deliveries at all:
   - Icon: clipboard with checkmark
   - Text: "No orders yet"
   - Subtext: "Orders from admin will appear here"

**Data fetching:**

```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['my-deliveries'],
  queryFn: () => api.getMyDeliveries(),
  refetchInterval: 15000,  // Poll every 15 seconds for new orders
});
```

When new deliveries are received, call `updateLastOrderReceived()` on the store to reset the 30-day auto-logout timer.

### 3.2 OrderCard Component (`components/OrderCard.tsx`)

Each card represents a single `DeliveryItem`.

**Card layout:**

```
┌─────────────────────────────────────────────────┐
│  ┌─────┐                                        │
│  │ ● S │  Customer Name            [Status Badge]│
│  └─────┘  📍 Address line here...               │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Qty: 5   │ │ Wt: 2kg  │ │ ₹1,200   │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌────────┐  │
│  │  ✓  Done    │  │  ✗  Reject  │  │ ✎ Edit │  │
│  └─────────────┘  └─────────────┘  └────────┘  │
└─────────────────────────────────────────────────┘
```

**Card elements:**

| Element | Detail |
|---|---|
| Status indicator (● S) | Green circle = pending, Teal checkmark = done, Red X = rejected |
| Customer Name | Bold, 16px. If empty, show "Unknown Customer" |
| Phone | Tappable — opens dialer (`Linking.openURL('tel:...')`) |
| Address | Slate 500 text, prefixed with 📍. If empty, show "No address" |
| Qty | Always shown. Bold number in a pill-shaped badge |
| Weight | Only shown if not null. "2 kg" format |
| Total Price | Only shown if not null. Formatted as "₹1,200" |
| Notes | If present, shown as italic small text below details |
| Done button | Emerald 600 bg, white text, 48dp height. **Only shown if status = 'pending'** |
| Reject button | Rose 600 bg, white text, 48dp height. **Only shown if status = 'pending'** |
| Edit button | Slate 200 bg, Slate 700 text, 48dp height. **Only shown if status = 'pending'** |

**Status badge (top right):**

| Status | Badge Color | Text |
|---|---|---|
| `pending` | Amber 100 bg, Amber 700 text | "Pending" |
| `done` | Emerald 100 bg, Emerald 700 text | "Done ✓" |
| `rejected` | Rose 100 bg, Rose 700 text | "Rejected ✗" |

### 3.3 Mark as Done Flow

```
User taps "Done" button on a pending OrderCard
           │
           ▼
Show confirmation alert:
  Title: "Mark as Done?"
  Message: "Customer Name — Qty: 5"
  Buttons: [Cancel] [Confirm]
           │
           ▼ (Confirm tapped)
1. Optimistic UI update: immediately set item status to 'done' in local state
2. Call api.updateDeliveryItemStatus(itemId, 'done')
3. If stock tracking is active: call store.deductStock(item.qty, item.weight ?? 0)
4. Show toast: "Order completed ✓"
5. If ALL items in this delivery are now done → delivery status becomes 'completed'
6. If API call fails:
   a. Revert optimistic update
   b. Show toast: "Failed to update. Try again."
```

### 3.4 Mark as Rejected Flow

```
User taps "Reject" button on a pending OrderCard
           │
           ▼
Show confirmation alert:
  Title: "Reject this order?"
  Message: "Customer Name — This cannot be undone."
  Buttons: [Cancel] [Reject] (Reject button in Rose 600)
           │
           ▼ (Reject tapped)
1. Optimistic UI update: immediately set item status to 'rejected'
2. Call api.updateDeliveryItemStatus(itemId, 'rejected')
3. Do NOT deduct stock (rejected = not delivered)
4. Show toast: "Order rejected"
5. If API call fails: revert + error toast
```

### 3.5 Edit Order Details Flow

```
User taps "Edit" button on a pending OrderCard
           │
           ▼
Open a bottom sheet / modal with:
  - Qty input (pre-filled, numeric keypad) — required
  - Weight input (pre-filled, decimal keypad) — optional
  - "Save" button (Teal 600, full width)
  - "Cancel" link
           │
           ▼ (Save tapped)
1. Validate: qty must be > 0
2. Call api.editDeliveryItem(itemId, { qty, weight })
3. Update local state with new values
4. Close the modal
5. Show toast: "Order updated"
6. If API call fails: show error toast, keep modal open
```

### 3.6 Order History Section

**Within the Orders screen**, add a toggle at the top:
- **Active Orders** (default) — shows pending items
- **History** — shows done + rejected items from past deliveries

History items show the same card layout but with no action buttons (status is final).

**History data source:** The same `getMyDeliveries()` API returns all deliveries including completed ones. Filter client-side.

### 3.7 Progress Bar Component (`components/ProgressBar.tsx`)

```typescript
interface ProgressBarProps {
  completed: number;
  total: number;
  height?: number;  // default 8
}
```

**Visual:**
- Rounded bar, Slate 200 background (track)
- Teal 500 fill (progress)
- Animated width transition (use `react-native-reanimated` `useAnimatedStyle` with `withTiming`)
- Shows percentage text to the right: "42%"

---

## Milestone 4 — Stock Tracker

### 4.1 Stock Screen (`app/(tabs)/stock.tsx`)

**Screen layout (top to bottom):**

1. **Header**: "My Stock"
2. **Current stock card**: Large, prominent card
   - Two big numbers side by side:
     - Left: **Qty** — e.g., "45 items" (large, bold, Teal 600)
     - Right: **Weight** — e.g., "120.5 kg" (large, bold, Teal 600)
   - Subtitle: "Tap to update"
3. **Update stock section**:
   - Two input fields (always visible, not in a modal):
     - "Quantity" — numeric input, placeholder "Enter item count"
     - "Weight (kg)" — decimal input, placeholder "Enter weight in kg"
   - **"Set Stock"** button — Teal 600, full width, 52dp height
   - This REPLACES the current stock values (not adds to them)
4. **Auto-deduction notice**:
   - Info card with Slate 100 background:
   - Text: "Stock automatically decreases when you mark orders as Done."
   - Icon: ℹ️

**How stock auto-deduction works:**

1. Driver opens app, goes to Stock tab, enters: Qty = 100, Weight = 500 kg
2. Driver goes to Orders tab, marks an order as Done (Qty: 5, Weight: 10 kg)
3. Stock automatically updates to: Qty = 95, Weight = 490 kg
4. This happens in the `deductStock()` Zustand action, called from the "Mark as Done" flow in Milestone 3

**Persistence:**
- Stock values are stored in SecureStore under `driver_stock` key
- Loaded on app startup via `initStore()`
- Updated on every stock change

**Important:** There is only ONE type of item. No product selector needed. Just qty and weight.

### 4.2 Stock State in Zustand

Already defined in Milestone 1 store:
- `stock: { qty: number, weight: number }`
- `setStock(partial)` — replaces stock values
- `deductStock(qty, weight)` — subtracts from current stock, floors at 0

---

## Milestone 5 — Expense Reporting

### 5.1 Firebase Setup

#### External Setup Required (tell user):

1. **Create a Firebase project** (or use existing one) at https://console.firebase.google.com
2. **Enable Firebase Storage** in the Firebase console
   - Go to Build → Storage → Get Started
   - Choose a region (e.g., `asia-south1` for India)
   - Set security rules (see below)
3. **Get the Firebase config** — from Project Settings → General → Your apps → Web app
   - Copy the config object containing `apiKey`, `authDomain`, `storageBucket`, etc.
4. **Set Storage security rules** — allow driver uploads but not public reads:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /expenses/{driverId}/{allPaths=**} {
      // Anyone can write (driver app doesn't use Firebase Auth)
      // Only authenticated admin can read (via Firebase console or admin SDK)
      allow write: if request.resource.size < 5 * 1024 * 1024  // Max 5MB
                   && request.resource.contentType.matches('image/.*');
      allow read: if false;  // Admin reads via console or server-side
    }
  }
}
```

> **Alternative (simpler):** If full public read is acceptable for this use case (expenses are not sensitive), use:
> ```
> allow read, write: if request.resource.size < 5 * 1024 * 1024
>                    && request.resource.contentType.matches('image/.*');
> ```

5. **No Firebase Auth needed** — the driver app does not use Firebase Authentication. Storage rules allow writes without auth (restricted by file size and content type).

#### Firebase Config File (`lib/firebase.ts`)

```typescript
import { initializeApp } from 'firebase/app';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

/**
 * Upload an expense receipt image to Firebase Storage.
 *
 * @param driverId - The driver's UUID (used as folder name)
 * @param imageUri - Local file URI from expo-camera (e.g., file:///...)
 * @param onProgress - Optional progress callback (0 to 1)
 * @returns The public download URL of the uploaded image
 */
export async function uploadExpenseImage(
  driverId: string,
  imageUri: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Convert local URI to blob
  const response = await fetch(imageUri);
  const blob = await response.blob();

  // Generate unique filename
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const storageRef = ref(storage, `expenses/${driverId}/${filename}`);

  // Upload with progress tracking
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = snapshot.bytesTransferred / snapshot.totalBytes;
        onProgress?.(progress);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}
```

### 5.2 Expenses Screen (`app/(tabs)/expenses.tsx`)

**Screen layout (top to bottom):**

1. **Header**: "Report Expense"
2. **Camera preview / captured image area**:
   - If no image captured: Show a large tappable area (200dp height) with:
     - Camera icon (64px, Slate 400)
     - Text: "Tap to take a photo"
     - Background: Slate 100, dashed border, rounded-2xl
   - If image captured: Show the captured image (200dp height, rounded-2xl)
     - Overlay "Retake" button in the bottom-right corner
   - **No gallery picker** — camera only, as per spec
3. **Category selector**:
   - Label: "Category"
   - Four large tappable cards in a 2×2 grid:
     - ⛽ Petrol / Diesel
     - 🔧 Repair
     - ⚠️ Defective Item
     - ⋯ Other
   - Selected card: Teal 600 border, Teal 50 background
   - Unselected card: Surface background, Slate 200 border
4. **Amount input**:
   - Label changes based on category:
     - Petrol/Diesel, Repair, Other → "Amount (₹)"
     - Defective Item → "Quantity"
   - Keyboard type: `decimal-pad` for price, `number-pad` for quantity
   - Placeholder changes based on category (see types)
5. **Note input** (optional):
   - Label: "Note (optional)"
   - Multiline text input, max 200 characters
   - Placeholder: "Add a note..."
6. **Submit button**:
   - Full width, Teal 600, 56dp height
   - Text: "Submit Expense"
   - Loading state: spinner + "Uploading..." text + progress percentage
   - Disabled if: no image OR no category OR no amount

**Submit flow:**

```
User taps "Submit Expense"
           │
           ▼
1. Validate:
   - Image captured? (required)
   - Category selected? (required)
   - Amount > 0? (required)
           │
           ▼
2. Upload image to Firebase Storage:
   - Show upload progress bar (0% → 100%)
   - uploadExpenseImage(driverId, imageUri, onProgress)
   - Get back the download URL
           │
           ▼
3. Submit expense to Worker:
   - api.submitExpense({
       category: 'petrol_diesel',
       amount: 15000,  // paise for price, raw count for qty
       note: 'Filled tank',
       image_url: 'https://firebasestorage...'
     })
           │
           ▼
4. On success:
   - Show toast: "Expense submitted ✓"
   - Clear the form (reset image, category, amount, note)
   - Optionally: show the submitted expense at the top of a history list

5. On failure:
   - Show toast: "Failed to submit. Please try again."
   - Keep the form filled so user can retry
```

### 5.3 Camera Capture Component (`components/CameraCapture.tsx`)

Uses `expo-camera`:

```typescript
interface CameraCaptureProps {
  onCapture: (uri: string) => void;
  onCancel: () => void;
}
```

**Behaviour:**
1. On component mount: request camera permission
2. If permission denied: show message "Camera permission is required to take expense photos" with a "Grant Permission" button that opens app settings
3. If permission granted: show live camera preview (full screen modal)
4. Large circular capture button at the bottom (64dp, white, centered)
5. On capture: take photo with `camera.takePictureAsync({ quality: 0.7 })` — quality 0.7 to keep file size reasonable
6. Show captured photo preview with two buttons:
   - "Use Photo" → calls `onCapture(uri)` and closes modal
   - "Retake" → goes back to live preview

### 5.4 Expense History

Below the submit form, show a scrollable list of recently submitted expenses (from current session only — not persisted across restarts, unless we add local storage for history).

Each expense card shows:
- Thumbnail of the uploaded image (from the captured URI)
- Category badge
- Amount
- Note (if present)
- Timestamp

**Alternative:** If expense history should persist, we can store submitted expenses in SecureStore as a JSON array. But for Phase 1, session-only history is sufficient.

---

## Milestone 6 — Live Location Groundwork

> **Per spec:** "This feature will be implemented later, so, we can prepare the ground for it now but do not implement the feature yet."

### 6.1 What to Set Up Now

1. **`expo-location` is already installed** (Milestone 1)
2. **Permissions are already declared** in `app.json` (Milestone 1):
   - `ACCESS_FINE_LOCATION`
   - `ACCESS_COARSE_LOCATION`
   - `ACCESS_BACKGROUND_LOCATION`
   - `FOREGROUND_SERVICE`
   - `FOREGROUND_SERVICE_LOCATION`
3. **API client method already exists**: `api.reportLocation(lat, lng)` (Milestone 1)

### 6.2 Location Stub File (`lib/location.ts`)

```typescript
import * as Location from 'expo-location';

/**
 * Request location permissions.
 * Returns true if foreground permission is granted.
 * Call this on app startup (when location feature is enabled).
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Check if location services are enabled on the device.
 */
export async function isLocationEnabled(): Promise<boolean> {
  return Location.hasServicesEnabledAsync();
}

/**
 * Start watching location and reporting to the server.
 * TODO: Implement when location feature is activated.
 *
 * Plan:
 * 1. Request foreground + background permissions
 * 2. Start foreground service with notification
 * 3. Watch location with:
 *    - accuracy: Location.Accuracy.High
 *    - distanceInterval: 50 (meters) — report when moved 50m+
 *    - timeInterval: 15000 (ms) — report at least every 15 seconds
 * 4. On each location update, call api.reportLocation(lat, lng)
 * 5. If location services disabled: show blocking screen
 *    "Please enable location to use this app"
 */
export async function startLocationTracking(): Promise<void> {
  // Stub — to be implemented later
  console.log('[Location] Tracking not yet implemented');
}

/**
 * Stop location tracking.
 * TODO: Implement when location feature is activated.
 */
export async function stopLocationTracking(): Promise<void> {
  // Stub — to be implemented later
  console.log('[Location] Stop tracking not yet implemented');
}
```

### 6.3 Mandatory Location Requirement (to implement later)

When the location feature is activated:

1. On app startup (after login), check if location services are enabled
2. If NOT enabled: show a **full-screen blocking overlay**:
   - Text: "Location Required"
   - Subtext: "Please turn on your location to continue using this app."
   - Button: "Open Settings" → opens device location settings
   - The app MUST NOT allow access to any tab until location is on
3. Continuously poll `isLocationEnabled()` every 2 seconds
4. When location is turned on → dismiss overlay and start tracking

### 6.4 Architecture Reference

The full location tracking architecture is documented in [LEAFLET_OSM_PLAN.md](file:///home/anas/Development/Projects/wholesale-mobile-app/admin-app/LEAFLET_OSM_PLAN.md). Key points from the driver app's perspective:

- Driver app sends `POST /driver/location` with `{ driver_id, latitude, longitude }`
- Server stores only the **latest** location per driver (upsert)
- Driver app should report every **10–20 seconds** when active
- Admin app polls `GET /driver/locations` every 15 seconds to see all drivers

---

## Milestone 7 — Polish & Edge Cases

### 7.1 Offline Handling

| Scenario | Behaviour |
|---|---|
| App opened while offline | Show amber banner "You're offline — changes will sync when connected" |
| Orders screen while offline | Show last-fetched orders (React Query cache). Show "Last updated X min ago" text. Pull-to-refresh shows "No internet connection" toast. |
| Mark as Done while offline | **Block the action.** Show toast: "You need internet to update orders." Reason: there is no local database to queue changes — the driver app is stateless except for stock. |
| Submit expense while offline | **Block the action.** Show toast: "You need internet to submit expenses." Firebase Storage upload requires connectivity. |
| Stock update while offline | **Allow.** Stock is local-only, stored in SecureStore. No server call needed. |

### 7.2 Empty States

| Screen | Empty State |
|---|---|
| Orders (no deliveries) | Icon: 📋 clipboard. Title: "No orders yet". Subtitle: "Orders from admin will appear here." |
| Orders (all filtered out) | Title: "No [pending/done/rejected] orders". Subtitle: "Try a different filter." |
| Stock (first time) | Show the input form with Qty = 0, Weight = 0. Info text: "Enter the stock you're carrying today." |
| Expenses (no history) | Icon: 🧾 receipt. Title: "No expenses submitted". Subtitle: "Take a photo of your receipt to get started." |

### 7.3 Error States

| Error | UI Behaviour |
|---|---|
| Login: API unreachable | "Cannot reach server. Check your internet and the server URL." below the login button. |
| Login: Wrong OTP | "Wrong OTP. Please check with admin." below the login button. |
| Login: OTP already used | "This OTP has already been used. Ask admin for a new one." |
| Orders: Fetch failed | Banner at top of list: "Failed to load orders. Pull down to retry." |
| Orders: Status update failed | Toast: "Failed to update. Please try again." + revert optimistic update. |
| Expense: Upload failed | Toast: "Upload failed. Please try again." + keep form filled. |
| Expense: Camera permission denied | Full-height card replacing camera area: "Camera access needed." + "Grant Permission" button. |

### 7.4 Micro-Animations

| Element | Animation |
|---|---|
| All buttons | `active:scale-95` (NativeWind) — scale down on press |
| OrderCard status change | Fade out old status badge, fade in new one (Reanimated `FadeIn` / `FadeOut`) |
| ProgressBar fill | `withTiming` width animation, 600ms duration, easeInOut |
| Tab bar icon | Default Expo tab transition |
| Toast messages | Default `react-native-toast-message` slide-in from top |
| Camera shutter | Brief scale pulse on capture button (1.0 → 0.9 → 1.0) |
| Stock deduction | Number roll animation — briefly highlight in red, then settle |
| Screen transitions | Default Expo Router stack animations |

### 7.5 Input Validation Rules (Complete)

| Field | Screen | Rule | Error Message |
|---|---|---|---|
| Worker URL | Login | Non-empty, starts with `http://` or `https://` | "Enter a valid server URL" |
| Phone | Login | Exactly 10 digits, `/^\d{10}$/` | "Phone number must be 10 digits" |
| OTP | Login | Exactly 6 digits, `/^\d{6}$/` | "OTP must be 6 digits" |
| Qty | Stock | Non-negative integer | "Enter a valid quantity" |
| Weight | Stock | Non-negative number (decimal allowed) | "Enter a valid weight" |
| Qty (edit) | Order Edit | Positive integer, `> 0` | "Quantity must be at least 1" |
| Weight (edit) | Order Edit | Non-negative number (decimal allowed) | "Enter a valid weight" |
| Amount | Expense | Positive number, `> 0` | "Enter a valid amount" |
| Image | Expense | Must be captured (non-null URI) | "Take a photo of your receipt" |
| Category | Expense | Must be selected | "Select a category" |

### 7.6 Accessibility

- All touch targets: minimum **48x48dp** as per admin app's UI/UX plan
- Large text on buttons: minimum **16px** font size for primary actions
- High contrast: Follow the admin app's Slate palette for foreground/background contrast
- Status indicators: Never rely on color alone — always include text labels AND color (e.g., "Done ✓" with green, not just a green dot)

---

## New API Endpoints Required (Cloudflare Worker Changes)

The existing Worker needs these new endpoints for the driver app:

### 1. `GET /driver/deliveries`

**Purpose:** Fetch all deliveries assigned to a specific driver.

**Query params:** `?driver_id=<uuid>`

**Auth:** Validates that `driver_id` exists in `drivers` table and `active = 1`.

**Response:**
```json
{
  "deliveries": [
    {
      "id": "delivery-uuid",
      "driver_id": "driver-uuid",
      "status": "pending",
      "notes": "Deliver to sector 5",
      "created_at": "2026-06-18T10:00:00Z",
      "updated_at": "2026-06-18T10:00:00Z",
      "items": [
        {
          "id": "item-uuid",
          "delivery_id": "delivery-uuid",
          "customer_name": "Ramesh Kumar",
          "customer_phone": "9876543210",
          "address": "Shop 12, Main Market, Sector 5",
          "qty": 5,
          "weight": 10.5,
          "total_price": 120000,
          "status": "pending",
          "notes": null,
          "created_at": "2026-06-18T10:00:00Z",
          "updated_at": "2026-06-18T10:00:00Z"
        }
      ]
    }
  ]
}
```

**SQL:**
```sql
SELECT d.*, di.*, c.name as customer_name, c.phone as customer_phone
FROM deliveries d
JOIN delivery_items di ON di.delivery_id = d.id
LEFT JOIN customers c ON c.id = di.customer_id
WHERE d.driver_id = ?
ORDER BY d.created_at DESC
```

> **Note:** The current `delivery_items` table stores `address` and `stock_amount` as free text. For the driver app, we need structured fields: `qty` (integer), `weight` (real, nullable), `total_price` (integer, nullable). Either:
> - **Option A:** Add `qty`, `weight`, `total_price` columns to `delivery_items` table (RECOMMENDED)
> - **Option B:** Parse `stock_amount` string into structured fields on the Worker side
> We recommend Option A. See D1 migration below.

### 2. `PATCH /delivery-item/:id/status` (already specified in API_SPEC.md)

**Extended body** (adding `'rejected'` as a valid status):
```json
{
  "status": "done" | "rejected",
  "driver_id": "uuid"
}
```

**Behaviour:**
- Validates `driver_id` is active
- Validates the delivery item belongs to a delivery assigned to this driver
- Updates `status` and `updated_at`
- If ALL items in the delivery are now `done` or `rejected`, set delivery `status = 'completed'`

### 3. `PATCH /delivery-item/:id` (new — for editing order details)

**Body:**
```json
{
  "qty": 3,
  "weight": 5.5,
  "driver_id": "uuid"
}
```

**Behaviour:**
- Validates driver owns this delivery item
- Updates only the provided fields + `updated_at`
- Returns `{ "ok": true }`

### 4. `POST /driver/expense` (new)

**Body:**
```json
{
  "driver_id": "uuid",
  "category": "petrol_diesel",
  "amount": 15000,
  "note": "Filled tank near Jhunjhunu",
  "image_url": "https://firebasestorage.googleapis.com/..."
}
```

**Behaviour:**
- Validates driver is active
- Inserts into `expenses` table (new — see D1 migration below)
- Returns `{ "ok": true, "id": "expense-uuid" }`

### D1 Database Migration (new tables + columns)

```sql
-- Add structured fields to delivery_items (Option A)
ALTER TABLE delivery_items ADD COLUMN qty INTEGER DEFAULT 0;
ALTER TABLE delivery_items ADD COLUMN weight REAL;
ALTER TABLE delivery_items ADD COLUMN total_price INTEGER;
ALTER TABLE delivery_items ADD COLUMN customer_name TEXT;
ALTER TABLE delivery_items ADD COLUMN customer_phone TEXT;

-- Add 'rejected' as a valid status value
-- (No SQL needed — status is a TEXT column, any value is accepted.
--  Validation happens in the Worker code.)

-- New table: expenses
CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT PRIMARY KEY,
  driver_id   TEXT NOT NULL,
  category    TEXT NOT NULL,       -- 'petrol_diesel' | 'repair' | 'defective_item' | 'other'
  amount      INTEGER NOT NULL,    -- paise for price categories, raw count for defective_item
  note        TEXT,
  image_url   TEXT NOT NULL,       -- Firebase Storage URL
  created_at  TEXT NOT NULL,
  FOREIGN KEY (driver_id) REFERENCES drivers(id)
);

-- Index for faster driver-specific queries
CREATE INDEX IF NOT EXISTS idx_expenses_driver ON expenses(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
```

---

## Screens Summary

| Screen | Route | Purpose |
|---|---|---|
| Login | `/login` | Phone + OTP authentication |
| Orders | `/(tabs)/` | View, complete, reject, edit delivery orders |
| Stock | `/(tabs)/stock` | Set and track carried stock |
| Expenses | `/(tabs)/expenses` | Photograph receipts, submit categorized expenses |

---

## Tab Bar Structure

```
[  📋 Orders  ]  [  📦 Stock  ]  [  💰 Expenses  ]
```

Three tabs. No settings tab needed — the driver has no configurable settings after initial login. If logout is needed, it could be added as a button in the Orders screen header.

---

## Verification Plan

### Automated Verification

```bash
# 1. TypeScript compilation (no type errors)
npx tsc --noEmit

# 2. Ensure all imports resolve
npx expo start --clear

# 3. Build for Android
npx expo run:android
```

### Manual Verification (on device/emulator)

| # | Test | Expected Result |
|---|---|---|
| **Login** | | |
| 1 | Open app for first time | Login screen shown. No tabs visible. |
| 2 | Enter invalid Worker URL | "Enter a valid server URL" inline error |
| 3 | Enter 9-digit phone | "Phone number must be 10 digits" inline error |
| 4 | Enter 5-digit OTP | "OTP must be 6 digits" inline error |
| 5 | Enter valid URL + phone + wrong OTP | "Wrong OTP. Please check with admin." error |
| 6 | Enter correct credentials | Navigates to Orders tab. Toast: "Welcome, [name]!" |
| 7 | Close and reopen app | Goes straight to Orders tab (session persisted) |
| **Orders** | | |
| 8 | No orders assigned | Empty state: "No orders yet" with clipboard icon |
| 9 | Orders assigned by admin | List of OrderCards appears with customer name, qty, status |
| 10 | Tap "Done" on pending order | Confirmation alert → confirm → status changes to Done ✓, toast shown |
| 11 | Tap "Reject" on pending order | Confirmation alert → reject → status changes to Rejected ✗, toast shown |
| 12 | Tap "Edit" on pending order | Modal opens with qty/weight fields pre-filled. Edit and save → values update. |
| 13 | Pull to refresh | Spinner appears, list re-fetches from API |
| 14 | Filter: tap "Done" pill | Only completed orders shown. If none: "No done orders" |
| 15 | Check progress bar | Shows X / Y completed. Bar fills proportionally. |
| **Stock** | | |
| 16 | First visit | Shows Qty: 0, Weight: 0 with input fields |
| 17 | Enter Qty: 100, Weight: 500 → Set Stock | Big numbers update to 100 items / 500 kg |
| 18 | Go to Orders → mark order Done (Qty: 5, Wt: 10) | Return to Stock → Qty: 95, Weight: 490 |
| 19 | Mark order Rejected | Stock does NOT change |
| **Expenses** | | |
| 20 | Tap camera area | Camera preview opens full screen |
| 21 | Take photo → "Use Photo" | Photo appears in the form |
| 22 | Select category "Petrol/Diesel" | Card highlighted. Amount label: "Amount (₹)" |
| 23 | Select category "Defective Item" | Amount label: "Quantity". Keyboard: number-pad. |
| 24 | Fill all fields → Submit | Upload progress shown → "Expense submitted ✓" toast → form cleared |
| 25 | Submit without image | Submit button disabled |
| **Offline** | | |
| 26 | Turn airplane mode ON | Amber banner appears: "You're offline..." |
| 27 | Try to mark order as Done while offline | Toast: "You need internet to update orders." |
| 28 | Update stock while offline | Stock updates successfully (local only) |
| **Auto-logout** | | |
| 29 | Simulate 30 days without orders | On app open → session cleared → login screen shown |

---

## Dependencies Summary

| Package | Purpose | Install Command |
|---|---|---|
| `expo` ~56 | Framework | Included in template |
| `expo-router` ~56 | File-based navigation | Included in template |
| `nativewind` ^4 | Tailwind CSS for RN | `npx expo install nativewind` |
| `tailwindcss` ^3 | CSS utility framework | `pnpm add tailwindcss` |
| `@tanstack/react-query` ^5 | Server state, polling | `pnpm add @tanstack/react-query` |
| `zustand` ^4 | Global state | `pnpm add zustand` |
| `expo-secure-store` | Encrypted session storage | `npx expo install expo-secure-store` |
| `expo-camera` | Expense photo capture | `npx expo install expo-camera` |
| `expo-location` | Location tracking (stub) | `npx expo install expo-location` |
| `@react-native-community/netinfo` | Network status detection | `npx expo install @react-native-community/netinfo` |
| `react-native-safe-area-context` | Safe area insets | `npx expo install react-native-safe-area-context` |
| `react-native-reanimated` | Micro-animations | `npx expo install react-native-reanimated` |
| `react-native-toast-message` ^2 | Toast notifications | `pnpm add react-native-toast-message` |
| `firebase` ^11 | Firebase Storage for images | `pnpm add firebase` |
| `expo-file-system` | File operations for upload | `npx expo install expo-file-system` |
| `expo-symbols` | SF Symbols / Material Icons | `npx expo install expo-symbols` |
| `expo-status-bar` | Status bar control | Included in template |
| `expo-splash-screen` | Splash screen | Included in template |
| `expo-constants` | App constants | Included in template |

---

## What This App Does NOT Need (compared to Admin App)

| Feature | Why Not Needed |
|---|---|
| WatermelonDB | No local database required. The driver app is stateless — it fetches orders from the server on every poll. Only stock (2 numbers) is stored locally in SecureStore. |
| `expo-clipboard` | No bill generation or text copying in driver app |
| `expo-linking` (SMS) | No SMS sending. Phone numbers are tappable to open dialer, which uses standard `Linking.openURL('tel:...')` from React Native core. |
| `@shopify/flash-list` | Lists are small (typically <50 items). Standard `FlatList` is sufficient. |
| `expo-blur` | No glassmorphism effects needed for this simple app |
| `expo-linear-gradient` | No gradient effects needed |
| `react-native-maps` / `react-native-webview` | No map display in driver app. Location is SENT, not displayed. |
| Sync engine (`lib/sync.ts`) | No bidirectional sync. Driver app is a thin client — reads from API, writes to API. No local-first architecture. |
