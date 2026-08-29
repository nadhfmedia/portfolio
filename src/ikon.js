// Daftar kelas ikon boxicons, dibaca langsung dari berkas CSS
// salinan kita sendiri di admin-assets/boxicons/.
//
// Sumbernya berkas yang sama yang dimuat peramban, jadi tidak mungkin
// ada kelas yang ditawarkan tapi ternyata tidak punya gambar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BERKAS_CSS = path.join(
  __dirname,
  '..',
  'admin-assets',
  'boxicons',
  'css',
  'boxicons.min.css'
);

// Dibaca sekali saat server menyala, bukan tiap permintaan.
function bacaSemua() {
  const css = fs.readFileSync(BERKAS_CSS, 'utf8');
  const cocok = css.match(/\.bx[sl]?-[a-z0-9-]+:before/g) || [];
  const nama = cocok.map((s) => s.slice(1, s.indexOf(':')));
  return Array.from(new Set(nama)).sort();
}

const SEMUA = bacaSemua();

// Dikelompokkan menurut gayanya supaya pemilihnya bisa disaring.
export const IKON = {
  garis: SEMUA.filter((n) => n.startsWith('bx-')),
  padat: SEMUA.filter((n) => n.startsWith('bxs-')),
  merek: SEMUA.filter((n) => n.startsWith('bxl-')),
};

export const JUMLAH_IKON = {
  garis: IKON.garis.length,
  padat: IKON.padat.length,
  merek: IKON.merek.length,
  total: SEMUA.length,
};

// Kelas ikon yang dipakai di database berbentuk "bx bx-user":
// awalan keluarga "bx", lalu nama ikonnya.
export function kelasLengkap(nama) {
  return 'bx ' + nama;
}

// Ambil nama ikon dari nilai yang tersimpan, mis. "bx bxs-vector"
// menjadi "bxs-vector".
export function namaDariKelas(kelas) {
  const bagian = String(kelas || '').trim().split(/\s+/);
  return bagian.find((b) => /^bx[sl]?-/.test(b)) || '';
}

// Apakah kelas yang dikirim benar-benar ada di berkas CSS?
export function ikonSah(kelas) {
  const nama = namaDariKelas(kelas);
  return nama !== '' && SEMUA.includes(nama);
}

export default SEMUA;
