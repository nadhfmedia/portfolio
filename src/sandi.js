import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// Panjang minimal sandi.
export const PANJANG_MINIMAL = 10;

// Parameter scrypt. Ikut tersimpan di dalam hash supaya sandi lama
// tetap bisa diperiksa kalau suatu saat parameternya dinaikkan.
const N = 16384;
const r = 8;
const p = 1;
const PANJANG_KUNCI = 64;
const PANJANG_GARAM = 16;

// Lempar error kalau sandi tidak memenuhi syarat.
export function periksaSyarat(sandi) {
  if (typeof sandi !== 'string') {
    throw new Error('Sandi harus berupa teks.');
  }
  if (sandi.length < PANJANG_MINIMAL) {
    throw new Error('Sandi minimal ' + PANJANG_MINIMAL + ' karakter.');
  }
  return true;
}

// Acak sandi menjadi teks yang aman disimpan.
// Bentuknya: scrypt$N$r$p$garamHex$hashHex
// Tiap sandi mendapat garam acak sendiri.
export async function acak(sandi) {
  periksaSyarat(sandi);
  const garam = randomBytes(PANJANG_GARAM);
  const kunci = await scryptAsync(sandi, garam, PANJANG_KUNCI, { N, r, p });
  return [
    'scrypt',
    N,
    r,
    p,
    garam.toString('hex'),
    kunci.toString('hex'),
  ].join('$');
}

// Periksa sandi terhadap hash yang tersimpan.
// Selalu mengembalikan true/false, tidak pernah melempar error
// karena bentuk hash yang rusak, supaya tidak membocorkan informasi.
export async function cocok(sandi, tersimpan) {
  if (typeof sandi !== 'string' || typeof tersimpan !== 'string') return false;

  const bagian = tersimpan.split('$');
  if (bagian.length !== 6 || bagian[0] !== 'scrypt') return false;

  const nTersimpan = Number(bagian[1]);
  const rTersimpan = Number(bagian[2]);
  const pTersimpan = Number(bagian[3]);
  if (!Number.isInteger(nTersimpan) || !Number.isInteger(rTersimpan) || !Number.isInteger(pTersimpan)) {
    return false;
  }

  let garam;
  let harapan;
  try {
    garam = Buffer.from(bagian[4], 'hex');
    harapan = Buffer.from(bagian[5], 'hex');
  } catch {
    return false;
  }
  if (garam.length === 0 || harapan.length === 0) return false;

  let dihitung;
  try {
    dihitung = await scryptAsync(sandi, garam, harapan.length, {
      N: nTersimpan,
      r: rTersimpan,
      p: pTersimpan,
    });
  } catch {
    return false;
  }

  // Panjangnya pasti sama karena harapan.length dipakai sebagai keylen,
  // tapi tetap diperiksa supaya timingSafeEqual tidak melempar error.
  if (dihitung.length !== harapan.length) return false;

  return timingSafeEqual(dihitung, harapan);
}
