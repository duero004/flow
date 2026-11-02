console.log("🚀 Flow Auto: Script berhasil dimuat!");

const SEL = {
  promptInput: 'div.ProseMirror[contenteditable="true"]',
  generateBtn: 'button[aria-label="Start generation"]'
};

let isRunning = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sendLog = (text) => {
  console.log("📝 LOG:", text);
  try { chrome.runtime.sendMessage({ type: "LOG", text }); } catch (e) {}
};

// Fungsi klik yang lebih "manusiawi" untuk Angular
function humanClick(element) {
  const eventNames = ['mousedown', 'mouseup', 'click'];
  for (const eventName of eventNames) {
    element.dispatchEvent(new MouseEvent(eventName, {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1
    }));
  }
}

async function processPrompt(prompt, index, total, config) {
  sendLog(`Memproses prompt ke-${index + 1}...`);
  
  // 1. CARI INPUT
  const inputs = document.querySelectorAll(SEL.promptInput);
  if (inputs.length === 0) {
    sendLog("❌ Gagal: Kotak ketik (ProseMirror) tidak ditemukan di halaman ini!");
    return;
  }
  // Ambil input yang paling terlihat (biasanya yang aktif)
  let input = inputs[inputs.length - 1]; 
  
  // Kasih garis merah biar kita tahu itu kotak yang benar
  input.style.border = "2px solid red";
  
  sendLog("Memasukkan teks...");
  input.focus();
  input.click();
  
  // Trik memasukkan teks paling kasar tapi ampuh
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  
  // Simulasi ketik manual per karakter (paling aman untuk React/Angular)
  for (let i = 0; i < prompt.length; i++) {
    document.execCommand("insertText", false, prompt[i]);
  }

  // 2. TUNGGU TOMBOL AKTIF
  sendLog("Menunggu tombol berubah warna (aktif)...");
  let btn = null;
  for (let i = 0; i < 20; i++) { // Tunggu maksimal 10 detik
    btn = document.querySelector(SEL.generateBtn);
    if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
      break; 
    }
    await sleep(500);
  }

  if (!btn) {
    sendLog("❌ Gagal: Tombol Generate tidak ketemu!");
    return;
  }

  // Kasih garis hijau biar kita tahu tombol yang benar
  btn.style.border = "4px solid lime";
  btn.style.borderRadius = "50%";

  if (btn.disabled) {
    sendLog("❌ Gagal: Tombol masih disabled! (Teks mungkin tidak masuk ke sistem Google)");
    return; // Hentikan proses di sini biar ketahuan
  }

  // 3. KLIK TOMBOL
  sendLog("✅ Tombol aktif! Mengklik...");
  humanClick(btn);

  // 4. TUNGGU SELESAI (Kasar: tunggu 20 detik saja)
  sendLog("Menunggu Google Flow memproses gambar (20 detik)...");
  await sleep(20000);
  
  sendLog(`✅ Prompt ke-${index + 1} selesai, lanjut ke berikutnya.`);
  await sleep(5000);
}

async function runQueue(prompts, config) {
  isRunning = true;
  for (let i = 0; i < prompts.length; i++) {
    if (!isRunning) break;
    try {
      await processPrompt(prompts[i], i, prompts.length, config);
    } catch (err) {
      sendLog(`❌ Error: ${err.message}`);
    }
  }
  isRunning = false;
  sendLog("Antrean selesai.");
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START_QUEUE") {
    if (isRunning) return;
    runQueue(msg.prompts, msg.config);
  } else if (msg.type === "STOP_QUEUE") {
    isRunning = false;
  }
});
