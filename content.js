console.log("🚀 Flow Auto: Script v3 dimuat!");

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

async function processPrompt(prompt, index, total, config) {
  sendLog(`[${index + 1}/${total}] Memasukkan teks...`);
  
  const inputs = document.querySelectorAll(SEL.promptInput);
  let input = inputs[inputs.length - 1]; 
  input.style.border = "2px solid red";
  
  input.focus();
  input.click();
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  
  // Ketik teks
  for (let i = 0; i < prompt.length; i++) {
    document.execCommand("insertText", false, prompt[i]);
  }

  sendLog("Menunggu tombol aktif...");
  let btn = null;
  for (let i = 0; i < 20; i++) {
    btn = document.querySelector(SEL.generateBtn);
    if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
      break; 
    }
    await sleep(500);
  }

  if (!btn || btn.disabled) {
    sendLog("❌ Tombol masih disabled. Teks gagal masuk.");
    return;
  }

  btn.style.border = "4px solid lime";
  sendLog("✅ Mengklik tombol...");
  
  // TRIK BARU: Paksa klik pakai beberapa metode
  btn.focus();
  btn.click(); // Metode 1: Klik standar
  
  // Metode 2: Jika Angular masih bandel, tembak pakai tombol Enter
  await sleep(1000); 
  if (document.querySelector(SEL.generateBtn)) { // Jika tombol masih ada (belum jadi stop)
      sendLog("Mencoba alternatif (Tekan Enter)...");
      const enterEvent = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true });
      input.dispatchEvent(enterEvent);
  }

  // Deteksi apakah proses dimulai (Tombol berubah jadi Stop / ada loading)
  sendLog("Menunggu proses selesai...");
  let isGenerating = false;
  
  // Cek maksimal 10 detik apakah tombol berubah jadi stop/loading
  for (let i = 0; i < 20; i++) {
      const currentBtn = document.querySelector(SEL.generateBtn);
      // Kalau aria-label-nya berubah atau tombolnya hilang/disabled, berarti sukses mulai
      if (!currentBtn || currentBtn.disabled || currentBtn.getAttribute("aria-label") !== "Start generation") {
          isGenerating = true;
          break;
      }
      await sleep(500);
  }

  if (isGenerating) {
      sendLog(`✅ Generate dimulai! Menunggu 15 detik...`);
      await sleep(15000); // Tunggu gambar selesai
  } else {
      sendLog(`⚠️ Gagal memicu generate.`);
  }

  await sleep(3000);
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
