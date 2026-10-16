import { useEffect, useState, type FormEvent } from 'react';
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
        owner_user_id: user.id, shop_name: shopName.trim(), promptpay_id: pp.replace(/\D/g, ''), logo_url,
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
