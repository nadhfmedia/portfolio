// Dijalankan di <head> TANPA defer.
//
// Kalau halaman formulir (tambah/edit) sedang dimuat di dalam popup
// (iframe), tandai <html> supaya CSS menyembunyikan sidebar dan kepala
// halaman sebelum sempat tergambar, lalu teruskan tombol Batal dan
// tombol Escape ke halaman induk.
(function () {
  if (window.self === window.top) return;
  var SAH = /\/admin\/[\w-]+\/(baru|\d+\/sunting)\/?$/;
  if (!SAH.test(location.pathname)) return;

  document.documentElement.classList.add('dalam-popup');

  function tutup() {
    window.parent.postMessage({ popupForm: 'tutup' }, location.origin);
  }

  // Tautan yang menuju selain formulir (mis. Batal -> daftar) menutup popup.
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin === location.origin && !SAH.test(u.pathname)) {
      e.preventDefault();
      tutup();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !e.defaultPrevented) tutup();
  });
})();
