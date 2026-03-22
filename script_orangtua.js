// ==========================================
// 1. KONFIGURASI SUPABASE
// ==========================================
const supabaseUrl = import.meta.env.VITE_Supabase_Url;
const supabaseKey = import.meta.env.VITE_Supabase_Key;
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. INISIALISASI HALAMAN ORANG TUA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // A. Cek Status Login
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
        window.location.href = 'dashboard.html'; 
        return;
    }

    try {
        // B. Ambil Profil Orang Tua (untuk mendapatkan child_id)
        const { data: ortuData, error: ortuError } = await supabaseClient
            .from('users').select('*').eq('id', user.id).single();

        if (ortuError) throw ortuError;
        document.getElementById('user-name').innerText = ortuData.full_name;

        // C. Cek apakah orang tua sudah dihubungkan dengan anak
        if (!ortuData.child_id) {
            document.getElementById('nama-anak').innerHTML = '<span style="color:red;">Belum terhubung ke data siswa. Lapor ke admin.</span>';
            document.getElementById('riwayat-nilai-anak').innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada data.</td></tr>';
            return;
        }

        // D. Jika terhubung, ambil data anak dan riwayat nilainya
        muatDataAnak(ortuData.child_id);

    } catch (err) {
        alert("Gagal memuat profil orang tua.");
    }
});

// ==========================================
// 3. AMBIL DATA ANAK & NILAINYA
// ==========================================
async function muatDataAnak(childId) {
    try {
        // 1. Ambil Nama dan Kelas Anak
        const { data: anakData, error: anakError } = await supabaseClient
            .from('users')
            .select('full_name, classes(name)')
            .eq('id', childId)
            .single();

        if (!anakError) {
            document.getElementById('nama-anak').innerText = anakData.full_name;
            document.getElementById('kelas-anak').innerText = anakData.classes?.name || '-';
        }

        // 2. Ambil Riwayat Tugas (Submissions) milik anak tersebut
        const tbody = document.getElementById('riwayat-nilai-anak');
        const { data: subs, error: subsError } = await supabaseClient
            .from('submissions')
            .select('score, feedback, created_at, tasks(title)')
            .eq('student_id', childId)
            .order('created_at', { ascending: false });

        if (subsError || !subs || subs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af;">Belum ada tugas yang dikerjakan anak Anda.</td></tr>';
            return;
        }

        // 3. Tampilkan ke dalam tabel
        tbody.innerHTML = subs.map(s => {
            const tanggal = new Date(s.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            // Beri warna hijau jika nilai > 75, merah jika kurang
            const warnaNilai = s.score >= 75 ? 'var(--success)' : 'var(--danger)';

            return `
                <tr>
                    <td style="font-weight: 500;">${s.tasks?.title || 'Tugas Tidak Diketahui'}</td>
                    <td style="font-size: 13px; color: #6b7280;">${tanggal}</td>
                    <td style="font-weight:bold; font-size: 16px; color: ${warnaNilai};">${s.score || '0'}</td>
                    <td style="font-size: 13px; line-height: 1.5; color: #4b5563;">${s.feedback || 'Tidak ada catatan.'}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Gagal memuat data anak:", err);
    }
}

// ==========================================
// 4. LOGOUT
// ==========================================
document.getElementById('btn-logout-ortu').onclick = () => {
    supabaseClient.auth.signOut().then(() => {
        window.location.href = 'dashboard.html';
    });
};