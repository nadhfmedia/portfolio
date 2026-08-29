// Halaman Data Diri.
//
// Enam medan tetap yang seluruhnya tersimpan di tabel profil:
// foto About, paragraf Profile, tanggal lahir, nomor telepon, email,
// dan jenis kelamin. Satu formulir, satu tombol simpan, satu
// transaksi -- polanya sama persis dengan halaman Teks Situs.
//
// Tidak ada tambah, tidak ada hapus, tidak ada sakelar tampil, dan
// tidak ada tabel dengan tombol Edit per baris. Enam medan ini
// memang selalu enam; menghapus salah satunya hanya akan membuat
// bagian About kosong tanpa peringatan.
//
// SEBELUM tahap 23C, empat di antaranya (tanggal lahir, email,
// telepon, jenis kelamin) tersimpan DUA KALI: di tabel profil dan di
// tabel data_diri. Yang tampil di situs adalah salinan data_diri,
// sementara halaman Teks Situs menyunting salinan profil -- jadi
// menyuntingnya di sana tidak mengubah apa pun. Sejak tahap ini
// tabel profil satu-satunya sumber, dan halaman ini satu-satunya
// tempat menyuntingnya.

import db, { semua, satu } from './db.js';
import { periksaCsrf, csrfSah } from './csrf.js';
import { unggah, pesanUnggah, hapusBerkasUnggahan, AWALAN_UNGGAH } from './unggah.js';
import { GAMBAR_ABOUT, jalurAman } from './gambar-situs.js';

// Kelima medan teks, berurutan seperti tampilnya di situs.
// Ikonnya TIDAK ada di sini: sejak tahap 23C ikon tiap butir About
// tertulis tetap di views/publik/index.ejs, karena enam medan tetap
// tidak butuh ikon yang bisa diganti.
export const MEDAN = [
  {
    kunci: 'profil_teks',
    label: 'Profile',
    panjang: true,
    maks: 2000,
    petunjuk: 'Paragraf perkenalan di butir pertama bagian About.',
  },
  {
    kunci: 'tanggal_lahir',
    label: 'Birth Date',
    maks: 60,
    petunjuk: 'Ditulis apa adanya, contohnya "August 14, 1998".',
  },
  {
    kunci: 'telepon',
    label: 'Phone Number',
    maks: 40,
    petunjuk: null,
    jugaDipakai: 'batang atas dan kotak "Call Us/Whatsapp" di bagian Contact',
  },
  {
    kunci: 'email',
    label: 'Email',
    maks: 120,
    petunjuk: null,
    jugaDipakai: 'batang atas (tautan surel) dan kotak "Email Us" di bagian Contact',
  },
  {
    kunci: 'gender',
    label: 'Gender',
    maks: 40,
    petunjuk: null,
  },
];

const KUNCI_SAH = new Set(MEDAN.map((m) => m.kunci));

// Baca keenam nilainya sekaligus.
export async function ambilDataDiri() {
  const baris = await semua('SELECT kunci, nilai FROM profil');
  const peta = {};
  for (const b of baris) peta[b.kunci] = b.nilai == null ? '' : String(b.nilai);

  const gambarKustom = jalurAman(peta[GAMBAR_ABOUT.kunci]);

  return {
    medan: MEDAN.map((m) => ({
      ...m,
      nilai: peta[m.kunci] == null ? '' : peta[m.kunci],
      kosong: !peta[m.kunci],
    })),
    gambar: {
      kunci: GAMBAR_ABOUT.kunci,
      judul: GAMBAR_ABOUT.judul,
      saran: GAMBAR_ABOUT.saran,
      keterangan: GAMBAR_ABOUT.keterangan,
      bawaan: GAMBAR_ABOUT.bawaan,
      kustom: gambarKustom,
      dipakai: gambarKustom || GAMBAR_ABOUT.bawaan,
      pakaiBawaan: gambarKustom === '',
    },
  };
}

// Upsert, bukan UPDATE saja: kalau suatu kunci belum pernah ada
// (misalnya database lama), ia dibuat sekali. profil.kunci UNIQUE,
// jadi ini aman dipanggil berulang.
const SQL_SIMPAN =
  'INSERT INTO profil (kunci, nilai) VALUES (?, ?) ' +
  'ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai';

function pesanBerhasil(q) {
  switch (q.pesan) {
    case 'simpan':
      return (Number(q.n) || 0) + ' medan diperbarui.';
    case 'gambar':
      return 'Foto About tersimpan.';
    default:
      return null;
  }
}

