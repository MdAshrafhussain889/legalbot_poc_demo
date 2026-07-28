// POC SCOPE CONSTRAINT: This extension reads ONLY tab URL and tab title metadata.
// - NO content script injection
// - NO page DOM content reading
// - NO keystroke or mouse event capture
// - NO form data capture
// This ensures minimal privacy intrusion for the shadow AI detector POC.

const DOMAIN_MAP = {
  'chatgpt.com': 'ChatGPT (OpenAI)',
  'chat.openai.com': 'ChatGPT (OpenAI)',
  'copilot.microsoft.com': 'Microsoft Copilot',
  'github.com': 'GitHub Copilot',
};

// Debounce only to avoid reload spam — returning to a site after leaving SHOULD log again.
const DEBOUNCE_MS = 15_000;
/** @type {Map<string, number>} key -> lastLoggedAtMs */
const LAST_LOGGED = new Map();

function getDomainLabel(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (hostname in DOMAIN_MAP) {
      return DOMAIN_MAP[hostname];
    }

    if (hostname === 'github.com' || hostname.endsWith('.github.com')) {
      if (urlObj.pathname.includes('copilot')) {
        return DOMAIN_MAP['github.com'];
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

function debounceKey(tabId, url) {
  // Key by tab + AI system host, not full URL path — ChatGPT chat URLs change often
  try {
    const host = new URL(url).hostname;
    return `${tabId}:${host}`;
  } catch {
    return `${tabId}:${url}`;
  }
}

function shouldSkip(key, force) {
  if (force) return false;
  const last = LAST_LOGGED.get(key);
  if (!last) return false;
  return Date.now() - last < DEBOUNCE_MS;
}

function markLogged(key) {
  LAST_LOGGED.set(key, Date.now());
  if (LAST_LOGGED.size > 100) {
    const oldest = [...LAST_LOGGED.entries()].sort((a, b) => a[1] - b[1]);
    for (const [k] of oldest.slice(0, LAST_LOGGED.size - 100)) {
      LAST_LOGGED.delete(k);
    }
  }
}

function postDetectorEvent(tab, { force = false, user_id = '', user_display_name = '', user_note = '' } = {}) {
  if (!tab?.url) return false;

  const aiSystem = getDomainLabel(tab.url);
  if (!aiSystem) return false;

  const key = debounceKey(tab.id, tab.url);
  if (shouldSkip(key, force)) {
    return false;
  }

  markLogged(key);

  chrome.storage.local.get(['auth_token', 'auth_user'], (result) => {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (result.auth_token) {
      headers['Authorization'] = `Bearer ${result.auth_token}`;
    }

    const storedUser = result.auth_user || {};
    const payload = {
      domain: new URL(tab.url).hostname,
      matched_ai_system: aiSystem,
      tab_title: tab.title || '',
      timestamp_client: new Date().toISOString(),
      user_id: user_id || storedUser.id || '',
      user_display_name: user_display_name || storedUser.display_name || '',
      user_note: user_note || '',
    };

    fetch('http://localhost:8001/api/detector/event', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error('Shadow detector HTTP error:', res.status, text);
        }
      })
      .catch((err) => {
        console.error('Shadow detector error:', err);
      });
  });

  return true;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Log when navigation completes OR when URL changes to a monitored site
  if (changeInfo.status === 'complete' || changeInfo.url) {
    postDetectorEvent(tab);
  }
});

// When user switches back to a ChatGPT/Copilot tab, log that return visit
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    postDetectorEvent(tab);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const key of [...LAST_LOGGED.keys()]) {
    if (key.startsWith(`${tabId}:`)) {
      LAST_LOGGED.delete(key);
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'AUTH_CHANGED') {
    LAST_LOGGED.clear();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) postDetectorEvent(tabs[0], { force: true });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === 'LOG_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ ok: false, error: 'No active tab' });
        return;
      }
      const aiSystem = getDomainLabel(tabs[0].url);
      if (!aiSystem) {
        sendResponse({
          ok: false,
          error: 'Active tab is not ChatGPT / Copilot',
        });
        return;
      }
      const logged = postDetectorEvent(tabs[0], {
        force: true,
        user_id: message.user_id || '',
        user_display_name: message.user_display_name || '',
        user_note: message.user_note || '',
      });
      sendResponse({ ok: logged, aiSystem });
    });
    return true;
  }

  return false;
});
