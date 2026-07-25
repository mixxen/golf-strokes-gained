const STORAGE_KEY = "golf-strokes-gained-round-v1";

const benchmarks = {
  tee: [[100, 2.92], [150, 3.05], [200, 3.22], [250, 3.45], [300, 3.72], [350, 3.98], [400, 4.20], [450, 4.42], [500, 4.65], [550, 4.88], [600, 5.10]],
  fairway: [[20, 2.40], [30, 2.48], [50, 2.62], [75, 2.75], [100, 2.88], [125, 3.00], [150, 3.13], [175, 3.26], [200, 3.42], [225, 3.58], [250, 3.75], [300, 4.05]],
  rough: [[20, 2.55], [30, 2.64], [50, 2.78], [75, 2.93], [100, 3.08], [125, 3.22], [150, 3.37], [175, 3.52], [200, 3.68], [225, 3.84], [250, 4.00], [300, 4.30]],
  sand: [[10, 2.62], [20, 2.73], [30, 2.83], [50, 3.00], [75, 3.18], [100, 3.36], [125, 3.53], [150, 3.70], [175, 3.87], [200, 4.05]],
  recovery: [[20, 2.85], [50, 3.10], [75, 3.32], [100, 3.52], [125, 3.70], [150, 3.90], [175, 4.08], [200, 4.25]],
  green: [[1, 1.00], [2, 1.05], [3, 1.15], [4, 1.28], [5, 1.40], [6, 1.50], [8, 1.65], [10, 1.78], [15, 2.00], [20, 2.15], [30, 2.35], [40, 2.50], [60, 2.70], [90, 2.95]]
};

const defaultRound = () => ({
  courseName: "",
  date: new Date().toISOString().slice(0, 10),
  shots: []
});

let round = loadRound();

const elements = {
  courseName: document.querySelector("#course-name"),
  roundDate: document.querySelector("#round-date"),
  holeNumber: document.querySelector("#hole-number"),
  holePar: document.querySelector("#hole-par"),
  startLie: document.querySelector("#start-lie"),
  startDistance: document.querySelector("#start-distance"),
  endLie: document.querySelector("#end-lie"),
  endDistance: document.querySelector("#end-distance"),
  club: document.querySelector("#club"),
  penaltyStrokes: document.querySelector("#penalty-strokes"),
  shotForm: document.querySelector("#shot-form"),
  shotList: document.querySelector("#shot-list"),
  totalSg: document.querySelector("#total-sg"),
  offTee: document.querySelector("#sg-off-tee"),
  approach: document.querySelector("#sg-approach"),
  aroundGreen: document.querySelector("#sg-around-green"),
  putting: document.querySelector("#sg-putting"),
  saveStatus: document.querySelector("#save-status"),
  undoButton: document.querySelector("#undo-button"),
  newRoundButton: document.querySelector("#new-round-button")
};

function expectedStrokes(lie, distance) {
  if (lie === "holed") return 0;
  const table = benchmarks[lie];
  if (!table) throw new Error(`No benchmark data for ${lie}`);

  const value = Number(distance);
  if (value <= table[0][0]) return table[0][1];
  if (value >= table.at(-1)[0]) return table.at(-1)[1];

  for (let index = 1; index < table.length; index += 1) {
    const [upperDistance, upperExpected] = table[index];
    const [lowerDistance, lowerExpected] = table[index - 1];
    if (value <= upperDistance) {
      const ratio = (value - lowerDistance) / (upperDistance - lowerDistance);
      return lowerExpected + ratio * (upperExpected - lowerExpected);
    }
  }
  return table.at(-1)[1];
}

function categoryForShot({ startLie, startDistance, par, shotNumber }) {
  if (startLie === "green") return "putting";
  if (startLie === "tee" && Number(par) >= 4 && shotNumber === 1) return "offTee";
  if (startLie !== "green" && Number(startDistance) <= 30) return "aroundGreen";
  return "approach";
}

