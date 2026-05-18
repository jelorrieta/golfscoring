import { supabase } from './supabaseClient.js';
import { renderScorecardInElement } from './scorecard.js?v3';

// =============================
// STATE
// =============================

let currentTournamentId = null;
let format = "stableford";
let tournamentsCacheById = {};
let leaderboardCache = [];
let leaderboardMeta = null;
let currentSortBy = null;

// =============================
// HELPERS
// =============================

function getDefaultSortBy() {
  const tournament = tournamentsCacheById[currentTournamentId];
  const formatName = tournament?.format?.name;
  switch (formatName) {
    case 'stableford':
      return 'stb_gross';
    default:
      return 'strokes';
  }
}

// =============================
// INIT DATA
// =============================

async function loadInitialData() {
  const { data: tournaments } = await supabase.rpc('get_tournaments');
  if (tournaments) {
    populateTournaments(tournaments);
    setTournamentTitle(tournaments);
  }
  tournamentsCacheById = Object.fromEntries(
    tournaments.map(t => [t.id, t])
  );
}

async function loadCategoriesByTournament(tournamentId) {
  if (!tournamentId) {
    populateCategories([]);
    return;
  }
  const { data, error } = await supabase.rpc(
    'get_categories_v1',
    { p_tournament_id: tournamentId }
  );
  if (error) {
    console.error(error);
    return;
  }
  populateCategories(data || []);
}

// =============================
// SELECTS
// =============================

