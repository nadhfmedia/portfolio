// Pemformat tanggal ke bahasa Indonesia.
//
// Ditulis sendiri, tanpa pustaka. Intl.DateTimeFormat sebenarnya bisa,
// tapi data lokal bahasa Indonesia belum tentu tersedia di semua
// pemasangan Node, dan hasilnya bisa berbeda antar versi. Daftar nama
// bulan yang tetap membuat keluarannya sama di mana pun.

const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

// Nilai yang tersimpan berbentuk "YYYY-MM-DD HH:MM:SS" (hasil
// datetime('now') di SQLite) atau ISO. Yang kosong dikembalikan
// sebagai tanda strip, bukan tanggal karangan.
export function tanggalIndonesia(nilai) {
  if (nilai === null || nilai === undefined) return '—';

  const teks = String(nilai).trim();
  if (teks === '') return '—';

  const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(teks);
  if (!cocok) return '—';

  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const hari = Number(cocok[3]);

  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return '—';

  return hari + ' ' + BULAN[bulan - 1] + ' ' + tahun;
}

// Versi dengan jam, dipakai kalau perlu keterangan lebih rinci.
export function tanggalJamIndonesia(nilai) {
  const tanggal = tanggalIndonesia(nilai);
  if (tanggal === '—') return '—';

  const jam = /(\d{2}):(\d{2})/.exec(String(nilai));
  return jam ? tanggal + ', ' + jam[1] + '.' + jam[2] : tanggal;
}

// Waktu sekarang dalam bentuk yang sama dengan datetime('now')
// milik SQLite, supaya kolomnya seragam.
export function sekarangUntukDb() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    '-' + p(d.getUTCMonth() + 1) +
    '-' + p(d.getUTCDate()) +
    ' ' + p(d.getUTCHours()) +
    ':' + p(d.getUTCMinutes()) +
    ':' + p(d.getUTCSeconds())
  );
}
