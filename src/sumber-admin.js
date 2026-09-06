// Mesin bersama untuk halaman-halaman admin yang berbentuk daftar
// sederhana: Kategori, Menu, Skill, dan Logo.
//
// Keempatnya memakai pola yang sama persis (tabel, cari, urut,
// seret, hapus, hapus banyak), jadi rutenya dibangun sekali di sini
// lalu dipasang empat kali dengan pengaturan berbeda. Halaman Karya
// tetap punya rutenya sendiri di server.js karena ia punya hal-hal
// khusus (popup Lihat, kategori bertaut, pratinjau gambar besar).

import db, { satu, semua } from './db.js';
import { periksaCsrf, csrfSah } from './csrf.js';
import { unggah, pesanUnggah, hapusBerkasUnggahan, AWALAN_UNGGAH } from './unggah.js';
import { IKON, ikonSah } from './ikon.js';

// Pola kelas filter Isotope: huruf kecil, angka, dan tanda hubung.
export const POLA_KELAS_FILTER = /^[a-z]+(?:-[a-z0-9]+)*$/;

// Batas bawah tahun pengalaman kerja. Angka bulat yang sengaja jauh
// di masa lalu: cukup longgar untuk riwayat kerja siapa pun yang
// memakai panel ini, tapi tetap menolak salah ketik seperti 198 atau
// 1080.
export const TAHUN_PALING_AWAL = 1980;

// Batas atasnya TIDAK boleh dibekukan saat berkas ini dimuat: server
// bisa menyala berbulan-bulan dan melewati pergantian tahun. Karena
// itu ia sebuah fungsi, dan dipanggil ulang tiap kali dipakai.
export function tahunSekarang() {
  return new Date().getFullYear();
}

// min dan maks sebuah medan angka boleh berupa angka biasa ATAU
// fungsi seperti tahunSekarang di atas.
function batas(x) {
  return typeof x === 'function' ? x() : x;
}

// ---------------------------------------------------------------
// Pengaturan tiap sumber daya
// ---------------------------------------------------------------

