/* Panel admin — JavaScript sendiri, tanpa pustaka apa pun.

   DUA permintaan jaringan, dan hanya dua:

     1. sakelar "tampil" di tabel daftar (tahap 21)
     2. penanda "sudah dibaca" saat popup pesan dibuka (tahap 22)

   Keduanya memakai pola yang sama: fetch() ke alamat yang tertulis di
   atribut action formulir yang sudah ada di barisnya, dengan token
   CSRF yang diambil dari formulir itu juga. Alamatnya tidak pernah
   dirangkai dari potongan teks, dan tidak ada bagian lain di berkas
   ini yang menyentuh jaringan.

   Sampai tahap 20 berkas ini benar-benar nol jaringan. Kalimat itu
   sengaja diganti tiap kali angkanya berubah, bukan dibiarkan, supaya
   komentarnya tidak pernah menjanjikan sesuatu yang tidak benar.

   Selain kedua fetch itu: tidak ada XMLHttpRequest, WebSocket, import,
   maupun penyisipan <script>. Semua sisanya hanya mengubah DOM di
   halaman ini. Kalau berkas ini gagal dimuat, halaman tetap bisa
   dipakai lewat tautan dan formulir biasa -- termasuk sakelarnya,
   yang tanpa JavaScript terkirim sebagai formulir POST seperti dulu. */

