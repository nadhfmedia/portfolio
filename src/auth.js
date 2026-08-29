// Pemeriksa sesi untuk halaman admin.

// Pasang di depan rute admin mana pun yang butuh login.
// Kalau belum login, pengunjung dialihkan ke /admin/login.
export function wajibLogin(req, res, next) {
  if (req.session && req.session.penggunaId) {
    return next();
  }
  return res.redirect('/admin/login');
}

// Kebalikannya: dipakai di halaman login sendiri, supaya pengguna
// yang sudah login tidak melihat formulir login lagi.
export function tolakKalauSudahLogin(req, res, next) {
  if (req.session && req.session.penggunaId) {
    return res.redirect('/admin');
  }
  return next();
}
