import { supabase } from './supabaseClient.js';

// =========================
// AUTH FUNCTIONS
// =========================

async function register(username, password) {
  const fakeEmail = `${username}@golfscoring.local`;
  const { data, error } = await supabase.auth.signUp({
    email: fakeEmail,
    password
  });

  if (error) {
    throw error;
  }
  return data;
}

async function login(username, password) {
  const fakeEmail = `${username}@golfscoring.local`;
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password
    });
  if (error) {
    throw error;
  }
  return data;
}

async function changePassword(newPassword) {
  const { error } =
    await supabase.auth.updateUser({
      password: newPassword
    });
  if (error) {
    throw error;
  }
}

// =========================
// FORM
// =========================

const usernameInput =
  document.getElementById("username");

const passwordInput =
  document.getElementById("password");

const createBtn =
  document.getElementById("create-btn");

const messageDiv =
  document.getElementById("message");

// =========================
// CREATE USER
// =========================

createBtn.addEventListener("click", async () => {
  const username =
    usernameInput.value.trim();
  const password =
    passwordInput.value;


  // VALIDATION

  if (!username) {
    messageDiv.textContent =
      "Ingrese usuario";
    return;
  }

  if (password.length < 6) {
    messageDiv.textContent =
      "La contraseña debe tener mínimo 6 caracteres";
    return;
  }

  try {
    // CREATE AUTH USER
    const data =
      await register(username, password);

    messageDiv.textContent =
      "Usuario creado correctamente";

    usernameInput.value = "";
    passwordInput.value = "";

  } catch (err) {
    console.error(err);
    messageDiv.textContent =
      err.message;
  }
});
