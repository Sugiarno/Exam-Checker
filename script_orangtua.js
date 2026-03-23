// ==========================================
// 1. KONFIGURASI SUPABASE (Menggunakan Vite)
// ==========================================
const supabaseUrl = import.meta.env.VITE_Supabase_Url;
const supabaseKey = import.meta.env.VITE_Supabase_Key;
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. AUTH GUARD & INISIALISASI HALAMAN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // A. Cek Status Login di Supabase Auth
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    // Satpam: Jika tidak ada sesi login, kembalikan ke pintu depan (Login)
    if (authError || !user) {
        window.location.href = 'index.html'; 
        return;
    }

    try {
        // B. Ambil Profil Orang Tua menggunakan 'nama_asli'
        const { data: ortuData, error: ortuError } = await supabaseClient
            .from('users')
            .select('id, nama_asli, role, child_id')
            .eq('id', user.id)
            .single();

        if (ortuError) throw ortuError;

        // C. Validasi Role: Pastikan hanya Orang Tua yang bisa melihat halaman ini
        if (ortuData.role !== 'orangtua' && ortuData.role !== 'orang_tua') {
            alert("Akses ditolak! Halaman ini khusus untuk akun Orang Tua.");
            window.location.href = 'index.html';
            return;
        }

        // Tampilkan nama orang tua di navigasi
        document.getElementById('user-name').innerText = ortuData.nama_asli;

        // D. Cek apakah orang tua sudah dihubungkan dengan anak via 'child_id'
        if (!ortuData.child_id) {
            tampilkanPesanBelumTerhubung();
            return;
        }

        // E. Jika aman, muat data profil anak dan daftar nilainya
        muatDataAnak(ortuData.child_id);

    } catch (err) {
        console.error("Error Profil:", err);
        alert("Gagal memuat profil orang tua. Silakan login ulang.");
    }
});

// ==========================================
// 3. LOGIKA PENGAMBILAN DATA ANAK
// ==========================================
async function muatDataAnak(childId) {
    try {
        // 1. Ambil Nama Asli dan Kelas Anak (Join Table classes)
        const { data: anakData, error: anakError } = await supabaseClient
            .from('users')
            .select('nama_asli, classes(name)')
            .eq('id', childId)
            .single();

        if (anakError) throw anakError;

        document.getElementById('nama-anak').innerText = anakData.nama_asli;
        document.getElementById('kelas-anak').innerText = anakData.classes?.name || 'Kelas Belum Diatur';

        // 2. Ambil Riwayat Nilai & Feedback AI (Submissions)
        muatRiwayatNilaiAnak(childId);

    } catch (err) {
        console.error("Gagal muat data anak:", err);
    }
}

async function muatRiwayatNilaiAnak(childId) {
    const tbody = document.getElementById('riwayat-nilai-anak');
    
    try {
        const { data: subs, error: subsError } = await supabaseClient
            .from('submissions')
            .select('score, feedback, created_at, tasks(title)')
            .eq('student_id', childId)
            .order('created_at', { ascending: false });

        if (subsError) throw subsError;

        if (!subs || subs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af;">Belum ada tugas yang dikumpulkan anak Anda.</td></tr>';
            return;
        }

        // 3. Render data ke dalam tabel
        tbody.innerHTML = subs.map(s => {
            const tanggal = new Date(s.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            
            // Logika Warna Nilai: Hijau jika >= 75 (Lulus KKM), Merah jika di bawah
            const warnaNilai = s.score >= 75 ? 'var(--success)' : 'var(--danger)';

            return `
                <tr>
                    <td style="font-weight: 600; color: var(--text-main);">${s.tasks?.title || 'Tugas Tanpa Judul'}</td>
                    <td style="font-size: 13px; color: #6b7280;">${tanggal}</td>
                    <td style="font-weight:bold; font-size: 16px; color: ${warnaNilai};">${s.score || '0'}</td>
                    <td style="font-size: 13px; line-height: 1.5; color: #4b5563; font-style: italic;">
                        "${s.feedback || 'Sedang proses penilaian AI...'}"
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Gagal memuat riwayat nilai.</td></tr>';
    }
}

// ==========================================
// 4. FUNGSI PENDUKUNG (UI & LOGOUT)
// ==========================================
function tampilkanPesanBelumTerhubung() {
    document.getElementById('nama-anak').innerHTML = '<span style="color:var(--danger); font-weight:bold;">Akun Belum Terhubung</span>';
    document.getElementById('riwayat-nilai-anak').innerHTML = `
        <tr>
            <td colspan="4" style="text-align:center; padding: 30px;">
                <p style="margin-bottom:10px;">Data anak belum tersambung ke akun Anda.</p>
                <small style="color:#6b7280;">Hubungi Admin/Guru untuk mendaftarkan ID anak Anda.</small>
            </td>
        </tr>
    `;
}

document.getElementById('btn-logout-ortu').onclick = () => {
    supabaseClient.auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
};