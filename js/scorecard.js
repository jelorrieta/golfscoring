// =============================
// 1. IMPORT Y CONFIGURACIÓN
// =============================
import { supabase } from './supabaseClient.js';

// ==============================
// TABLE HELPERS
// ==============================

function createTable() {
  const table = document.createElement("table");
  table.className = "scorecard-table";
  return table;
}

function createRow(labelText, columns, cellRenderer) {
  const tr = document.createElement("tr");
  const th = document.createElement("th");
  th.className = "row-label";
  if (labelText === "Hoyo"|| labelText === "Par") {
    th.classList.add("hole_label");
  }
  if (labelText === "Par") {
    th.id = "par-row-label";
  }
   if (labelText === "Ventaja") {
     th.classList.add("ventaja_label");
  } 
    
  th.textContent = labelText;
  tr.appendChild(th);
  columns.forEach(col => {
    tr.appendChild(cellRenderer(col));
  });
  return tr;
}

function createCellElement(className = "") {
  const td = document.createElement("td");
  td.className = className;
  return td;
}

// ==============================
// RENDERER EXTERNO
// ==============================

export async function renderScorecardInElement({
  container,
  round_id,
  tournament_player_id,
  format,
  tournament_id
}) {

  // ==========================
  // CREAR TABLA
  // ==========================

  container.innerHTML = "";
  const table = createTable();
  container.appendChild(table);
  const columns = getColumnsConfig();
  table.appendChild(createRow("Hoyo", columns, renderHoleHeader));
  table.appendChild(createRow("Ventaja", columns, renderHandicapHeader));
  const parRow = createRow("Par", columns, renderParCell);
  table.appendChild(parRow);
  table.appendChild(createRow("Golpes Totales", columns, renderScoreCell));

  if (format !== "stableford" && format !== "menores") {
    table.appendChild(createRow("Neto", columns, renderNetCell));
  }
  

  if (format == "stableford") {
    table.appendChild(createRow("Puntos Gross", columns, renderGrossPointsCell));
    table.appendChild(createRow("Puntos Netos", columns, renderPointsCell));
  }

  // ==========================
  // HCP JUGADOR
  // ==========================

  const { data: tpData } = await supabase
    .from('tournament_players')
    .select('playing_handicap')
    .eq('id', tournament_player_id)
    .maybeSingle();

  const playing_handicap = tpData?.playing_handicap ?? null;

  const parRowLabel = table.querySelector("#par-row-label");

  if (parRowLabel && playing_handicap !== null) {
      parRowLabel.textContent = `Par / HCP ${playing_handicap}`;
  }

  // ==========================
  // CARGAR SCORECARD RPC
  // ==========================

  const { data: scores, error } = await supabase.rpc(
    'get_scorecard_v2',
    {
      p_round_id: round_id,
      p_tournament_player_id: tournament_player_id
    }
  );

  if (error) {
    console.error(error);
    return;
  }

  if (!scores?.length) return;

  scores.forEach(s => {

    const h = s.hole_number;

    const parEl = table.querySelector(`#hole_par_value_${h}`);
    const handicapEl = table.querySelector(`#hole_handicap_${h}`);
    const received = table.querySelector(`#hole_strokes_received_${h}`);

    const el = table.querySelector(`#hole_${h}`);
    const el2 = table.querySelector(`#hole_net_${h}`);
    const el3 = table.querySelector(`#hole_puntos_g_${h}`);
    const el4 = table.querySelector(`#hole_puntos_${h}`);

    if (parEl) parEl.textContent = s.par;

    if (handicapEl) handicapEl.textContent = s.handicap;

    if (el) el.textContent = s.strokes;

    if (el2) el2.textContent = s.net_strokes;

    if (el3) el3.textContent = s.g_stableford_points;

    if (el4) el4.textContent = s.stableford_points;

    if (received) {
      received.textContent =
        "•".repeat(s.strokes_received || 0);
    }

  });

  // ==========================
  // SUMA DE TOTALES
  // ==========================

  function sumRowLocal(prefix) {

    const ranges = {
      out: [1, 9],
      in: [10, 18],
      total: [1, 18]
    };

    Object.entries(ranges).forEach(([key, [start, end]]) => {
      let sum = 0;

      for (let i = start; i <= end; i++) {

        const el = table.querySelector(`#${prefix}_${i}`);

        const value = parseInt(el?.textContent || 0, 10);

        if (!isNaN(value)) {
          sum += value;
        }
      }

      const target = table.querySelector(`#${prefix}_${key}`);

      if (target) {
        target.textContent = sum;
      }
    });
  }

  sumRowLocal("hole_par_value");
  sumRowLocal("hole");
  sumRowLocal("hole_net");
  sumRowLocal("hole_puntos");
  sumRowLocal("hole_puntos_g");

  // ==========================
  // AGREGAR ESTILOS POR SCORE
  // ==========================

  for (let i = 1; i <= 18; i++) {

    const scoreEl = table.querySelector(`#hole_${i}`);
    const parEl = table.querySelector(`#hole_par_value_${i}`);
    const netoEl = table.querySelector(`#hole_net_${i}`);
    const sfGross = table.querySelector(`#hole_puntos_g_${i}`);
    const sfNet = table.querySelector(`#hole_puntos_${i}`);

    const puntosneto = parseInt(sfNet?.textContent);
    const puntosgross = parseInt(sfGross?.textContent);
    
    if (!scoreEl || !parEl) continue;

    const score = parseInt(scoreEl.textContent);
    const par = parseInt(parEl.textContent);

    if (isNaN(score) || isNaN(par)) continue;

    const diff = score - par;

    scoreEl.classList.remove(
      "birdie",
      "eagle",
      "bogey",
      "double-bogey",
      "triple-bogey"
    );

    if (diff <= -2 && score > 0) {
      scoreEl.classList.add("eagle");

    } else if (diff === -1) {
      scoreEl.classList.add("birdie");

    } else if (diff === 1) {
      scoreEl.classList.add("bogey");

    } else if (diff === 2) {
      scoreEl.classList.add("double-bogey");

    } else if (diff >= 3) {
      scoreEl.classList.add("triple-bogey");
    }

    // ======================
    // FORMATO STABLEFORD
    // ======================

    sfGross?.classList.remove(
      "sf-0",
      "sf-1",
      "sf-2",
      "sf-3",
      "sf-4",
      "sf-5"
    );

    sfNet?.classList.remove(
      "sf-0",
      "sf-1",
      "sf-2",
      "sf-3",
      "sf-4",
      "sf-5"
    );

    // Stableford Gross

    if (!isNaN(puntosgross)) {

      if (puntosgross <= 1) {
        sfGross.classList.add(`sf-${puntosgross}`);

      } else if (puntosgross >= 5) {
        sfGross.classList.add("sf-5");

      } else {
        sfGross.classList.add(`sf-${puntosgross}`);
      }
    }
    
    // Stableford Neto

    if (!isNaN(puntosneto)) {

      if (puntosneto <= 1) {
        sfNet.classList.add(`sf-${puntosneto}`);

      } else if (puntosneto >= 5) {
        sfNet.classList.add("sf-5");

      } else {
        sfNet.classList.add(`sf-${puntosneto}`);
      }
    }
    
    // ======================
    // FORMATO NETOS
    // ======================

    if (!netoEl || !parEl) continue;

    const neto = parseInt(netoEl.textContent);

    if (isNaN(neto) || isNaN(par)) continue;

    const diff2 = neto - par;

    netoEl.classList.remove(
      "birdie",
      "eagle",
      "bogey",
      "double-bogey",
      "triple-bogey"
    );

    if (diff2 <= -2 && neto > 0) {
      netoEl.classList.add("eagle");

    } else if (diff2 === -1) {
      netoEl.classList.add("birdie");

    } else if (diff2 === 1) {
      netoEl.classList.add("bogey");

    } else if (diff2 === 2) {
      netoEl.classList.add("double-bogey");

    } else if (diff2 >= 3) {
      netoEl.classList.add("triple-bogey");
    }
  }
}

