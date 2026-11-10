// ===== Data & penyimpanan =====
const KEY = 'catatan-rantau';
const KATEGORI = ['Makan', 'Transport', 'Kos & tagihan', 'Belanja', 'Hiburan', 'Lainnya'];
let data = { budget: 0, pengeluaran: [], tagihan: [], tugas: [] };

try {
  const tersimpan = localStorage.getItem(KEY);
  if (tersimpan) data = Object.assign(data, JSON.parse(tersimpan));
} catch (e) { /* kalau localStorage gagal, data tetap kosong */ }

function simpan() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
}

// ===== Helper =====
const $ = (id) => document.getElementById(id);
const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
const buatId = () => Date.now() + Math.random();

function formatTanggal(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function selisihHari(tanggal) {
  const hariIni = new Date(formatTanggal(new Date()) + 'T00:00:00');
  const target = new Date(tanggal + 'T00:00:00');
  return Math.round((target - hariIni) / 86400000);
}

function labelTenggat(selisih) {
  if (selisih < 0) return 'terlambat ' + Math.abs(selisih) + ' hari';
  if (selisih === 0) return 'hari ini';
  return selisih + ' hari lagi';
}

function tombol(kelas, teks, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = kelas;
  b.textContent = teks;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

// ===== Mode gelap =====
function setTema(t) {
  document.documentElement.dataset.theme = t;
  $('btnTema').textContent = t === 'dark' ? 'Terang' : 'Gelap';
  try { localStorage.setItem('tema-rantau', t); } catch (e) {}
}
let tema = null;
try { tema = localStorage.getItem('tema-rantau'); } catch (e) {}
if (!tema) tema = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
setTema(tema);
$('btnTema').addEventListener('click', () => {
  setTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// ===== Hitung jatah harian =====
function hitungRingkasan() {
  const sekarang = new Date();
  const hariIni = formatTanggal(sekarang);
  const bulanIni = hariIni.slice(0, 7);
  const hariTerakhir = new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0).getDate();
  const sisaHari = hariTerakhir - sekarang.getDate() + 1;

  const bulanan = data.pengeluaran.filter((p) => p.tanggal.startsWith(bulanIni));
  const total = bulanan.reduce((a, p) => a + p.jumlah, 0);
  const terpakaiHariIni = bulanan
    .filter((p) => p.tanggal === hariIni)
    .reduce((a, p) => a + p.jumlah, 0);

  const sisa = data.budget - total;
  // jatah dihitung dari sisa uang sebelum belanja hari ini, dibagi sisa hari
  const jatah = (data.budget - (total - terpakaiHariIni)) / sisaHari;
  return { sisa, sisaHari, terpakaiHariIni, jatah };
}

function renderRingkasan() {
  const r = hitungRingkasan();
  const hero = $('hero');
  hero.className = 'hero';

  $('jatah').textContent = rp(Math.max(r.jatah, 0));
  $('sisa').textContent = rp(r.sisa);
  $('sisaHari').textContent = r.sisaHari;
  $('hariIni').textContent = rp(r.terpakaiHariIni);

  if (data.budget <= 0) {
    $('status').textContent = 'Isi uang bulanan dulu supaya jatah harianmu bisa dihitung.';
  } else if (r.sisa < 0) {
    hero.classList.add('lewat');
    $('status').textContent = 'Uang bulanan sudah habis. Tahan dulu pengeluaran yang tidak perlu.';
  } else if (r.terpakaiHariIni > r.jatah) {
    hero.classList.add('lewat');
    $('status').textContent = 'Hari ini sudah melebihi jatah. Besok jatahmu jadi lebih kecil.';
  } else if (r.terpakaiHariIni > r.jatah * 0.8) {
    hero.classList.add('waspada');
    $('status').textContent = 'Hampir habis. Sisa jatah hari ini ' + rp(r.jatah - r.terpakaiHariIni) + '.';
  } else {
    hero.classList.add('aman');
    $('status').textContent = 'Aman. Kamu masih bisa pakai ' + rp(r.jatah - r.terpakaiHariIni) + ' hari ini.';
  }
}

// ===== Pengeluaran (tambah, ubah, hapus) =====
const edit = { keluar: null, tagihan: null, tugas: null };

KATEGORI.forEach((k) => {
  const opsi = document.createElement('option');
  opsi.value = k;
  opsi.textContent = k;
  $('inKat').appendChild(opsi);
});

function resetFormKeluar() {
  edit.keluar = null;
  $('formKeluar').reset();
  $('inTglKeluar').value = formatTanggal(new Date());
  $('okKeluar').textContent = 'Tambah';
  $('batalKeluar').hidden = true;
}

function mulaiUbahKeluar(p) {
  edit.keluar = p.id;
  $('inKet').value = p.ket;
  $('inJumlah').value = p.jumlah;
  $('inKat').value = p.kat || 'Lainnya';
  $('inTglKeluar').value = p.tanggal;
  $('okKeluar').textContent = 'Simpan perubahan';
  $('batalKeluar').hidden = false;
  $('formKeluar').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('inKet').focus();
}

function kosong(ul, pesan) {
  const li = document.createElement('li');
  li.className = 'kosong';
  li.textContent = pesan;
  ul.appendChild(li);
}

function renderPengeluaran() {
  const ul = $('listKeluar');
  ul.textContent = '';
  const bulanIni = formatTanggal(new Date()).slice(0, 7);
  const daftar = data.pengeluaran
    .filter((p) => p.tanggal.startsWith(bulanIni))
    .reverse()
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  if (!daftar.length) return kosong(ul, 'Belum ada pengeluaran bulan ini.');

  daftar.forEach((p) => {
    const li = document.createElement('li');
    const teks = document.createElement('span');
    teks.className = 'teks';
    teks.textContent = p.ket;
    const info = document.createElement('span');
    info.className = 'info';
    info.textContent = (p.kat || 'Lainnya') + ' · ' + rp(p.jumlah) + ' · ' + p.tanggal;

    li.append(
      teks, info,
      tombol('ubah', 'Ubah', 'Ubah pengeluaran', () => mulaiUbahKeluar(p)),
      tombol('hapus', '×', 'Hapus pengeluaran', () => {
        data.pengeluaran = data.pengeluaran.filter((x) => x.id !== p.id);
        if (edit.keluar === p.id) resetFormKeluar();
        perbarui();
      })
    );
    ul.appendChild(li);
  });
}

// ===== Grafik per kategori =====
function renderKategori() {
  const wadah = $('grafikKat');
  wadah.textContent = '';
  const bulanIni = formatTanggal(new Date()).slice(0, 7);
  const total = {};
  data.pengeluaran
    .filter((p) => p.tanggal.startsWith(bulanIni))
    .forEach((p) => {
      const k = p.kat || 'Lainnya';
      total[k] = (total[k] || 0) + p.jumlah;
    });

  const urut = Object.entries(total).sort((a, b) => b[1] - a[1]);
  if (!urut.length) {
    const p = document.createElement('p');
    p.className = 'kecil';
    p.textContent = 'Belum ada pengeluaran bulan ini.';
    wadah.appendChild(p);
    return;
  }

  const maks = urut[0][1];
  urut.forEach(([kategori, jumlah]) => {
    const baris = document.createElement('div');
    baris.className = 'baris-kat';
    const nama = document.createElement('span');
    nama.textContent = kategori;
    const bar = document.createElement('div');
    bar.className = 'bar';
    const isi = document.createElement('div');
    isi.style.width = (jumlah / maks) * 100 + '%';
    bar.appendChild(isi);
    const nilai = document.createElement('span');
    nilai.textContent = rp(jumlah);
    baris.append(nama, bar, nilai);
    wadah.appendChild(baris);
  });
}

// ===== Tagihan & tugas (bentuknya sama: nama, tanggal, selesai) =====
const TENGGAT = {
  tagihan: { form: 'formTagihan', nama: 'inTagihan', tgl: 'tglTagihan', ok: 'okTagihan', batal: 'batalTagihan', ul: 'listTagihan', kosong: 'Belum ada tagihan.' },
  tugas: { form: 'formTugas', nama: 'inTugas', tgl: 'tglTugas', ok: 'okTugas', batal: 'batalTugas', ul: 'listTugas', kosong: 'Belum ada tugas.' },
};

function resetFormTenggat(jenis) {
  const c = TENGGAT[jenis];
  edit[jenis] = null;
  $(c.form).reset();
  $(c.ok).textContent = 'Tambah';
  $(c.batal).hidden = true;
}

function mulaiUbahTenggat(jenis, item) {
  const c = TENGGAT[jenis];
  edit[jenis] = item.id;
  $(c.nama).value = item.nama;
  $(c.tgl).value = item.tanggal;
  $(c.ok).textContent = 'Simpan perubahan';
  $(c.batal).hidden = false;
  $(c.form).scrollIntoView({ behavior: 'smooth', block: 'center' });
  $(c.nama).focus();
}

function renderTenggat(jenis) {
  const c = TENGGAT[jenis];
  const ul = $(c.ul);
  ul.textContent = '';
  const urut = [...data[jenis]].sort((a, b) =>
    a.selesai - b.selesai || a.tanggal.localeCompare(b.tanggal));
  if (!urut.length) return kosong(ul, c.kosong);

  urut.forEach((item) => {
    const li = document.createElement('li');
    if (item.selesai) li.className = 'selesai';

    const cek = document.createElement('input');
    cek.type = 'checkbox';
    cek.checked = item.selesai;
    cek.setAttribute('aria-label', 'Tandai selesai');
    cek.addEventListener('change', () => { item.selesai = cek.checked; perbarui(); });

    const teks = document.createElement('span');
    teks.className = 'teks';
    teks.textContent = item.nama;

    const selisih = selisihHari(item.tanggal);
    const info = document.createElement('span');
    info.className = 'info' + (!item.selesai && selisih <= 3 ? ' mepet' : '');
    info.textContent = labelTenggat(selisih);

    li.append(
      cek, teks, info,
      tombol('ubah', 'Ubah', 'Ubah', () => mulaiUbahTenggat(jenis, item)),
      tombol('hapus', '×', 'Hapus', () => {
        data[jenis] = data[jenis].filter((x) => x.id !== item.id);
        if (edit[jenis] === item.id) resetFormTenggat(jenis);
        perbarui();
      })
    );
    ul.appendChild(li);
  });
}

function perbarui() {
  simpan();
  renderRingkasan();
  renderPengeluaran();
  renderKategori();
  renderTenggat('tagihan');
  renderTenggat('tugas');
}

// ===== Form =====
$('formBudget').addEventListener('submit', (e) => {
  e.preventDefault();
  data.budget = Number($('inBudget').value);
  perbarui();
});

$('formKeluar').addEventListener('submit', (e) => {
  e.preventDefault();
  const isi = {
    ket: $('inKet').value.trim(),
    jumlah: Number($('inJumlah').value),
    kat: $('inKat').value,
    tanggal: $('inTglKeluar').value,
  };
  const lama = data.pengeluaran.find((x) => x.id === edit.keluar);
  if (lama) Object.assign(lama, isi);
  else data.pengeluaran.push({ id: buatId(), ...isi });
  resetFormKeluar();
  perbarui();
});
$('batalKeluar').addEventListener('click', resetFormKeluar);

Object.keys(TENGGAT).forEach((jenis) => {
  const c = TENGGAT[jenis];
  $(c.form).addEventListener('submit', (e) => {
    e.preventDefault();
    const isi = { nama: $(c.nama).value.trim(), tanggal: $(c.tgl).value };
    const lama = data[jenis].find((x) => x.id === edit[jenis]);
    if (lama) Object.assign(lama, isi);
    else data[jenis].push({ id: buatId(), ...isi, selesai: false });
    resetFormTenggat(jenis);
    perbarui();
  });
  $(c.batal).addEventListener('click', () => resetFormTenggat(jenis));
});

// ===== Ekspor ke Excel (CSV) & reset =====
const sel = (v) => '"' + String(v).replace(/"/g, '""') + '"';
const baris = (arr) => arr.map(sel).join(';');

$('btnEkspor').addEventListener('click', () => {
  const status = (x) => (x.selesai ? 'Selesai' : 'Belum');
  const isi = [
    'sep=;',
    baris(['Uang bulanan', data.budget]),
    '',
    'Pengeluaran',
    baris(['Tanggal', 'Keterangan', 'Kategori', 'Jumlah']),
    ...data.pengeluaran.map((p) => baris([p.tanggal, p.ket, p.kat || 'Lainnya', p.jumlah])),
    '',
    'Tagihan',
    baris(['Nama', 'Jatuh tempo', 'Status']),
    ...data.tagihan.map((t) => baris([t.nama, t.tanggal, status(t)])),
    '',
    'Tugas kuliah',
    baris(['Nama', 'Deadline', 'Status']),
    ...data.tugas.map((t) => baris([t.nama, t.tanggal, status(t)])),
  ].join('\r\n');

  // \ufeff supaya Excel membaca huruf dengan benar
  const blob = new Blob(['\ufeff' + isi], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'catatan-rantau-' + formatTanggal(new Date()) + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
});

$('btnReset').addEventListener('click', () => {
  if (!confirm('Hapus semua data (uang bulanan, pengeluaran, tagihan, tugas)? Ini tidak bisa dibatalkan.')) return;
  data = { budget: 0, pengeluaran: [], tagihan: [], tugas: [] };
  $('inBudget').value = '';
  resetFormKeluar();
  resetFormTenggat('tagihan');
  resetFormTenggat('tugas');
  perbarui();
});

// ===== Mulai =====
if (data.budget > 0) $('inBudget').value = data.budget;
resetFormKeluar();
perbarui();