export const SUMBER = [
  {
    kunci: 'kategori',
    jalur: 'kategori',
    judul: 'Kategori',
    tabel: 'kategori',
    satuan: 'kategori',
    medanNama: 'nama',
    catatan:
      'Kelas filter dipakai tombol penyaring di bagian Portfolio situs publik. ' +
      'Tiap kelas harus unik dan hanya boleh huruf kecil, angka, dan tanda hubung.',
    catatanHapus:
      'Karya yang memakai kategori ini tidak ikut terhapus; kategorinya menjadi kosong.',
    medan: [
      { nama: 'nama', label: 'Nama', jenis: 'teks', wajib: true, maks: 100 },
      {
        nama: 'kelas_filter',
        label: 'Kelas filter',
        jenis: 'teks',
        wajib: true,
        maks: 60,
        pola: POLA_KELAS_FILTER,
        pesanPola:
          'Kelas filter hanya boleh huruf kecil, angka, dan tanda hubung, ' +
          'contohnya filter-vector. Tidak boleh ada spasi atau huruf besar.',
        petunjuk: 'Contoh: filter-vector.',
        peringatan:
          'Hati-hati: kalau dua kategori memakai kelas yang sama, tombol ' +
          'penyaringnya di situs akan menampilkan karya milik keduanya.',
        unik: true,
      },
      { nama: 'urutan', label: 'Urutan', jenis: 'angka', min: 0 },
    ],
    // Kolom tambahan yang hanya tampil di daftar, bukan di formulir.
    kolomTambahan: [{ kunci: 'jumlah_karya', label: 'Jumlah karya', jenis: 'angka' }],
    sql:
      'SELECT k.id, k.nama, k.kelas_filter, k.urutan, ' +
      '(SELECT COUNT(*) FROM karya WHERE kategori_id = k.id) AS jumlah_karya ' +
      'FROM kategori k ORDER BY k.urutan, k.id',
    // Dijalankan sebelum menghapus. Mengembalikan keterangan yang
    // ditampilkan di halaman konfirmasi.
    async periksaHapus(baris) {
      const r = await satu('SELECT COUNT(*) AS n FROM karya WHERE kategori_id = ?', [baris.id]);
      const n = Number(r.n);
      return {
        jumlahTerpengaruh: n,
        perluSadar: n > 0,
        pesan:
          n === 0
            ? 'Tidak ada karya yang memakai kategori ini.'
            : n +
              ' karya memakai kategori ini. Karyanya TIDAK ikut terhapus, ' +
              'tapi kategorinya akan menjadi kosong dan harus diisi ulang satu per satu.',
      };
    },
  },

  {
    kunci: 'menu',
    jalur: 'menu',
    judul: 'Menu',
    tabel: 'menu',
    satuan: 'butir menu',
    medanNama: 'label',
    catatan:
      'Tautan boleh berupa tanda pagar seperti #about, yang meloncat ke bagian ' +
      'itu di halaman yang sama, atau garis miring / untuk kembali ke atas ' +
      'halaman. Nama bagian yang tersedia: about, experience, skills, services, ' +
      'portfolio, contact.',
    medan: [
      { nama: 'label', label: 'Label', jenis: 'teks', wajib: true, maks: 60 },
      {
        nama: 'tautan',
        label: 'Tautan',
        jenis: 'teks',
        wajib: true,
        maks: 200,
        petunjuk: 'Contoh: #about, #portfolio, atau / untuk halaman depan.',
      },
      { nama: 'urutan', label: 'Urutan', jenis: 'angka', min: 0 },
      { nama: 'tampil', label: 'Tampilkan di situs', jenis: 'centang' },
    ],
    sql: 'SELECT id, label, tautan, urutan, tampil FROM menu ORDER BY urutan, id',
  },

  {
    kunci: 'skill',
    jalur: 'skill',
    judul: 'Skill',
    tabel: 'skill',
    satuan: 'skill',
    medanNama: 'nama',
    medan: [
      { nama: 'nama', label: 'Nama', jenis: 'teks', wajib: true, maks: 100 },
      {
        nama: 'persen',
        label: 'Persen',
        jenis: 'angka',
        min: 0,
        maks: 100,
        wajib: true,
        petunjuk: 'Angka 0 sampai 100.',
      },
      {
        nama: 'kolom',
        label: 'Kolom',
        jenis: 'pilihan',
        pilihan: [
          { nilai: 'kiri', teks: 'Kiri' },
          { nilai: 'kanan', teks: 'Kanan' },
        ],
        petunjuk: 'Menentukan skill ini muncul di kolom kiri atau kanan situs.',
      },
      { nama: 'urutan', label: 'Urutan', jenis: 'angka', min: 0 },
      { nama: 'tampil', label: 'Tampilkan di situs', jenis: 'centang' },
    ],
    sql: 'SELECT id, nama, persen, kolom, urutan, tampil FROM skill ORDER BY urutan, id',
    async ringkasan() {
      const kiri = await satu("SELECT COUNT(*) AS n FROM skill WHERE kolom = 'kiri'");
      const kanan = await satu("SELECT COUNT(*) AS n FROM skill WHERE kolom = 'kanan'");
      const a = Number(kiri.n);
      const b = Number(kanan.n);
      return {
        butir: [
          { label: 'Kolom kiri', nilai: a },
          { label: 'Kolom kanan', nilai: b },
        ],
        peringatan:
          Math.abs(a - b) > 1
            ? 'Jumlah skill di kedua kolom timpang (' + a + ' berbanding ' + b + '). ' +
              'Di situs publik, kolom yang lebih pendek akan menyisakan ruang kosong.'
            : null,
      };
    },
  },

  {
    kunci: 'logo',
    jalur: 'logo',
    judul: 'Logo',
    tabel: 'logo',
    satuan: 'logo',
    medanNama: 'nama',
    punyaGambar: true,
    catatan:
      'Nama logo yang ada sekarang ditebak dari nama berkasnya, jadi perlu ' +
      'diperiksa satu per satu. Nama ini dipakai sebagai teks pengganti ' +
      'gambar kalau logonya gagal dimuat.',
    medan: [
      { nama: 'gambar', label: 'Gambar', jenis: 'gambar' },
      { nama: 'nama', label: 'Nama', jenis: 'teks', maks: 100, petunjuk: 'Boleh dikosongkan.' },
      { nama: 'urutan', label: 'Urutan', jenis: 'angka', min: 0 },
      { nama: 'tampil', label: 'Tampilkan di situs', jenis: 'centang' },
    ],
    sql: 'SELECT id, gambar, nama, urutan, tampil FROM logo ORDER BY urutan, id',
  },

  {
    kunci: 'layanan',
    jalur: 'layanan',
    judul: 'Layanan',
    tabel: 'layanan',
    satuan: 'layanan',
    medanNama: 'judul',
    medan: [
      { nama: 'ikon', label: 'Ikon', jenis: 'ikon', wajib: true },
      { nama: 'judul', label: 'Judul', jenis: 'teks', wajib: true, maks: 120 },
      { nama: 'deskripsi', label: 'Deskripsi', jenis: 'teks-panjang', maks: 500 },
      { nama: 'urutan', label: 'Urutan', jenis: 'angka', min: 0 },
      { nama: 'tampil', label: 'Tampilkan di situs', jenis: 'centang' },
    ],
    sql: 'SELECT id, ikon, judul, deskripsi, urutan, tampil FROM layanan ORDER BY urutan, id',
  },

  {
    kunci: 'pengalaman',
    jalur: 'pengalaman',
    judul: 'Pengalaman',
    tabel: 'pengalaman',
    satuan: 'pengalaman',
    medanNama: 'posisi',
    catatan:
      'Baris paling atas di daftar ini tampil paling atas di garis waktu situs, ' +
      'jadi taruh pekerjaan terbaru di urutan pertama. Kalau tidak ada satu pun ' +
      'baris yang ditampilkan, seluruh bagian Pengalaman -- judul dan pengantarnya ' +
      'sekalian -- tidak dicetak di situs, bukan tampil sebagai judul kosong.',
    medan: [
      {
        nama: 'posisi',
        label: 'Posisi',
        jenis: 'teks',
        wajib: true,
        maks: 120,
        petunjuk: 'Jabatan atau peran. Contoh: Graphic Designer.',
      },
      { nama: 'perusahaan', label: 'Perusahaan', jenis: 'teks', wajib: true, maks: 120 },
      {
        nama: 'lokasi',
        label: 'Lokasi',
        jenis: 'teks',
        maks: 120,
        petunjuk: 'Boleh dikosongkan. Contoh: Surabaya, Indonesia.',
      },
      {
        nama: 'tahun_mulai',
        label: 'Tahun mulai',
        jenis: 'angka',
        wajib: true,
        awal: '',
        min: TAHUN_PALING_AWAL,
        maks: tahunSekarang,
        petunjuk: 'Empat digit, antara ' + TAHUN_PALING_AWAL + ' dan tahun berjalan.',
      },
      {
        nama: 'tahun_selesai',
        label: 'Tahun selesai',
        jenis: 'angka',
        bolehKosong: true,
        awal: '',
        min: TAHUN_PALING_AWAL,
        maks: tahunSekarang,
        petunjuk:
          'Kosongkan kalau pekerjaan ini masih berjalan -- di situs akan ' +
          'tertulis "Sekarang". Kalau diisi, tidak boleh lebih kecil daripada tahun mulai.',
      },
      { nama: 'deskripsi', label: 'Deskripsi', jenis: 'teks-panjang', maks: 800 },
      { nama: 'urutan', label: 'Urutan', jenis: 'angka', min: 0 },
      { nama: 'tampil', label: 'Tampilkan di situs', jenis: 'centang' },
    ],
    sql:
      'SELECT id, posisi, perusahaan, lokasi, tahun_mulai, tahun_selesai, ' +
      'deskripsi, urutan, tampil FROM pengalaman ORDER BY urutan, id',
    // Aturan yang melibatkan DUA medan sekaligus tidak bisa ditulis
    // sebagai aturan satu medan, jadi tempatnya di sini. Batas bawah,
    // batas atas, dan "harus angka bulat" sudah diurus per medan.
    periksaTambahan(nilai) {
      if (nilai.tahun_selesai === null) return null;
      if (nilai.tahun_selesai < nilai.tahun_mulai) {
        return (
          'Tahun selesai (' + nilai.tahun_selesai + ') tidak boleh lebih kecil ' +
          'daripada tahun mulai (' + nilai.tahun_mulai + '). Kosongkan tahun ' +
          'selesai kalau pekerjaannya masih berjalan.'
        );
      }
      return null;
    },
  },

];