(function () {
  'use strict';

  // Elemen yang hanya berguna kalau JavaScript hidup ditandai
  // atribut data-js. Berkas ini TIDAK perlu melakukan apa pun untuk
  // menampilkannya: elemen itu memang sudah tampil sejak awal, dan
  // yang menyembunyikannya adalah admin-assets/tanpa-js.css yang
  // hanya dimuat dari dalam <noscript>. Dengan begitu tidak ada
  // jeda antara halaman tergambar dan skrip berjalan, jadi tidak
  // ada kedipan.

  // =============================================================
  // Popup
  // =============================================================

  var popupTerbuka = null;
  var fokusSebelumnya = null;
  var pewaktuTutup = null;

  // Lama peralihan popup, harus sama dengan angka di admin.css.
  var LAMA_PERALIHAN = 200;

  function gerakanDimatikan() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function bukaPopup(tirai) {
    if (!tirai) return;

    // Kalau ada popup yang sedang dalam proses menutup, selesaikan dulu.
    if (pewaktuTutup) {
      clearTimeout(pewaktuTutup);
      pewaktuTutup = null;
    }

    fokusSebelumnya = document.activeElement;
    tirai.hidden = false;
    document.body.classList.add('terkunci');
    popupTerbuka = tirai;

    // Kelas .tampil dipasang pada bingkai berikutnya supaya peralihan
    // benar-benar berjalan, bukan langsung melompat ke keadaan akhir.
    if (gerakanDimatikan()) {
      tirai.classList.add('tampil');
    } else {
      // Satu bingkai sudah cukup; rAF bertingkat dua hanya menambah
      // jeda yang terasa tanpa manfaat.
      requestAnimationFrame(function () {
        tirai.classList.add('tampil');
      });
    }

    var pertama = tirai.querySelector('button, a[href], input, select, textarea');
    if (pertama) pertama.focus();
  }

  function tutupPopup() {
    if (!popupTerbuka) return;

    var tirai = popupTerbuka;
    popupTerbuka = null;
    tirai.classList.remove('tampil');
    document.body.classList.remove('terkunci');

    function sembunyikan() {
      pewaktuTutup = null;
      // Jangan sembunyikan kalau popup ini sempat dibuka lagi.
      if (!tirai.classList.contains('tampil')) tirai.hidden = true;
    }

    if (gerakanDimatikan()) {
      sembunyikan();
    } else {
      pewaktuTutup = setTimeout(sembunyikan, LAMA_PERALIHAN);
    }

    if (fokusSebelumnya && typeof fokusSebelumnya.focus === 'function') {
      fokusSebelumnya.focus();
    }
    fokusSebelumnya = null;
  }

  // Klik pada latar gelap menutup popup.
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('tirai')) {
      tutupPopup();
      return;
    }
    var tombolTutup = e.target.closest ? e.target.closest('[data-tutup]') : null;
    if (tombolTutup) {
      e.preventDefault();
      tutupPopup();
    }
  });

  // Escape menutup popup, atau mengosongkan kotak pencarian.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (popupTerbuka) {
      tutupPopup();
      return;
    }
    var cari = document.getElementById('cari-daftar');
    if (cari && cari.value !== '') {
      cari.value = '';
      terapkanSaring();
      cari.focus();
    }
  });

  // Popup dipakai juga oleh blok lain di berkas ini (pemilih ikon,
  // rincian pesan). Diberikan lewat satu titik masuk kecil, bukan
  // dengan menaruh banyak fungsi di lingkup global.
  window.panelAdmin = { bukaPopup: bukaPopup, tutupPopup: tutupPopup };

  // =============================================================
  // Laci sidebar untuk layar sempit
  // =============================================================

  (function () {
    var tombolLaci = document.getElementById('tombol-laci');
    var tiraiLaci = document.getElementById('tirai-laci');
    if (!tombolLaci || !tiraiLaci) return;

    function bukaLaci() {
      document.body.classList.add('laci-terbuka');
      tiraiLaci.hidden = false;
      tombolLaci.setAttribute('aria-expanded', 'true');
    }

    function tutupLaci() {
      document.body.classList.remove('laci-terbuka');
      tiraiLaci.hidden = true;
      tombolLaci.setAttribute('aria-expanded', 'false');
    }

    tombolLaci.addEventListener('click', function () {
      if (document.body.classList.contains('laci-terbuka')) tutupLaci();
      else bukaLaci();
    });

    tiraiLaci.addEventListener('click', tutupLaci);

    // Escape menutup laci. Popup ditangani lebih dulu di penangan
    // keydown utama, jadi keduanya tidak saling bertabrakan.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('laci-terbuka')) {
        tutupLaci();
      }
    });

    // Menutup laci begitu pengunjung memilih halaman.
    var sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.addEventListener('click', function (e) {
        var tautan = e.target.closest ? e.target.closest('a') : null;
        if (tautan && !tautan.classList.contains('mati')) tutupLaci();
      });
    }
  })();

  // =============================================================
  // Halaman daftar karya
  // =============================================================

  var tabel = document.getElementById('tabel-daftar');
  var badan = document.getElementById('badan-daftar');
  if (!tabel || !badan) return;

  var semuaBaris = Array.prototype.slice.call(badan.querySelectorAll('tr'));
  var urutanAwal = semuaBaris.slice();

  // Kotak centang tiap baris dicari SEKALI di awal, lalu disimpan.
  // Sebelumnya querySelector dipanggil ulang di dalam setiap
  // perulangan, jadi mencentang semua memicu puluhan penelusuran DOM
  // yang hasilnya selalu sama.
  var kotakDari = new WeakMap();
  semuaBaris.forEach(function (tr) {
    kotakDari.set(tr, tr.querySelector('.centang-baris'));
  });

  var kotakCari = document.getElementById('cari-daftar');
  var tombolBersih = document.getElementById('cari-bersih');
  var labelHitung = document.getElementById('hitung-tampil');
  var pesanTakCocok = document.getElementById('tak-cocok');
  var bungkusTabel = tabel.parentNode;

  var centangSemua = document.getElementById('centang-semua');
  var batangTerpilih = document.getElementById('batang-terpilih');
  var labelTerpilih = document.getElementById('jumlah-terpilih');

  var batangUrutan = document.getElementById('batang-urutan');
  var medanUrutanIds = document.getElementById('urutan-ids');
  var slotBatang = document.getElementById('slot-batang');

  // Slot hanya diberi jarak bawah kalau ada batang yang tampil,
  // supaya saat kosong ia runtuh ke tinggi nol tanpa celah.
  function perbaruiSlot() {
    if (!slotBatang) return;
    var adaIsi =
      (batangTerpilih && !batangTerpilih.hidden) || (batangUrutan && !batangUrutan.hidden);
    slotBatang.classList.toggle('slot-batang-berisi', Boolean(adaIsi));
  }

  var kolomUrut = null; // nama kolom yang sedang dipakai mengurutkan
  var arahUrut = 1; // 1 = naik, -1 = turun
  var urutanBerubah = false;

  function barisTerlihat() {
    return semuaBaris.filter(function (tr) {
      return !tr.hidden;
    });
  }

  // -------------------------------------------------------------
  // Pencarian langsung (murni di sisi peramban)
  // -------------------------------------------------------------

  // Sembunyikan baris setelah peralihan pudarnya selesai.
  function jadwalSembunyi(tr) {
    setTimeout(function () {
      if (tr.classList.contains('menghilang')) tr.hidden = true;
    }, 160);
  }

  function terapkanSaring() {
    var kata = kotakCari ? kotakCari.value.trim().toLowerCase() : '';
    // Dibaca sekali saja, bukan sekali per baris.
    var kurangiGerak = gerakanDimatikan();
    var i;
    var tr;

    // --- Tahap 1: HANYA MEMBACA. Tidak ada gaya atau kelas yang
    // diubah di sini, jadi peramban tidak perlu menghitung ulang
    // tata letak di tengah perulangan. ---
    var keputusan = new Array(semuaBaris.length);
    var cocok = 0;
    for (i = 0; i < semuaBaris.length; i++) {
      tr = semuaBaris[i];
      // data-cari sudah berisi seluruh teks yang boleh dicari,
      // dirakit oleh tampilan masing-masing halaman.
      var teks = (tr.getAttribute('data-cari') || '').toLowerCase();

      var lolos = kata === '' || teks.indexOf(kata) !== -1;
      if (lolos) cocok++;
      keputusan[i] = { tr: tr, lolos: lolos, tadinyaTersembunyi: tr.hidden };
    }

    // --- Tahap 2: HANYA MENULIS. ---
    var akanMuncul = [];
    for (i = 0; i < keputusan.length; i++) {
      var k = keputusan[i];
      tr = k.tr;

      if (k.lolos) {
        tr.classList.remove('menghilang');
        if (k.tadinyaTersembunyi) {
          tr.classList.remove('muncul');
          tr.hidden = false;
          if (!kurangiGerak) akanMuncul.push(tr);
        }
      } else {
        // Baris yang disembunyikan tidak boleh ikut terpilih,
        // supaya tidak ada yang terhapus tanpa terlihat.
        var kotak = kotakDari.get(tr);
        if (kotak && kotak.checked) kotak.checked = false;

        if (!k.tadinyaTersembunyi) {
          tr.classList.remove('muncul');
          if (kurangiGerak) {
            tr.hidden = true;
          } else {
            tr.classList.add('menghilang');
            jadwalSembunyi(tr);
          }
        }
      }
    }

    // --- Tahap 3: animasi muncul dinyalakan sekali untuk semua
    // baris sekaligus, pada bingkai berikutnya. Ini menggantikan
    // pemaksaan hitung ulang (void tr.offsetWidth) yang dulu
    // dijalankan sekali per baris. ---
    if (akanMuncul.length > 0) {
      requestAnimationFrame(function () {
        for (var j = 0; j < akanMuncul.length; j++) {
          akanMuncul[j].classList.add('muncul');
        }
      });
    }

    if (labelHitung) {
      var total = labelHitung.getAttribute('data-total');
      labelHitung.textContent = 'menampilkan ' + cocok + ' dari ' + total;
    }
    if (pesanTakCocok) pesanTakCocok.hidden = cocok !== 0;
    if (bungkusTabel) bungkusTabel.hidden = cocok === 0;

    // Tombol bersihkan hanya muncul kalau kotaknya berisi.
    if (tombolBersih) tombolBersih.hidden = kata === '';

    perbaruiTerpilih();
    perbaruiIzinSeret();
  }

  if (kotakCari) {
    kotakCari.addEventListener('input', terapkanSaring);
  }

  // Tombol bersihkan di dalam kotak pencarian. Perilakunya sama
  // dengan menekan Escape: kosongkan lalu tampilkan semua baris.
  if (tombolBersih && kotakCari) {
    tombolBersih.addEventListener('click', function () {
      kotakCari.value = '';
      terapkanSaring();
      kotakCari.focus();
    });
  }

  // -------------------------------------------------------------
  // Pengurutan tampilan (tidak mengubah data)
  // -------------------------------------------------------------

  function nilaiKolom(tr, nama, jenis) {
    var mentah = tr.getAttribute('data-' + nama) || '';
    if (jenis === 'angka') {
      var n = parseFloat(mentah);
      return isNaN(n) ? 0 : n;
    }
    return mentah.toLowerCase();
  }

  function urutkan(nama, jenis) {
    if (kolomUrut === nama) {
      urutkanKe(nama, jenis, -arahUrut);
    } else {
      urutkanKe(nama, jenis, 1);
    }
  }

  // Mengurutkan ke arah tertentu. Dipakai oleh kepala kolom (lewat
  // urutkan, yang membalik arah) dan oleh kotak pilihan di ponsel
  // yang menyebut arahnya secara langsung.
  function urutkanKe(nama, jenis, arah) {
    kolomUrut = nama;
    arahUrut = arah;

    var disalin = semuaBaris.slice();
    disalin.sort(function (a, b) {
      var x = nilaiKolom(a, nama, jenis);
      var y = nilaiKolom(b, nama, jenis);
      if (x < y) return -1 * arahUrut;
      if (x > y) return 1 * arahUrut;
      // Seri: jaga urutan asli supaya hasilnya tetap sama tiap kali.
      return urutanAwal.indexOf(a) - urutanAwal.indexOf(b);
    });

    disalin.forEach(function (tr) {
      badan.appendChild(tr);
    });
    semuaBaris = disalin;

    tabel.querySelectorAll('th.bisa-urut').forEach(function (th) {
      th.classList.remove('urut-naik', 'urut-turun');
      if (th.getAttribute('data-urut') === nama) {
        th.classList.add(arahUrut === 1 ? 'urut-naik' : 'urut-turun');
      }
    });

    perbaruiIzinSeret();
  }

  // Kotak pilihan urut untuk layar sempit, tempat kepala tabel
  // disembunyikan. Memakai fungsi pengurut yang sama persis.
  var pilihUrut = document.getElementById('urut-ponsel');
  if (pilihUrut) {
    pilihUrut.addEventListener('change', function () {
      var nilai = pilihUrut.value;
      if (!nilai) {
        // Kembali ke urutan bawaan dari server.
        urutanAwal.forEach(function (tr) {
          badan.appendChild(tr);
        });
        semuaBaris = urutanAwal.slice();
        kolomUrut = null;
        tabel.querySelectorAll('th.bisa-urut').forEach(function (th) {
          th.classList.remove('urut-naik', 'urut-turun');
        });
        perbaruiIzinSeret();
        return;
      }
      var bagian = nilai.split('|');
      urutkanKe(bagian[0], bagian[1], Number(bagian[2]));
    });
  }

  tabel.querySelectorAll('th.bisa-urut').forEach(function (th) {
    th.setAttribute('tabindex', '0');
    th.setAttribute('role', 'button');
    th.addEventListener('click', function () {
      urutkan(th.getAttribute('data-urut'), th.getAttribute('data-jenis'));
    });
    th.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        urutkan(th.getAttribute('data-urut'), th.getAttribute('data-jenis'));
      }
    });
  });

  // -------------------------------------------------------------
  // Menyeret baris untuk mengubah kolom urutan
  // -------------------------------------------------------------

  // Menyeret hanya diizinkan saat tabel dalam keadaan apa adanya:
  // tanpa pencarian aktif dan tanpa pengurutan kolom lain. Kalau
  // tidak, menyimpan urutan bisa menomori ulang seluruh tabel
  // dengan cara yang tidak diduga pengguna.
  function bolehSeret() {
    var adaCari = kotakCari && kotakCari.value.trim() !== '';
    var adaUrut = kolomUrut !== null && kolomUrut !== 'urutan';
    return !adaCari && !adaUrut;
  }

  var izinSeretTerakhir = null;

  function perbaruiIzinSeret() {
    var boleh = bolehSeret();
    // Kalau keadaannya tidak berubah, tidak perlu menyentuh 23 baris.
    if (boleh === izinSeretTerakhir) return;
    izinSeretTerakhir = boleh;

    for (var i = 0; i < semuaBaris.length; i++) {
      semuaBaris[i].draggable = boleh;
    }
    tabel.classList.toggle('seret-mati', !boleh);
  }

  var barisDiseret = null;

  badan.addEventListener('dragstart', function (e) {
    var tr = e.target.closest ? e.target.closest('tr') : null;
    if (!tr || !bolehSeret()) {
      e.preventDefault();
      return;
    }
    barisDiseret = tr;
    tr.classList.add('sedang-diseret');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Sebagian peramban perlu data apa pun agar seret berjalan.
      try {
        e.dataTransfer.setData('text/plain', tr.getAttribute('data-id') || '');
      } catch (_) {}
    }
  });

  badan.addEventListener('dragover', function (e) {
    if (!barisDiseret) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    var target = e.target.closest ? e.target.closest('tr') : null;
    if (!target || target === barisDiseret || target.parentNode !== badan) return;

    var kotak = target.getBoundingClientRect();
    var diBawah = e.clientY > kotak.top + kotak.height / 2;
    badan.insertBefore(barisDiseret, diBawah ? target.nextSibling : target);
  });

  badan.addEventListener('drop', function (e) {
    if (!barisDiseret) return;
    e.preventDefault();
  });

  badan.addEventListener('dragend', function () {
    if (!barisDiseret) return;
    barisDiseret.classList.remove('sedang-diseret');
    barisDiseret = null;

    semuaBaris = Array.prototype.slice.call(badan.querySelectorAll('tr'));
    tandaiUrutanBerubah();
  });

  function tandaiUrutanBerubah() {
    var sekarang = semuaBaris.map(function (tr) {
      return tr.getAttribute('data-id');
    }).join(',');
    var awal = urutanAwal.map(function (tr) {
      return tr.getAttribute('data-id');
    }).join(',');

    urutanBerubah = sekarang !== awal;
    if (batangUrutan) batangUrutan.hidden = !urutanBerubah;
    perbaruiSlot();
    if (medanUrutanIds) medanUrutanIds.value = sekarang;
  }

  var tombolBatalUrutan = document.getElementById('tombol-batal-urutan');
  if (tombolBatalUrutan) {
    tombolBatalUrutan.addEventListener('click', function () {
      urutanAwal.forEach(function (tr) {
        badan.appendChild(tr);
      });
      semuaBaris = urutanAwal.slice();
      kolomUrut = null;
      tabel.querySelectorAll('th.bisa-urut').forEach(function (th) {
        th.classList.remove('urut-naik', 'urut-turun');
      });
      tandaiUrutanBerubah();
      perbaruiIzinSeret();
    });
  }

  // -------------------------------------------------------------
  // Memilih banyak baris
  // -------------------------------------------------------------

  function idTerpilih() {
    var hasil = [];
    for (var i = 0; i < semuaBaris.length; i++) {
      var tr = semuaBaris[i];
      if (tr.hidden) continue;
      var kotak = kotakDari.get(tr);
      if (kotak && kotak.checked) hasil.push(tr.getAttribute('data-id'));
    }
    return hasil;
  }

  // Satu lintasan saja. Versi lama melakukan empat lintasan
  // (idTerpilih, barisTerlihat, lalu filter lagi) dan memanggil
  // querySelector di setiap lintasan.
  function perbaruiTerpilih() {
    var jumlahTerlihat = 0;
    var jumlahTercentang = 0;

    for (var i = 0; i < semuaBaris.length; i++) {
      var tr = semuaBaris[i];
      if (tr.hidden) continue;
      jumlahTerlihat++;
      var kotak = kotakDari.get(tr);
      if (kotak && kotak.checked) jumlahTercentang++;
    }

    if (labelTerpilih) labelTerpilih.textContent = String(jumlahTercentang);
    if (batangTerpilih) batangTerpilih.hidden = jumlahTercentang === 0;
    perbaruiSlot();

    if (centangSemua) {
      centangSemua.checked = jumlahTerlihat > 0 && jumlahTercentang === jumlahTerlihat;
      centangSemua.indeterminate = jumlahTercentang > 0 && jumlahTercentang < jumlahTerlihat;
    }
  }

  badan.addEventListener('change', function (e) {
    if (e.target.classList && e.target.classList.contains('centang-baris')) {
      perbaruiTerpilih();
    }
  });

  if (centangSemua) {
    centangSemua.addEventListener('change', function () {
      // Satu lintasan: ubah semua centang dulu sambil menghitung,
      // tanpa memanggil ulang fungsi penghitung per baris dan tanpa
      // lintasan tambahan lewat barisTerlihat().
      var mau = centangSemua.checked;
      var jumlahTerlihat = 0;

      for (var i = 0; i < semuaBaris.length; i++) {
        var tr = semuaBaris[i];
        if (tr.hidden) continue; // hanya baris yang terlihat
        jumlahTerlihat++;
        var kotak = kotakDari.get(tr);
        if (kotak && kotak.checked !== mau) kotak.checked = mau;
      }

      // Hitung sekali di akhir, tanpa melintasi DOM lagi.
      var jumlahTercentang = mau ? jumlahTerlihat : 0;
      if (labelTerpilih) labelTerpilih.textContent = String(jumlahTercentang);
      if (batangTerpilih) batangTerpilih.hidden = jumlahTercentang === 0;
      perbaruiSlot();
      centangSemua.checked = jumlahTerlihat > 0 && mau;
      centangSemua.indeterminate = false;
    });
  }

  var tombolBatalPilih = document.getElementById('tombol-batal-pilih');
  if (tombolBatalPilih) {
    tombolBatalPilih.addEventListener('click', function () {
      for (var i = 0; i < semuaBaris.length; i++) {
        var kotak = kotakDari.get(semuaBaris[i]);
        if (kotak && kotak.checked) kotak.checked = false;
      }
      if (labelTerpilih) labelTerpilih.textContent = '0';
      if (batangTerpilih) batangTerpilih.hidden = true;
      perbaruiSlot();
      if (centangSemua) {
        centangSemua.checked = false;
        centangSemua.indeterminate = false;
      }
    });
  }

  // -------------------------------------------------------------
  // Popup: lihat karya
  // -------------------------------------------------------------

  function cariBaris(id) {
    return semuaBaris.filter(function (tr) {
      return tr.getAttribute('data-id') === String(id);
    })[0];
  }

  function isiTeks(id, teks) {
    var el = document.getElementById(id);
    if (el) el.textContent = teks;
  }

  function bukaLihat(id) {
    var tr = cariBaris(id);
    if (!tr) return;

    var gambar = tr.getAttribute('data-gambar') || '';
    var elGambar = document.getElementById('lihat-gambar');
    var elTanpa = document.getElementById('lihat-tanpa-gambar');

    if (gambar) {
      elGambar.src = '/' + gambar;
      elGambar.hidden = false;
      elTanpa.hidden = true;
    } else {
      elGambar.removeAttribute('src');
      elGambar.hidden = true;
      elTanpa.hidden = false;
    }

    isiTeks('lihat-judul', tr.getAttribute('data-judul') || '(tanpa judul)');
    isiTeks('lihat-nilai-judul', tr.getAttribute('data-judul') || '—');
    isiTeks('lihat-nilai-subjudul', tr.getAttribute('data-subjudul') || '—');
    isiTeks('lihat-nilai-kategori', tr.getAttribute('data-kategori') || 'tanpa kategori');
    isiTeks('lihat-nilai-urutan', tr.getAttribute('data-urutan') || '—');
    isiTeks('lihat-nilai-tanggal', tr.getAttribute('data-tanggal') || '—');
    isiTeks('lihat-nilai-status', tr.getAttribute('data-tampil') === '1' ? 'tampil' : 'disembunyikan');
    isiTeks('lihat-nilai-berkas', gambar || 'tidak ada gambar');

    var sunting = document.getElementById('lihat-tautan-sunting');
    if (sunting) sunting.href = '/admin/karya/' + id + '/sunting';

    bukaPopup(document.getElementById('popup-lihat'));
  }

  // -------------------------------------------------------------
  // Popup: hapus satu
  // -------------------------------------------------------------

  function bukaHapus(id) {
    var tr = cariBaris(id);
    if (!tr) return;

    var gambar = tr.getAttribute('data-gambar') || '';
    var unggahan = tr.getAttribute('data-unggahan') === '1';

    var elGambar = document.getElementById('hapus-gambar');
    if (gambar) {
      elGambar.src = '/' + gambar;
      elGambar.hidden = false;
    } else {
      elGambar.removeAttribute('src');
      elGambar.hidden = true;
    }

    isiTeks('hapus-nama-karya', tr.getAttribute('data-nama') || '(tanpa nama)');
    isiTeks(
      'hapus-keterangan-berkas',
      !gambar
        ? 'Karya ini tidak punya berkas gambar.'
        : unggahan
        ? gambar + ' — berkasnya ikut dihapus dari storage/uploads/.'
        : gambar + ' — berkasnya TIDAK dihapus, karena milik situs publik.'
    );

    var form = document.getElementById('form-hapus-satu');
    if (form) form.action = '/admin/karya/' + id + '/hapus';

    bukaPopup(document.getElementById('popup-hapus'));
  }

  // -------------------------------------------------------------
  // Popup: hapus banyak
  // -------------------------------------------------------------

  function bukaHapusBanyak() {
    var ids = idTerpilih();
    if (ids.length === 0) return;

    isiTeks('hb-kalimat', ids.length + ' karya akan dihapus dari database. Tindakan ini tidak bisa dibatalkan.');

    var daftar = document.getElementById('hb-daftar');
    daftar.textContent = '';
    var jumlahUnggahan = 0;

    ids.forEach(function (id) {
      var tr = cariBaris(id);
      if (!tr) return;
      if (tr.getAttribute('data-unggahan') === '1') jumlahUnggahan++;
      var li = document.createElement('li');
      li.textContent = tr.getAttribute('data-nama') || '(tanpa nama)';
      daftar.appendChild(li);
    });

    var adaGambar = ids.some(function (id) {
      var t = cariBaris(id);
      return t && t.getAttribute('data-gambar');
    });

    if (adaGambar) {
      var jumlahPublik = ids.length - jumlahUnggahan;
      isiTeks(
        'hb-catatan-berkas',
        jumlahUnggahan + ' berkas gambar di storage/uploads/ ikut dihapus. ' +
          jumlahPublik + ' gambar milik situs publik di assets/ tidak disentuh.'
      );
    } else {
      // Daftar tanpa gambar: pakai catatan akibat khusus halaman ini.
      isiTeks('hb-catatan-berkas', tabel.getAttribute('data-catatan-hapus') || '');
    }

    document.getElementById('hb-ids').value = ids.join(',');
    bukaPopup(document.getElementById('popup-hapus-banyak'));
  }

  var tombolHapusBanyak = document.getElementById('tombol-hapus-banyak');
  if (tombolHapusBanyak) {
    tombolHapusBanyak.addEventListener('click', bukaHapusBanyak);
  }

  // -------------------------------------------------------------
  // Penghubung klik pada tabel
  // -------------------------------------------------------------

  tabel.addEventListener('click', function (e) {
    var lihat = e.target.closest ? e.target.closest('[data-lihat]') : null;
    if (lihat) {
      e.preventDefault();
      bukaLihat(lihat.getAttribute('data-lihat'));
      return;
    }

    var hapus = e.target.closest ? e.target.closest('[data-hapus]') : null;
    if (hapus) {
      // Kalau penghapusannya berdampak ke tabel lain, biarkan tautan
      // berjalan biasa ke halaman konfirmasi penuh yang menyebutkan
      // berapa baris lain yang terpengaruh.
      if (hapus.hasAttribute('data-hapus-halaman')) return;

      // Tanpa JavaScript, tautan ini juga tetap membuka halaman
      // konfirmasi biasa.
      e.preventDefault();
      bukaHapus(hapus.getAttribute('data-hapus'));
    }
  });

  // -------------------------------------------------------------
  // Keadaan awal
  // -------------------------------------------------------------

  perbaruiIzinSeret();
  terapkanSaring();
  tandaiUrutanBerubah();
})();

