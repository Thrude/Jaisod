import { useEffect, useState, type FormEvent } from 'react';
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
