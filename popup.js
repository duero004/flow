ddocument.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start");
  const stopBtn = document.getElementById("stop");
  const logBox = document.getElementById("log-box");

  function addLog(text) {
    if (logBox) logBox.innerText = `> ${text}\n` + logBox.innerText;
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      const promptText = document.getElementById("prompts").value;
      
      // KITA UBAH CARA PECAHNYA: Pakai pemisah "---" bukan enter (\n)
      // Kalau nggak ada "---", semua teks dianggap 1 prompt utuh.
      const prompts = promptText.split("---").map(s => s.trim()).filter(Boolean);
      
      if (prompts.length === 0) return addLog("Error: Prompt kosong bro!");
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return addLog("Error: Tab nggak ketemu.");
        
        chrome.tabs.sendMessage(tabs[0].id, { type: "START", prompts: prompts }, (res) => {
          if (chrome.runtime.lastError) {
             addLog("Error: Refresh (F5) Google Flow dulu!");
          } else {
             addLog(`Mengirim ${prompts.length} prompt...`);
          }
        });
      });
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: "STOP" });
      });
      addLog("Dihentikan.");
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "LOG") addLog(msg.text);
  });
});
