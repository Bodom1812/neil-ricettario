const loginForm = document.getElementById('loginForm');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const messageEl = document.getElementById('message');

function showMessage(text, type = 'error') {
  messageEl.textContent = text;
  messageEl.className = `msg show ${type}`;
}

function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginBtn.textContent = isLoading ? 'Accesso in corso...' : 'Accedi';
}

async function checkExistingSession() {
  const { data, error } = await window.supabaseClient.auth.getSession();

  if (error) {
    console.error('Errore controllo sessione:', error.message);
    return;
  }

  if (data.session) {
    window.location.href = 'admin.html';
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!email || !password) {
    showMessage('Inserisci email e password.');
    return;
  }

  setLoading(true);
  messageEl.className = 'msg';
  messageEl.textContent = '';

  const { error } = await window.supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  setLoading(false);

  if (error) {
    showMessage(error.message || 'Login non riuscito.');
    return;
  }

  showMessage('Login riuscito. Reindirizzamento...', 'ok');
  setTimeout(() => {
    window.location.href = 'admin.html';
  }, 500);
});

checkExistingSession();
