// ============================================================
// SELECTOR TERVERIFIKASI (labs.google + flow.google.com)
// ============================================================
const PROMPT_INPUT_SELECTORS = [
  'div[role="textbox"][data-slate-editor="true"]', // labs (Slate)
  'div.ProseMirror[contenteditable="true"]',       // flow.google.com
  '[contenteditable="true"][role="textbox"]',
  '[contenteditable="true"]'
];

const GENERATE_BUTTON_SELECTORS = [
  'button:has(mat-icon:text-is("arrow_forward"))',
  'button:has(i.google-symbols:text-is("arrow_forward"))',
  'button:has([class*="arrow_forward"])'
];

let running = false;

// ============================================================
// UTILITY
// ============================================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function sendProgress(text) {
  try {
    chrome.runtime.sendMessage({ type: "PROGRESS", text });
  } catch (e) { /* popup mungkin tertutup */ }
}

function pickElement(selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // selector tidak valid di browser ini, lanjut
    }
  }
  return null;
}

function waitForElement(selectors, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const found = pickElement(selectors);
    if (found) return resolve(found);

    const observer = new MutationObserver(() => {
      const el = pickElement(selectors);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error("Timeout menunggu elemen"));
    }, timeout);
  });
}

// ============================================================
// INPUT PROMPT (Slate & ProseMirror kompatibel)
// ============================================================
function setPromptText(el, text) {
  el.focus();
  el.click();

  // Pilih semua isi lama & hapus
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("delete", false, null);
  } catch (e) { /* ignore */ }

  // Cara 1: simulasi paste
  let inserted = false;
  try {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    const evt = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      composed: true,
      clipboardData: dt
    });
    el.dispatchEvent(evt);
    inserted = (el.textContent || "").includes(text.slice(0, 10));
  } catch (e) { /* fallback */ }

  // Cara 2: execCommand
  if (!inserted) {
    try {
      document.execCommand("insertText", false, text);
      inserted = (el.textContent || "").includes(text.slice(0, 10));
    } catch (e) { /* fallback */ }
  }

  // Cara 3: ketik manual per karakter (paling lambat tapi paling tahan)
  if (!inserted) {
    for (const ch of text) {
      el.dispatchEvent(new InputEvent("beforeinput", {
        bubbles: true, cancelable: true, inputType: "insertText", data: ch
      }));
      document.execCommand("insertText", false, ch);
    }
  }

  // Pastikan event input terkirim (React listener)
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// ============================================================
// DETEKSI GAMBAR HASIL
// ============================================================
function snapshotImages() {
  return new Set(
    Array.from(document.querySelectorAll("img"))
      .map((img) => img.src)
      .filter((s) => s && (s.startsWith("blob:") || s.startsWith("https:")))
  );
}

async function waitForNewImage(beforeSet, timeout = 90000) {
  return new Promise((resolve) => {
    const check = () => {
      const imgs = Array.from(document.querySelectorAll("img"));
      for (let i = imgs.length - 1; i >= 0; i--) {
        const src = imgs[i].src;
        if (src && !beforeSet.has(src) && imgs[i].naturalWidth > 100) {
          return imgs[i];
        }
      }
      return null;
    };

    const found = check();
    if (found) return resolve(found);

    const observer = new MutationObserver(() => {
      const img = check();
      if (img) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(img);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"]
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// ============================================================
// ALUR UTAMA
// ============================================================
async function processPrompt(prompt, index, total, delaySec) {
  sendProgress(`[${index + 1}/${total}] Mengisi: "${prompt.slice(0, 40)}..."`);

  const input = await waitForElement(PROMPT_INPUT_SELECTORS, 20000);
  setPromptText(input, prompt);
  await sleep(rand(800, 1200));

  const btn = await waitForElement(GENERATE_BUTTON_SELECTORS, 10000);
  if (!btn) throw new Error("Tombol Generate tidak ditemukan");

  // Cek tombol tidak disabled
  if (btn.disabled || btn.getAttribute("aria-disabled") === "true") {
    throw new Error("Tombol Generate masih disabled (prompt kosong?)");
  }

  const before = snapshotImages();
  btn.click();

  sendProgress(`[${index + 1}/${total}] Menunggu hasil generate...`);

  // Tunggu gambar baru muncul
  const img = await waitForNewImage(before, Math.max(90000, delaySec * 3000));

  if (img && img.src) {
    const filename = `flow_${String(index + 1).padStart(3, "0")}_${Date.now()}.png`;
    chrome.runtime.sendMessage({
      type: "DOWNLOAD",
      url: img.src,
      filename
    });
    sendProgress(`[${index + 1}/${total}] ✅ Diunduh: ${filename}`);
  } else {
    sendProgress(`[${index + 1}/${total}] ⚠️ Gambar tidak terdeteksi, lanjut.`);
  }

  // Jeda antar prompt (acak agar natural, hindari reCAPTCHA)
  const jitter = rand(2000, 5000);
  await sleep(delaySec * 1000 + jitter);
}

async function runBatch(prompts, delaySec) {
  running = true;
  sendProgress(`Mulai ${prompts.length} prompt...`);

  for (let i = 0; i < prompts.length; i++) {
    if (!running) break;
    try {
      await processPrompt(prompts[i], i, prompts.length, delaySec);
    } catch (e) {
      console.error(e);
      sendProgress(`[${i + 1}/${prompts.length}] ❌ Error: ${e.message}`);
      await sleep(3000);
    }
  }

  running = false;
  sendProgress(running ? "Dihentikan." : "✅ Selesai semua.");
}

// ============================================================
// LISTENER DARI POPUP
// ============================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START") {
    if (running) {
      sendProgress("Masih berjalan, tunggu selesai atau klik Stop.");
      return;
    }
    runBatch(msg.prompts, msg.delay);
    sendResponse({ ok: true });
  } else if (msg.type === "STOP") {
    running = false;
    sendProgress("Dihentikan oleh pengguna.");
    sendResponse({ ok: true });
  }
  return true;
});
