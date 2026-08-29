// Halaman Teks Situs.
//
// Tabel profil BUKAN daftar yang bisa ditambah dan dihapus bebas: ia
// 34 pasangan kunci-nilai yang masing-masing dipakai di satu tempat
// tertentu di situs publik. Menghapus satu kunci akan membuat bagian
// situs kosong tanpa peringatan, jadi halaman ini sengaja hanya bisa
// MENGUBAH nilai. Tidak ada tombol tambah, tidak ada tombol hapus,
// dan rute hapus pun tidak dibuat.

import db, { semua } from './db.js';
import { periksaCsrf } from './csrf.js';
import { AWALAN_KUNCI } from './gambar-situs.js';

// Kunci yang tempatnya di halaman Data Diri, bukan di sini.
//
// Kelompok "Data pribadi" dulu ada di halaman ini dengan keterangan
// "Isi kotak perkenalan di bagian About" -- dan keterangan itu tidak
// benar. Yang tampil di About selama ini datang dari tabel data_diri,
// bukan dari kunci-kunci ini, jadi mengubahnya di sini tidak mengubah
// apa pun di situs. Sejak tahap 23B keenamnya berpindah ke halaman
// Data Diri, satu-satunya tempat menyuntingnya.
export const KUNCI_DATA_DIRI = [
  'profil_teks',
  'tanggal_lahir',
  'email',
  'telepon',
  'gender',
];

function milikDataDiri(kunci) {
  return KUNCI_DATA_DIRI.includes(String(kunci));
}

// Kunci yang isinya panjang, ditampilkan sebagai kotak beberapa baris.
const PANJANG = new Set([
  'profil_teks',
  'alamat',
  'bagian_about_teks',
  'bagian_pengalaman_teks',
  'bagian_services_teks',
  'bagian_portfolio_teks',
  'bagian_contact_teks',
]);

// Keterangan bahasa Indonesia untuk tiap kunci. Nama kunci mentah
// tetap ditampilkan sebagai keterangan kecil, tapi bukan
// satu-satunya petunjuk.
const LABEL = {
  profil_teks: 'Paragraf perkenalan',
  tanggal_lahir: 'Tanggal lahir',
  email: 'Email',
  telepon: 'Nomor telepon',
  gender: 'Jenis kelamin',
  alamat: 'Alamat',

  hero_judul: 'Judul besar',
  hero_subjudul: 'Kalimat di bawah judul',
  hero_tombol_teks: 'Teks tombol',

  bagian_about_judul: 'About — label kecil',
  bagian_about_subjudul: 'About — judul',
  bagian_about_teks: 'About — kalimat pengantar',
  bagian_pengalaman_judul: 'Experience — label kecil',
  bagian_pengalaman_subjudul: 'Experience — judul',
  bagian_pengalaman_teks: 'Experience — kalimat pengantar',
  bagian_skills_subjudul: 'Skill — judul',
  bagian_services_judul: 'Services — label kecil',
  bagian_services_subjudul: 'Services — judul',
  bagian_services_teks: 'Services — kalimat pengantar',
  bagian_portfolio_judul: 'Portfolio — label kecil',
  bagian_portfolio_subjudul: 'Portfolio — judul',
  bagian_portfolio_teks: 'Portfolio — kalimat pengantar',
  bagian_contact_judul: 'Contact — label kecil',
  bagian_contact_subjudul: 'Contact — judul',
  bagian_contact_teks: 'Contact — kalimat pengantar',

  footer_teks: 'Baris hak cipta',
  footer_tahun: 'Tahun hak cipta',

  tombol_more_design_teks: 'Teks tombol MORE DESIGN',
  tombol_more_design_tautan: 'Tautan tombol MORE DESIGN',

  kontak_label_alamat: 'Judul kotak alamat',
  kontak_label_email: 'Judul kotak email',
  kontak_label_telepon: 'Judul kotak telepon',

  sosial_facebook: 'Facebook',
  sosial_instagram: 'Instagram',
  sosial_linkedin: 'LinkedIn',
};

// Urutan dan isi kelompok. Kunci yang tidak masuk kelompok mana pun
// akan dikumpulkan otomatis ke kelompok terakhir, supaya tidak ada
// yang hilang dari halaman kalau nanti ada kunci baru.
const KELOMPOK = [
  {
    kunci: 'hero',
    judul: 'Bagian atas halaman',
    keterangan: 'Tulisan besar yang pertama dilihat pengunjung.',
    cocok: (k) => k.startsWith('hero_'),
  },
  {
    kunci: 'bagian',
    judul: 'Judul tiap bagian',
    keterangan:
      'Label kecil, judul, dan kalimat pengantar di atas setiap bagian situs.',
    cocok: (k) => k.startsWith('bagian_'),
  },
  // Kelompok "Data pribadi" dibuang di tahap 23B. Kunci-kuncinya
  // sekarang disaring keluar lewat milikDataDiri(), jadi kelompok ini
  // tidak akan pernah terisi lagi.
  {
    kunci: 'kontak',
    judul: 'Kontak',
    keterangan:
      'Alamat dan judul tiap kotak di bagian Contact. Nomor telepon dan ' +
      'email disunting di halaman Data Diri.',
    cocok: (k) =>
      k === 'alamat' || k.startsWith('kontak_') || k.startsWith('telepon_'),
  },
  {
    kunci: 'sosial',
    judul: 'Media sosial',
    keterangan: 'Alamat lengkap tiap akun.',
    cocok: (k) => k.startsWith('sosial_'),
  },
  {
    kunci: 'tombol',
    judul: 'Tombol',
    keterangan: 'Teks dan tujuan tombol di bagian Portfolio.',
    cocok: (k) => k.startsWith('tombol_'),
  },
  {
    kunci: 'footer',
    judul: 'Footer',
    keterangan: 'Baris paling bawah halaman.',
    cocok: (k) => k.startsWith('footer_'),
  },
];

