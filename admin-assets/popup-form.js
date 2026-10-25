// Membuka formulir tambah/edit sebagai popup.
//
// Tautan seperti /admin/karya/baru atau /admin/kategori/3/sunting
// dibuka di dalam iframe, bukan pindah halaman. Tanpa JavaScript
// tautannya tetap membuka halaman formulir biasa.
//
// Setelah disimpan, server mengalihkan iframe ke daftar; saat itu
// terdeteksi, halaman induk dimuat ulang ke alamat tujuan itu supaya
// daftar dan pesan "tersimpan" tampil segar. Kalau ada galat isian,
// server menampilkan ulang formulirnya dan iframe tetap di formulir.
(function () {
  if (window.self !== window.top) return;

  var SAH = /^\/admin\/[\w-]+\/(baru|\d+\/sunting)\/?$/;
  var tirai = null;
  var frame = null;
  var judul = null;
  var muat = null;
  var pemicu = null;

  function bangun() {
    tirai = document.createElement('div');
    tirai.className = 'tirai-form';
    tirai.hidden = true;
    tirai.innerHTML =
      '<div class="popup-form" role="dialog" aria-modal="true" aria-labelledby="popup-form-judul">' +
      '<div class="popup-form-atas">' +
      '<h2 id="popup-form-judul">Formulir</h2>' +
      '<button type="button" class="popup-form-tutup" aria-label="Tutup"><i class="bx bx-x"></i></button>' +
      '</div>' +
      '<div class="popup-form-badan">' +
      '<iframe title="Formulir"></iframe>' +
      '<div class="popup-form-muat">Memuat formulir...</div>' +
      '</div>' +
      '</div>';
    document.body.appendChild(tirai);

    frame = tirai.querySelector('iframe');
    judul = tirai.querySelector('h2');
    muat = tirai.querySelector('.popup-form-muat');

    tirai.querySelector('.popup-form-tutup').addEventListener('click', tutup);
    tirai.addEventListener('mousedown', function (e) {
      if (e.target === tirai) tutup();
    });

    frame.addEventListener('load', function () {
      var lokasi;
      try { lokasi = frame.contentWindow.location; } catch (e) { return; }
      if (!lokasi || lokasi.href === 'about:blank') return;

      if (!SAH.test(lokasi.pathname)) {
        // Tersimpan (atau dialihkan ke daftar): muat ulang halaman induk.
        window.location.href = lokasi.href;
        return;
      }
      var t = (frame.contentDocument && frame.contentDocument.title) || '';
      judul.textContent = t.split(' \u2014 ')[0] || 'Formulir';
      muat.hidden = true;
    });
  }

  function buka(alamat) {
    if (!tirai) bangun();
    pemicu = document.activeElement;
    muat.hidden = false;
    judul.textContent = 'Formulir';
    frame.src = alamat;
    tirai.hidden = false;
    document.documentElement.classList.add('popup-form-terbuka');
  }

  function tutup() {
    if (!tirai || tirai.hidden) return;
    tirai.hidden = true;
    frame.removeAttribute('src');
    document.documentElement.classList.remove('popup-form-terbuka');
    if (pemicu && pemicu.focus) pemicu.focus();
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank') return;
    var u;
    try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || !SAH.test(u.pathname)) return;
    e.preventDefault();
    buka(u.pathname);
  }, true);

  window.addEventListener('message', function (e) {
    if (e.origin === location.origin && e.data && e.data.popupForm === 'tutup') tutup();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') tutup();
  });
})();
