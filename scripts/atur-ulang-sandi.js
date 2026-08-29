// Atur ulang sandi lewat terminal, untuk keadaan lupa sandi.
//
// Jalankan dengan: npm run atur-ulang-sandi
//
// Kenapa lewat terminal dan bukan lewat email: mengirim email butuh
// layanan luar, sedangkan proyek ini sepenuhnya lokal dan tanpa
// jaringan. Skrip ini hanya bisa dijalankan oleh orang yang sudah
// memegang komputer dan berkas proyeknya — kalau seseorang sudah
// sampai di situ, dia toh bisa membuka databasenya langsung.
//
// Sandi diketik langsung oleh pengguna, tidak ditampilkan di layar,
// dan tidak pernah dicetak ke mana pun.

import readline from 'node:readline';
import db, { applySchema, satu, semua } from '../src/db.js';
import { acak, periksaSyarat, PANJANG_MINIMAL } from '../src/sandi.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function tanya(teks) {
  return new Promise((resolve) => rl.question(teks, (jawab) => resolve(jawab.trim())));
}

// Tanya sandi. Ketikan tidak ditampilkan sama sekali.
function tanyaSandi(teks) {
  return new Promise((resolve) => {
    const tulisAsli = rl._writeToOutput;
    let diam = false;

    rl._writeToOutput = function (str) {
      if (!diam) {
        tulisAsli.call(rl, str);
        return;
      }
      if (str.includes('\n')) tulisAsli.call(rl, '\n');
    };

    rl.question(teks, (jawab) => {
      rl._writeToOutput = tulisAsli;
      resolve(jawab);
    });
    diam = true;
  });
}

function keluar(pesan, kode) {
  console.error(pesan);
  rl.close();
  process.exit(kode);
}

await applySchema();

const daftar = await semua('SELECT id, email, nama FROM pengguna ORDER BY id');
if (daftar.length === 0) {
  keluar('Belum ada akun sama sekali. Buat dulu dengan: npm run buat-admin', 1);
}

const email = (await tanya('Email akun yang sandinya mau diatur ulang: ')).toLowerCase();

const akun = await satu('SELECT id, email, nama FROM pengguna WHERE lower(email) = ?', [email]);
if (!akun) {
  // Skrip ini dijalankan oleh pemilik komputer, jadi menyebutkan
  // daftar email yang ada tidak membocorkan apa pun yang belum bisa
  // dilihatnya sendiri di database.
  console.error('');
  console.error('Tidak ada akun dengan email itu. Yang terdaftar:');
  for (const p of daftar) {
    console.error('  - ' + p.email + '  (' + p.nama + ')');
  }
  keluar('', 1);
}

console.log('');
console.log('Akun ditemukan: ' + akun.nama + ' <' + akun.email + '>');

const sandi = await tanyaSandi(
  'Sandi baru (minimal ' + PANJANG_MINIMAL + ' karakter, tidak akan terlihat): '
);
try {
  periksaSyarat(sandi);
} catch (e) {
  keluar(e.message, 1);
}

const ulang = await tanyaSandi('Ulangi sandi baru: ');
if (sandi !== ulang) keluar('Sandi tidak sama. Tidak ada yang diubah.', 1);

const hash = await acak(sandi);

try {
  await db.execute({
    sql: 'UPDATE pengguna SET hash_sandi = ? WHERE id = ?',
    args: [hash, akun.id],
  });
} catch (e) {
  keluar('Gagal menyimpan sandi baru: ' + e.message, 1);
}

// Semua sesi milik akun ini dihapus, supaya peramban mana pun yang
// masih membawa cookie lama langsung terlempar ke halaman masuk.
let sesiTerhapus = 0;
try {
  const sesi = await semua('SELECT sid, data FROM sesi');
  for (const s of sesi) {
    let isi;
    try {
      isi = JSON.parse(s.data);
    } catch {
      continue;
    }
    if (isi && Number(isi.penggunaId) === Number(akun.id)) {
      await db.execute({ sql: 'DELETE FROM sesi WHERE sid = ?', args: [s.sid] });
      sesiTerhapus++;
    }
  }
} catch (e) {
  console.error('Peringatan: sesi lama gagal dibersihkan (' + e.message + ').');
}

console.log('');
console.log('Sandi berhasil diatur ulang.');
console.log('  akun          : ' + akun.email);
console.log('  sesi dihapus  : ' + sesiTerhapus);
console.log('Sandi tidak ditampilkan dan tidak dicatat di mana pun.');

rl.close();
