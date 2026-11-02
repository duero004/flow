# Flow Auto Generator

Ekstensi Chrome untuk otomatisasi generate gambar di Google Flow
(labs.google / flow.google.com).

## Instalasi

1. Unduh repo ini: tombol **Code** → **Download ZIP**.
2. Ekstrak ZIP ke folder **permanen** (jangan di Downloads).
3. Buka `chrome://extensions/` di Chrome.
4. Aktifkan **Developer mode** (toggle kanan atas).
5. Klik **Load unpacked**, pilih folder hasil ekstrak.

## Penggunaan

1. Buka https://labs.google/fx/tools/flow atau https://flow.google.com
2. Buka sebuah project Flow (agar kolom prompt muncul).
3. Klik ikon ekstensi **Flow Auto Generator**.
4. Tempel prompt (satu per baris), atur jeda (default 15 detik).
5. Klik **▶ Start**. Hasil diunduh otomatis ke folder `Downloads/flow-auto/`.

## Update

Setiap ada versi baru:
1. Download ulang ZIP dari repo ini.
2. Ekstrak ke folder yang **sama** (timpa folder lama).
3. Buka `chrome://extensions/`, klik ikon **reload** pada ekstensi.

## Catatan

- Selector di `content.js` mungkin perlu diperbarui jika UI Flow berubah.
- Otomatisasi pihak ketiga dapat melanggar ToS Google. Gunakan bijak.
- Jeda 15+ detik dianjurkan untuk menghindari deteksi reCAPTCHA.
