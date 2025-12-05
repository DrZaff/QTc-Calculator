// script.js – QTc Calculator (Narrow vs Wide QRS)

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("tool-form");
  const resultsContainer = document.getElementById("results-container");
  const flagsContainer = document.getElementById("flags-container");
  const inputsCard = document.querySelector(".card-inputs");
  const qrsTypeSelect = document.getElementById("qrsType");

  if (!form) return;

  // Toggle wide-mode fields
  function updateModeClasses() {
    const isWide = qrsTypeSelect.value === "wide";
    if (isWide) {
      inputsCard.classList.add("wide-mode");
    } else {
      inputsCard.classList.remove("wide-mode");
    }
  }

  qrsTypeSelect.addEventListener("change", updateModeClasses);
  updateModeClasses();

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const inputs = readInputs();
    const validationErrors = validateInputs(inputs);

    if (validationErrors.length > 0) {
      renderValidationErrors(resultsContainer, validationErrors);
      flagsContainer.innerHTML = "";
      return;
    }

    const calcResults = performCalculations(inputs);
    const interpretation = interpretResults(calcResults);
    const flags = deriveFlags(calcResults, interpretation);

    renderResults(resultsContainer, calcResults, interpretation);
    renderFlags(flagsContainer, flags);
  });
});

// ---- Input Handling ----

function readInputs() {
  const qrsType = document.getElementById("qrsType").value;
  const heartRate = parseFloat(document.getElementById("heartRate").value);
  const qtInterval = parseFloat(document.getElementById("qtInterval").value);

  let qrsDuration = null;
  let gender = null;

  if (qrsType === "wide") {
    qrsDuration = parseFloat(
      document.getElementById("qrsDuration").value
    );
    const genderNode = document.querySelector(
      'input[name="gender"]:checked'
    );
    gender = genderNode ? genderNode.value : null;
  }

  return {
    qrsType,
    heartRate,
    qtInterval,
    qrsDuration,
    gender,
  };
}

function validateInputs(inputs) {
  const errors = [];

  if (!inputs.heartRate || Number.isNaN(inputs.heartRate)) {
    errors.push("Heart rate is required and must be a number (bpm).");
  } else if (inputs.heartRate <= 0) {
    errors.push("Heart rate must be greater than 0 bpm.");
  }

  if (!inputs.qtInterval || Number.isNaN(inputs.qtInterval)) {
    errors.push("QT interval is required and must be a number (ms).");
  } else if (inputs.qtInterval <= 0) {
    errors.push("QT interval must be greater than 0 ms.");
  }

  if (inputs.qrsType === "wide") {
    if (!inputs.qrsDuration || Number.isNaN(inputs.qrsDuration)) {
      errors.push("QRS duration is required and must be a number (ms) for wide QRS.");
    } else if (inputs.qrsDuration <= 0) {
      errors.push("QRS duration must be greater than 0 ms.");
    }

    if (!inputs.gender) {
      errors.push("Gender is required for Rautaharju wide-QRS calculation.");
    }
  }

  // Optional soft warning as error (you can downgrade this to a flag if you prefer)
  if (inputs.heartRate && (inputs.heartRate < 30 || inputs.heartRate > 140)) {
    errors.push(
      "Heart rate is outside typical validation ranges for many QTc formulas (<30 or >140 bpm). Interpret with extra caution."
    );
  }

  return errors;
}

// ---- Pure Calculation Logic ----

function performCalculations(inputs) {
  const hr = inputs.heartRate;
  const qt = inputs.qtInterval; // ms
  const rr = 60 / hr; // seconds

  const isWide = inputs.qrsType === "wide";

  let narrowResults = null;
  let wideResults = null;

  if (!isWide) {
    narrowResults = calculateNarrowQTc(hr, qt, rr);
  } else {
    wideResults = calculateWideQTc(
      hr,
      qt,
      inputs.qrsDuration,
      inputs.gender,
      rr
    );
  }

  return {
    mode: inputs.qrsType,
    hr,
    qt,
    rr,
    qrs: inputs.qrsDuration,
    gender: inputs.gender,
    narrowResults,
    wideResults,
  };
}

