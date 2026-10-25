import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Alamat database. Di lokal memakai berkas data/portfolio.db,
// di server bisa diarahkan ke libsql/Turso lewat DATABASE_URL.
const DB_URL = process.env.DATABASE_URL || 'file:data/portfolio.db';

// Pastikan folder data/ ada, tapi JANGAN membuat atau menimpa
// berkas databasenya sendiri.
if (DB_URL.startsWith('file:')) {
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
}

const db = createClient({ url: DB_URL, authToken: process.env.DATABASE_AUTH_TOKEN });

await db.execute('PRAGMA foreign_keys = ON');

// Jalankan src/schema.sql. Semua pernyataan di sana memakai
// CREATE TABLE IF NOT EXISTS sehingga data lama tetap aman.
export async function applySchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const pernyataan = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const p of pernyataan) {
    await db.execute(p);
  }
  await migrasi();
}

// CREATE TABLE IF NOT EXISTS tidak menambah kolom baru ke tabel
// yang sudah terlanjur ada, jadi kolom tambahan diurus di sini.
async function migrasi() {
  const kolomLogo = await db.execute('PRAGMA table_info(logo)');
  const punyaNama = kolomLogo.rows.some((r) => r.name === 'nama');
  if (!punyaNama) {
    await db.execute("ALTER TABLE logo ADD COLUMN nama TEXT NOT NULL DEFAULT ''");
  }

  // Karya lama tidak punya tanggal dan tanggal aslinya tidak
  // diketahui, jadi kolomnya sengaja TANPA nilai bawaan: baris yang
  // sudah ada tetap NULL, bukan diisi tanggal karangan.
  const kolomKarya = await db.execute('PRAGMA table_info(karya)');
  const punyaTanggal = kolomKarya.rows.some((r) => r.name === 'dibuat_pada');
  if (!punyaTanggal) {
    await db.execute('ALTER TABLE karya ADD COLUMN dibuat_pada TEXT');
  }

  // Video karya (alamat Cloudinary). Kosong berarti karya ini hanya
  // gambar, jadi baris lama tetap seperti semula.
  if (!kolomKarya.rows.some((r) => r.name === 'video')) {
    await db.execute("ALTER TABLE karya ADD COLUMN video TEXT NOT NULL DEFAULT ''");
  }

  // Bagian Skills sudah dihapus dari situs, jadi butir menu yang
  // menautkannya ikut dibuang supaya tidak mengarah ke bagian kosong.
  await db.execute("DELETE FROM menu WHERE tautan = '#skills'");

  // Sesuaikan urutan menu dengan urutan segmen landing page baru
  // (Home -> Portfolio -> Services -> About -> Experience -> Contact)
  // sekali saja, ditandai di tabel profil supaya tidak menimpa kalau
  // pemilik nanti mengubah urutan menu lagi lewat panel.
  const penandaMenu = await db.execute(
    "SELECT nilai FROM profil WHERE kunci = 'migrasi_urutan_menu_v2'"
  );
  if (penandaMenu.rows.length === 0) {
    const urutanBaru = [
      ['/', 1],
      ['#portfolio', 2],
      ['#services', 3],
      ['#about', 4],
      ['#experience', 5],
      ['#contact', 6],
    ];
    for (const [tautan, urutan] of urutanBaru) {
      await db.execute({
        sql: 'UPDATE menu SET urutan = ? WHERE tautan = ?',
        args: [urutan, tautan],
      });
    }
    await db.execute(
      "INSERT OR IGNORE INTO profil (kunci, nilai) VALUES ('migrasi_urutan_menu_v2', '1')"
    );
  }

  const TEKS_PENGALAMAN = [
    ['bagian_pengalaman_judul', 'Experience'],
    ['bagian_pengalaman_subjudul', 'My Work [Experience]'],
    ['bagian_pengalaman_teks', 'The roles I have taken on so far, starting from the most recent.'],
  ];
  for (const [kunci, nilai] of TEKS_PENGALAMAN) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO profil (kunci, nilai) VALUES (?, ?)',
      args: [kunci, nilai],
    });
  }

  const kolomPengguna = await db.execute('PRAGMA table_info(pengguna)');
  const punyaFoto = kolomPengguna.rows.some((r) => r.name === 'foto');
  if (!punyaFoto) {
    await db.execute("ALTER TABLE pengguna ADD COLUMN foto TEXT NOT NULL DEFAULT ''");
  }
}

// Pembantu: kembalikan semua baris sebagai objek biasa.
export async function semua(sql, args = []) {
  const hasil = await db.execute({ sql, args });
  return hasil.rows.map((r) => ({ ...r }));
}

// Pembantu: kembalikan satu baris, atau undefined kalau kosong.
export async function satu(sql, args = []) {
  const baris = await semua(sql, args);
  return baris[0];
}

// Pembantu: hitung jumlah baris sebuah tabel.
export async function hitung(tabel) {
  const r = await satu('SELECT COUNT(*) AS n FROM ' + tabel);
  return Number(r.n);
}

export { DB_URL };
export default db;
