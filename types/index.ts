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
  token?: string;
  error?: string;
}
