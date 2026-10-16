import { useEffect, useState } from 'react';
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
    `flex-1 py-3 text-center text-sm font-medium ${isActive ? 'text-orange-600' : 'text-stone-500'}`;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-white px-4 py-3 shadow-sm print:hidden">
        <h1 className="flex-1 truncate font-bold">{vendor.shop_name}</h1>
        <button onClick={toggleOpen}
          className={`rounded-full px-3 py-1 text-sm font-semibold ${vendor.is_open ? 'bg-green-500 text-white' : 'bg-stone-300 text-stone-700'}`}>
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
