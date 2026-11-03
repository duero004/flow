console.log("🚀 Flow Auto Pro (v4 - Final Bypass) Aktif");

const SEL = {
  promptInput: 'div.ProseMirror[contenteditable="true"]',
  generateBtn: 'button[aria-label="Start generation"]'
};

let isRunning = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sendLog = (text, progress = null) => {
  try { chrome.runtime.sendMessage({ type: "LOG", text, progress }); } catch (e) {}
};

// ==========================================
// TRIK KLIK PAKSAAN (BYPASS ANGULAR)
// ==========================================
function forceClick(element) {
  const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
  
  // Tembak 5 event sekaligus
  element.dispatchEvent(new PointerEvent('pointerdown', opts));
  element.dispatchEvent(new MouseEvent('mousedown', opts));
  element.dispatchEvent(new PointerEvent('pointerup', opts));
  element.dispatchEvent(new MouseEvent('mouseup', opts));
  element.dispatchEvent(new MouseEvent('click', opts));
  
  // Kalau ada form, paksa submit
  if (element.form) element.form.requestSubmit();
}

// ==========================================
// DETEKSI GAMBAR BARU
// ==========================================
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

// ==========================================
// PROSES UTAMA
// ==========================================
async function processPrompt(prompt, index, total, config) {
  const pct = Math.round((index / total) * 100);
  sendLog(`Memproses [${index + 1}/${total}]: "${prompt.slice(0, 15)}..."`, pct);
  
  const inputs = document.querySelectorAll(SEL.promptInput);
  if (!inputs.length) throw new Error("Kotak input tidak ditemukan");
  const input = inputs[inputs.length - 1]; 
  
  input.focus();
  input.click();
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  
  // Ketik teks
  for (let i = 0; i < prompt.length; i++) {
    document.execCommand("insertText", false, prompt[i]);
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));

  sendLog("Menunggu tombol aktif...", pct);
  let btn = null;
  for (let i = 0; i < 20; i++) {
    btn = document.querySelector(SEL.generateBtn);
    if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") break;
    await sleep(500);
  }

  if (!btn || btn.disabled) throw new Error("Tombol tetap disabled");

  // Ambil snapshot gambar sebelum generate
  const beforeSet = getMediaUrls();

  sendLog("Memicu Generate (Force Click)...", pct);
  forceClick(btn);
  
  // Fallback Enter
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

  sendLog("Menunggu hasil render...", pct);
  const resultUrl = await waitForResult(beforeSet);

  if (resultUrl) {
    const isVideo = resultUrl.includes('.mp4') || resultUrl.startsWith('blob:video');
    const ext = isVideo ? 'mp4' : 'png';
    const filename = `prompt_${index + 1}_${Date.now()}.${ext}`;
    
    // Kirim perintah download ke background.js
    chrome.runtime.sendMessage({ type: "DOWNLOAD", url: resultUrl, filename });
    sendLog(`✅ Sukses diunduh!`, pct);
  } else {
    sendLog(`⚠️ Gagal deteksi gambar.`, pct);
  }

  // Jeda sebelum prompt berikutnya
  const jitter = Math.floor(Math.random() * 3000) + 2000;
  await sleep((config.delay * 1000) + jitter);
}

async function runQueue(prompts, config) {
  isRunning = true;
  for (let i = 0; i < prompts.length; i++) {
    if (!isRunning) break;
    try {
      await processPrompt(prompts[i], i, prompts.length, config);
    } catch (err) {
      sendLog(`❌ Error: ${err.message}`, Math.round((i / prompts.length) * 100));
      await sleep(3000);
    }
  }
  isRunning = false;
  sendLog("🏁 Antrean selesai.", 100);
}

// Listener untuk UI Neo-Brutalism
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START") {
    if (isRunning) return sendLog("Antrean sedang berjalan!");
    runQueue(msg.prompts, msg.config);
  } else if (msg.type === "STOP") {
    isRunning = false;
    sendLog("Sistem dihentikan pengguna.");
  }
});
