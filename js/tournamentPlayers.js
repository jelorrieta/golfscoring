import { supabase } from './supabaseClient.js';

// =============================
// 1. STATE
// =============================

let tournaments = [];
let categories = [];
let players = [];
let rounds = [];

let selectedTournamentId = null;
let selectedRoundId = null;

// =============================
// 2. FETCH DATA
// =============================

async function fetchTournaments() {
  const {data} = await supabase.rpc('get_tournaments');
  return data;
}

async function fetchCategories() {
  const {data} = await supabase.rpc('get_categories');
  return data;
}

async function fetchRounds() {
  const {data} = await supabase.rpc('get_rounds');
  return data;
}

async function fetchPlayers() {
  const {data} = await supabase.rpc('get_players');
  return data;
}

async function fetchTournamentPlayers(tournamentId) {
  const {data} = await supabase.rpc('get_tournament_players(tournamentId)');
  return data;
}

// =============================
// 2. HIDRATAR TABLA
// =============================

function parseLocaleNumber(value) {
  if (!value) return null;
  return Number(value.replace(",", "."));
}

function hydratePlayersTable(tournamentPlayers) {
  console.log(tournamentPlayers);
  const map = new Map(
    tournamentPlayers.map(tp => [tp.player_id, tp])
  );

  const rows = document.querySelectorAll(".player-select-row");

  rows.forEach(row => {

    const checkbox = row.querySelector(".player-checkbox");
    const playerId = checkbox.value;

    const tp = map.get(playerId);

    if (!tp) return;

    row.querySelector(".playing-index").value = tp.playing_index ?? "";
    row.querySelector(".guest").value = tp.guest ?? "";
    row.querySelector(".guest-index").value = tp.guest_index ?? "";
    row.querySelector(".category-select").value = tp.category_id ?? "";
    row.querySelector(".guest-category-select").value = tp.guest_category ?? "";
    row.querySelector(".playing_hdcp").value = tp.playing_handicap ?? "";
  });
}

function resetPlayersTable() {
  const rows = document.querySelectorAll(".player-select-row");

  rows.forEach(row => {
    row.querySelector(".player-checkbox").checked = false;
    row.querySelector(".playing-index").value = "";
    row.querySelector(".guest").value = "";
    row.querySelector(".guest-index").value = "";
    row.querySelector(".category-select").value = "";
    row.querySelector(".guest-category-select").value = "";
    row.querySelector(".playing_hdcp").value = "";
  });
}

// =============================
// 3. RENDER SELECTS
// =============================

function renderTournamentSelect() {
  const select = document.getElementById("tournament-select");

  select.innerHTML = `
    <option value="">Seleccionar torneo</option>
    ${tournaments.map(t => `
      <option value="${t.id}">${t.name}</option>
    `).join("")}
  `;
}

function renderRoundSelect() {
  const select = document.getElementById("round-select");

  select.innerHTML = `
    <option value="">Seleccionar ronda</option>
    ${rounds.map(r => `
      <option value="${r.id}">Ronda ${r.round_number}</option>
    `).join("")}
  `;
}

// =============================
// 4. PLAYERS TABLE
// =============================

function renderPlayersList() {
  const container = document.getElementById("players-select-list");

  container.innerHTML = `
    <table class="players-table">
      <thead>
        <tr>
          <th></th>
          <th style="text-align:left;">Jugador</th>
          <th>Indice</th>
          <th>Categoría</th>
          <th>Invitado</th>
          <th>Indice Invitado</th>
          <th>Categoría Invitado</th>
          <th style="text-align:center;">HDCP</th>
        </tr>
      </thead>
      <tbody>
        ${players.map(player => `
          <tr class="player-select-row">
            <td>
              <input type="checkbox" value="${player.id}" class="player-checkbox" />
            </td>

            <td>${player.name}</td>

            <td>
              <input type="number" class="playing-index" style="width:70px;text-align:center;" />
            </td>

            <td>
              <select class="category-select">
                <option value="">-</option>
                ${categories.map(c => `
                  <option value="${c.id}">${c.name}</option>
                `).join("")}
              </select>
            </td>

            <td>
              <input type="text" class="guest" />
            </td>

            <td>
              <input type="number" class="guest-index" style="width:70px;text-align:center;" />
            </td>

            <td>
              <select class="guest-category-select">
                <option value="">-</option>
                ${categories.map(c => `
                  <option value="${c.id}">${c.name}</option>
                `).join("")}
              </select>
            </td>
            <td>
              <input style="text-align:center;" class="playing_hdcp" />
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// =============================
// 5. GET SELECTED PLAYERS
// =============================

function getSelectedPlayersWithData() {
  const rows = document.querySelectorAll(".player-select-row");

  const result = [];

  rows.forEach(row => {
    const checkbox = row.querySelector(".player-checkbox");
    if (!checkbox.checked) return;

    result.push({
      player_id: checkbox.value,
      category_id: row.querySelector(".category-select").value || null,
      guest: row.querySelector(".guest").value || null,
      guest_category: row.querySelector(".guest-category-select").value || null,
      playing_index: row.querySelector(".playing-index").value !== ""
        ? parseLocaleNumber(row.querySelector(".playing-index").value)
        : null,

      guest_index: row.querySelector(".guest-index").value !== ""
        ? parseLocaleNumber(row.querySelector(".guest-index").value)
        : null,
    });
  });

  return result;
}

// =============================
// 6. SAVE
// =============================

async function assignPlayersToTournament() {

  const tournamentId = document.getElementById("tournament-select").value;
  const roundId = document.getElementById("round-select").value;

  const selectedPlayers = getSelectedPlayersWithData();

  if (!tournamentId || !roundId) {
    alert("Selecciona torneo y ronda");
    return;
  }

  if (!selectedPlayers.length) {
    alert("Selecciona jugadores");
    return;
  }

  const { error } = await supabase.rpc('assign_players_to_tournament_v1', {
    p_tournament_id: tournamentId,
    p_round_id: roundId,
    p_players: selectedPlayers
  });

  if (error) {
    console.error(error);
    alert("Error asignando jugadores");
    return;
  }

  alert("OK: jugadores y scorecards creados");

  const tournamentPlayers =
    await fetchTournamentPlayers(tournamentId);

  resetPlayersTable();
  hydratePlayersTable(tournamentPlayers);
}

// =============================
// 7. INIT
// =============================

async function init() {
  tournaments = await fetchTournaments();
  categories = await fetchCategories();
  rounds = await fetchRounds();
  players = await fetchPlayers();

  renderTournamentSelect();
  renderRoundSelect();
  renderPlayersList();
}

// =============================
// 8. EVENTS
// =============================

document.getElementById("assign-btn")
  .addEventListener("click", assignPlayersToTournament);

document.addEventListener("DOMContentLoaded", init);
document.getElementById("tournament-select")
  .addEventListener("change", async (e) => {

    selectedTournamentId = e.target.value;

    if (!selectedTournamentId) return;

    const tournamentPlayers = await fetchTournamentPlayers(selectedTournamentId);
    resetPlayersTable();
    hydratePlayersTable(tournamentPlayers);
  });
