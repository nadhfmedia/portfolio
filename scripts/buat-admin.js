// Skrip baris perintah untuk membuat akun admin.
// Jalankan dengan: npm run buat-admin
//
// Sandi diketik langsung oleh pengguna di terminal, tidak ditampilkan
// di layar, dan tidak pernah dicetak ke mana pun.

import readline from 'node:readline';
import db, { applySchema, satu } from '../src/db.js';
import { acak, periksaSyarat, PANJANG_MINIMAL } from '../src/sandi.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Tanya biasa, jawaban terlihat.
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
      // Saat diam, hanya baris baru yang diteruskan.
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

const email = (await tanya('Email admin: ')).toLowerCase();
if (!email) keluar('Email tidak boleh kosong.', 1);
if (!email.includes('@')) keluar('Email tidak sah: harus mengandung tanda @.', 1);

const sudahAda = await satu('SELECT id FROM pengguna WHERE lower(email) = ?', [email]);
if (sudahAda) {
  keluar(
    'Email tersebut sudah terdaftar sebagai pengguna (id ' +
      sudahAda.id +
      '). Akun tidak dibuat. Pakai email lain, atau hapus akun lama itu lebih dulu.',
    1
  );
}

const nama = await tanya('Nama admin: ');
if (!nama) keluar('Nama tidak boleh kosong.', 1);

const sandi = await tanyaSandi('Sandi (minimal ' + PANJANG_MINIMAL + ' karakter, tidak akan terlihat): ');
try {
  periksaSyarat(sandi);
} catch (e) {
  keluar(e.message, 1);
}

const ulang = await tanyaSandi('Ulangi sandi: ');
if (sandi !== ulang) keluar('Sandi tidak sama. Akun tidak dibuat.', 1);

const hash = await acak(sandi);

try {
  await db.execute({
    sql: 'INSERT INTO pengguna (email, nama, hash_sandi) VALUES (?, ?, ?)',
    args: [email, nama, hash],
  });
} catch (e) {
  keluar('Gagal menyimpan akun: ' + e.message, 1);
}

const dibuat = await satu('SELECT id, email, nama, dibuat_pada FROM pengguna WHERE lower(email) = ?', [email]);
console.log('');
console.log('Akun admin dibuat.');
console.log('  id          : ' + dibuat.id);
console.log('  email       : ' + dibuat.email);
console.log('  nama        : ' + dibuat.nama);
console.log('  dibuat pada : ' + dibuat.dibuat_pada);
console.log('Sandi tidak ditampilkan dan tidak dicatat di mana pun.');

rl.close();
