// ==========================================
// 1. KONFIGURASI SUPABASE & STATE
// ==========================================
const supabaseUrl = 'https://vhvryershcomgwxezggo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodnJ5ZXJzaGNvbWd3eGV6Z2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MDcyNDQsImV4cCI6MjA3ODE4MzI0NH0.Ul-kcLoMGKdbQB_J6YJkTFrgTYMqc1f4FRhBHgOUWW8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let dataSiswaLokal = null;
let dataTugasSiswaLokal = []; // Menampung semua tugas untuk difilter
let tugasTerpilih = null;     // Menampung ID tugas yang sedang diklik

// ==========================================
// 2. INISIALISASI HALAMAN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
        window.location.href = 'dashboard.html'; 
        return;
    }

    try {
        const { data: userData, error: userError } = await supabaseClient
            .from('users').select('*').eq('id', user.id).single();

        if (userError) throw userError;

        dataSiswaLokal = userData;
        document.getElementById('user-name').innerText = userData.full_name || 'Siswa';

        if (userData.class_id) {
            muatDaftarTugasSiswa(userData.class_id);
        } else {
            document.getElementById('container-tugas-siswa').innerHTML = '<p>Akun Anda belum memiliki Kelas.</p>';
        }
        muatRiwayatNilai(user.id);
    } catch (err) {
        alert("Gagal memuat profil.");
    }
});

// ==========================================
// 3. FITUR KARTU TUGAS & FILTER
// ==========================================

// Mengambil tugas dari database (Diurutkan dari yang Paling Baru)
async function muatDaftarTugasSiswa(classId) {
    const container = document.getElementById('container-tugas-siswa');
    
    try {
        const { data: tasks, error } = await supabaseClient
            .from('tasks')
            .select('id, title, created_at, subjects(name)')
            .eq('class_id', classId)
            .order('created_at', { ascending: false }); // ORDER TERBARU DI ATAS

        if (error) throw error;

        dataTugasSiswaLokal = tasks;
        
        // Buat dropdown mapel dinamis khusus dari tugas yang ada
        isiDropdownMapelSiswa(tasks); 
        
        renderKartuTugasSiswa(dataTugasSiswaLokal);
    } catch (err) {
        container.innerHTML = '<p style="color:red;">Gagal memuat tugas.</p>';
    }
}

