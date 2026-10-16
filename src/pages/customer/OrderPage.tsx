import { useCallback, useEffect, useRef, useState } from 'react';
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
      .channel(`order:${orderId}`)
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
        <div className={`mt-4 rounded-2xl px-4 py-3 text-lg font-semibold ${s.cls}`}>{t(s.key)}</div>
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
            <a href={qr} download={`jaisod-q${order.queue_number}.png`}
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
