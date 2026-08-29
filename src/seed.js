import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { applySchema, hitung, DB_URL } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');

const html = fs.readFileSync(HTML_PATH, 'utf8');

function gagal(pesan) {
  console.error('SEED DIHENTIKAN: ' + pesan);
  process.exit(1);
}

// Ambil isi satu <section id="..."> ... </section>
function ambilSection(id) {
  const mulai = html.indexOf('<section id="' + id + '"');
  if (mulai === -1) gagal('section id="' + id + '" tidak ditemukan di index.html');
  const akhir = html.indexOf('</section>', mulai);
  if (akhir === -1) gagal('penutup </section> untuk id="' + id + '" tidak ditemukan');
  return html.slice(mulai, akhir);
}

function bersih(teks) {
  return teks
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&copy;/g, '©')
    .replace(/&nbsp;/g, ' ');
}

// Buang semua tag HTML, sisakan teksnya saja.
// Tag dihapus tanpa disisipi spasi supaya tanda baca yang menempel
// di luar tag (misalnya "</strong>." pada footer) tidak jadi renggang.
function tanpaTag(teks) {
  return bersih(teks.replace(/<[^>]*>/g, ''));
}

// Buang blok komentar HTML supaya isi yang dinonaktifkan tidak ikut terbaca
function tanpaKomentar(teks) {
  return teks.replace(/<!--[\s\S]*?-->/g, '');
}

const portfolioHtml = tanpaKomentar(ambilSection('portfolio'));
const servicesHtml = tanpaKomentar(ambilSection('services'));
const skillsHtml = tanpaKomentar(ambilSection('skills'));
const clientsHtml = tanpaKomentar(ambilSection('clients'));
const aboutHtml = tanpaKomentar(ambilSection('about'));
const contactHtml = tanpaKomentar(ambilSection('contact'));
const heroHtml = tanpaKomentar(ambilSection('hero'));

// ---------- 1. KATEGORI ----------
const kategori = [];
{
  const ulMulai = portfolioHtml.indexOf('<ul id="portfolio-flters">');
  if (ulMulai === -1) gagal('daftar filter #portfolio-flters tidak ditemukan');
  const ulAkhir = portfolioHtml.indexOf('</ul>', ulMulai);
  const ul = portfolioHtml.slice(ulMulai, ulAkhir);
  const re = /<li\s+data-filter="\.([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(ul)) !== null) {
    kategori.push({ kelas_filter: m[1], nama: bersih(m[2]) });
  }
}

// ---------- 2. KARYA ----------
const karya = [];
{
  const re = /<a\s+href="([^"]+)"[^>]*data-gall="portfolioGallery"[^>]*>\s*<div class="[^"]*\bportfolio-item\b\s+([a-z0-9-]+)"[^>]*>\s*<img\s+src="([^"]+)"[^>]*>\s*<div class="portfolio-info">\s*<h4>([\s\S]*?)<\/h4>\s*<p>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(portfolioHtml)) !== null) {
    karya.push({
      href: m[1],
      kelas_filter: m[2],
      gambar: m[3],
      judul: bersih(m[4]),
      subjudul: bersih(m[5]),
    });
  }
}

// ---------- 3. LAYANAN ----------
const layanan = [];
{
  const re = /<div class="icon"><i class="([^"]+)"><\/i><\/div>\s*<h4>([\s\S]*?)<\/h4>\s*<p>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(servicesHtml)) !== null) {
    layanan.push({ ikon: bersih(m[1]), judul: bersih(m[2]), deskripsi: bersih(m[3]) });
  }
}

