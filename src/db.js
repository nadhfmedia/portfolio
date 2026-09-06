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

  // Tahap 24. Tabel pengalaman sendiri TIDAK diurus di sini: ia
  // seluruhnya tabel baru, dan CREATE TABLE IF NOT EXISTS di
  // schema.sql sudah menambahkannya ke database lama maupun baru.
  // Yang tidak ikut terbawa adalah tiga kunci teksnya di tabel
  // profil -- profil sudah terlanjur berisi di database yang ada,
  // dan schema.sql tidak pernah menyentuh isi tabel.
  //
  // INSERT OR IGNORE aman diulang: kolom kunci bertanda UNIQUE, jadi
  // baris yang sudah ada dilewati begitu saja dan nilai yang sudah
  // disunting pemilik TIDAK pernah tertimpa kembali ke nilai awal.
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
