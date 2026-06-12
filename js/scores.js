import { supabase } from './supabaseClient.js';

// =============================
// AUTH
// =============================

window.login = async function () {
  supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: 'https://lomas.golfscoring.cl/scores'
    }
  });
};

window.ulogin = async function () {

  const username =
    document.getElementById("scorer-username").value.trim();

  const password =
    document.getElementById("scorer-password").value;

  const message =
    document.getElementById("login-message");

  message.textContent = "";

  if (!username || !password) {
    message.textContent = "Completa usuario y contraseña";
    return;
  }

  try {

    const fakeEmail =
      `${username}@golfscoring.local`;

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password
      });

    if (error) throw error;

    window.location.href = "scores.html";

  } catch (err) {
    message.textContent = err.message;
  }

};

let currentUser = null;

async function initAuth() {

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Auth error:", error);
    return;
  }
  currentUser = data.user;
  if (!currentUser) {
    console.log("No hay sesión activa");
    return;
  }
  // username derivado (tu sistema fake email)
  const username = currentUser.email?.split("@")[0] || "";
  console.log("Logeado como:", username);
  document.body.classList.add("admin-mode");
  const usernameInput =
    document.getElementById("username");
  if (usernameInput) {
    usernameInput.textContent = username;
  }
}

// =============================
// STATE
// =============================

let tournaments = [];
let rounds = [];

// =============================
// FETCH
// =============================

async function fetchTournaments() {
  const {data} = await supabase.rpc('get_tournaments');
  return data;
}

// OPCIÓN B: rounds globales
async function fetchRounds() {
  const {data} = await supabase.rpc('get_rounds');
  return data;
}

// =============================
// SELECTS
// =============================

async function loadTournaments() {
  tournaments = await fetchTournaments();

  const select = document.getElementById("tournamentSelect");
  select.innerHTML = "";

  tournaments.forEach((t, i) => {
    const option = document.createElement("option");
    option.value = t.id;
    option.textContent = t.name;
    if (i === 0) option.selected = true;
    select.appendChild(option);
  });
}

async function loadRounds() {
  rounds = await fetchRounds();

  const select = document.getElementById("roundSelect");
  select.innerHTML = "";

  rounds.forEach(r => {
    const option = document.createElement("option");
    option.value = r.id;
    option.textContent = `Ronda ${r.round_number}`;
    select.appendChild(option);
  });
}

// =============================
// LOAD TABLE
// =============================

document.getElementById("loadTable").addEventListener("click", loadTable);

