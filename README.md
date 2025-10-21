# Invoice Management System (React + Express + SQLite)

Repo ini berisi aplikasi **Invoice Management System** dengan arsitektur **frontend React (Vite + TypeScript)** dan **backend Express (Node.js) + SQLite**. Dokumen ini disiapkan agar teman/kolaborator bisa langsung menjalankan proyek tanpa bingung menginstal library dan men-setup lingkungan.

> **Catatan penting:** Di repo masih ada artefak lama terkait **Encore + PostgreSQL** (mis. `encore.app`, beberapa file client API). Implementasi yang _aktif_ saat ini memakai **Express + SQLite**. Ikuti README ini—abaikan artefak Encore.

---

## 🔧 Teknologi & Library Utama

**Frontend**

- React 19 + Vite 6 + TypeScript
- React Router 7
- TanStack Query 5 (data fetching & caching)
- Tailwind CSS v4 (+ `tailwindcss-animate`, `tailwind-merge`)
- Radix UI (Dialog, Select, Toast, dll)
- Lucide React (ikon)
- Util: `clsx`, `class-variance-authority`

**Backend**

- Express 5
- SQLite3 (file DB lokal)
- CORS
- bcryptjs (hash password)
- jsonwebtoken (JWT auth)
- Multer (sudah terpasang; upload file belum diaktifkan oleh endpoint saat ini)

---

## 🗂️ Struktur Direktori

```
invoice-management-system-main/
├─ frontend/                     # React + Vite app
│  ├─ pages/
│  │  ├─ admin/
│  │  │  ├─ invoice/            # Modul Admin Invoice
│  │  │  │  ├─ Dashboard.tsx
│  │  │  │  ├─ Invoices.tsx
│  │  │  │  ├─ CreateInvoice.tsx
│  │  │  │  ├─ InvoiceDetail.tsx
│  │  │  │  ├─ Customers.tsx
│  │  │  │  └─ login.tsx
│  │  │  └─ verifier/           # Modul Admin Verifier
│  │  │     ├─ index.tsx
│  │  │     ├─ clients.tsx
│  │  │     ├─ Vendors.tsx
│  │  │     └─ login.tsx
│  │  └─ client/                # Modul Client (pelanggan)
│  │     ├─ Dashboard.tsx
│  │     ├─ Login.tsx
│  │     └─ Register.tsx
│  ├─ components/               # Layout & UI (shadcn-style)
│  │  ├─ Layout.tsx
│  │  └─ ui/                    # button.tsx, input.tsx, card.tsx, dialog.tsx, toast*.tsx, dll.
│  ├─ src/
│  │  ├─ lib/usePageMeta.ts
│  │  └─ assets/brand-logo.png
│  ├─ .env.development          # VITE_CLIENT_TARGET (default: http://localhost:4000)
│  ├─ App.tsx, main.tsx, index.html, tailwind.config.js, vite.config.ts
│  └─ package.json
│
├─ my-backend/                  # Express API + SQLite
│  ├─ src/
│  │  ├─ index.js               # Server Express, daftar route API
│  │  ├─ db.js                  # Init DB + migrasi schema SQLite
│  │  └─ routes/adminInvoice.js # Endpoint Admin Invoice (contoh modularisasi)
│  ├─ data/app.sqlite           # File DB (dibuat otomatis saat run)
│  ├─ scripts/
│  │  ├─ seed-admin.js          # Seed akun admin (invoice & verifier)
│  │  └─ migrate-add-completed.js# Contoh migrasi tambahan
│  └─ package.json
│
├─ encore.app                   # Artefak Encore (usang) → abaikan
├─ README.md / DEVELOPMENT.md   # Dokumen lama (Encore) → abaikan
└─ package.json (root, workspace lama) → tidak sinkron
```

---

## ✅ Prasyarat

- **Node.js 18+** (disarankan LTS terbaru)
- Port default dev:
  - Frontend: `http://localhost:5173`
  - Backend: `http://localhost:4000`

---

## 🚀 Setup Cepat (Development)

### 1) Jalankan Backend (Express + SQLite)

```bash
cd my-backend
npm install

# (Opsional) set secret JWT (jika tidak di-set, akan pakai default "dev_secret_change_me")
# macOS/Linux:
export JWT_SECRET="ganti_dengan_string_acak_panjang"
# Windows PowerShell:
# $env:JWT_SECRET="ganti_dengan_string_acak_panjang"

# Seed akun admin (jalankan sekali di awal)
node scripts/seed-admin.js

# Start server (port 4000)
npm start
```

**Lokasi DB**: `my-backend/data/app.sqlite`  
**Reset DB**: matikan server → hapus file tersebut → jalankan lagi (dan seed ulang bila perlu).

> **CORS**: backend default mengizinkan origin `http://localhost:5173`. Jika FE berjalan di domain/port lain, ubah konfigurasi `cors` di `my-backend/src/index.js`.

### 2) Jalankan Frontend (React + Vite)

```bash
cd ../frontend
npm install

# Pastikan file berikut ada & sesuai:
# .env.development
# VITE_CLIENT_TARGET=http://localhost:4000

# Jalankan Vite dev server
npm run dev
```

Buka `http://localhost:5173` di browser.

---

## 👥 Akun Awal (Hasil Seed)

