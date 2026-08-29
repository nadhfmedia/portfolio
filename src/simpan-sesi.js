// Penyimpan sesi berbasis database, menggantikan MemoryStore bawaan
// express-session. Tanpa paket tambahan: hanya express-session
// (yang memang sudah dipakai) dan koneksi database milik proyek ini.
//
// Tabel yang dipakai:
//   sesi (sid TEXT PRIMARY KEY, data TEXT, kedaluwarsa INTEGER)
// Kolom kedaluwarsa berisi waktu epoch dalam milidetik.

import session from 'express-session';
import db from './db.js';

const SATU_HARI = 1000 * 60 * 60 * 24;
const JEDA_BERSIH = 1000 * 60 * 15; // bersihkan tiap 15 menit

export default class SimpanSesiDb extends session.Store {
  constructor(pilihan = {}) {
    super();

    this.jedaBersih = pilihan.jedaBersih ?? JEDA_BERSIH;
    this.umurBawaan = pilihan.umurBawaan ?? SATU_HARI;

    // Semua metode menunggu tabelnya siap lebih dulu.
    this.siap = this.#siapkanTabel();

    if (this.jedaBersih > 0) {
      this.pewaktu = setInterval(() => {
        this.bersihkan().catch((e) => {
          console.error('Gagal membersihkan sesi kedaluwarsa:', e.message);
        });
      }, this.jedaBersih);
      // Jangan menahan proses tetap hidup hanya karena pewaktu ini.
      if (typeof this.pewaktu.unref === 'function') this.pewaktu.unref();
    }
  }

  async #siapkanTabel() {
    await db.execute(
      'CREATE TABLE IF NOT EXISTS sesi (' +
        'sid TEXT PRIMARY KEY, ' +
        'data TEXT NOT NULL, ' +
        'kedaluwarsa INTEGER NOT NULL' +
        ')'
    );
    await db.execute('CREATE INDEX IF NOT EXISTS idx_sesi_kedaluwarsa ON sesi (kedaluwarsa)');
    await this.bersihkan();
  }

  // Hitung waktu kedaluwarsa sebuah sesi, dalam epoch milidetik.
  #kapanKedaluwarsa(sesi) {
    const c = sesi && sesi.cookie;
    if (c) {
      if (c.expires) {
        const t = new Date(c.expires).getTime();
        if (Number.isFinite(t)) return t;
      }
      if (Number.isFinite(c.maxAge)) return Date.now() + c.maxAge;
    }
    return Date.now() + this.umurBawaan;
  }

  // Hapus semua sesi yang sudah lewat waktunya.
  async bersihkan() {
    await db.execute({
      sql: 'DELETE FROM sesi WHERE kedaluwarsa <= ?',
      args: [Date.now()],
    });
  }

  // Hentikan pewaktu pembersih. Berguna saat pengujian.
  tutup() {
    if (this.pewaktu) {
      clearInterval(this.pewaktu);
      this.pewaktu = null;
    }
  }

  get(sid, selesai) {
    this.siap
      .then(() =>
        db.execute({
          sql: 'SELECT data, kedaluwarsa FROM sesi WHERE sid = ?',
          args: [sid],
        })
      )
      .then(async (hasil) => {
        const baris = hasil.rows[0];
        if (!baris) return selesai(null, null);

        if (Number(baris.kedaluwarsa) <= Date.now()) {
          await db.execute({ sql: 'DELETE FROM sesi WHERE sid = ?', args: [sid] });
          return selesai(null, null);
        }

        let isi;
        try {
          isi = JSON.parse(baris.data);
        } catch (e) {
          // Data rusak diperlakukan seperti sesi yang tidak ada.
          await db.execute({ sql: 'DELETE FROM sesi WHERE sid = ?', args: [sid] });
          return selesai(null, null);
        }
        return selesai(null, isi);
      })
      .catch((e) => selesai(e));
  }

  set(sid, sesi, selesai) {
    let data;
    try {
      data = JSON.stringify(sesi);
    } catch (e) {
      return selesai(e);
    }
    const kedaluwarsa = this.#kapanKedaluwarsa(sesi);

    this.siap
      .then(() =>
        db.execute({
          sql: 'INSERT INTO sesi (sid, data, kedaluwarsa) VALUES (?, ?, ?) ' +
            'ON CONFLICT(sid) DO UPDATE SET data = excluded.data, kedaluwarsa = excluded.kedaluwarsa',
          args: [sid, data, kedaluwarsa],
        })
      )
      .then(() => selesai(null))
      .catch((e) => selesai(e));
  }

  destroy(sid, selesai) {
    this.siap
      .then(() => db.execute({ sql: 'DELETE FROM sesi WHERE sid = ?', args: [sid] }))
      .then(() => selesai(null))
      .catch((e) => selesai(e));
  }

  touch(sid, sesi, selesai) {
    const kedaluwarsa = this.#kapanKedaluwarsa(sesi);
    this.siap
      .then(() =>
        db.execute({
          sql: 'UPDATE sesi SET kedaluwarsa = ? WHERE sid = ?',
          args: [kedaluwarsa, sid],
        })
      )
      .then(() => selesai(null))
      .catch((e) => selesai(e));
  }

  // Metode tambahan yang dikenali express-session, tidak wajib.
  length(selesai) {
    this.siap
      .then(() => db.execute('SELECT COUNT(*) AS n FROM sesi WHERE kedaluwarsa > ' + Date.now()))
      .then((hasil) => selesai(null, Number(hasil.rows[0].n)))
      .catch((e) => selesai(e));
  }

  clear(selesai) {
    this.siap
      .then(() => db.execute('DELETE FROM sesi'))
      .then(() => selesai(null))
      .catch((e) => selesai(e));
  }
}
