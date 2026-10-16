import { useEffect, useMemo, useState } from 'react';
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
                className={`overflow-hidden rounded-2xl bg-white text-left shadow-sm transition active:scale-95 ${
                  it.is_sold_out ? 'opacity-50 grayscale' : ''}`}
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
            to={`/s/${vendorId}/cart`}
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