function labelUntuk(kunci) {
  if (LABEL[kunci]) return LABEL[kunci];
  // Cadangan kalau suatu saat ada kunci baru yang belum diberi nama.
  return kunci.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

// Susun baris database menjadi kelompok siap tampil.
export async function ambilKelompok() {
  // Kunci berawalan "gambar_" memang tersimpan di tabel profil, tapi
  // isinya jalur berkas, bukan tulisan yang diketik. Tempatnya di
  // halaman Gambar Situs, yang punya pengunggah dan tombol kembalikan
  // ke bawaan. Kalau ikut tampil di sini, pemilik akan melihat kotak
  // teks berisi "uploads/6f2a…png" tanpa tahu artinya, dan salah ketik
  // sedikit saja membuat gambarnya hilang dari situs.
  const baris = (await semua('SELECT id, kunci, nilai FROM profil ORDER BY id')).filter(
    (b) => !String(b.kunci).startsWith(AWALAN_KUNCI) && !milikDataDiri(b.kunci)
  );
  const sudah = new Set();
  const hasil = [];

  for (const g of KELOMPOK) {
    const isi = baris
      .filter((b) => !sudah.has(b.kunci) && g.cocok(b.kunci))
      .map((b) => {
        sudah.add(b.kunci);
        return {
          kunci: b.kunci,
          label: labelUntuk(b.kunci),
          nilai: b.nilai == null ? '' : String(b.nilai),
          panjang: PANJANG.has(b.kunci),
          kosong: !b.nilai,
        };
      });
    if (isi.length > 0) hasil.push({ judul: g.judul, keterangan: g.keterangan, isi });
  }

  const sisa = baris.filter((b) => !sudah.has(b.kunci));
  if (sisa.length > 0) {
    hasil.push({
      judul: 'Lain-lain',
      keterangan: 'Kunci yang belum dikelompokkan.',
      isi: sisa.map((b) => ({
        kunci: b.kunci,
        label: labelUntuk(b.kunci),
        nilai: b.nilai == null ? '' : String(b.nilai),
        panjang: PANJANG.has(b.kunci),
        kosong: !b.nilai,
      })),
    });
  }

  return hasil;
}

export function pasangTeksSitus(app, dep) {
  const { halaman, wajibLogin } = dep;

  app.get('/admin/teks', wajibLogin, async (req, res) => {
    const kelompok = await ambilKelompok();
    const jumlah = kelompok.reduce((n, g) => n + g.isi.length, 0);
    const kosong = kelompok.reduce((n, g) => n + g.isi.filter((x) => x.kosong).length, 0);

    return halaman(req, res, 'teks-situs', {
      judulHalaman: 'Teks Situs',
      subJudul: jumlah + ' teks, ' + kosong + ' masih kosong',
      menuAktif: 'teks',
      kelompok,
      jumlahKosong: kosong,
      berhasil:
        req.query.pesan === 'simpan'
          ? (Number(req.query.n) || 0) + ' teks diperbarui.'
          : null,
    });
  });

  app.post('/admin/teks', wajibLogin, periksaCsrf, async (req, res) => {
    // Hanya kunci yang MEMANG SUDAH ADA di database yang diproses.
    // Kunci baru dari formulir diabaikan, dan tidak ada jalur untuk
    // menghapus kunci.
    const adaSekarang = await semua('SELECT kunci FROM profil');
    const sah = new Set(adaSekarang.map((b) => b.kunci));

    const perubahan = [];
    for (const [nama, isi] of Object.entries(req.body)) {
      if (!nama.startsWith('teks_')) continue;
      const kunci = nama.slice(5);
      if (!sah.has(kunci)) continue;
      // Kunci gambar_* dan kunci Data Diri tidak pernah dicetak
      // sebagai kotak di halaman ini, jadi tidak ada alasan sah untuk
      // mengirimkannya ke sini. Penyaringan di tampilan saja TIDAK
      // cukup: tanpa baris ini, kunci itu masih bisa ditulis lewat
      // formulir yang dikarang sendiri.
      if (kunci.startsWith(AWALAN_KUNCI)) continue;
      if (milikDataDiri(kunci)) continue;
      perubahan.push([kunci, String(isi == null ? '' : isi)]);
    }

    if (perubahan.length === 0) return res.redirect('/admin/teks?pesan=simpan&n=0');

    // Semuanya disimpan dalam satu transaksi: entah seluruhnya
    // tersimpan, atau tidak ada yang berubah sama sekali.
    const tx = await db.transaction('write');
    let diubah = 0;
    try {
      for (const [kunci, nilai] of perubahan) {
        const hasil = await tx.execute({
          sql: 'UPDATE profil SET nilai = ? WHERE kunci = ?',
          args: [nilai, kunci],
        });
        diubah += Number(hasil.rowsAffected || 0);
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    return res.redirect('/admin/teks?pesan=simpan&n=' + diubah);
  });
}