// Menampilkan kartu tugas ke layar
function renderKartuTugasSiswa(daftarTugas) {
    const container = document.getElementById('container-tugas-siswa');
    container.innerHTML = '';

    if (daftarTugas.length === 0) {
        container.innerHTML = '<p style="color:#9ca3af; grid-column: 1 / -1; text-align: center;">Tidak ada tugas yang sesuai.</p>';
        return;
    }

    daftarTugas.forEach(task => {
        const tglBuat = new Date(task.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const mapel = task.subjects?.name || 'Umum';

        const card = document.createElement('div');
        card.className = 'task-card';
        // Memberikan cursor pointer agar siswa tahu ini bisa diklik
        card.style.cursor = 'pointer'; 
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="font-size:12px; color:var(--primary-color); font-weight:bold;">${mapel}</span>
                <span style="font-size:12px; color:#9ca3af;">${tglBuat}</span>
            </div>
            <h3 style="margin: 0 0 15px 0; font-size:16px;">${task.title}</h3>
            <button class="btn-outline" style="width:100%; border-color:var(--primary-color); color:var(--primary-color);">Buka Tugas</button>
        `;

        // Jika kartu diklik, buka panel detail
        card.addEventListener('click', () => bukaDetailTugas(task.id, task.title, mapel));
        container.appendChild(card);
    });
}

// Logika Pencarian & Filter
function filterTugasSiswa() {
    const keyword = document.getElementById('input-cari-siswa').value.toLowerCase();
    const mapel = document.getElementById('select-filter-mapel-siswa').value;

    const hasil = dataTugasSiswaLokal.filter(t => {
        const matchNama = t.title.toLowerCase().includes(keyword);
        const matchMapel = mapel === "" || t.subjects?.name === mapel;
        return matchNama && matchMapel;
    });
    
    renderKartuTugasSiswa(hasil);
}

// Mengambil daftar mapel unik dari tugas yang tersedia untuk filter dropdown
function isiDropdownMapelSiswa(tasks) {
    const dropdown = document.getElementById('select-filter-mapel-siswa');
    const mapelUnik = [...new Set(tasks.map(t => t.subjects?.name).filter(n => n))];
    
    dropdown.innerHTML = '<option value="">Semua Mapel</option>';
    mapelUnik.forEach(mapel => {
        dropdown.innerHTML += `<option value="${mapel}">${mapel}</option>`;
    });
}

// Event Listener untuk input pencarian dan dropdown
document.getElementById('input-cari-siswa').addEventListener('input', filterTugasSiswa);
document.getElementById('select-filter-mapel-siswa').addEventListener('change', filterTugasSiswa);

// ==========================================
// 4. LOGIKA BUKA/TUTUP DETAIL TUGAS
// ==========================================

async function bukaDetailTugas(idTugas, judulTugas, mapel) {
    tugasTerpilih = idTugas; // Simpan ke variabel global
    
    // 1. Sembunyikan grid, Tampilkan detail
    document.getElementById('panel-daftar-tugas').classList.add('hidden');
    document.getElementById('panel-detail-tugas').classList.remove('hidden');
    
    // 2. Ubah Teks Judul
    document.getElementById('detail-judul-tugas').innerText = judulTugas;
    document.getElementById('detail-mapel-tugas').innerText = mapel;

    // 3. Ambil file soal (PDF) dari database
    const listSoal = document.getElementById('list-file-soal');
    listSoal.innerHTML = '<p style="font-size:13px; color:#6b7280;">Sedang memuat lampiran...</p>';

    const { data: files } = await supabaseClient
        .from('task_files')
        .select('file_name, file_url')
        .eq('task_id', idTugas)
        .eq('file_type', 'soal');

    if (!files || files.length === 0) {
        listSoal.innerHTML = `
            <div style="background:#F9FAFB; padding:12px; border-radius:8px; border:1px solid #E5E7EB;">
                <p style="margin:0; font-size:13px; color:#6B7280;">Tidak ada file lampiran soal dari Guru.</p>
            </div>`;
    } else {
        listSoal.innerHTML = files.map(f => `
            <div class="file-item" style="margin-bottom: 8px; border-left: 4px solid var(--primary-color);">
                <a href="${f.file_url}" target="_blank" style="color:var(--text-main); font-weight:600; text-decoration:none; display:flex; align-items:center; gap:10px;">
                    <span style="font-size:20px;">📄</span> Download Soal: ${f.file_name}
                </a>
            </div>
        `).join('');
    }
}

// Tombol Kembali
document.getElementById('btn-kembali').addEventListener('click', () => {
    tugasTerpilih = null;
    document.getElementById('panel-detail-tugas').classList.add('hidden');
    document.getElementById('panel-daftar-tugas').classList.remove('hidden');
    
    // Reset file input agar bersih saat memilih tugas lain
    document.getElementById('file-jawaban').value = '';
    document.getElementById('status-pilih-file').innerHTML = '<span>Klik untuk pilih foto</span> atau ambil gambar';
});

// ==========================================
// 5. SISTEM KERANJANG JAWABAN & DRAG AND DROP
// ==========================================

let keranjangJawaban = []; // Keranjang untuk menampung file siswa

// Fungsi untuk menggambar file di layar
function renderPreviewJawaban() {
    const container = document.getElementById('preview-jawaban-siswa');
    container.innerHTML = '';

    keranjangJawaban.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span class="file-name">📎 ${file.name}</span>
            <button type="button" class="btn-hapus-file">✕</button>
        `;
        
        // Logika hapus dari keranjang
        item.querySelector('.btn-hapus-file').onclick = () => {
            keranjangJawaban.splice(index, 1);
            renderPreviewJawaban();
        };
        container.appendChild(item);
    });
}

// Handler saat file dipilih via tombol (Galeri atau Kamera)
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => keranjangJawaban.push(file));
    e.target.value = ''; // Reset agar bisa pilih file yang sama lagi
    renderPreviewJawaban();
}

document.getElementById('file-jawaban-galeri')?.addEventListener('change', handleFileSelect);
document.getElementById('file-jawaban-kamera')?.addEventListener('change', handleFileSelect);

// Handler untuk Drag & Drop
const dropZone = document.getElementById('drop-zone-siswa');

