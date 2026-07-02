"use strict";

const WOMPI_DONATION_URL = "https://checkout.nequi.wompi.co/l/BleRXV";
const VISITS_API_URL = "PEGAR_AQUI_ENDPOINT_DE_CLOUDFLARE_WORKER";

const STORAGE_KEY = "rosario-paso-a-paso-progress";
const VISITS_KEY = "rosario-paso-a-paso-visits";
const THEME_KEY = "rosario-paso-a-paso-theme";

const data = window.ROSARIO_DATA;
let selectedSetKey = getTodaySetKey();
let steps = [];
let state = loadProgress() || createState(selectedSetKey, 0, "iniciado");

const nodes = {
  homeView: document.querySelector("#homeView"),
  chooserView: document.querySelector("#chooserView"),
  guideView: document.querySelector("#guideView"),
  todayMystery: document.querySelector("#todayMystery"),
  todayMysteryDays: document.querySelector("#todayMysteryDays"),
  visitorCount: document.querySelector("#visitorCount"),
  mysteryGrid: document.querySelector("#mysteryGrid"),
  offlineNote: document.querySelector("#offlineNote"),
  toast: document.querySelector("#toast"),
  whereAmI: document.querySelector("#whereAmI"),
  mysteryProgress: document.querySelector("#mysteryProgress"),
  generalProgressLabel: document.querySelector("#generalProgressLabel"),
  generalProgressBar: document.querySelector("#generalProgressBar"),
  decadeProgress: document.querySelector("#decadeProgress"),
  stepTitle: document.querySelector("#stepTitle"),
  actionNote: document.querySelector("#actionNote"),
  currentMysteryText: document.querySelector("#currentMysteryText"),
  prayerText: document.querySelector("#prayerText"),
  rosaryBeads: document.querySelector("#rosaryBeads"),
  rosaryVisualLabel: document.querySelector("#rosaryVisualLabel"),
  prayerModal: document.querySelector("#prayerModal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalPrayerText: document.querySelector("#modalPrayerText"),
  closeModalBtn: document.querySelector("#closeModalBtn"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  pauseBtn: document.querySelector("#pauseBtn"),
  restartBtn: document.querySelector("#restartBtn"),
  continueBtn: document.querySelector("#continueBtn"),
  themeToggle: document.querySelector("#themeToggle")
};

init();

function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  renderToday();
  renderMysteryChooser();
  wireEvents();
  updateOnlineNotice();
  loadVisits();
  registerServiceWorker();
  nodes.continueBtn.disabled = !loadProgress();
}

function wireEvents() {
  document.querySelector("#startTodayBtn").addEventListener("click", () => startRosary(getTodaySetKey()));
  document.querySelector("#continueBtn").addEventListener("click", continueRosary);
  document.querySelector("#chooseBtn").addEventListener("click", () => showView("chooser"));
  document.querySelector("#backHomeBtn").addEventListener("click", () => showView("home"));
  document.querySelector("#shareBtn").addEventListener("click", shareRosary);
  document.querySelector("#donationBtn").addEventListener("click", openDonation);
  nodes.prevBtn.addEventListener("click", previousStep);
  nodes.nextBtn.addEventListener("click", nextStep);
  nodes.pauseBtn.addEventListener("click", pauseRosary);
  nodes.restartBtn.addEventListener("click", restartRosary);
  nodes.themeToggle.addEventListener("click", toggleTheme);
  nodes.closeModalBtn.addEventListener("click", closePrayerModal);
  nodes.prayerModal.addEventListener("click", (event) => {
    if (event.target === nodes.prayerModal) closePrayerModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePrayerModal();
  });
  window.addEventListener("online", updateOnlineNotice);
  window.addEventListener("offline", updateOnlineNotice);
}

function getTodaySetKey() {
  return data.mysterySchedule[new Date().getDay()];
}

function createState(setKey, stepIndex, status) {
  return {
    mysteryKey: setKey,
    stepIndex,
    decade: 0,
    aveMaria: 0,
    date: new Date().toISOString().slice(0, 10),
    status
  };
}

function buildSteps(setKey) {
  const set = data.mysterySets[setKey];
  const result = [
    prayerStep("inicio", "Credo de los Apóstoles", "credo", "", -1, 0, false, {
      action: "Haz la Señal de la Cruz antes de rezar.",
      beadCount: 1,
      beadKind: "cross",
      titlePrayerKey: "credo"
    }),
    prayerStep("inicio", "Padre Nuestro inicial", "padreNuestro", "", -1, 0, false, {
      beadCount: 1,
      beadKind: "large",
      titlePrayerKey: "padreNuestro"
    }),
    prayerStep("inicio", "Ave María (3 veces)", "aveMaria", "", -1, 0, false, {
      beadCount: 3,
      titlePrayerKey: "aveMaria"
    }),
    prayerStep("inicio", "Gloria", "gloria", "", -1, 0, false, {
      beadCount: 0,
      titlePrayerKey: "gloria"
    })
  ];

  set.mysteries.forEach((mystery, mysteryIndex) => {
    const number = mysteryIndex + 1;
    result.push(prayerStep("misterio", `${ordinal(number)} misterio: ${mystery}`, "padreNuestro", mystery, mysteryIndex, 0, false, {
      beadCount: 1,
      beadKind: "large",
      hideMystery: true,
      titlePrayerKey: null,
      note: data.prayers.meditacion.text,
      prayerLinks: [{ key: "padreNuestro", label: "Padre Nuestro" }]
    }));
    result.push(prayerStep("decena", "Ave María (10 veces)", "aveMaria", mystery, mysteryIndex, 10, false, {
      beadCount: 10,
      titlePrayerKey: "aveMaria"
    }));
    result.push(prayerStep("decena", `Gloria de la decena ${number}`, "gloria", mystery, mysteryIndex, 0, false, {
      beadCount: 0,
      titlePrayerKey: "gloria"
    }));
    result.push(prayerStep("decena", "Oración de Fátima", "fatima", mystery, mysteryIndex, 0, true, {
      titlePrayerKey: null,
      showText: true
    }));
  });

  result.push(prayerStep("oración final", "Salve", "salve", "", -1, 0, false, {
    beadCount: 0,
    titlePrayerKey: "salve"
  }));
  result.push(prayerStep("oración final", "Letanías de la Virgen", "letanias", "", -1, 0, true, {
    titlePrayerKey: "letanias"
  }));
  result.push(prayerStep("oración final", "Oración final del Rosario", "final", "", -1, 0, false, {
    action: "Al terminar, haz la Señal de la Cruz.",
    beadCount: 0,
    titlePrayerKey: "final"
  }));
  return result;
}

function prayerStep(area, title, prayerKey, mystery, mysteryIndex = -1, aveMaria = 0, optional = false, options = {}) {
  const prayer = data.prayers[prayerKey];
  const decade = mysteryIndex >= 0 ? mysteryIndex + 1 : 0;
  return {
    area,
    title,
    prayerKey,
    prayerTitle: prayer.title,
    text: options.text || prayer.text,
    note: options.note || "",
    prayerLinks: options.prayerLinks || [],
    showText: Boolean(options.showText),
    titlePrayerKey: Object.prototype.hasOwnProperty.call(options, "titlePrayerKey") ? options.titlePrayerKey : prayerKey,
    mystery,
    mysteryIndex,
    decade,
    aveMaria,
    optional,
    action: options.action || "",
    beadCount: options.beadCount || 0,
    beadKind: options.beadKind || "small",
    hidePrayerName: Boolean(options.hidePrayerName),
    hideMystery: Boolean(options.hideMystery)
  };
}

function ordinal(number) {
  return ["Primer", "Segundo", "Tercer", "Cuarto", "Quinto"][number - 1];
}

function startRosary(setKey) {
  selectedSetKey = setKey;
  state = createState(setKey, 0, "iniciado");
  saveProgress();
  showGuide();
}

function continueRosary() {
  const saved = loadProgress();
  if (!saved) {
    showToast("Aun no hay un Rosario guardado para continuar.");
    return;
  }
  state = saved;
  selectedSetKey = state.mysteryKey;
  showGuide();
}

function showGuide() {
  steps = buildSteps(state.mysteryKey);
  state.stepIndex = Math.min(Math.max(state.stepIndex, 0), steps.length - 1);
  showView("guide");
  renderStep();
}

function nextStep() {
  if (state.stepIndex < steps.length - 1) {
    state.stepIndex += 1;
    state.status = "iniciado";
  } else {
    state.status = "terminado";
    showToast("Has completado el Santo Rosario.");
  }
  saveProgress();
  renderStep();
}

function previousStep() {
  if (state.stepIndex > 0) {
    state.stepIndex -= 1;
    state.status = "iniciado";
    saveProgress();
    renderStep();
  }
}

function pauseRosary() {
  state.status = "pausado";
  saveProgress();
  showToast("Progreso guardado. Puedes continuar cuando quieras.");
}

function restartRosary() {
  state = createState(state.mysteryKey, 0, "iniciado");
  saveProgress();
  renderStep();
}

function renderStep() {
  const step = steps[state.stepIndex];
  const percent = Math.round(((state.stepIndex + 1) / steps.length) * 100);
  state.decade = step.decade;
  state.aveMaria = step.aveMaria;
  state.date = new Date().toISOString().slice(0, 10);
  saveProgress();

  nodes.whereAmI.textContent = capitalize(step.area);
  nodes.mysteryProgress.textContent = step.mysteryIndex >= 0 ? `Misterio ${step.mysteryIndex + 1} de 5` : "Preparación y cierre";
  nodes.generalProgressLabel.textContent = `${percent}%`;
  nodes.generalProgressBar.style.width = `${percent}%`;
  nodes.decadeProgress.textContent = getDecadeLabel(step);
  nodes.stepTitle.textContent = step.title;
  nodes.stepTitle.classList.toggle("is-clickable", Boolean(step.titlePrayerKey));
  nodes.stepTitle.tabIndex = step.titlePrayerKey ? 0 : -1;
  nodes.stepTitle.setAttribute("role", step.titlePrayerKey ? "button" : "heading");
  nodes.stepTitle.onclick = step.titlePrayerKey ? () => openPrayerModal(step.titlePrayerKey) : null;
  nodes.stepTitle.onkeydown = step.titlePrayerKey ? (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPrayerModal(step.titlePrayerKey);
    }
  } : null;
  nodes.actionNote.hidden = !step.action;
  nodes.actionNote.textContent = step.action;
  nodes.currentMysteryText.hidden = !step.mystery || step.hideMystery;
  nodes.currentMysteryText.textContent = step.mystery && !step.hideMystery ? `Misterio: ${step.mystery}` : "";
  renderStepBody(step);
  nodes.prevBtn.disabled = state.stepIndex === 0;
  nodes.nextBtn.textContent = state.stepIndex === steps.length - 1 ? "Terminar" : "Siguiente";
  renderRosaryVisual();
}