// ---------------------------------------------------------------
// Pembantu
// ---------------------------------------------------------------

function medanTersimpan(cfg) {
  return cfg.medan.filter((m) => m.jenis !== 'gambar' || cfg.punyaGambar);
}

// Daftar kolom yang tampil di tabel: medan formulir + kolom tambahan.
function kolomDaftar(cfg) {
  const dariMedan = cfg.medan.map((m) => ({
    kunci: m.nama,
    label: m.label,
    jenis: m.jenis,
    bisaUrut: m.jenis !== 'gambar',
  }));
  return dariMedan.concat(
    (cfg.kolomTambahan || []).map((k) => ({ ...k, bisaUrut: true }))
  );
}

// Baca isi formulir menjadi objek nilai yang bersih.
function bacaForm(cfg, req) {
  const nilai = {};
  for (const m of cfg.medan) {
    if (m.jenis === 'gambar') continue;
    const mentah = req.body[m.nama];
    if (m.jenis === 'centang') {
      nilai[m.nama] = mentah ? 1 : 0;
    } else if (m.jenis === 'angka') {
      const t = String(mentah == null ? '' : mentah).trim();
      // Medan angka biasa menganggap kosong sama dengan 0. Medan
      // bertanda bolehKosong tidak: kosong disimpan sebagai NULL,
      // karena "tidak diisi" dan "nol" adalah dua hal berbeda.
      if (t === '') nilai[m.nama] = m.bolehKosong ? null : 0;
      else nilai[m.nama] = Number(t);
    } else {
      // teks, teks-panjang, ikon, dan pilihan sama-sama disimpan
      // sebagai teks yang sudah dirapikan ujungnya.
      nilai[m.nama] = String(mentah == null ? '' : mentah).trim();
    }
  }
  return nilai;
}

