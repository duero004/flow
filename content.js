console.log("🚀 Flow Auto Final Aktif!");

let isRunning = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sendLog = (text) => {
  try { chrome.runtime.sendMessage({ type: "LOG", text }); } catch (e) {}
};

async function prosesKlik(prompt, index) {
  sendLog(`Memproses: "${prompt.slice(0, 15)}..."`);

  const inputEl = document.querySelector('div[role="textbox"][aria-label="What do you want to change?"]');
  if (!inputEl) return sendLog("❌ Kotak input tidak ketemu. Buka project Flow!");

  inputEl.focus();
  inputEl.click();
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  
  // Trik Ketik Manusia
  for (let i = 0; i < prompt.length; i++) {
    document.execCommand("insertText", false, prompt[i]);
    await sleep(15); 
  }

  let btn = document.querySelector('button[aria-label="Start generation"]');
  let isReady = false;
  for (let i = 0; i < 20; i++) {
    btn = document.querySelector('button[aria-label="Start generation"]');
    if (btn && !btn.hasAttribute("disabled")) { isReady = true; break; }
    await sleep(500);
  }

  if (!isReady || !btn) {
    if (btn) btn.style.border = "4px solid red";
    return sendLog("❌ Gagal: Tombol tetap mati (disabled).");
  }

  btn.style.border = "4px solid lime"; 
  sendLog("✅ Tombol aktif! Mencoba klik...");

  const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
  btn.dispatchEvent(new PointerEvent('pointerdown', opts));
  btn.dispatchEvent(new MouseEvent('mousedown', opts));
  btn.dispatchEvent(new PointerEvent('pointerup', opts));
  btn.dispatchEvent(new MouseEvent('mouseup', opts));
  btn.dispatchEvent(new MouseEvent('click', opts));

  sendLog("🚀 Klik terkirim!");
  await sleep(15000); 
}

async function runQueue(prompts) {
  isRunning = true;
  for (let i = 0; i < prompts.length; i++) {
    if (!isRunning) break;
    await prosesKlik(prompts[i], i);
  }
  isRunning = false;
  sendLog("🏁 Selesai.");
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START") { if (!isRunning) runQueue(msg.prompts); }
  if (msg.type === "STOP") { isRunning = false; }
});
