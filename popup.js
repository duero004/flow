const $ = (id) => document.getElementById(id);

// Muat state terakhir
chrome.storage.local.get(["prompts", "delay", "status"], (data) => {
  if (data.prompts) $("prompts").value = data.prompts;
  if (data.delay) $("delay").value = data.delay;
  if (data.status) $("status").textContent = data.status;
});

$("start").addEventListener("click", () => {
  const prompts = $("prompts").value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const delay = parseInt($("delay").value, 10) || 15;

  if (prompts.length === 0) {
    $("status").textContent = "Isi minimal satu prompt.";
    return;
  }

  chrome.storage.local.set({ prompts, delay });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      $("status").textContent = "Tab tidak ditemukan.";
      return;
    }
    
    // Kirim perintah ke content.js (tanpa callback agar tidak error)
    chrome.tabs.sendMessage(tab.id, { 
      type: "START_QUEUE", 
      prompts: prompts, 
      config: { delay: delay, ratio: "16:9", model: "image" }
    });

    $("status").textContent = `Memproses ${prompts.length} prompt...`;
  });
});

$("stop").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "STOP_QUEUE" });
    }
  });
  $("status").textContent = "Dihentikan.";
  chrome.storage.local.set({ status: "Dihentikan." });
});

// Update status dari content.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "LOG") {
    $("status").textContent = msg.text;
    chrome.storage.local.set({ status: msg.text });
  }
});
