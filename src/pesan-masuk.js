// Halaman Pesan Masuk.
//
// Tidak memakai mesin di src/sumber-admin.js karena tabel pesan tidak
// punya kolom urutan (jadi rute /urutan akan gagal), tidak boleh
// ditambah lewat panel (pesan datang dari pengunjung), dan butuh dua
// hal yang tidak ada di mesin itu: penanda sudah/belum dibaca, dan
// popup berisi isi pesan lengkap.

import db, { satu, semua } from './db.js';
import { periksaCsrf } from './csrf.js';

function bacaDaftarId(mentah) {
  return String(mentah || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[0-9]+$/.test(s))
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0)
    .filter((n, i, arr) => arr.indexOf(n) === i);
}

// Dipakai sidebar untuk lencana kecil.
export async function jumlahBelumDibaca() {
  const r = await satu('SELECT COUNT(*) AS n FROM pesan WHERE sudah_dibaca = 0');
  return Number(r.n);
}

// Berapa pesan yang muncul di dalam lonceng.
const JUMLAH_LONCENG = 5;

// Data untuk lonceng pemberitahuan di batang atas panel.
//
// Satu kueri untuk daftarnya, satu untuk jumlah yang belum dibaca.
// Keduanya dipanggil dari SATU middleware di server.js, jadi tiap
// halaman panel mendapatkannya tanpa perlu menambah kode di rutenya
// masing-masing.
export async function ambilPesanLonceng() {
  const daftar = await semua(
    'SELECT id, nama, subjek, sudah_dibaca, dibuat_pada ' +
      'FROM pesan ORDER BY dibuat_pada DESC, id DESC LIMIT ' + JUMLAH_LONCENG
  );

  return {
    daftar,
    belumDibaca: await jumlahBelumDibaca(),
  };
}

function pesanBerhasil(q) {
  const n = Number(q.n) || 0;
  switch (q.pesan) {
    case 'hapus':
      return 'Satu pesan dihapus.';
    case 'hapus-banyak':
      return n + ' pesan dihapus.';
    case 'tandai':
      return 'Penanda dibaca diperbarui.';
    default:
      return null;
  }
}