- **Admin Invoice**  
  Email: `invoice@admin.com`  
  Password: `admin123`

- **Admin Verifier**  
  Email: `verifier@admin.com`  
  Password: `admin123`

> Kredensial ini dibuat oleh `scripts/seed-admin.js`. Kamu bisa ubah sesuai kebutuhan setelah login.

---

## 🔐 Alur Login & Token

Token JWT disimpan di **localStorage**:

- `admin_invoice_token`
- `admin_verifier_token`
- `client_token`

**Rute login (frontend):**

- Admin Invoice: `/admin/invoice/login`
- Admin Verifier: `/admin/verifier/login`
- Client: `/client/login`, `/client/register`

Jika mengalami **auto-redirect/auto-refresh loop**, hapus token-token di atas dari `localStorage`, lalu login ulang.

---

## ⚙️ Variabel Lingkungan

### Backend (`my-backend`)

- `JWT_SECRET` (opsional; default `"dev_secret_change_me"` bila tidak di-set)
- Port backend saat ini **hard-coded 4000** di `src/index.js` (bisa diubah ke ENV jika mau—lihat bagian _Perapihan_).

### Frontend (`frontend`)

Buat/cek `.env.development`:

```
VITE_CLIENT_TARGET=http://localhost:4000
```

Ubah jika backend jalan di host/port lain.

---

## 🛣️ Ringkasan Endpoint API (contoh utama)

> **Sumber kebenaran** tetap file `my-backend/src/index.js` dan folder `routes/`. Endpoint di bawah adalah yang umum/sering dipakai saat ini.

**Auth & Client**

- `POST /api/auth/register` – Registrasi client
- `POST /api/auth/login` – Login client
- `GET  /api/client/me` – Profil client (butuh Bearer token)
- `GET  /api/client/orders` – Daftar order milik client

**Admin Verifier**

- `POST /api/admin/login` – Login admin verifier
- `GET  /api/admin/vendors` – Daftar vendor
- `POST /api/admin/vendors` – Tambah vendor
- `GET  /api/admin/clients` – Daftar client

**Admin Invoice**

- `POST /api/admin/invoice/login` – Login admin invoice
- `GET  /api/invoices` – Daftar invoice/order
- `GET  /api/invoices/:id` – Detail invoice
- `GET  /api/customers` – Daftar customer

**Simulasi Pembayaran**

- `GET  /pay/:orderId` – Halaman HTML sederhana pembayaran
- `POST /api/payments/mock-paid` – Tandai order lunas (mock)

> Beberapa endpoint mungkin bertambah/berubah. Periksa kode untuk kebenaran final.

---

## 🧪 Skrip & Perintah NPM Penting

**Backend (`my-backend`)**

- `npm start` – Menjalankan server Express
- `node scripts/seed-admin.js` – Membuat akun admin awal
- `node scripts/migrate-add-completed.js` – Contoh migrasi skema

**Frontend (`frontend`)**

- `npm run dev` – Menjalankan Vite dev server
- `npm run build` – Build produksi
- `npm run preview` – Preview build produksi

---

## 🛠️ Troubleshooting

- **CORS error**  
  Pastikan origin FE cocok di konfigurasi CORS backend (`index.js`). Ubah `origin` sesuai asal FE.

- **Auto-refresh/redirect loop setelah logout/login**  
  Bersihkan `localStorage`: `admin_invoice_token`, `admin_verifier_token`, `client_token`. Pastikan `VITE_CLIENT_TARGET` mengarah ke backend yang benar.

- **Gagal install `sqlite3` di Windows**  
  Pastikan Node versi LTS, lalu coba ulang. Jika tetap gagal, instal _Build Tools_ (Python & Visual Studio Build Tools) lalu `npm install` lagi.

- **Ganti host/port backend**  
  Update `VITE_CLIENT_TARGET` di `.env.development` FE dan (opsional) ubah port di backend. Restart server setelah perubahan ENV.

---

## 🧹 Perapihan (Opsional tapi Disarankan)

1. **ENV & Port Backend**  
   Tambahkan `dotenv` agar `PORT` & `JWT_SECRET` diatur dari `.env`, bukan hard-coded.

2. **Hapus Artefak Lama**  
   Untuk menghindari kebingungan, hapus/arsipkan: `encore.app`, dokumen README lama, file client Encore lama.

3. **Tambahkan Skrip Dev**  
   Gunakan `nodemon` untuk hot-reload backend (`"dev": "nodemon src/index.js"`).

4. **Dokumentasi Akun Seed**  
   Pertahankan bagian “Akun Awal” di README agar QA mudah login.

---

## 📦 Build Produksi (Ringkas)

- **Frontend**
  ```bash
  cd frontend
  npm install
  npm run build
  # hasil build ada di dist/
  ```
- **Backend**
  - Pastikan ENV (`JWT_SECRET`, port) telah di-set.
  - Jalankan `npm start` (atau pakai process manager seperti PM2).

> Untuk hosting, atur reverse proxy (Nginx/Caddy) agar `FE → /` dan `BE → /api`.

---

## 📜 Lisensi

Internal/Proprietary (sesuaikan kebutuhan organisasi).

---

## 🧭 Kontak & Kredit

Disusun ulang & dirapikan untuk memudahkan developer onboarding. Silakan lanjutkan pengembangan sesuai kebutuhan tim.
