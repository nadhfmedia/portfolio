// Pengaturan unggah gambar memakai multer.
// Berkas disimpan di Cloudinary jika CLOUDINARY_URL ada.
// Jika tidak ada, disimpan di storage/uploads/ lokal.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export const FOLDER_UNGGAH = path.join(ROOT, 'storage', 'uploads');
export const AWALAN_UNGGAH = 'uploads/';

const PAKE_CLOUDINARY = Boolean(process.env.CLOUDINARY_URL);

if (!PAKE_CLOUDINARY) {
  fs.mkdirSync(FOLDER_UNGGAH, { recursive: true });
} else {
  // Jika pakai Cloudinary, konfigurasi sudah otomatis terbaca dari CLOUDINARY_URL
  cloudinary.config({
    // env var CLOUDINARY_URL otomatis dipakai oleh SDK
  });
}

// Jenis berkas yang diterima: ekstensi dan tipe MIME harus sama-sama cocok.
const JENIS_DITERIMA = new Map([
  ['.jpg', ['image/jpeg']],
  ['.jpeg', ['image/jpeg']],
  ['.png', ['image/png']],
  ['.webp', ['image/webp']],
  ['.gif', ['image/gif']],
]);

export const BATAS_BYTE = 5 * 1024 * 1024; // 5 MB

const penyimpanLokal = multer.diskStorage({
  destination(req, file, selesai) {
    selesai(null, FOLDER_UNGGAH);
  },
  filename(req, file, selesai) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const aman = JENIS_DITERIMA.has(ext) ? ext : '';
    selesai(null, crypto.randomBytes(16).toString('hex') + aman);
  },
});

const penyimpanCloudinary = PAKE_CLOUDINARY ? new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // ekstensi tidak perlu disertakan di public_id, Cloudinary otomatis menambahkannya dari format
    return {
      folder: 'nadhiful-portfolio',
      public_id: crypto.randomBytes(16).toString('hex'),
      format: 'webp',
      transformation: [{ quality: 'auto', fetch_format: 'webp' }]
    };
  },
}) : null;

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
  storage: PAKE_CLOUDINARY ? penyimpanCloudinary : penyimpanLokal,
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

// ---------------------------------------------------------------
// Video karya
//
// Video TIDAK lewat server ini: permintaan ke fungsi serverless
// Vercel dibatasi sekitar 4,5 MB, jauh lebih kecil dari sebuah video.
// Jadi peramban mengunggah langsung ke Cloudinary memakai tanda
// tangan yang dibuat di sini, lalu hanya mengirim alamat hasilnya
// ke server lewat formulir karya.
// ---------------------------------------------------------------

export const BATAS_BYTE_VIDEO = 100 * 1024 * 1024; // 100 MB (batas paket gratis Cloudinary)
export const VIDEO_DITERIMA = ['mp4', 'webm', 'mov'];
const FOLDER_VIDEO = 'nadhiful-portfolio/video';

// Parameter untuk unggah langsung dari peramban, atau null kalau
// Cloudinary tidak dipakai (video butuh Cloudinary).
export function tandaTanganVideo() {
  if (!PAKE_CLOUDINARY) return null;
  const cfg = cloudinary.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) return null;

  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { folder: FOLDER_VIDEO, timestamp },
    cfg.api_secret
  );
  return {
    url: 'https://api.cloudinary.com/v1_1/' + cfg.cloud_name + '/video/upload',
    api_key: cfg.api_key,
    timestamp,
    folder: FOLDER_VIDEO,
    signature,
    maks_byte: BATAS_BYTE_VIDEO,
  };
}

// Alamat video yang dikirim formulir hanya diterima kalau benar-benar
// milik akun Cloudinary ini, supaya admin tidak bisa (atau tidak
// sengaja) menyimpan alamat sembarang.
export function videoSah(url) {
  if (typeof url !== 'string' || !PAKE_CLOUDINARY) return false;
  const nama = cloudinary.config().cloud_name;
  if (!nama) return false;
  const pola = new RegExp(
    '^https://res\\.cloudinary\\.com/' + nama.replace(/[^A-Za-z0-9_-]/g, '') +
    '/video/upload/[A-Za-z0-9._/-]+\\.(' + VIDEO_DITERIMA.join('|') + ')$',
    'i'
  );
  return pola.test(url);
}

// Hapus video di Cloudinary. Kegagalan tidak boleh menggagalkan
// penyimpanan karya, jadi hasilnya cukup true/false.
export async function hapusVideo(url) {
  if (!PAKE_CLOUDINARY || typeof url !== 'string' || !url) return false;
  try {
    const m = url.match(/\/video\/upload\/(?:v\d+\/)?(.+)\.[A-Za-z0-9]+$/);
    if (!m) return false;
    await cloudinary.uploader.destroy(m[1], { resource_type: 'video' });
    return true;
  } catch (e) {
    console.error('Gagal hapus video di Cloudinary:', e);
    return false;
  }
}

// Hapus berkas unggahan. 
export async function hapusBerkasUnggahan(jalurDb) {
  if (typeof jalurDb !== 'string') return false;

  // Jika jalurDb adalah URL Cloudinary
  if (PAKE_CLOUDINARY && jalurDb.includes('cloudinary.com')) {
    try {
      // Ambil bagian path terakhir tanpa ekstensi
      // Contoh: https://res.cloudinary.com/.../nadhiful-portfolio/abcde.jpg
      const parts = jalurDb.split('/');
      const namaFile = parts[parts.length - 1]; // abcde.jpg
      const folder = parts[parts.length - 2];   // nadhiful-portfolio
      const id = namaFile.split('.')[0];
      const public_id = `${folder}/${id}`;
      
      await cloudinary.uploader.destroy(public_id);
      return true;
    } catch (e) {
      console.error('Gagal hapus gambar di Cloudinary:', e);
      return false;
    }
  }

  // Jika lokal
  if (!jalurDb.startsWith(AWALAN_UNGGAH)) return false;

  const namaBerkas = path.basename(jalurDb);
  const penuh = path.join(FOLDER_UNGGAH, namaBerkas);

  if (path.dirname(path.resolve(penuh)) !== path.resolve(FOLDER_UNGGAH)) return false;

  try {
    fs.unlinkSync(penuh);
    return true;
  } catch {
    return false;
  }
}
