import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useLang } from '../../lib/i18n';
import { promptPayPayload } from '../../lib/promptpay';
import { useVendor } from './VendorLayout';

export default function Poster() {
  const { vendor } = useVendor();
  const { t } = useLang();
  const url = `${window.location.origin}/s/${vendor.id}`;
  const [qr, setQr] = useState('');
  const [testQr, setTestQr] = useState('');

  useEffect(() => {
    QRCode.toDataURL(url, { width: 900, margin: 1 }).then(setQr);
    QRCode.toDataURL(promptPayPayload(vendor.promptpay_id, 1), { width: 300, margin: 1 }).then(setTestQr);
  }, [url, vendor.promptpay_id]);

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="rounded-3xl border-8 border-orange-600 bg-white p-6 text-center print:border-4">
        {vendor.logo_url && <img src={vendor.logo_url} className="mx-auto mb-2 h-16 w-16 rounded-full object-cover" />}
        <h1 className="text-3xl font-bold">{vendor.shop_name}</h1>
        <p className="mt-1 text-xl font-semibold text-orange-600">สแกนเพื่อสั่งและจ่าย</p>
        <p className="text-stone-500">Scan to order &amp; pay</p>
        {qr && <img src={qr} alt="Shop QR" className="mx-auto my-4 w-full max-w-xs" />}
        <p className="text-sm text-stone-500">PromptPay · ไม่ต้องรอคิวสั่ง · No app needed</p>
        <p className="mt-2 text-xs text-stone-400">Powered by จ่ายสด Jaisod</p>
      </div>

      <div className="mt-4 flex gap-2 print:hidden">
        <button onClick={() => window.print()} className="flex-1 rounded-xl bg-orange-600 py-3 font-semibold text-white">
          🖨️ {t('print')}
        </button>
        {qr && (
          <a href={qr} download="jaisod-shop-qr.png" className="flex-1 rounded-xl bg-stone-800 py-3 text-center font-semibold text-white">
            {t('download')}
          </a>
        )}
      </div>
      <p className="mt-2 break-all text-center text-xs text-stone-400 print:hidden">{url}</p>

      <div className="mt-6 rounded-2xl bg-white p-4 text-center shadow-sm print:hidden">
        <h2 className="font-semibold">{t('testQr')}</h2>
        <p className="mb-2 text-sm text-stone-500">{t('testQrHint')}</p>
        {testQr && <img src={testQr} className="mx-auto w-40" />}
      </div>
    </div>
  );
}
