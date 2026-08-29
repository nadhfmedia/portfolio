// Data untuk halaman Dashboard.
//
// Semua angka dihitung langsung dari database saat halaman dibuka,
// tidak ada yang disimpan atau di-cache. Panel Periksa sengaja hanya
// mengembalikan butir yang BENAR-BENAR bermasalah, supaya daftarnya
// pendek dan setiap barisnya berarti.

import { satu, semua } from './db.js';

const JUMLAH_TERBARU = 5;

// ---------------------------------------------------------------
// Kueri panel periksa
// ---------------------------------------------------------------

// Tiap butir: kueri penghitung, kalimatnya, dan ke mana harus menuju.
// Kalau hitungannya nol, butirnya tidak ditampilkan sama sekali.
const PERIKSA = [
  {
    kunci: 'karya_sembunyi',
    sql: 'SELECT COUNT(*) AS n FROM karya WHERE tampil = 0',
    kalimat: (n) => n + ' karya disembunyikan dari situs',
    saran: 'Karya ini tidak muncul di portofolio publik.',
    tautan: '/admin/karya',
    ikon: 'bx-hide',
  },
  {
    kunci: 'karya_tanpa_gambar',
    sql: "SELECT COUNT(*) AS n FROM karya WHERE gambar IS NULL OR TRIM(gambar) = ''",
    kalimat: (n) => n + ' karya tanpa gambar',
    saran: 'Petak portofolio akan kosong di tempat gambarnya.',
    tautan: '/admin/karya',
    ikon: 'bx-image',
  },
  {
    kunci: 'karya_tanpa_kategori',
    sql: 'SELECT COUNT(*) AS n FROM karya WHERE kategori_id IS NULL',
    kalimat: (n) => n + ' karya tanpa kategori',
    saran: 'Karya ini tidak akan muncul saat pengunjung menekan tombol filter mana pun.',
    tautan: '/admin/karya',
    ikon: 'bx-purchase-tag',
  },
  {
    kunci: 'kategori_kosong',
    sql:
      'SELECT COUNT(*) AS n FROM kategori k ' +
      'WHERE NOT EXISTS (SELECT 1 FROM karya WHERE kategori_id = k.id)',
    kalimat: (n) => n + ' kategori belum punya karya',
    saran: 'Tombol filternya ada di situs, tapi tidak menampilkan apa-apa saat ditekan.',
    tautan: '/admin/kategori',
    ikon: 'bx-collection',
  },
  {
    kunci: 'pengalaman_sembunyi',
    sql: 'SELECT COUNT(*) AS n FROM pengalaman WHERE tampil = 0',
    kalimat: (n) => n + ' pengalaman disembunyikan',
    saran: 'Butir ini tidak muncul di garis waktu Experience.',
    tautan: '/admin/pengalaman',
    ikon: 'bx-briefcase-alt',
  },
  {
    kunci: 'skill_sembunyi',
    sql: 'SELECT COUNT(*) AS n FROM skill WHERE tampil = 0',
    kalimat: (n) => n + ' skill disembunyikan',
    saran: null,
    tautan: '/admin/skill',
    ikon: 'bx-bar-chart-alt-2',
  },
  {
    kunci: 'layanan_sembunyi',
    sql: 'SELECT COUNT(*) AS n FROM layanan WHERE tampil = 0',
    kalimat: (n) => n + ' layanan disembunyikan',
    saran: null,
    tautan: '/admin/layanan',
    ikon: 'bx-briefcase',
  },
  {
    kunci: 'logo_sembunyi',
    sql: 'SELECT COUNT(*) AS n FROM logo WHERE tampil = 0',
    kalimat: (n) => n + ' logo disembunyikan',
    saran: null,
    tautan: '/admin/logo',
    ikon: 'bx-palette',
  },
  {
    kunci: 'menu_sembunyi',
    sql: 'SELECT COUNT(*) AS n FROM menu WHERE tampil = 0',
    kalimat: (n) => n + ' butir menu disembunyikan',
    saran: null,
    tautan: '/admin/menu',
    ikon: 'bx-menu',
  },
  {
    // Menggantikan butir data_diri_sembunyi. Tabel data_diri dihapus di
    // tahap 23C; keempat butir About sekarang tersimpan di tabel profil,
    // dan yang "disembunyikan" berarti nilainya kosong -- butir kosong
    // memang tidak dicetak di bagian About.
    kunci: 'data_diri_kosong',
    sql:
      "SELECT COUNT(*) AS n FROM profil WHERE kunci IN " +
      "('profil_teks', 'tanggal_lahir', 'email', 'telepon', 'gender') " +
      "AND (nilai IS NULL OR TRIM(nilai) = '')",
    kalimat: (n) => n + ' medan Data Diri masih kosong',
    saran: 'Butir yang kosong tidak dicetak di bagian About.',
    tautan: '/admin/data-diri',
    ikon: 'bx-user',
  },
  {
    kunci: 'karya_tanpa_tanggal',
    sql: 'SELECT COUNT(*) AS n FROM karya WHERE dibuat_pada IS NULL',
    kalimat: (n) => n + ' karya belum punya tanggal unggah',
    saran: 'Karya ini sudah ada sebelum tanggal unggah mulai dicatat.',
    tautan: '/admin/karya',
    ikon: 'bx-calendar',
  },
  {
    kunci: 'teks_kosong',
    sql: "SELECT COUNT(*) AS n FROM profil WHERE nilai IS NULL OR TRIM(nilai) = ''",
    kalimat: (n) => n + ' teks situs masih kosong',
    saran: 'Bagian yang memakainya akan tampil tanpa tulisan.',
    tautan: '/admin/teks',
    ikon: 'bx-text',
  },
];

