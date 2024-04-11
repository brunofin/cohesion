chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.startsWith('https://www.notion.so/')) {
    chrome.tabs.create({ url: changeInfo.url.replace('https://www.notion.so/', 'notion://www.notion.so/') });
    chrome.tabs.remove(tabId);
  }
});
