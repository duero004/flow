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
    const url = tab.url || "";
    const isValid =
      url.startsWith("https://labs.google/fx/tools/flow") ||
      url.startsWith("https://flow.google.com");

    if (!isValid) {
      $("status").textContent = "Buka dulu halaman Google Flow.";
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "START", prompts, delay }, () => {
      if (chrome.runtime.lastError) {
        $("status").textContent =
          "Gagal: " + chrome.runtime.lastError.message + " (reload halaman Flow)";
      }
    });
    $("status").textContent = `Mengirim ${prompts.length} prompt...`;
  });
});

$("stop").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "STOP" }, () => {
        void chrome.runtime.lastError;
      });
    }
  });
  $("status").textContent = "Dihentikan.";
  chrome.storage.local.set({ status: "Dihentikan." });
});

// Update status real-time
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "PROGRESS") {
    $("status").textContent = msg.text;
    chrome.storage.local.set({ status: msg.text });
  }
});