/* =================================================================
   Pemangkas foto profil, berbentuk popup.

   Begitu sebuah berkas dipilih di medan #foto, popup langsung
   terbuka. Semua pekerjaan dilakukan di peramban memakai canvas
   bawaan; tidak ada permintaan jaringan.

   TIDAK ADA penyaringan jenis berkas di sini. Apa pun yang bisa
   dibaca peramban sebagai gambar bisa dipangkas, termasuk webp.
   Batas ukuran dan jenis berkas tetap diperiksa ulang di server
   oleh src/unggah.js; pemangkasan ini kenyamanan, bukan pengaman.

   Kalau berkas ini gagal dimuat, popup tidak pernah terbuka dan
   formulir akun tetap mengirim berkas asli apa adanya.
   ================================================================= */

(function () {
  'use strict';

  // Sisi area pangkas. Lingkaran pemotongnya berdiameter sama, jadi
  // yang tersimpan persis kotak pembatas lingkaran itu -- sama
  // seperti rancangan lama, hanya lebih besar (dulu 240).
  var UKURAN_AREA = 320;
  var UKURAN_PRATINJAU = 64;
  var UKURAN_HASIL = 512; // hasil akhir persegi 512x512
  var MUTU_JPEG = 0.85;

  var medanBerkas = document.getElementById('foto');
  var tirai = document.getElementById('popup-pangkas');
  var kanvas = document.getElementById('pangkas-kanvas');
  var pratinjau = document.getElementById('pangkas-pratinjau');
  var penggeser = document.getElementById('pangkas-zum');
  var tombolAturUlang = document.getElementById('pangkas-atur-ulang');
  var tombolPakai = document.getElementById('pangkas-pakai');
  var tombolBatal = document.getElementById('pangkas-batal');
  var labelNama = document.getElementById('pangkas-berkas-nama');
  var labelUkuran = document.getElementById('pangkas-berkas-ukuran');
  var kotakHasil = document.getElementById('pangkas-hasil');
  var gambarHasil = document.getElementById('pangkas-hasil-gambar');
  var namaHasil = document.getElementById('pangkas-hasil-nama');
  var tombolBatalHasil = document.getElementById('pangkas-hasil-batal');
  var pesanGagal = document.getElementById('pangkas-gagal');

  if (!medanBerkas || !tirai || !kanvas || !pratinjau) return;
  if (!kanvas.getContext || typeof kanvas.toBlob !== 'function') return;

  var ctx = kanvas.getContext('2d');
  var ctxPratinjau = pratinjau.getContext('2d');

  var gambar = null; // objek Image yang sedang dipangkas
  var berkasAsli = null; // File yang dipilih pengguna
  var skalaDasar = 1; // skala terkecil yang masih menutupi lingkaran
  var zum = 1; // pengali di atas skalaDasar
  var geserX = 0; // pergeseran pusat gambar terhadap pusat area
  var geserY = 0;
  var menggambarTertunda = false;

  // Layar beresolusi tinggi: kanvas digambar lebih rapat, tapi
  // perhitungan tetap memakai piksel CSS.
  var rasio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  function siapkanKanvas(el, sisi) {
    el.width = Math.round(sisi * rasio);
    el.height = Math.round(sisi * rasio);
    el.style.width = sisi + 'px';
    el.style.height = sisi + 'px';
  }

  // ---------------------------------------------------------------
  // Batas geseran
  // ---------------------------------------------------------------

  // Gambar tidak boleh digeser sampai tepinya masuk ke dalam
  // lingkaran. Kedua fungsi di bawah disalin apa adanya dari
  // rancangan sebelumnya; yang berubah hanya nilai UKURAN_AREA.
  function batasGeser() {
    var lebar = gambar.naturalWidth * skalaDasar * zum;
    var tinggi = gambar.naturalHeight * skalaDasar * zum;
    return {
      x: Math.max(0, (lebar - UKURAN_AREA) / 2),
      y: Math.max(0, (tinggi - UKURAN_AREA) / 2),
    };
  }

  function jepitGeser() {
    var b = batasGeser();
    if (geserX > b.x) geserX = b.x;
    if (geserX < -b.x) geserX = -b.x;
    if (geserY > b.y) geserY = b.y;
    if (geserY < -b.y) geserY = -b.y;
  }

  // ---------------------------------------------------------------
  // Menggambar
  // ---------------------------------------------------------------

  function gambarKe(konteks, sisi) {
    var f = sisi / UKURAN_AREA; // faktor terhadap ukuran area di layar
    var lebar = gambar.naturalWidth * skalaDasar * zum * f;
    var tinggi = gambar.naturalHeight * skalaDasar * zum * f;
    var x = sisi / 2 + geserX * f - lebar / 2;
    var y = sisi / 2 + geserY * f - tinggi / 2;

    konteks.setTransform(rasio, 0, 0, rasio, 0, 0);
    konteks.clearRect(0, 0, sisi, sisi);
    konteks.imageSmoothingEnabled = true;
    konteks.imageSmoothingQuality = 'high';
    konteks.drawImage(gambar, x, y, lebar, tinggi);
  }

  // Menggambar dijadwalkan satu kali per bingkai, supaya seretan
  // yang datang lebih sering daripada bingkai layar tidak menggambar
  // ulang kedua kanvas berkali-kali untuk bingkai yang sama.
  function jadwalkanGambar() {
    if (menggambarTertunda || !gambar) return;
    menggambarTertunda = true;
    requestAnimationFrame(function () {
      menggambarTertunda = false;
      gambarKe(ctx, UKURAN_AREA);
      gambarKe(ctxPratinjau, UKURAN_PRATINJAU);
    });
  }

  // ---------------------------------------------------------------
  // Memuat berkas dan membuka popup
  // ---------------------------------------------------------------

  function ukuranTerbaca(byte) {
    if (byte < 1024) return byte + ' B';
    if (byte < 1024 * 1024) return (byte / 1024).toFixed(1) + ' KB';
    return (byte / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function aturUlang() {
    if (!gambar) return;
    skalaDasar = Math.max(
      UKURAN_AREA / gambar.naturalWidth,
      UKURAN_AREA / gambar.naturalHeight
    );
    zum = 1;
    geserX = 0;
    geserY = 0;
    if (penggeser) penggeser.value = '100';
    jadwalkanGambar();
  }

  function tampilkanGagal(pesan) {
    if (!pesanGagal) return;
    pesanGagal.textContent = pesan;
    pesanGagal.hidden = false;
  }

  function bersihkanGagal() {
    if (pesanGagal) pesanGagal.hidden = true;
  }

  // Mengosongkan pilihan berkas, supaya tidak ada berkas menggantung
  // yang ikut terkirim tanpa dipangkas.
  function kosongkanPilihan() {
    berkasAsli = null;
    gambar = null;
    try {
      medanBerkas.value = '';
    } catch (_) {}
    if (kotakHasil) kotakHasil.hidden = true;
    if (gambarHasil) gambarHasil.removeAttribute('src');
  }

  medanBerkas.addEventListener('change', function () {
    bersihkanGagal();

    var berkas = medanBerkas.files && medanBerkas.files[0];
    if (!berkas) {
      kosongkanPilihan();
      return;
    }

    berkasAsli = berkas;
    var alamat = URL.createObjectURL(berkas);
    var img = new Image();

    img.onload = function () {
      URL.revokeObjectURL(alamat);
      gambar = img;

      siapkanKanvas(kanvas, UKURAN_AREA);
      siapkanKanvas(pratinjau, UKURAN_PRATINJAU);
      if (labelNama) labelNama.textContent = berkas.name;
      if (labelUkuran) labelUkuran.textContent = ukuranTerbaca(berkas.size);

      aturUlang();
      window.panelAdmin.bukaPopup(tirai);
    };

    img.onerror = function () {
      gambar = null;

      // Keterangan lengkap ke konsol peramban, supaya kalau gagal
      // lagi penyebabnya langsung terlihat tanpa menebak. Yang
      // paling sering: Content-Security-Policy memblokir skema
      // blob: di img-src, dan itu menggagalkan SEMUA format.
      // Alamatnya sengaja dicatat SEBELUM dicabut.
      try {
        console.error(
          '[pemangkas] gambar gagal dimuat\n' +
            '  nama   : ' + berkas.name + '\n' +
            '  tipe   : ' + (berkas.type || '(tidak diketahui)') + '\n' +
            '  ukuran : ' + berkas.size + ' byte (' + ukuranTerbaca(berkas.size) + ')\n' +
            '  alamat : ' + alamat + '\n' +
            '  Kalau di atas ini ada pesan "Refused to load the image ... ' +
            'Content Security Policy", berarti skema blob: belum diizinkan ' +
            'di arahan img-src.'
        );
      } catch (_) {}

      URL.revokeObjectURL(alamat);

      // Dulu keadaan ini hanya menyembunyikan pemangkas tanpa
      // mengatakan apa-apa, jadi tampak seperti "tidak terjadi
      // apa-apa". Sekarang selalu ada keterangan.
      tampilkanGagal(
        'Peramban ini tidak bisa menampilkan "' + berkas.name + '", jadi fotonya tidak ' +
          'bisa diatur di sini. Buka konsol peramban (F12) untuk keterangan lengkapnya. ' +
          'Berkas aslinya tetap akan dikirim apa adanya saat Simpan ditekan, dan server ' +
          'yang akan memeriksanya.'
      );
    };

    img.src = alamat;
  });

  if (tombolAturUlang) tombolAturUlang.addEventListener('click', aturUlang);

  // ---------------------------------------------------------------
  // Perbesar lewat penggeser dan roda tetikus
  // ---------------------------------------------------------------

  function setZum(nilai) {
    var lama = zum;
    zum = Math.max(1, Math.min(3, nilai));
    // Pertahankan titik tengah: geseran ikut diskalakan.
    if (lama > 0) {
      geserX = (geserX / lama) * zum;
      geserY = (geserY / lama) * zum;
    }
    jepitGeser();
    if (penggeser) penggeser.value = String(Math.round(zum * 100));
    jadwalkanGambar();
  }

  if (penggeser) {
    penggeser.addEventListener('input', function () {
      setZum(Number(penggeser.value) / 100);
    });
  }

  kanvas.addEventListener(
    'wheel',
    function (e) {
      if (!gambar) return;
      e.preventDefault();
      setZum(zum * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    },
    { passive: false }
  );

  // ---------------------------------------------------------------
  // Menggeser dengan tetikus, pena, atau satu jari;
  // memperbesar dengan cubitan dua jari.
  // ---------------------------------------------------------------

  var penunjuk = new Map(); // pointerId -> {x, y}
  var jarakAwal = 0;
  var zumAwal = 1;
  var tengahTerakhir = null;

  function titikTengah() {
    var x = 0;
    var y = 0;
    penunjuk.forEach(function (p) {
      x += p.x;
      y += p.y;
    });
    return { x: x / penunjuk.size, y: y / penunjuk.size };
  }

  function jarakDua() {
    var arr = [];
    penunjuk.forEach(function (p) {
      arr.push(p);
    });
    if (arr.length < 2) return 0;
    var dx = arr[0].x - arr[1].x;
    var dy = arr[0].y - arr[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  kanvas.addEventListener('pointerdown', function (e) {
    if (!gambar) return;
    try {
      kanvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    penunjuk.set(e.pointerId, { x: e.clientX, y: e.clientY });

    tengahTerakhir = titikTengah();
    if (penunjuk.size === 2) {
      jarakAwal = jarakDua();
      zumAwal = zum;
    }
  });

  kanvas.addEventListener('pointermove', function (e) {
    if (!gambar || !penunjuk.has(e.pointerId)) return;
    e.preventDefault();
    penunjuk.set(e.pointerId, { x: e.clientX, y: e.clientY });

    var tengah = titikTengah();

    if (penunjuk.size >= 2 && jarakAwal > 0) {
      var jarakKini = jarakDua();
      zum = Math.max(1, Math.min(3, zumAwal * (jarakKini / jarakAwal)));
      if (penggeser) penggeser.value = String(Math.round(zum * 100));
    }

    if (tengahTerakhir) {
      geserX += tengah.x - tengahTerakhir.x;
      geserY += tengah.y - tengahTerakhir.y;
    }
    tengahTerakhir = tengah;

    jepitGeser();
    jadwalkanGambar();
  });

  function lepas(e) {
    if (!penunjuk.has(e.pointerId)) return;
    penunjuk.delete(e.pointerId);
    if (penunjuk.size === 0) {
      tengahTerakhir = null;
      jarakAwal = 0;
    } else {
      tengahTerakhir = titikTengah();
      if (penunjuk.size === 2) {
        jarakAwal = jarakDua();
        zumAwal = zum;
      }
    }
  }

  kanvas.addEventListener('pointerup', lepas);
  kanvas.addEventListener('pointercancel', lepas);

  // ---------------------------------------------------------------
  // Memakai hasil pangkasan
  // ---------------------------------------------------------------

  function gambarKeluaran() {
    var keluaran = document.createElement('canvas');
    keluaran.width = UKURAN_HASIL;
    keluaran.height = UKURAN_HASIL;
    var ctxKeluaran = keluaran.getContext('2d');

    // Latar putih supaya bagian tembus pandang pada PNG, GIF, atau
    // WebP tidak berubah jadi hitam saat disimpan sebagai JPEG.
    ctxKeluaran.fillStyle = '#ffffff';
    ctxKeluaran.fillRect(0, 0, UKURAN_HASIL, UKURAN_HASIL);

    var f = UKURAN_HASIL / UKURAN_AREA;
    var lebar = gambar.naturalWidth * skalaDasar * zum * f;
    var tinggi = gambar.naturalHeight * skalaDasar * zum * f;
    ctxKeluaran.imageSmoothingEnabled = true;
    ctxKeluaran.imageSmoothingQuality = 'high';
    ctxKeluaran.drawImage(
      gambar,
      UKURAN_HASIL / 2 + geserX * f - lebar / 2,
      UKURAN_HASIL / 2 + geserY * f - tinggi / 2,
      lebar,
      tinggi
    );
    return keluaran;
  }

  var dipakai = false;
  var sedangDipakai = false;

  if (tombolPakai) {
    tombolPakai.addEventListener('click', function () {
      if (!gambar || !berkasAsli || sedangDipakai) return;
      sedangDipakai = true;

      var keluaran = gambarKeluaran();
      var nama = (berkasAsli.name || 'foto').replace(/\.[^.]*$/, '') + '.jpg';

      keluaran.toBlob(
        function (blob) {
          sedangDipakai = false;

          if (!blob || typeof DataTransfer !== 'function' || typeof File !== 'function') {
            // Peramban tidak mendukung penggantian berkas: biarkan
            // berkas asli yang terkirim, dan katakan apa adanya.
            tampilkanGagal(
              'Peramban ini tidak mendukung penggantian berkas, jadi foto aslinya yang ' +
                'akan dikirim tanpa dipangkas.'
            );
            window.panelAdmin.tutupPopup();
            return;
          }

          try {
            var berkasBaru = new File([blob], nama, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            var wadah = new DataTransfer();
            wadah.items.add(berkasBaru);
            medanBerkas.files = wadah.files;

            if (gambarHasil) gambarHasil.src = keluaran.toDataURL('image/jpeg', MUTU_JPEG);
            if (namaHasil) {
              namaHasil.textContent = nama + ' · ' + ukuranTerbaca(blob.size) + ' · 512×512';
            }
            if (kotakHasil) kotakHasil.hidden = false;
            bersihkanGagal();
          } catch (_) {
            tampilkanGagal(
              'Foto gagal dipasang ke formulir. Berkas aslinya yang akan dikirim.'
            );
          }

          // Ditandai supaya penutupan ini tidak dianggap pembatalan.
          dipakai = true;
          window.panelAdmin.tutupPopup();
          dipakai = false;
        },
        'image/jpeg',
        MUTU_JPEG
      );
    });
  }

  // ---------------------------------------------------------------
  // Membatalkan
  // ---------------------------------------------------------------

  function batal() {
    kosongkanPilihan();
    bersihkanGagal();
  }

  if (tombolBatal) {
    tombolBatal.addEventListener('click', function () {
      batal();
      window.panelAdmin.tutupPopup();
    });
  }

  if (tombolBatalHasil) {
    tombolBatalHasil.addEventListener('click', batal);
  }

  // Menutup popup lewat Escape, tombol silang, atau klik latar gelap
  // diperlakukan sama dengan Batal: pilihan berkasnya dikosongkan,
  // supaya tidak ada berkas yang terkirim tanpa sempat dipangkas.
  // Dipasang di tahap tangkap agar berjalan sebelum penangan popup
  // umum menutup tiraiannya.
  function penutupanDianggapBatal(e) {
    if (dipakai || tirai.hidden) return false;
    if (e.type === 'keydown') return e.key === 'Escape';
    if (e.target === tirai) return true;
    return Boolean(e.target.closest && e.target.closest('[data-tutup]'));
  }

  document.addEventListener(
    'click',
    function (e) {
      if (penutupanDianggapBatal(e)) batal();
    },
    true
  );

  document.addEventListener(
    'keydown',
    function (e) {
      if (penutupanDianggapBatal(e)) batal();
    },
    true
  );
})();

/* =================================================================
   Pemilih ikon boxicons.

   Kisi ikonnya dirender server dari daftar kelas yang dibaca langsung
   dari boxicons.min.css, jadi berkas ini tidak perlu mengambil apa
   pun dari jaringan: ia hanya menyaring dan memilih apa yang sudah
   ada di halaman.
   ================================================================= */

(function () {
  'use strict';

  var tirai = document.getElementById('popup-ikon');
  if (!tirai) return;

  var kotakCari = document.getElementById('ikon-cari');
  var labelHitung = document.getElementById('ikon-hitung');
  var pesanKosong = document.getElementById('ikon-tak-cocok');
  var medanTujuan = null;

  // Paling banyak sekian tombol digambar sekaligus. Menggambar
  // 1500 sekaligus membuat popup tersendat dan halamannya berat;
  // dengan batas ini, pencarian yang lebih sempit yang menyaring.
  var BATAS_TAMPIL = 240;

  // Tiap kelompok membawa nama ikonnya sebagai satu teks dipisah
  // koma, jauh lebih ringan daripada tombol jadi.
  var kelompok = Array.prototype.slice.call(tirai.querySelectorAll('.ikon-kelompok'))
    .map(function (el) {
      return {
        el: el,
        kisi: el.querySelector('.ikon-kisi'),
        nama: (el.getAttribute('data-nama') || '').split(',').filter(Boolean),
      };
    });

  var totalIkon = kelompok.reduce(function (n, g) { return n + g.nama.length; }, 0);

  function buatTombol(nama) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ikon-butir';
    b.setAttribute('data-ikon', 'bx ' + nama);
    b.title = nama;
    var i = document.createElement('i');
    i.className = 'bx ' + nama;
    b.appendChild(i);
    return b;
  }

  function saring() {
    var kata = kotakCari ? kotakCari.value.trim().toLowerCase() : '';
    var cocok = 0;
    var digambar = 0;

    for (var i = 0; i < kelompok.length; i++) {
      var g = kelompok[i];
      var sesuai = [];
      for (var j = 0; j < g.nama.length; j++) {
        if (kata === '' || g.nama[j].indexOf(kata) !== -1) sesuai.push(g.nama[j]);
      }
      cocok += sesuai.length;

      var potong = sesuai.slice(0, Math.max(0, BATAS_TAMPIL - digambar));
      digambar += potong.length;

      // Satu kali tulis ke DOM per kelompok, lewat fragmen.
      var fragmen = document.createDocumentFragment();
      for (j = 0; j < potong.length; j++) fragmen.appendChild(buatTombol(potong[j]));
      g.kisi.textContent = '';
      g.kisi.appendChild(fragmen);
      g.el.hidden = potong.length === 0;
    }

    if (labelHitung) {
      labelHitung.textContent =
        cocok === 0
          ? 'tidak ada yang cocok dari ' + totalIkon + ' ikon'
          : digambar < cocok
          ? 'menampilkan ' + digambar + ' dari ' + cocok + ' ikon yang cocok — persempit pencarian untuk melihat sisanya'
          : 'menampilkan ' + cocok + ' dari ' + totalIkon + ' ikon';
    }
    if (pesanKosong) pesanKosong.hidden = cocok !== 0;
  }

  if (kotakCari) kotakCari.addEventListener('input', saring);

  // Tombol 'Pilih' di sebelah tiap medan ikon.
  document.addEventListener('click', function (e) {
    var pembuka = e.target.closest ? e.target.closest('[data-buka-ikon]') : null;
    if (!pembuka) return;
    e.preventDefault();
    medanTujuan = document.getElementById(pembuka.getAttribute('data-buka-ikon'));
    if (kotakCari) kotakCari.value = '';
    saring();
    window.panelAdmin.bukaPopup(tirai);
    if (kotakCari) kotakCari.focus();
  });

  // Memilih satu ikon dari kisi.
  tirai.addEventListener('click', function (e) {
    var pilih = e.target.closest ? e.target.closest('.ikon-butir') : null;
    if (!pilih || !medanTujuan) return;
    e.preventDefault();

    var kelas = pilih.getAttribute('data-ikon') || '';
    medanTujuan.value = kelas;

    var pratinjau = document.querySelector(
      '[data-ikon-pratinjau="' + medanTujuan.getAttribute('name') + '"]'
    );
    if (pratinjau) pratinjau.className = kelas;

    window.panelAdmin.tutupPopup();
  });

})();

/* =================================================================
   Popup rincian umum.

   Isinya diambil dari atribut data-rinci-* pada baris tabel, jadi
   halaman mana pun bisa memakainya tanpa menambah kode di sini.
   ================================================================= */

(function () {
  'use strict';

  var tirai = document.getElementById('popup-rinci');
  var badan = document.getElementById('badan-daftar');
  if (!tirai || !badan) return;

  function isiRincian(tr) {
    var medan = tirai.querySelectorAll('[data-rinci-medan]');
    for (var i = 0; i < medan.length; i++) {
      var kunci = medan[i].getAttribute('data-rinci-medan');
      medan[i].textContent = tr.getAttribute('data-rinci-' + kunci) || '—';
    }

    // Tombol balas membuka aplikasi email bawaan.
    var balas = tirai.querySelector('[data-rinci-mailto]');
    if (balas) {
      var email = tr.getAttribute('data-rinci-email') || '';
      var subjek = tr.getAttribute('data-rinci-subjek') || '';
      balas.href =
        'mailto:' + encodeURIComponent(email) +
        '?subject=' + encodeURIComponent('Re: ' + subjek);
    }

    // Formulir penanda dibaca diarahkan ke baris yang sedang dibuka,
    // dan tombolnya menyesuaikan keadaan sekarang.
    var form = tirai.querySelector('[data-rinci-form]');
    if (form) {
      var pola = form.getAttribute('data-rinci-form') || '';
      form.action = pola.replace(':id', tr.getAttribute('data-id'));

      var sudah = tr.getAttribute('data-rinci-dibaca') === '1';
      var medanDibaca = form.querySelector('[data-rinci-dibaca-medan]');
      if (medanDibaca) medanDibaca.value = sudah ? '0' : '1';
      var tombol = form.querySelector('[data-rinci-tombol-tandai]');
      if (tombol) tombol.textContent = sudah ? 'Tandai belum dibaca' : 'Tandai dibaca';
    }
  }

  // =============================================================
  // Menandai pesan sudah dibaca (tahap 22)
  // =============================================================
  //
  // Ini pemakaian fetch KEDUA di berkas ini, dan polanya sengaja sama
  // persis dengan sakelar "tampil": alamatnya dibaca apa adanya dari
  // atribut action formulir yang sudah ada di barisnya, isinya diambil
  // dari formulir itu juga (termasuk token CSRF-nya), dan rutenya
  // menjawab JSON hanya karena permintaan ini meminta JSON.
  //
  // Tanpa fetch, tidak ada yang ditandai otomatis; pesannya tetap bisa
  // dibaca lewat popup, dan tombol "Tandai dibaca" tetap bekerja
  // sebagai formulir biasa.

  function formTandai(tr) {
    return tr.querySelector('form.baris-form');
  }

  // Perbarui semua tempat yang menampilkan keadaan satu baris.
  function setelBaris(tr, dibaca) {
    tr.setAttribute('data-rinci-dibaca', dibaca ? '1' : '0');
    tr.setAttribute('data-sudah_dibaca', dibaca ? '1' : '0');
    if (dibaca) tr.classList.remove('belum-dibaca');
    else tr.classList.add('belum-dibaca');

    var lencana = tr.querySelector('.sel-sudah_dibaca .lencana');
    if (lencana) {
      lencana.textContent = dibaca ? 'sudah dibaca' : 'belum dibaca';
      lencana.className = 'lencana ' + (dibaca ? 'lencana-sembunyi' : 'lencana-tampil');
    }

    // Tombol "Tandai" di baris itu selalu menawarkan KEBALIKAN dari
    // keadaan sekarang, sama seperti yang dirender server.
    var form = formTandai(tr);
    if (form) {
      var medan = form.querySelector('input[name="dibaca"]');
      if (medan) medan.value = dibaca ? '0' : '1';
      var tombol = form.querySelector('button');
      if (tombol) {
        var ikon = tombol.querySelector('i');
        if (ikon) ikon.className = 'bx ' + (dibaca ? 'bx-envelope' : 'bx-check');
        var teks = dibaca ? ' Tandai belum' : ' Tandai dibaca';
        if (tombol.lastChild && tombol.lastChild.nodeType === 3) tombol.lastChild.nodeValue = teks;
        else tombol.appendChild(document.createTextNode(teks));
      }
    }

    // Kalau popupnya sedang menampilkan baris ini, tombolnya ikut.
    var tombolPopup = tirai.querySelector('[data-rinci-tombol-tandai]');
    var formPopup = tirai.querySelector('[data-rinci-form]');
    if (tombolPopup && formPopup && formPopup.action.indexOf('/' + tr.getAttribute('data-id') + '/') >= 0) {
      tombolPopup.textContent = dibaca ? 'Tandai belum dibaca' : 'Tandai dibaca';
      var medanPopup = formPopup.querySelector('[data-rinci-dibaca-medan]');
      if (medanPopup) medanPopup.value = dibaca ? '0' : '1';
    }
  }

  // Perbarui lencana sidebar dan angka di kedua lonceng sekaligus.
  function setelLencana(jumlah) {
    var n = Number(jumlah);
    if (!Number.isFinite(n) || n < 0) return;

    var sidebar = document.querySelector('[data-lencana-pesan]');
    if (sidebar) {
      sidebar.textContent = String(n);
      sidebar.title = n + ' pesan belum dibaca';
      sidebar.hidden = n === 0;
    }

    var lencana = document.querySelectorAll('[data-lonceng-lencana]');
    for (var i = 0; i < lencana.length; i++) {
      lencana[i].textContent = n > 99 ? '99+' : String(n);
      lencana[i].hidden = n === 0;
    }

    var hitung = document.querySelectorAll('[data-lonceng-hitung]');
    for (var j = 0; j < hitung.length; j++) {
      hitung[j].textContent = n + ' belum dibaca';
      hitung[j].hidden = n === 0;
    }

    var tombolLonceng = document.querySelectorAll('[data-lonceng-tombol]');
    for (var k = 0; k < tombolLonceng.length; k++) {
      tombolLonceng[k].setAttribute(
        'aria-label',
        n > 0 ? 'Pemberitahuan, ' + n + ' pesan belum dibaca' : 'Pemberitahuan, tidak ada pesan baru'
      );
    }
  }

  // Butir yang bersangkutan di dalam daftar lonceng ikut kehilangan
  // penanda "baru"-nya.
  function setelButirLonceng(id) {
    var butir = document.querySelectorAll('[data-lonceng-butir="' + id + '"]');
    for (var i = 0; i < butir.length; i++) {
      butir[i].classList.remove('lonceng-baru');
      var tanda = butir[i].querySelector('.lencana-tampil');
      if (tanda && tanda.parentNode) tanda.parentNode.removeChild(tanda);
    }
  }

  function tandaiDibaca(tr) {
    if (tr.getAttribute('data-rinci-dibaca') === '1') return; // sudah dibaca
    if (typeof window.fetch !== 'function') return;

    var form = formTandai(tr);
    if (!form) return;
    var alamat = form.getAttribute('action');
    var token = form.querySelector('input[name="_csrf"]');
    if (!alamat || !token) return;

    var id = tr.getAttribute('data-id');

    // Ditandai lebih dulu di layar supaya terasa langsung; kalau
    // permintaannya gagal, keadaannya dikembalikan.
    //
    // Penanda "baru" di daftar lonceng TIDAK ikut dibuang di sini:
    // membuangnya berarti membuat elemennya, dan itu tidak bisa
    // dikembalikan kalau permintaannya gagal. Ia menunggu jawaban.
    setelBaris(tr, true);

    fetch(alamat, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: 'dibaca=1&_csrf=' + encodeURIComponent(token.value),
      credentials: 'same-origin'
    })
      .then(function (jawab) {
        if (!jawab.ok) throw new Error('status ' + jawab.status);
        return jawab.json();
      })
      .then(function (data) {
        if (!data || data.ok !== true) throw new Error('jawaban tidak dikenali');
        setelBaris(tr, Number(data.dibaca) === 1);
        setelLencana(data.belumDibaca);
        if (Number(data.dibaca) === 1) setelButirLonceng(id);
      })
      .catch(function () {
        // Gagal: kembalikan seperti semula. Angka lencananya tidak
        // pernah ikut diubah sebelum jawaban datang, jadi ia memang
        // belum perlu dikembalikan.
        setelBaris(tr, false);
      });
  }

  function bukaBaris(tr) {
    if (!tr) return;
    isiRincian(tr);
    window.panelAdmin.bukaPopup(tirai);
    tandaiDibaca(tr);
  }

  // Barisnya ditandai bisa diklik dari sini, bukan dari tampilan,
  // supaya tanpa JavaScript tidak ada baris yang terlihat bisa
  // dibuka padahal tidak.
  var semuaBaris = badan.querySelectorAll('tr[data-rinci]');
  for (var b = 0; b < semuaBaris.length; b++) {
    semuaBaris[b].classList.add('baris-bisa-buka');
  }

  badan.addEventListener('click', function (e) {
    if (!e.target.closest) return;

    // Kolom yang isinya kontrol sendiri tidak ikut membuka popup:
    // kotak centang, pegangan seret, dan tombol aksi.
    if (e.target.closest('.kolom-centang, .kolom-seret, .kolom-aksi')) return;

    var pemicu = e.target.closest('[data-rinci]');
    if (!pemicu) return;

    // Klik dengan Ctrl/Shift/tengah dibiarkan: pengguna memang ingin
    // membuka tautan subjeknya di tab lain.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    e.preventDefault();
    bukaBaris(pemicu.closest('tr'));
  });

  // Dibuka dari lonceng: /admin/pesan?buka=<id>. Kalau pengunjung
  // sedang di halaman lain, tautannya membawa ke sini dulu, lalu
  // baris itu dibuka begitu halamannya siap. Tanpa JavaScript,
  // alamat yang sama tetap menampilkan daftarnya seperti biasa.
  (function () {
    var cocok = /[?&]buka=(\d+)/.exec(window.location.search || '');
    if (!cocok) return;
    var tr = badan.querySelector('tr[data-id="' + cocok[1] + '"]');
    if (tr) bukaBaris(tr);
  })();
})();

/* =================================================================
   Lonceng pemberitahuan.

   Tanpa JavaScript, loncengnya tetap tautan biasa ke halaman Pesan
   Masuk dan daftar melayangnya tidak pernah muncul (data-js + hidden).
   Dengan JavaScript, klik biasa dicegat dan daftarnya yang dibuka.

   Klik dengan Ctrl, Shift, atau tombol tengah tidak dicegat, supaya
   kebiasaan "buka di tab baru" tetap bekerja.
   ================================================================= */

(function () {
  'use strict';

  var semuaLonceng = document.querySelectorAll('[data-lonceng]');
  if (!semuaLonceng.length) return;

  var terbuka = null;

  function tutup() {
    if (!terbuka) return;
    terbuka.panel.hidden = true;
    terbuka.tombol.setAttribute('aria-expanded', 'false');
    terbuka.bungkus.classList.remove('lonceng-buka');
    terbuka = null;
  }

  function buka(butir) {
    tutup();
    butir.panel.hidden = false;
    butir.tombol.setAttribute('aria-expanded', 'true');
    butir.bungkus.classList.add('lonceng-buka');
    terbuka = butir;
  }

  for (var i = 0; i < semuaLonceng.length; i++) {
    (function (bungkus) {
      var tombol = bungkus.querySelector('[data-lonceng-tombol]');
      var panel = bungkus.querySelector('[data-lonceng-panel]');
      if (!tombol || !panel) return;

      var butir = { bungkus: bungkus, tombol: tombol, panel: panel };
      panel.hidden = true;

      tombol.addEventListener('click', function (e) {
        // Biarkan peramban menangani klik yang jelas-jelas dimaksudkan
        // untuk membuka tautan di tempat lain.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (terbuka === butir) tutup();
        else buka(butir);
      });
    })(semuaLonceng[i]);
  }

  // Klik di luar menutup. Dipasang sekali di dokumen, bukan satu per
  // lonceng, supaya tidak ada penyimak yang menumpuk.
  document.addEventListener('click', function (e) {
    if (!terbuka) return;
    if (terbuka.bungkus.contains(e.target)) return;
    tutup();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !terbuka) return;
    var tombolnya = terbuka.tombol;
    tutup();
    tombolnya.focus();
  });
})();

/* =================================================================
   Pratinjau gambar di formulir.

   Berlaku untuk setiap input[type=file] bertanda data-pratinjau-medan.
   Halaman mana pun yang memakai bagian/medan-gambar.ejs otomatis ikut,
   tanpa menambah kode di sini.

   Ini MURNI pratinjau: berkas yang terkirim ke server tetap berkas
   asli yang dipilih pengguna. Tidak ada kanvas, tidak ada pemangkasan,
   tidak ada berkas yang dibuat ulang.
   ================================================================= */

(function () {
  'use strict';

  var medanBerkas = document.querySelectorAll('[data-pratinjau-medan]');
  if (!medanBerkas.length) return;

  function ukuranTerbaca(byte) {
    if (byte < 1024) return byte + ' B';
    if (byte < 1024 * 1024) return (byte / 1024).toFixed(1) + ' KB';
    return (byte / (1024 * 1024)).toFixed(2) + ' MB';
  }

  for (var i = 0; i < medanBerkas.length; i++) {
    (function (medan) {
      var wadah = medan.closest ? medan.closest('.medan') : null;
      if (!wadah) return;

      var kotak = wadah.querySelector('[data-pratinjau-kotak]');
      var gambar = wadah.querySelector('[data-pratinjau-gambar]');
      var namaTeks = wadah.querySelector('[data-pratinjau-nama]');
      var tombolBatal = wadah.querySelector('[data-pratinjau-batal]');
      var lama = wadah.querySelector('[data-pratinjau-lama]');
      if (!kotak || !gambar) return;

      // Alamat blob: harus dilepas lagi, kalau tidak berkasnya tetap
      // ditahan di memori sampai halaman ditutup.
      var alamat = null;
      function lepasAlamat() {
        if (!alamat) return;
        URL.revokeObjectURL(alamat);
        alamat = null;
      }

      function sembunyikan() {
        kotak.hidden = true;
        gambar.removeAttribute('src');
        lepasAlamat();
        if (lama) lama.hidden = false;
      }

      medan.addEventListener('change', function () {
        var berkas = medan.files && medan.files[0];
        if (!berkas) {
          sembunyikan();
          return;
        }

        // Berkas yang bukan gambar tidak dipratinjau. Servernya tetap
        // yang menentukan diterima atau tidak; ini cuma supaya tidak
        // muncul kotak gambar rusak.
        if (berkas.type && berkas.type.indexOf('image/') !== 0) {
          sembunyikan();
          if (namaTeks) namaTeks.textContent = berkas.name + ' — bukan berkas gambar.';
          return;
        }

        lepasAlamat();
        alamat = URL.createObjectURL(berkas);
        gambar.src = alamat;
        if (namaTeks) {
          namaTeks.textContent = berkas.name + ' · ' + ukuranTerbaca(berkas.size);
        }

        // Selama ada pilihan baru, gambar lama disembunyikan supaya
        // tidak ada dua gambar bersebelahan tanpa keterangan mana yang
        // akan dipakai.
        if (lama) lama.hidden = true;
        kotak.hidden = false;
      });

      if (tombolBatal) {
        tombolBatal.addEventListener('click', function () {
          medan.value = '';
          sembunyikan();
          medan.focus();
        });
      }
    })(medanBerkas[i]);
  }
})();

/* =================================================================
   Sakelar "tampil" tanpa memuat ulang halaman.

   INI SATU-SATUNYA TEMPAT DI BERKAS INI YANG MENYENTUH JARINGAN.

   Yang dikirim tetap formulir yang sama dengan yang dipakai peramban
   saat JavaScript mati; bedanya hanya pengirimnya. Alamat tujuannya
   dibaca apa adanya dari atribut action formulir itu -- tidak
   dirangkai dari potongan teks, jadi tidak ada cara mengarahkannya ke
   tempat lain.

   Kalau berkas ini gagal dimuat, atau baris di bawah ini gagal
   berjalan, penyimak submit tidak pernah terpasang dan formulirnya
   terkirim biasa oleh peramban. Sakelarnya tetap bekerja.
   ================================================================= */

(function () {
  'use strict';

  var badan = document.getElementById('badan-daftar');
  if (!badan) return;

  // Tanpa fetch, biarkan peramban yang mengirim formulirnya.
  if (typeof window.fetch !== 'function') return;

  function pesanGalat(form, teks) {
    var p = form.querySelector('[data-sakelar-galat]');
    if (!p) {
      p = document.createElement('span');
      p.className = 'sakelar-galat';
      p.setAttribute('data-sakelar-galat', '');
      p.setAttribute('role', 'alert');
      form.appendChild(p);
    }
    p.textContent = teks || '';
    p.hidden = !teks;
  }

  // Gambarkan satu keadaan ke seluruh bagian yang menampilkannya:
  // tombolnya, medan tersembunyi yang akan dikirim berikutnya, label
  // teks di sebelahnya, dan atribut data-tampil pada barisnya (yang
  // dipakai fitur urut kolom Status).
  function pasangKeadaan(form, hidup) {
    var tombol = form.querySelector('.sakelar-tombol');
    var medan = form.querySelector('input[name="tampil"]');
    var label = form.querySelector('.sakelar-label');
    var baris = form.closest ? form.closest('tr') : null;

    if (tombol) {
      tombol.setAttribute('aria-checked', hidup ? 'true' : 'false');
      tombol.title = hidup
        ? 'Sedang tampil — tekan untuk menyembunyikan'
        : 'Sedang disembunyikan — tekan untuk menampilkan';
    }
    // Nilai yang dikirim berikutnya selalu KEBALIKAN dari keadaan
    // sekarang, sama seperti yang dirender server.
    if (medan) medan.value = hidup ? '0' : '1';
    if (label) label.textContent = hidup ? 'tampil' : 'disembunyikan';
    if (baris) baris.setAttribute('data-tampil', hidup ? '1' : '0');
  }

  function keadaanSekarang(form) {
    var tombol = form.querySelector('.sakelar-tombol');
    return !!tombol && tombol.getAttribute('aria-checked') === 'true';
  }

  badan.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.classList || !form.classList.contains('sakelar-form')) return;

    var alamat = form.getAttribute('action');
    if (!alamat) return; // tanpa action, biarkan peramban yang urus

    e.preventDefault();

    var tombol = form.querySelector('.sakelar-tombol');
    if (tombol && tombol.disabled) return;

    var sebelum = keadaanSekarang(form);
    var sesudah = !sebelum;

    // Isi permintaan diambil dari formulirnya sendiri, termasuk token
    // CSRF-nya, jadi tidak ada nilai yang dikarang di sini.
    var isi = new URLSearchParams(new FormData(form)).toString();

    pesanGalat(form, '');
    pasangKeadaan(form, sesudah);
    if (tombol) tombol.disabled = true;

    fetch(alamat, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: isi,
      credentials: 'same-origin'
    })
      .then(function (jawab) {
        if (!jawab.ok) throw new Error('status ' + jawab.status);
        return jawab.json();
      })
      .then(function (data) {
        if (!data || data.ok !== true) throw new Error('jawaban tidak dikenali');
        // Yang dipakai adalah nilai dari server, bukan tebakan tadi.
        pasangKeadaan(form, Number(data.tampil) === 1);
      })
      .catch(function () {
        pasangKeadaan(form, sebelum);
        pesanGalat(form, 'Gagal disimpan. Muat ulang halaman lalu coba lagi.');
      })
      .then(function () {
        if (tombol) tombol.disabled = false;
      });
  });
})();

