const $ = (id) => document.getElementById(id);
const logBox = $("log-box");
const progressBar = $("progress-bar");

function addLog(text) {
  logBox.innerText = `> ${text}\n` + logBox.innerText;
}

$("start").addEventListener("click", () => {
  const prompts = $("prompts").value.split("\n").map(s => s.trim()).filter(Boolean);
  if (prompts.length === 0) return addLog("Error: Prompt kosong.");
  
  const config = {
    delay: parseInt($("delay").value) || 15,
    mode: $("mode").value
  };

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url.includes("google.com")) {
      return addLog("Error: Buka halaman Google Flow dulu!");
    }

    chrome.tabs.sendMessage(tab.id, { type: "START", prompts, config }, () => {
      if (chrome.runtime.lastError) {
        addLog("Error: Reload halaman Flow (F5) dulu!");
      }
    });
  });
});

$("stop").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: "STOP" });
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "LOG") {
    addLog(msg.text);
    if (msg.progress) {
      progressBar.style.width = `${msg.progress}%`;
    }
  }
});