// Kembalikan kalimat kesalahan pertama, atau null kalau semuanya sah.
async function periksaForm(cfg, nilai, idLama) {
  for (const m of cfg.medan) {
    if (m.jenis === 'gambar') continue;
    const v = nilai[m.nama];

    if (m.jenis === 'angka') {
      if (v === null) {
        // Hanya medan bolehKosong yang bisa bernilai null di sini.
        if (m.wajib) return m.label + ' wajib diisi.';
        continue;
      }
      if (!Number.isInteger(v)) return m.label + ' harus berupa angka bulat.';
      const min = batas(m.min);
      const maks = batas(m.maks);
      if (min != null && v < min) return m.label + ' tidak boleh kurang dari ' + min + '.';
      if (maks != null && v > maks) return m.label + ' tidak boleh lebih dari ' + maks + '.';
      continue;
    }

    if (m.jenis === 'pilihan') {
      const sah = m.pilihan.some((p) => p.nilai === v);
      if (!sah) return m.label + ' harus salah satu dari: ' + m.pilihan.map((p) => p.nilai).join(', ') + '.';
      continue;
    }

    if (m.jenis === 'centang') continue;

    if (m.jenis === 'ikon') {
      if (!v) {
        if (m.wajib) return m.label + ' wajib dipilih.';
        continue;
      }
      // Kelasnya harus benar-benar ada di berkas boxicons kita,
      // bukan sekadar berpola mirip.
      if (!ikonSah(v)) return 'Ikon "' + v + '" tidak ada di daftar boxicons.';
      continue;
    }

    // teks dan teks-panjang
    if (m.wajib && !v) return m.label + ' wajib diisi.';
    if (m.maks && v.length > m.maks) return m.label + ' terlalu panjang (maksimal ' + m.maks + ' karakter).';
    if (v && m.pola && !m.pola.test(v)) return m.pesanPola || (m.label + ' tidak sesuai pola yang diizinkan.');

    if (v && m.unik) {
      const baris = await satu(
        'SELECT id FROM ' + cfg.tabel + ' WHERE ' + m.nama + ' = ?',
        [v]
      );
      if (baris && Number(baris.id) !== Number(idLama)) {
        return m.label + ' "' + v + '" sudah dipakai baris lain.';
      }
    }
  }

  // Aturan yang melibatkan lebih dari satu medan. Dijalankan paling
  // akhir, supaya kesalahan yang lebih dasar -- bukan angka, di luar
  // batas -- yang dilaporkan lebih dulu.
  if (cfg.periksaTambahan) {
    const pesan = await cfg.periksaTambahan(nilai);
    if (pesan) return pesan;
  }

  return null;
}