async function loadTable() {

  const tournamentId =
    document.getElementById("tournamentSelect").value;

  const roundId =
    document.getElementById("roundSelect").value;

  if (!tournamentId || !roundId) return;

  // =============================
  // RPC
  // =============================

  const { data, error } = await supabase.rpc(
    'get_scoring_table_v1',
    {
      p_tournament_id: tournamentId,
      p_round_id: roundId
    }
  );

  if (error) {
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {

    document.getElementById("tableHead").innerHTML = "";
    document.getElementById("tableBody").innerHTML = "";

    return;
  }

  // =============================
  // TRANSFORM RPC → FRONT FORMAT
  // =============================

  const holesMap = new Map();
  const scorecardsMap = new Map();
  const holeScores = [];

  for (const row of data) {
    // holes
    if (!holesMap.has(row.hole_id)) {
      holesMap.set(row.hole_id, {
        id: row.hole_id,
        hole_number: row.hole_number
      });
    }

    // scorecards
    if (!scorecardsMap.has(row.scorecard_id)) {
      
      const hasGuest =
        row.guest_name !== null &&
        row.guest_name !== undefined &&
        row.guest_name.toString().trim() !== "";

      const playerName = hasGuest
        ? `${row.player_name} - ${row.guest_name}`
        : row.player_name;

      scorecardsMap.set(row.scorecard_id, {
        id: row.scorecard_id,
        tp: {
          players: {
            name: playerName
          }
        }
      });
    }

    // scores

    if (row.strokes !== null) {
      holeScores.push({
        scorecard_id: row.scorecard_id,
        hole_id: row.hole_id,
        strokes: row.strokes
      });
    }
  }

  // =============================
  // ARRAYS
  // =============================

  const holes = [...holesMap.values()]
    .sort((a, b) =>
      a.hole_number - b.hole_number
    );

  const scorecards = [...scorecardsMap.values()]
    .sort((a, b) =>
      a.tp.players.name.localeCompare(
        b.tp.players.name,
        "es"
      )
    );

  // =============================
  // RENDER
  // =============================

  renderTable(
    scorecards,
    holes,
    holeScores
  );

  recalcAll();
}

// =============================
// CALCULO DE TOTALES
// =============================

function recalcRow(row) {
  const inputs = row.querySelectorAll(".score-input");

  let out = 0;
  let inn = 0;
  let tot = 0;

  inputs.forEach((input, index) => {
    const val = parseInt(input.value) || 0;

    if (index < 9) out += val;
    else inn += val;

    tot += val;
  });

  const subTotals = row.querySelectorAll(".sub_total");
  const totalCell = row.querySelector(".total");

  if (subTotals[0]) subTotals[0].textContent = out;
  if (subTotals[1]) subTotals[1].textContent = inn;
  if (totalCell) totalCell.textContent = tot;
}

document.addEventListener("input", (e) => {
  if (!e.target.classList.contains("score-input")) return;

  const row = e.target.closest("tr");
  recalcRow(row);
});

// =============================
// RENDER TABLE
// =============================

function selectInput(input) {
  requestAnimationFrame(() => {
    input.select();
  });
}


function renderTable(scorecards, holes, holeScores) {

  const thead = document.getElementById("tableHead");
  const tbody = document.getElementById("tableBody");

  thead.innerHTML = "";
  tbody.innerHTML = "";

  const scoreMap = {};
  holeScores.forEach(s => {
    scoreMap[`${s.scorecard_id}_${s.hole_id}`] = s.strokes;
  });

  // HEADER
  let header = `<tr><th>Jugador</th>`;
  holes.forEach(h => {
    header += `<th>${h.hole_number}</th>`;
    switch (h.hole_number){
      case 9:
        header += `<th>OUT</th>`;
        break;
      case 18:
        header += `<th>IN</th><th>TOT</th>`;
        break;
    }      
  });
  header += `</tr>`;
  thead.innerHTML = header;

  // BODY
  scorecards.forEach(sc => {

    const playerName =
      sc?.tp?.players?.name ?? "SIN JUGADOR";

    let row = `<tr data-scorecard-id="${sc.id}">`;
    row += `<td>${playerName}</td>`;
    let io_s = 0;
    let tot_s = 0;

    holes.forEach(h => {
      const key = `${sc.id}_${h.id}`;
      const value = scoreMap[key] || "";
      
      row += `<td>
        <input class="score-input"
               data-hole-id="${h.id}"
               value="${value}" />
      </td>`;
      tot_s += value;
      io_s += value;
      switch (h.hole_number){
        case 9:
          row += `<td class="sub_total">${io_s}</td>`;
          io_s = 0;
          break;
        case 18:
          row += `<td class="sub_total">${io_s}</td><td class="total">${tot_s}</td>`;
          break;
      }      
    });

    row += `</tr>`;
    tbody.innerHTML += row;
  });

  enablePaste();
}

function recalcAll() {
  document.querySelectorAll("#tableBody tr")
    .forEach(recalcRow);
}

// =============================
// NAVIGACIÓN TIPO EXCEL
// =============================

document.addEventListener("keydown", (e) => {
  if (!e.target.classList.contains("score-input")) return;

  const currentInput = e.target;
  const currentCell = currentInput.closest("td");
  const currentRow = currentCell.closest("tr");

  let targetCell = null;

  switch (e.key) {

    case "ArrowRight":
      e.preventDefault();
      targetCell = findHorizontalCell(currentCell, currentRow, "right");
      break;

    case "ArrowLeft":
      e.preventDefault();
      targetCell = findHorizontalCell(currentCell, currentRow, "left");
      break;

    case "ArrowDown":
      e.preventDefault();
      targetCell = findVerticalCell(currentCell, currentRow, "down");
      break;

    case "ArrowUp":
      e.preventDefault();
      targetCell = findVerticalCell(currentCell, currentRow, "up");
      break;

    case "Enter":
      e.preventDefault();
      targetCell = findVerticalCell(currentCell, currentRow, "down");
      break;

    default:
      return;
  }

  if (targetCell) {
    const input = targetCell.querySelector("input");
    if (input) {
      input.focus();
      input.select(); // UX tipo Excel
    }
  }
});

function findHorizontalCell(cell, row, direction) {
  let next = cell;

  while (true) {
    next =
      direction === "right"
        ? next.nextElementSibling
        : next.previousElementSibling;

    if (!next) return null;

    const input = next.querySelector("input");
    if (input) return next;
  }
}

function findVerticalCell(cell, row, direction) {
  const colIndex = cell.cellIndex;

  let nextRow =
    direction === "down"
      ? row.nextElementSibling
      : row.previousElementSibling;

  if (!nextRow) return null;

  const nextCell = nextRow.children[colIndex];
  if (!nextCell) return null;

  const input = nextCell.querySelector("input");
  return input ? nextCell : null;
}

// =============================
// PASTE EXCEL
// =============================

function enablePaste() {
  document.querySelectorAll(".score-input").forEach(input => {
    input.addEventListener("paste", function (e) {
      e.preventDefault();

      const text = e.clipboardData.getData("text").trim();

      // Separar filas
      const rows = text.split("\n").map(r => r.split("\t"));

      let startCell = this.closest("td");
      let startRow = startCell.closest("tr");

      rows.forEach((rowValues, rowIndex) => {
        let currentRow = startRow;

        // bajar filas
        for (let i = 0; i < rowIndex; i++) {
          currentRow = currentRow?.nextElementSibling;
          if (!currentRow) return;
        }

        let currentCell = currentRow.children[startCell.cellIndex];

        rowValues.forEach((value) => {
          if (!currentCell) return;
          const input = currentCell.querySelector("input");
          if (input) {
            input.value = value;
            const row = input.closest("tr");
            recalcRow(row);
          }    
          currentCell = currentCell.nextElementSibling;
        });
      });
      recalcAll();
    });
  });
}

// =============================
// SELECION Y BORRADO TIPO EXCEL
// =============================

let isSelecting = false;
let startCell = null;
let selectedCells = new Set();

function clearSelection() {
  selectedCells.forEach(cell => cell.classList.remove("selected"));
  selectedCells.clear();
}

function selectRectangle(endCell) {
  clearSelection();

  const startRow = startCell.parentElement.rowIndex;
  const endRow = endCell.parentElement.rowIndex;

  const startCol = startCell.cellIndex;
  const endCol = endCell.cellIndex;

  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);

  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);

  for (let r = minRow; r <= maxRow; r++) {
    const row = document.querySelectorAll("tr")[r];
    if (!row) continue;

    for (let c = minCol; c <= maxCol; c++) {
      const cell = row.children[c];
      if (!cell) continue;

      selectedCells.add(cell);
      cell.classList.add("selected");
    }
  }
}

