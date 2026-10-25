// Logika lupa sandi: buat token unik, kirim link ke email, dan
// proses pengaturan ulang sandi dari tautan itu.
//
// Token berlaku 1 jam dan hanya bisa dipakai sekali. Setelah dipakai
// atau kedaluwarsa, token dihapus.

import crypto from 'node:crypto';
import db, { satu, semua } from './db.js';
import { acak, periksaSyarat, PANJANG_MINIMAL } from './sandi.js';
import { kirimEmail } from './email.js';

// Token berlaku 1 jam (dalam milidetik).
const MASA_BERLAKU_MS = 60 * 60 * 1000;

// Bersihkan token kedaluwarsa. Dipanggil setiap kali ada permintaan
// baru supaya tabel tidak membesar tanpa batas.
async function bersihkanToken() {
  await db.execute({
    sql: 'DELETE FROM token_reset WHERE kedaluwarsa < ?',
    args: [Date.now()],
  });
}

/**
 * Buat token reset dan kirim email berisi link-nya.
 *
 * @param {string} email - alamat email pengguna
 * @param {string} asalUrl - URL dasar situs, misal "https://nadhiful-portfolio.vercel.app"
 * @returns {Promise<{ ok: boolean, pesan: string }>}
 */
export async function mintaResetSandi(email, asalUrl) {
  await bersihkanToken();

  const pengguna = await satu(
    'SELECT id, email, nama FROM pengguna WHERE lower(email) = ?',
    [email.trim().toLowerCase()]
  );

  // Selalu kembalikan pesan sukses, walau emailnya tidak terdaftar,
  // supaya penyerang tidak bisa menebak email mana yang ada.
  if (!pengguna) {
    return {
      ok: true,
      pesan: 'Jika email terdaftar, tautan pengaturan ulang sudah dikirim.',
    };
  }

  // Hapus token lama milik pengguna ini, kalau ada.
  await db.execute({
    sql: 'DELETE FROM token_reset WHERE pengguna_id = ?',
    args: [pengguna.id],
  });

  // Buat token acak 32 byte (64 karakter hex).
  const token = crypto.randomBytes(32).toString('hex');
  const kedaluwarsa = Date.now() + MASA_BERLAKU_MS;

  await db.execute({
    sql: 'INSERT INTO token_reset (pengguna_id, token, kedaluwarsa) VALUES (?, ?, ?)',
    args: [pengguna.id, token, kedaluwarsa],
  });

  const link = `${asalUrl}/admin/reset-sandi/${token}`;

  const hasil = await kirimEmail({
    kepada: pengguna.email,
    subjek: 'Atur ulang sandi — Portfolio Admin',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 16px; color: #1a1a1a;">Atur Ulang Sandi</h2>
        <p style="color: #444; line-height: 1.6;">Halo <strong>${pengguna.nama}</strong>,</p>
        <p style="color: #444; line-height: 1.6;">
          Seseorang (semoga Anda sendiri) meminta pengaturan ulang sandi
          untuk akun admin portfolio Anda. Klik tombol di bawah untuk
          membuat sandi baru:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${link}"
             style="display: inline-block; padding: 12px 32px;
                    background: #2563eb; color: #fff; text-decoration: none;
                    border-radius: 6px; font-weight: 600;">
            Atur Ulang Sandi
          </a>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">
          Tautan ini berlaku selama <strong>1 jam</strong>. Jika Anda tidak
          meminta ini, abaikan saja email ini — sandi Anda tidak akan berubah.
        </p>
        <p style="color: #888; font-size: 13px;">
          Atau salin tautan ini ke peramban:<br>
          <span style="word-break: break-all; color: #2563eb;">${link}</span>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #aaa; font-size: 11px; text-align: center;">
          Portfolio Admin Panel
        </p>
      </div>
    `,
  });

  if (!hasil.ok) {
    console.error('Gagal mengirim email reset:', hasil.pesan);
  }

  // Pesan yang dikembalikan ke pengguna selalu sama, apapun hasilnya.
  return {
    ok: true,
    pesan: 'Jika email terdaftar, tautan pengaturan ulang sudah dikirim.',
  };
}

/**
 * Periksa apakah token reset masih berlaku.
 *
 * @param {string} token
 * @returns {Promise<object|null>} data pengguna atau null
 */
export async function periksaToken(token) {
  await bersihkanToken();

  const baris = await satu(
    `SELECT tr.id AS token_id, tr.pengguna_id, tr.kedaluwarsa,
            p.email, p.nama
     FROM token_reset tr
     JOIN pengguna p ON p.id = tr.pengguna_id
     WHERE tr.token = ?`,
    [token]
  );

  if (!baris) return null;
  if (baris.kedaluwarsa < Date.now()) {
    // Sudah kedaluwarsa; hapus.
    await db.execute({ sql: 'DELETE FROM token_reset WHERE id = ?', args: [baris.token_id] });
    return null;
  }

  return baris;
}

/**
 * Proses pengaturan ulang sandi dari token.
 *
 * @param {string} token
 * @param {string} sandiBaru
 * @returns {Promise<{ ok: boolean, pesan: string }>}
 */
export async function prosesResetSandi(token, sandiBaru) {
  const data = await periksaToken(token);
  if (!data) {
    return { ok: false, pesan: 'Tautan tidak sah atau sudah kedaluwarsa.' };
  }

  try {
    periksaSyarat(sandiBaru);
  } catch (e) {
    return { ok: false, pesan: e.message };
  }

  const hash = await acak(sandiBaru);

  await db.execute({
    sql: 'UPDATE pengguna SET hash_sandi = ? WHERE id = ?',
    args: [hash, data.pengguna_id],
  });

  // Hapus token yang sudah dipakai.
  await db.execute({
    sql: 'DELETE FROM token_reset WHERE pengguna_id = ?',
    args: [data.pengguna_id],
  });

  // Hapus semua sesi milik akun ini supaya sesi lama yang mungkin
  // masih terbuka di peramban lain langsung terlempar ke halaman masuk.
  try {
    const sesiSemua = await semua('SELECT sid, data FROM sesi');
    for (const s of sesiSemua) {
      let isi;
      try { isi = JSON.parse(s.data); } catch { continue; }
      if (isi && Number(isi.penggunaId) === Number(data.pengguna_id)) {
        await db.execute({ sql: 'DELETE FROM sesi WHERE sid = ?', args: [s.sid] });
      }
    }
  } catch (e) {
    console.error('Peringatan: sesi lama gagal dibersihkan:', e.message);
  }

  return { ok: true, pesan: 'Sandi berhasil diatur ulang. Silakan masuk dengan sandi baru.' };
}

export { PANJANG_MINIMAL };