// Tahun hak cipta diperiksa terpisah karena pembandingnya tahun
// berjalan, bukan sekadar hitungan baris.
async function periksaTahun() {
  const baris = await satu("SELECT nilai FROM profil WHERE kunci = 'footer_tahun'");
  if (!baris) return null;

  const tersimpan = String(baris.nilai || '').trim();
  const sekarang = String(new Date().getFullYear());
  if (tersimpan === sekarang) return null;

  return {
    kunci: 'tahun_copyright',
    kalimat: 'Tahun hak cipta di footer masih ' + (tersimpan || 'kosong'),
    saran: 'Tahun berjalan sekarang ' + sekarang + '.',
    tautan: '/admin/teks',
    ikon: 'bx-calendar-x',
  };
}

export async function jalankanPeriksa() {
  const hasil = [];

  for (const p of PERIKSA) {
    const r = await satu(p.sql);
    const n = Number(r.n);
    if (n > 0) {
      hasil.push({
        kunci: p.kunci,
        kalimat: p.kalimat(n),
        saran: p.saran,
        tautan: p.tautan,
        ikon: p.ikon,
      });
    }
  }

  const tahun = await periksaTahun();
  if (tahun) hasil.push(tahun);

  return hasil;
}

// ---------------------------------------------------------------
// Data tampilan lainnya
// ---------------------------------------------------------------

export async function ambilDashboard() {
  const karyaTotal = Number((await satu('SELECT COUNT(*) AS n FROM karya')).n);
  const karyaTayang = Number((await satu('SELECT COUNT(*) AS n FROM karya WHERE tampil = 1')).n);
  const pesanBelum = Number(
    (await satu('SELECT COUNT(*) AS n FROM pesan WHERE sudah_dibaca = 0')).n
  );
  const jumlahKategori = Number((await satu('SELECT COUNT(*) AS n FROM kategori')).n);
  const jumlahLayanan = Number((await satu('SELECT COUNT(*) AS n FROM layanan')).n);

  const kartu = [
    {
      label: 'Karya tayang',
      angka: karyaTayang + ' dari ' + karyaTotal,
      ikon: 'bx-images',
      tautan: '/admin/karya',
    },
    {
      label: 'Pesan belum dibaca',
      angka: String(pesanBelum),
      ikon: 'bx-envelope',
      tautan: '/admin/pesan',
    },
    {
      label: 'Kategori',
      angka: String(jumlahKategori),
      ikon: 'bx-purchase-tag',
      tautan: '/admin/kategori',
    },
    {
      label: 'Layanan',
      angka: String(jumlahLayanan),
      ikon: 'bx-briefcase',
      tautan: '/admin/layanan',
    },
  ];

  // Grafik karya per kategori. Kategori tanpa karya tetap ikut,
  // supaya kelihatan mana yang kosong.
  const kategoriMentah = await semua(
    'SELECT k.id, k.nama, ' +
      '(SELECT COUNT(*) FROM karya WHERE kategori_id = k.id) AS jumlah ' +
      'FROM kategori k ORDER BY k.urutan, k.id'
  );
  const tanpaKategori = Number(
    (await satu('SELECT COUNT(*) AS n FROM karya WHERE kategori_id IS NULL')).n
  );

  const grafikKategori = kategoriMentah.map((k) => ({
    nama: k.nama,
    jumlah: Number(k.jumlah),
    persen: karyaTotal === 0 ? 0 : Math.round((Number(k.jumlah) / karyaTotal) * 100),
  }));
  if (tanpaKategori > 0) {
    grafikKategori.push({
      nama: 'Tanpa kategori',
      jumlah: tanpaKategori,
      persen: karyaTotal === 0 ? 0 : Math.round((tanpaKategori / karyaTotal) * 100),
      sisa: true,
    });
  }

  const grafikSkill = (
    await semua('SELECT nama, persen, kolom, tampil FROM skill ORDER BY urutan, id')
  ).map((s) => ({
    nama: s.nama,
    persen: Math.max(0, Math.min(100, Number(s.persen) || 0)),
    kolom: s.kolom,
    tampil: Number(s.tampil) === 1,
  }));

  // Diurutkan menurut tanggal unggah. Karya lama yang tanggalnya
  // belum tercatat tetap ikut, hanya ditempatkan di belakang —
  // (dibuat_pada IS NULL) bernilai 1 untuk yang kosong, jadi mereka
  // turun ke bawah tanpa terbuang dari daftar.
  const karyaTerbaru = await semua(
    'SELECT k.id, k.judul, k.gambar, k.tampil, k.dibuat_pada, kt.nama AS kategori_nama ' +
      'FROM karya k LEFT JOIN kategori kt ON kt.id = k.kategori_id ' +
      'ORDER BY (k.dibuat_pada IS NULL), k.dibuat_pada DESC, k.id DESC ' +
      'LIMIT ' + JUMLAH_TERBARU
  );

  // Daftar pesan terbaru dulu diambil di sini untuk satu kartu di
  // Dashboard. Sekarang isinya ada di lonceng pemberitahuan, yang
  // datanya disiapkan sekali untuk SEMUA halaman panel oleh
  // ambilPesanLonceng() di src/pesan-masuk.js -- jadi kueri di sini
  // dibuang supaya tidak dijalankan dua kali di halaman yang sama.

  const periksa = await jalankanPeriksa();

  return { kartu, grafikKategori, grafikSkill, karyaTerbaru, periksa, karyaTotal };
}
