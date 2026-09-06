// Halaman Gambar Situs.
//
// Beberapa gambar di situs publik dulu tertulis mati di dalam
// template atau di dalam assets/css/style.css, jadi tidak bisa
// diganti dari panel. Berkas ini membuat semuanya bisa diganti tanpa
// menyentuh satu pun berkas di assets/.
//
// Cara menyimpannya: satu baris di tabel profil per gambar, dengan
// kunci berawalan "gambar_". Nilai kosong (atau kuncinya belum ada
// sama sekali) berarti "pakai gambar bawaan". Karena itu:
//
//   - tidak perlu tabel baru dan tidak perlu migrasi; kuncinya dibuat
//     sendiri saat gambar pertama diunggah, lewat upsert pada kolom
//     profil.kunci yang memang UNIQUE
//   - kalau nilainya kosong, situs otomatis memakai berkas bawaan
//   - berkas bawaan di assets/ tidak pernah disentuh, apalagi dihapus
//
// Kunci berawalan "gambar_" sengaja disembunyikan dari halaman Teks
// Situs, karena isinya jalur berkas, bukan tulisan yang diketik.

import db, { semua, satu } from './db.js';
import { csrfSah } from './csrf.js';
import { unggah, pesanUnggah, hapusBerkasUnggahan, AWALAN_UNGGAH } from './unggah.js';

// Awalan kunci di tabel profil. Dipakai juga src/teks-situs.js untuk
// menyaring kunci-kunci ini keluar dari halaman Teks Situs.
export const AWALAN_KUNCI = 'gambar_';

export const DAFTAR_GAMBAR = [
  {
    kunci: 'gambar_hero',
    judul: 'Latar bagian Hero',
    // Yang ini datang dari CSS, bukan dari <img>. Lihat catatan
    // panjang di bawah DAFTAR_GAMBAR.
    bawaan: 'assets/img/hero-bg.jpg',
    saran: 'Mendatar, sekitar 1920 × 1080 piksel. Bagian atas kirinya yang paling terlihat.',
    keterangan:
      'Foto besar di belakang tulisan sambutan. Di situs ia ditutupi lapisan putih ' +
      'transparan, jadi foto yang ramai pun tetap terbaca.',
  },
  {
    kunci: 'gambar_logo',
    judul: 'Logo di header',
    bawaan: 'assets/img/mylogo.png',
    saran: 'PNG berlatar transparan, tinggi sekitar 100 piksel.',
    keterangan: 'Gambar kecil di kiri atas situs, yang juga menjadi tautan ke halaman depan.',
  },
  {
    kunci: 'gambar_favicon',
    judul: 'Favicon',
    bawaan: 'assets/img/favicon.png',
    saran: 'Persegi, 32 × 32 atau 64 × 64 piksel. PNG.',
    keterangan: 'Ikon kecil di tab peramban.',
  },
  {
    kunci: 'gambar_apple_touch',
    judul: 'Ikon layar utama (Apple touch icon)',
    // Sengaja null: berkas assets/img/apple-touch-icon.png yang
    // dirujuk template TIDAK ADA di disk, jadi tidak ada bawaan yang
    // bisa dipakai. Selama kosong, tagnya tidak ikut dicetak sama
    // sekali supaya tidak lagi menghasilkan 404.
    bawaan: null,
    saran: 'Persegi, 180 × 180 piksel. PNG tanpa sudut membulat.',
    keterangan:
      'Ikon yang dipakai iPhone dan iPad kalau situs ini disimpan ke layar utama. ' +
      'Berkas bawaannya tidak pernah ada di proyek ini.',
  },
];

// Foto bagian About. Kuncinya tetap gambar_about dan nilainya tidak
// diubah sedikit pun -- yang pindah hanya TEMPAT MENYUNTINGNYA, dari
// halaman Gambar Situs ke halaman Data Diri (tahap 23C).
//
// Keterangannya disimpan di sini, bukan di halaman Data Diri, supaya
// jalur bawaannya dan penjaga jalurAman() tetap datang dari satu
// tempat yang sama dengan empat gambar situs lainnya.
export const GAMBAR_ABOUT = {
  kunci: 'gambar_about',
  judul: 'Foto bagian About',
  bawaan: 'assets/img/about.jpg',
  saran: 'Tegak atau persegi, sekitar 800 × 1000 piksel.',
  keterangan: 'Foto di sebelah kiri daftar data diri.',
};

const PETA = new Map(DAFTAR_GAMBAR.map((g) => [g.kunci, g]));

// Hanya dua bentuk jalur yang boleh keluar dari modul ini: berkas
// unggahan dan berkas bawaan di assets/img/. Apa pun selain itu
// dianggap tidak ada.
//
// Penjaga ini bukan basa-basi: nilai gambar_hero ikut dicetak ke
// dalam atribut style= di halaman publik, jadi isinya tidak boleh
// bisa menyelipkan tanda kutip atau kurung.
const POLA_JALUR = /^(uploads|assets\/img)\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

export function jalurAman(nilai) {
  const t = String(nilai == null ? '' : nilai).trim();
  if (t === '') return '';
  if (t.includes('..')) return '';
  return POLA_JALUR.test(t) ? t : '';
}

// Baca semua nilai gambar_* dari tabel profil sekaligus.
async function bacaNilai() {
  const baris = await semua(
    "SELECT kunci, nilai FROM profil WHERE kunci LIKE '" + AWALAN_KUNCI + "%'"
  );
  const peta = {};
  for (const b of baris) peta[b.kunci] = jalurAman(b.nilai);
  return peta;
}

