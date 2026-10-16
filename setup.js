import fs from 'fs';
import path from 'path';

const files = {
  'index.html': `<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#ea580c" />
    <title>Jaisod จ่ายสด</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

  'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
`,

  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
`,

  'vercel.json': JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/' }] }, null, 2) + '\n',
  '.env.example': 'VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co\nVITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY\n',
  'tailwind.config.js': `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ['./index.html', './src/**/*.{ts,tsx}'],\n  theme: {\n    extend: {\n      fontFamily: { sans: ['Prompt', 'Noto Sans Thai', 'sans-serif'] },\n    },\n  },\n  plugins: [],\n};\n`,
  'postcss.config.js': 'export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n',

  'src/index.css': `@import url('https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

body { @apply bg-orange-50 text-stone-800 antialiased; }
`,

  'src/vite-env.d.ts': `/// <reference types="vite/client" />\n`,

  'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { LangProvider } from './lib/i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LangProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LangProvider>
  </React.StrictMode>
);
`,

  'src/lib/supabase.ts': `import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

export async function uploadImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = \`\${user.id}/\${crypto.randomUUID()}.\${ext}\`;\n  const { error } = await supabase.storage.from('menu-photos').upload(path, file);
  if (error) throw error;
  return supabase.storage.from('menu-photos').getPublicUrl(path).data.publicUrl;
}
`,

  'src/lib/types.ts': `export type OrderStatus = 'pending_payment' | 'cooking' | 'ready' | 'completed' | 'cancelled';

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
`,

  'src/lib/promptpay.ts': `const f = (id: string, value: string) => id + value.length.toString().padStart(2, '0') + value;

function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function promptPayPayload(target: string, amount?: number): string {
  const digits = target.replace(/\\D/g, '');
  let account: string;
  if (digits.length >= 15) account = f('03', digits);
  else if (digits.length >= 13) account = f('02', digits);
  else account = f('01', ('0000000000000' + digits.replace(/^0/, '66')).slice(-13));

  const data =
    f('00', '01') +
    f('01', amount ? '12' : '11') +
    f('29', f('00', 'A000000677010111') + account) +
    f('53', '764') +
    (amount ? f('54', amount.toFixed(2)) : '') +
    f('58', 'TH') +
    '6304';
  return data + crc16(data);
}

export function isValidPromptPayId(raw: string): boolean {
  const d = raw.replace(/\\D/g, '');
  return /^0\\d{9}$/.test(d) || /^\\d{13}$/.test(d);
}
`,

  'src/lib/format.ts': `export const baht = (n: number | string) =>
  '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const todayBkk = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

export function dayRange(day: string): [string, string] {
  const start = new Date(\`\${day}T00:00:00+07:00\`);
  const end = new Date(start.getTime() + 86_400_000);
  return [start.toISOString(), end.toISOString()];
}

export const timeHM = (iso: string) =>
  new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}
`,

  'src/lib/cart.ts': `import { useEffect, useState } from 'react';
import type { MenuItem, MenuOption } from './types';

export interface CartLine {
  key: string;
  menu_item_id: string;
  name_th: string;
  name_en: string | null;
  unit_price: number;
  option_ids: string[];
  option_labels: string[];
  quantity: number;
}

const storageKey = (vendorId: string) => \`jaisod_cart_\${vendorId}\`;

function load(vendorId: string): CartLine[] {
  try { return JSON.parse(localStorage.getItem(storageKey(vendorId)) || '[]'); }
  catch { return []; }
}

export function useCart(vendorId: string) {
  const [lines, setLines] = useState<CartLine[]>(() => load(vendorId));

  useEffect(() => {
    localStorage.setItem(storageKey(vendorId), JSON.stringify(lines));
  }, [vendorId, lines]);

  const add = (item: MenuItem, opts: MenuOption[], quantity = 1) => {
    const ids = opts.map((o) => o.id).sort();
    const key = \`\${item.id}|\${ids.join(',')}\`;
    const unit = Number(item.price) + opts.reduce((s, o) => s + Number(o.extra_price), 0);
    setLines((prev) => {
      const hit = prev.find((l) => l.key === key);
      if (hit) return prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + quantity) } : l));
      return [...prev, {
        key, menu_item_id: item.id, name_th: item.name_th, name_en: item.name_en,
        unit_price: unit, option_ids: ids, option_labels: opts.map((o) => o.label), quantity,
      }];
    });
  };

  const setQty = (key: string, q: number) =>
    setLines((prev) => (q <= 0 ? prev.filter((l) => l.key !== key)
      : prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, q) } : l))));

  const clear = () => { localStorage.removeItem(storageKey(vendorId)); setLines([]); };

  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  return { lines, add, setQty, clear, count, total };
}

export function rememberOrder(orderId: string) {
  const list: string[] = JSON.parse(localStorage.getItem('jaisod_orders') || '[]');
  localStorage.setItem('jaisod_orders', JSON.stringify([orderId, ...list.filter((x) => x !== orderId)].slice(0, 20)));
}
`,

  'src/lib/i18n.tsx': `import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const th = {
  tagline: 'สแกน สั่ง จ่าย จบ',
  forVendors: 'สำหรับร้านค้า',
  other: 'อื่นๆ',
  shopClosed: 'ร้านปิดอยู่ตอนนี้',
  shopNotFound: 'ไม่พบร้านค้า',
  soldOut: 'หมด',
  add: 'เพิ่ม',
  viewCart: 'ดูตะกร้า',
  cart: 'ตะกร้าของคุณ',
  emptyCart: 'ยังไม่มีรายการ',
  note: 'หมายเหตุถึงร้าน (เช่น ไม่ใส่ผัก)',
  total: 'รวม',
  placeOrder: 'สั่งและไปหน้าจ่ายเงิน',
  placing: 'กำลังสั่ง...',
  backToMenu: 'กลับไปเมนู',
  options: 'ตัวเลือกเพิ่มเติม',
  addToCart: 'ใส่ตะกร้า',
  cancel: 'ยกเลิก',
  queue: 'คิวที่',
  payTitle: 'สแกนจ่ายด้วยแอปธนาคาร',
  payStep1: 'กด "บันทึก QR" หรือแคปหน้าจอ',
  payStep2: 'เปิดแอปธนาคาร → สแกน → เลือกรูปจากอัลบั้ม',
  payStep3: 'โชว์สลิปให้ร้าน ร้านจะกดยืนยัน',
  saveQr: 'บันทึก QR',
  statusPending: 'รอร้านยืนยันการชำระเงิน',
  statusCooking: 'ได้รับเงินแล้ว กำลังทำอาหาร',
  statusReady: 'อาหารพร้อมแล้ว! มารับได้เลย',
  statusCompleted: 'ขอบคุณที่อุดหนุน',
  statusCancelled: 'ออเดอร์ถูกยกเลิก',
  keepOpen: 'เปิดหน้านี้ไว้ สถานะจะอัปเดตเอง',
  orderNotFound: 'ไม่พบออเดอร์',
  errSoldOut: 'มีบางเมนูเพิ่งหมด กรุณาแก้ไขตะกร้า',
  errClosed: 'ร้านปิดรับออเดอร์แล้ว',
  errGeneric: 'เกิดข้อผิดพลาด ลองอีกครั้ง',
  login: 'เข้าสู่ระบบ',
  signup: 'สมัครใช้งาน',
  email: 'อีเมล',
  password: 'รหัสผ่าน (อย่างน้อย 6 ตัว)',
  noAccount: 'ยังไม่มีบัญชี? สมัครเลย',
  haveAccount: 'มีบัญชีแล้ว? เข้าสู่ระบบ',
  checkEmail: 'สมัครสำเร็จ! กรุณายืนยันอีเมลแล้วเข้าสู่ระบบ',
  onboardTitle: 'ตั้งค่าร้านของคุณ',
  shopName: 'ชื่อร้าน',
  promptpayId: 'พร้อมเพย์ (เบอร์โทร 10 หลัก หรือเลขบัตร 13 หลัก)',
  invalidPromptpay: 'หมายเลขพร้อมเพย์ไม่ถูกต้อง',
  logo: 'โลโก้ร้าน (ไม่บังคับ)',
  createShop: 'สร้างร้าน',
  navOrders: 'ออเดอร์',
  navMenu: 'เมนู',
  navPoster: 'QR ร้าน',
  navSummary: 'สรุปยอด',
  open: 'เปิดร้าน',
  closed: 'ปิดร้าน',
  logout: 'ออกจากระบบ',
  colWaiting: 'รอตรวจเงิน',
  colCooking: 'กำลังทำ',
  colReady: 'พร้อมรับ',
  markPaid: 'ได้รับเงินแล้ว',
  markReady: 'ทำเสร็จแล้ว',
  markPicked: 'ลูกค้ารับแล้ว',
  confirmCancel: 'ยกเลิกออเดอร์นี้?',
  noOrders: 'ยังไม่มีออเดอร์',
  checkBank: 'ตรวจยอดในแอปธนาคารของร้านก่อนกด อย่าเชื่อแค่สลิป',
  addItem: '+ เพิ่มเมนู',
  editItem: 'แก้ไขเมนู',
  nameTh: 'ชื่อเมนู (ไทย)',
  nameEn: 'ชื่อเมนู (อังกฤษ)',
  price: 'ราคา (บาท)',
  category: 'หมวดหมู่',
  photo: 'รูปเมนู',
  addOption: '+ เพิ่มตัวเลือก',
  optionLabel: 'เช่น พิเศษ, ไข่ดาว',
  save: 'บันทึก',
  saving: 'กำลังบันทึก...',
  delete: 'ลบ',
  edit: 'แก้ไข',
  confirmDelete: 'ลบเมนูนี้?',
  available: 'มีขาย',
  posterScan: 'สแกนเพื่อสั่งและจ่าย',
  print: 'พิมพ์โปสเตอร์',
  download: 'ดาวน์โหลด QR',
  testQr: 'ทดสอบพร้อมเพย์ (1 บาท)',
  testQrHint: 'สแกนจ่าย 1 บาทเพื่อเช็คว่าเงินเข้าบัญชีถูกต้อง',
  date: 'วันที่',
  paidOrders: 'ออเดอร์ที่จ่ายแล้ว',
  revenue: 'ยอดขาย',
  avgTicket: 'เฉลี่ยต่อออเดอร์',
  topItems: 'เมนูขายดี',
  cancelledCount: 'ยกเลิก',
  unpaidCount: 'ค้างตรวจเงิน',
  exportCsv: 'ส่งออก CSV',
};

type Key = keyof typeof th;

const en: Record<Key, string> = {
  tagline: 'Scan. Order. Pay. Done.',
  forVendors: 'For vendors',
  other: 'Other',
  shopClosed: 'This shop is closed right now',
  shopNotFound: 'Shop not found',
  soldOut: 'Sold out',
  add: 'Add',
  viewCart: 'View cart',
  cart: 'Your order',
  emptyCart: 'Your cart is empty',
  note: 'Note for the shop (e.g. no veggies)',
  total: 'Total',
  placeOrder: 'Place order & pay',
  placing: 'Placing order...',
  backToMenu: 'Back to menu',
  options: 'Options',
  addToCart: 'Add to cart',
  cancel: 'Cancel',
  queue: 'Queue',
  payTitle: 'Pay with your banking app',
  payStep1: 'Tap "Save QR" or take a screenshot',
  payStep2: 'Open your bank app → Scan → pick from gallery',
  payStep3: 'Show the slip to the vendor to confirm',
  saveQr: 'Save QR',
  statusPending: 'Waiting for the vendor to confirm payment',
  statusCooking: 'Payment received, cooking now',
  statusReady: 'Your food is ready! Please pick it up',
  statusCompleted: 'Thanks for your order!',
  statusCancelled: 'This order was cancelled',
  keepOpen: 'Keep this page open, it updates automatically',
  orderNotFound: 'Order not found',
  errSoldOut: 'Some items just sold out, please update your cart',
  errClosed: 'The shop stopped taking orders',
  errGeneric: 'Something went wrong, please try again',
  login: 'Log in',
  signup: 'Sign up',
  email: 'Email',
  password: 'Password (min 6 characters)',
  noAccount: 'No account? Sign up',
  haveAccount: 'Have an account? Log in',
  checkEmail: 'Signed up! Please confirm your email, then log in',
  onboardTitle: 'Set up your shop',
  shopName: 'Shop name',
  promptpayId: 'PromptPay (10-digit phone or 13-digit ID)',
  invalidPromptpay: 'Invalid PromptPay number',
  logo: 'Shop logo (optional)',
  createShop: 'Create shop',
  navOrders: 'Orders',
  navMenu: 'Menu',
  navPoster: 'Shop QR',
  navSummary: 'Summary',
  open: 'Open',
  closed: 'Closed',
  logout: 'Log out',
  colWaiting: 'Check payment',
  colCooking: 'Cooking',
  colReady: 'Ready',
  markPaid: 'Payment received',
  markReady: 'Done cooking',
  markPicked: 'Picked up',
  confirmCancel: 'Cancel this order?',
  noOrders: 'No orders yet',
  checkBank: 'Check your bank app before tapping, never trust the slip alone',
  addItem: '+ Add item',
  editItem: 'Edit item',
  nameTh: 'Name (Thai)',
  nameEn: 'Name (English)',
  price: 'Price (THB)',
  category: 'Category',
  photo: 'Photo',
  addOption: '+ Add option',
  optionLabel: 'e.g. Large, Fried egg',
  save: 'Save',
  saving: 'Saving...',
  delete: 'Delete',
  edit: 'Edit',
  confirmDelete: 'Delete this item?',
  available: 'Available',
  posterScan: 'Scan to order & pay',
  print: 'Print poster',
  download: 'Download QR',
  testQr: 'Test PromptPay (฿1)',
  testQrHint: 'Pay ฿1 to confirm money reaches the right account',
  date: 'Date',
  paidOrders: 'Paid orders',
  revenue: 'Revenue',
  avgTicket: 'Avg per order',
  topItems: 'Top items',
  cancelledCount: 'Cancelled',
  unpaidCount: 'Unconfirmed',
  exportCsv: 'Export CSV',
};

type Lang = 'th' | 'en';
interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }
const LangCtx = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('jaisod_lang') as Lang) || 'th');
  const setLang = (l: Lang) => { localStorage.setItem('jaisod_lang', l); setLangState(l); };
  const t = useCallback((k: Key) => (lang === 'th' ? th : en)[k], [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const c = useContext(LangCtx);
  if (!c) throw new Error('LangProvider missing');
  return c;
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
      className="rounded-full border border-orange-300 bg-white px-3 py-1 text-sm font-medium text-orange-700"
    >
      {lang === 'th' ? 'EN' : 'ไทย'}
    </button>
  );
}

export type TKey = Key;
`,

  'src/App.tsx': `import { Link, Route, Routes } from 'react-router-dom';
import MenuPage from './pages/customer/MenuPage';
import CartPage from './pages/customer/CartPage';
import OrderPage from './pages/customer/OrderPage';
import Login from './pages/vendor/Login';
import Onboarding from './pages/vendor/Onboarding';
import VendorLayout from './pages/vendor/VendorLayout';
import Dashboard from './pages/vendor/Dashboard';
import MenuManager from './pages/vendor/MenuManager';
import Poster from './pages/vendor/Poster';
import Summary from './pages/vendor/Summary';
import { LangToggle, useLang } from './lib/i18n';

function Landing() {
  const { t } = useLang();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="absolute right-4 top-4"><LangToggle /></div>
      <h1 className="text-5xl font-bold text-orange-600">จ่ายสด</h1>
      <p className="text-xl text-stone-600">{t('tagline')}</p>
      <Link to="/vendor" className="rounded-2xl bg-orange-600 px-8 py-4 text-lg font-semibold text-white shadow">
        {t('forVendors')} →
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/s/:vendorId" element={<MenuPage />} />
      <Route path="/s/:vendorId/cart" element={<CartPage />} />
      <Route path="/o/:orderId" element={<OrderPage />} />
      <Route path="/vendor/login" element={<Login />} />
      <Route path="/vendor/onboarding" element={<Onboarding />} />
      <Route path="/vendor" element={<VendorLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="menu" element={<MenuManager />} />
        <Route path="poster" element={<Poster />} />
        <Route path="summary" element={<Summary />} />
      </Route>
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
`,

  'src/pages/customer/MenuPage.tsx': `import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { MenuItem, MenuOption, Vendor } from '../../lib/types';
import { LangToggle, useLang } from '../../lib/i18n';
import { useCart } from '../../lib/cart';
import { baht } from '../../lib/format';

export default function MenuPage() {
  const { vendorId = '' } = useParams();
  const { t, lang } = useLang();
  const cart = useCart(vendorId);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<MenuItem | null>(null);

  useEffect(() => {
    (async () => {
      const [v, m] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', vendorId).maybeSingle(),
        supabase.from('menu_items').select('*, menu_options(*)').eq('vendor_id', vendorId).order('sort_order'),
      ]);
      setVendor(v.data);
      setItems(m.data ?? []);
      setLoading(false);
    })();
  }, [vendorId]);

  const groups = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      const c = it.category || t('other');
      map.set(c, [...(map.get(c) ?? []), it]);
    }
    return [...map.entries()];
  }, [items, t]);

  if (loading) return <div className="p-10 text-center text-stone-500">...</div>;
  if (!vendor) return <div className="p-10 text-center">{t('shopNotFound')}</div>;

  const name = (it: MenuItem) => (lang === 'en' && it.name_en ? it.name_en : it.name_th);

  const tapItem = (it: MenuItem) => {
    if (it.is_sold_out || !vendor.is_open) return;
    if (it.menu_options?.length) setPicking(it);
    else cart.add(it, [], 1);
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-28">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-orange-600 px-4 py-3 text-white shadow">
        {vendor.logo_url && <img src={vendor.logo_url} className="h-10 w-10 rounded-full bg-white object-cover" />}
        <h1 className="flex-1 truncate text-xl font-bold">{vendor.shop_name}</h1>
        <LangToggle />
      </header>

      {!vendor.is_open && (
        <div className="m-4 rounded-xl bg-red-100 p-4 text-center font-medium text-red-700">{t('shopClosed')}</div>
      )}

      {groups.map(([cat, list]) => (
        <section key={cat} className="px-4 pt-5">
          <h2 className="mb-2 text-lg font-semibold text-orange-700">{cat}</h2>
          <div className="grid grid-cols-2 gap-3">
            {list.map((it) => (
              <button
                key={it.id}
                onClick={() => tapItem(it)}
                disabled={it.is_sold_out || !vendor.is_open}
                className={\`overflow-hidden rounded-2xl bg-white text-left shadow-sm transition active:scale-95 \${it.is_sold_out ? 'opacity-50 grayscale' : ''}\`}
              >
                <div className="relative aspect-square bg-orange-100">
                  {it.photo_url
                    ? <img src={it.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    : <div className="flex h-full items-center justify-center text-5xl">🍜</div>}
                  {it.is_sold_out && (
                    <span className="absolute left-2 top-2 rounded-full bg-stone-800 px-2 py-0.5 text-xs text-white">
                      {t('soldOut')}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="line-clamp-2 font-medium leading-tight">{name(it)}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-semibold text-orange-600">{baht(it.price)}</span>
                    {!it.is_sold_out && vendor.is_open && (
                      <span className="rounded-full bg-orange-600 px-2.5 text-lg font-bold text-white">+</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-lg p-4">
          <Link
            to={\`/s/\${vendorId}/cart\`\`}
            className="flex items-center justify-between rounded-2xl bg-orange-600 px-5 py-4 text-lg font-semibold text-white shadow-lg"
          >
            <span>{t('viewCart')} ({cart.count})</span>
            <span>{baht(cart.total)}</span>
          </Link>
        </div>
      )}

      {picking && (
        <OptionSheet
          item={picking}
          title={name(picking)}
          onClose={() => setPicking(null)}
          onAdd={(opts, qty) => { cart.add(picking, opts, qty); setPicking(null); }}
        />
      )}
    </div>
  );
}

function OptionSheet({ item, title, onClose, onAdd }: {
  item: MenuItem; title: string; onClose: () => void; onAdd: (opts: MenuOption[], qty: number) => void;
}) {
  const { t } = useLang();
  const [sel, setSel] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const opts = item.menu_options ?? [];
  const chosen = opts.filter((o) => sel.includes(o.id));
  const unit = Number(item.price) + chosen.reduce((s, o) => s + Number(o.extra_price), 0);
  const toggle = (id: string) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto w-full max-w-lg rounded-t-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="mb-3 text-sm text-stone-500">{t('options')}</p>
        <div className="space-y-2">
          {opts.map((o) => (
            <label key={o.id} className="flex items-center justify-between rounded-xl border p-3">
              <span className="flex items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-orange-600"
                  checked={sel.includes(o.id)} onChange={() => toggle(o.id)} />
                {o.label}
              </span>
              <span className="text-stone-500">+{baht(o.extra_price)}</span>
            </label>
          ))}
        </div>
        <div className="my-5 flex items-center justify-center gap-6">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-11 w-11 rounded-full bg-orange-100 text-2xl">−</button>
          <span className="w-8 text-center text-2xl font-bold">{qty}</span>
          <button onClick={() => setQty(Math.min(20, qty + 1))} className="h-11 w-11 rounded-full bg-orange-100 text-2xl">+</button>
        </div>
        <button onClick={() => onAdd(chosen, qty)}
          className="w-full rounded-2xl bg-orange-600 py-4 text-lg font-semibold text-white">
          {t('addToCart')} · {baht(unit * qty)}
        </button>
      </div>
    </div>
  );
}
`,

  'src/pages/customer/CartPage.tsx': `import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { rememberOrder, useCart } from '../../lib/cart';
import { useLang } from '../../lib/i18n';
import { baht } from '../../lib/format';

export default function CartPage() {
  const { vendorId = '' } = useParams();
  const { t, lang } = useLang();
  const nav = useNavigate();
  const cart = useCart(vendorId);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const place = async () => {
    setBusy(true);
    setErr('');
    const { data, error } = await supabase.rpc('create_order', {
      p_vendor_id: vendorId,
      p_items: cart.lines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity, option_ids: l.option_ids })),
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error || !data) {
      const m = error?.message ?? '';
      setErr(m.includes('SOLD_OUT') ? t('errSoldOut') : m.includes('SHOP_CLOSED') ? t('errClosed') : t('errGeneric'));
      return;
    }
    const orderId = (data as { order_id: string }).order_id;
    rememberOrder(orderId);
    cart.clear();
    nav(\`/o/\${orderId}\`, { replace: true });
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg p-4 pb-40">
      <Link to={\`/s/\${vendorId}\`} className="text-orange-700">← {t('backToMenu')}</Link>
      <h1 className="my-4 text-2xl font-bold">{t('cart')}</h1>

      {cart.lines.length === 0 ? (
        <p className="py-16 text-center text-stone-500">{t('emptyCart')}</p>
      ) : (
        <>
          <ul className="divide-y rounded-2xl bg-white shadow-sm">
            {cart.lines.map((l) => (
              <li key={l.key} className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <div className="font-medium">{lang === 'en' && l.name_en ? l.name_en : l.name_th}</div>
                  {l.option_labels.length > 0 && (
                    <div className="text-sm text-stone-500">{l.option_labels.join(', ')}</div>
                  )}
                  <div className="text-sm text-orange-600">{baht(l.unit_price * l.quantity)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => cart.setQty(l.key, l.quantity - 1)} className="h-9 w-9 rounded-full bg-orange-100 text-xl">−</button>
                  <span className="w-6 text-center font-semibold">{l.quantity}</span>
                  <button onClick={() => cart.setQty(l.key, l.quantity + 1)} className="h-9 w-9 rounded-full bg-orange-100 text-xl">+</button>
                </div>
              </li>
            ))}
          </ul>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder={t('note')}
            className="mt-4 w-full rounded-2xl border border-orange-200 bg-white p-3"
            rows={2}
          />
          {err && <p className="mt-3 rounded-xl bg-red-100 p-3 text-red-700">{err}</p>}
        </>
      )}

      {cart.lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-lg space-y-3 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="flex justify-between text-xl font-bold">
            <span>{t('total')}</span><span className="text-orange-600">{baht(cart.total)}</span>
          </div>
          <button disabled={busy} onClick={place}
            className="w-full rounded-2xl bg-orange-600 py-4 text-lg font-semibold text-white disabled:opacity-60">
            {busy ? t('placing') : t('placeOrder')}
          </button>
        </div>
      )}
    </div>
  );
}
`,

  'src/pages/customer/OrderPage.tsx': `import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import type { OrderStatus, PublicOrder } from '../../lib/types';
import { LangToggle, useLang, type TKey } from '../../lib/i18n';
import { promptPayPayload } from '../../lib/promptpay';
import { baht } from '../../lib/format';

const STATUS: Record<OrderStatus, { key: TKey; cls: string }> = {
  pending_payment: { key: 'statusPending', cls: 'bg-amber-100 text-amber-800' },
  cooking: { key: 'statusCooking', cls: 'bg-blue-100 text-blue-800' },
  ready: { key: 'statusReady', cls: 'bg-green-500 text-white animate-pulse' },
  completed: { key: 'statusCompleted', cls: 'bg-stone-200 text-stone-700' },
  cancelled: { key: 'statusCancelled', cls: 'bg-red-100 text-red-700' },
};

export default function OrderPage() {
  const { orderId = '' } = useParams();
  const { t } = useLang();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState('');
  const prevStatus = useRef<OrderStatus | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_order', { p_order_id: orderId });
    setOrder((data as PublicOrder) ?? null);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(\`order:\${orderId}\`)
      .on('broadcast', { event: 'status_changed' }, () => load())
      .subscribe();
    const poll = window.setInterval(load, 10_000);
    return () => { supabase.removeChannel(ch); window.clearInterval(poll); };
  }, [orderId, load]);

  useEffect(() => {
    if (!order) return;
    if (prevStatus.current && prevStatus.current !== 'ready' && order.status === 'ready') {
      navigator.vibrate?.([400, 150, 400, 150, 400]);
    }
    prevStatus.current = order.status;
  }, [order]);

  useEffect(() => {
    if (!order || order.status !== 'pending_payment') return;
    const payload = promptPayPayload(order.vendor.promptpay_id, Number(order.total_amount));
    QRCode.toDataURL(payload, { width: 360, margin: 1 }).then(setQr);
  }, [order]);

  if (loading) return <div className="p-10 text-center text-stone-500">...</div>;
  if (!order) return <div className="p-10 text-center">{t('orderNotFound')}</div>;

  const s = STATUS[order.status];

  return (
    <div className="mx-auto min-h-screen max-w-lg p-4 pb-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="truncate text-lg font-semibold">{order.vendor.shop_name}</h1>
        <LangToggle />
      </div>

      <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
        <div className="text-stone-500">{t('queue')}</div>
        <div className="text-7xl font-bold text-orange-600">#{order.queue_number}</div>
        <div className={\`mt-4 rounded-2xl px-4 py-3 text-lg font-semibold \${s.cls}\`}>{t(s.key)}</div>
        {['pending_payment', 'cooking'].includes(order.status) && (
          <p className="mt-2 text-sm text-stone-500">{t('keepOpen')}</p>
        )}
      </div>

      {order.status === 'pending_payment' && (
        <div className="mt-4 rounded-3xl bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold">{t('payTitle')}</h2>
          <div className="mt-1 text-3xl font-bold text-orange-600">{baht(order.total_amount)}</div>
          <div className="mx-auto mt-4 w-fit rounded-2xl border-4 border-[#113566] p-2">
            <div className="mb-1 rounded bg-[#113566] py-1 text-sm font-bold tracking-wide text-white">PromptPay</div>
            {qr && <img src={qr} alt="PromptPay QR" className="h-64 w-64" />}
          </div>
          {qr && (
            <a href={qr} download={\`jaisod-q\${order.queue_number}.png\`}
              className="mt-4 inline-block rounded-xl bg-[#113566] px-6 py-3 font-semibold text-white">
              {t('saveQr')}
            </a>
          )}
          <ol className="mt-5 space-y-1 text-left text-sm text-stone-600">
            <li>1. {t('payStep1')}</li>
            <li>2. {t('payStep2')}</li>
            <li>3. {t('payStep3')}</li>
          </ol>
        </div>
      )}

      <ul className="mt-4 divide-y rounded-3xl bg-white px-5 shadow-sm">
        {order.items.map((i, idx) => (
          <li key={idx} className="flex justify-between py-3">
            <span>
              {i.quantity}× {i.name}
              {i.selected_options.length > 0 && (
                <span className="block text-sm text-stone-500">{i.selected_options.map((o) => o.label).join(', ')}</span>
              )}
            </span>
            <span>{baht(i.line_total)}</span>
          </li>
        ))}
        <li className="flex justify-between py-3 font-bold">
          <span>{t('total')}</span><span>{baht(order.total_amount)}</span>
        </li>
      </ul>
    </div>
  );
}
`,

  'src/pages/vendor/Login.tsx': `import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LangToggle, useLang } from '../../lib/i18n';

export default function Login() {
  const { t } = useLang();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav('/vendor', { replace: true }); });
  }, [nav]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg(error.message);
      nav('/vendor', { replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (error) return setMsg(error.message);
      if (!data.session) return setMsg(t('checkEmail'));
      nav('/vendor/onboarding', { replace: true });
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <div className="absolute right-4 top-4"><LangToggle /></div>
      <h1 className="mb-1 text-center text-4xl font-bold text-orange-600">จ่ายสด</h1>
      <p className="mb-8 text-center text-stone-500">{t('forVendors')}</p>
      <form onSubmit={submit} className="space-y-3">
        <input type="email" required placeholder={t('email')} value={email}
          onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border p-3" />
        <input type="password" required minLength={6} placeholder={t('password')} value={password}
          onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border p-3" />
        {msg && <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-800">{msg}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-60">
          {mode === 'login' ? t('login') : t('signup')}
        </button>
      </form>
      <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="mt-4 text-sm text-orange-700">
        {mode === 'login' ? t('noAccount') : t('haveAccount')}
      </button>
    </div>
  );
}
`,

  'src/pages/vendor/Onboarding.tsx': `import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, uploadImage } from '../../lib/supabase';
import { useLang } from '../../lib/i18n';
import { isValidPromptPayId } from '../../lib/promptpay';
import { errMsg } from '../../lib/format';

export default function Onboarding() {
  const { t } = useLang();
  const nav = useNavigate();
  const [shopName, setShopName] = useState('');
  const [pp, setPp] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return nav('/vendor/login', { replace: true });
      const { data } = await supabase.from('vendors').select('id').eq('owner_user_id', session.user.id).maybeSingle();
      if (data) nav('/vendor', { replace: true });
    })();
  }, [nav]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!isValidPromptPayId(pp)) return setErr(t('invalidPromptpay'));
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      const logo_url = logo ? await uploadImage(logo) : null;
      const { error } = await supabase.from('vendors').insert({
        owner_user_id: user.id, shop_name: shopName.trim(), promptpay_id: pp.replace(/\\D/g, ''), logo_url,
      });
      if (error) throw error;
      nav('/vendor', { replace: true });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-bold">{t('onboardTitle')}</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-stone-600">{t('shopName')}</span>
          <input required maxLength={80} value={shopName} onChange={(e) => setShopName(e.target.value)}
            className="mt-1 w-full rounded-xl border p-3" />
        </label>
        <label className="block">
          <span className="text-sm text-stone-600">{t('promptpayId')}</span>
          <input required inputMode="numeric" value={pp} onChange={(e) => setPp(e.target.value)}
            className="mt-1 w-full rounded-xl border p-3" placeholder="08xxxxxxxx" />
        </label>
        <label className="block">
          <span className="text-sm text-stone-600">{t('logo')}</span>
          <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm" />
        </label>
        {err && <p className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{err}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-60">
          {busy ? t('saving') : t('createShop')}
        </button>
      </form>
    </div>
  );
}
`,

  'src/pages/vendor/VendorLayout.tsx': `import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Vendor } from '../../lib/types';
import { LangToggle, useLang } from '../../lib/i18n';

interface VendorCtx { vendor: Vendor; setVendor: (v: Vendor) => void }
export const useVendor = () => useOutletContext<VendorCtx>();

export default function VendorLayout() {
  const { t } = useLang();
  const nav = useNavigate();
  const [vendor, setVendor] = useState<Vendor | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return nav('/vendor/login', { replace: true });
      const { data } = await supabase.from('vendors').select('*').eq('owner_user_id', session.user.id).maybeSingle();
      if (!data) return nav('/vendor/onboarding', { replace: true });
      setVendor(data);
    })();
  }, [nav]);

  if (!vendor) return <div className="p-10 text-center text-stone-500">...</div>;

  const toggleOpen = async () => {
    const next = !vendor.is_open;
    setVendor({ ...vendor, is_open: next });
    await supabase.from('vendors').update({ is_open: next }).eq('id', vendor.id);
  };

  const logout = async () => { await supabase.auth.signOut(); nav('/vendor/login', { replace: true }); };

  const tab = ({ isActive }: { isActive: boolean }) =>
    \`flex-1 py-3 text-center text-sm font-medium \${isActive ? 'text-orange-600' : 'text-stone-500'}\`;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-white px-4 py-3 shadow-sm print:hidden">
        <h1 className="flex-1 truncate font-bold">{vendor.shop_name}</h1>
        <button onClick={toggleOpen}
          className={\`rounded-full px-3 py-1 text-sm font-semibold \${vendor.is_open ? 'bg-green-500 text-white' : 'bg-stone-300 text-stone-700'}\`}>
          ● {vendor.is_open ? t('open') : t('closed')}
        </button>
        <LangToggle />
        <button onClick={logout} className="text-sm text-stone-500">{t('logout')}</button>
      </header>

      <Outlet context={{ vendor, setVendor } satisfies VendorCtx} />

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-white print:hidden">
        <NavLink end to="/vendor" className={tab}>📋 {t('navOrders')}</NavLink>
        <NavLink to="/vendor/menu" className={tab}>🍜 {t('navMenu')}</NavLink>
        <NavLink to="/vendor/poster" className={tab}>🔳 {t('navPoster')}</NavLink>
        <NavLink to="/vendor/summary" className={tab}>📊 {t('navSummary')}</NavLink>
      </nav>
    </div>
  );
}
`,

  'src/pages/vendor/Dashboard.tsx': `import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order, OrderStatus } from '../../lib/types';
import { useLang, type TKey } from '../../lib/i18n';
import { baht, dayRange, timeHM, todayBkk } from '../../lib/format';
import { useVendor } from './VendorLayout';

const ACTIVE: OrderStatus[] = ['pending_payment', 'cooking', 'ready'];
const COLS: { status: OrderStatus; title: TKey; head: string }[] = [
  { status: 'pending_payment', title: 'colWaiting', head: 'bg-amber-500' },
  { status: 'cooking', title: 'colCooking', head: 'bg-blue-500' },
  { status: 'ready', title: 'colReady', head: 'bg-green-600' },
];

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + 0.3);
  } catch {}
}

export default function Dashboard() {
  const { vendor } = useVendor();
  const { t } = useLang();
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('vendor_id', vendor.id)
      .in('status', ACTIVE)
      .gte('created_at', dayRange(todayBkk())[0])
      .order('created_at');
    setOrders(data ?? []);
  }, [vendor.id]);

  useEffect(() => {
    load();
    let timer: number | undefined;
    const ch = supabase
      .channel(\`vendor-orders-\${vendor.id}\`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: \`vendor_id=eq.\${vendor.id}\` },
        (p) => {
          if (p.eventType === 'INSERT') beep();
          window.clearTimeout(timer);
          timer = window.setTimeout(load, 400);
        })
      .subscribe();
    const poll = window.setInterval(load, 30_000);
    return () => { window.clearTimeout(timer); window.clearInterval(poll); supabase.removeChannel(ch); };
  }, [vendor.id, load]);

  const setStatus = async (id: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)).filter((o) => ACTIVE.includes(o.status)));
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) { alert(error.message); load(); }
  };

  return (
    <div className="grid gap-4 p-4 md:grid-cols-3">
      {COLS.map((col) => {
        const list = orders.filter((o) => o.status === col.status);
        return (
          <section key={col.status} className="rounded-2xl bg-white shadow-sm">
            <h2 className={\`rounded-t-2xl px-4 py-2 font-semibold text-white \${col.head}\`}>
              {t(col.title)} ({list.length})
            </h2>
            <div className="space-y-3 p-3">
              {list.length === 0 && <p className="py-6 text-center text-sm text-stone-400">{t('noOrders')}</p>}
              {list.map((o) => (
                <article key={o.id} className="rounded-xl border p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold">#{o.queue_number}</span>
                    <span className="text-sm text-stone-500">{timeHM(o.created_at)}</span>
                  </div>
                  <ul className="my-2 text-sm">
                    {o.order_items?.map((i) => (
                      <li key={i.id}>
                        <b>{i.quantity}×</b> {i.item_name}
                        {i.selected_options.length > 0 && (
                          <span className="text-stone-500"> ({i.selected_options.map((s) => s.label).join(', ')})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {o.customer_note && <p className="mb-2 rounded bg-yellow-50 p-2 text-sm">📝 {o.customer_note}</p>}
                  <div className="mb-2 font-semibold text-orange-600">{baht(o.total_amount)}</div>

                  {o.status === 'pending_payment' && (
                    <>
                      <p className="mb-2 text-xs text-amber-700">⚠️ {t('checkBank')}</p>
                      <div className="flex gap-2">
                        <button onClick={() => setStatus(o.id, 'cooking')}
                          className="flex-1 rounded-lg bg-green-600 py-3 font-semibold text-white">
                          ✓ {t('markPaid')}
                        </button>
                        <button onClick={() => confirm(t('confirmCancel')) && setStatus(o.id, 'cancelled')}
                          className="rounded-lg bg-stone-200 px-3 text-sm">{t('cancel')}</button>
                      </div>
                    </>
                  )}
                  {o.status === 'cooking' && (
                    <button onClick={() => setStatus(o.id, 'ready')}
                      className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white">🔔 {t('markReady')}</button>
                  )}
                  {o.status === 'ready' && (
                    <button onClick={() => setStatus(o.id, 'completed')}
                      className="w-full rounded-lg bg-stone-700 py-3 font-semibold text-white">{t('markPicked')}</button>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
`,

  'src/pages/vendor/MenuManager.tsx': `import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase, uploadImage } from '../../lib/supabase';
import type { MenuItem } from '../../lib/types';
import { useLang } from '../../lib/i18n';
import { baht, errMsg } from '../../lib/format';
import { useVendor } from './VendorLayout';

export default function MenuManager() {
  const { vendor } = useVendor();
  const { t } = useLang();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('menu_items').select('*, menu_options(*)')
      .eq('vendor_id', vendor.id).order('sort_order');
    setItems(data ?? []);
  }, [vendor.id]);

  useEffect(() => { load(); }, [load]);

  const toggleSoldOut = async (it: MenuItem) => {
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, is_sold_out: !x.is_sold_out } : x)));
    const { error } = await supabase.from('menu_items').update({ is_sold_out: !it.is_sold_out }).eq('id', it.id);
    if (error) { alert(error.message); load(); }
  };

  const remove = async (it: MenuItem) => {
    if (!confirm(t('confirmDelete'))) return;
    await supabase.from('menu_items').delete().eq('id', it.id);
    load();
  };

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[];

  return (
    <div className="mx-auto max-w-2xl p-4">
      <button onClick={() => setEditing('new')}
        className="mb-4 w-full rounded-2xl bg-orange-600 py-3 font-semibold text-white">{t('addItem')}</button>

      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-orange-100">
              {it.photo_url
                ? <img src={it.photo_url} className="h-full w-full object-cover" />
                : <div className="flex h-full items-center justify-center text-2xl">🍜</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{it.name_th}</div>
              <div className="text-sm text-stone-500">{baht(it.price)} · {it.category || t('other')}</div>
              <div className="mt-1 flex gap-3 text-sm">
                <button onClick={() => setEditing(it)} className="text-orange-700">{t('edit')}</button>
                <button onClick={() => remove(it)} className="text-red-600">{t('delete')}</button>
              </div>
            </div>
            <button onClick={() => toggleSoldOut(it)}
              className={\`w-24 rounded-xl py-3 text-sm font-bold \${it.is_sold_out ? 'bg-stone-800 text-white' : 'bg-green-100 text-green-800'}\`}>
              {it.is_sold_out ? t('soldOut') : t('available')}
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <ItemForm
          vendorId={vendor.id}
          item={editing === 'new' ? null : editing}
          nextSort={items.length}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ItemForm({ vendorId, item, nextSort, categories, onClose, onSaved }: {
  vendorId: string; item: MenuItem | null; nextSort: number; categories: string[];
  onClose: () => void; onSaved: () => void;
}) {
  const { t } = useLang();
  const [nameTh, setNameTh] = useState(item?.name_th ?? '');
  const [nameEn, setNameEn] = useState(item?.name_en ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [opts, setOpts] = useState<{ label: string; extra_price: string }[]>(
    item?.menu_options?.map((o) => ({ label: o.label, extra_price: String(o.extra_price) })) ?? []
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const photo_url = file ? await uploadImage(file) : item?.photo_url ?? null;
      const row = {
        vendor_id: vendorId, name_th: nameTh.trim(), name_en: nameEn.trim() || null,
        price: Number(price), category: category.trim() || null, photo_url,
      };
      let id = item?.id;
      if (id) {
        const { error } = await supabase.from('menu_items').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('menu_items')
          .insert({ ...row, sort_order: nextSort }).select('id').single();
        if (error) throw error;
        id = data.id as string;
      }
      await supabase.from('menu_options').delete().eq('menu_item_id', id);
      const clean = opts.filter((o) => o.label.trim())
        .map((o) => ({ menu_item_id: id, label: o.label.trim(), extra_price: Number(o.extra_price) || 0 }));
      if (clean.length) {
        const { error } = await supabase.from('menu_options').insert(clean);
        if (error) throw error;
      }
      onSaved();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 md:items-center" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 md:rounded-3xl">
        <h2 className="text-xl font-bold">{item ? t('editItem') : t('addItem')}</h2>
        <input required placeholder={t('nameTh')} value={nameTh} onChange={(e) => setNameTh(e.target.value)} className="w-full rounded-xl border p-3" />
        <input placeholder={t('nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="w-full rounded-xl border p-3" />
        <div className="flex gap-2">
          <input required type="number" min="0" step="0.01" inputMode="decimal" placeholder={t('price')}
            value={price} onChange={(e) => setPrice(e.target.value)} className="w-1/2 rounded-xl border p-3" />
          <input list="cats" placeholder={t('category')} value={category}
            onChange={(e) => setCategory(e.target.value)} className="w-1/2 rounded-xl border p-3" />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <label className="block text-sm text-stone-600">
          {t('photo')}
          <input type="file" accept="image/*" capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full" />
        </label>

        <div>
          <div className="mb-1 text-sm text-stone-600">{t('options')}</div>
          {opts.map((o, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input placeholder={t('optionLabel')} value={o.label}
                onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                className="flex-1 rounded-xl border p-2" />
              <input type="number" min="0" placeholder="+฿" value={o.extra_price}
                onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, extra_price: e.target.value } : x)))}
                className="w-20 rounded-xl border p-2" />
              <button type="button" onClick={() => setOpts(opts.filter((_, j) => j !== i))} className="px-2 text-red-600">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setOpts([...opts, { label: '', extra_price: '0' }])}
            className="text-sm text-orange-700">{t('addOption')}</button>
        </div>

        {err && <p className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{err}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-stone-200 py-3">{t('cancel')}</button>
          <button disabled={busy} className="flex-1 rounded-xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-60">
            {busy ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
`,

  'src/pages/vendor/Poster.tsx': `import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useLang } from '../../lib/i18n';
import { promptPayPayload } from '../../lib/promptpay';
import { useVendor } from './VendorLayout';

export default function Poster() {
  const { vendor } = useVendor();
  const { t } = useLang();
  const url = \`\${window.location.origin}/s/\${vendor.id}\`;
  const [qr, setQr] = useState('');
  const [testQr, setTestQr] = useState('');

  useEffect(() => {
    QRCode.toDataURL(url, { width: 900, margin: 1 }).then(setQr);
    QRCode.toDataURL(promptPayPayload(vendor.promptpay_id, 1), { width: 300, margin: 1 }).then(setTestQr);
  }, [url, vendor.promptpay_id]);

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="rounded-3xl border-8 border-orange-600 bg-white p-6 text-center print:border-4">
        {vendor.logo_url && <img src={vendor.logo_url} className="mx-auto mb-2 h-16 w-16 rounded-full object-cover" />}
        <h1 className="text-3xl font-bold">{vendor.shop_name}</h1>
        <p className="mt-1 text-xl font-semibold text-orange-600">สแกนเพื่อสั่งและจ่าย</p>
        <p className="text-stone-500">Scan to order &amp; pay</p>
        {qr && <img src={qr} alt="Shop QR" className="mx-auto my-4 w-full max-w-xs" />}
        <p className="text-sm text-stone-500">PromptPay · ไม่ต้องรอคิวสั่ง · No app needed</p>
        <p className="mt-2 text-xs text-stone-400">Powered by จ่ายสด Jaisod</p>
      </div>

      <div className="mt-4 flex gap-2 print:hidden">
        <button onClick={() => window.print()} className="flex-1 rounded-xl bg-orange-600 py-3 font-semibold text-white">
          🖨️ {t('print')}
        </button>
        {qr && (
          <a href={qr} download="jaisod-shop-qr.png" className="flex-1 rounded-xl bg-stone-800 py-3 text-center font-semibold text-white">
            {t('download')}
          </a>
        )}
      </div>
      <p className="mt-2 break-all text-center text-xs text-stone-400 print:hidden">{url}</p>

      <div className="mt-6 rounded-2xl bg-white p-4 text-center shadow-sm print:hidden">
        <h2 className="font-semibold">{t('testQr')}</h2>
        <p className="mb-2 text-sm text-stone-500">{t('testQrHint')}</p>
        {testQr && <img src={testQr} className="mx-auto w-40" />}
      </div>
    </div>
  );
}
`,

  'src/pages/vendor/Summary.tsx': `import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order } from '../../lib/types';
import { useLang } from '../../lib/i18n';
import { baht, dayRange, timeHM, todayBkk } from '../../lib/format';
import { useVendor } from './VendorLayout';

const PAID = ['cooking', 'ready', 'completed'];

export default function Summary() {
  const { vendor } = useVendor();
  const { t } = useLang();
  const [date, setDate] = useState(todayBkk());
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    (async () => {
      const [start, end] = dayRange(date);
      const { data } = await supabase.from('orders').select('*, order_items(*)')
        .eq('vendor_id', vendor.id).gte('created_at', start).lt('created_at', end).order('created_at');
      setOrders(data ?? []);
    })();
  }, [date, vendor.id]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => PAID.includes(o.status));
    const revenue = paid.reduce((s, o) => s + Number(o.total_amount), 0);
    const top = new Map<string, { qty: number; amount: number }>();
    for (const o of paid) for (const i of o.order_items ?? []) {
      const cur = top.get(i.item_name) ?? { qty: 0, amount: 0 };
      top.set(i.item_name, { qty: cur.qty + i.quantity, amount: cur.amount + Number(i.line_total) });
    }
    return {
      paid,
      revenue,
      avg: paid.length ? revenue / paid.length : 0,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      unpaid: orders.filter((o) => o.status === 'pending_payment').length,
      top: [...top.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 10),
    };
  }, [orders]);

  const exportCsv = () => {
    const esc = (v: string | number) => \`"\${String(v).replace(/"/g, '""')}"\`;
    const rows = [
      ['queue', 'time', 'status', 'items', 'total', 'note'],
      ...orders.map((o) => [
        o.queue_number, timeHM(o.created_at), o.status,
        (o.order_items ?? []).map((i) => \`\${i.quantity}x \${i.item_name}\`).join('; '),
        Number(o.total_amount), o.customer_note ?? '',
      ]),
    ];
    const csv = '\\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = \`jaisod-\${date}.csv\`;
    a.click();
  };

  const Card = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-stone-600">{t('date')}</label>
        <input type="date" value={date} max={todayBkk()} onChange={(e) => setDate(e.target.value)}
          className="flex-1 rounded-xl border p-2" />
        <button onClick={exportCsv} className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white">
          {t('exportCsv')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card label={t('revenue')} value={baht(stats.revenue)} />
        <Card label={t('paidOrders')} value={stats.paid.length} />
        <Card label={t('avgTicket')} value={baht(Math.round(stats.avg))} />
        <Card label={\`\${t('cancelledCount')} / \${t('unpaidCount')}\`} value={\`\${stats.cancelled} / \${stats.unpaid}\`} />
      </div>

      <h2 className="mb-2 mt-6 font-semibold">{t('topItems')}</h2>
      <ul className="divide-y rounded-2xl bg-white shadow-sm">
        {stats.top.map(([name, v]) => (
          <li key={name} className="flex justify-between p-3">
            <span>{name}</span>
            <span className="text-stone-600">{v.qty} · {baht(v.amount)}</span>
          </li>
        ))}
        {stats.top.length === 0 && <li className="p-6 text-center text-stone-400">{t('noOrders')}</li>}
      </ul>
    </div>
  );
}
`
};

for (const [filePath, content] of Object.entries(files)) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Created:', filePath);
}

console.log('\\nAll files successfully generated! Now run: npm run dev');