document.addEventListener("mousedown", (e) => {
  if (!e.target.classList.contains("score-input")) return;

  isSelecting = true;
  startCell = e.target.closest("td");

  clearSelection();
  selectedCells.add(startCell);
  startCell.classList.add("selected");
});

document.addEventListener("mouseover", (e) => {
  if (!isSelecting) return;
  if (!e.target.classList.contains("score-input")) return;

  const currentCell = e.target.closest("td");
  selectRectangle(currentCell);
});

document.addEventListener("mouseup", () => {
  isSelecting = false;
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Delete") return;

  selectedCells.forEach(cell => {
    const input = cell.querySelector("input");
    if (input) {
      input.value = "";
      const row = input.closest("tr");
      recalcRow(row);
    }
  });
});

// =============================
// SAVE SCORES
// =============================

document.getElementById("saveScores").addEventListener("click", saveScores);

async function saveScores() {

  const rows = document.querySelectorAll("#tableBody tr");

  let inserts = [];

  rows.forEach(row => {

    const scorecardId = row.dataset.scorecardId;
    const inputs = row.querySelectorAll("input");

    let hasData = false;

    inputs.forEach(i => {
      if (i.value !== "") hasData = true;
    });

    if (!hasData) return;

    inputs.forEach(input => {
      if (!input.value) return;

      inserts.push({
        scorecard_id: scorecardId,
        hole_id: input.dataset.holeId,
        strokes: parseInt(input.value)
      });
    });
  });

  if (inserts.length === 0) {
    alert("No hay datos");
    return;
  }

  const { error } = await supabase
    .from("hole_scores")
    .upsert(inserts, {
      onConflict: 'scorecard_id,hole_id'
    });

  if (error) {
    console.error(error);
    alert("Error guardando");
    return;
  }

  alert("Scores guardados");
  await loadTable();
}

// =============================
// SELECCIÓN A TEXTO
// =============================

function getSelectionAsMatrix() {
  if (selectedCells.size === 0) return "";

  const cells = Array.from(selectedCells);

  // Agrupar por fila
  const rowsMap = new Map();

  cells.forEach(cell => {
    const row = cell.parentElement;
    const rowIndex = row.rowIndex;
    const colIndex = cell.cellIndex;

    if (!rowsMap.has(rowIndex)) {
      rowsMap.set(rowIndex, []);
    }

    rowsMap.get(rowIndex).push({ colIndex, cell });
  });

  // Ordenar filas
  const sortedRows = Array.from(rowsMap.entries())
    .sort((a, b) => a[0] - b[0]);

  // Construir matriz
  const matrix = sortedRows.map(([_, cols]) => {
    return cols
      .sort((a, b) => a.colIndex - b.colIndex)
      .map(({ cell }) => {
        const input = cell.querySelector("input");
        return input?.value || "";
      });
  });

  // Convertir a texto Excel (tab + newline)
  return matrix.map(row => row.join("\t")).join("\n");
}

document.addEventListener("copy", (e) => {
  if (selectedCells.size === 0) return;

  const text = getSelectionAsMatrix();

  e.preventDefault();
  e.clipboardData.setData("text/plain", text);
});

// =============================
// INIT
// =============================

document.addEventListener("DOMContentLoaded", async () => {

  await loadTournaments();
  await loadRounds();
  await loadTable();

  document.getElementById("tournamentSelect")
    .addEventListener("change", loadTable);

  document.getElementById("roundSelect")
    .addEventListener("change", loadTable);

  const tableBody = document.getElementById("tableBody");
  
  tableBody.addEventListener("focusin", (e) => {
    const input = e.target;
    if (input.matches(".score-input")) {
      selectInput(input);
    }
  });
  
  tableBody.addEventListener("click", (e) => {
    const input = e.target;
    if (input.matches(".score-input")) {
      selectInput(input);
    }
  });
  
  initAuth();
  
});