// ==============================
// CONFIG COLUMNAS
// ==============================

function getColumnsConfig() {

  const cols = [];

  for (let i = 1; i <= 21; i++) {

    if (i === 10) {

      cols.push({
        type: "out",
        label: "1aVta"
      });

    } else if (i === 20) {

      cols.push({
        type: "in",
        label: "2daVta"
      });

    } else if (i === 21) {

      cols.push({
        type: "total",
        label: "Total"
      });

    } else {

      const hole = i < 10 ? i : i - 1;

      cols.push({
        type: "hole",
        hole,
        label: hole.toString()
      });
    }
  }

  return cols;
}

// ==============================
// RENDERERS
// ==============================

// HOYO

function renderHoleHeader(col) {

  const td = createCellElement(
    col.type === "hole"
      ? "hole_num"
      : "hole_num_t"
  );

  td.textContent =
    col.type === "hole"
      ? col.hole
      : col.label;
    
  return td;
}

function renderHandicapHeader(col) {

    const td = createCellElement("ventaja");

    td.id =
        col.type === "hole"
          ? `hole_handicap_${col.hole}`
          : `hole_handicap_${col.type}`;

    return td;
}

// PAR

function renderParCell(col) {

  const td = createCellElement("par");

  td.id =
    col.type === "hole"
      ? `hole_par_${col.hole}`
      : `hole_par_${col.type}`;

  // Contenedor puntos handicap

  const strokesDiv = document.createElement("div");

  strokesDiv.className = "par-strokes";

  strokesDiv.id =
    col.type === "hole"
      ? `hole_strokes_received_${col.hole}`
      : `hole_strokes_received_${col.type}`;

 // valor par

  const parDiv = document.createElement("div");

  parDiv.className = "par-value";

  parDiv.id =
    col.type === "hole"
      ? `hole_par_value_${col.hole}`
      : `hole_par_value_${col.type}`;
  
  td.appendChild(strokesDiv);
  td.appendChild(parDiv);

  return td;
}

// ASIGNAR CLASES A LOS DISTINTOS TIPOS DE SCORES

function getScoreCellClass(col) {

  if (col.type === "hole") return "cell";

  if (col.type === "total") return "cell_tot";

  return "cell_t";
}

// GOLPES

function renderScoreCell(col) {

  const td = createCellElement(
    getScoreCellClass(col)
  );

  td.id =
    col.type === "hole"
      ? `hole_${col.hole}`
      : `hole_${col.type}`;

  return td;
}

// NETO

function renderNetCell(col) {

  const td = createCellElement(
    getScoreCellClass(col)
  );

  td.id =
    col.type === "hole"
      ? `hole_net_${col.hole}`
      : `hole_net_${col.type}`;

  return td;
}

// PUNTOS GROSS

function renderGrossPointsCell(col) {

  const td = createCellElement(
    getScoreCellClass(col)
  );

  td.id =
    col.type === "hole"
      ? `hole_puntos_g_${col.hole}`
      : `hole_puntos_g_${col.type}`;

  return td;
}

// PUNTOS NETOS

function renderPointsCell(col) {

  const td = createCellElement(
    getScoreCellClass(col)
  );

  td.id =
    col.type === "hole"
      ? `hole_puntos_${col.hole}`
      : `hole_puntos_${col.type}`;

  return td;
}