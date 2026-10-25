// Memutar karya video di jendela sendiri. Karya bergambar tetap
// memakai VenoBox seperti sebelumnya.
(function () {
  var daftar = document.querySelectorAll('a.karya-video');
  if (!daftar.length) return;

  var modal = document.createElement('div');
  modal.className = 'karya-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML =
    '<button type="button" class="karya-modal-tutup" aria-label="Tutup">&times;</button>' +
    '<video controls playsinline></video>';
  document.body.appendChild(modal);
  var video = modal.querySelector('video');

  function buka(alamat, judul) {
    video.src = alamat;
    video.setAttribute('aria-label', judul || 'Video');
    modal.classList.add('buka');
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function tutup() {
    video.pause();
    video.removeAttribute('src');
    video.load();
    modal.classList.remove('buka');
  }

  Array.prototype.forEach.call(daftar, function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      buka(a.getAttribute('data-video'), a.getAttribute('data-judul'));
    });
  });

  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.classList.contains('karya-modal-tutup')) tutup();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') tutup();
  });
})();