// Baca daftar id dari medan tersembunyi berisi angka dipisah koma.
function bacaDaftarId(mentah) {
  return String(mentah || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[0-9]+$/.test(s))
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0)
    .filter((n, i, arr) => arr.indexOf(n) === i);
}

// multer + CSRF untuk sumber daya yang punya medan gambar.
function terimaForm(cfg) {
  if (!cfg.punyaGambar) return periksaCsrf;
  return function (req, res, next) {
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
  };
}

// ---------------------------------------------------------------
// Rute pengubah status tampil dari dalam tabel
// ---------------------------------------------------------------

// Sakelar di tabel daftar mengirim satu formulir kecil ke sini, lalu
// dikembalikan ke halaman daftarnya. Tidak ada JavaScript yang
// terlibat: ini formulir POST biasa, jadi sakelarnya tetap bekerja
// walau JavaScript dimatikan.
//
// Dipakai dua tempat: sumber daya di berkas ini (Menu, Skill, Logo,
// Layanan, Data Diri) dan halaman Karya yang rutenya ada di
// server.js. Karena itu ia diekspor, bukan ditulis dua kali.
export function pasangRuteTampil(app, opsi) {
  const { dasar, tabel, wajibLogin } = opsi;

  app.post(dasar + '/:id/tampil', wajibLogin, periksaCsrf, async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return next();

    const baris = await satu('SELECT id FROM ' + tabel + ' WHERE id = ?', [id]);
    if (!baris) return next();

    // Server tidak percaya apa pun dari formulir selain dua nilai ini.
    // Apa pun yang bukan '1' dianggap 0, jadi tidak ada cara menulis
    // nilai lain ke kolom tampil.
    const tampil = req.body.tampil === '1' ? 1 : 0;

    await db.execute({
      sql: 'UPDATE ' + tabel + ' SET tampil = ? WHERE id = ?',
      args: [tampil, id],
    });

    // Kalau yang meminta lebih suka JSON daripada HTML -- artinya
    // permintaannya datang dari fetch di admin.js, bukan dari
    // formulir yang dikirim peramban -- jawabannya JSON pendek,
    // tanpa pengalihan. Peramban yang mengirim formulir biasa selalu
    // meminta text/html, jadi jalur di bawahnya tetap persis seperti
    // sebelum tahap 21: pengalihan 302 ke halaman daftar.
    if (req.accepts(['html', 'json']) === 'json') {
      return res.json({ ok: true, tampil });
    }

    return res.redirect(dasar + '?pesan=' + (tampil ? 'tampil-hidup' : 'tampil-mati'));
  });
}

function pesanBerhasil(cfg, q) {
  const n = Number(q.n) || 0;
  switch (q.pesan) {
    case 'tampil-hidup':
      return 'Satu ' + cfg.satuan + ' sekarang tampil di situs.';
    case 'tampil-mati':
      return 'Satu ' + cfg.satuan + ' sekarang disembunyikan dari situs.';
    case 'simpan':
      return 'Perubahan tersimpan.';
    case 'hapus':
      return 'Satu ' + cfg.satuan + ' dihapus.';
    case 'urutan':
      return 'Urutan tersimpan. ' + n + ' baris diperbarui.';
    case 'hapus-banyak':
      return n + ' ' + cfg.satuan + ' dihapus.';
    default:
      return null;
  }
}

