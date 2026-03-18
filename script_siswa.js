// ==========================================
// 1. KONFIGURASI & STATE UTAMA
// ==========================================
const supabaseUrl = 'https://vhvryershcomgwxezggo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodnJ5ZXJzaGNvbWd3eGV6Z2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MDcyNDQsImV4cCI6MjA3ODE4MzI0NH0.Ul-kcLoMGKdbQB_J6YJkTFrgTYMqc1f4FRhBHgOUWW8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let dataSiswaLokal = null;

// ==========================================
// 2. INISIALISASI HALAMAN (AUTO-RUN)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Memulai sesi siswa...");
    
    // A. Cek Status Login
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
        console.warn("Sesi tidak ditemukan, dialihkan ke login.");
        window.location.href = 'dashboard.html'; 
        return;
    }

    // B. Ambil Data Profil Lengkap (ID, Nama, dan ID Kelas)
    try {
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('*') // Mengambil data dasar dulu untuk menghindari eror Join jika tabel belum sinkron
            .eq('id', user.id)
            .single();

        if (userError) throw userError;

        dataSiswaLokal = userData;
        document.getElementById('user-name').innerText = userData.full_name || 'Siswa';

        // C. Jika profil berhasil diambil, muat tugas & riwayat
        if (userData.class_id) {
            muatDaftarTugas(userData.class_id);
        } else {
            document.getElementById('select-tugas-siswa').innerHTML = '<option>Akun Anda belum memiliki Kelas.</option>';
        }
        
        muatRiwayatNilai(user.id);

    } catch (err) {
        console.error("Gagal memuat profil siswa:", err.message);
        alert("Gagal memuat profil. Pastikan data class_id sudah diisi di tabel users.");
    }
});

// ==========================================
// 3. FUNGSI MUAT DAFTAR TUGAS (DROPDOWN)
// ==========================================
async function muatDaftarTugas(classId) {
    const dropdown = document.getElementById('select-tugas-siswa');
    
    try {
        // Ambil tugas yang class_id-nya cocok dengan class_id siswa
        const { data: tasks, error } = await supabaseClient
            .from('tasks')
            .select('id, title, subjects(name)')
            .eq('class_id', classId);

        if (error) throw error;

        dropdown.innerHTML = '<option value="">-- Pilih Tugas / Ujian --</option>';
        
        if (tasks.length === 0) {
            dropdown.innerHTML = '<option value="">Belum ada tugas untuk kelas Anda.</option>';
            return;
        }

        tasks.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.title} (${t.subjects?.name || 'Umum'})`;
            dropdown.appendChild(opt);
        });

    } catch (err) {
        console.error("Gagal muat tugas:", err.message);
    }
}

// ==========================================
// 4. LOGIKA DETAIL TUGAS & DOWNLOAD SOAL
// ==========================================
document.getElementById('select-tugas-siswa').addEventListener('change', async (e) => {
    const taskId = e.target.value;
    const areaSoal = document.getElementById('area-soal-siswa');
    const areaUpload = document.getElementById('area-upload-jawaban');
    const listSoal = document.getElementById('list-file-soal');

    if (!taskId) {
        areaSoal.classList.add('hidden');
        areaUpload.classList.add('hidden');
        return;
    }

    // Tampilkan panel
    areaSoal.classList.remove('hidden');
    areaUpload.classList.remove('hidden');
    listSoal.innerHTML = '<p>Mengecek file soal...</p>';

    // Cari file dengan tipe 'soal' untuk tugas ini
    const { data: files, error } = await supabaseClient
        .from('task_files')
        .select('file_name, file_url')
        .eq('task_id', taskId)
        .eq('file_type', 'soal');

    if (error || !files || files.length === 0) {
        listSoal.innerHTML = '<p style="color:#9ca3af;">Tidak ada lampiran soal (PDF/Gambar) dari guru.</p>';
    } else {
        listSoal.innerHTML = files.map(f => `
            <div class="file-item">
                <a href="${f.file_url}" target="_blank" style="color:var(--primary-color); font-weight:bold; text-decoration:none;">
                    📥 Unduh Soal: ${f.file_name}
                </a>
            </div>
        `).join('');
    }
});

// ==========================================
// 5. PROSES KIRIM JAWABAN KE N8N
// ==========================================
document.getElementById('btn-kirim-jawaban').addEventListener('click', async () => {
    const input = document.getElementById('file-jawaban');
    const taskId = document.getElementById('select-tugas-siswa').value;
    const btn = document.getElementById('btn-kirim-jawaban');

    if (!taskId) return alert("Pilih tugas terlebih dahulu!");
    if (!input.files[0]) return alert("Silakan pilih foto atau file jawaban Anda!");

    // Set Loading State
    btn.innerText = "Sedang Mengirim...";
    btn.disabled = true;
    btn.style.backgroundColor = "#9ca3af";

    const fd = new FormData();
    fd.append('file_jawaban', input.files[0]);
    fd.append('task_id', taskId);
    fd.append('student_id', dataSiswaLokal.id);
    fd.append('student_name', dataSiswaLokal.full_name);

    // URL Webhook n8n untuk Koreksi (Upload Jawaban)
    const n8nWebhook = 'https://n8n.srv867549.hstgr.cloud/webhook-test/upload-jawaban';

    try {
        const response = await fetch(n8nWebhook, { method: 'POST', body: fd });

        if (!response.ok) throw new Error("Gagal terhubung ke server n8n");

        alert("Jawaban berhasil terkirim! AI akan segera memberikan nilai.");
        location.reload(); // Refresh untuk melihat status terbaru

    } catch (err) {
        console.error("Gagal kirim:", err);
        alert("Terjadi kesalahan saat mengirim jawaban. Pastikan koneksi stabil.");
    } finally {
        btn.innerText = "🚀 Kirim Jawaban Sekarang";
        btn.disabled = false;
        btn.style.backgroundColor = "var(--primary-color)";
    }
});

// ==========================================
// 6. MUAT RIWAYAT NILAI (DARI TABEL SUBMISSIONS)
// ==========================================
async function muatRiwayatNilai(userId) {
    const tableBody = document.getElementById('riwayat-tugas-siswa');

    const { data: subs, error } = await supabaseClient
        .from('submissions')
        .select('score, status, created_at, tasks(title)')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

    if (error || !subs || subs.length === 0) return;

    tableBody.innerHTML = subs.map(s => `
        <tr>
            <td>${s.tasks?.title || 'Tugas'}</td>
            <td>${new Date(s.created_at).toLocaleDateString('id-ID')}</td>
            <td><span class="status-done">${s.status || 'Terkirim'}</span></td>
            <td style="font-weight:bold; color:var(--primary-color)">${s.score || '...'}</td>
        </tr>
    `).join('');
}

// 7. Logout
document.getElementById('btn-logout-siswa').onclick = () => {
    supabaseClient.auth.signOut().then(() => {
        window.location.href = 'dashboard.html';
    });
};

// Update label file saat dipilih
document.getElementById('file-jawaban').onchange = (e) => {
    const label = document.getElementById('status-pilih-file');
    if (e.target.files[0]) {
        label.innerHTML = `File terpilih: <strong style="color:var(--success)">${e.target.files[0].name}</strong>`;
    }
};