function populateTournaments(tournaments) {
  const select = document.getElementById("tournament");
  tournaments.forEach((t, index) => {
    const option = document.createElement("option");
    option.value = t.id;
    option.textContent = t.name;
    if (index === tournaments.length - 1) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function populateCategories(categories) {
  const select = document.getElementById("category");
  select.innerHTML = '<option value="">Todas</option>';
  categories.forEach(c => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.name;
    select.appendChild(option);
  });
}

// =============================
// SYNC
// =============================

async function syncFiltersAndInit() {
  const tournamentSelect = document.getElementById("tournament");
  currentTournamentId = tournamentSelect.value || null;
  setTournamentTitleFromSelect(tournamentSelect);
  document.getElementById("category").value = "";
  await loadCategoriesByTournament(currentTournamentId);
  await initLeaderboard({
    sortBy: getDefaultSortBy(),
    categoryId: null
  });
}

// =============================
// LEADERBOARD DATA (RPC v3)
// =============================

async function loadLeaderboardData({ sortBy, categoryId }) {
  if (!currentTournamentId) {
    leaderboardCache = [];
    leaderboardMeta = null;
    return;
  }
  const { data, error } = await supabase.rpc('get_lb_v3',
    {
      p_tournament_id: currentTournamentId,
      p_category_id: categoryId,
      p_sort: sortBy
    }
  );
  if (error) throw error;
  leaderboardCache = data?.data || [];
  leaderboardMeta = data?.meta || null;
}

// =============================
// VALIDATION
// =============================

function isValidSort(key) {
  return leaderboardMeta?.columns?.some(c => c.key === key);
}

// =============================
// TABLE RENDER
// =============================

function buildLeaderboardTable(data, { sortBy }) {
  const cfg = leaderboardMeta;
  const tournamentSelect = document.getElementById("tournament");  
  currentTournamentId = tournamentSelect.value || null;
  const tournament = tournamentsCacheById[currentTournamentId];
  const formatName = tournament?.format?.name;
  const header = `
    <thead>
      <tr>
        <th style="padding:8px" class="pos_col_h"></th>
        <th style="text-align:left; padding:8px;" class="player-cell-h">
          Jugador
        </th>

        ${
          cfg?.columns?.map(col => {
            const isActive = sortBy === col.key;
            return `
              <th
                class="sort-header ${isActive ? 'columna_orden' : ''}"
                data-sort="${col.key}"
                style="padding:8px; text-align:center; cursor:pointer;"
              >
                <div style="display:flex; justify-content:center; align-items:center; gap:4px;">
                  <div>${col.label}</div>
                  <div>▼</div>
                </div>
              </th>
            `;
          }).join('') || ''
        }

      </tr>
    </thead>
  `;

  const rowsHtml = data.map(row => {
    let name = row.player_name;
    if (formatName === 'scramble') {
      name = 
      ` <div class="player">${row.player_name}</div>
        <div class="guest">${row.guest}</div>`;
    }

    return `
      <tr>

        <td class="pos_col" style="text-align:center; font-weight:600; padding:8px;">
          ${row.pos ?? ''}
        </td>

        <td class="player-cell"
            data-round-id="${row.round_id}"
            data-tp-id="${row.tournament_player_id}"
            data-tournament-id="${row.tournament_id}"
            style="cursor:pointer;">
              <div class="player_name">${name}</div>
              <span class="category">&nbsp;&nbsp;${row.category_alias ?? row.category_name ?? '-'}</span>
        </td>

        ${
          cfg?.columns?.map(col => {
            const isActive = sortBy === col.key;
            return `
            <td style="text-align:center;" class="${isActive ? 'columna_orden_d' : ''}">
              ${row[col.key] ?? 0}
            </td>
          `}).join('') || ''
        }

      </tr>
    `;
  }).join('');

  const totalCols = 2 + (cfg?.columns?.length || 0);

  return `
    <table class="leaderboard-table">
      ${header}
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr class="footer-bar">
          <th colspan="${totalCols}"></th>
        </tr>
      </tfoot>
    </table>
  `;
}

// =============================
// INIT LEADERBOARD
// =============================

async function initLeaderboard({
  sortBy = 'strokes',
  categoryId = null
} = {}) {
  currentSortBy = sortBy;
  const container = document.getElementById('leaderboard');
  container.style.opacity = "0.7";
  try {
    await loadLeaderboardData({ sortBy, categoryId });
    const data = leaderboardCache;
    if (!data || data.length === 0) {
      container.innerHTML = `<div>Sin datos</div>`;
      return;
    }
    container.innerHTML = buildLeaderboardTable(data, { sortBy });
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div style="color:red;">
        Error leaderboard
      </div>
    `;
  }
  container.style.opacity = "1";
}

// =============================
// EVENTS
// =============================

function bindLeaderboardEvents() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.sort-header');
    if (!btn) return;
    const sortBy = btn.dataset.sort;
    if (!isValidSort(sortBy)) return;
    const categoryId = document.getElementById("category").value || null;
    initLeaderboard({
      sortBy,
      categoryId
    });
  });
}

function bindCategoryFilter() {
  const select = document.getElementById("category");
  if (!select) return;
  select.addEventListener("change", (e) => {
    const categoryId = e.target.value || null;
    initLeaderboard({
      sortBy: currentSortBy || getDefaultSortBy(),
      categoryId
    });
  });
}

// =============================
// SCORECARD CLICK
// =============================

document.addEventListener('click', async (e) => {
  const cell = e.target.closest('.player-cell');
  if (!cell) return;
  const tr = cell.closest('tr');
  const round_id = cell.dataset.roundId;
  const tournament_player_id = cell.dataset.tpId;
  if (!round_id || !tournament_player_id) return;
  const tournamentSelect = document.getElementById("tournament");  
  currentTournamentId = tournamentSelect.value || null;
  const tournament = tournamentsCacheById[currentTournamentId];
  format = tournament?.format?.name;
  toggleScorecardRow(tr, {
    round_id,
    tournament_player_id,
    format
  });
});

// =============================
// SCORECARD EXPAND
// =============================

async function toggleScorecardRow(tr, { round_id, tournament_player_id, format }) {
  const nextRow = tr.nextElementSibling;
  if (nextRow?.classList.contains('detail-row')) {
    nextRow.remove();
    return;
  }
  document.querySelectorAll('.detail-row').forEach(el => el.remove());
  const detailRow = document.createElement('tr');
  detailRow.classList.add('detail-row');
  const td = document.createElement('td');
  td.colSpan = tr.children.length;
  td.innerHTML = `<div class="scorecard-wrapper">Cargando...</div>`;
  detailRow.appendChild(td);
  tr.insertAdjacentElement('afterend', detailRow);
  const wrapper = td.querySelector('.scorecard-wrapper');
  const container = document.createElement('div');
  container.style.display = 'none';
  wrapper.appendChild(container);
  const tournament_id = document.getElementById("tournament")?.value;
  await renderScorecardInElement({
    container,
    round_id,
    tournament_player_id,
    format,
    tournament_id
  });

  wrapper.innerHTML = '';
  wrapper.appendChild(container);
  container.style.display = 'block';
}

// =============================
// BOOT
// =============================

document.addEventListener("DOMContentLoaded", async () => {
  await loadInitialData();
  bindCategoryFilter();
  bindLeaderboardEvents();
  const tournamentSelect =
    document.getElementById("tournament");
  setTimeout(() => {
    syncFiltersAndInit();
  }, 0);
  tournamentSelect.addEventListener("change", () => {
    syncFiltersAndInit();
  });
});

// =============================
// TITLES
// =============================

function setTournamentTitle(tournaments) {
  const selected = tournaments.find(
    t => t.name === "Apertura 2026"
  );
  document.getElementById("torneo").textContent =
    selected ? " " + selected.name : "s";
}
function setTournamentTitleFromSelect(select) {
  const value = select.value;
  document.getElementById("torneo").textContent =
    value
      ? " " + select.options[select.selectedIndex].text
      : "s";
}