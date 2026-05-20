import { supabase } from './supabaseClient.js';
import { renderScorecardInElement } from './scorecard.js?v3';


// =============================
// STATE
// =============================

let currentTournamentId = null;
let format = "stableford";
let tournamentsCacheById = {};
let leaderboardCache = [];
let organizationData = [];
let leaderboardMeta = null;
let currentSortBy = null;
let hostname = null;

// =============================
// HELPERS
// =============================

function getDefaultSortBy() {
  const tournament = tournamentsCacheById[currentTournamentId];
  console.log(tournament);
  const formatName = tournament?.format_name;
  switch (formatName) {
    case 'stableford':
      return 'stb_gross';
    default:
      return 'strokes';
  }
}

function getPosField(sortBy) {
  switch (sortBy) {
    case 'strokes':
      return 'pos_g';
    case 'net':
      return 'pos_n';
    case 'stb_gross':
      return 'pos_sg';
    case 'stb_net':
      return 'pos_sn';
    default:
      return 'pos_g';
  }
}


// =============================
// INIT DATA
// =============================

async function loadInitialData() {
  hostname = window.location.hostname;
  const { data, error } = await supabase.rpc(
    'get_organization_by_hostname',
    { p_hostname: hostname }
  );
  if (error) {
    console.error(error);
    return;
  }
  organizationData = data || [];
  if (!organizationData.length) {
    console.error('Organization not found');
    return;
  }
  const organizationId = organizationData[0].id;
  const { data: tournaments } = await supabase.rpc(
    'get_tournaments',
    { p_organization_id: organizationId }
  );
  if (tournaments) {
    populateTournaments(tournaments);
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
  const params = new URLSearchParams(window.location.search);
  const slugFromUrl = params.get("torneo");
  
  const selectedTournament = slugFromUrl
    ? tournaments.find(t => t.slug === slugFromUrl)
    : tournaments[tournaments.length - 1];

  tournaments.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.id;
    option.textContent = t.name;
    select.appendChild(option);
  });

  if (selectedTournament) {
    select.value = selectedTournament.id;
    select.dispatchEvent(new Event("change"));
  }
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

  setOrganizationName(organizationData[0].name);
  
  document.getElementById("category").value = "";
  await loadCategoriesByTournament(currentTournamentId);
  
  currentSortBy = getDefaultSortBy();
  await reloadLeaderboard({
    sortBy: currentSortBy
  });
}

// =============================
// LEADERBOARD DATA (RPC v3)
// =============================

async function loadLeaderboardData({ sortBy }) {
  if (!currentTournamentId) {
    leaderboardCache = [];
    leaderboardMeta = null;
    return;
  }
  const { data, error } = await supabase.rpc(
    'get_lb_v3',
    {
      p_tournament_id: currentTournamentId,
      p_category_id: null,
      p_sort: sortBy
    }
  );

  if (error) throw error;
  leaderboardCache = data?.data || [];
  leaderboardMeta = data?.meta || null;
}

async function reloadLeaderboard({
  sortBy
}) {
  const container =
    document.getElementById('leaderboard');

  container.style.opacity = "0.7";
  try {
    await loadLeaderboardData({
      sortBy
    });
    const categoryId =
      document.getElementById("category").value || null;
    await initLeaderboard({
      sortBy,
      categoryId
    });
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
  const formatName = tournament?.format_name;
  const posField = getPosField(sortBy);

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
  
  let visualRank = 0;
  let previousValue = null;

  const rowsHtml = data.map((row, index) => {
    let name = row.player_name;
    
    if (formatName === 'scramble') {
      name =
      ` <div class="player">${row.player_name}</div>
        <div class="guest">${row.guest}</div>`;
    }

    const currentValue = row[posField];
    if (currentValue !== previousValue) {
      visualRank = index + 1;
    }

    previousValue = currentValue;

    return `
      <tr
        data-category-id="${row.category_id ?? ''}"
      >
        <td
          class="pos_col"
          style="text-align:center; font-weight:600; padding:8px;"
        >
          ${visualRank}
        </td>
        <td
          class="player-cell"
          data-round-id="${row.round_id}"
          data-tp-id="${row.tournament_player_id}"
          data-tournament-id="${row.tournament_id}"
          style="cursor:pointer;"
        >
          <div class="player_name">${name}</div>
          <span class="category">
            &nbsp;&nbsp;
            ${row.category_alias ?? row.category_name ?? '-'}
          </span>
        </td>
        ${
          cfg?.columns?.map(col => {
            const isActive = sortBy === col.key;
            return `
              <td
                style="text-align:center;"
                class="${isActive ? 'columna_orden_d' : ''}"
              >
                ${row[col.key] ?? 0}
              </td>
            `;
          }).join('') || ''
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

  const container =
    document.getElementById('leaderboard');

  let data = [...leaderboardCache];

  const posField = getPosField(sortBy);

  data.sort((a, b) => {
    return (a[posField] ?? 9999)
         - (b[posField] ?? 9999);
  });

  if (categoryId) {
    data = data.filter(
      r => String(r.category_id) === String(categoryId)
    );
  }

  if (!data.length) {
    container.innerHTML = `<div>Sin datos</div>`;
    return;
  }

  container.innerHTML =
    buildLeaderboardTable(data, { sortBy });
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
    currentSortBy = sortBy;
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
      sortBy: currentSortBy,
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
  format = tournament?.format_name;
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
  const tournamentSelect = document.getElementById("tournament");
  setTimeout(() => {
    syncFiltersAndInit();
  }, 0);

  tournamentSelect.addEventListener("change", () => {
    const tournamentId = tournamentSelect.value;
    const tournament = tournamentsCacheById[tournamentId];
    if (tournament) {
      const url = `/?torneo=${tournament.slug}`;
      window.history.pushState({}, "", url);
    }
    syncFiltersAndInit();
  });
});

// =============================
// TITLES
// =============================

function setTournamentTitleFromSelect(select) {
  const title = select.options[select.selectedIndex]?.text || '';
  document.getElementById("torneo").textContent = title;
}

function setOrganizationName(name) {
  document.getElementById("organization").textContent = name;
}