// ---------- 4. SKILL ----------
const skill = [];
{
  // Bagian skills terbagi dua kolom <div class="col-lg-6" ...>
  const potongan = skillsHtml.split(/<div class="col-lg-6"/);
  if (potongan.length !== 3) {
    gagal('bagian skills diharapkan punya 2 kolom col-lg-6, ditemukan ' + (potongan.length - 1));
  }
  const kolomNama = ['kiri', 'kanan'];
  for (let i = 1; i < potongan.length; i++) {
    const re = /<span class="skill">([\s\S]*?)<i class="val">(\d+)%<\/i><\/span>/gi;
    let m;
    while ((m = re.exec(potongan[i])) !== null) {
      skill.push({ nama: bersih(m[1]), persen: Number(m[2]), kolom: kolomNama[i - 1] });
    }
  }
}

// ---------- 5. LOGO ----------
const logo = [];
{
  const re = /<img\s+src="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(clientsHtml)) !== null) {
    logo.push({ gambar: m[1] });
  }

  // Nama logo TIDAK ditulis di index.html. Satu-satunya sumber yang
  // sah adalah nama berkasnya, dicocokkan dengan nama skill yang
  // memang tertulis di index.html. Kalau tidak ada yang cocok,
  // namanya dibiarkan kosong -- jangan dikarang.
  const sederhana = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const l of logo) {
    const berkas = l.gambar.split('/').pop().replace(/\.[a-z0-9]+$/i, '');
    const kunci = sederhana(berkas);
    const kunciTanpaS = kunci.replace(/s$/, '');
    const cocok = skill.find((s) => {
      const n = sederhana(s.nama);
      return n.includes(kunci) || n.includes(kunciTanpaS);
    });
    l.nama = cocok ? cocok.nama : '';
  }
}

// ---------- 5b. DATA DIRI ----------
//
// TABELNYA SUDAH TIDAK ADA sejak tahap 23C.
//
// Dulu blok ini menyalin tiap butir <li> di bagian About ke tabel
// data_diri -- padahal bagian 6 di bawah menyalin PASANGAN <h5>/<p>
// YANG SAMA PERSIS ke tabel profil. Satu fakta ditulis ke dua tabel,
// dan itulah asal-usul duplikasi yang dibereskan di tahap 23B.
//
// Sekarang tabel profil satu-satunya sumber: tanggal_lahir, email,
// telepon, gender, dan profil_teks semuanya diambil di bagian 6.

// ---------- 5c. MENU NAVIGASI ----------
const menu = [];
{
  const mNav = /<nav class="nav-menu[^"]*">([\s\S]*?)<\/nav>/i.exec(tanpaKomentar(html));
  if (!mNav) gagal('nav.nav-menu tidak ditemukan di index.html');
  const re = /<li[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi;
  let m;
  while ((m = re.exec(mNav[1])) !== null) {
    // index.html menunjuk halaman depannya sendiri dengan "index.html",
    // karena dulu ia memang berkas statis yang dibuka langsung. Server
    // ini TIDAK menyajikan /index.html -- halaman depannya ada di "/" --
    // jadi tautan itu diterjemahkan sekarang, bukan disalin apa adanya
    // lalu menghasilkan 404 di panel.
    const tautan = /^(?:\.\/)?index\.html$/i.test(m[1]) ? '/' : m[1];
    menu.push({ tautan, label: tanpaTag(m[2]) });
  }
}