// Narrow complex formulas (QT in ms, RR in seconds)
function calculateNarrowQTc(hr, qt, rr) {
  // Bazett: QTc = QT / sqrt(RR)
  const qtcBazett = qt / Math.sqrt(rr);

  // Fridericia: QTc = QT / RR^(1/3)
  const qtcFridericia = qt / Math.cbrt(rr);

  // Framingham: QTc = QT + 154 * (1 - RR)
  const qtcFramingham = qt + 154 * (1 - rr);

  // Hodges: QTc = QT + 1.75 * [(60 / RR) - 60]
  const qtcHodges = qt + 1.75 * ((60 / rr) - 60);

  // Rautaharju (HR-based variant): QT * (120 + HR) / 180
  const qtcRautaharju = qt * (120 + hr) / 180;

  return {
    qtcBazett,
    qtcFridericia,
    qtcFramingham,
    qtcHodges,
    qtcRautaharju,
  };
}

// Wide complex formulas (Bogossian + Rautaharju QT8)
function calculateWideQTc(hr, qt, qrs, gender, rr) {
  // Bogossian: modified QT = QT - 0.5 * QRS
  const qtModifiedBog = qt - 0.5 * qrs;

  // Apply Fridericia to modified QT
  const qtcBogFrid = qtModifiedBog / Math.cbrt(rr);

  // Rautaharju QT8 wide-QRS formula:
  // QTc = QT - 155 * (60/HR - 1) - 0.93 * (QRS - 139) + k
  const rateTerm = 60 / hr - 1;
  const qrsTerm = qrs - 139;
  const k = gender === "male" ? -22 : -34; // ms

  const qtcRautaharjuWide =
    qt - 155 * rateTerm - 0.93 * qrsTerm + k;

  return {
    qtModifiedBog,
    qtcBogFrid,
    qtcRautaharjuWide,
  };
}

// ---- Interpretation ----

function interpretResults(calcResults) {
  const { mode, narrowResults, wideResults } = calcResults;

  const allQTc = [];
  if (mode === "narrow" && narrowResults) {
    allQTc.push(
      narrowResults.qtcBazett,
      narrowResults.qtcFridericia,
      narrowResults.qtcFramingham,
      narrowResults.qtcHodges,
      narrowResults.qtcRautaharju
    );
  } else if (mode === "wide" && wideResults) {
    allQTc.push(
      wideResults.qtcBogFrid,
      wideResults.qtcRautaharjuWide
    );
  }

  const maxQTc = allQTc.length ? Math.max(...allQTc) : null;

  let summary = "QTc values calculated. Review individual formulas below.";
  const notes = [];

  if (maxQTc !== null) {
    if (maxQTc >= 500) {
      summary =
        "Marked QTc prolongation (≥500 ms) in at least one formula.";
      notes.push(
        "QTc ≥500 ms is often associated with increased risk of torsades de pointes; correlate with symptoms, electrolytes, and medications.",
        "Formulas differ at rate extremes; verify manually and consider repeat ECG."
      );
    } else if (maxQTc >= 460) {
      summary =
        "QTc is borderline to mildly prolonged in at least one formula.";
      notes.push(
        "QTc 460–499 ms is often considered borderline to mildly prolonged; thresholds vary by source and sex.",
        "Consider which formula is preferred by your institution (often Fridericia or Framingham)."
      );
    } else {
      summary = "QTc values fall within conventional ranges for most formulas.";
      notes.push(
        "Normal ranges and risk thresholds vary across guidelines; this tool does not apply sex-specific or age-specific cutoffs."
      );
    }
  }

  if (mode === "wide") {
    notes.push(
      "In wide QRS rhythms, prolonged QT may reflect depolarization rather than repolarization abnormalities; consider focusing on JT interval and dedicated wide-QRS QTc literature."
    );
  }

  return {
    summary,
    notes,
  };
}

// ---- Flags / Alerts ----

function deriveFlags(calcResults, interpretation) {
  const flags = [];
  const { mode, narrowResults, wideResults, hr } = calcResults;

  const qtcValues = [];

  if (mode === "narrow" && narrowResults) {
    qtcValues.push(
      narrowResults.qtcBazett,
      narrowResults.qtcFridericia,
      narrowResults.qtcFramingham,
      narrowResults.qtcHodges,
      narrowResults.qtcRautaharju
    );
  } else if (mode === "wide" && wideResults) {
    qtcValues.push(
      wideResults.qtcBogFrid,
      wideResults.qtcRautaharjuWide
    );
  }

  const maxQTc = qtcValues.length ? Math.max(...qtcValues) : null;

  if (maxQTc !== null) {
    if (maxQTc >= 500) {
      flags.push({
        level: "danger",
        message:
          "At least one QTc ≥500 ms. High-risk range; evaluate urgently in clinical context.",
      });
    } else if (maxQTc >= 460) {
      flags.push({
        level: "warning",
        message:
          "QTc between 460–499 ms in at least one formula. Borderline/mild prolongation.",
      });
    }
  }

  if (hr < 40 || hr > 120) {
    flags.push({
      level: "warning",
      message:
        "Heart rate is outside 40–120 bpm; many QTc formulas perform poorly at extremes.",
    });
  }

  flags.push({
    level: "info",
    message:
      "Use QTc values alongside clinical judgment, medications, electrolytes, and serial ECGs.",
  });

  return flags;
}

