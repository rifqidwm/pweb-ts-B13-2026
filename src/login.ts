interface LoginResponse {
  id?: number;
  accessToken?: string;
  token?: string;
  message?: string;
  firstName?: string;
  username?: string;
  role?: string;
}

interface UserItem {
  id: number;
  username: string;
  role?: string;
}

interface FilterUsersResponse {
  users: UserItem[];
}

(() => {
  const loginForm = byId<HTMLFormElement>("loginForm");
  const usernameInput = byId<HTMLInputElement>("username");
  const passwordInput = byId<HTMLInputElement>("password");
  const submitBtn = byId<HTMLButtonElement>("submitBtn");
  const errorAlert = byId<HTMLDivElement>("errorAlert");
  const infoAlert = byId<HTMLDivElement>("infoAlert");

  // Sudah login? langsung ke halaman sesuai role, kecuali baru ditolak role guard.
  const existing = getSession();
  const denied = new URLSearchParams(window.location.search).has("denied");
  if (existing && !denied) {
    window.location.replace(homeFor(existing.role));
    return;
  }
  if (existing && denied) {
    infoAlert.style.display = "block";
    infoAlert.innerHTML = "";
    infoAlert.append(
      `Akun ${existing.firstName} (role ${existing.role}) tidak punya akses ke halaman tersebut. Masuk dengan akun admin/moderator, atau `,
    );
    const back = el("a", "", "kembali ke Ambil Antrian");
    back.href = homeFor(existing.role);
    infoAlert.append(back, ".");
  }

  function showError(message: string): void {
    errorAlert.textContent = message;
    errorAlert.style.display = "block";
  }

  /** Role diambil dari server. /auth/me mengembalikan data user lengkap termasuk role. */
  async function resolveRole(token: string, username: string): Promise<Role> {
    try {
      const meRes = await fetch("https://dummyjson.com/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.ok) {
        const me: LoginResponse = await meRes.json();
        const role = normalizeRole(me.role);
        if (role) return role;
      }
    } catch {
      /* lanjut ke endpoint filter */
    }

    // Cadangan: endpoint filter role sesuai modul.
    for (const role of ["admin", "moderator", "user"] as Role[]) {
      try {
        const res = await fetch(
          `https://dummyjson.com/users/filter?key=role&value=${role}&limit=0&select=username,role`,
        );
        if (!res.ok) continue;
        const data: FilterUsersResponse = await res.json();
        if (data.users?.some((u) => u.username === username)) return role;
      } catch {
        /* coba role berikutnya */
      }
    }
    // Tidak ketemu di mana pun: beri hak paling rendah.
    return "user";
  }

  loginForm.addEventListener("submit", async (event: Event) => {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) {
      showError("Username dan password wajib diisi.");
      return;
    }

    errorAlert.style.display = "none";
    errorAlert.textContent = "";
    infoAlert.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "Memproses...";

    try {
      const response = await fetch("https://dummyjson.com/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, expiresInMins: 60 }),
      });

      const data: LoginResponse = await response.json();
      if (!response.ok) {
        throw new Error(data.message === "Invalid credentials"
          ? "Username atau password salah."
          : data.message || "Gagal melakukan otentikasi.");
      }

      const token = data.accessToken || data.token;
      if (!token) throw new Error("Token akses tidak ditemukan dari respons server.");

      const role = normalizeRole(data.role) ?? (await resolveRole(token, username));

      localStorage.setItem("accessToken", token);
      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      localStorage.setItem("firstName", data.firstName || username);

      window.location.href = homeFor(role);
    } catch (error) {
      const message = error instanceof TypeError
        ? "Koneksi jaringan gagal. Periksa internet Anda lalu coba lagi."
        : error instanceof Error ? error.message : "Terjadi kesalahan tidak terduga.";
      showError(message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Masuk";
    }
  });
})();
