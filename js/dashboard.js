import { supabase } from './supabaseClient.js';

let dashboardLoaded = false;

const tournamentSelect =
  document.getElementById("tournament");

let currentTournamentId =
  tournamentSelect.value || null;

tournamentSelect.addEventListener(
  "change",
  async (e) => {

    currentTournamentId = e.target.value;

    await loadScoreDistributionChart(
      currentTournamentId
    );

    await renderDashboard(
      currentTournamentId
    );

    dashboardLoaded = true;
  }
);

const btnLeaderboard =
  document.getElementById("btn-leaderboard");

const btnDashboard =
  document.getElementById("btn-dashboard");

const leaderboard =
  document.getElementById("leaderboard");

const dashboard =
  document.getElementById("dashboard");

const selector =
  document.getElementById(
    "category-row-selector"
  );

const texto =
  document.getElementById("informe");

// =============================
// LEADERBOARD
// =============================

function showLeaderboard() {

  selector.hidden = false;

  leaderboard.hidden = false;

  dashboard.hidden = true;

  btnLeaderboard.classList.add("active");

  btnDashboard.classList.remove("active");

  texto.textContent = "Leaderboard";
}

// =============================
// DASHBOARD
// =============================

async function showDashboard() {

  currentTournamentId =
    tournamentSelect.value;

  if (!currentTournamentId) {

    console.warn(
      "No hay torneo seleccionado"
    );

    return;
  }

  selector.hidden = true;

  leaderboard.hidden = true;

  dashboard.hidden = false;

  btnLeaderboard.classList.remove(
    "active"
  );

  btnDashboard.classList.add(
    "active"
  );

  texto.textContent = "Estadísticas";

  if (!dashboardLoaded) {

    await loadScoreDistributionChart(
      currentTournamentId
    );

    await renderDashboard(
      currentTournamentId
    );

    dashboardLoaded = true;
  }
}

btnLeaderboard.addEventListener(
  "click",
  showLeaderboard
);

btnDashboard.addEventListener(
  "click",
  showDashboard
);

// =============================
// DISTRIBUCIÓN SCORES
// =============================

async function loadScoreDistributionChart(
  tournamentId
) {

  const dashboard =
    document.getElementById("dashboard");

  // =========================
  // FETCH RPC
  // =========================

  const { data, error } =
    await supabase.rpc(
      "get_score_distribution_v2",
      {
        p_tournament_id: tournamentId
      }
    );

  if (error) {

    console.error(error);

    dashboard.innerHTML = `
      <p>Error cargando estadísticas</p>
    `;

    return;
  }

  if (!data?.length) return;

  const row = data[0];

  const totals = {

    eagles:
      row.eagles_plus || 0,

    birdies:
      row.birdies || 0,

    pars:
      row.pars || 0,

    bogeys:
      row.bogeys || 0,

    doubles:
      row.doubles || 0,

    triplePlus:
      row.triple_plus || 0
  };

  const chartData = [
    totals.eagles,
    totals.birdies,
    totals.pars,
    totals.bogeys,
    totals.doubles,
    totals.triplePlus
  ];

  const chartLabels = [
    "Eagle+",
    "Birdie",
    "Par",
    "Bogey",
    "Doble",
    "Triple+"
  ];

  const chartColors = [
    "#0b3d2e",
    "#1f6f50",
    "#d9d9d9",
    "#8c8c8c",
    "#4d4d4d",
    "#1a1a1a"
  ];

  const totalResults =
    chartData.reduce((a, b) => a + b, 0);

  // =========================
  // HTML
  // =========================

  dashboard.innerHTML = `

    <div class="dashboard-card">

      <h2 class="dashboard-title">
        Distribución de Resultados
      </h2>

      <div class="distribution-layout">

        <div class="chart-container">
          <canvas id="score-distribution-chart"></canvas>
        </div>

        <div class="distribution-legend">

          ${chartLabels.map((label, i) => `

            <div class="legend-row">

              <div class="legend-left">

                <span
                  class="legend-color"
                  style="background:${chartColors[i]}"
                ></span>

                <span class="legend-label">
                  ${label}
                </span>

              </div>

              <div class="legend-right">

                <span class="legend-value">
                  ${chartData[i]}
                </span>

                <span class="legend-percent">
                  ${(
                    (chartData[i] / totalResults) * 100
                  ).toFixed(0)}%
                </span>

              </div>

            </div>

          `).join("")}

        </div>

      </div>

    </div>
  `;

  // =========================
  // TEXTO CENTRAL
  // =========================

  const centerTextPlugin = {

    id: "centerText",

    afterDraw(chart) {

      const { ctx } = chart;

      const meta =
        chart.getDatasetMeta(0);

      if (!meta.data.length) return;

      const x = meta.data[0].x;

      const y = meta.data[0].y;

      ctx.save();

      ctx.textAlign = "center";

      ctx.textBaseline = "middle";

      ctx.fillStyle = "#1a1a1a";

      ctx.font =
        "bold 28px sans-serif";

      ctx.fillText(
        totalResults,
        x,
        y - 8
      );

      ctx.fillStyle = "#666";

      ctx.font =
        "14px sans-serif";

      ctx.fillText(
        "scores",
        x,
        y + 18
      );

      ctx.restore();
    }
  };

  // =========================
  // CHART
  // =========================

  const ctx = document
    .getElementById(
      "score-distribution-chart"
    )
    .getContext("2d");

  new Chart(ctx, {

    type: "doughnut",

    data: {

      labels: chartLabels,

      datasets: [{

        data: chartData,

        backgroundColor:
          chartColors,

        borderWidth: 0
      }]
    },

    options: {

      responsive: true,

      maintainAspectRatio: false,

      cutout: "68%",

      plugins: {

        legend: {
          display: false
        },

        tooltip: {

          callbacks: {

            label(context) {

              const value =
                context.raw;

              const pct = (
                (value / totalResults) * 100
              ).toFixed(1);

              return `
                ${value} (${pct}%)
              `;
            }
          }
        }
      }
    },

    plugins: [centerTextPlugin]
  });
}