function renderStepBody(step) {
  nodes.prayerText.innerHTML = "";

  if (step.note) {
    const note = document.createElement("p");
    note.className = "prayer-note";
    note.textContent = step.note;
    nodes.prayerText.append(note);
  }

  if (step.showText) {
    const text = document.createElement("p");
    text.className = "prayer-note";
    text.textContent = step.text;
    nodes.prayerText.append(text);
  }

  step.prayerLinks.forEach((link) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "prayer-link";
    button.textContent = link.label;
    button.addEventListener("click", () => openPrayerModal(link.key));
    nodes.prayerText.append(button);
  });

  nodes.prayerText.hidden = !step.note && !step.showText && step.prayerLinks.length === 0;
}

function getDecadeLabel(step) {
  if (step.aveMaria === 10 && step.decade > 0) {
    return `Decena ${step.decade} de 5: Avemaría (10 veces)`;
  }
  if (step.decade > 0) {
    return `Decena ${step.decade} de 5`;
  }
  return step.area === "oración final" ? "Oraciones finales" : "Inicio del Rosario";
}

function renderRosaryVisual() {
  const beads = getRosaryBeads();
  const completedCount = steps
    .slice(0, state.stepIndex)
    .reduce((total, step) => total + step.beadCount, 0);
  const currentCount = steps[state.stepIndex]?.beadCount || 0;
  const total = beads.length;

  nodes.rosaryBeads.innerHTML = "";
  const svg = createSvgElement("svg");
  svg.setAttribute("class", "rosary-svg");
  svg.setAttribute("viewBox", "0 0 940 190");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Rosario visual con cuentas que se colorean al avanzar");

  beads.forEach((bead, index) => {
    const status = index < completedCount ? "completed" : index < completedCount + currentCount ? "current" : "pending";
    if (index === 0) {
      svg.append(createCrossNode(165, 95, status, bead.label));
      return;
    }

    const point = getRosaryPoint(index - 1, total - 1);
    const circle = createSvgElement("circle");
    circle.setAttribute("class", `bead-node ${bead.kind} ${status}`);
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", bead.kind === "large" ? "11" : "7");
    circle.append(createSvgTitle(`${bead.label}: ${getBeadStatusLabel(status)}`));
    svg.append(circle);
  });

  nodes.rosaryBeads.append(svg);
}