// ---------- 6. PROFIL ----------
const profil = [];
{
  // Pasangan <h5>label</h5><p>nilai</p> di bagian About
  const petaAbout = {
    'Profile': 'profil_teks',
    'Birth Date': 'tanggal_lahir',
    'Email': 'email',
    'Phone Number': 'telepon',
    'Gender': 'gender',
  };
  const re = /<h5>([\s\S]*?)<\/h5>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  const ditemukan = new Set();
  while ((m = re.exec(aboutHtml)) !== null) {
    const label = bersih(m[1]);
    const kunci = petaAbout[label];
    if (kunci) {
      profil.push({ kunci: kunci, nilai: bersih(m[2]) });
      ditemukan.add(kunci);
    }
  }
  for (const k of Object.values(petaAbout)) {
    if (!ditemukan.has(k)) gagal('profil "' + k + '" tidak ditemukan di bagian About');
  }

  // Alamat dari bagian Contact
  const mAlamat = /<h3>Our Address<\/h3>\s*<p>([\s\S]*?)<\/p>/i.exec(contactHtml);
  if (!mAlamat) gagal('alamat (Our Address) tidak ditemukan di bagian Contact');
  profil.push({ kunci: 'alamat', nilai: bersih(mAlamat[1]) });

  // Tautan sosial dari div.social-links
  const mSos = /<div class="social-links">([\s\S]*?)<\/div>/i.exec(html);
  if (!mSos) gagal('div.social-links tidak ditemukan');
  const reSos = /<a\s+href="([^"]+)"\s+class="([a-z]+)"/gi;
  let s;
  let jumlahSos = 0;
  while ((s = reSos.exec(mSos[1])) !== null) {
    profil.push({ kunci: 'sosial_' + s[2], nilai: s[1] });
    jumlahSos++;
  }
  if (jumlahSos === 0) gagal('tidak ada tautan sosial yang terbaca');
}

