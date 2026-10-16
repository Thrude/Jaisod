import { useEffect, useMemo, useState } from 'react';
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
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ['queue', 'time', 'status', 'items', 'total', 'note'],
      ...orders.map((o) => [
        o.queue_number, timeHM(o.created_at), o.status,
        (o.order_items ?? []).map((i) => `${i.quantity}x ${i.item_name}`).join('; '),
        Number(o.total_amount), o.customer_note ?? '',
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `jaisod-${date}.csv`;
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
        <Card label={`${t('cancelledCount')} / ${t('unpaidCount')}`} value={`${stats.cancelled} / ${stats.unpaid}`} />
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