if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover'); // Menambahkan efek warna saat file diseret
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover'); // Menghilangkan efek warna
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => keranjangJawaban.push(file));
        renderPreviewJawaban();
    });
}

// ==========================================
// BLOK 5B. KIRIM BANYAK JAWABAN KE N8N (SISWA)
// ==========================================

document.getElementById('btn-kirim-jawaban').addEventListener('click', async () => {
    
    // 1. Validasi Awal (Pengecekan Kesalahan)
    if (!tugasTerpilih) {
        return showToast("Pilih tugas terlebih dahulu!", "error");
    }
    if (keranjangJawaban.length === 0) {
        return showToast("Silakan unggah minimal 1 foto/file jawaban Anda!", "error");
    }

    // 2. Tampilkan Layar Loading Global
    showLoading("Mengunggah Jawaban ke AI... Harap Tunggu 🚀");

    // 3. Persiapan Data (Bungkus ke dalam FormData)
    const fd = new FormData();
    fd.append('task_id', tugasTerpilih); 
    fd.append('student_id', dataSiswaLokal.id);
    fd.append('student_name', dataSiswaLokal.full_name);
    
    // Looping (Mengulang) untuk memasukkan semua file dari keranjang ke FormData
    keranjangJawaban.forEach((file, index) => {
        fd.append(`file_jawaban_${index}`, file);
    });

    // 4. Proses Pengiriman (Fetch API ke Webhook n8n)
    const n8nWebhook = 'https://n8n.srv867549.hstgr.cloud/webhook/upload-jawaban';

    try {
        const response = await fetch(n8nWebhook, { 
            method: 'POST', 
            body: fd 
        });

        // Cek apakah server n8n merespon dengan sukses (status 200-299)
        if (!response.ok) {
            throw new Error("Gagal terhubung ke server n8n");
        }

        // 5. Aksi Jika Berhasil (Sukses)
        showToast("Berhasil! Jawaban terkirim dan sedang dikoreksi AI.", "success");
        
        keranjangJawaban.length = 0;                  // Kosongkan keranjang file di memori
        document.getElementById('btn-kembali').click(); // Simulasikan klik tombol 'Kembali' untuk menutup panel
        muatRiwayatNilai(dataSiswaLokal.id);          // Segarkan tabel riwayat di bagian bawah
        
    } catch (err) {
        // 6. Aksi Jika Gagal (Eror Koneksi/Server)
        showToast("Terjadi kesalahan jaringan saat mengirim jawaban.", "error");
    } finally {
        // 7. Tahap Akhir (Pembersihan)
        // Blok ini PASTI dijalankan, entah prosesnya sukses ataupun gagal
        hideLoading(); // Matikan layar loading agar siswa bisa beraktivitas lagi
    }
});

// ==========================================
// 6. RIWAYAT & LAINNYA
// ==========================================

async function muatRiwayatNilai(userId) {
    const tbody = document.getElementById('riwayat-tugas-siswa');
    const { data: subs, error } = await supabaseClient
        .from('submissions')
        .select('score, status, created_at, tasks(title)')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

    if (error || !subs || subs.length === 0) return;

    tbody.innerHTML = subs.map(s => `
        <tr>
            <td>${s.tasks?.title || 'Tugas'}</td>
            <td>${new Date(s.created_at).toLocaleDateString('id-ID')}</td>
            <td><span class="status-done">${s.status || 'Terkirim'}</span></td>
            <td style="font-weight:bold; color:var(--primary-color)">${s.score || '...'}</td>
        </tr>
    `).join('');
}

document.getElementById('btn-logout-siswa').onclick = () => {
    supabaseClient.auth.signOut().then(() => window.location.href = 'dashboard.html');
};

document.getElementById('file-jawaban').onchange = (e) => {
    const label = document.getElementById('status-pilih-file');
    if (e.target.files[0]) {
        label.innerHTML = `Terpilih: <strong style="color:var(--success)">${e.target.files[0].name}</strong>`;
    }
};

// --- FUNGSI GLOBAL LOADING ---
function showLoading(text = "Sedang Memproses...") {
    const loader = document.getElementById('global-loader');
    const loaderText = document.getElementById('loader-text');
    if (loader && loaderText) {
        loaderText.innerText = text;
        loader.classList.add('show');
    }
}

function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.remove('show');
    }
}