// =============================
// TABLA DIFICULTAD
// =============================

async function renderDashboard(
  tournamentId
) {

  const container =
    document.getElementById(
      "dashboard"
    );

  // =========================
  // CARD WRAPPER
  // =========================

  const card =
    document.createElement("div");

  card.className = "dashboard-card";

  // =========================
  // TITLE
  // =========================

  const title =
    document.createElement("h2");

  title.className =
    "dashboard-title";

  title.textContent =
    "Dificultad por Hoyo";

  card.appendChild(title);

  // =========================
  // FETCH RPC
  // =========================

  const { data, error } =
    await supabase.rpc(
      "get_hole_difficulty_v2",
      {
        p_tournament_id: tournamentId
      }
    );

  if (error) {

    console.error(error);

    container.innerHTML = `
      <p>Error cargando estadísticas</p>
    `;

    return;
  }

  // =========================
  // TABLE
  // =========================

  const table =
    document.createElement("table");

  table.className =
    "dashboard-table";

  const thead =
    document.createElement("thead");

  thead.innerHTML = `

    <tr>
      <th>Hoyo</th>
      <th>Par</th>
      <th>Ventaja</th>
      <th>Prom Gross</th>
      <th>Dif Prom</th>
      <th>Prom Stbf</th>
      <th>Dificultad</th>
    </tr>

  `;

  table.appendChild(thead);

  const tbody =
    document.createElement("tbody");

  data.forEach(row => {

    const tr =
      document.createElement("tr");

    const color =
      getColor(
        row.avg_stableford_points
      );

    tr.innerHTML = `

      <td class="col1">
        ${row.hole_number}
      </td>

      <td class="col2">
        ${row.par}
      </td>

      <td class="col3">
        ${row.handicap}
      </td>

      <td class="col4">
        ${Number(
          row.avg_strokes
        ).toFixed(2)}
      </td>

      <td class="col5">
        ${Number(
          row.avg_against_par
        ).toFixed(2)}
      </td>

      <td class="col6">
        ${Number(
          row.avg_stableford_points
        ).toFixed(2)}
      </td>

      <td>
        <div class="semaforo ${color}"></div>
      </td>

    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  card.appendChild(table);

  container.appendChild(card);
}

// =============================
// SEMÁFORO
// =============================

function getColor(val) {

  if (val < 0.6) {
    return "red";
  }

  if (val < 0.8) {
    return "orange";
  }

  if (val < 1.0) {
    return "yellow";
  }

  return "green";
}
