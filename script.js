// ==========================================
// 1. KONFIGURASI SUPABASE
// ==========================================
const supabaseUrl = import.meta.env.VITE_Supabase_Url;
const supabaseKey = import.meta.env.VITE_Supabase_Key;
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. SISTEM NOTIFIKASI TOAST & LOADING
// ==========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showLoading(text = "Sedang Memproses...") {
    const loader = document.getElementById('global-loader');
    const loaderText = document.getElementById('loader-text');
    if (loader && loaderText) {
        loaderText.innerText = text;
        loader.classList.add('show'); // Pastikan CSS menggunakan .show bukan .hidden
    }
}

function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.remove('show');
}

// ==========================================
// 3. LOGIKA LOGIN UNIVERSAL
// ==========================================

async function handleLogin() {
    // Ambil data dari input index.html
    const emailInput = document.getElementById('input-email');
    const passwordInput = document.getElementById('input-password');

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        return showToast("Masukkan email dan password!", "error");
    }

    showLoading("Mencocokkan Kredensial...");

    try {
        // A. Login ke Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) throw authError;

        // B. Ambil Role dan Nama Asli dari tabel 'users'
        // PERBAIKAN: Menggunakan 'nama_asli' sesuai database Anda
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('role, nama_asli')
            .eq('id', authData.user.id)
            .single();

        if (userError) throw userError;

        showToast(`Selamat datang, ${userData.nama_asli}!`, "success");

        // C. PENGALIHAN BERDASARKAN ROLE
        // Delay sedikit agar user sempat melihat pesan sukses
        setTimeout(() => {
            if (userData.role === 'guru') {
                window.location.href = 'guru.html';
            } else if (userData.role === 'siswa') {
                window.location.href = 'siswa.html';
            } else if (userData.role === 'orangtua' || userData.role === 'orang_tua') {
                window.location.href = 'orangtua.html';
            } else {
                showToast("Role tidak dikenali. Hubungi Admin.", "error");
            }
        }, 800);

    } catch (error) {
        console.error("Login Error:", error.message);
        showToast("Login Gagal! Email atau password salah.", "error");
    } finally {
        hideLoading();
    }
}

// ==========================================
// 4. INISIALISASI EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Jalankan handleLogin saat tombol diklik
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.onclick = handleLogin;
    }

    // Support Login dengan menekan tombol 'Enter' pada keyboard
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });

    // Cek jika user sudah login sebelumnya (Auto-redirect)
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
        if (user) {
            // Jika sudah ada sesi, tarik role dan alihkan otomatis
            supabaseClient.from('users').select('role').eq('id', user.id).single()
                .then(({ data }) => {
                    if (data?.role === 'guru') window.location.href = 'guru.html';
                    if (data?.role === 'siswa') window.location.href = 'siswa.html';
                    if (data?.role === 'orangtua') window.location.href = 'orangtua.html';
                });
        }
    });
});