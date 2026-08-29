CREATE TABLE IF NOT EXISTS kategori (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nama          TEXT NOT NULL,
  kelas_filter  TEXT NOT NULL UNIQUE,
  urutan        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS karya (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  judul        TEXT NOT NULL,
  subjudul     TEXT,
  gambar       TEXT NOT NULL,
  kategori_id  INTEGER REFERENCES kategori(id) ON DELETE SET NULL,
  urutan       INTEGER NOT NULL DEFAULT 0,
  tampil       INTEGER NOT NULL DEFAULT 1,
  dibuat_pada  TEXT
);

CREATE TABLE IF NOT EXISTS layanan (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ikon       TEXT NOT NULL,
  judul      TEXT NOT NULL,
  deskripsi  TEXT,
  urutan     INTEGER NOT NULL DEFAULT 0,
  tampil     INTEGER NOT NULL DEFAULT 1
);

-- Pengalaman kerja (tahap 24). Ditampilkan sebagai garis waktu di
-- antara bagian About dan Skills, terbaru di atas.
--
-- tahun_selesai sengaja BOLEH NULL, dan hanya kolom ini yang boleh:
-- NULL berarti pekerjaannya masih berjalan, dan situs publik
-- menuliskannya sebagai "Sekarang". Nol atau string kosong tidak
-- dipakai sebagai penanda itu, supaya tidak ada nilai yang artinya
-- bergantung pada tebakan.
CREATE TABLE IF NOT EXISTS pengalaman (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  posisi         TEXT NOT NULL,
  perusahaan     TEXT NOT NULL,
  lokasi         TEXT NOT NULL DEFAULT '',
  tahun_mulai    INTEGER NOT NULL,
  tahun_selesai  INTEGER,
  deskripsi      TEXT,
  urutan         INTEGER NOT NULL DEFAULT 0,
  tampil         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS skill (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nama    TEXT NOT NULL,
  persen  INTEGER NOT NULL,
  kolom   TEXT NOT NULL CHECK (kolom IN ('kiri', 'kanan')),
  urutan  INTEGER NOT NULL DEFAULT 0,
  tampil  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS logo (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  gambar  TEXT NOT NULL,
  nama    TEXT NOT NULL DEFAULT '',
  urutan  INTEGER NOT NULL DEFAULT 0,
  tampil  INTEGER NOT NULL DEFAULT 1
);

-- Tabel data_diri dihapus di tahap 23C. Keempat butir bagian About
-- (Birth Date, Email, Phone Number, Gender) beserta paragraf Profile
-- dan foto About sekarang tersimpan sebagai kunci di tabel profil,
-- disunting di satu halaman: /admin/data-diri.

CREATE TABLE IF NOT EXISTS menu (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  label   TEXT NOT NULL,
  tautan  TEXT NOT NULL,
  urutan  INTEGER NOT NULL DEFAULT 0,
  tampil  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS profil (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  kunci  TEXT NOT NULL UNIQUE,
  nilai  TEXT
);

CREATE TABLE IF NOT EXISTS pesan (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nama          TEXT NOT NULL,
  email         TEXT NOT NULL,
  subjek        TEXT,
  isi           TEXT NOT NULL,
  sudah_dibaca  INTEGER NOT NULL DEFAULT 0,
  dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sesi (
  sid          TEXT PRIMARY KEY,
  data         TEXT NOT NULL,
  kedaluwarsa  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pengguna (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL UNIQUE,
  nama         TEXT NOT NULL,
  hash_sandi   TEXT NOT NULL,
  foto         TEXT NOT NULL DEFAULT '',
  dibuat_pada  TEXT NOT NULL DEFAULT (datetime('now'))
);
