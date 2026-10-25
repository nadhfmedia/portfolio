// Popup formulir 1-halaman (instan tanpa loading) & zona seret-lepas (drag & drop) media.
(function () {
  'use strict';

  // =================================================================
  // 1. Zona Seret & Lepas (Drag & Drop) untuk semua unggahan media
  // =================================================================

  window.addEventListener('dragover', function (e) {
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf && e.dataTransfer.types.indexOf('Files') >= 0) {
      e.preventDefault();
    }
  });
  window.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (!e.target || !e.target.closest || !e.target.closest('[data-zona-unggah]')) {
        e.preventDefault();
      }
    }
  });

  function pasangZonaSatu(zona) {
    if (!zona || zona.hasAttribute('data-zona-siap')) return;
    zona.setAttribute('data-zona-siap', '1');

    var masukan = zona.querySelector('input[type="file"]');
    if (!masukan) return;

    var penghitungSeret = 0;

    zona.addEventListener('dragenter', function (e) {
      e.preventDefault();
      e.stopPropagation();
      penghitungSeret++;
      zona.classList.add('zona-unggah-seret');
    });

    zona.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      zona.classList.add('zona-unggah-seret');
    });

    zona.addEventListener('dragleave', function (e) {
      e.preventDefault();
      e.stopPropagation();
      penghitungSeret--;
      if (penghitungSeret <= 0) {
        penghitungSeret = 0;
        zona.classList.remove('zona-unggah-seret');
      }
    });

    zona.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      penghitungSeret = 0;
      zona.classList.remove('zona-unggah-seret');

      var daftarBerkas = e.dataTransfer && e.dataTransfer.files;
      if (!daftarBerkas || !daftarBerkas.length) return;

      try {
        var wadah = new DataTransfer();
        wadah.items.add(daftarBerkas[0]);
        masukan.files = wadah.files;
      } catch (_) {
        try {
          masukan.files = daftarBerkas;
        } catch (_2) {}
      }

      var kejadian = new Event('change', { bubbles: true });
      masukan.dispatchEvent(kejadian);
    });
  }

  function siapkanZonaUnggah(akar) {
    var induk = akar || document;
    var daftar = induk.querySelectorAll('[data-zona-unggah]');
    for (var i = 0; i < daftar.length; i++) {
      pasangZonaSatu(daftar[i]);
    }
  }

  window.siapkanZonaUnggah = siapkanZonaUnggah;
  siapkanZonaUnggah(document);

  // Tombol silang (×) hapus foto profil di halaman Akun Saya (/admin/akun)
  (function () {
    var tombolHapusAkun = document.getElementById('akun-foto-hapus');
    var kotakFotoAkun = document.getElementById('akun-foto-kotak');
    var gambarFotoAkun = document.getElementById('akun-foto-tayang');
    var hurufAwalAkun = document.getElementById('akun-huruf-awal');
    var medanHapusFoto = document.getElementById('hapus_foto_medan');
    var medanBerkasFoto = document.getElementById('foto');
    if (!tombolHapusAkun || !kotakFotoAkun) return;

    tombolHapusAkun.addEventListener('click', function () {
      if (medanBerkasFoto) medanBerkasFoto.value = '';
      if (medanHapusFoto) medanHapusFoto.value = '1';
      if (gambarFotoAkun) gambarFotoAkun.removeAttribute('src');
      kotakFotoAkun.hidden = true;
      if (hurufAwalAkun) hurufAwalAkun.hidden = false;
    });
  })();

  // =================================================================
  // 2. Popup Formulir 1-Halaman (Instan 0ms, Tanpa Loading)
  // =================================================================

  var tirai = document.getElementById('popup-form-halaman');
  if (!tirai) return;

  var judulEl = document.getElementById('popup-form-judul');
  var badanEl = tirai.querySelector('.popup-form-badan');
  var form = tirai.querySelector('form');
  var sedangBuka = false;
  var pewaktuTutup = null;

  var jalur = tirai.getAttribute('data-jalur') || 'karya';
  var satuan = tirai.getAttribute('data-satuan') || 'data';
  var urutanBaruDefault = tirai.getAttribute('data-urutan-baru') || '1';

  function aturPratinjauGambar(wadahForm, urlGambar) {
    var medanGambar = wadahForm.querySelector('[data-medan-gambar]');
    if (!medanGambar) return;

    var masukan = medanGambar.querySelector('input[type="file"]');
    var zona = medanGambar.querySelector('[data-zona-unggah]');
    var kotak = medanGambar.querySelector('[data-pratinjau-kotak]');
    var img = medanGambar.querySelector('[data-pratinjau-gambar]');
    if (masukan) masukan.value = '';

    if (urlGambar) {
      var penuh = urlGambar.indexOf('http') === 0 || urlGambar.indexOf('/') === 0 ? urlGambar : '/' + urlGambar;
      if (img) img.src = penuh;
      if (kotak) kotak.hidden = false;
      if (zona) zona.hidden = true;
    } else {
      if (img) img.removeAttribute('src');
      if (kotak) kotak.hidden = true;
      if (zona) zona.hidden = false;
    }
  }

  function aturPratinjauVideo(wadahForm, urlVideo) {
    var kotakVideo = wadahForm.querySelector('[data-video-medan]');
    if (kotakVideo && typeof kotakVideo._aturVideoPopup === 'function') {
      kotakVideo._aturVideoPopup(urlVideo || '');
    }
  }

  function bersihkanPesanGalat() {
    var galat = badanEl.querySelectorAll('.kesalahan');
    for (var i = 0; i < galat.length; i++) {
      if (galat[i].parentNode) galat[i].parentNode.removeChild(galat[i]);
    }
  }

  function siapkanTambah() {
    if (!form) return;
    bersihkanPesanGalat();

    judulEl.textContent = 'Tambah ' + satuan;
    form.setAttribute('action', '/admin/' + jalur + '/baru');

    var masukanSemua = form.querySelectorAll('input, textarea, select');
    for (var i = 0; i < masukanSemua.length; i++) {
      var el = masukanSemua[i];
      var nama = el.name;
      if (!nama || nama === '_csrf') continue;

      if (el.type === 'checkbox') {
        el.checked = nama === 'tampil';
      } else if (el.type === 'file') {
        el.value = '';
      } else if (el.type === 'hidden') {
        el.value = '';
      } else if (nama === 'urutan') {
        el.value = urutanBaruDefault;
      } else {
        el.value = '';
      }
    }

    var ikonPratinjau = form.querySelector('[data-ikon-pratinjau]');
    if (ikonPratinjau) ikonPratinjau.className = 'bx bx-question-mark';

    aturPratinjauGambar(form, '');
    aturPratinjauVideo(form, '');
  }

  function siapkanEdit(tr, alamatSunting) {
    if (!form || !tr) return;
    bersihkanPesanGalat();

    judulEl.textContent = 'Edit ' + satuan;
    form.setAttribute('action', alamatSunting || ('/admin/' + jalur + '/' + tr.getAttribute('data-id') + '/sunting'));

    var masukanSemua = form.querySelectorAll('input, textarea, select');
    for (var i = 0; i < masukanSemua.length; i++) {
      var el = masukanSemua[i];
      var nama = el.name;
      if (!nama || nama === '_csrf' || el.type === 'file') continue;

      if (el.type === 'checkbox') {
        if (nama === 'tampil') {
          el.checked = tr.getAttribute('data-tampil') === '1';
        } else {
          el.checked = false;
        }
      } else if (el.type === 'hidden') {
        el.value = '';
      } else {
        var nilai = tr.getAttribute('data-' + nama);
        el.value = nilai !== null ? nilai : '';
      }
    }

    var medanIkon = form.querySelector('[data-ikon-medan]');
    var ikonPratinjau = form.querySelector('[data-ikon-pratinjau]');
    if (medanIkon && ikonPratinjau) {
      ikonPratinjau.className = medanIkon.value ? medanIkon.value : 'bx bx-question-mark';
    }

    aturPratinjauGambar(form, tr.getAttribute('data-gambar') || '');
    aturPratinjauVideo(form, tr.getAttribute('data-video') || '');
  }

  function bukaModal() {
    if (pewaktuTutup) {
      clearTimeout(pewaktuTutup);
      pewaktuTutup = null;
    }

    tirai.hidden = false;
    tirai.classList.remove('menutup');
    document.body.classList.add('terkunci');
    sedangBuka = true;
    if (badanEl) badanEl.scrollTop = 0;

    requestAnimationFrame(function () {
      tirai.classList.add('tampil');
      var pertama = form && form.querySelector('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]), select, textarea');
      if (pertama) {
        try { pertama.focus(); } catch (_) {}
      }
    });
  }

  function tutupModal() {
    if (!sedangBuka) return;
    sedangBuka = false;

    tirai.classList.remove('tampil');
    tirai.classList.add('menutup');
    document.body.classList.remove('terkunci');

    pewaktuTutup = setTimeout(function () {
      pewaktuTutup = null;
      if (!sedangBuka) {
        tirai.hidden = true;
        tirai.classList.remove('menutup');
      }
    }, 220);
  }

  tirai.addEventListener('click', function (e) {
    if (e.target === tirai || (e.target.closest && e.target.closest('[data-tutup-form], [data-batal-form]'))) {
      e.preventDefault();
      tutupModal();
    }
  });

  var tautanBatal = tirai.querySelectorAll('.tombol-baris a.tombol-samar');
  for (var b = 0; b < tautanBatal.length; b++) {
    tautanBatal[b].addEventListener('click', function (e) {
      e.preventDefault();
      tutupModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sedangBuka) {
      var popupIkon = document.getElementById('popup-ikon');
      if (popupIkon && !popupIkon.hidden) return;
      tutupModal();
    }
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      var kotakVideo = form.querySelector('[data-video-mengunggah]');
      if (kotakVideo) {
        e.preventDefault();
        return;
      }
      if (typeof window.fetch !== 'function' || typeof window.FormData !== 'function') return;

      e.preventDefault();
      bersihkanPesanGalat();

      var tombolSimpan = form.querySelector('button[type="submit"]');
      var htmlAwal = tombolSimpan ? tombolSimpan.innerHTML : '';
      if (tombolSimpan) {
        tombolSimpan.disabled = true;
        tombolSimpan.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Menyimpan...';
      }

      var alamatKirim = form.getAttribute('action') || window.location.pathname;
      var jenisEnkripsi = (form.getAttribute('enctype') || '').toLowerCase();
      var dataForm = new FormData(form);
      var opsi = {
        method: 'POST',
        credentials: 'same-origin'
      };

      if (jenisEnkripsi.indexOf('multipart/form-data') >= 0) {
        opsi.body = dataForm;
      } else {
        var params = new URLSearchParams();
        dataForm.forEach(function (nilai, kunci) {
          params.append(kunci, nilai);
        });
        opsi.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        opsi.body = params.toString();
      }

      fetch(alamatKirim, opsi)
        .then(function (res) {
          if (res.redirected && res.url) {
            window.location.href = res.url;
            return null;
          }
          return res.text();
        })
        .then(function (html) {
          if (html === null) return;
          if (tombolSimpan) {
            tombolSimpan.disabled = false;
            tombolSimpan.innerHTML = htmlAwal;
          }
          var parser = new DOMParser();
          var dok = parser.parseFromString(html, 'text/html');
          var pesanGalat = dok.querySelector('.kesalahan');
          var p = document.createElement('p');
          p.className = 'kesalahan';
          p.textContent = pesanGalat ? pesanGalat.textContent.trim() : 'Periksa kembali isian formulir Anda.';
          form.insertBefore(p, form.firstChild);
          if (badanEl) badanEl.scrollTop = 0;
        })
        .catch(function () {
          if (tombolSimpan) {
            tombolSimpan.disabled = false;
            tombolSimpan.innerHTML = htmlAwal;
          }
          var p = document.createElement('p');
          p.className = 'kesalahan';
          p.textContent = 'Gagal menyimpan data. Periksa sambungan internet Anda.';
          form.insertBefore(p, form.firstChild);
          if (badanEl) badanEl.scrollTop = 0;
        });
    });
  }

  // Tangkap klik tombol "+ Tambah ..." dan "Edit" di halaman ini.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!e.target || !e.target.closest) return;

    var tombolTambah = e.target.closest('[data-buka-tambah]');
    if (tombolTambah) {
      e.preventDefault();
      siapkanTambah();
      bukaModal();
      return;
    }

    var tombolEdit = e.target.closest('[data-buka-edit]');
    if (tombolEdit) {
      var tr = tombolEdit.closest('tr');
      if (!tr) return;
      e.preventDefault();
      siapkanEdit(tr, tombolEdit.getAttribute('href'));
      bukaModal();
    }
  });
})();