function addShot(formValues) {
  const hole = Number(formValues.hole);
  const previousShots = round.shots.filter((shot) => shot.hole === hole);
  const shotNumber = previousShots.length + 1;
  const expectedBefore = expectedStrokes(formValues.startLie, formValues.startDistance);
  const expectedAfter = expectedStrokes(formValues.endLie, formValues.endDistance);
  const penaltyStrokes = Number(formValues.penaltyStrokes || 0);
  const strokesGained = expectedBefore - 1 - penaltyStrokes - expectedAfter;

  round.shots.push({
    id: crypto.randomUUID(),
    hole,
    par: Number(formValues.par),
    shotNumber,
    startLie: formValues.startLie,
    startDistance: Number(formValues.startDistance),
    endLie: formValues.endLie,
    endDistance: formValues.endLie === "holed" ? 0 : Number(formValues.endDistance),
    club: formValues.club.trim(),
    penaltyStrokes,
    expectedBefore,
    expectedAfter,
    strokesGained,
    category: categoryForShot({ ...formValues, shotNumber })
  });

  saveRound();
  carryForwardPosition();
  render();
}

function carryForwardPosition() {
  const last = round.shots.at(-1);
  if (!last || last.endLie === "holed") return;
  elements.startLie.value = last.endLie;
  elements.startDistance.value = last.endDistance;
  elements.endDistance.value = last.endLie === "green" ? 8 : Math.max(0, Math.round(last.endDistance / 3));
  elements.club.value = "";
  elements.penaltyStrokes.value = 0;
}

function displaySg(value) {
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(2)}`;
}

function positionText(lie, distance) {
  if (lie === "holed") return "Holed";
  const unit = lie === "green" ? "ft" : "yd";
  return `${Math.round(distance * 10) / 10} ${unit} ${lie}`;
}

function render() {
  elements.courseName.value = round.courseName;
  elements.roundDate.value = round.date;

  const totals = { offTee: 0, approach: 0, aroundGreen: 0, putting: 0 };
  round.shots.forEach((shot) => { totals[shot.category] += shot.strokesGained; });
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);

  setMetric(elements.totalSg, total);
  setMetric(elements.offTee, totals.offTee);
  setMetric(elements.approach, totals.approach);
  setMetric(elements.aroundGreen, totals.aroundGreen);
  setMetric(elements.putting, totals.putting);

  if (round.shots.length === 0) {
    elements.shotList.innerHTML = '<tr class="empty-row"><td colspan="5">No shots recorded yet.</td></tr>';
    return;
  }

  elements.shotList.innerHTML = round.shots.map((shot) => {
    const className = shot.strokesGained >= 0 ? "sg-positive" : "sg-negative";
    const category = ({ offTee: "Off tee", approach: "Approach", aroundGreen: "Around green", putting: "Putting" })[shot.category];
    return `<tr>
      <td>${shot.hole}</td>
      <td>${shot.shotNumber}</td>
      <td>${positionText(shot.startLie, shot.startDistance)} → ${positionText(shot.endLie, shot.endDistance)}</td>
      <td>${category}</td>
      <td class="${className}">${displaySg(shot.strokesGained)}</td>
    </tr>`;
  }).join("");
}

function setMetric(element, value) {
  element.textContent = displaySg(value);
  element.classList.toggle("sg-positive", value > 0);
  element.classList.toggle("sg-negative", value < 0);
}

function loadRound() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultRound();
  } catch {
    return defaultRound();
  }
}

function saveRound() {
  round.courseName = elements.courseName.value.trim();
  round.date = elements.roundDate.value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(round));
  elements.saveStatus.textContent = "Saved locally";
}

elements.shotForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addShot({
    hole: elements.holeNumber.value,
    par: elements.holePar.value,
    startLie: elements.startLie.value,
    startDistance: elements.startDistance.value,
    endLie: elements.endLie.value,
    endDistance: elements.endLie.value === "holed" ? 0 : elements.endDistance.value,
    club: elements.club.value,
    penaltyStrokes: elements.penaltyStrokes.value
  });
});

[elements.courseName, elements.roundDate].forEach((element) => {
  element.addEventListener("change", saveRound);
  element.addEventListener("input", () => { elements.saveStatus.textContent = "Unsaved changes"; });
});

elements.endLie.addEventListener("change", () => {
  const isHoled = elements.endLie.value === "holed";
  elements.endDistance.disabled = isHoled;
  if (isHoled) elements.endDistance.value = 0;
});

elements.undoButton.addEventListener("click", () => {
  round.shots.pop();
  saveRound();
  render();
});

elements.newRoundButton.addEventListener("click", () => {
  if (!confirm("Start a new round and erase the locally saved round?")) return;
  round = defaultRound();
  localStorage.removeItem(STORAGE_KEY);
  render();
});

render();
