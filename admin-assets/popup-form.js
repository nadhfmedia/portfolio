// Popup formulir tambah/sunting & zona seret-lepas (drag & drop) media.
(function () {
  'use strict';

  function ukuranTerbaca(byte) {
    if (byte < 1024) return byte + ' B';
    if (byte < 1024 * 1024) return (byte / 1024).toFixed(1) + ' KB';
    return (byte / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // =================================================================
  // 1. Zona Seret & Lepas (Drag & Drop) untuk semua unggahan media
  // =================================================================

  // Cegah peramban membuka berkas secara mentah kalau pengguna meleset
  // sedikit saat menyeret berkas ke halaman.
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
    var lencana = zona.querySelector('[data-zona-berkas]');
    if (!masukan) return;

    var penghitungSeret = 0;

    function tampilkanNamaBerkas() {
      if (!lencana) return;
      var berkas = masukan.files && masukan.files[0];
      if (!berkas) {
        lencana.textContent = '';
        lencana.hidden = true;
        zona.classList.remove('zona-unggah-terisi');
        return;
      }
      lencana.textContent = berkas.name + ' (' + ukuranTerbaca(berkas.size) + ')';
      lencana.hidden = false;
      zona.classList.add('zona-unggah-terisi');
    }

    masukan.addEventListener('change', tampilkanNamaBerkas);

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

      tampilkanNamaBerkas();
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

  // =================================================================
  // 2. Pratinjau gambar & pemilih ikon untuk formulir di dalam popup
  // =================================================================

  function siapkanPratinjauGambar(akar) {
    var daftar = akar.querySelectorAll('[data-pratinjau-medan]');
    for (var i = 0; i < daftar.length; i++) {
      (function (medan) {
        if (medan.hasAttribute('data-pratinjau-siap')) return;
        medan.setAttribute('data-pratinjau-siap', '1');

        var bungkus = medan.closest('.medan');
        if (!bungkus) return;

        var kotakBaru = bungkus.querySelector('[data-pratinjau-kotak]');
        var gambarBaru = bungkus.querySelector('[data-pratinjau-gambar]');
        var namaBaru = bungkus.querySelector('[data-pratinjau-nama]');
        var tombolBatal = bungkus.querySelector('[data-pratinjau-batal]');
        var kotakLama = bungkus.querySelector('[data-pratinjau-lama]');
        var lencana = bungkus.querySelector('[data-zona-berkas]');
        var zona = bungkus.querySelector('[data-zona-unggah]');
        if (!kotakBaru || !gambarBaru) return;

        var urlSekarang = null;

        function lepasUrl() {
          if (urlSekarang) {
            URL.revokeObjectURL(urlSekarang);
            urlSekarang = null;
          }
        }

        function sembunyikan() {
          lepasUrl();
          gambarBaru.removeAttribute('src');
          kotakBaru.hidden = true;
          if (namaBaru) namaBaru.textContent = '';
          if (kotakLama) kotakLama.classList.remove('diganti');
        }

        medan.addEventListener('change', function () {
          var berkas = medan.files && medan.files[0];
          if (!berkas) {
            sembunyikan();
            return;
          }
          lepasUrl();
          urlSekarang = URL.createObjectURL(berkas);
          gambarBaru.src = urlSekarang;
          if (namaBaru) {
            namaBaru.textContent = berkas.name + ' · ' + ukuranTerbaca(berkas.size);
          }
          kotakBaru.hidden = false;
          if (kotakLama) kotakLama.classList.add('diganti');
        });

        gambarBaru.addEventListener('error', function () {
          if (!urlSekarang) return;
          sembunyikan();
        });

        if (tombolBatal) {
          tombolBatal.addEventListener('click', function () {
            medan.value = '';
            sembunyikan();
            if (lencana) {
              lencana.textContent = '';
              lencana.hidden = true;
            }
            if (zona) zona.classList.remove('zona-unggah-terisi');
          });
        }
      })(daftar[i]);
    }
  }

  function siapkanPemilihIkon(akar) {
    var tiraiIkon = akar.querySelector('#popup-ikon');
    if (!tiraiIkon) return;

    var medanIkon = akar.querySelector('#ikon');
    var contohIkon = akar.querySelector('#ikon-contoh');
    var namaTampil = akar.querySelector('#ikon-nama-tampil');
    var tombolBuka = akar.querySelector('[data-buka-ikon]');
    var tombolHapus = akar.querySelector('[data-hapus-ikon]');
    var kotakCari = tiraiIkon.querySelector('#ikon-cari');
    var daftar = tiraiIkon.querySelector('#ikon-daftar');
    var info = tiraiIkon.querySelector('#ikon-jumlah');
    var kosong = tiraiIkon.querySelector('#ikon-kosong');
    if (!medanIkon || !tombolBuka || !daftar) return;

    var semuaTombol = Array.prototype.slice.call(daftar.querySelectorAll('[data-ikon-nilai]'));
    var total = semuaTombol.length;

    function tandaiTerpilih(nilai) {
      for (var i = 0; i < semuaTombol.length; i++) {
        var b = semuaTombol[i];
        var sama = b.getAttribute('data-ikon-nilai') === nilai;
        if (sama) b.classList.add('terpilih');
        else b.classList.remove('terpilih');
      }
    }

    function perbaruiTampilan(nilai) {
      medanIkon.value = nilai;
      if (contohIkon) contohIkon.className = nilai ? 'bx ' + nilai : '';
      if (namaTampil) {
        namaTampil.textContent = nilai || 'Belum dipilih';
        if (nilai) namaTampil.classList.remove('kosong');
        else namaTampil.classList.add('kosong');
      }
      if (tombolHapus) tombolHapus.hidden = !nilai;
      tandaiTerpilih(nilai);
    }

    function saringIkon() {
      var kata = kotakCari ? kotakCari.value.trim().toLowerCase() : '';
      var cocok = 0;
      for (var i = 0; i < semuaTombol.length; i++) {
        var b = semuaTombol[i];
        var nama = b.getAttribute('data-ikon-nama') || '';
        var tampil = kata === '' || nama.indexOf(kata) !== -1;
        b.hidden = !tampil;
        if (tampil) cocok++;
      }
      if (info) {
        info.textContent = kata === ''
          ? total + ' ikon tersedia'
          : 'menampilkan ' + cocok + ' dari ' + total + ' ikon';
      }
      if (kosong) kosong.hidden = cocok !== 0;
    }

    function tutupIkon() {
      tiraiIkon.classList.remove('tampil');
      setTimeout(function () {
        tiraiIkon.hidden = true;
      }, 180);
    }

    tombolBuka.addEventListener('click', function () {
      if (kotakCari) kotakCari.value = '';
      saringIkon();
      tandaiTerpilih(medanIkon.value);
      tiraiIkon.hidden = false;
      requestAnimationFrame(function () {
        tiraiIkon.classList.add('tampil');
      });
      if (kotakCari) kotakCari.focus();
    });

    if (tombolHapus) {
      tombolHapus.addEventListener('click', function () {
        perbaruiTampilan('');
      });
    }

    if (kotakCari) {
      kotakCari.addEventListener('input', saringIkon);
    }

    daftar.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-ikon-nilai]') : null;
      if (!t) return;
      perbaruiTampilan(t.getAttribute('data-ikon-nilai'));
      tutupIkon();
    });

    tiraiIkon.addEventListener('click', function (e) {
      if (e.target === tiraiIkon || (e.target.closest && e.target.closest('[data-tutup-ikon]'))) {
        e.preventDefault();
        e.stopPropagation();
        tutupIkon();
      }
    });

    var tombolTutupIkon = tiraiIkon.querySelectorAll('[data-tutup]');
    for (var k = 0; k < tombolTutupIkon.length; k++) {
      tombolTutupIkon[k].removeAttribute('data-tutup');
      tombolTutupIkon[k].setAttribute('data-tutup-ikon', '1');
    }
  }

  // =================================================================
  // 3. Popup Formulir Tambah / Sunting (Fetch + DOM Inline + Animasi)
  // =================================================================

  var SAH = /^\/admin\/[\w-]+\/(baru|\d+\/sunting)\/?$/;
  var tirai = null;
  var jendela = null;
  var judulEl = null;
  var badanEl = null;
  var sedangBuka = false;
  var pewaktuTutup = null;
  var pengontrolFetch = null;

  function pastikanPopup() {
    if (tirai) return;
    tirai = document.createElement('div');
    tirai.className = 'tirai tirai-form';
    tirai.id = 'popup-form-tirai';
    tirai.hidden = true;
    tirai.innerHTML =
      '<div class="popup popup-form" role="dialog" aria-modal="true" aria-labelledby="popup-form-judul">' +
        '<div class="popup-kepala">' +
          '<h2 id="popup-form-judul">Formulir</h2>' +
          '<button type="button" class="popup-tutup" data-tutup-form aria-label="Tutup">&times;</button>' +
        '</div>' +
        '<div class="popup-form-badan"></div>' +
      '</div>';
    document.body.appendChild(tirai);

    jendela = tirai.querySelector('.popup-form');
    judulEl = tirai.querySelector('#popup-form-judul');
    badanEl = tirai.querySelector('.popup-form-badan');

    tirai.addEventListener('click', function (e) {
      if (e.target === tirai || (e.target.closest && e.target.closest('[data-tutup-form]'))) {
        e.preventDefault();
        tutupPopupForm();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sedangBuka) {
        var tiraiIkon = badanEl && badanEl.querySelector('#popup-ikon.tampil');
        if (tiraiIkon) {
          tiraiIkon.classList.remove('tampil');
          tiraiIkon.hidden = true;
          return;
        }
        tutupPopupForm();
      }
    });
  }

  function tampilkanMuat() {
    badanEl.innerHTML =
      '<div class="popup-form-muat">' +
        '<div class="popup-spinner" aria-hidden="true"></div>' +
        '<p class="popup-form-muat-teks">Memuat formulir...</p>' +
      '</div>';
  }

  function tampilkanGalatMuat(alamat) {
    badanEl.innerHTML =
      '<div class="popup-form-muat">' +
        '<p class="kesalahan" style="margin:0 0 12px">Gagal memuat formulir. Periksa sambungan Anda.</p>' +
        '<div class="tombol-baris" style="justify-content:center">' +
          '<button type="button" class="tombol" data-coba-lagi="' + alamat + '"><i class="bx bx-refresh"></i> Coba lagi</button>' +
          '<a href="' + alamat + '" class="tombol tombol-samar">Buka halaman penuh</a>' +
        '</div>' +
      '</div>';
    var tombolCoba = badanEl.querySelector('[data-coba-lagi]');
    if (tombolCoba) {
      tombolCoba.addEventListener('click', function () {
        muatFormulir(alamat);
      });
    }
  }

  function rakitIsiFormulir(dok, alamatAsal) {
    var h1 = dok.querySelector('.isi-atas h1');
    if (h1 && h1.textContent.trim()) {
      judulEl.textContent = h1.textContent.trim();
    }

    var isi = dok.querySelector('main.isi') || dok.body;
    var kartu = isi.querySelector('.kartu');
    var galatServer = isi.querySelector('.kesalahan');
    var popupIkon = isi.querySelector('#popup-ikon');

    if (!kartu) {
      window.location.href = alamatAsal;
      return;
    }

    var bungkus = document.createElement('div');
    bungkus.className = 'popup-form-isi';

    if (galatServer) {
      bungkus.appendChild(galatServer.cloneNode(true));
    }

    var kartuKlon = kartu.cloneNode(true);
    bungkus.appendChild(kartuKlon);

    if (popupIkon) {
      bungkus.appendChild(popupIkon.cloneNode(true));
    }

    badanEl.innerHTML = '';
    badanEl.appendChild(bungkus);

    // Ubah tautan "Batal" di dalam formulir menjadi tombol penutup popup.
    var tautanBatal = bungkus.querySelectorAll('.tombol-baris a.tombol-samar');
    for (var i = 0; i < tautanBatal.length; i++) {
      tautanBatal[i].addEventListener('click', function (e) {
        e.preventDefault();
        tutupPopupForm();
      });
    }

    // Aktifkan semua komponen interaktif di dalam formulir popup.
    siapkanZonaUnggah(bungkus);
    siapkanPratinjauGambar(bungkus);
    siapkanPemilihIkon(bungkus);
    if (typeof window.siapkanUnggahVideo === 'function') {
      window.siapkanUnggahVideo(bungkus);
    }

    // Tangani pengiriman formulir lewat fetch supaya kalau ada salah
    // isi tetap tampil di dalam popup, dan kalau berhasil langsung
    // memuat ulang halaman daftar dengan mulus.
    var form = bungkus.querySelector('form');
    if (form) {
      form.addEventListener('submit', function (e) {
        var kotakVideo = form.querySelector('[data-video-mengunggah]');
        if (kotakVideo) {
          e.preventDefault();
          return;
        }
        if (typeof window.fetch !== 'function' || typeof window.FormData !== 'function') {
          return;
        }
        e.preventDefault();
        kirimFormulirPopup(form, bungkus);
      });
    }

    // Fokuskan ke kolom masukan pertama.
    requestAnimationFrame(function () {
      var masukanPertama = bungkus.querySelector('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]), select, textarea');
      if (masukanPertama) {
        try { masukanPertama.focus(); } catch (_) {}
      }
    });
  }

  function kirimFormulirPopup(form, bungkus) {
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
      method: (form.getAttribute('method') || 'POST').toUpperCase(),
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
        return res.text().then(function (html) {
          return { res: res, html: html };
        });
      })
      .then(function (hasil) {
        var urlAkhir = hasil.res.url ? new URL(hasil.res.url, window.location.origin) : null;
        // Kalau server mengarahkan balik ke halaman daftar (bukan URL form),
        // segarkan halaman supaya daftar terbaru dan pita pemberitahuan tampil.
        if (hasil.res.redirected && urlAkhir && !SAH.test(urlAkhir.pathname)) {
          window.location.href = urlAkhir.pathname + urlAkhir.search;
          return;
        }
        // Kalau masih di URL form (misalnya status 400 karena validasi gagal),
        // tampilkan ulang formulir beserta pesan kesalahannya di dalam popup.
        var parser = new DOMParser();
        var dok = parser.parseFromString(hasil.html, 'text/html');
        if (dok.querySelector('main.isi .kartu')) {
          rakitIsiFormulir(dok, alamatKirim);
          badanEl.scrollTop = 0;
        } else {
          window.location.reload();
        }
      })
      .catch(function () {
        if (tombolSimpan) {
          tombolSimpan.disabled = false;
          tombolSimpan.innerHTML = htmlAwal;
        }
        var galatLama = bungkus.querySelector('.kesalahan');
        if (!galatLama) {
          galatLama = document.createElement('p');
          galatLama.className = 'kesalahan';
          bungkus.insertBefore(galatLama, bungkus.firstChild);
        }
        galatLama.textContent = 'Gagal menyimpan data. Periksa sambungan internet Anda lalu coba lagi.';
        badanEl.scrollTop = 0;
      });
  }

  function muatFormulir(alamat) {
    if (pengontrolFetch && typeof pengontrolFetch.abort === 'function') {
      pengontrolFetch.abort();
    }
    pengontrolFetch = typeof AbortController === 'function' ? new AbortController() : null;

    tampilkanMuat();

    var opsi = { credentials: 'same-origin' };
    if (pengontrolFetch) opsi.signal = pengontrolFetch.signal;

    fetch(alamat, opsi)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var dok = parser.parseFromString(html, 'text/html');
        rakitIsiFormulir(dok, alamat);
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        tampilkanGalatMuat(alamat);
      });
  }

  function bukaPopupForm(alamat, labelAwal) {
    pastikanPopup();
    if (pewaktuTutup) {
      clearTimeout(pewaktuTutup);
      pewaktuTutup = null;
    }

    judulEl.textContent = labelAwal || 'Formulir';
    tirai.hidden = false;
    tirai.classList.remove('menutup');
    document.body.classList.add('terkunci');
    sedangBuka = true;

    requestAnimationFrame(function () {
      tirai.classList.add('tampil');
    });

    muatFormulir(alamat);
  }

  function tutupPopupForm() {
    if (!tirai || !sedangBuka) return;
    sedangBuka = false;

    if (pengontrolFetch && typeof pengontrolFetch.abort === 'function') {
      pengontrolFetch.abort();
      pengontrolFetch = null;
    }

    tirai.classList.remove('tampil');
    tirai.classList.add('menutup');
    document.body.classList.remove('terkunci');

    pewaktuTutup = setTimeout(function () {
      pewaktuTutup = null;
      if (!sedangBuka) {
        tirai.hidden = true;
        tirai.classList.remove('menutup');
        badanEl.innerHTML = '';
      }
    }, 240);
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target) return;

    var url;
    try {
      url = new URL(a.href, window.location.origin);
    } catch (_) {
      return;
    }
    if (url.origin !== window.location.origin) return;
    if (!SAH.test(url.pathname)) return;

    // Kalau klik berasal dari dalam popup form itu sendiri, abaikan.
    if (tirai && tirai.contains(a)) return;

    e.preventDefault();
    var teksTombol = (a.textContent || '').replace(/\s+/g, ' ').trim();
    bukaPopupForm(url.pathname + url.search, teksTombol || 'Formulir');
  });
})();
