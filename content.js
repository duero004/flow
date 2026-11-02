// ============================================================
// SELECTOR BERDASARKAN HTML ASLI DARI USER
// ============================================================
const SEL = {
  // Input pakai ProseMirror
  promptInput: 'div.ProseMirror[contenteditable="true"]',
  // Tombol generate sangat spesifik
  generateBtn: 'button[aria-label="Start generation"]'
};

let isRunning = false;

// ============================================================
// UTILITY
// ============================================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const sendLog = (text) => {
  try { chrome.runtime.sendMessage({ type: "LOG", text }); } catch (e) {}
};

// Menunggu elemen muncul
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new Error("Timeout")); }, timeout);
  });
}

// Menunggu tombol berubah dari disabled ke enabled
function waitForButtonEnabled(button, timeout = 15000) {
  return new Promise((resolve) => {
    if (!button.disabled && button.getAttribute("aria-disabled") !== "true") {
      return resolve(true);
    }
    const interval = setInterval(() => {
      // Cek apakah atribut disabled hilang
      if (!button.disabled && button.getAttribute("aria-disabled") !== "true") {
        clearInterval(interval);
        resolve(true);
      }
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      resolve(false); // Timeout, anggap saja tetap bisa diklik
    }, timeout);
  });
}

// Memasukkan teks ke dalam ProseMirror
function setPromptText(el, text) {
  el.focus();
  el.click();

  // Hapus teks lama (jika ada)
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("delete", false, null);

  // Masukkan teks baru
  try {
    // Trik 1: Simulasi Paste (paling aman untuk Angular/ProseMirror)
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    const evt = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      composed: true,
      clipboardData: dt
    });
    el.dispatchEvent(evt);
  } catch (e) {
    // Trik 2: Fallback ketik manual
    document.execCommand("insertText", false, text);
  }

  // Pastikan event input terkirim agar Angular tahu isinya berubah
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// ============================================================
// DETEKSI GAMBAR / VIDEO BARU
// ============================================================
function getMediaUrls() {
  const urls = new Set();
  document.querySelectorAll('img, video').forEach(el => {
    if (el.src && (el.src.startsWith('blob:') || el.src.startsWith('https:'))) {
      urls.add(el.src);
    }
  });
  return urls;
}

async function waitForResult(beforeSet, timeout = 120000) {
  return new Promise((resolve) => {
    const check = () => {
      const media = Array.from(document.querySelectorAll('img, video')).reverse();
      for (let el of media) {
        // Pastikan gambar punya ukuran (bukan ikon kecil)
        if (el.src && !beforeSet.has(el.src) && (el.naturalWidth > 100 || el.videoWidth > 100)) {
          return el.src;
        }
      }
      return null;
    };

    const found = check();
    if (found) return resolve(found);

    const observer = new MutationObserver(() => {
      const src = check();
      if (src) { observer.disconnect(); resolve(src); }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}

// ============================================================
// LOGIKA UTAMA GENERATE
// ============================================================
async function processPrompt(prompt, index, total, config) {
  sendLog(`[${index + 1}/${total}] Menyiapkan: "${prompt.slice(0, 30)}..."`);
  
  // 1. Isi Prompt
  const input = await waitForElement(SEL.promptInput);
  setPromptText(input, prompt);
  
  // 2. Tunggu sebentar agar UI bereaksi
  await sleep(1500);

  // 3. Ambil snapshot media sebelum generate
  const before = getMediaUrls();
  
  // 4. Klik Generate
  const btn = await waitForElement(SEL.generateBtn);
  sendLog(`[${index + 1}/${total}] Menunggu tombol aktif...`);
  await waitForButtonEnabled(btn);
  
  sendLog(`[${index + 1}/${total}] Mengklik tombol Generate...`);
  btn.click();

  // 5. Tunggu hasil render
  sendLog(`[${index + 1}/${total}] Menunggu hasil (bisa memakan waktu)...`);
  const resultUrl = await waitForResult(before);

  if (resultUrl) {
    const isVideo = resultUrl.includes('.mp4') || resultUrl.startsWith('blob:video');
    const ext = isVideo ? 'mp4' : 'png';
    const filename = `prompt_${index + 1}_${Date.now()}.${ext}`;
    
    chrome.runtime.sendMessage({ type: "DOWNLOAD", url: resultUrl, filename });
    sendLog(`[${index + 1}/${total}] ✅ Berhasil diunduh: ${filename}`);
  } else {
    sendLog(`[${index + 1}/${total}] ⚠️ Timeout, gambar tidak terdeteksi.`);
  }

  // 6. Jeda acak sebelum prompt berikutnya agar aman dari limit
  const jitter = rand(2000, 5000);
  sendLog(`[${index + 1}/${total}] Istirahat ${config.delay + Math.floor(jitter/1000)} detik...`);
  await sleep((config.delay * 1000) + jitter);
}

// ============================================================
// KONTROL ANTREAN
// ============================================================
async function runQueue(prompts, config) {
  isRunning = true;
  sendLog(`=== MULAI BATCH (${prompts.length} item) ===`);

  for (let i = 0; i < prompts.length; i++) {
    if (!isRunning) break;

    let attempts = 0;
    const maxRetries = 2; // Coba 2x jika gagal
    let success = false;

    while (attempts < maxRetries && !success && isRunning) {
      try {
        await processPrompt(prompts[i], i, prompts.length, config);
        success = true;
      } catch (err) {
        attempts++;
        sendLog(`[${i + 1}/${prompts.length}] ❌ Error: ${err.message}`);
        if (attempts < maxRetries) {
          sendLog(`Mencoba ulang...`);
          await sleep(5000);
        }
      }
    }
  }

  isRunning = false;
  sendLog(`=== ANTREAN SELESAI / DIHENTIKAN ===`);
}

// ============================================================
// LISTENER
// ============================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_QUEUE") {
    if (isRunning) return sendLog("Antrean sedang berjalan!");
    runQueue(msg.prompts, msg.config);
    sendResponse({ ok: true });
  } else if (msg.type === "STOP_QUEUE") {
    isRunning = false;
    sendLog("Sinyal berhenti diterima...");
    sendResponse({ ok: true });
  }
  return true;
});
