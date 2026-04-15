# Bauer Delivery Note System

Sistem manajemen dan pembuatan Surat Jalan (Delivery Note) yang dirancang khusus untuk memenuhi kebutuhan operasional PT. BAUER Pratama Indonesia.

## 🚀 Fitur Utama

- **Otentikasi Pengguna**: Login dengan tingkatan akses (Admin & User).
- **Manajemen Master Barang**: Kelola data SKU, Nama Barang, dan Satuan secara terpusat.
- **Pembuatan Surat Jalan**: Form fleksibel untuk input detail pengiriman, keterangan kendaraan, dan daftar barang.
- **Penomoran Otomatis**: Format nomor surat jalan otomatis (Contoh: `001 /04/BPI/2026`) dengan opsi override manual.
- **Sistem Persetujuan**: Alur kerja persetujuan oleh Admin (APPROVED/PENDING/REJECTED).
- **Format Cetak Standar**: Layout cetak yang presisi mengikuti template resmi PT. BAUER Pratama Indonesia.
- **Dashboard Terpusat**: Lihat histori dan status seluruh surat jalan yang telah dibuat.

## 🛠️ Teknologi yang Digunakan

- **Backend**: Node.js & Express.js
- **Database**: SQLite3
- **Frontend**: HTML5, CSS3, & Vanilla JavaScript
- **Styling**: Custom CSS (Modern & Responsive)

## 📦 Instalasi

1. Pastikan Anda telah menginstal [Node.js](https://nodejs.org/).
2. Clone repository ini atau download source code.
3. Buka terminal di folder project dan jalankan:
   ```bash
   npm install
   ```

## 🏃 Memulai Aplikasi

Untuk menjalankan server pengembangan:
```bash
npm start
```
Aplikasi akan berjalan di `http://localhost:3000`.

## 📂 Struktur Project

- `public/`: File frontend (HTML, CSS, JS).
- `src/server.js`: Logika server dan API endpoints.
- `src/database.js`: Konfigurasi dan inisialisasi database SQLite.
- `database.sqlite`: File database (dihasilkan otomatis).

## 📄 Lisensi

Project ini dikembangkan untuk penggunaan internal PT. BAUER Pratama Indonesia.
