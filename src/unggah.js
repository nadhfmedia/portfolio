// Pengaturan unggah gambar memakai multer.
// Berkas disimpan di storage/uploads/ dengan nama acak, bukan nama
// asli dari pengguna, supaya tidak bisa dipakai menimpa berkas lain
// atau menyelipkan jalur.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export const FOLDER_UNGGAH = path.join(ROOT, 'storage', 'uploads');

// Awalan jalur yang disimpan di kolom gambar untuk berkas unggahan.
// Karya lama tetap memakai awalan assets/img/portfolio/ dan tidak diubah.
export const AWALAN_UNGGAH = 'uploads/';

fs.mkdirSync(FOLDER_UNGGAH, { recursive: true });

// Jenis berkas yang diterima: ekstensi dan tipe MIME harus sama-sama cocok.
const JENIS_DITERIMA = new Map([
  ['.jpg', ['image/jpeg']],
  ['.jpeg', ['image/jpeg']],
  ['.png', ['image/png']],
  ['.webp', ['image/webp']],
  ['.gif', ['image/gif']],
]);

export const BATAS_BYTE = 5 * 1024 * 1024; // 5 MB

const penyimpan = multer.diskStorage({
  destination(req, file, selesai) {
    selesai(null, FOLDER_UNGGAH);
  },
  filename(req, file, selesai) {
    // Nama asli dibuang sepenuhnya; hanya ekstensinya yang dipakai,
    // itu pun setelah dicocokkan dengan daftar yang diizinkan.
    const ext = path.extname(file.originalname || '').toLowerCase();
    const aman = JENIS_DITERIMA.has(ext) ? ext : '';
    selesai(null, crypto.randomBytes(16).toString('hex') + aman);
  },
});

function saring(req, file, selesai) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mimeSah = JENIS_DITERIMA.get(ext);
  if (!mimeSah || !mimeSah.includes(file.mimetype)) {
    const e = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
    e.pesanRamah = 'Jenis berkas tidak didukung. Pakai jpg, jpeg, png, webp, atau gif.';
    return selesai(e);
  }
  return selesai(null, true);
}

export const unggah = multer({
  storage: penyimpan,
  fileFilter: saring,
  limits: { fileSize: BATAS_BYTE, files: 1 },
});

// Ubah error multer menjadi kalimat yang bisa dibaca pengguna.
export function pesanUnggah(err) {
  if (err && err.pesanRamah) return err.pesanRamah;
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return 'Gambar terlalu besar. Ukuran maksimal 5 MB.';
    return 'Gambar gagal diunggah (' + err.code + ').';
  }
  return 'Gambar gagal diunggah.';
}

// Hapus berkas unggahan. Hanya berlaku untuk berkas di storage/uploads/;
// gambar milik situs publik di assets/ tidak pernah disentuh.
export function hapusBerkasUnggahan(jalurDb) {
  if (typeof jalurDb !== 'string' || !jalurDb.startsWith(AWALAN_UNGGAH)) return false;

  const namaBerkas = path.basename(jalurDb);
  const penuh = path.join(FOLDER_UNGGAH, namaBerkas);

  // Pastikan hasil gabungan benar-benar berada di dalam folder unggahan.
  if (path.dirname(path.resolve(penuh)) !== path.resolve(FOLDER_UNGGAH)) return false;

  try {
    fs.unlinkSync(penuh);
    return true;
  } catch {
    return false;
  }
}
