const f = (id: string, value: string) => id + value.length.toString().padStart(2, '0') + value;

function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function promptPayPayload(target: string, amount?: number): string {
  const digits = target.replace(/\D/g, '');
  let account: string;
  if (digits.length >= 15) account = f('03', digits);
  else if (digits.length >= 13) account = f('02', digits);
  else account = f('01', ('0000000000000' + digits.replace(/^0/, '66')).slice(-13));

  const data =
    f('00', '01') +
    f('01', amount ? '12' : '11') +
    f('29', f('00', 'A000000677010111') + account) +
    f('53', '764') +
    (amount ? f('54', amount.toFixed(2)) : '') +
    f('58', 'TH') +
    '6304';
  return data + crc16(data);
}

export function isValidPromptPayId(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  return /^0\d{9}$/.test(d) || /^\d{13}$/.test(d);
}
