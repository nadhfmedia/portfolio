// Unggah video karya langsung dari peramban ke Cloudinary.
(function () {
  'use strict';

  function pasangSatu(kotak) {
    if (!kotak || kotak.hasAttribute('data-video-siap')) return;
    kotak.setAttribute('data-video-siap', '1');

    var berkas = kotak.querySelector('[data-video-berkas]');
    var alamat = kotak.querySelector('[data-video-url]');
    var medanHapus = kotak.querySelector('[data-video-hapus]');
    var zona = kotak.querySelector('[data-zona-unggah]');
    var wadahVideo = kotak.querySelector('[data-video-kotak]');
    var videoEl = kotak.querySelector('[data-video-pratinjau]');
    var tombolBatal = kotak.querySelector('[data-video-batal]');
    var batang = kotak.querySelector('[data-video-kemajuan]');
    var isi = kotak.querySelector('[data-video-isi]');
    var status = kotak.querySelector('[data-video-status]');
    var form = kotak.closest('form');
    if (!berkas || !alamat || !batang || !isi) return;

    var BOLEH = ['mp4', 'webm', 'mov'];
    var BATAS = 100 * 1024 * 1024;
    var sedangUnggah = false;
    var xhrAktif = null;
    var urlBlob = null;

    function lepasBlob() {
      if (urlBlob) {
        URL.revokeObjectURL(urlBlob);
        urlBlob = null;
      }
    }

    function tulis(teks, galat) {
      if (!status) return;
      if (!teks) {
        status.textContent = '';
        status.hidden = true;
        return;
      }
      status.textContent = teks;
      status.hidden = false;
      status.style.color = galat ? '#b42318' : '';
    }

    function tampilkanVideo(src) {
      if (videoEl) videoEl.src = src;
      if (wadahVideo) wadahVideo.hidden = false;
      if (zona) zona.hidden = true;
    }

    function sembunyikanVideo() {
      if (xhrAktif) {
        try { xhrAktif.abort(); } catch (_) {}
        xhrAktif = null;
      }
      sedangUnggah = false;
      kotak.removeAttribute('data-video-mengunggah');
      lepasBlob();
      berkas.value = '';
      alamat.value = '';
      if (videoEl) {
        try { videoEl.pause(); } catch (_) {}
        videoEl.removeAttribute('src');
      }
      if (wadahVideo) wadahVideo.hidden = true;
      if (zona) zona.hidden = false;
      batang.hidden = true;
      isi.style.width = '0';
      tulis('', false);
    }

    if (tombolBatal) {
      tombolBatal.addEventListener('click', function () {
        if (medanHapus) medanHapus.value = '1';
        sembunyikanVideo();
      });
    }

    berkas.addEventListener('change', function () {
      alamat.value = '';
      var f = berkas.files && berkas.files[0];
      if (!f) {
        sembunyikanVideo();
        return;
      }
      var ekstensi = (f.name.split('.').pop() || '').toLowerCase();
      if (BOLEH.indexOf(ekstensi) < 0) {
        sembunyikanVideo();
        return tulis('Format tidak didukung. Pakai mp4, webm, atau mov.', true);
      }
      if (f.size > BATAS) {
        sembunyikanVideo();
        return tulis('Video terlalu besar. Maksimal 100 MB.', true);
      }
      if (medanHapus) medanHapus.value = '';
      lepasBlob();
      urlBlob = URL.createObjectURL(f);
      tampilkanVideo(urlBlob);
      mulai(f);
    });

    function mulai(f) {
      sedangUnggah = true;
      kotak.setAttribute('data-video-mengunggah', '1');
      batang.hidden = false;
      isi.style.width = '0';
      tulis('Mengunggah video... 0%', false);

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
          xhrAktif = x;
          x.open('POST', t.url);
          x.upload.onprogress = function (e) {
            if (!e.lengthComputable) return;
            var p = Math.round((e.loaded / e.total) * 100);
            isi.style.width = p + '%';
            tulis('Mengunggah video... ' + p + '%', false);
          };
          x.onload = function () {
            xhrAktif = null;
            sedangUnggah = false;
            kotak.removeAttribute('data-video-mengunggah');
            var j = {};
            try { j = JSON.parse(x.responseText); } catch (e) {}
            if (x.status >= 200 && x.status < 300 && j.secure_url) {
              alamat.value = j.secure_url;
              isi.style.width = '100%';
              setTimeout(function () {
                batang.hidden = true;
                tulis('', false);
              }, 500);
            } else {
              sembunyikanVideo();
              tulis((j.error && j.error.message) || 'Video gagal diunggah.', true);
            }
          };
          x.onerror = function () {
            xhrAktif = null;
            sembunyikanVideo();
            tulis('Koneksi terputus saat mengunggah video.', true);
          };
          x.send(d);
        })
        .catch(function (e) {
          sembunyikanVideo();
          tulis(e.message || 'Video gagal diunggah.', true);
        });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        if (sedangUnggah) {
          e.preventDefault();
          e.stopImmediatePropagation();
          tulis('Tunggu sampai video selesai diunggah.', true);
        }
      });
    }

    // Simpan pengendali di elemen supaya popup 1-halaman bisa mengatur
    // ulang atau mengisi video saat tombol Tambah / Edit diklik.
    kotak._aturVideoPopup = function (urlVideo) {
      if (xhrAktif) {
        try { xhrAktif.abort(); } catch (_) {}
        xhrAktif = null;
      }
      sedangUnggah = false;
      kotak.removeAttribute('data-video-mengunggah');
      lepasBlob();
      berkas.value = '';
      alamat.value = '';
      if (medanHapus) medanHapus.value = '';
      batang.hidden = true;
      isi.style.width = '0';
      tulis('', false);

      if (urlVideo) {
        var penuh = urlVideo.indexOf('http') === 0 || urlVideo.indexOf('/') === 0 ? urlVideo : '/' + urlVideo;
        tampilkanVideo(penuh);
      } else {
        if (videoEl) {
          try { videoEl.pause(); } catch (_) {}
          videoEl.removeAttribute('src');
        }
        if (wadahVideo) wadahVideo.hidden = true;
        if (zona) zona.hidden = false;
      }
    };
  }

  function siapkanUnggahVideo(akar) {
    var induk = akar || document;
    var daftar = induk.querySelectorAll('[data-video-medan]');
    for (var i = 0; i < daftar.length; i++) {
      pasangSatu(daftar[i]);
    }
  }

  window.siapkanUnggahVideo = siapkanUnggahVideo;
  siapkanUnggahVideo(document);
})();
