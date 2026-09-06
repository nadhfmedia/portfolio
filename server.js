// Muat .env lebih dulu, sebelum modul lain sempat membaca
// process.env. Impor ESM dijalankan berurutan, jadi baris ini
// harus tetap berada paling atas.
import 'dotenv/config';

import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import SimpanSesiDb from './src/simpan-sesi.js';
import db, { applySchema, hitung, satu, semua } from './src/db.js';
import { acak, cocok, periksaSyarat } from './src/sandi.js';
import { wajibLogin, tolakKalauSudahLogin } from './src/auth.js';
import { tokenCsrf, segarkanCsrf, periksaCsrf, csrfSah } from './src/csrf.js';
import {
  unggah,
  pesanUnggah,
  hapusBerkasUnggahan,
  FOLDER_UNGGAH,
  AWALAN_UNGGAH,
} from './src/unggah.js';
import { pasangSumberAdmin, pasangRuteTampil } from './src/sumber-admin.js';
import { pasangTeksSitus } from './src/teks-situs.js';
import { pasangPesanMasuk, ambilPesanLonceng } from './src/pesan-masuk.js';
import { ambilDashboard } from './src/dashboard.js';
import { tanggalIndonesia, sekarangUntukDb } from './src/tanggal.js';
import { ambilPublik, alamatGambar, footerHtml, sorot } from './src/publik.js';
import { pasangKontak, bentukKontak, bacaIsian } from './src/kontak.js';
import { pasangGambarSitus } from './src/gambar-situs.js';
import { pasangDataDiri } from './src/data-diri.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Samakan bentuk database dengan src/schema.sql sebelum satu rute pun
// dipasang.
//
// Sampai tahap 23 ini tidak pernah dipanggil dari sini: satu-satunya
// yang memanggilnya adalah src/seed.js dan dua skrip di scripts/.
// Akibatnya tabel atau kolom baru hanya sampai ke database pemilik
// kalau ia kebetulan menjalankan salah satu skrip itu -- dan seed
// MENGOSONGKAN tabel isi situs lebih dulu, jadi itu bukan jalan yang
// boleh disarankan. Tabel pengalaman yang baru tidak akan pernah ada
// tanpa baris ini.
//
// Aman dijalankan tiap kali server menyala: seluruh isi schema.sql
// memakai CREATE TABLE IF NOT EXISTS, dan migrasi() hanya menambah
// kolom yang belum ada serta memakai INSERT OR IGNORE. Tidak ada
// satu pun pernyataan di jalur ini yang menghapus atau menimpa data
// yang sudah tersimpan.
await applySchema();

const app = express();
const PORT = process.env.PORT || 4000;
const PRODUKSI = process.env.NODE_ENV === 'production';

// Empat arahan CSP yang berbeda dari bawaan helmet.
//
// 1. img-src -- pemangkas foto memakai URL.createObjectURL(), yang
//    menghasilkan alamat berskema blob:. Bawaan helmet adalah
//    "img-src 'self' data:", yang tidak memuat blob:, jadi gambarnya
//    diblokir sebelum sempat dimuat dan img.onerror terpanggil untuk
//    format apa pun -- jpeg, png, webp, semuanya.
//
// 2 dan 3. style-src dan font-src -- font dan lembar gaya sekarang
//    seluruhnya lokal, jadi skema https: dicabut dari keduanya.
//    'unsafe-inline' pada style-src tetap perlu karena halaman
//    template memakai atribut style= di banyak elemen.
//
// 4. upgrade-insecure-requests -- lihat catatan panjang di bawah.
//
// useDefaults tetap menyala, jadi arahan lain (default-src,
// script-src, object-src, base-uri, form-action, frame-ancestors,
// script-src-attr) tidak berubah sedikit pun.

// upgrade-insecure-requests menyuruh peramban menulis ulang SETIAP
// permintaan sumber daya dari http: jadi https:.
//
// Di localhost arahan itu tidak berlaku: spesifikasinya menetapkan
// localhost sebagai alamat "potentially trustworthy", jadi tidak
// ikut di-upgrade. Di alamat IP jaringan lokal -- 192.168.x.x --
// tidak ada pengecualian seperti itu. Peramban lalu mencari
// https://192.168.0.194:4000/... padahal server ini hanya bicara
// HTTP biasa, tidak punya sertifikat, dan tidak pernah membuat
// server TLS. Jendela jabat tangan TLS gagal, dan SELURUH berkas
// gaya, skrip, serta gambar ikut gagal -- halamannya tampil sebagai
// teks polos. Halamannya sendiri tetap muncul karena permintaan
// pertama sudah selesai sebelum headernya sempat berlaku.
//
// Karena itu arahan ini dimatikan saat server berjalan TANPA
// NODE_ENV=production, yaitu keadaan "dijalankan sendiri di komputer
// atau di jaringan rumah lewat HTTP".
//
// Sengaja bersyarat, bukan dibuang: NODE_ENV=production di proyek
// ini sudah berarti "disajikan lewat HTTPS" -- lihat cookie.secure
// beberapa baris di bawah, yang memakai penanda yang sama. Kalau
// suatu hari situs ini dipasang online dengan HTTPS, kedua
// perlindungan itu menyala bersamaan tanpa perlu diingat lagi.
const PAKSA_HTTPS = PRODUKSI ? [] : null;

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'blob:'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'font-src': ["'self'"],
        // null = arahan bawaannya dibuang seluruhnya.
        'upgrade-insecure-requests': PAKSA_HTTPS,
      },
    },
  })
);

