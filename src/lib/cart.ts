import { useEffect, useState } from 'react';
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

const storageKey = (vendorId: string) => `jaisod_cart_${vendorId}`;

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
    const key = `${item.id}|${ids.join(',')}`;
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
