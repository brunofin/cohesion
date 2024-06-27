chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url.startsWith('notion://')) {
    setTimeout(() => {
      chrome.tabs.remove(tabId);
    }, 5 * 1000);
    return;
  }
  
  const notOpenList = [
    'https://www.notion.so/invoice/'
  ];

  if (changeInfo.url && changeInfo.url.startsWith('https://www.notion.so/')) {
    const shouldBlock = notOpenList.some(url => changeInfo.url.startsWith(url));
    if (!shouldBlock) {
      const newUrl = changeInfo.url.replace('https://www.notion.so/', 'notion://www.notion.so/');
      chrome.tabs.update(tabId, { url: newUrl });
      setTimeout(() => {
        chrome.tabs.remove(tabId);
    }, 5 * 1000);
    }
  }
});