function getRosaryPoint(index, total) {
  const points = getEvenEllipsePoints(total);
  return points[index];
}

function getEvenEllipsePoints(total) {
  const centerX = 540;
  const centerY = 95;
  const radiusX = 330;
  const radiusY = 68;
  const samples = 960;
  const startAngle = Math.PI;
  const sampled = [];
  let length = 0;

  for (let step = 0; step <= samples; step += 1) {
    const angle = startAngle + (Math.PI * 2 * step) / samples;
    const point = {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
      length
    };
    if (sampled.length > 0) {
      const previous = sampled[sampled.length - 1];
      length += Math.hypot(point.x - previous.x, point.y - previous.y);
      point.length = length;
    }
    sampled.push(point);
  }

  return Array.from({ length: total }, (_, index) => {
    const target = (length * index) / total;
    const point = sampled.find((candidate) => candidate.length >= target) || sampled[sampled.length - 1];
    return {
      x: Number(point.x.toFixed(1)),
      y: Number(point.y.toFixed(1))
    };
  });
}

function createCrossNode(x, y, status, label) {
  const group = createSvgElement("g");
  group.setAttribute("class", `cross-node ${status}`);
  group.append(createSvgTitle(`${label}: ${getBeadStatusLabel(status)}`));

  const vertical = createSvgElement("rect");
  vertical.setAttribute("x", x - 8);
  vertical.setAttribute("y", y - 42);
  vertical.setAttribute("width", "16");
  vertical.setAttribute("height", "84");
  vertical.setAttribute("rx", "4");

  const horizontal = createSvgElement("rect");
  horizontal.setAttribute("x", x - 28);
  horizontal.setAttribute("y", y - 13);
  horizontal.setAttribute("width", "56");
  horizontal.setAttribute("height", "16");
  horizontal.setAttribute("rx", "4");

  group.append(vertical, horizontal);
  return group;
}

