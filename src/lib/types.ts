export type OrderStatus = 'pending_payment' | 'cooking' | 'ready' | 'completed' | 'cancelled';

export interface Vendor {
  id: string;
  owner_user_id: string;
  shop_name: string;
  promptpay_id: string;
  logo_url: string | null;
  is_open: boolean;
  created_at: string;
}

export interface MenuOption {
  id: string;
  menu_item_id: string;
  label: string;
  extra_price: number;
}

export interface MenuItem {
  id: string;
  vendor_id: string;
  name_th: string;
  name_en: string | null;
  price: number;
  photo_url: string | null;
  category: string | null;
  is_sold_out: boolean;
  sort_order: number;
  menu_options?: MenuOption[];
}

export interface SelectedOption { id: string; label: string; extra_price: number }

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  quantity: number;
  selected_options: SelectedOption[];
  line_total: number;
}

export interface Order {
  id: string;
  vendor_id: string;
  queue_number: number;
  status: OrderStatus;
  total_amount: number;
  customer_note: string | null;
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  order_items?: OrderItem[];
}

export interface PublicOrder {
  id: string;
  queue_number: number;
  status: OrderStatus;
  total_amount: number;
  customer_note: string | null;
  created_at: string;
  vendor: Pick<Vendor, 'id' | 'shop_name' | 'promptpay_id' | 'logo_url'>;
  items: { name: string; quantity: number; selected_options: SelectedOption[]; line_total: number }[];
}
