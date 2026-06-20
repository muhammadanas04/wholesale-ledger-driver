import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface DriverSession {
  driverId: string;
  driverName: string;
  phone: string;
  workerUrl: string;
  token: string;                // JWT token for authentication
  loginTimestamp: string;       // ISO 8601 — when OTP was entered
  lastOrderReceivedAt: string;  // ISO 8601 — for 30-day auto-logout
}

export interface StockState {
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
  setStock: (stock: Partial<StockState>) => Promise<void>;
  deductStock: (qty: number, weight: number) => Promise<void>;
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

  setStock: async (partial: Partial<StockState>) => {
    const current = get().stock;
    const updated = { ...current, ...partial };
    set({ stock: updated });
    try {
      await SecureStore.setItemAsync(STOCK_STORE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to write stock to SecureStore', e);
    }
  },

  deductStock: async (qty: number, weight: number) => {
    const current = get().stock;
    const updated = {
      qty: Math.max(0, current.qty - qty),
      weight: Math.max(0, Number((current.weight - weight).toFixed(2))),
    };
    set({ stock: updated });
    try {
      await SecureStore.setItemAsync(STOCK_STORE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to write stock to SecureStore', e);
    }
  },
}));