// Rahasia sesi. Kalau tidak diatur lewat lingkungan, dibuat acak
// saat server menyala -- artinya sesi lama hangus tiap kali restart.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn(
    'Peringatan: SESSION_SECRET belum diatur. Memakai rahasia acak sementara, ' +
      'jadi semua sesi akan hangus setiap server dinyalakan ulang.'
  );
}

// Siapa yang boleh dipercaya soal alamat asal permintaan.
//
// 'trust proxy' menyuruh Express membaca header X-Forwarded-For
// untuk menentukan req.ip. Header itu ditulis oleh proxy yang
// berdiri di depan server. Kalau tidak ada proxy, tidak ada yang
// menulisnya -- dan siapa pun boleh mengarangnya sendiri.
//
// Di komputer sendiri dan di jaringan rumah memang tidak ada proxy.
// Dengan nilai 1, satu ponsel di WiFi yang sama bisa mengganti
// X-Forwarded-For tiap kali mengirim, sehingga tiap percobaan masuk
// dihitung sebagai orang baru dan pembatas 10 percobaan per 15 menit
// tidak pernah tercapai. Ketiga pembatas di bawah kena semuanya.
//
// Dengan false, Express mengabaikan header itu sepenuhnya dan
// memakai alamat soket TCP. Alamat soket tidak bisa dikarang: paket
// balasannya harus benar-benar sampai ke sana, jadi pengirim yang
// berbohong soal alamatnya tidak akan pernah menerima jawaban.
//
// Sengaja bersyarat, memakai penanda yang sama dengan cookie.secure
// dan CSP di atas. NODE_ENV=production di proyek ini berarti
// 'disajikan lewat HTTPS', sementara server ini tidak punya kode TLS
// sendiri -- artinya HTTPS-nya pasti datang dari satu proxy di
// depan. Di keadaan itu justru X-Forwarded-For yang berisi alamat
// pengunjung sebenarnya, dan nilai 1 kembali menjadi yang benar.
app.set('trust proxy', PRODUKSI ? 1 : false);

// Mesin tampilan: EJS, semua berkas tampilan ada di views/
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  session({
    name: 'sesi.nadhiful',
    store: new SimpanSesiDb(),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: PRODUKSI,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

// Pembacaan isi formulir biasa (bukan multipart).
app.use(express.urlencoded({ extended: false }));

// Pembatas percobaan masuk: maksimal 10 kali per 15 menit.
// Sengaja hanya dipasang di POST, supaya sekadar membuka atau
// memuat ulang halaman login tidak ikut menghabiskan jatah.
const pembatasLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Terlalu banyak percobaan masuk. Coba lagi setelah 15 menit.',
});

// Pembatas percobaan ubah sandi, dengan jatah terpisah dari
// percobaan masuk. Hanya dipasang di POST.
const pembatasSandi = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Terlalu banyak percobaan mengubah sandi. Coba lagi setelah 15 menit.',
});

// Pembatas kiriman formulir kontak: maksimal 5 pesan per jam per
// alamat IP. Kalau jatahnya habis, pengunjung tidak dilempar ke
// halaman kesalahan -- dia dikembalikan ke bagian Contact dengan
// pesan biasa, sama seperti penolakan lain.
const pembatasKontak = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    req.session.kontak = { status: 'batas', isian: bacaIsian(req.body) };
    return res.redirect(303, '/#contact');
  },
});

// Berkas statis situs publik (milik template lama, jangan diubah).
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Berkas statis panel admin, termasuk salinan boxicons sendiri.
app.use('/admin-assets', express.static(path.join(__dirname, 'admin-assets')));

// Berkas milik situs publik yang kita tambahkan sendiri: font lokal
// dan CSS-nya. Terpisah dari assets/ yang berisi berkas template asli
// dan tidak boleh disentuh.
app.use('/assets-publik', express.static(path.join(__dirname, 'assets-publik')));

// Gambar hasil unggahan.
app.use('/uploads', express.static(FOLDER_UNGGAH));

// ---------------------------------------------------------------
// Halaman publik
// ---------------------------------------------------------------