export function pasangPesanMasuk(app, dep) {
  const { halaman, wajibLogin } = dep;

  app.get('/admin/pesan', wajibLogin, async (req, res) => {
    const baris = await semua(
      'SELECT id, nama, email, subjek, isi, sudah_dibaca, dibuat_pada ' +
        'FROM pesan ORDER BY sudah_dibaca, dibuat_pada DESC, id DESC'
    );
    const belum = baris.filter((b) => Number(b.sudah_dibaca) === 0).length;

    return halaman(req, res, 'pesan-daftar', {
      judulHalaman: 'Pesan Masuk',
      subJudul:
        baris.length === 0
          ? 'Belum ada pesan'
          : baris.length + ' pesan, ' + belum + ' belum dibaca',
      menuAktif: 'pesan',
      baris,
      jumlahBelum: belum,
      berhasil: pesanBerhasil(req.query),
      kesalahan:
        req.query.pesan === 'kosong'
          ? 'Tidak ada pesan yang dipilih, jadi tidak ada yang diubah.'
          : null,
    });
  });

  // Halaman satu pesan. Inilah cara membaca isi pesan kalau
  // JavaScript mati: popup di halaman daftar butuh JavaScript, halaman
  // ini tidak. Tautan subjek di tiap baris menuju ke sini.
  app.get('/admin/pesan/:id', wajibLogin, async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return next();

    const pesan = await satu('SELECT * FROM pesan WHERE id = ?', [id]);
    if (!pesan) return next();

    return halaman(req, res, 'pesan-satu', {
      judulHalaman: String(pesan.subjek || '(tanpa subjek)'),
      subJudul: 'Dari ' + pesan.nama,
      menuAktif: 'pesan',
      pesan,
      sudahDibaca: Number(pesan.sudah_dibaca) === 1,
      berhasil: req.query.pesan === 'tandai' ? 'Penanda dibaca diperbarui.' : null,
    });
  });

  // Tandai satu pesan sudah atau belum dibaca.
  app.post('/admin/pesan/:id/tandai', wajibLogin, periksaCsrf, async (req, res, next) => {
    const id = Number(req.params.id);
    const ada = await satu('SELECT id FROM pesan WHERE id = ?', [id]);
    if (!ada) return next();

    const dibaca = req.body.dibaca === '1' ? 1 : 0;
    await db.execute({
      sql: 'UPDATE pesan SET sudah_dibaca = ? WHERE id = ?',
      args: [dibaca, id],
    });

    // Sama seperti rute sakelar di src/sumber-admin.js: kalau yang
    // meminta lebih suka JSON -- artinya permintaannya datang dari
    // fetch di admin.js -- jawabannya JSON pendek. Peramban yang
    // mengirim formulir biasa selalu meminta text/html, jadi jalur di
    // bawahnya tetap persis seperti sebelumnya.
    //
    // belumDibaca ikut dikirim supaya lencana di sidebar dan angka di
    // lonceng bisa diperbarui tanpa menebak-nebak: yang dipakai angka
    // dari database, bukan hasil kurang satu di sisi peramban.
    if (req.accepts(['html', 'json']) === 'json') {
      return res.json({ ok: true, dibaca, belumDibaca: await jumlahBelumDibaca() });
    }

    // Kalau permintaannya datang dari halaman satu pesan, kembalikan
    // ke sana, bukan ke daftar.
    if (String(req.body.kembali || '') === 'satu') {
      return res.redirect('/admin/pesan/' + id + '?pesan=tandai');
    }

    return res.redirect('/admin/pesan?pesan=tandai');
  });

  // Halaman konfirmasi cadangan kalau JavaScript mati.
  app.get('/admin/pesan/:id/hapus', wajibLogin, async (req, res, next) => {
    const baris = await satu('SELECT * FROM pesan WHERE id = ?', [Number(req.params.id)]);
    if (!baris) return next();

    return halaman(req, res, 'sumber-hapus', {
      judulHalaman: 'Hapus pesan?',
      subJudul: String(baris.subjek || baris.nama || ''),
      menuAktif: 'pesan',
      cfg: {
        judul: 'Pesan Masuk',
        jalur: 'pesan',
        satuan: 'pesan',
        medanNama: 'nama',
        punyaGambar: false,
      },
      kolom: [
        { kunci: 'nama', label: 'Nama', jenis: 'teks' },
        { kunci: 'email', label: 'Email', jenis: 'teks' },
        { kunci: 'subjek', label: 'Subjek', jenis: 'teks' },
        { kunci: 'isi', label: 'Isi', jenis: 'teks' },
        { kunci: 'dibuat_pada', label: 'Diterima', jenis: 'teks' },
      ],
      baris,
      cek: null,
      berkasIkutDihapus: false,
    });
  });

  app.post('/admin/pesan/:id/hapus', wajibLogin, periksaCsrf, async (req, res, next) => {
    const id = Number(req.params.id);
    const ada = await satu('SELECT id FROM pesan WHERE id = ?', [id]);
    if (!ada) return next();

    await db.execute({ sql: 'DELETE FROM pesan WHERE id = ?', args: [id] });
    return res.redirect('/admin/pesan?pesan=hapus');
  });

  app.post('/admin/pesan/hapus-banyak', wajibLogin, periksaCsrf, async (req, res) => {
    const ids = bacaDaftarId(req.body.ids);
    if (ids.length === 0) return res.redirect('/admin/pesan?pesan=kosong');

    const tx = await db.transaction('write');
    let terhapus = 0;
    try {
      for (const id of ids) {
        const hasil = await tx.execute({
          sql: 'DELETE FROM pesan WHERE id = ?',
          args: [id],
        });
        terhapus += Number(hasil.rowsAffected || 0);
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    return res.redirect('/admin/pesan?pesan=hapus-banyak&n=' + terhapus);
  });
}
