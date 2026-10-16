import { useState } from 'react';
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
    nav(`/o/${orderId}`, { replace: true });
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg p-4 pb-40">
      <Link to={`/s/${vendorId}`} className="text-orange-700">← {t('backToMenu')}</Link>
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
