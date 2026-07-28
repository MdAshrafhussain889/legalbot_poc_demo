async function loadAuthUI() {
  const authSection = document.getElementById('auth-section');

  chrome.storage.local.get(['auth_token', 'auth_user'], (result) => {
    if (result.auth_token && result.auth_user) {
      showSignedIn(authSection, result.auth_user);
    } else {
      showLoginForm(authSection);
    }
  });
}

function notifyAuthChanged() {
  chrome.runtime.sendMessage({ type: 'AUTH_CHANGED' }, () => {
    void chrome.runtime.lastError;
  });
}

function showLoginForm(container) {
  container.innerHTML = '';

  const form = document.createElement('div');
  form.className = 'login-form';

  const userLabel = document.createElement('label');
  userLabel.textContent = 'Email';
  userLabel.className = 'form-label';

  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.className = 'form-input';
  usernameInput.id = 'username';
  usernameInput.placeholder = 'you@company.com or priya';
  usernameInput.autocomplete = 'username';

  const passLabel = document.createElement('label');
  passLabel.textContent = 'Password';
  passLabel.className = 'form-label';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.className = 'form-input';
  passwordInput.id = 'password';
  passwordInput.placeholder = '••••••••';
  passwordInput.autocomplete = 'current-password';

  const button = document.createElement('button');
  button.textContent = 'Sign in';
  button.className = 'btn btn-primary';
  button.onclick = () =>
    handleLogin(usernameInput.value.trim(), passwordInput.value);

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.innerHTML =
    '<strong>Required:</strong> Use the same email/username and password as the web app. ' +
    'Signing into the web app alone is not enough. Demo: priya / demo123';

  form.appendChild(userLabel);
  form.appendChild(usernameInput);
  form.appendChild(passLabel);
  form.appendChild(passwordInput);
  form.appendChild(button);
  form.appendChild(hint);

  container.appendChild(form);
}

async function handleLogin(username, password) {
  if (!username || !password) {
    alert('Enter username and password');
    return;
  }

  try {
    const response = await fetch('http://localhost:8001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || 'Login failed');
    }

    chrome.storage.local.set(
      {
        auth_token: data.token,
        auth_user: data.user,
      },
      () => {
        notifyAuthChanged();
        loadAuthUI();
      }
    );
  } catch (error) {
    alert(`Login failed: ${error.message}`);
  }
}

function showSignedIn(container, user) {
  container.innerHTML = '';

  const section = document.createElement('div');
  section.className = 'signin-section';

  const message = document.createElement('p');
  message.className = 'signin-message';
  message.textContent = `Signed in as: ${user.display_name} (@${user.username || 'user'})`;

  const noteInput = document.createElement('textarea');
  noteInput.className = 'form-input note-input';
  noteInput.id = 'log-note';
  noteInput.placeholder = 'What are you working on? (optional)';
  noteInput.rows = 2;

  const logBtn = document.createElement('button');
  logBtn.textContent = 'Log current tab';
  logBtn.className = 'btn btn-primary';
  logBtn.onclick = () => {
    chrome.storage.local.get(['auth_user'], (result) => {
      const user = result.auth_user || {};
      chrome.runtime.sendMessage(
        {
          type: 'LOG_ACTIVE_TAB',
          user_id: user.id || '',
          user_display_name: user.display_name || '',
          user_note: noteInput.value.trim(),
        },
        (response) => {
          if (chrome.runtime.lastError) {
            alert(chrome.runtime.lastError.message);
            return;
          }
          if (!response?.ok) {
            alert(response?.error || 'Could not log tab');
            return;
          }
          noteInput.value = '';
          alert(`Logged: ${response.aiSystem}\nRefresh Audit Trail in the web app.`);
        }
      );
    });
  };

  const button = document.createElement('button');
  button.textContent = 'Sign out';
  button.className = 'btn btn-secondary';
  button.onclick = () => {
    chrome.storage.local.remove(['auth_token', 'auth_user'], () => {
      notifyAuthChanged();
      loadAuthUI();
    });
  };

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent =
    'Records that you opened ChatGPT/Copilot — not the messages typed on those sites.';

  section.appendChild(message);
  section.appendChild(logBtn);
  section.appendChild(button);
  section.appendChild(hint);

  container.appendChild(section);
}

document.addEventListener('DOMContentLoaded', loadAuthUI);
