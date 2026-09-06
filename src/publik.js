// Data untuk halaman publik (views/publik/index.ejs).
//
// Semuanya dibaca langsung dari database saat halaman diminta.
// Hanya baris ber-tampil = 1 yang ikut, diurutkan menurut kolom
// urutan. Tabel kategori tidak punya kolom tampil, jadi seluruh
// kategori selalu ikut.

import { semua } from './db.js';
import { ambilGambarPublik, ambilGambarAbout } from './gambar-situs.js';

export async function ambilPublik() {
  const barisProfil = await semua('SELECT kunci, nilai FROM profil');

  // Diubah jadi objek supaya tampilan bisa memakai teks.hero_judul
  // dan seterusnya. Kunci yang tidak ada di database mengembalikan
  // string kosong, bukan undefined, supaya halaman tidak menampilkan
  // tulisan "undefined".
  const teks = {};
  for (const b of barisProfil) teks[b.kunci] = b.nilai == null ? '' : String(b.nilai);

  const menu = await semua(
    'SELECT label, tautan FROM menu WHERE tampil = 1 ORDER BY urutan, id'
  );

  // Tabel data_diri tidak dibaca lagi sejak tahap 23C: keempat butir
  // About sekarang datang dari tabel profil, lewat objek teks di atas.

  // Persen diambil sekali sebagai angka, lalu dipakai untuk teks
  // maupun aria-valuenow di tampilan. Di halaman aslinya kedua
  // angka itu ditulis terpisah dan bisa berbeda tanpa ketahuan.
  const semuaSkill = await semua(
    'SELECT nama, persen, kolom FROM skill WHERE tampil = 1 ORDER BY urutan, id'
  );
  const skill = {
    kiri: semuaSkill.filter((s) => s.kolom === 'kiri'),
    kanan: semuaSkill.filter((s) => s.kolom === 'kanan'),
  };

  const logo = await semua(
    'SELECT gambar, nama FROM logo WHERE tampil = 1 ORDER BY urutan, id'
  );

  // Pengalaman kerja. Urutannya ditentukan pemilik lewat kolom
  // urutan, sama seperti sumber daya lain -- baris pertama tampil
  // paling atas di garis waktu. tahun_selesai yang NULL berarti
  // pekerjaannya masih berjalan; tampilan yang menuliskannya
  // sebagai "Sekarang", bukan kueri ini.
  const pengalaman = await semua(
    'SELECT posisi, perusahaan, lokasi, tahun_mulai, tahun_selesai, deskripsi ' +
      'FROM pengalaman WHERE tampil = 1 ORDER BY urutan, id'
  );

  const layanan = await semua(
    'SELECT ikon, judul, deskripsi FROM layanan WHERE tampil = 1 ORDER BY urutan, id'
  );

  // Kategori dipakai untuk tombol filter Isotope. kelas_filter-nya
  // harus sama persis dengan kelas yang dipasang di tiap karya.
  const kategori = await semua(
    'SELECT id, nama, kelas_filter FROM kategori ORDER BY urutan, id'
  );

  const karya = await semua(
    'SELECT k.judul, k.subjudul, k.gambar, kt.kelas_filter ' +
      'FROM karya k LEFT JOIN kategori kt ON kt.id = k.kategori_id ' +
      'WHERE k.tampil = 1 ORDER BY k.urutan, k.id'
  );

  // Gambar situs yang bisa diganti dari panel: latar hero, foto
  // About, logo header, favicon, dan ikon layar utama. Kalau belum
  // pernah diganti, yang dipakai tetap berkas bawaan di assets/.
  const gambarSitus = await ambilGambarPublik();

  // Foto About tidak lagi ikut daftar Gambar Situs; kuncinya sama
  // (profil.gambar_about), hanya tempat menyuntingnya yang pindah.
  const gambarAbout = await ambilGambarAbout();

  return {
    teks, menu, skill, pengalaman, logo, layanan,
    kategori, karya, gambarSitus, gambarAbout,
  };
}

// Baris hak cipta di footer aslinya membungkus tahunnya dengan
// <strong><span>. Supaya bentuk itu tetap ada tanpa memecah teksnya
// jadi dua kolom database, tahun dari footer_tahun dicari di dalam
// footer_teks lalu dibungkus. Kalau tidak ketemu, teksnya dipakai
// apa adanya.
function lolosHtml(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Penanda sorotan: teks di dalam kurung siku ditampilkan dengan
// <span>, yang oleh assets/css/style.css diberi warna aksen #106eea
// pada #hero h1 span dan .section-title h3 span.
//
// Kurung siku dipilih karena tidak pernah muncul di teks situs ini,
// mudah diketik di panel admin, dan -- yang terpenting -- BUKAN
// karakter yang punya arti khusus di HTML, jadi tidak bertabrakan
// dengan proses escape.
//
// URUTANNYA PENTING: teks di-escape LEBIH DULU, baru kurung sikunya
// diubah jadi tag. Karena escape sudah mengubah < > & " jadi entitas,
// satu-satunya HTML yang bisa muncul di keluaran adalah <span> dan
// </span> yang kita tambahkan sendiri. Apa pun yang diketik di panel
// admin -- termasuk <script> -- keluar sebagai teks biasa.
export function sorot(teks) {
  return lolosHtml(teks).replace(/\[([^\]]*)\]/g, '<span>$1</span>');
}

export function footerHtml(teks) {
  const isi = lolosHtml(teks.footer_teks);
  const tahun = String(teks.footer_tahun || '').trim();
  if (!tahun) return isi;

  const i = isi.indexOf(tahun);
  if (i < 0) return isi;

  return (
    isi.slice(0, i) +
    '<strong><span>' + lolosHtml(tahun) + '</span></strong>' +
    isi.slice(i + tahun.length)
  );
}

// Jalur gambar disimpan tanpa garis miring di depan, baik untuk
// karya lama (assets/img/portfolio/...) maupun unggahan
// (uploads/...). Keduanya disajikan Express di alamat yang sesuai.
export function alamatGambar(jalur) {
  const t = String(jalur || '').trim();
  if (t === '') return '';
  
  // Jika URL Cloudinary, sisipkan perintah f_auto,q_auto agar dikonversi ke webp dan dikompres otomatis
  if (t.includes('res.cloudinary.com') && t.includes('/upload/')) {
    if (!t.includes('/f_auto,q_auto/')) {
      return t.replace('/upload/', '/upload/f_auto,q_auto/');
    }
  }

  if (/^https?:\/\//i.test(t) || t.startsWith('/')) return t;
  return '/' + t;
}