/* =================================================================
   Gambar pratinjau bisa diklik untuk melihat ukuran penuh.

   Kelas, tabindex, dan peran tombolnya dipasang di sini, bukan di
   tampilan, supaya tanpa JavaScript gambarnya tetap gambar biasa --
   tidak ada yang terlihat bisa diklik padahal tidak.
   ================================================================= */

(function () {
  'use strict';

  var tirai = document.getElementById('popup-gambar');
  if (!tirai) return;

  var besar = tirai.querySelector('[data-gambar-besar]');
  var keterangan = tirai.querySelector('[data-gambar-keterangan]');
  if (!besar) return;

  function bukaGambar(img) {
    if (!img.getAttribute('src')) return;
    besar.src = img.getAttribute('src');
    if (keterangan) {
      keterangan.textContent = img.getAttribute('data-nama-berkas') || '';
      keterangan.hidden = !keterangan.textContent;
    }
    window.panelAdmin.bukaPopup(tirai);
  }

  function siapkan(img) {
    if (!img) return;
    img.classList.add('bisa-zoom');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('title', 'Klik untuk melihat ukuran penuh');

    img.addEventListener('click', function () {
      bukaGambar(img);
    });
    img.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      bukaGambar(img);
    });
  }

  var daftar = document.querySelectorAll('[data-pratinjau-gambar], [data-pratinjau-lama] img, [data-bisa-zoom]');
  for (var i = 0; i < daftar.length; i++) siapkan(daftar[i]);
})();

