import { supabase } from './supabaseClient.js';

const tournamentSelect =
  document.getElementById('tournament-select');



const container =
  document.getElementById('tables-container');

const TB_LABELS = {
  strokes: 'Golpes Totales',
  net: 'Golpes Netos',
  stb_net: 'Puntos Stableford Neto',
  stb_gross: 'Puntos Stableford Gross'
};

let tournamentsCacheById = {};
init();

// =============================
// INIT
// =============================

async function init() {
  const tournaments = await loadTournaments();
  if (!tournaments.length) return;
  const firstTournamentId = tournaments[0].id;
  tournamentSelect.value = firstTournamentId;
  await loadLeaderboard(firstTournamentId);
  tournamentSelect.addEventListener('change', async () => {
    const tournamentId = tournamentSelect.value;
    if (!tournamentId) {
      container.innerHTML = '';
      return;
    }
    await loadLeaderboard(tournamentId);
  });
}

// =============================
// TOURNAMENTS
// =============================

async function loadTournaments() {
  const { data: tournaments } = await supabase.rpc('get_tournaments');
  tournamentsCacheById = Object.fromEntries(
    tournaments.map(t => [t.id, t])
  );
  tournamentSelect.innerHTML = '';
  for (const tournament of tournaments) {
    const option = document.createElement('option');
    option.value = tournament.id;
    option.textContent = tournament.name;
    tournamentSelect.appendChild(option);
  }
  return tournaments;
}

// =============================
// LEADERBOARD
// =============================

async function loadLeaderboard(tournamentId) {

  container.innerHTML = 'Cargando...';

  const { data, error } = await supabase.rpc(
    'get_tb_tables_v2',
    {
      p_tournament_id: tournamentId
    }
  );
  console.log(data);

  if (error) {
    console.error(error);
    container.innerHTML = `
      <div style="color:red;">
        Error cargando tablas
      </div>
    `;
    return;
  }

  if (!data?.length) {
    container.innerHTML = `
      <div>Sin datos</div>
    `;
    return;
  }

  container.innerHTML = '';

  const grouped = {};

  for (const row of data) {

    const category =
      row.category || 'Sin categoría';

    if (!grouped[category]) {
      grouped[category] = {};
    }

    if (!grouped[category][row.tb_type]) {
      grouped[category][row.tb_type] = [];
    }

    grouped[category][row.tb_type].push(row);
  }

  for (const [categoryName, tables] of Object.entries(grouped)) {

    for (const [tbType, rows] of Object.entries(tables)) {

      renderTable(
        categoryName,
        tbType,
        rows
      );

    }
  }
}

// =============================
// TABLE RENDER
// =============================

function renderTable(
  categoryName,
  indicatorName,
  rows
) {
  if (!rows?.length) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'tb-wrapper';
  const title = document.createElement('h2');
  title.textContent = `${categoryName} - ${TB_LABELS[indicatorName] || indicatorName}`;
  wrapper.appendChild(title);
  const table = document.createElement('table');
  table.className = 'tb-table';

  // =============================
  // HEADER
  // =============================

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = [
    'Pos',
    'Jugador',
    'Total',
    'Últimos 9',
    'Últimos 6',
    'Últimos 3',
    'Último Hoyo'
  ];

  for (const h of headers) {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // =============================
  // BODY
  // =============================

  const tbody = document.createElement('tbody');
  let visualRank = "";
  let previousValue = null;
  let i=0;
  for (const row of rows) {
    i += 1;
    visualRank = i;
    if(row.pos === previousValue){
      visualRank="";
    }
    previousValue = row.pos;

    const tr = document.createElement('tr');
    const cells = [
      visualRank,
      row.guest
        ? `${row.player_name} - ${row.guest}`
        : row.player_name,

      row.score,
      row.last9,
      row.last6,
      row.last3,
      row.last1
    ];

    for (const value of cells) {
      const td = document.createElement('td');
      td.textContent =
        value ?? '-';
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrapper.appendChild(table);
  container.appendChild(wrapper);
}