// ---------------------------------------------------------------
// Pemasang rute
// ---------------------------------------------------------------

export function pasangSumberAdmin(app, dep) {
  const { halaman, wajibLogin } = dep;

  for (const cfg of SUMBER) {
    const dasar = '/admin/' + cfg.jalur;
    const kolom = kolomDaftar(cfg);
    const simpan = medanTersimpan(cfg).filter((m) => m.jenis !== 'gambar');

    async function ambilBaris() {
      return semua(cfg.sql);
    }

    function nilaiKosong(urutanBerikutnya) {
      const n = {};
      for (const m of cfg.medan) {
        if (m.jenis === 'gambar') n[m.nama] = '';
        else if (m.jenis === 'centang') n[m.nama] = 1;
        // Medan angka yang tidak masuk akal dimulai dari nol --
        // sebuah tahun, misalnya -- boleh menyebut nilai awalnya
        // sendiri lewat m.awal.
        else if (m.jenis === 'angka') {
          if (m.awal !== undefined) n[m.nama] = m.awal;
          else n[m.nama] = m.nama === 'urutan' ? urutanBerikutnya : 0;
        }
        else if (m.jenis === 'pilihan') n[m.nama] = m.pilihan[0].nilai;
        else n[m.nama] = '';
      }
      return n;
    }

    async function tampilkanForm(req, res, opsi) {
      return halaman(req, res, 'sumber-form', {
        judulHalaman: opsi.judulHalaman,
        subJudul: opsi.subJudul || null,
        menuAktif: cfg.kunci,
        cfg: {
          judul: cfg.judul,
          jalur: cfg.jalur,
          // Tampilan menulis min= dan max= sebagai atribut HTML, jadi
          // batas yang berupa fungsi harus sudah jadi angka di sini.
          medan: cfg.medan.map((m) =>
            m.jenis === 'angka' ? { ...m, min: batas(m.min), maks: batas(m.maks) } : m
          ),
          punyaGambar: !!cfg.punyaGambar,
        },
        // Daftar ikon hanya dikirim kalau halaman ini memang punya
        // medan ikon, supaya halaman lain tidak ikut berat.
        ikon: cfg.medan.some((x) => x.jenis === 'ikon') ? IKON : null,
        aksi: opsi.aksi,
        nilai: opsi.nilai,
        kesalahan: opsi.kesalahan || null,
      });
    }

    // ---- daftar ----
    app.get(dasar, wajibLogin, async (req, res) => {
      const baris = await ambilBaris();
      const ringkasan = cfg.ringkasan ? await cfg.ringkasan() : null;

      return halaman(req, res, 'sumber-daftar', {
        judulHalaman: cfg.judul,
        subJudul: baris.length + ' ' + cfg.satuan + ' di database',
        menuAktif: cfg.kunci,
        cfg: {
          judul: cfg.judul,
          jalur: cfg.jalur,
          satuan: cfg.satuan,
          medanNama: cfg.medanNama,
          punyaGambar: !!cfg.punyaGambar,
          catatan: cfg.catatan || null,
          catatanHapus: cfg.catatanHapus || null,
          hapusLewatHalaman: !!cfg.periksaHapus,
        },
        kolom,
        baris,
        ringkasan,
        berhasil: pesanBerhasil(cfg, req.query),
        kesalahan:
          req.query.pesan === 'kosong'
            ? 'Tidak ada baris yang dipilih, jadi tidak ada yang diubah.'
            : null,
      });
    });

    // ---- tambah ----
    app.get(dasar + '/baru', wajibLogin, async (req, res) => {
      const b = await satu('SELECT COALESCE(MAX(urutan), 0) + 1 AS n FROM ' + cfg.tabel);
      return tampilkanForm(req, res, {
        judulHalaman: 'Tambah ' + cfg.satuan,
        aksi: dasar + '/baru',
        nilai: nilaiKosong(Number(b.n)),
      });
    });

    app.post(dasar + '/baru', wajibLogin, terimaForm(cfg), async (req, res) => {
      const nilai = bacaForm(cfg, req);
      const kesalahan = req.kesalahanUnggah || (await periksaForm(cfg, nilai, null));

      if (kesalahan) {
        if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
        res.status(400);
        return tampilkanForm(req, res, {
          judulHalaman: 'Tambah ' + cfg.satuan,
          aksi: dasar + '/baru',
          nilai: { ...nilai, gambar: '' },
          kesalahan,
        });
      }

      const nama = simpan.map((m) => m.nama);
      const args = simpan.map((m) => nilai[m.nama]);
      if (cfg.punyaGambar) {
        nama.push('gambar');
        args.push(req.file ? (req.file.path || (AWALAN_UNGGAH + req.file.filename)) : '');
      }

      await db.execute({
        sql:
          'INSERT INTO ' + cfg.tabel + ' (' + nama.join(', ') + ') VALUES (' +
          nama.map(() => '?').join(', ') + ')',
        args,
      });

      return res.redirect(dasar + '?pesan=simpan');
    });

    // ---- sunting ----
    app.get(dasar + '/:id/sunting', wajibLogin, async (req, res, next) => {
      const baris = await satu('SELECT * FROM ' + cfg.tabel + ' WHERE id = ?', [Number(req.params.id)]);
      if (!baris) return next();
      return tampilkanForm(req, res, {
        judulHalaman: 'Edit ' + cfg.satuan,
        subJudul: String(baris[cfg.medanNama] || ''),
        aksi: dasar + '/' + baris.id + '/sunting',
        nilai: baris,
      });
    });

    app.post(dasar + '/:id/sunting', wajibLogin, terimaForm(cfg), async (req, res, next) => {
      const id = Number(req.params.id);
      const lama = await satu('SELECT * FROM ' + cfg.tabel + ' WHERE id = ?', [id]);
      if (!lama) {
        if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
        return next();
      }

      const nilai = bacaForm(cfg, req);
      const kesalahan = req.kesalahanUnggah || (await periksaForm(cfg, nilai, id));

      if (kesalahan) {
        if (req.file) hapusBerkasUnggahan((req.file.path || (AWALAN_UNGGAH + req.file.filename)));
        res.status(400);
        return tampilkanForm(req, res, {
          judulHalaman: 'Edit ' + cfg.satuan,
          aksi: dasar + '/' + id + '/sunting',
          nilai: { ...nilai, gambar: lama.gambar || '' },
          kesalahan,
        });
      }

      const set = simpan.map((m) => m.nama + ' = ?');
      const args = simpan.map((m) => nilai[m.nama]);

      let gambarBaru = null;
      if (cfg.punyaGambar) {
        // Tanpa unggahan baru, gambar lama tetap dipakai.
        gambarBaru = req.file ? (req.file.path || (AWALAN_UNGGAH + req.file.filename)) : lama.gambar || '';
        set.push('gambar = ?');
        args.push(gambarBaru);
      }
      args.push(id);

      await db.execute({
        sql: 'UPDATE ' + cfg.tabel + ' SET ' + set.join(', ') + ' WHERE id = ?',
        args,
      });

      // Berkas lama dibuang hanya lewat hapusBerkasUnggahan, yang
      // menolak jalur apa pun di luar storage/uploads/.
      if (cfg.punyaGambar && req.file && lama.gambar && lama.gambar !== gambarBaru) {
        hapusBerkasUnggahan(lama.gambar);
      }

      return res.redirect(dasar + '?pesan=simpan');
    });

    // ---- hapus: halaman konfirmasi cadangan (tanpa JavaScript) ----
    app.get(dasar + '/:id/hapus', wajibLogin, async (req, res, next) => {
      const baris = await satu('SELECT * FROM ' + cfg.tabel + ' WHERE id = ?', [Number(req.params.id)]);
      if (!baris) return next();

      const cek = cfg.periksaHapus ? await cfg.periksaHapus(baris) : null;

      return halaman(req, res, 'sumber-hapus', {
        judulHalaman: 'Hapus ' + cfg.satuan + '?',
        subJudul: String(baris[cfg.medanNama] || ''),
        menuAktif: cfg.kunci,
        cfg: {
          judul: cfg.judul,
          jalur: cfg.jalur,
          satuan: cfg.satuan,
          medanNama: cfg.medanNama,
          punyaGambar: !!cfg.punyaGambar,
        },
        kolom,
        baris,
        cek,
        berkasIkutDihapus:
          !!cfg.punyaGambar &&
          typeof baris.gambar === 'string' &&
          baris.gambar.startsWith(AWALAN_UNGGAH),
        kesalahan: req.query.pesan === 'belum-sadar'
          ? 'Centang dulu kotak persetujuannya sebelum menghapus.'
          : null,
      });
    });

    app.post(dasar + '/:id/hapus', wajibLogin, periksaCsrf, async (req, res, next) => {
      const id = Number(req.params.id);
      const baris = await satu('SELECT * FROM ' + cfg.tabel + ' WHERE id = ?', [id]);
      if (!baris) return next();

      // Kalau penghapusan berdampak ke tabel lain, pengguna harus
      // menyatakan sadar lebih dulu.
      if (cfg.periksaHapus) {
        const cek = await cfg.periksaHapus(baris);
        if (cek.perluSadar && req.body.sadar !== '1') {
          return res.redirect(dasar + '/' + id + '/hapus?pesan=belum-sadar');
        }
      }

      await db.execute({ sql: 'DELETE FROM ' + cfg.tabel + ' WHERE id = ?', args: [id] });

      // Hanya berkas unggahan yang ikut dibuang. Gambar milik situs
      // publik di assets/ selalu ditolak oleh hapusBerkasUnggahan.
      if (cfg.punyaGambar) hapusBerkasUnggahan(baris.gambar);

      return res.redirect(dasar + '?pesan=hapus');
    });

    // ---- sakelar tampil dari dalam tabel ----
    // Hanya untuk sumber daya yang memang punya kolom tampil.
    // Kategori tidak punya, jadi rutenya tidak dibuat sama sekali.
    if (cfg.medan.some((m) => m.nama === 'tampil' && m.jenis === 'centang')) {
      pasangRuteTampil(app, { dasar, tabel: cfg.tabel, wajibLogin });
    }

    // ---- simpan urutan hasil seret ----
    app.post(dasar + '/urutan', wajibLogin, periksaCsrf, async (req, res) => {
      const ids = bacaDaftarId(req.body.ids);
      if (ids.length === 0) return res.redirect(dasar + '?pesan=kosong');

      const tx = await db.transaction('write');
      let diubah = 0;
      try {
        for (const [i, id] of ids.entries()) {
          const hasil = await tx.execute({
            sql: 'UPDATE ' + cfg.tabel + ' SET urutan = ? WHERE id = ?',
            args: [i + 1, id],
          });
          diubah += Number(hasil.rowsAffected || 0);
        }
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }

      return res.redirect(dasar + '?pesan=urutan&n=' + diubah);
    });

    // ---- hapus banyak ----
    app.post(dasar + '/hapus-banyak', wajibLogin, periksaCsrf, async (req, res) => {
      const ids = bacaDaftarId(req.body.ids);
      if (ids.length === 0) return res.redirect(dasar + '?pesan=kosong');

      const tanda = ids.map(() => '?').join(',');
      const barisnya = await semua(
        'SELECT * FROM ' + cfg.tabel + ' WHERE id IN (' + tanda + ')',
        ids
      );

      const tx = await db.transaction('write');
      let terhapus = 0;
      try {
        for (const id of ids) {
          const hasil = await tx.execute({
            sql: 'DELETE FROM ' + cfg.tabel + ' WHERE id = ?',
            args: [id],
          });
          terhapus += Number(hasil.rowsAffected || 0);
        }
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }

      if (cfg.punyaGambar) {
        for (const b of barisnya) hapusBerkasUnggahan(b.gambar);
      }

      return res.redirect(dasar + '?pesan=hapus-banyak&n=' + terhapus);
    });
  }
}
