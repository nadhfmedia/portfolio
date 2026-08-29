// Formulir kontak di situs publik.
//
// Semua pemeriksaan di berkas ini berjalan DI SERVER. Peramban boleh
// ikut memeriksa lewat atribut required dan maxlength, tapi itu cuma
// kenyamanan: pengunjung bisa mematikan JavaScript, menghapus atribut
// itu lewat alat pengembang, atau mengirim POST langsung tanpa pernah
// membuka halamannya. Yang menentukan diterima atau tidak hanya kode
// di sini.
//
// Pesan yang masuk datang dari orang asing, jadi isinya diperlakukan
// sebagai teks murni dari ujung ke ujung: disimpan apa adanya lewat
// parameter SQL (bukan sambungan string), lalu ditampilkan di panel
// admin lewat <%= %> dan textContent -- tidak pernah sebagai HTML.

import db from './db.js';
import { csrfSah } from './csrf.js';

export const BATAS = {
  nama: 100,
  email: 254,
  subjek: 150,
  isiMin: 10,
  isiMaks: 5000,
};

// Jeda minimal antara halaman dibuka dan formulir dikirim. Manusia
// tidak mungkin mengisi empat kolom dalam waktu sesingkat ini;
// robot pengisi formulir hampir selalu bisa.
export const JEDA_MINIMAL_MS = 3000;

// Nama kolom umpan. Disembunyikan lewat CSS, jadi pengunjung
// sungguhan tidak pernah melihatnya, apalagi mengisinya. Namanya
// sengaja dibuat menggoda supaya robot ikut mengisi.
export const MEDAN_UMPAN = 'website';

function rapikan(nilai) {
  return String(nilai == null ? '' : nilai).replace(/\r\n/g, '\n').trim();
}

// Panjang dihitung per karakter (code point), bukan per unit UTF-16,
// supaya satu emoji tidak dihitung dua.
function panjang(teks) {
  return Array.from(teks).length;
}

export function bacaIsian(body) {
  const b = body || {};
  return {
    nama: rapikan(b.nama),
    email: rapikan(b.email),
    subjek: rapikan(b.subjek),
    isi: rapikan(b.isi),
  };
}

// Bentuk email sengaja tidak memakai pola raksasa yang mencoba
// menuruti RFC 5322 -- pola begitu sulit dibaca dan tetap tidak
// membuktikan alamatnya hidup. Yang diperiksa: ada tepat satu @,
// bagian sebelumnya tidak kosong dan tanpa spasi, bagian sesudahnya
// berupa nama domain bertitik yang wajar.
const POLA_EMAIL =
  /^[^\s@]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export function periksaKontak(isian) {
  const galat = {};

  if (isian.nama === '') {
    galat.nama = 'Please write your name.';
  } else if (panjang(isian.nama) > BATAS.nama) {
    galat.nama = 'Name is too long (max ' + BATAS.nama + ' characters).';
  }

  if (isian.email === '') {
    galat.email = 'Please write your email address.';
  } else if (panjang(isian.email) > BATAS.email) {
    galat.email = 'Email address is too long.';
  } else if (!POLA_EMAIL.test(isian.email)) {
    galat.email = 'That does not look like an email address.';
  }

  // Subjek boleh kosong -- hanya panjangnya yang dibatasi.
  if (panjang(isian.subjek) > BATAS.subjek) {
    galat.subjek = 'Subject is too long (max ' + BATAS.subjek + ' characters).';
  }

  if (isian.isi === '') {
    galat.isi = 'Please write your message.';
  } else if (panjang(isian.isi) < BATAS.isiMin) {
    galat.isi = 'Message is too short (at least ' + BATAS.isiMin + ' characters).';
  } else if (panjang(isian.isi) > BATAS.isiMaks) {
    galat.isi = 'Message is too long (max ' + BATAS.isiMaks + ' characters).';
  }

  return { galat, sah: Object.keys(galat).length === 0 };
}

