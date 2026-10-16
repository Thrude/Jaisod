export const baht = (n: number | string) =>
  '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const todayBkk = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

export function dayRange(day: string): [string, string] {
  const start = new Date(`${day}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 86_400_000);
  return [start.toISOString(), end.toISOString()];
}

export const timeHM = (iso: string) =>
  new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}