function createSvgElement(name) {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}

function createSvgTitle(text) {
  const title = createSvgElement("title");
  title.textContent = text;
  return title;
}

function getRosaryBeads() {
  const beads = [];
  steps.forEach((step) => {
    if (step.prayerKey === "fatima") return;
    for (let index = 0; index < step.beadCount; index += 1) {
      beads.push({
        kind: step.beadKind,
        label: getBeadLabel(step, index),
        separator: step.beadKind === "large" || step.beadKind === "cross"
      });
    }
  });
  return beads;
}

function getBeadLabel(step, index) {
  if (step.beadCount > 1) {
    return `${step.title}, cuenta ${index + 1} de ${step.beadCount}`;
  }
  return step.title;
}

function getBeadStatusLabel(status) {
  if (status === "completed") return "completada";
  if (status === "current") return "actual";
  return "pendiente";
}

function openPrayerModal(prayerKey) {
  const prayer = data.prayers[prayerKey];
  if (!prayer) return;
  nodes.modalTitle.textContent = prayer.title;
  nodes.modalPrayerText.textContent = prayer.text;
  nodes.prayerModal.hidden = false;
  nodes.closeModalBtn.focus();
}

function closePrayerModal() {
  nodes.prayerModal.hidden = true;
}

function renderToday() {
  const set = data.mysterySets[getTodaySetKey()];
  nodes.todayMystery.textContent = set.name;
  nodes.todayMysteryDays.textContent = set.days;
}

function renderMysteryChooser() {
  nodes.mysteryGrid.innerHTML = "";
  Object.entries(data.mysterySets).forEach(([key, set]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mystery-option";
    button.innerHTML = `<strong>${set.name}</strong><span>${set.days}</span>`;
    button.addEventListener("click", () => startRosary(key));
    nodes.mysteryGrid.append(button);
  });
}

function showView(view) {
  nodes.homeView.hidden = view !== "home";
  nodes.chooserView.hidden = view !== "chooser";
  nodes.guideView.hidden = view !== "guide";
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  nodes.continueBtn.disabled = false;
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !data.mysterySets[saved.mysteryKey]) return null;
    return saved;
  } catch (error) {
    return null;
  }
}

async function shareRosary() {
  const url = window.location.href.split("#")[0];
  const text = `Te comparto el Santo Rosario de hoy para rezarlo paso a paso: ${url}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Rosario Paso a Paso", text, url });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

function openDonation() {
  if (!WOMPI_DONATION_URL || WOMPI_DONATION_URL.includes("PEGAR_AQUI")) {
    showToast("Muy pronto podrás apoyar este proyecto con una donación voluntaria.");
    return;
  }
  window.open(WOMPI_DONATION_URL, "_blank", "noopener,noreferrer");
}

async function loadVisits() {
  const cached = localStorage.getItem(VISITS_KEY);
  nodes.visitorCount.textContent = cached || "--";
  if (!navigator.onLine || !VISITS_API_URL || VISITS_API_URL.includes("PEGAR_AQUI")) return;
  try {
    const response = await fetch(VISITS_API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo consultar el contador.");
    const payload = await response.json();
    const visits = payload.visits || payload.count || payload.total;
    if (Number.isFinite(Number(visits))) {
      localStorage.setItem(VISITS_KEY, String(visits));
      nodes.visitorCount.textContent = String(visits);
    }
  } catch (error) {
    nodes.visitorCount.textContent = cached || "--";
  }
}

function updateOnlineNotice() {
  nodes.offlineNote.hidden = navigator.onLine;
}

function showToast(message) {
  nodes.toast.textContent = message;
  nodes.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    nodes.toast.hidden = true;
  }, 3800);
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  nodes.themeToggle.querySelector("span").textContent = theme === "dark" ? "☀" : "☾";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      showToast("No se pudo preparar el modo sin conexion en este navegador.");
    });
  });
}
