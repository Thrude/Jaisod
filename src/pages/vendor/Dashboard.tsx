import { useCallback, useEffect, useState } from 'react';
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
      .channel(`vendor-orders-${vendor.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendor.id}` },
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
            <h2 className={`rounded-t-2xl px-4 py-2 font-semibold text-white ${col.head}`}>
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
