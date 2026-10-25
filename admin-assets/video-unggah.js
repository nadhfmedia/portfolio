// Unggah video karya langsung dari peramban ke Cloudinary.
//
// Video tidak lewat server: fungsi serverless dibatasi sekitar 4,5 MB
// per permintaan. Server hanya menandatangani unggahannya
// (/admin/karya/tanda-tangan-video); alamat hasilnya disimpan di
// kolom tersembunyi video_url dan ikut terkirim saat formulir disimpan.
(function () {
  var kotak = document.querySelector('[data-video-medan]');
  if (!kotak) return;

  var berkas = kotak.querySelector('[data-video-berkas]');
  var alamat = kotak.querySelector('[data-video-url]');
  var batang = kotak.querySelector('[data-video-kemajuan]');
  var isi = kotak.querySelector('[data-video-isi]');
  var status = kotak.querySelector('[data-video-status]');
  var form = kotak.closest('form');
  var BOLEH = ['mp4', 'webm', 'mov'];
  var BATAS = 100 * 1024 * 1024;
  var sedangUnggah = false;
  var teksAwal = status.textContent;

  function tulis(teks, galat) {
    status.textContent = teks;
    status.style.color = galat ? '#b42318' : '';
  }

  function ulang() {
    berkas.value = '';
    alamat.value = '';
    batang.hidden = true;
    isi.style.width = '0';
  }

  berkas.addEventListener('change', function () {
    alamat.value = '';
    var f = berkas.files[0];
    if (!f) {
      batang.hidden = true;
      tulis(teksAwal, false);
      return;
    }
    var ekstensi = (f.name.split('.').pop() || '').toLowerCase();
    if (BOLEH.indexOf(ekstensi) < 0) {
      ulang();
      return tulis('Format tidak didukung. Pakai mp4, webm, atau mov.', true);
    }
    if (f.size > BATAS) {
      ulang();
      return tulis('Video terlalu besar. Maksimal 100 MB.', true);
    }
    mulai(f);
  });

  function mulai(f) {
    sedangUnggah = true;
    batang.hidden = false;
    isi.style.width = '0';
    tulis('Menyiapkan unggahan...', false);

    var badan = new URLSearchParams();
    badan.set('_csrf', kotak.getAttribute('data-csrf'));

    fetch(kotak.getAttribute('data-tanda'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: badan.toString(),
      credentials: 'same-origin'
    })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j && j.galat ? j.galat : 'Gagal menyiapkan unggahan.');
          return j;
        });
      })
      .then(function (t) {
        var d = new FormData();
        d.append('file', f);
        d.append('api_key', t.api_key);
        d.append('timestamp', t.timestamp);
        d.append('folder', t.folder);
        d.append('signature', t.signature);

        var x = new XMLHttpRequest();
        x.open('POST', t.url);
        x.upload.onprogress = function (e) {
          if (!e.lengthComputable) return;
          var p = Math.round((e.loaded / e.total) * 100);
          isi.style.width = p + '%';
          tulis('Mengunggah video... ' + p + '%', false);
        };
        x.onload = function () {
          sedangUnggah = false;
          var j = {};
          try { j = JSON.parse(x.responseText); } catch (e) {}
          if (x.status >= 200 && x.status < 300 && j.secure_url) {
            alamat.value = j.secure_url;
            isi.style.width = '100%';
            tulis('Video siap. Tekan Simpan untuk menyimpannya.', false);
          } else {
            ulang();
            tulis((j.error && j.error.message) || 'Video gagal diunggah.', true);
          }
        };
        x.onerror = function () {
          sedangUnggah = false;
          ulang();
          tulis('Koneksi terputus saat mengunggah video.', true);
        };
        x.send(d);
      })
      .catch(function (e) {
        sedangUnggah = false;
        ulang();
        tulis(e.message || 'Video gagal diunggah.', true);
      });
  }

  // Jangan simpan formulir selagi video masih naik.
  form.addEventListener('submit', function (e) {
    if (sedangUnggah) {
      e.preventDefault();
      tulis('Tunggu sampai video selesai diunggah.', true);
    }
  });
})();