/* =================================================================
   Tombol lihat sandi.

   Tombolnya dibuat di sini, bukan ditulis di tampilan, supaya tanpa
   JavaScript ia tidak pernah muncul sama sekali dan kotak sandinya
   tetap kotak sandi biasa.
   ================================================================= */

(function () {
  'use strict';

  var bungkusSemua = document.querySelectorAll('.sandi-bungkus');
  if (!bungkusSemua.length) return;

  for (var i = 0; i < bungkusSemua.length; i++) {
    (function (bungkus) {
      var medan = bungkus.querySelector('input[type="password"]');
      if (!medan) return;

      var tombol = document.createElement('button');
      tombol.type = 'button';
      tombol.className = 'sandi-lihat';
      tombol.setAttribute('aria-controls', medan.id || '');
      tombol.setAttribute('aria-pressed', 'false');

      var ikon = document.createElement('i');
      ikon.className = 'bx bx-show';
      ikon.setAttribute('aria-hidden', 'true');
      tombol.appendChild(ikon);

      function gambarkan(terlihat) {
        medan.type = terlihat ? 'text' : 'password';
        ikon.className = terlihat ? 'bx bx-hide' : 'bx bx-show';
        tombol.setAttribute('aria-pressed', terlihat ? 'true' : 'false');
        var teks = terlihat ? 'Sembunyikan sandi' : 'Lihat sandi';
        tombol.setAttribute('aria-label', teks);
        tombol.title = teks;
      }

      gambarkan(false);

      tombol.addEventListener('click', function () {
        var sekarang = medan.type === 'text';
        gambarkan(!sekarang);
        // Fokus dikembalikan ke kotaknya, di ujung teks, supaya
        // mengetik bisa langsung dilanjutkan.
        medan.focus();
        var n = medan.value.length;
        try {
          medan.setSelectionRange(n, n);
        } catch (err) {
          // type="password" di sebagian peramban lama menolak ini;
          // bukan masalah, fokusnya sudah pindah.
        }
      });

      bungkus.appendChild(tombol);
      bungkus.classList.add('ada-tombol');
    })(bungkusSemua[i]);
  }
})();
