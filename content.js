const SEL = {
  promptInput: 'div.ProseMirror[contenteditable="true"]',
  generateBtn: 'button[aria-label="Start generation"]'
};

let isRunning = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Kirim log ke popup (jika popup terbuka)
const sendLog = (text) => {
  try { chrome.runtime.sendMessage({ type: "LOG", text }); } catch (e) {}
};

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

function waitForButtonEnabled(button, timeout = 15000) {
  return new Promise((resolve) => {
    if (!button.disabled && button.getAttribute("aria-disabled") !== "true") {
      return resolve(true);
    }
    const interval = setInterval(() => {
      if (!button.disabled && button.getAttribute("aria-disabled") !== "true") {
        clearInterval(interval);
        resolve(true);
      }
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      resolve(false);
    }, timeout);
  });
}

function setPromptText(el, text) {
  el.focus();
  el.click();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("delete", false, null);

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
  } catch (e) {
    document.execCommand("insertText", false, text);
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
}

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

async function processPrompt(prompt, index, total, config) {
  sendLog(`[${index + 1}/${total}] Menyiapkan: "${prompt.slice(0, 20)}..."`);
  
  const input = await waitForElement(SEL.promptInput);
  setPromptText(input, prompt);
  
  await sleep(1500);

  const before = getMediaUrls();
  
  const btn = await waitForElement(SEL.generateBtn);
  sendLog(`[${index + 1}/${total}] Menunggu tombol aktif...`);
  await waitForButtonEnabled(btn);
  
  sendLog(`[${index + 1}/${total}] Mengklik Generate...`);
  btn.click();

  sendLog(`[${index + 1}/${total}] Memproses hasil...`);
  const resultUrl = await waitForResult(before);

  if (resultUrl) {
    const isVideo = resultUrl.includes('.mp4') || resultUrl.startsWith('blob:video');
    const ext = isVideo ? 'mp4' : 'png';
    const filename = `prompt_${index + 1}_${Date.now()}.${ext}`;
    
    chrome.runtime.sendMessage({ type: "DOWNLOAD", url: resultUrl, filename });
    sendLog(`[${index + 1}/${total}] ✅ Sukses diunduh.`);
  } else {
    sendLog(`[${index + 1}/${total}] ⚠️ Gagal deteksi hasil.`);
  }

  const jitter = rand(2000, 5000);
  await sleep((config.delay * 1000) + jitter);
}

async function runQueue(prompts, config) {
  isRunning = true;
  sendLog(`=== MULAI (${prompts.length} item) ===`);

  for (let i = 0; i < prompts.length; i++) {
    if (!isRunning) break;

    try {
      await processPrompt(prompts[i], i, prompts.length, config);
    } catch (err) {
      sendLog(`[${i + 1}] ❌ Error: ${err.message}`);
      await sleep(3000);
    }
  }

  isRunning = false;
  sendLog(`=== SELESAI ===`);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_QUEUE") {
    if (isRunning) return;
    runQueue(msg.prompts, msg.config);
  } else if (msg.type === "STOP_QUEUE") {
    isRunning = false;
    sendLog("Dihentikan...");
  }
});
