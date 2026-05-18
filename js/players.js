import { supabase } from './supabaseClient.js';

// =============================
// STATE
// =============================
let categories = [];

// =============================
// 🔹 1. FETCH CATEGORIES
// =============================
async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name");

  if (error) {
    console.error("Error cargando categorías:", error);
    return [];
  }

  return data;
}

// =============================
// 🔹 2. CARGAR SELECT
// =============================
function loadCategorySelect(categories) {
  const select = document.getElementById("category");

  select.innerHTML = `<option value="">Seleccionar categoría</option>`;

  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.id;
    option.textContent = cat.name;
    select.appendChild(option);
  });
}

// =============================
// 🔹 3. LEER FORMULARIO
// =============================
function getPlayerFromForm() {
  const name = document.getElementById("name").value.trim();
  const hcp = parseFloat(document.getElementById("hcp").value);
  const category = document.getElementById("category").value;

  if (!name) {
    alert("El nombre es obligatorio");
    return null;
  }

  return {
    name: name,
    handicap_index: isNaN(hcp) ? null : hcp,
    category_id: category || null
  };
}

// =============================
// 🔹 4. LIMPIAR FORM
// =============================
function clearForm() {
  document.getElementById("name").value = "";
  document.getElementById("hcp").value = "";
  document.getElementById("category").value = "";
}

// =============================
// 🔹 5. GUARDAR
// =============================
async function savePlayer(player) {
  const { error } = await supabase
    .from('players')
    .upsert([player], {
      onConflict: 'name'
    });

  if (error) {
    console.error('Error guardando jugador:', error);
    alert("Error al guardar jugador");
    return;
  }

  clearForm();
  loadAndRenderPlayers();
}

// =============================
// 🔹 6. FETCH PLAYERS
// =============================
async function fetchPlayers() {
  const { data, error } = await supabase
    .from("players")
    .select(`
      id,
      name,
      handicap_index,
      categories ( name )
    `)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error cargando jugadores:', error);
    return [];
  }

  return data;
}

// =============================
// 🔹 7. RENDER TABLA
// =============================
function renderPlayersList(players) {
  const tbody = document.getElementById("playersTableBody");
  tbody.innerHTML = "";

  players.forEach(player => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${player.name}</td>
      <td>${player.handicap_index ?? ""}</td>
      <td>${player.categories?.name ?? ""}</td>
    `;

    tbody.appendChild(tr);
  });
}

// =============================
// 🔹 8. LOAD + RENDER
// =============================
async function loadAndRenderPlayers() {
  const players = await fetchPlayers();
  renderPlayersList(players);
}

// =============================
// 🔹 9. INIT
// =============================
async function init() {
  categories = await fetchCategories();
  loadCategorySelect(categories);
  loadAndRenderPlayers();

  // botón agregar
  document.getElementById("addBtn").addEventListener("click", () => {
    const player = getPlayerFromForm();
    if (!player) return;

    savePlayer(player);
  });
}

init();