// ---- Rendering ----

function renderValidationErrors(container, errors) {
  container.innerHTML = `
    <div class="results-errors">
      <h3>Check your inputs</h3>
      <ul>
        ${errors.map((err) => `<li>${err}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderResults(container, calcResults, interpretation) {
  const { mode, hr, qt, rr, qrs, narrowResults, wideResults } =
    calcResults;

  const rrMs = rr * 1000;

  let content = `
    <div class="results-section">
      <h3>Input Summary</h3>
      <ul class="results-list">
        <li>
          <span class="results-label">Mode</span>
          <span class="results-value">${
            mode === "narrow" ? "Narrow QRS" : "Wide QRS"
          }</span>
        </li>
        <li>
          <span class="results-label">Heart Rate</span>
          <span class="results-value">${formatNumber(hr, 0)} bpm</span>
        </li>
        <li>
          <span class="results-label">RR Interval</span>
          <span class="results-value">${formatNumber(rrMs, 0)} ms (${formatNumber(
    rr,
    3
  )} s)</span>
        </li>
        <li>
          <span class="results-label">QT Interval</span>
          <span class="results-value">${formatNumber(qt, 0)} ms</span>
        </li>
  `;

  if (mode === "wide") {
    content += `
        <li>
          <span class="results-label">QRS Duration</span>
          <span class="results-value">${formatNumber(qrs, 0)} ms</span>
        </li>
      `;
  }

  content += `</ul>`;

  // QTc formulas
  content += `<h3>QTc Values</h3><ul class="results-list">`;

  if (mode === "narrow" && narrowResults) {
    const rows = [
      ["Bazett", narrowResults.qtcBazett],
      ["Fridericia", narrowResults.qtcFridericia],
      ["Framingham", narrowResults.qtcFramingham],
      ["Hodges", narrowResults.qtcHodges],
      ["Rautaharju (HR)", narrowResults.qtcRautaharju],
    ];

    rows.forEach(([label, value]) => {
      const cls = qtFlagClass(value);
      content += `
        <li>
          <span class="results-label">${label}</span>
          <span class="results-value ${cls}">${formatNumber(
            value,
            0
          )} ms</span>
        </li>
      `;
    });
  } else if (mode === "wide" && wideResults) {
    const rows = [
      ["Bogossian modified QT", wideResults.qtModifiedBog],
      ["Bogossian + Fridericia QTc", wideResults.qtcBogFrid],
      ["Rautaharju wide-QRS QTc", wideResults.qtcRautaharjuWide],
    ];

    rows.forEach(([label, value]) => {
      const cls = qtFlagClass(label.includes("modified") ? null : value);
      content += `
        <li>
          <span class="results-label">${label}</span>
          <span class="results-value ${cls}">${formatNumber(
            value,
            0
          )} ms</span>
        </li>
      `;
    });
  }

  content += `</ul>`;

  content += `
      <h3>Interpretation</h3>
      <p>${interpretation.summary}</p>
      ${
        interpretation.notes && interpretation.notes.length
          ? `<ul>${interpretation.notes
              .map((note) => `<li>${note}</li>`)
              .join("")}</ul>`
          : ""
      }
      <p class="results-note">
        Formulas assume accurate manual measurement of QT and a representative RR
        interval. Automation and rate extremes may introduce error.
      </p>
    </div>
  `;

  container.innerHTML = content;
}

function renderFlags(container, flags) {
  if (!flags || flags.length === 0) {
    container.innerHTML = `
      <p class="results-placeholder">
        No critical flags based on the provided values. Always correlate clinically.
      </p>
    `;
    return;
  }

  container.innerHTML = flags
    .map((flag) => {
      let cls = "flag-pill flag-pill--info";
      if (flag.level === "danger") cls = "flag-pill flag-pill--danger";
      else if (flag.level === "warning") cls = "flag-pill flag-pill--warning";

      return `<div class="${cls}">${flag.message}</div>`;
    })
    .join("");
}

// ---- Helpers ----

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(decimals);
}

function qtFlagClass(qtc) {
  if (qtc === null || qtc === undefined || Number.isNaN(qtc)) return "";
  if (qtc >= 500) return "results-value--danger";
  if (qtc >= 460) return "results-value--warning";
  return "";
}
