// Perlindungan CSRF sederhana berbasis sesi.
// Tanpa paket tambahan -- hanya modul crypto bawaan Node.

import { randomBytes, timingSafeEqual } from 'node:crypto';

const PANJANG = 32; // byte, jadi 64 karakter hex

// Ambil token milik sesi ini. Kalau belum ada, buat sekali lalu
// dipakai terus selama sesi berjalan.
export function tokenCsrf(req) {
  if (!req.session) {
    throw new Error('Sesi belum aktif, token CSRF tidak bisa dibuat.');
  }
  if (!req.session.csrf) {
    req.session.csrf = randomBytes(PANJANG).toString('hex');
  }
  return req.session.csrf;
}

// Buat token baru. Dipanggil setelah sesi diganti (regenerate)
// supaya token lama tidak ikut terbawa.
export function segarkanCsrf(req) {
  req.session.csrf = randomBytes(PANJANG).toString('hex');
  return req.session.csrf;
}

// Bandingkan dua token dengan waktu tetap.
function samaAman(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

// Apakah token pada permintaan ini sah? Dipakai langsung oleh rute
// yang perlu membereskan sesuatu (misalnya menghapus berkas yang
// terlanjur terunggah) sebelum menolak permintaan.
export function csrfSah(req) {
  const dariSesi = req.session && req.session.csrf;
  const dariForm = req.body && req.body._csrf;
  return Boolean(dariSesi) && samaAman(dariForm, dariSesi);
}

// Pasang di depan setiap rute POST admin.
export function periksaCsrf(req, res, next) {
  if (!csrfSah(req)) {
    res.status(403);
    return res.render('admin/kesalahan', {
      judul: 'Permintaan ditolak',
      pesan:
        'Token keamanan formulir tidak sah atau sudah kedaluwarsa. ' +
        'Muat ulang halaman lalu coba lagi.',
    });
  }
  return next();
}
