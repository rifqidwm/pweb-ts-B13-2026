# pweb-ts-p01-2026 · Antrian Rumah Sakit

Aplikasi antrian native HTML/CSS/TypeScript (tanpa framework/library).

## Menjalankan
1. `npm install`
2. `npm run watch` (atau `npx tsc --watch`), hasil kompilasi masuk ke `dist/`
3. Buka `login.html` pakai Live Server

## Role Access
| Halaman | user | admin / moderator |
|---|---|---|
| ambil-antrian.html | ✔ | ✔ |
| layar.html | ✔ | ✔ |
| index.html (Dashboard Admin) | ✖ | ✔ |
| operator.html | ✖ | ✔ |

Belum login: semua halaman redirect ke `login.html`.
Setelah login: admin/moderator ke `index.html`, user ke `ambil-antrian.html`.

## Struktur
- `src/antrian-shared.ts`: tipe data, Local Storage, penerbitan tiket, auth guard & role guard (dipakai semua halaman)
- `src/login.ts`, `src/index.ts`, `src/operator.ts`, `src/layar.ts`, `src/ambil-antrian.ts`: logika per halaman

## Alur
1. `login.html`: login ke DummyJSON, role diambil dari server (moderator = admin)
2. Admin/moderator: Dashboard (kelola jenis antrian, terbitkan tiket, reset), Operator (Panggil Berikutnya, Lewati, Selesai)
3. Semua role: Ambil Nomor (tiket format `A-001`), Layar Antrian (polling 2,5 detik, suara, layar penuh)

## Tampilan
Semua halaman memakai satu file `css/style.css` dan satu font (Nunito).
Foto login: simpan sebagai `assets/rumah-sakit.jpg`. Kalau tidak ada, dipakai ilustrasi `assets/rumah-sakit.svg`.

## Local Storage
`accessToken`, `token`, `role`, `firstName` (sesi), `queueTypes` (jenis antrian), `tickets` (tiket), `ticketCounters` (nomor urut per kode).