// Situs portofolio. Tidak butuh login: ini halaman yang dilihat
// pengunjung. Seluruh isinya dibaca dari database saat diminta.
app.get('/', async (req, res) => {
  const data = await ambilPublik();

  // Token CSRF untuk formulir kontak. Pengunjung tidak pernah login,
  // jadi sesinya belum ada saat halaman pertama dibuka. Memanggil
  // tokenCsrf() menulis satu nilai ke req.session, dan menulis itulah
  // yang membuat express-session menyimpan sesinya lalu mengirim
  // kuki -- meski saveUninitialized bernilai false.
  const csrf = tokenCsrf(req);

  // Jam halaman dibuka, dipakai POST /kontak untuk menolak kiriman
  // yang datang terlalu cepat. Disimpan di sesi, bukan di kolom
  // tersembunyi, supaya tidak bisa dipalsukan dari sisi pengirim.
  req.session.kontakDibuka = Date.now();

  // Hasil kiriman sebelumnya dititipkan di sesi oleh POST /kontak,
  // lalu dibaca sekali di sini dan langsung dibuang -- kalau halaman
  // ini dimuat ulang, pesannya tidak muncul lagi.
  const kilat = req.session.kontak;
  if (kilat) delete req.session.kontak;

  res.render('publik/index', {
    ...data,
    alamatGambar,
    sorot,
    footerHtml: footerHtml(data.teks),
    csrf,
    kontak: bentukKontak(kilat),
  });
});

// Penerima formulir kontak. Rutenya ada di src/kontak.js bersama
// seluruh pemeriksaannya.
pasangKontak(app, { pembatasKontak });

// ---------------------------------------------------------------
// Rute umum
// ---------------------------------------------------------------

app.get('/health', (req, res) => {
  res.json({ ok: true, port: Number(PORT), tahap: 1 });
});

const TABEL = ['karya', 'kategori', 'layanan', 'pengalaman', 'skill', 'logo', 'menu', 'profil', 'pesan', 'pengguna'];

// Express 5 meneruskan promise yang ditolak ke penangan error otomatis.
app.get('/api/cek', async (req, res) => {
  const hasil = {};
  for (const t of TABEL) {
    hasil[t] = await hitung(t);
  }
  res.json(hasil);
});

// ---------------------------------------------------------------
// Menu samping panel
// ---------------------------------------------------------------

// tautan null berarti halamannya belum dibuat: ditampilkan sebagai
// tautan mati bertanda "belum tersedia", bukan halaman kosong.
const MENU_SAMPING = [
  { kunci: 'beranda', label: 'Dashboard', ikon: 'bx-home-alt', tautan: '/admin' },
  { kunci: 'karya', label: 'Karya', ikon: 'bx-images', tautan: '/admin/karya' },
  { kunci: 'kategori', label: 'Kategori', ikon: 'bx-purchase-tag', tautan: '/admin/kategori' },
  { kunci: 'layanan', label: 'Layanan', ikon: 'bx-briefcase', tautan: '/admin/layanan' },
  // Urutannya mengikuti urutan bagiannya di situs publik:
  // Pengalaman berada di antara About dan Skills.
  { kunci: 'pengalaman', label: 'Pengalaman', ikon: 'bx-briefcase-alt', tautan: '/admin/pengalaman' },
  { kunci: 'skill', label: 'Skill', ikon: 'bx-bar-chart-alt-2', tautan: '/admin/skill' },
  // bx-shapes tidak ada di boxicons; bx-palette dipakai agar segaris
  // dengan menu lain yang semuanya bergaya garis.
  { kunci: 'logo', label: 'Logo', ikon: 'bx-palette', tautan: '/admin/logo' },
  { kunci: 'menu', label: 'Menu', ikon: 'bx-menu', tautan: '/admin/menu' },
  { kunci: 'data_diri', label: 'Data Diri', ikon: 'bx-user', tautan: '/admin/data-diri' },
  { kunci: 'teks', label: 'Teks Situs', ikon: 'bx-text', tautan: '/admin/teks' },
  { kunci: 'gambar_situs', label: 'Gambar Situs', ikon: 'bx-image', tautan: '/admin/gambar-situs' },
  { kunci: 'pesan', label: 'Pesan Masuk', ikon: 'bx-envelope', tautan: '/admin/pesan' },
];

// Pembungkus render: semua halaman panel memakai tata letak yang sama.
function halaman(req, res, isi, data) {
  return res.render('admin/tata-letak', {
    isi: 'isi/' + isi,
    kesalahanSandi: null,
    // Dipakai tampilan mana pun yang perlu menulis tanggal.
    tanggalIndonesia,
    menuSamping: MENU_SAMPING,
    csrf: tokenCsrf(req),
    subJudul: null,
    kesalahan: null,
    berhasil: null,
    ...data,
  });
}

// ---------------------------------------------------------------
// Masuk dan keluar
// ---------------------------------------------------------------

const PESAN_GAGAL_MASUK = 'Email atau sandi salah.';

// Hash umpan. Dipakai saat email tidak ditemukan supaya lama
// pemrosesannya mirip dengan saat email ditemukan, sehingga
// penyerang tidak bisa menebak email mana yang terdaftar.
const HASH_UMPAN = await acak(crypto.randomBytes(24).toString('hex'));

