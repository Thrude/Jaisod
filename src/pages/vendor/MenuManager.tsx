import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
              className={`w-24 rounded-xl py-3 text-sm font-bold ${it.is_sold_out ? 'bg-stone-800 text-white' : 'bg-green-100 text-green-800'}`}>
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