// ---------- 6b. PROFIL: TEKS TAMPILAN ----------
{
  // Pembantu: ambil isi satu tag, wajib ketemu.
  function wajib(sumber, re, keterangan) {
    const m = re.exec(sumber);
    if (!m) gagal(keterangan + ' tidak ditemukan di index.html');
    return tanpaTag(m[1]);
  }

  // --- Hero ---
  profil.push({ kunci: 'hero_judul', nilai: wajib(heroHtml, /<h1>([\s\S]*?)<\/h1>/i, 'judul hero (h1)') });
  profil.push({ kunci: 'hero_subjudul', nilai: wajib(heroHtml, /<h2>([\s\S]*?)<\/h2>/i, 'subjudul hero (h2)') });
  profil.push({ kunci: 'hero_tombol_teks', nilai: wajib(heroHtml, /<a[^>]*class="btn-get-started[^"]*"[^>]*>([\s\S]*?)<\/a>/i, 'teks tombol hero') });

  // --- Judul tiap bagian, dari div.section-title ---
  const bagian = {
    about: aboutHtml,
    services: servicesHtml,
    portfolio: portfolioHtml,
    contact: contactHtml,
  };
  for (const [nama, sumber] of Object.entries(bagian)) {
    const mBlok = /<div class="section-title">([\s\S]*?)<\/div>/i.exec(sumber);
    if (!mBlok) gagal('div.section-title untuk bagian "' + nama + '" tidak ditemukan');
    const blok = mBlok[1];
    profil.push({ kunci: 'bagian_' + nama + '_judul', nilai: wajib(blok, /<h2>([\s\S]*?)<\/h2>/i, 'h2 bagian ' + nama) });
    profil.push({ kunci: 'bagian_' + nama + '_subjudul', nilai: wajib(blok, /<h3>([\s\S]*?)<\/h3>/i, 'h3 bagian ' + nama) });
    const mP = /<p>([\s\S]*?)<\/p>/i.exec(blok);
    if (mP) profil.push({ kunci: 'bagian_' + nama + '_teks', nilai: tanpaTag(mP[1]) });
  }

  // --- Bagian skills: di index.html hanya ada h3, TIDAK ada h2.
  // Karena itu kunci bagian_skills_judul sengaja tidak dibuat. ---
  profil.push({ kunci: 'bagian_pengalaman_judul', nilai: 'Experience' });
  profil.push({ kunci: 'bagian_pengalaman_subjudul', nilai: 'My Work [Experience]' });
  profil.push({
    kunci: 'bagian_pengalaman_teks',
    nilai: 'The roles I have taken on so far, starting from the most recent.',
  });

  profil.push({ kunci: 'bagian_skills_subjudul', nilai: wajib(skillsHtml, /<h3[^>]*>([\s\S]*?)<\/h3>/i, 'h3 bagian skills') });

  // --- Footer ---
  const mFooter = /<div class="copyright">([\s\S]*?)<\/div>/i.exec(html);
  if (!mFooter) gagal('div.copyright pada footer tidak ditemukan');
  profil.push({ kunci: 'footer_teks', nilai: tanpaTag(mFooter[1]) });
  const mTahun = /<strong>\s*<span>([\s\S]*?)<\/span>\s*<\/strong>/i.exec(mFooter[1]);
  if (!mTahun) gagal('tahun copyright pada footer tidak ditemukan');
  profil.push({ kunci: 'footer_tahun', nilai: tanpaTag(mTahun[1]) });

  // --- Tombol MORE DESIGN ---
  const mTombol = /<a class="bton"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(portfolioHtml);
  if (!mTombol) gagal('tombol MORE DESIGN tidak ditemukan di bagian portfolio');
  profil.push({ kunci: 'tombol_more_design_tautan', nilai: mTombol[1] });
  profil.push({ kunci: 'tombol_more_design_teks', nilai: tanpaTag(mTombol[2]) });

  // --- Nomor telepon ---
  //
  // Sampai tahap 23A ada TIGA kunci telepon: telepon (dari bagian
  // About), telepon_topbar, dan telepon_kontak -- tiga format berbeda
  // untuk satu nomor yang sama. Pemilik memutuskan menyatukannya jadi
  // satu kunci profil.telepon, dan nilainya sudah diambil dari bagian
  // About di atas. Dua kunci sisanya tidak ditulis lagi.
  //
  // Keberadaan nomornya di topbar dan di kotak Contact tetap
  // DIPERIKSA, supaya seed tetap berhenti kalau index.html berubah
  // bentuk. Hanya nilainya yang tidak lagi disimpan terpisah.
  if (!/<i class="icofont-phone"><\/i>([^<]*)/i.test(html)) {
    gagal('nomor telepon topbar tidak ditemukan');
  }
  if (!/<h3>Call Us\/Whatsapp<\/h3>\s*<p>([\s\S]*?)<\/p>/i.test(contactHtml)) {
    gagal('nomor telepon bagian contact tidak ditemukan');
  }

  // --- Label tiap info-box di bagian contact ---
  const reLabel = /<div class="info-box[^"]*">\s*<i class="[^"]+"><\/i>\s*<h3>([\s\S]*?)<\/h3>/gi;
  const kunciLabel = ['kontak_label_alamat', 'kontak_label_email', 'kontak_label_telepon'];
  let mLabel;
  let iLabel = 0;
  while ((mLabel = reLabel.exec(contactHtml)) !== null) {
    if (iLabel < kunciLabel.length) {
      profil.push({ kunci: kunciLabel[iLabel], nilai: tanpaTag(mLabel[1]) });
    }
    iLabel++;
  }
  if (iLabel !== 3) gagal('label info-box bagian contact: diharapkan 3, terbaca ' + iLabel);
}

// ---------- VERIFIKASI JUMLAH ----------
// data_diri tidak ada lagi: isinya pindah ke tabel profil (tahap 23B/23C).
const harapan = { kategori: 4, karya: 23, layanan: 6, skill: 6, logo: 6, menu: 5 };
const nyata = {
  kategori: kategori.length,
  karya: karya.length,
  layanan: layanan.length,
  skill: skill.length,
  logo: logo.length,
  menu: menu.length,
};
const selisih = [];
for (const [nama, jml] of Object.entries(harapan)) {
  if (nyata[nama] !== jml) {
    selisih.push(nama + ': diharapkan ' + jml + ', terbaca ' + nyata[nama] + ' (selisih ' + (nyata[nama] - jml) + ')');
  }
}
if (selisih.length > 0) {
  gagal('jumlah tidak cocok ->\n  ' + selisih.join('\n  '));
}

// Kunci profil harus unik (kolomnya UNIQUE di skema)
{
  const terlihat = new Set();
  const dobel = [];
  for (const p of profil) {
    if (terlihat.has(p.kunci)) dobel.push(p.kunci);
    terlihat.add(p.kunci);
  }
  if (dobel.length > 0) gagal('kunci profil dobel: ' + dobel.join(', '));
}

// Setiap layanan harus punya kelas ikon yang terisi
for (const [i, l] of layanan.entries()) {
  if (!l.ikon) gagal('layanan ke-' + (i + 1) + ' ("' + l.judul + '") tidak punya kelas ikon');
}

// Tiap karya harus punya kategori yang dikenal
const kelasDikenal = new Set(kategori.map((k) => k.kelas_filter));
for (const [i, k] of karya.entries()) {
  if (!kelasDikenal.has(k.kelas_filter)) {
    gagal('karya ke-' + (i + 1) + ' ("' + k.judul + '") memakai kelas "' + k.kelas_filter + '" yang tidak ada di daftar filter');
  }
}

// ---------- TULIS KE DATABASE ----------
await applySchema();

const isi = async () => {
  const tx = await db.transaction('write');
  try {
    // Hanya tabel isi situs yang dikosongkan.
    // Tabel pesan dan pengguna TIDAK disentuh supaya data nyata tidak hilang.
    for (const t of ['karya', 'kategori', 'layanan', 'skill', 'logo', 'profil', 'menu']) {
      await tx.execute('DELETE FROM ' + t);
      await tx.execute({
        sql: 'DELETE FROM sqlite_sequence WHERE name = ?',
        args: [t],
      });
    }

    const idKategori = new Map();
    for (const [i, k] of kategori.entries()) {
      const r = await tx.execute({
        sql: 'INSERT INTO kategori (nama, kelas_filter, urutan) VALUES (?, ?, ?)',
        args: [k.nama, k.kelas_filter, i + 1],
      });
      idKategori.set(k.kelas_filter, Number(r.lastInsertRowid));
    }

    for (const [i, k] of karya.entries()) {
      await tx.execute({
        sql: 'INSERT INTO karya (judul, subjudul, gambar, kategori_id, urutan, tampil) VALUES (?, ?, ?, ?, ?, 1)',
        args: [k.judul, k.subjudul, k.gambar, idKategori.get(k.kelas_filter), i + 1],
      });
    }

    for (const [i, l] of layanan.entries()) {
      await tx.execute({
        sql: 'INSERT INTO layanan (ikon, judul, deskripsi, urutan, tampil) VALUES (?, ?, ?, ?, 1)',
        args: [l.ikon, l.judul, l.deskripsi, i + 1],
      });
    }

    for (const [i, s] of skill.entries()) {
      await tx.execute({
        sql: 'INSERT INTO skill (nama, persen, kolom, urutan, tampil) VALUES (?, ?, ?, ?, 1)',
        args: [s.nama, s.persen, s.kolom, i + 1],
      });
    }

    for (const [i, l] of logo.entries()) {
      await tx.execute({
        sql: 'INSERT INTO logo (gambar, nama, urutan, tampil) VALUES (?, ?, ?, 1)',
        args: [l.gambar, l.nama, i + 1],
      });
    }

    for (const [i, mn] of menu.entries()) {
      await tx.execute({
        sql: 'INSERT INTO menu (label, tautan, urutan, tampil) VALUES (?, ?, ?, 1)',
        args: [mn.label, mn.tautan, i + 1],
      });
    }

    for (const p of profil) {
      await tx.execute({
        sql: 'INSERT INTO profil (kunci, nilai) VALUES (?, ?)',
        args: [p.kunci, p.nilai],
      });
    }

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
};

await isi();

console.log('Seed selesai. Database: ' + DB_URL);
for (const t of ['kategori', 'karya', 'layanan', 'skill', 'logo', 'menu', 'profil', 'pesan', 'pengguna']) {
  console.log('  ' + t + ': ' + (await hitung(t)));
}