app.get('/admin/login', tolakKalauSudahLogin, (req, res) => {
  res.render('admin/login', { csrf: tokenCsrf(req), kesalahan: null });
});

// Keterangan cara mengatur ulang sandi. Sengaja tanpa formulir dan
// tanpa medan email: halaman ini hanya menjelaskan skrip terminal,
// jadi tidak ada yang bisa dipancing dari luar.
app.get('/admin/lupa-sandi', (req, res) => {
  res.render('admin/lupa-sandi');
});

app.post('/admin/login', pembatasLogin, periksaCsrf, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const sandi = String(req.body.sandi || '');

  const pengguna = email
    ? await satu('SELECT id, email, nama, hash_sandi FROM pengguna WHERE lower(email) = ?', [email])
    : undefined;

  // Sandi selalu diperiksa, walau penggunanya tidak ada.
  const sah = pengguna
    ? await cocok(sandi, pengguna.hash_sandi)
    : await cocok(sandi, HASH_UMPAN);

  if (!pengguna || !sah) {
    // Pesannya sengaja sama persis untuk kedua sebab kegagalan.
    res.status(401);
    return res.render('admin/login', { csrf: tokenCsrf(req), kesalahan: PESAN_GAGAL_MASUK });
  }

  // Ganti id sesi supaya sesi sebelum masuk tidak bisa dipakai ulang.
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

  req.session.penggunaId = pengguna.id;
  segarkanCsrf(req);

  await new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

  return res.redirect('/admin');
});

app.post('/admin/logout', periksaCsrf, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sesi.nadhiful');
    return res.redirect('/admin/login');
  });
});

// Sediakan data pengguna yang sedang masuk untuk semua tampilan
// panel, supaya sidebar bisa menampilkan foto dan namanya tanpa
// tiap rute harus mengambilnya sendiri.
app.use('/admin', async (req, res, next) => {
  if (req.session && req.session.penggunaId) {
    res.locals.pengguna = await satu(
      'SELECT id, email, nama, foto FROM pengguna WHERE id = ?',
      [req.session.penggunaId]
    );
  }
  next();
});

// Lencana kecil di sidebar dan isi lonceng pemberitahuan.
//
// Dipasang sebagai middleware, bukan diambil di tiap rute, supaya
// SETIAP halaman panel punya datanya tanpa satu pun rute harus tahu
// soal lonceng. Rute baru mana pun langsung ikut mendapatkannya.
app.use('/admin', async (req, res, next) => {
  if (req.session && req.session.penggunaId) {
    const lonceng = await ambilPesanLonceng();
    res.locals.jumlahPesanBaru = lonceng.belumDibaca;
    res.locals.pesanLonceng = lonceng.daftar;
  }
  next();
});

// ---------------------------------------------------------------
// Akun sendiri
// ---------------------------------------------------------------