// Bentuk yang dipakai halaman publik: satu jalur siap pakai per
// gambar, atau '' kalau tidak ada gambar sama sekali.
export async function ambilGambarPublik() {
  const nilai = await bacaNilai();
  const hasil = {};
  for (const g of DAFTAR_GAMBAR) {
    const kustom = nilai[g.kunci] || '';
    hasil[g.kunci] = {
      jalur: kustom || g.bawaan || '',
      kustom: kustom !== '',
    };
  }
  return hasil;
}

// Foto About dibaca terpisah, karena ia tidak lagi ikut daftar
// Gambar Situs. Bentuk jawabannya sama persis dengan butir-butir di
// ambilGambarPublik(), jadi tampilan publiknya tidak perlu tahu
// bedanya.
export async function ambilGambarAbout() {
  const baris = await satu('SELECT nilai FROM profil WHERE kunci = ?', [GAMBAR_ABOUT.kunci]);
  const kustom = jalurAman(baris && baris.nilai);
  return {
    jalur: kustom || GAMBAR_ABOUT.bawaan,
    kustom: kustom !== '',
  };
}

// Bentuk yang dipakai halaman panel.
export async function ambilGambarSitus() {
  const nilai = await bacaNilai();
  return DAFTAR_GAMBAR.map((g) => {
    const kustom = nilai[g.kunci] || '';
    return {
      ...g,
      kustom,
      dipakai: kustom || g.bawaan || '',
      pakaiBawaan: kustom === '',
      adaBawaan: !!g.bawaan,
    };
  });
}

// Simpan jalur baru. Kuncinya dibuat kalau belum ada -- profil.kunci
// UNIQUE, jadi upsert-nya aman dipanggil berulang.
async function simpanNilai(kunci, nilai) {
  await db.execute({
    sql:
      'INSERT INTO profil (kunci, nilai) VALUES (?, ?) ' +
      'ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai',
    args: [kunci, nilai],
  });
}

function pesanBerhasil(q) {
  switch (q.pesan) {
    case 'ganti':
      return 'Gambar baru tersimpan.';
    default:
      return null;
  }
}

function pesanGagal(q) {
  switch (q.pesan) {
    case 'tanpa-berkas':
      return 'Tidak ada berkas yang dipilih, jadi tidak ada yang berubah.';
    case 'tidak-dikenal':
      return 'Gambar yang diminta tidak ada di daftar.';
    case 'gagal-unggah':
      return String(q.sebab || 'Gambar gagal diunggah.');
    default:
      return null;
  }
}

export function pasangGambarSitus(app, dep) {
  const { halaman, wajibLogin } = dep;

  app.get('/admin/gambar-situs', wajibLogin, async (req, res) => {
    const daftar = await ambilGambarSitus();
    const diganti = daftar.filter((g) => !g.pakaiBawaan).length;

    return halaman(req, res, 'gambar-situs', {
      judulHalaman: 'Gambar Situs',
      subJudul:
        daftar.length + ' gambar, ' +
        (diganti === 0 ? 'semuanya masih bawaan' : diganti + ' sudah diganti'),
      menuAktif: 'gambar_situs',
      daftar,
      berhasil: pesanBerhasil(req.query),
      kesalahan: pesanGagal(req.query),
    });
  });

  // multer harus mengurai multipart lebih dulu supaya req.body._csrf
  // terbaca, jadi tokennya diperiksa sesudahnya -- dan berkas yang
  // terlanjur tersimpan langsung dibuang kalau tokennya tidak sah.
  // Pola ini sama persis dengan yang dipakai halaman Karya dan Logo.
  function terimaBerkas(req, res, next) {
    unggah.single('gambar')(req, res, (err) => {
      if (err) req.kesalahanUnggah = pesanUnggah(err);
      if (!csrfSah(req)) {
        if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
        res.status(403);
        return res.render('admin/kesalahan', {
          judul: 'Permintaan ditolak',
          pesan:
            'Token keamanan formulir tidak sah atau sudah kedaluwarsa. ' +
            'Muat ulang halaman lalu coba lagi.',
        });
      }
      return next();
    });
  }

  app.post('/admin/gambar-situs/:kunci/ganti', wajibLogin, terimaBerkas, async (req, res) => {
    const kunci = String(req.params.kunci || '');
    const cfg = PETA.get(kunci);

    if (!cfg) {
      if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
      return res.redirect('/admin/gambar-situs?pesan=tidak-dikenal');
    }
    if (req.kesalahanUnggah) {
      if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
      return res.redirect(
        '/admin/gambar-situs?pesan=gagal-unggah&sebab=' + encodeURIComponent(req.kesalahanUnggah)
      );
    }
    if (!req.file) {
      return res.redirect('/admin/gambar-situs?pesan=tanpa-berkas');
    }

    const lama = jalurAman((await satu('SELECT nilai FROM profil WHERE kunci = ?', [kunci]) || {}).nilai);
    const baru = (req.file.path || (AWALAN_UNGGAH + req.file.filename));

    await simpanNilai(kunci, baru);

    // Berkas lama dibuang HANYA lewat hapusBerkasUnggahan, yang
    // menolak jalur apa pun di luar storage/uploads/. Berkas bawaan
    // di assets/ karena itu tidak mungkin ikut terhapus.
    if (lama && lama !== baru) hapusBerkasUnggahan(lama);

    return res.redirect('/admin/gambar-situs?pesan=ganti');
  });

}
