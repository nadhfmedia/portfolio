// Skrip sekali jalan: mengisi tanggal untuk karya yang belum punya.
//
// Jalankan dengan: npm run isi-tanggal
//
// PERINGATAN. Tanggal asli 23 karya lama TIDAK diketahui. Skrip ini
// mengisinya dengan waktu saat dijalankan, jadi sesudah ini semuanya
// akan tampak diunggah pada hari yang sama. Pemilik situs meminta ini
// secara sadar; tanda "tanggal tidak diketahui" memang hilang.
//
// Sengaja BUKAN bagian dari seed dan BUKAN dijalankan otomatis saat
// server menyala, supaya pengisian tanggal tidak pernah terjadi tanpa
// seseorang memutuskannya.
//
// Aman dijalankan berulang: hanya baris yang dibuat_pada-nya NULL
// atau kosong yang disentuh. Baris yang sudah bertanggal — termasuk
// karya baru yang tanggalnya benar — tidak pernah ditimpa.

import db, { semua, satu } from '../src/db.js';
import { sekarangUntukDb, tanggalIndonesia } from '../src/tanggal.js';

const KOSONG = "dibuat_pada IS NULL OR TRIM(dibuat_pada) = ''";

const sebelum = Number((await satu('SELECT COUNT(*) AS n FROM karya WHERE ' + KOSONG)).n);
const total = Number((await satu('SELECT COUNT(*) AS n FROM karya')).n);

console.log('Karya seluruhnya      : ' + total);
console.log('Belum punya tanggal   : ' + sebelum);

if (sebelum === 0) {
  console.log('');
  console.log('Tidak ada yang perlu diisi. Tidak ada baris yang disentuh.');
  process.exit(0);
}

const waktu = sekarangUntukDb();

const hasil = await db.execute({
  sql: 'UPDATE karya SET dibuat_pada = ? WHERE ' + KOSONG,
  args: [waktu],
});

const sesudah = Number((await satu('SELECT COUNT(*) AS n FROM karya WHERE ' + KOSONG)).n);

console.log('');
console.log('Diisi dengan          : ' + waktu + '  (' + tanggalIndonesia(waktu) + ')');
console.log('Baris yang diperbarui : ' + Number(hasil.rowsAffected || 0));
console.log('Sisa yang masih kosong: ' + sesudah);

const contoh = await semua('SELECT id, judul, dibuat_pada FROM karya ORDER BY id LIMIT 3');
console.log('');
console.log('Tiga baris pertama:');
for (const k of contoh) {
  console.log('  id=' + k.id + '  ' + String(k.judul).padEnd(20) + ' ' + k.dibuat_pada);
}