function pesanGagal(q) {
  switch (q.pesan) {
    case 'tanpa-berkas':
      return 'Tidak ada berkas yang dipilih, jadi fotonya tidak berubah.';
    case 'gagal-unggah':
      return String(q.sebab || 'Foto gagal diunggah.');
    default:
      return null;
  }
}

export function pasangDataDiri(app, dep) {
  const { halaman, wajibLogin } = dep;

  app.get('/admin/data-diri', wajibLogin, async (req, res) => {
    const data = await ambilDataDiri();
    const kosong = data.medan.filter((m) => m.kosong).length;

    return halaman(req, res, 'data-diri', {
      judulHalaman: 'Data Diri',
      subJudul:
        data.medan.length + ' medan' + (kosong > 0 ? ', ' + kosong + ' masih kosong' : ''),
      menuAktif: 'data_diri',
      medan: data.medan,
      gambar: data.gambar,
      jumlahKosong: kosong,
      berhasil: pesanBerhasil(req.query),
      kesalahan: pesanGagal(req.query),
    });
  });

  // ---- simpan kelima medan teks, satu transaksi ----
  app.post('/admin/data-diri', wajibLogin, periksaCsrf, async (req, res) => {
    const perubahan = [];
    for (const [nama, isi] of Object.entries(req.body)) {
      if (!nama.startsWith('dd_')) continue;
      const kunci = nama.slice(3);
      // Hanya kelima kunci yang memang dicetak halaman ini. Kunci
      // lain dari formulir yang dikarang diabaikan, jadi halaman ini
      // tidak bisa dipakai menulis ke kunci profil mana pun.
      if (!KUNCI_SAH.has(kunci)) continue;
      perubahan.push([kunci, String(isi == null ? '' : isi).trim()]);
    }

    if (perubahan.length === 0) return res.redirect('/admin/data-diri?pesan=simpan&n=0');

    // Entah seluruhnya tersimpan, atau tidak ada yang berubah sama
    // sekali. Sama seperti halaman Teks Situs.
    const tx = await db.transaction('write');
    let diubah = 0;
    try {
      for (const [kunci, nilai] of perubahan) {
        const hasil = await tx.execute({ sql: SQL_SIMPAN, args: [kunci, nilai] });
        diubah += Number(hasil.rowsAffected || 0);
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    return res.redirect('/admin/data-diri?pesan=simpan&n=' + diubah);
  });

  // ---- ganti foto About ----
  //
  // multer harus mengurai multipart lebih dulu supaya req.body._csrf
  // terbaca, jadi tokennya diperiksa sesudahnya -- dan berkas yang
  // terlanjur tersimpan langsung dibuang kalau tokennya tidak sah.
  // Pola ini sama persis dengan halaman Karya, Logo, dan Gambar Situs.
  function terimaBerkas(req, res, next) {
    unggah.single('gambar')(req, res, (err) => {
      if (err) req.kesalahanUnggah = pesanUnggah(err);
      if (!csrfSah(req)) {
        if (req.file) hapusBerkasUnggahan(AWALAN_UNGGAH + req.file.filename);
        res.status(403);
        return res.render('admin/kesalahan', {
          judul: 'Permintaan ditolak',
          pesan:
            'Token keamanan formulir tidak sah atau sudah kedaluwarsa. ' +
            'Muat ulang halaman lalu coba lagi.',
        });
      }
      return next();
    });
  }

  app.post('/admin/data-diri/foto', wajibLogin, terimaBerkas, async (req, res) => {
    if (req.kesalahanUnggah) {
      if (req.file) hapusBerkasUnggahan(AWALAN_UNGGAH + req.file.filename);
      return res.redirect(
        '/admin/data-diri?pesan=gagal-unggah&sebab=' + encodeURIComponent(req.kesalahanUnggah)
      );
    }
    if (!req.file) return res.redirect('/admin/data-diri?pesan=tanpa-berkas');

    const lama = jalurAman(
      ((await satu('SELECT nilai FROM profil WHERE kunci = ?', [GAMBAR_ABOUT.kunci])) || {}).nilai
    );
    const baru = AWALAN_UNGGAH + req.file.filename;

    await db.execute({ sql: SQL_SIMPAN, args: [GAMBAR_ABOUT.kunci, baru] });

    // Berkas lama dibuang HANYA lewat hapusBerkasUnggahan, yang
    // menolak jalur apa pun di luar storage/uploads/. Foto bawaan di
    // assets/ karena itu tidak mungkin ikut terhapus.
    if (lama && lama !== baru) hapusBerkasUnggahan(lama);

    return res.redirect('/admin/data-diri?pesan=gambar');
  });

}
