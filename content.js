console.log("🚀 Flow Auto v7 (Final Clicker) Aktif!");

let isRunning = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sendLog = (text) => {
  try { chrome.runtime.sendMessage({ type: "LOG", text }); } catch (e) {}
};

async function prosesKlik(prompt, index) {
  sendLog(`Memproses prompt ke-${index + 1}...`);

  // 1. CARI KOTAK KETIK
  const inputEl = document.querySelector('div[role="textbox"][aria-label="What do you want to change?"]');
  if (!inputEl) {
    sendLog("❌ Input kotak ketik nggak ketemu!");
    return;
  }

  // 2. MASUKKIN TEKS
  inputEl.focus();
  inputEl.click();
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  
  // Ketik per karakter biar sistem Flow sadar
  for (let i = 0; i < prompt.length; i++) {
    document.execCommand("insertText", false, prompt[i]);
  }
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  
  sendLog("✅ Teks masuk. Nunggu tombol nyala...");

  // 3. TUNGGU TOMBOL JADI AKTIF (Atribut disabled hilang)
  let btn = null;
  let isReady = false;

  for (let i = 0; i < 20; i++) {
    btn = document.querySelector('button[aria-label="Start generation"]');
    
    // Cek apakah tombol sudah tidak disabled
    if (btn && !btn.hasAttribute("disabled")) {
      isReady = true;
      break;
    }
    await sleep(500);
  }

  if (!isReady || !btn) {
    sendLog("❌ Gagal: Tombol tetap redup (disabled). Teks ditolak Angular!");
    if (btn) btn.style.border = "4px solid red"; // Tanda gagal
    return;
  }

  // 4. KLIK TOMBOLNYA!
  btn.style.border = "4px solid lime"; // Tanda siap klik
  sendLog("✅ Tombol menyala hijau! Mencoba klik...");

  // Tembak semua event mouse yang mungkin ditunggu Angular
  const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
  btn.dispatchEvent(new PointerEvent('pointerdown', opts));
  btn.dispatchEvent(new MouseEvent('mousedown', opts));
  btn.dispatchEvent(new PointerEvent('pointerup', opts));
  btn.dispatchEvent(new MouseEvent('mouseup', opts));
  btn.dispatchEvent(new MouseEvent('click', opts));

  sendLog("🚀 Klik terkirim! Silakan lihat layar Flow, apakah loading muter?");
  
  // Jeda 20 detik buat kasih waktu lu lihat hasilnya di layar
  await sleep(20000); 
  sendLog(`✅ Prompt ${index + 1} selesai diproses.`);
}

async function runQueue(prompts) {
  isRunning = true;
  for (let i = 0; i < prompts.length; i++) {
    if (!isRunning) break;
    await prosesKlik(prompts[i], i);
  }
  isRunning = false;
  sendLog("🏁 Semua antrean selesai.");
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START") {
    if (isRunning) return;
    runQueue(msg.prompts);
  } else if (msg.type === "STOP") {
    isRunning = false;
  }
});
