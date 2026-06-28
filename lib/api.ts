import { useAppStore } from '../store/app';
import { AuthResponse, Delivery, Customer, DeliveryItem } from '../types';
import * as FileSystem from 'expo-file-system/legacy';

export const WORKER_URL = 'https://wholesale-sync.niranjanskr06.workers.dev';

class DriverApi {
  private getWorkerUrl(): string {
    return WORKER_URL;
  }

  private getDriverId(): string {
    const session = useAppStore.getState().session;
    if (!session) throw new Error('Not authenticated');
    return session.driverId;
  }

  private getHeaders(): HeadersInit {
    const session = useAppStore.getState().session;
    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    if (session?.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
    }
    return headers;
  }

  // ── Auth (no session required) ──
  async authenticate(
    workerUrl: string,
    phone: string,
    otp: string
  ): Promise<AuthResponse> {
    const res = await fetch(`${WORKER_URL}/driver/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => 'Authentication failed');
      throw new Error(errText || 'Authentication failed');
    }
    return res.json();
  }

  // ── Deliveries ──
  async getMyDeliveries(): Promise<{ deliveries: Delivery[] }> {
    const res = await fetch(
      `${this.getWorkerUrl()}/driver/deliveries`,
      {
        headers: this.getHeaders(),
      }
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
        headers: this.getHeaders(),
        body: JSON.stringify({
          status,
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
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
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
      headers: this.getHeaders(),
      body: JSON.stringify({
        latitude,
        longitude,
      }),
    });
    if (!res.ok) throw new Error('Failed to report location');
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
      headers: this.getHeaders(),
      body: JSON.stringify(expense),
    });
    if (!res.ok) throw new Error('Failed to submit expense');
    return res.json();
  }

  // ── Get expense history ──
  async getExpenses(): Promise<{ expenses: any[] }> {
    const res = await fetch(`${this.getWorkerUrl()}/driver/expenses`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch expenses');
    return res.json();
  }

  // ── Upload Receipt via Cloudflare Worker Proxy to Backblaze B2 ──
  async uploadReceipt(uri: string): Promise<{ ok: boolean; url?: string; error?: string }> {
    const filename = uri.split('/').pop() || 'receipt.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    try {
      const response = await FileSystem.uploadAsync(
        `${this.getWorkerUrl()}/driver/upload-receipt`,
        uri,
        {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: 1 /* MULTIPART */,
          headers: {
            'Authorization': `Bearer ${useAppStore.getState().session?.token}`,
          },
          parameters: {},
        }
      );

      if (response.status >= 200 && response.status < 300) {
        return JSON.parse(response.body);
      } else {
        return { ok: false, error: response.body || 'Upload failed' };
      }
    } catch (err: any) {
      return { ok: false, error: err.message || 'Upload failed' };
    }
  }

  // ── Customers ──
  async getCustomers(): Promise<{ customers: Customer[] }> {
    const res = await fetch(`${this.getWorkerUrl()}/driver/customers`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  }

  // ── Create Delivery Item ──
  async createDeliveryItem(data: {
    customer_name: string;
    address: string;
    qty: number;
    weight: number;
  }): Promise<{ ok: boolean; item?: DeliveryItem }> {
    const res = await fetch(`${this.getWorkerUrl()}/driver/delivery-items`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create order');
    return res.json();
  }
}

export const api = new DriverApi();
