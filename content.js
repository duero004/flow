console.log("🚀 Flow Auto v9 (Robust Selector) Aktif!");

let isRunning = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sendLog = (text) => {
  try { chrome.runtime.sendMessage({ type: "LOG", text }); } catch (e) {}
};

async function prosesKlik(prompt, index) {
  sendLog(`Memproses: "${prompt.slice(0, 20)}..."`);

  // CARI KOTAK INPUT (Pakai selector yang lebih longgar)
  let inputEl = document.querySelector('.ProseMirror') || document.querySelector('div[role="textbox"]');
  
  // Kalau belum ketemu, tunggu 3 detik
  if (!inputEl) {
    sendLog("Menunggu kotak input muncul...");
    await sleep(3000);
    inputEl = document.querySelector('.ProseMirror') || document.querySelector('div[role="textbox"]');
  }

  if (!inputEl) {
    return sendLog("❌ Kotak input benar-benar tidak ada. Pastikan kursor di dalam project Flow!");
  }

  // Kasih garis merah biar lu tau kotaknya udah ketemu
  inputEl.style.border = "3px solid red";
  
  // Masukkan teks
  inputEl.focus();
  inputEl.click();
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  
  for (let i = 0; i < prompt.length; i++) {
    document.execCommand("insertText", false, prompt[i]);
    await sleep(10); // Ketik per karakter kayak manusia
  }

  let btn = null;
  let isReady = false;
  
  sendLog("Menunggu tombol aktif...");
  for (let i = 0; i < 20; i++) {
    // Selector tombol juga dibuat lebih longgar
    btn = document.querySelector('button[aria-label="Start generation"]') || document.querySelector('button[type="submit"]');
    if (btn && !btn.hasAttribute("disabled")) { isReady = true; break; }
    await sleep(500);
  }

  if (!isReady || !btn) {
    if (btn) btn.style.border = "4px solid red";
    return sendLog("❌ Gagal: Tombol tetap mati (disabled).");
  }

  btn.style.border = "4px solid lime"; 
  sendLog("✅ Tombol aktif! Nge-klik...");

  const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
  btn.dispatchEvent(new PointerEvent('pointerdown', opts));
  btn.dispatchEvent(new MouseEvent('mousedown', opts));
  btn.dispatchEvent(new PointerEvent('pointerup', opts));
  btn.dispatchEvent(new MouseEvent('mouseup', opts));
  btn.dispatchEvent(new MouseEvent('click', opts));

  sendLog("🚀 Klik terkirim! Nunggu proses...");
  await sleep(20000); 
}

async function runQueue(prompts) {
  isRunning = true;
  for (let i = 0; i < prompts.length; i++) {
    if (!isRunning) break;
    await prosesKlik(prompts[i], i);
  }
  isRunning = false;
  sendLog("🏁 Antrean selesai.");
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START") { if (!isRunning) runQueue(msg.prompts); }
  if (msg.type === "STOP") { isRunning = false; }
});