export async function simpanPesan(isian) {
  const hasil = await db.execute({
    sql: 'INSERT INTO pesan (nama, email, subjek, isi) VALUES (?, ?, ?, ?)',
    args: [isian.nama, isian.email, isian.subjek, isian.isi],
  });
  return Number(hasil.lastInsertRowid);
}

// Pesan yang dilihat pengunjung untuk tiap sebab penolakan. Sengaja
// tidak menjelaskan bagian mana dari saringan anti-robot yang kena,
// supaya tidak jadi petunjuk buat yang iseng.
export function pesanGalatKontak(status) {
  switch (status) {
    case 'galat':
      return 'Please check the fields marked below.';
    case 'cepat':
      return 'That was sent a bit too quickly. Please wait a moment, then send it again.';
    case 'kedaluwarsa':
      return 'This page was reloaded or left open too long. Please refresh the page and send it again.';
    case 'csrf':
      return 'Your security token is missing or expired. Please refresh the page and send it again.';
    case 'batas':
      return 'Too many messages have been sent from your connection. Please try again later.';
    default:
      return null;
  }
}

// Bentuk yang dipakai tampilan. Dipanggil GET / baik ketika ada
// kiriman gagal maupun ketika halaman dibuka biasa, supaya tampilan
// tidak perlu memeriksa null di mana-mana.
export function bentukKontak(kilat) {
  const k = kilat || {};
  return {
    status: k.status || null,
    galat: k.galat || {},
    isian: {
      nama: '',
      email: '',
      subjek: '',
      isi: '',
      ...(k.isian || {}),
    },
    pesanGalat: pesanGalatKontak(k.status),
  };
}

// Pola Post/Redirect/Get: hasilnya dititipkan di sesi, lalu
// pengunjung dialihkan ke GET. Halaman yang tampil sesudahnya adalah
// halaman GET biasa, jadi memuat ulang atau menekan tombol kembali
// tidak pernah mengirim ulang pesannya.
function kembali(req, res, kilat) {
  req.session.kontak = kilat;
  return res.redirect(303, '/#contact');
}

export function pasangKontak(app, dep) {
  const { pembatasKontak } = dep;

  app.post('/kontak', pembatasKontak, async (req, res) => {
    const isian = bacaIsian(req.body);

    // 1. CSRF. Memakai csrfSah() dari src/csrf.js, bukan
    //    periksaCsrf(), karena penolakan di sini harus kembali ke
    //    halaman publik -- bukan ke halaman kesalahan panel admin
    //    yang tidak pernah dilihat pengunjung.
    if (!csrfSah(req)) {
      return kembali(req, res, { status: 'csrf', isian });
    }

    // 2. Kolom umpan. Kalau terisi, kiriman dibuang tanpa disimpan,
    //    tapi pengunjung -- yang sebenarnya robot -- tetap melihat
    //    pesan sukses. Robot yang tahu dirinya ditolak akan mencoba
    //    lagi dengan cara lain; robot yang mengira berhasil, tidak.
    const umpan = rapikan((req.body || {})[MEDAN_UMPAN]);
    if (umpan !== '') {
      return kembali(req, res, { status: 'ok' });
    }

    // 3. Terlalu cepat. Waktu halaman dibuka disimpan di sesi, bukan
    //    di kolom tersembunyi, supaya tidak bisa dipalsukan dari sisi
    //    pengirim.
    const dibuka = Number(req.session.kontakDibuka || 0);
    if (!dibuka) {
      return kembali(req, res, { status: 'kedaluwarsa', isian });
    }
    if (Date.now() - dibuka < JEDA_MINIMAL_MS) {
      return kembali(req, res, { status: 'cepat', isian });
    }

    // 4. Validasi isi.
    const { galat, sah } = periksaKontak(isian);
    if (!sah) {
      return kembali(req, res, { status: 'galat', galat, isian });
    }

    await simpanPesan(isian);

    // Penanda waktunya dibuang supaya satu halaman yang sudah dipakai
    // mengirim tidak bisa dipakai mengirim lagi tanpa dimuat ulang.
    delete req.session.kontakDibuka;

    return kembali(req, res, { status: 'ok' });
  });
}
