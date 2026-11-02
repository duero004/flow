chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "DOWNLOAD") {
    chrome.downloads.download(
      {
        url: msg.url,
        filename: `flow-auto/${msg.filename}`,
        saveAs: false,
        conflictAction: "uniquify"
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.warn("Download gagal:", chrome.runtime.lastError.message);
        }
      }
    );
    sendResponse({ ok: true });
  }
  return true;
});