// Sama seperti terimaFormKarya: multer harus mengurai multipart
// lebih dulu supaya req.body._csrf terbaca, jadi token diperiksa
// setelahnya. Berkas yang terlanjur tersimpan langsung dibuang
// kalau tokennya tidak sah.
function terimaFormAkun(req, res, next) {
  unggah.single('foto')(req, res, (err) => {
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

app.get('/admin/akun', wajibLogin, async (req, res) => {
  // id diambil dari sesi, tidak pernah dari permintaan.
  const akun = await satu(
    'SELECT id, email, nama, foto FROM pengguna WHERE id = ?',
    [req.session.penggunaId]
  );
  if (!akun) {
    return req.session.destroy(() => res.redirect('/admin/login'));
  }

  return halaman(req, res, 'akun', {
    judulHalaman: 'Akun saya',
    subJudul: 'Ubah nama dan foto profil Anda',
    menuAktif: 'akun',
    akun,
    berhasil:
      req.query.pesan === 'simpan'
        ? 'Perubahan tersimpan.'
        : req.query.pesan === 'sandi'
        ? 'Sandi berhasil diubah. Sesi lama sudah tidak berlaku.'
        : null,
  });
});

app.post('/admin/akun', wajibLogin, terimaFormAkun, async (req, res) => {
  // id SELALU dari sesi. Isian formulir tidak pernah dipakai untuk
  // menentukan akun mana yang diubah, jadi pengguna tidak bisa
  // menyunting akun orang lain walau memalsukan isian.
  const id = req.session.penggunaId;

  const akun = await satu('SELECT id, email, nama, foto FROM pengguna WHERE id = ?', [id]);
  if (!akun) {
    if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
    return req.session.destroy(() => res.redirect('/admin/login'));
  }

  const nama = String(req.body.nama || '').trim();
  const mintaHapusFoto = Boolean(req.body.hapus_foto);

  let kesalahan = req.kesalahanUnggah || null;
  if (!kesalahan && !nama) kesalahan = 'Nama wajib diisi.';
  if (!kesalahan && nama.length > 120) kesalahan = 'Nama terlalu panjang (maksimal 120 karakter).';

  if (kesalahan) {
    if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
    res.status(400);
    return halaman(req, res, 'akun', {
      judulHalaman: 'Akun saya',
      subJudul: 'Ubah nama dan foto profil Anda',
      menuAktif: 'akun',
      akun: { ...akun, nama: nama || akun.nama },
      kesalahan,
    });
  }

  // Foto baru menang atas permintaan hapus; tanpa keduanya,
  // foto lama tetap dipakai.
  let foto = akun.foto || '';
  if (req.file) {
    foto = (req.file.path || (AWALAN_UNGGAH + req.file.filename));
  } else if (mintaHapusFoto) {
    foto = '';
  }

  await db.execute({
    sql: 'UPDATE pengguna SET nama = ?, foto = ? WHERE id = ?',
    args: [nama, foto, id],
  });

  // Berkas lama dibuang hanya lewat hapusBerkasUnggahan, yang
  // menolak jalur apa pun di luar storage/uploads/.
  if (akun.foto && akun.foto !== foto) {
    hapusBerkasUnggahan(akun.foto);
  }

  return res.redirect('/admin/akun?pesan=simpan');
});

// Ubah sandi dari panel.
//
// Sandi lama wajib benar, sandi baru diperiksa dengan periksaSyarat()
// yang sama dengan pembuat akun, dan id pengguna SELALU diambil dari
// sesi -- tidak ada medan id di formulir, jadi tidak ada cara
// mengubah sandi akun orang lain.
//
// Tidak ada satu pun cabang di sini yang mencetak sandi atau hash-nya.
app.post('/admin/akun/sandi', wajibLogin, pembatasSandi, periksaCsrf, async (req, res) => {
  const id = req.session.penggunaId;

  const akun = await satu(
    'SELECT id, email, nama, foto, hash_sandi FROM pengguna WHERE id = ?',
    [id]
  );
  if (!akun) {
    return req.session.destroy(() => res.redirect('/admin/login'));
  }

  const lama = String(req.body.sandi_lama || '');
  const baru = String(req.body.sandi_baru || '');
  const ulang = String(req.body.sandi_ulang || '');

  let kesalahan = null;

  if (!(await cocok(lama, akun.hash_sandi))) {
    kesalahan = 'Sandi lama salah.';
  } else if (baru !== ulang) {
    kesalahan = 'Sandi baru dan ulangannya tidak sama.';
  } else if (baru === lama) {
    kesalahan = 'Sandi baru tidak boleh sama dengan sandi lama.';
  } else {
    try {
      periksaSyarat(baru);
    } catch (e) {
      kesalahan = e.message;
    }
  }

  if (kesalahan) {
    res.status(400);
    return halaman(req, res, 'akun', {
      judulHalaman: 'Akun saya',
      subJudul: 'Ubah nama dan foto profil Anda',
      menuAktif: 'akun',
      akun: { id: akun.id, email: akun.email, nama: akun.nama, foto: akun.foto },
      kesalahanSandi: kesalahan,
    });
  }

  await db.execute({
    sql: 'UPDATE pengguna SET hash_sandi = ? WHERE id = ?',
    args: [await acak(baru), id],
  });

  // Sesi lama dibuang dan diganti yang baru: cookie yang sempat
  // bocor sebelum sandi diganti jadi tidak berguna. Penggunanya
  // sendiri tetap masuk.
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

  req.session.penggunaId = id;
  segarkanCsrf(req);

  await new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

  return res.redirect('/admin/akun?pesan=sandi');
});

// ---------------------------------------------------------------
// Beranda panel
// ---------------------------------------------------------------

app.get('/admin', wajibLogin, async (req, res) => {
  const pengguna = await satu('SELECT id, email, nama FROM pengguna WHERE id = ?', [req.session.penggunaId]);

  // Akun bisa saja sudah dihapus sementara sesinya masih hidup.
  if (!pengguna) {
    return req.session.destroy(() => res.redirect('/admin/login'));
  }

  const data = await ambilDashboard();

  return halaman(req, res, 'dashboard', {
    judulHalaman: 'Dashboard',
    subJudul: 'Halo, ' + pengguna.nama,
    menuAktif: 'beranda',
    ...data,
  });
});

// ---------------------------------------------------------------
// Karya
// ---------------------------------------------------------------

const SQL_KARYA =
  'SELECT k.id, k.judul, k.subjudul, k.gambar, k.kategori_id, k.urutan, k.tampil, ' +
  'k.dibuat_pada, kt.nama AS kategori_nama ' +
  'FROM karya k LEFT JOIN kategori kt ON kt.id = k.kategori_id ';

// Baca dan bersihkan isi formulir karya.
function bacaFormKarya(req) {
  const judul = String(req.body.judul || '').trim();
  const subjudul = String(req.body.subjudul || '').trim();
  const kategoriMentah = String(req.body.kategori_id || '').trim();
  const urutanMentah = String(req.body.urutan || '').trim();

  return {
    judul,
    subjudul,
    kategori_id: kategoriMentah === '' ? null : Number(kategoriMentah),
    urutan: urutanMentah === '' ? 0 : Number(urutanMentah),
    tampil: req.body.tampil ? 1 : 0,
  };
}

// Kembalikan kalimat kesalahan pertama, atau null kalau isian sah.
async function periksaFormKarya(nilai) {
  if (!nilai.judul) return 'Judul wajib diisi.';
  if (nilai.judul.length > 200) return 'Judul terlalu panjang (maksimal 200 karakter).';
  if (!Number.isInteger(nilai.urutan) || nilai.urutan < 0) return 'Urutan harus berupa angka bulat nol atau lebih.';

  if (nilai.kategori_id !== null) {
    if (!Number.isInteger(nilai.kategori_id)) return 'Kategori tidak sah.';
    const ada = await satu('SELECT id FROM kategori WHERE id = ?', [nilai.kategori_id]);
    if (!ada) return 'Kategori yang dipilih tidak ada.';
  }
  return null;
}

// Middleware unggah + CSRF untuk formulir karya.
// multer harus jalan lebih dulu supaya req.body terisi, jadi token
// baru bisa diperiksa setelahnya. Kalau tokennya tidak sah, berkas
// yang terlanjur tersimpan langsung dibuang.
function terimaFormKarya(req, res, next) {
  unggah.single('gambar')(req, res, (err) => {
    if (err) {
      req.kesalahanUnggah = pesanUnggah(err);
      // Tetap lanjut supaya CSRF diperiksa dan formulir bisa
      // ditampilkan ulang beserta pesan kesalahannya.
    }
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

// Kalimat sukses yang ditampilkan setelah pengalihan.
function pesanBerhasil(q) {
  const n = Number(q.n) || 0;
  const b = Number(q.b) || 0;
  switch (q.pesan) {
    case 'tampil-hidup':
      return 'Satu karya sekarang tampil di situs.';
    case 'tampil-mati':
      return 'Satu karya sekarang disembunyikan dari situs.';
    case 'simpan':
      return 'Karya berhasil disimpan.';
    case 'hapus':
      return 'Karya berhasil dihapus.';
    case 'urutan':
      return 'Urutan tersimpan. ' + n + ' karya diperbarui.';
    case 'hapus-banyak':
      return n + ' karya dihapus. ' + b + ' berkas gambar di storage/uploads/ ikut dibuang; '
        + 'gambar milik situs publik di assets/ tidak disentuh.';
    default:
      return null;
  }
}

// Sakelar tampil di tabel Karya. Mesinnya sama persis dengan yang
// dipakai Menu, Skill, Logo, Layanan, dan Data Diri -- dipanggil dari
// sini karena halaman Karya punya rutenya sendiri.
pasangRuteTampil(app, { dasar: '/admin/karya', tabel: 'karya', wajibLogin });

app.get('/admin/karya', wajibLogin, async (req, res) => {
  const karya = await semua(SQL_KARYA + 'ORDER BY k.urutan, k.id');
  return halaman(req, res, 'karya-daftar', {
    judulHalaman: 'Karya',
    subJudul: karya.length + ' karya di database',
    menuAktif: 'karya',
    karya,
    berhasil: pesanBerhasil(req.query),
    kesalahan: req.query.pesan === 'urutan-kosong' || req.query.pesan === 'hapus-kosong'
      ? 'Tidak ada karya yang dipilih, jadi tidak ada yang diubah.'
      : null,
  });
});

app.get('/admin/karya/baru', wajibLogin, async (req, res) => {
  const kategori = await semua('SELECT id, nama FROM kategori ORDER BY urutan, id');
  const berikutnya = await satu('SELECT COALESCE(MAX(urutan), 0) + 1 AS n FROM karya');

  return halaman(req, res, 'karya-form', {
    judulHalaman: 'Tambah karya',
    menuAktif: 'karya',
    aksi: '/admin/karya/baru',
    kategori,
    nilai: { judul: '', subjudul: '', kategori_id: '', urutan: Number(berikutnya.n), tampil: 1, gambar: null },
  });
});

app.post('/admin/karya/baru', wajibLogin, terimaFormKarya, async (req, res) => {
  const nilai = bacaFormKarya(req);
  const kesalahan = req.kesalahanUnggah || (await periksaFormKarya(nilai));

  if (kesalahan) {
    if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
    const kategori = await semua('SELECT id, nama FROM kategori ORDER BY urutan, id');
    res.status(400);
    return halaman(req, res, 'karya-form', {
      judulHalaman: 'Tambah karya',
      menuAktif: 'karya',
      aksi: '/admin/karya/baru',
      kategori,
      nilai: { ...nilai, gambar: null },
      kesalahan,
    });
  }

  const gambar = req.file ? (req.file.path || (AWALAN_UNGGAH + req.file.filename)) : '';

  // Hanya karya BARU yang dicatat waktunya. Karya lama dibiarkan
  // kosong karena tanggal aslinya memang tidak diketahui.
  await db.execute({
    sql:
      'INSERT INTO karya (judul, subjudul, gambar, kategori_id, urutan, tampil, dibuat_pada) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [
      nilai.judul,
      nilai.subjudul,
      gambar,
      nilai.kategori_id,
      nilai.urutan,
      nilai.tampil,
      sekarangUntukDb(),
    ],
  });

  return res.redirect('/admin/karya?pesan=simpan');
});

// Baca daftar id dari medan tersembunyi berisi angka dipisah koma.
// Hasilnya hanya berisi bilangan bulat positif tanpa pengulangan.
function bacaDaftarId(mentah) {
  return String(mentah || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[0-9]+$/.test(s))
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0)
    .filter((n, i, arr) => arr.indexOf(n) === i);
}

// Simpan urutan baru hasil seret. Nomor urut diberikan menurut
// posisi id dalam daftar yang dikirim. Hanya kolom urutan yang
// disentuh; tidak ada baris yang dibuat atau dihapus di sini.
app.post('/admin/karya/urutan', wajibLogin, periksaCsrf, async (req, res) => {
  const ids = bacaDaftarId(req.body.ids);
  if (ids.length === 0) {
    return res.redirect('/admin/karya?pesan=urutan-kosong');
  }

  const tx = await db.transaction('write');
  let diubah = 0;
  try {
    for (const [i, id] of ids.entries()) {
      const hasil = await tx.execute({
        sql: 'UPDATE karya SET urutan = ? WHERE id = ?',
        args: [i + 1, id],
      });
      diubah += Number(hasil.rowsAffected || 0);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  return res.redirect('/admin/karya?pesan=urutan&n=' + diubah);
});

// Hapus beberapa karya sekaligus dalam satu transaksi.
app.post('/admin/karya/hapus-banyak', wajibLogin, periksaCsrf, async (req, res) => {
  const ids = bacaDaftarId(req.body.ids);
  if (ids.length === 0) {
    return res.redirect('/admin/karya?pesan=hapus-kosong');
  }

  // Jalur gambar dikumpulkan lebih dulu, selagi barisnya masih ada.
  const tanda = ids.map(() => '?').join(',');
  const barisnya = await semua('SELECT id, gambar FROM karya WHERE id IN (' + tanda + ')', ids);

  const tx = await db.transaction('write');
  let terhapus = 0;
  try {
    for (const id of ids) {
      const hasil = await tx.execute({ sql: 'DELETE FROM karya WHERE id = ?', args: [id] });
      terhapus += Number(hasil.rowsAffected || 0);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  // Berkas baru dibuang setelah database berhasil diubah.
  // hapusBerkasUnggahan hanya mau menyentuh storage/uploads/;
  // gambar milik situs publik di assets/ selalu ditolaknya.
  let berkasTerhapus = 0;
  for (const b of barisnya) {
    if (hapusBerkasUnggahan(b.gambar)) berkasTerhapus++;
  }

  return res.redirect('/admin/karya?pesan=hapus-banyak&n=' + terhapus + '&b=' + berkasTerhapus);
});

app.get('/admin/karya/:id/sunting', wajibLogin, async (req, res, next) => {
  const karya = await satu(SQL_KARYA + 'WHERE k.id = ?', [Number(req.params.id)]);
  if (!karya) return next();

  const kategori = await semua('SELECT id, nama FROM kategori ORDER BY urutan, id');

  return halaman(req, res, 'karya-form', {
    judulHalaman: 'Edit karya',
    subJudul: karya.judul,
    menuAktif: 'karya',
    aksi: '/admin/karya/' + karya.id + '/sunting',
    kategori,
    nilai: karya,
  });
});

app.post('/admin/karya/:id/sunting', wajibLogin, terimaFormKarya, async (req, res, next) => {
  const id = Number(req.params.id);
  const lama = await satu('SELECT id, gambar FROM karya WHERE id = ?', [id]);
  if (!lama) {
    if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
    return next();
  }

  const nilai = bacaFormKarya(req);
  const kesalahan = req.kesalahanUnggah || (await periksaFormKarya(nilai));

  if (kesalahan) {
    if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
    const kategori = await semua('SELECT id, nama FROM kategori ORDER BY urutan, id');
    res.status(400);
    return halaman(req, res, 'karya-form', {
      judulHalaman: 'Edit karya',
      menuAktif: 'karya',
      aksi: '/admin/karya/' + id + '/sunting',
      kategori,
      nilai: { ...nilai, gambar: lama.gambar },
      kesalahan,
    });
  }

  // Tanpa unggahan baru, gambar lama tetap dipakai.
  const gambar = req.file ? (req.file.path || (AWALAN_UNGGAH + req.file.filename)) : lama.gambar;

  await db.execute({
    sql: 'UPDATE karya SET judul = ?, subjudul = ?, gambar = ?, kategori_id = ?, urutan = ?, tampil = ? WHERE id = ?',
    args: [nilai.judul, nilai.subjudul, gambar, nilai.kategori_id, nilai.urutan, nilai.tampil, id],
  });

  // Berkas lama dibuang hanya kalau memang hasil unggahan dan
  // benar-benar digantikan. Gambar di assets/ tidak pernah disentuh.
  if (req.file && lama.gambar && lama.gambar !== gambar) {
    hapusBerkasUnggahan(lama.gambar);
  }

  return res.redirect('/admin/karya?pesan=simpan');
});

app.get('/admin/karya/:id/hapus', wajibLogin, async (req, res, next) => {
  const karya = await satu(SQL_KARYA + 'WHERE k.id = ?', [Number(req.params.id)]);
  if (!karya) return next();

  return halaman(req, res, 'karya-hapus', {
    judulHalaman: 'Hapus karya?',
    subJudul: karya.judul,
    menuAktif: 'karya',
    karya,
    berkasIkutDihapus: typeof karya.gambar === 'string' && karya.gambar.startsWith(AWALAN_UNGGAH),
  });
});

app.post('/admin/karya/:id/hapus', wajibLogin, periksaCsrf, async (req, res, next) => {
  const id = Number(req.params.id);
  const karya = await satu('SELECT id, gambar FROM karya WHERE id = ?', [id]);
  if (!karya) return next();

  await db.execute({ sql: 'DELETE FROM karya WHERE id = ?', args: [id] });

  // Hanya berkas unggahan yang ikut dihapus. Gambar lama di
  // assets/img/portfolio/ milik situs publik dan tetap dibiarkan.
  hapusBerkasUnggahan(karya.gambar);

  return res.redirect('/admin/karya?pesan=hapus');
});

// ---------------------------------------------------------------
// Halaman daftar sederhana: Kategori, Menu, Skill, Logo
// ---------------------------------------------------------------

// Keempatnya dibangun dari satu mesin bersama di src/sumber-admin.js,
// bukan ditulis empat kali.
pasangSumberAdmin(app, { halaman, wajibLogin });

// Dua halaman berikut tidak memakai mesin itu; alasannya ditulis di
// bagian atas masing-masing modul.
pasangTeksSitus(app, { halaman, wajibLogin });
pasangPesanMasuk(app, { halaman, wajibLogin });
pasangGambarSitus(app, { halaman, wajibLogin });

// Data Diri: enam medan tetap di tabel profil, satu formulir. Dulu ia
// ikut mesin sumber-admin.js sebagai daftar bebas; sejak tahap 23C
// bentuknya seperti halaman Teks Situs.
pasangDataDiri(app, { halaman, wajibLogin });

// ---------------------------------------------------------------
// Penanganan kesalahan
// ---------------------------------------------------------------

// Alamat yang tidak dikenali.
app.use((req, res) => {
  res.status(404);
  if (req.accepts('html')) {
    return res.render('admin/kesalahan', {
      judul: 'Halaman tidak ditemukan',
      pesan: 'Alamat yang Anda buka tidak ada di server ini.',
    });
  }
  return res.json({ ok: false, pesan: 'Halaman tidak ditemukan.' });
});

// Kesalahan tak tertangkap. Rincian lengkapnya hanya masuk ke
// log server; pengunjung cuma melihat pesan umum tanpa jalur
// berkas maupun tumpukan pemanggilan.
app.use((err, req, res, next) => {
  console.error('[kesalahan]', req.method, req.originalUrl, '\n', err);

  if (res.headersSent) return next(err);

  res.status(err.status && err.status >= 400 && err.status < 600 ? err.status : 500);
  if (req.accepts('html')) {
    return res.render('admin/kesalahan', {
      judul: 'Terjadi kesalahan',
      pesan:
        'Ada yang tidak beres saat memproses permintaan Anda. ' +
        'Silakan coba lagi. Kalau terus berulang, periksa log server.',
    });
  }
  return res.json({ ok: false, pesan: 'Terjadi kesalahan di server.' });
});

// Berkas uji mengimpor berkas ini untuk memanggil rute yang sungguhan
// -- bukan salinannya -- lewat app(req, res), tanpa jaringan. Dengan
// UJI_TANPA_PORT=1 aplikasinya hanya dirakit dan tidak membuka port.
//
// Tanpa variabel itu, termasuk pada `node server.js` biasa,
// perbandingannya bernilai undefined !== '1' alias true, jadi
// perilakunya persis seperti sebelumnya.
if (process.env.UJI_TANPA_PORT !== '1') {
  app.listen(PORT, () => {
    console.log(`Server menyala di http://localhost:${PORT}`);
  });
}

export default app;
