const API_URL =
  "localhost" === window.location.hostname ||
    "127.0.0.1" === window.location.hostname ||
    "file:" === window.location.protocol
    ? "http://localhost:3000"
    : "https://camino2.onrender.com",
  SESSION_SIZE = 20,
  MAX_ERRORS_MARATHON = 3,
  MAX_TIME_SECONDS = 500,
  CHRONO_DURATION = 60,
  HIGHLIGHT_DURATION_MS = 5e3,
  MAX_POINTS_PER_ITEM = 10,
  LEADERBOARD_VISIBLE_ROWS = 3,
  MAX_LECTURE_SEARCH_RESULTS = 8;
const UI_THEME = {
  mapStreet: "#f2a900",
  mapStreetHover: "#f8c870",
  mapCorrect: "#1f9d66",
  mapWrong: "#d2463c",
  mapQuartier: "#12297a",
  mapMonumentStroke: "#dfe6ff",
  mapMonumentFill: "#4057b2",
  timerSafe: "#1f9d66",
  timerWarn: "#e08a00",
  timerDanger: "#d2463c",
};
const ONBOARDING_SEEN_KEY = "camino-onboarding-seen";
const ONBOARDING_LEGACY_KEY = "camino-onboarded";
const ONBOARDING_COOKIE_MAX_AGE_SECONDS = 31536000;

function readPersistentFlag(flagKey) {
  try {
    if ("1" === localStorage.getItem(flagKey)) return !0;
  } catch (e) { }
  try {
    return document.cookie
      .split(";")
      .map((e) => e.trim())
      .some((e) => e === `${flagKey}=1`);
  } catch (e) {
    return !1;
  }
}

function writePersistentFlag(flagKey) {
  try {
    localStorage.setItem(flagKey, "1");
  } catch (e) { }
  try {
    document.cookie = `${flagKey}=1; path=/; max-age=${ONBOARDING_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch (e) { }
}

function hasSeenOnboarding() {
  return (
    readPersistentFlag(ONBOARDING_SEEN_KEY) ||
    readPersistentFlag(ONBOARDING_LEGACY_KEY)
  );
}

function markOnboardingSeen() {
  (writePersistentFlag(ONBOARDING_SEEN_KEY),
    writePersistentFlag(ONBOARDING_LEGACY_KEY));
}

function setOnboardingVisibility(showBanner) {
  const banner = document.getElementById("onboarding-banner");
  if (!banner) return;
  showBanner
    ? (banner.classList.remove("hidden"), (banner.style.display = "flex"))
    : (banner.classList.add("hidden"), (banner.style.display = "none"));
}

function initOnboardingBanner() {
  const closeButton = document.getElementById("onboarding-close");
  closeButton &&
    !closeButton.__onboardingBound &&
    ((closeButton.__onboardingBound = !0),
      closeButton.addEventListener("click", () => {
        (markOnboardingSeen(), setOnboardingVisibility(!1));
      }));
  if (hasSeenOnboarding()) return void setOnboardingVisibility(!1);
  (markOnboardingSeen(), setOnboardingVisibility(!0));
}

let soundEnabled = "off" !== localStorage.getItem("camino-sound"),
  audioCtx = null;
function getAudioCtx() {
  return (
    audioCtx ||
    (audioCtx = new (window.AudioContext || window.webkitAudioContext)()),
    "suspended" === audioCtx.state && audioCtx.resume(),
    audioCtx
  );
}
function playTone(e, t, r, a, n) {
  if (soundEnabled)
    try {
      const s = getAudioCtx(),
        i = s.createOscillator(),
        l = s.createGain();
      ((i.type = r || "sine"),
        (i.frequency.value = e),
        l.gain.setValueAtTime(a || 0.15, s.currentTime + (n || 0)),
        l.gain.exponentialRampToValueAtTime(
          0.001,
          s.currentTime + (n || 0) + t,
        ),
        i.connect(l),
        l.connect(s.destination),
        i.start(s.currentTime + (n || 0)),
        i.stop(s.currentTime + (n || 0) + t));
    } catch (e) { }
}
function playDing() {
  (playTone(880, 0.15, "sine", 0.12, 0), playTone(1320, 0.2, "sine", 0.1, 0.1));
}
function playBuzz() {
  (playTone(150, 0.25, "sawtooth", 0.08, 0),
    playTone(120, 0.3, "square", 0.05, 0.05));
}
function playVictory() {
  (playTone(523, 0.15, "sine", 0.12, 0),
    playTone(659, 0.15, "sine", 0.12, 0.15),
    playTone(784, 0.15, "sine", 0.12, 0.3),
    playTone(1047, 0.3, "triangle", 0.1, 0.45));
}
function playTick() {
  playTone(1e3, 0.03, "square", 0.04, 0);
}
function toggleSound() {
  ((soundEnabled = !soundEnabled),
    localStorage.setItem("camino-sound", soundEnabled ? "on" : "off"));
  const e = document.getElementById("sound-toggle");
  (e && (e.textContent = soundEnabled ? "🔊" : "🔇"),
    soundEnabled && playDing());
  triggerHaptic('click');
}
let FAMOUS_STREET_INFOS = {};
let MAIN_STREET_INFOS = {};

async function loadStreetInfos() {
  try {
    const response = await fetch('data/street_infos.json?v=' + Date.now());
    const data = await response.json();
    FAMOUS_STREET_INFOS = data.famous || {};
    MAIN_STREET_INFOS = data.main || {};
    console.log('Street infos loaded');
  } catch (error) {
    console.error('Failed to load street infos', error);
  }
}
function normalizeName(e) {
  return (e || "").trim().toLowerCase();
}
function normalizeSearchText(e) {
  return normalizeName(e).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
let map = null,
  currentZoneMode = "ville",
  streetsLayer = null,
  allStreetFeatures = [],
  streetLayersById = new Map(),
  streetLayersByName = new Map(),
  monumentsLayer = null,
  allMonuments = [],
  sessionMonuments = [],
  currentMonumentIndex = 0,
  currentMonumentTarget = null,
  isMonumentsMode = !1,
  quartierPolygonsByName = new Map(),
  quartierOverlay = null;
function normalizeQuartierKey(e) {
  if (!e) return "";
  let t = e.trim();
  const r = t.match(/^(.+)\s+\((L'|L’|La|Le|Les)\)$/i);
  if (r) {
    let e = r[1].trim(),
      a = r[2].trim();
    ((a = /^l[’']/i.test(a)
      ? "L'"
      : a.charAt(0).toUpperCase() + a.slice(1).toLowerCase()),
      (t = `${a} ${e}`));
  }
  return (
    (t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
    (t = t.replace(/\s+/g, " ").toLowerCase()),
    t
  );
}
let arrondissementByQuartier = new Map();
Object.entries(ARRONDISSEMENT_PAR_QUARTIER).forEach(([e, t]) => {
  arrondissementByQuartier.set(normalizeQuartierKey(e), t);
});
let sessionStreets = [],
  currentIndex = 0,
  currentTarget = null,
  isSessionRunning = !1,
  sessionStartTime = null,
  streetStartTime = null,
  isPaused = !1,
  pauseStartTime = null,
  remainingChronoMs = null,
  isChronoMode = !1,
  chronoEndTime = null,
  correctCount = 0,
  totalAnswered = 0,
  summaryData = [],
  weightedScore = 0,
  errorsCount = 0,
  highlightTimeoutId = null,
  highlightedLayers = [],
  messageTimeoutId = null,
  currentUser = null,
  isLectureMode = !1,
  hasAnsweredCurrentItem = !1,
  lectureStreetSearchIndex = [],
  lectureStreetSearchMatches = [];
function getSessionScoreValue(e = getGameMode()) {
  return "classique" === e ? weightedScore : correctCount;
}
function getCurrentSessionPoolSize() {
  return "monuments" === getZoneMode() ? sessionMonuments.length : sessionStreets.length;
}
function getScoreMetricUIConfig(e = getGameMode()) {
  if ("marathon" === e)
    return {
      label: "Rues trouvées",
      legend: "Score = nombre de rues trouvées (objectif: aller le plus loin possible).",
      help:
        "<strong>Rues trouvées (Marathon)</strong><br>Le score correspond au nombre de rues trouvées avant la limite d'erreurs.<br><br>Le maximum dépend de la zone sélectionnée.",
      decimals: 0,
    };
  if ("chrono" === e)
    return {
      label: "Rues trouvées",
      legend: "Score = nombre de rues trouvées en 60 secondes.",
      help:
        "<strong>Rues trouvées (Chrono)</strong><br>Le score correspond au nombre de rues trouvées dans le temps imparti (60 s).",
      decimals: 0,
    };
  return {
    label: "Score pondéré",
    legend: "Chaque bonne réponse: jusqu'à 10 points selon la rapidité.",
    help:
      "<strong>Score pondéré</strong><br>Chaque bonne réponse rapporte jusqu'à 10 points selon la rapidité: 1 point en moins par seconde.<br>Au-delà de 10 secondes, aucun point.<br><br>Le score affiché est la somme des points de la session.",
    decimals: 1,
  };
}
function updateScoreMetricUI() {
  const e = getScoreMetricUIConfig(),
    t = document.getElementById("weighted-score-label"),
    r = document.getElementById("weighted-score-legend"),
    a = document.getElementById("weighted-score-help"),
    n = document.getElementById("weighted-score-help-btn");
  t && (t.textContent = e.label);
  r && (r.textContent = e.legend);
  a && (a.innerHTML = e.help);
  n &&
    n.setAttribute(
      "aria-label",
      "classique" === getGameMode()
        ? "Information sur le score pondéré"
        : "Information sur le score",
    );
}
function setMapStatus(e, t) {
  const r = document.getElementById("map-status");
  r &&
    ((r.textContent = e),
      (r.className = "map-status-pill"),
      "loading" === t
        ? r.classList.add("map-status--loading")
        : "ready" === t
          ? r.classList.add("map-status--ready")
          : "error" === t && r.classList.add("map-status--error"));
}
const IS_TOUCH_DEVICE =
  "ontouchstart" in window || navigator.maxTouchPoints > 0;
const PULL_TO_REFRESH_THRESHOLD_PX = 92;
const PULL_TO_REFRESH_TOP_ZONE_PX = 96;
const PULL_TO_REFRESH_TOP_ZONE_STANDALONE_PX = 220;
let isPullToRefreshBound = !1;

function isStandaloneDisplayMode() {
  if (window.navigator.standalone === !0) return !0;
  if ("function" != typeof window.matchMedia) return !1;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

function getPullToRefreshTopZonePx() {
  return isStandaloneDisplayMode()
    ? PULL_TO_REFRESH_TOP_ZONE_STANDALONE_PX
    : PULL_TO_REFRESH_TOP_ZONE_PX;
}

function getScrollableAncestor(e) {
  let t = e instanceof Element ? e : null;
  for (; t && t !== document.body;) {
    const e = window.getComputedStyle(t),
      r = /(auto|scroll)/.test(e.overflowY),
      a = t.scrollHeight - t.clientHeight > 2;
    if (r && a) return t;
    t = t.parentElement;
  }
  return null;
}

function canStartPullToRefresh(e, t) {
  if (t > getPullToRefreshTopZonePx()) return !1;
  const r =
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0;
  if (r > 2) return !1;
  const a = getScrollableAncestor(e);
  return !(a && a.scrollTop > 0);
}

function initMobilePullToRefresh() {
  if (!IS_TOUCH_DEVICE || isPullToRefreshBound) return;
  isPullToRefreshBound = !0;
  let e = {
    active: !1,
    eligible: !1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    maxPull: 0,
    reloaded: !1,
  };
  const t = () => {
    e = {
      active: !1,
      eligible: !1,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      maxPull: 0,
      reloaded: !1,
    };
  };
  document.addEventListener(
    "touchstart",
    (r) => {
      if (1 !== r.touches.length) return void t();
      const a = r.touches[0],
        n = canStartPullToRefresh(r.target, a.clientY);
      e = {
        active: !0,
        eligible: n,
        startX: a.clientX,
        startY: a.clientY,
        lastX: a.clientX,
        lastY: a.clientY,
        maxPull: 0,
        reloaded: !1,
      };
    },
    { passive: !0, capture: !0 },
  );
  document.addEventListener(
    "touchmove",
    (t) => {
      if (!e.active || !e.eligible || e.reloaded || 1 !== t.touches.length) return;
      const r = t.touches[0],
        a = r.clientY - e.startY,
        n = r.clientX - e.startX;
      ((e.lastX = r.clientX), (e.lastY = r.clientY));
      if (a < -12) return void (e.eligible = !1);
      if (Math.abs(n) > Math.max(24, 1.25 * Math.abs(a)))
        return void (e.eligible = !1);
      a > e.maxPull && (e.maxPull = a);
    },
    { passive: !0, capture: !0 },
  );
  const r = (n) => {
    if (n.changedTouches && 1 === n.changedTouches.length) {
      const t = n.changedTouches[0];
      ((e.lastX = t.clientX), (e.lastY = t.clientY));
    }
    if (!e.active || !e.eligible || e.reloaded) return void t();
    const a = Math.max(e.maxPull, e.lastY - e.startY),
      s = Math.abs(e.lastX - e.startX);
    if (a >= PULL_TO_REFRESH_THRESHOLD_PX && a > 1.35 * s) {
      ((e.reloaded = !0),
        showMessage("Rafraîchissement...", "info"),
        triggerHaptic('click'),
        setTimeout(() => window.location.reload(), 40));
      return;
    }
    t();
  };
  (document.addEventListener("touchend", r, { passive: !0, capture: !0 }),
    document.addEventListener("touchcancel", t, { passive: !0, capture: !0 }));
}

function getSelectedQuartier() {
  const e = document.getElementById("quartier-select");
  if (!e) return null;
  const t = e.value;
  return t && "" !== t.trim() ? t.trim() : null;
}
function getZoneMode() {
  return currentZoneMode;
}
function updateModeDifficultyPill() {
  const e = document.getElementById("mode-select"),
    t = document.getElementById("mode-difficulty-pill");
  if (!e || !t) return;
  const r = e.value;
  (t.classList.remove(
    "difficulty-pill--easy",
    "difficulty-pill--medium",
    "difficulty-pill--hard",
  ),
    "rues-principales" === r
      ? ((t.textContent = "Facile"), t.classList.add("difficulty-pill--easy"))
      : "quartier" === r || "monuments" === r
        ? ((t.textContent = "Faisable"),
          t.classList.add("difficulty-pill--medium"))
        : "rues-celebres" === r
          ? ((t.textContent = "Très Facile"),
            t.classList.add("difficulty-pill--easy"))
          : "ville" === r
            ? ((t.textContent = "Difficile"),
              t.classList.add("difficulty-pill--hard"))
            : (t.textContent = ""));
}
function updateTargetPanelTitle() {
  const e =
    document.getElementById("target-panel-title") ||
    document.querySelector(".target-panel .panel-title");
  if (!e) return;
  const t = getZoneMode();
  isLectureMode
    ? (e.textContent = "monuments" === t ? "Monument à explorer" : "Recherche de rue")
    : (e.textContent = "monuments" === t ? "Monument à trouver" : "Rue à trouver");
}
function getGameMode() {
  const e = document.getElementById("game-mode-select");
  return e ? e.value : "classique";
}
function updateGameModeControls() {
  const e = document.getElementById("game-mode-select"),
    t = document.getElementById("restart-btn"),
    r = document.getElementById("pause-btn");
  e &&
    t &&
    r &&
    ("lecture" === e.value
      ? ((t.style.display = "none"), (r.style.display = "none"))
      : (t.style.display = ""),
      updateScoreMetricUI(),
      updateWeightedScoreUI(),
      updateSessionProgressBar(),
      refreshLectureStreetSearchForCurrentMode({ preserveQuery: !0 }));
}
function getLectureSearchElements() {
  return {
    container: document.getElementById("lecture-search"),
    input: document.getElementById("lecture-search-input"),
    results: document.getElementById("lecture-search-results"),
    target: document.getElementById("target-street"),
  };
}
function closeLectureStreetSearchResults() {
  const { results } = getLectureSearchElements();
  results && (results.innerHTML = "", results.classList.add("hidden"));
  lectureStreetSearchMatches = [];
}
function setLectureStreetSearchVisible(e, t = !1) {
  const { container, input, target } = getLectureSearchElements();
  if (!container || !target) return;
  if (e) {
    target.classList.add("hidden");
    container.classList.remove("hidden");
    return;
  }
  (container.classList.add("hidden"),
    target.classList.remove("hidden"),
    closeLectureStreetSearchResults(),
    input &&
    !0 !== t &&
    ((input.value = ""), input.blur()));
}
function buildLectureStreetSearchIndex() {
  if ("monuments" === getZoneMode())
    return void (lectureStreetSearchIndex = []);
  const e = buildUniqueStreetList(getCurrentZoneStreets()),
    t = new Set();
  lectureStreetSearchIndex = e
    .map((e) =>
      "string" == typeof e?.properties?.name ? e.properties.name.trim() : "",
    )
    .filter((e) => !!e)
    .filter((e) => {
      const r = normalizeSearchText(e);
      return !!r && (!t.has(r) && (t.add(r), !0));
    })
    .map((e) => {
      const t = normalizeSearchText(e);
      return {
        name: e,
        normalized: t,
        words: t.split(/[\s'’-]+/).filter(Boolean),
      };
    })
    .sort((e, t) => e.name.localeCompare(t.name, "fr", { sensitivity: "base" }));
}
function getLectureStreetMatchScore(e, t) {
  return e.normalized === t
    ? 0
    : e.normalized.startsWith(t)
      ? 1
      : e.words.some((e) => e.startsWith(t))
        ? 2
        : 3;
}
function findLectureStreetMatches(e) {
  const t = normalizeSearchText(e);
  if (!t) return [];
  return lectureStreetSearchIndex
    .filter((e) => e.normalized.includes(t))
    .sort((e, r) => {
      const a = getLectureStreetMatchScore(e, t),
        n = getLectureStreetMatchScore(r, t);
      return a - n || e.name.localeCompare(r.name, "fr", { sensitivity: "base" });
    })
    .slice(0, MAX_LECTURE_SEARCH_RESULTS);
}
function renderLectureStreetSearchResults(e) {
  const { results } = getLectureSearchElements();
  if (!results) return;
  if (!e || 0 === e.length) {
    const e = document.createElement("div");
    return (
      (e.className = "lecture-search-empty"),
      (e.textContent = "Aucune rue trouvée."),
      (results.innerHTML = ""),
      results.appendChild(e),
      void results.classList.remove("hidden")
    );
  }
  (results.innerHTML = "",
    e.forEach((e) => {
      const t = document.createElement("button");
      ((t.type = "button"),
        (t.className = "lecture-search-result"),
        (t.textContent = e.name),
        t.addEventListener("click", () => {
          focusLectureStreetBySearchName(e.name);
        }),
        results.appendChild(t));
    }),
    results.classList.remove("hidden"));
}
function focusLectureStreetBySearchName(e) {
  if (!e) return;
  const t = focusStreetByName(e);
  if (!t) return void showMessage("Rue introuvable dans la zone actuelle.", "error");
  const { input } = getLectureSearchElements();
  (input && (input.value = e), closeLectureStreetSearchResults());
}
function updateLectureStreetSearchResults() {
  const { input } = getLectureSearchElements();
  if (!input) return;
  const e = input.value.trim();
  return e
    ? (lectureStreetSearchMatches = findLectureStreetMatches(e),
      void renderLectureStreetSearchResults(lectureStreetSearchMatches))
    : void closeLectureStreetSearchResults();
}
function refreshLectureStreetSearchForCurrentMode(e = {}) {
  const t = !0 === e.preserveQuery,
    r = isLectureMode && "monuments" !== getZoneMode(),
    { input } = getLectureSearchElements();
  if (!r)
    return void setLectureStreetSearchVisible(!1, t);
  (setLectureStreetSearchVisible(!0, t),
    buildLectureStreetSearchIndex(),
    input &&
    ((input.disabled = 0 === lectureStreetSearchIndex.length),
      (input.placeholder =
        0 === lectureStreetSearchIndex.length
          ? "Aucune rue disponible pour cette zone"
          : "Rechercher une rue (nom ou mot)"),
      t && input.value.trim() && lectureStreetSearchIndex.length > 0
        ? updateLectureStreetSearchResults()
        : closeLectureStreetSearchResults()));
}
function initLectureStreetSearch() {
  const { container, input } = getLectureSearchElements();
  if (!container || !input || input.__lectureSearchBound) return;
  ((input.__lectureSearchBound = !0),
    input.addEventListener("input", () => {
      updateLectureStreetSearchResults();
    }),
    input.addEventListener("focus", () => {
      input.value.trim() && updateLectureStreetSearchResults();
    }),
    input.addEventListener("keydown", (e) => {
      if ("Escape" === e.key) {
        closeLectureStreetSearchResults();
        return;
      }
      if ("Enter" === e.key) {
        e.preventDefault();
        const t = input.value.trim();
        if (!t) return;
        if (0 === lectureStreetSearchIndex.length)
          return void showMessage("Aucune rue disponible pour cette zone.", "warning");
        0 === lectureStreetSearchMatches.length &&
          (lectureStreetSearchMatches = findLectureStreetMatches(t));
        const r =
          lectureStreetSearchMatches[0] ||
          lectureStreetSearchIndex.find((e) => e.normalized === normalizeSearchText(t));
        r
          ? focusLectureStreetBySearchName(r.name)
          : showMessage("Rue introuvable dans la zone actuelle.", "error");
      }
    }),
    document.addEventListener("click", (e) => {
      container.contains(e.target) || closeLectureStreetSearchResults();
    }));
}
function updateStreetInfoPanelVisibility() {
  const e = document.getElementById("street-info-panel"),
    t = document.getElementById("street-info");
  if (!e || !t) return;
  const r = getZoneMode();
  updateStreetInfoPanelTitle(r);
  "rues-principales" === r || "main" === r
    ? (e.style.display = "block")
    : ((e.style.display = "none"),
      e.classList.remove("is-visible"),
      (t.textContent = ""),
      t.classList.remove("is-visible"));
}
function getStreetInfoPanelTitle(e = getZoneMode()) {
  return "rues-celebres" === e || "famous" === e
    ? "Infos rues célèbres"
    : "Infos rues principales";
}
function updateStreetInfoPanelTitle(e = getZoneMode()) {
  const t = document.getElementById("street-info-title");
  t && (t.textContent = getStreetInfoPanelTitle(e));
}
function initMap() {
  if (
    ((map = L.map("map", {
      tap: !0,
      tapTolerance: IS_TOUCH_DEVICE ? 25 : 15,
      doubleTapZoom: !0,
      renderer: L.canvas({ padding: 0.5 }),
    }).setView([43.2965, 5.37], 13)),
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles © Esri" },
      ).addTo(map),
      void 0 !== L.Control.MiniMap)
  ) {
    const e = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19, attribution: "© CartoDB" },
    );
    new L.Control.MiniMap(e, {
      position: "bottomright",
      toggleDisplay: !0,
      minimized: IS_TOUCH_DEVICE,
      width: IS_TOUCH_DEVICE ? 100 : 150,
      height: IS_TOUCH_DEVICE ? 100 : 150,
      zoomLevelOffset: -5,
      zoomLevelFixed: !1,
      collapsedWidth: 24,
      collapsedHeight: 24,
    }).addTo(map);
  }
}
function initUI() {
  (IS_TOUCH_DEVICE && document.body.classList.add("touch-mode"),
    initMobilePullToRefresh());
  const e = document.getElementById("restart-btn"),
    t = document.getElementById("mode-select"),
    r = document.getElementById("quartier-block"),
    a = document.getElementById("quartier-select"),
    n = document.getElementById("skip-btn"),
    s = document.getElementById("pause-btn"),
    i = document.getElementById("quartier-select-button"),
    l = document.getElementById("quartier-select-list"),
    o =
      (i && i.querySelector(".custom-select-label"),
        document.getElementById("login-btn")),
    u = document.getElementById("register-btn"),
    d = document.getElementById("logout-btn"),
    c = document.getElementById("auth-username"),
    m = document.getElementById("auth-password");
  (t && (currentZoneMode = t.value), updateModeDifficultyPill());
  const p = document.getElementById("mode-select-button"),
    g = document.getElementById("mode-select-list"),
    h = p ? p.querySelector(".custom-select-label") : null;
  p &&
    g &&
    (p.addEventListener("click", (e) => {
      (e.stopPropagation(), g.classList.toggle("visible"));
    }),
      g.querySelectorAll("li").forEach((e) => {
        e.addEventListener("click", () => {
          const r = e.dataset.value;
          h && (h.textContent = e.childNodes[0].textContent.trim());
          const a = e.querySelector(".difficulty-pill"),
            n = p.querySelector(".difficulty-pill");
          if (a) {
            const e = a.cloneNode(!0);
            n ? n.replaceWith(e) : p.appendChild(e);
          }
          (t && ((t.value = r), t.dispatchEvent(new Event("change"))),
            g.classList.remove("visible"));
        });
      }));
  const y = document.getElementById("game-mode-select-button"),
    v = document.getElementById("game-mode-select-list"),
    f = y ? y.querySelector(".custom-select-label") : null,
    b = document.getElementById("game-mode-select");
  (y &&
    v &&
    b &&
    (y.addEventListener("click", (e) => {
      (e.stopPropagation(), v.classList.toggle("visible"));
    }),
      v.querySelectorAll("li").forEach((e) => {
        e.addEventListener("click", () => {
          const t = e.dataset.value;
          f && (f.textContent = e.childNodes[0].textContent.trim());
          const r = e.querySelector(".difficulty-pill");
          if (r) {
            const e = r.cloneNode(!0),
              t = y.querySelector(".difficulty-pill");
            t ? t.replaceWith(e) : y.appendChild(e);
          }
          ((b.value = t),
            isSessionRunning && endSession(),
            "lecture" !== t &&
            isLectureMode &&
            ((isLectureMode = !1),
              setLectureTooltipsEnabled(!1),
              refreshLectureStreetSearchForCurrentMode(),
              updateTargetPanelTitle(),
              updateLayoutSessionState()),
            updateGameModeControls(),
            (v.scrollTop = 0),
            v.classList.remove("visible"),
            "lecture" === t && requestAnimationFrame(() => startNewSession()));
        });
      })),
    i &&
    l &&
    i.addEventListener("click", (e) => {
      (e.stopPropagation(), l.classList.toggle("visible"));
    }),
    document.addEventListener("click", (e) => {
      (p &&
        g &&
        !p.contains(e.target) &&
        !g.contains(e.target) &&
        g.classList.remove("visible"),
        y &&
        v &&
        !y.contains(e.target) &&
        !v.contains(e.target) &&
        v.classList.remove("visible"),
        i &&
        l &&
        !i.contains(e.target) &&
        !l.contains(e.target) &&
        l.classList.remove("visible"));
    }),
    (currentUser = loadCurrentUserFromStorage()),
    updateUserUI(),
    initLectureStreetSearch());
  const S = document.getElementById("sound-toggle");
  (S && (S.textContent = soundEnabled ? "🔊" : "🔇"), initOnboardingBanner());
  function L(e) {
    const t = document.getElementById("offline-banner");
    t && (t.style.display = e ? "block" : "none");
  }
  (!(function () {
    const e = document.createElement("div");
    ((e.className = "tooltip-popup"),
      document.body.appendChild(e),
      document.querySelectorAll(".tooltip-icon[data-tooltip]").forEach((t) => {
        (t.addEventListener("mouseenter", () => {
          const r = t.getAttribute("data-tooltip");
          if (!r) return;
          e.textContent = r;
          const a = t.getBoundingClientRect();
          ((e.style.top = a.top - e.offsetHeight - 8 + "px"),
            (e.style.left = a.left + "px"),
            e.classList.add("visible"));
        }),
          t.addEventListener("mouseleave", () => {
            e.classList.remove("visible");
          }));
      }));
  })(),
    window.addEventListener("offline", () => L(!0)),
    window.addEventListener("online", () => {
      fetch(API_URL + "/api/leaderboards", { method: "HEAD" })
        .then(() => L(!1))
        .catch(() => L(!0));
    }),
    navigator.onLine
      ? fetch(API_URL + "/api/leaderboards", { method: "HEAD" }).catch(() =>
        L(!0),
      )
      : L(!0),
    e &&
    e.addEventListener("click", () => {
      isSessionRunning ? stopSessionManually() : startNewSession();
    }),
    updateTargetPanelTitle(),
    s &&
    s.addEventListener("click", () => {
      isSessionRunning && togglePause();
    }));
  const M = document.getElementById("daily-mode-btn");
  (M && M.addEventListener("click", handleDailyModeClick),
    n &&
    n.addEventListener("click", () => {
      if (isSessionRunning && !isPaused) {
        if ("monuments" === getZoneMode()) {
          if (!currentMonumentTarget) return;
          return (
            summaryData.push({
              name: currentMonumentTarget.properties.name,
              correct: !1,
              time: 0,
            }),
            (totalAnswered += 1),
            updateScoreUI(),
            (currentMonumentIndex += 1),
            void setNewTarget()
          );
        }
        currentTarget &&
          (summaryData.push({
            name: currentTarget.properties.name,
            correct: !1,
            time: 0,
          }),
            (totalAnswered += 1),
            updateScoreUI(),
            (currentIndex += 1),
            setNewTarget());
      }
    }),
    t &&
    t.addEventListener("change", () => {
      currentZoneMode = t.value;
      const e = currentZoneMode;
      (updateTargetPanelTitle(),
        updateModeDifficultyPill(),
        streetsLayer &&
        streetLayersById.size &&
        streetLayersById.forEach((e) => {
          const t = getBaseStreetStyle(e),
            r = t.weight > 0;
          (e.setStyle({ color: t.color, weight: t.weight }),
            (e.options.interactive = r),
            e.touchBuffer && (e.touchBuffer.options.interactive = r));
        }),
        "quartier" === e
          ? ((r.style.display = "block"),
            a && a.value && highlightQuartier(a.value))
          : ((r.style.display = "none"), clearQuartierOverlay()),
        "monuments" === e
          ? (streetsLayer &&
            map.hasLayer(streetsLayer) &&
            map.removeLayer(streetsLayer),
            monumentsLayer &&
            !map.hasLayer(monumentsLayer) &&
            monumentsLayer.addTo(map))
          : (monumentsLayer &&
            map.hasLayer(monumentsLayer) &&
            map.removeLayer(monumentsLayer),
            streetsLayer &&
            !map.hasLayer(streetsLayer) &&
            streetsLayer.addTo(map)),
        updateStreetInfoPanelVisibility(),
        refreshLectureTooltipsIfNeeded(),
        isLectureMode &&
        refreshLectureStreetSearchForCurrentMode({ preserveQuery: !0 }));
      const n = document.getElementById("street-info");
      n &&
        ("rues-principales" === e ||
          "main" === e ||
          ((n.textContent = ""), (n.style.display = "none")));
    }),
    a &&
    a.addEventListener("change", () => {
      ("quartier" === getZoneMode() && a.value
        ? highlightQuartier(a.value)
        : clearQuartierOverlay(),
        streetsLayer &&
        streetLayersById.size &&
        streetLayersById.forEach((e) => {
          const t = getBaseStreetStyle(e),
            r = t.weight > 0;
          (e.setStyle({ color: t.color, weight: t.weight }),
            (e.options.interactive = r),
            e.touchBuffer && (e.touchBuffer.options.interactive = r));
        }),
        isLectureMode &&
        refreshLectureStreetSearchForCurrentMode({ preserveQuery: !0 }));
    }));
  const T = document.getElementById("auth-feedback");
  function E(e, t) {
    T && ((T.textContent = e), (T.className = "auth-feedback " + (t || "")));
  }
  const C = document.getElementById("toggle-password");
  (C &&
    m &&
    C.addEventListener("click", () => {
      const e = "password" === m.type;
      ((m.type = e ? "text" : "password"), (C.textContent = e ? "🙈" : "👁"));
    }),
    o &&
    o.addEventListener("click", async () => {
      E("", "");
      const e = (c?.value || "").trim(),
        t = m?.value || "";
      if (e && t)
        try {
          const r = await fetch(API_URL + "/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: e, password: t }),
          }),
            a = await r.json();
          if (!r.ok)
            return void (401 === r.status
              ? E("Identifiants incorrects.", "error")
              : E(a.error || "Erreur de connexion.", "error"));
          ((currentUser = { id: a.id, username: a.username, token: a.token }),
            saveCurrentUserToStorage(currentUser),
            updateUserUI(),
            E("Connexion réussie !", "success"));
        } catch (e) {
          (console.error("Erreur login :", e),
            E("Serveur injoignable.", "error"));
        }
      else E("Pseudo et mot de passe requis.", "error");
    }),
    u &&
    u.addEventListener("click", async () => {
      E("", "");
      const e = (c?.value || "").trim(),
        t = m?.value || "";
      if (e && t)
        if (t.length < 4)
          E("Mot de passe trop court (min. 4 caractères).", "error");
        else
          try {
            const r = await fetch(API_URL + "/api/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: e, password: t }),
            }),
              a = await r.json();
            if (!r.ok)
              return void (a.error && a.error.includes("already taken")
                ? E("Ce pseudo est déjà pris.", "error")
                : E(a.error || "Erreur lors de l'inscription.", "error"));
            ((currentUser = {
              id: a.id,
              username: a.username,
              token: a.token,
            }),
              saveCurrentUserToStorage(currentUser),
              updateUserUI(),
              E("Compte créé !", "success"));
          } catch (e) {
            (console.error("Erreur register :", e),
              E("Serveur injoignable.", "error"));
          }
      else E("Pseudo et mot de passe requis.", "error");
    }),
    d &&
    d.addEventListener("click", () => {
      ((currentUser = null),
        clearCurrentUserFromStorage(),
        updateUserUI(),
        E("", ""));
    }));
  const q = document.getElementById("target-street");
  (q && (q.textContent = "—"),
    updateScoreUI(),
    updateTimeUI(0, 0),
    updateScoreMetricUI(),
    updateWeightedScoreUI(),
    updateSessionProgressBar(),
    updateStartStopButton(),
    updatePauseButton(),
    updateStreetInfoPanelVisibility(),
    updateLayoutSessionState(),
    updateGameModeControls(),
    ensureLectureBackButton(),
    "lecture" === getGameMode()
      ? startNewSession()
      : showMessage(
        'Cliquez sur "Commencer la session" une fois que la carte est chargée.',
        "info",
      ));
  const I = document.getElementById("summary");
  I && I.classList.add("hidden");
}
document.addEventListener("DOMContentLoaded", () => {
  loadStreetInfos();
  (setMapStatus("Chargement", "loading"),
    initMap(),
    initUI(),
    startTimersLoop(),
    loadStreets(),
    loadQuartierPolygons(),
    loadMonuments(),
    loadAllLeaderboards(),
    document.body.classList.add("app-ready"));
});
const infoEl = document.getElementById("street-info");
function startTimersLoop() {
  requestAnimationFrame(function e() {
    if (
      null !== sessionStartTime &&
      null !== streetStartTime &&
      isSessionRunning &&
      !isPaused &&
      (currentTarget || currentMonumentTarget)
    ) {
      const t = performance.now(),
        r = (t - sessionStartTime) / 1e3,
        a = (t - streetStartTime) / 1e3;
      if (r >= 500 || a >= 500)
        return (endSession(), void requestAnimationFrame(e));
      if (isChronoMode && null !== chronoEndTime && t >= chronoEndTime)
        return (endSession(), void requestAnimationFrame(e));
      (updateTimeUI(
        r,
        a,
        isChronoMode && null !== chronoEndTime
          ? Math.max(0, (chronoEndTime - t) / 1e3)
          : null,
      ),
        "classique" === getGameMode() &&
          (hasAnsweredCurrentItem || updateWeightedBar(computeItemPoints(a) / 10)));
    }
    requestAnimationFrame(e);
  });
}
function showMessage(e, t) {
  const r = document.getElementById("message");
  r &&
    ((r.className = "message"),
      "success" === t
        ? r.classList.add("message--success")
        : "error" === t
          ? r.classList.add("message--error")
          : r.classList.add("message--info"),
      (r.textContent = e),
      r.classList.add("message--visible"),
      null !== messageTimeoutId && clearTimeout(messageTimeoutId),
      (messageTimeoutId = setTimeout(() => {
        (r.classList.remove("message--visible"), (messageTimeoutId = null));
      }, 3e3)));
}
function getBaseStreetStyleFromName(e) {
  const t = getZoneMode(),
    r = normalizeName(e || "");
  let a = UI_THEME.mapStreet,
    n = 5;
  return (
    ("rues-principales" !== t && "main" !== t) ||
    MAIN_STREET_NAMES.has(r) ||
    ((a = "#00000000"), (n = 0)),
    "rues-celebres" === t &&
    (FAMOUS_STREET_NAMES.has(r) || ((a = "#00000000"), (n = 0))),
    { color: a, weight: n }
  );
}
function getBaseStreetStyle(e) {
  const t = e.feature || e;
  let r = getBaseStreetStyleFromName(t?.properties?.name || "");
  const a = getZoneMode(),
    n = getSelectedQuartier();
  return (
    "quartier" === a &&
    n &&
    (t?.properties?.quartier || null) !== n &&
    (r = { color: "#00000000", weight: 0 }),
    r
  );
}
function isStreetVisibleInCurrentMode(e, t) {
  const r = getZoneMode();
  if ("monuments" === r) return !1;
  if ("rues-celebres" === r) return FAMOUS_STREET_NAMES.has(e);
  if ("rues-principales" === r || "main" === r) return MAIN_STREET_NAMES.has(e);
  if ("quartier" === r) {
    const e = getSelectedQuartier(),
      r = "string" == typeof t ? t.trim() : null;
    if (e && r !== e) return !1;
  }
  return !0;
}
function addTouchBufferForLayer(e) {
  if (!IS_TOUCH_DEVICE || !map) return;
  const t = e.getLatLngs();
  if (!t || 0 === t.length) return;
  const r = L.polyline(t, {
    color: "#000000",
    weight: 30,
    opacity: 0,
    interactive: !0,
  });
  (r.on("click", (t) => {
    (L && L.DomEvent && L.DomEvent.stop && L.DomEvent.stop(t), e.fire("click"));
  }),
    r.on("mouseover", () => e.fire("mouseover")),
    r.on("mouseout", () => e.fire("mouseout")),
    r.addTo(map),
    (e.touchBuffer = r));
}
function loadStreets() {
  const e = performance.now();
  fetch("data/marseille_rues_light.geojson?v=11")
    .then((e) => {
      if (!e.ok) throw new Error("Erreur HTTP " + e.status);
      return e.json();
    })
    .then((t) => {
      allStreetFeatures = t.features || [];
      const r = (performance.now() - e).toFixed(0);
      (console.log(`Rues chargées : ${allStreetFeatures.length} en ${r}ms`),
        streetLayersById.clear(),
        streetLayersByName.clear());
      let a = 0;
      ((streetsLayer = L.geoJSON(allStreetFeatures, {
        style: function (e) {
          return getBaseStreetStyle(e);
        },
        onEachFeature: (e, t) => {
          const r = normalizeName(e.properties.name);
          ((e._gameId = a++),
            streetLayersById.set(e._gameId, t),
            (t.feature = e),
            streetLayersByName.has(r) || streetLayersByName.set(r, []),
            streetLayersByName.get(r).push(t),
            addTouchBufferForLayer(t));
          let n = null;
          (t.on("mouseover", () => {
            (clearTimeout(n),
              (n = setTimeout(() => {
                const t = e.properties.quartier || null;
                isStreetVisibleInCurrentMode(r, t) &&
                  (streetLayersByName.get(r) || []).forEach((e) => {
                    e.setStyle({ weight: 7, color: UI_THEME.mapStreetHover });
                  });
              }, 50)));
          }),
            t.on("mouseout", () => {
              (clearTimeout(n),
                (n = setTimeout(() => {
                  const t = e.properties.quartier || null;
                  isStreetVisibleInCurrentMode(r, t) &&
                    (streetLayersByName.get(r) || []).forEach((e) => {
                      if (highlightedLayers && highlightedLayers.includes(e))
                        return;
                      const t = getBaseStreetStyle(e);
                      e.setStyle({ weight: t.weight, color: t.color });
                    });
                }, 50)));
            }),
            t.on("click", (a) => {
              const n = e.properties.quartier || null;
              isStreetVisibleInCurrentMode(r, n) && handleStreetClick(e, t, a);
            }));
        },
      }).addTo(map)),
        refreshLectureTooltipsIfNeeded(),
        refreshLectureStreetSearchForCurrentMode({ preserveQuery: !0 }),
        populateQuartiers());
      const n = document.getElementById("mode-select");
      (n && n.dispatchEvent(new Event("change")),
        window.innerWidth <= 900 ||
        showMessage(
          'Carte chargée. Choisissez la zone, le type de partie, puis cliquez sur "Commencer la session".',
          "info",
        ),
        setMapStatus("Carte OK", "ready"),
        document.body.classList.add("app-ready"));
    })
    .catch((e) => {
      (console.error("Erreur lors du chargement des rues :", e),
        showMessage("Erreur de chargement des rues (voir console).", "error"),
        setMapStatus("Erreur", "error"));
    });
}
function loadMonuments() {
  fetch("data/marseille_monuments.geojson?v=2")
    .then((e) =>
      e.ok
        ? e.json()
        : (console.warn(
          "Impossible de charger les monuments (HTTP " + e.status + ").",
        ),
          null),
    )
    .then((e) => {
      if (!e) return;
      const t = (e.features || []).filter(
        (e) =>
          e.geometry &&
          "Point" === e.geometry.type &&
          e.properties &&
          "string" == typeof e.properties.name &&
          "" !== e.properties.name.trim(),
      );
      ((allMonuments = t),
        console.log("Nombre de monuments chargés :", allMonuments.length),
        0 === allMonuments.length &&
        console.warn("Aucun monument trouvé après filtrage."),
        monumentsLayer &&
        (map.removeLayer(monumentsLayer), (monumentsLayer = null)),
        (monumentsLayer = L.geoJSON(
          { type: "FeatureCollection", features: allMonuments },
          {
            renderer: L.svg({ pane: "markerPane" }),
            pointToLayer: (e, t) => {
              const r = L.circleMarker(t, {
                radius: 8,
                color: UI_THEME.mapMonumentStroke,
                weight: 3,
                fillColor: UI_THEME.mapMonumentFill,
                fillOpacity: 1,
                pane: "markerPane",
              });
              return (IS_TOUCH_DEVICE && (r._monumentFeature = e), r);
            },
            onEachFeature: (e, t) => {
              t.on("click", () => handleMonumentClick(e, t));
            },
          },
        )),
        IS_TOUCH_DEVICE &&
        monumentsLayer &&
        monumentsLayer.eachLayer((e) => {
          const t = e._monumentFeature;
          if (!t) return;
          const r = e.getLatLng(),
            a = L.circleMarker(r, {
              radius: 18,
              fillOpacity: 0,
              opacity: 0,
              pane: "markerPane",
            });
          (a.on("click", () => handleMonumentClick(t, e)),
            (a._visibleMarker = e),
            (a._isHitArea = !0),
            monumentsLayer.addLayer(a));
        }),
        refreshLectureTooltipsIfNeeded(),
        "monuments" === getZoneMode() &&
        (map.hasLayer(monumentsLayer) || monumentsLayer.addTo(map),
          streetsLayer &&
          map.hasLayer(streetsLayer) &&
          map.removeLayer(streetsLayer)));
    })
    .catch((e) => {
      console.error("Erreur lors du chargement des monuments :", e);
    });
}
function setLectureTooltipsEnabled(e) {
  function t(e) {
    e.__lectureTapTooltipBound &&
      (e.__lectureTapTooltipFn && e.off("click", e.__lectureTapTooltipFn),
        (e.__lectureTapTooltipBound = !1),
        (e.__lectureTapTooltipFn = null));
  }
  (streetsLayer &&
    streetsLayer.eachLayer((r) => {
      const a = r.feature?.properties?.name || "";
      a &&
        (e
          ? getBaseStreetStyle(r).weight > 0
            ? (r.getTooltip() ||
              r.bindTooltip(a, {
                direction: "top",
                sticky: !IS_TOUCH_DEVICE,
                opacity: 0.9,
                className: "street-tooltip",
              }),
              (function (e) {
                IS_TOUCH_DEVICE &&
                  (e.__lectureTapTooltipBound ||
                    ((e.__lectureTapTooltipBound = !0),
                      e.on(
                        "click",
                        (e.__lectureTapTooltipFn = () => {
                          (e.getTooltip() && e.openTooltip(),
                            streetsLayer &&
                            streetsLayer.eachLayer((t) => {
                              t !== e &&
                                t.getTooltip &&
                                t.getTooltip() &&
                                t.closeTooltip();
                            }),
                            monumentsLayer &&
                            monumentsLayer.eachLayer((t) => {
                              t !== e &&
                                t.getTooltip &&
                                t.getTooltip() &&
                                t.closeTooltip();
                            }));
                        }),
                      )));
              })(r))
            : (r.getTooltip() && r.unbindTooltip(), t(r))
          : (t(r), r.getTooltip() && (r.closeTooltip(), r.unbindTooltip())));
    }),
    monumentsLayer &&
    monumentsLayer.eachLayer((t) => {
      if (t._isHitArea)
        return void (e && IS_TOUCH_DEVICE && !t.__hitAreaTooltipBound
          ? ((t.__hitAreaTooltipBound = !0),
            t.on("click", () => {
              const e = t._visibleMarker;
              e &&
                e.getTooltip() &&
                (monumentsLayer.eachLayer((t) => {
                  t !== e &&
                    t.getTooltip &&
                    t.getTooltip() &&
                    t.closeTooltip();
                }),
                  e.toggleTooltip());
            }))
          : e || (t.__hitAreaTooltipBound = !1));
      const r = t.feature?.properties?.name || "";
      r &&
        (e
          ? (t.getTooltip() ||
            t.bindTooltip(r, {
              direction: "top",
              sticky: !1,
              permanent: !1,
              opacity: 0.9,
              className: "monument-tooltip",
            }),
            IS_TOUCH_DEVICE &&
            !t.__monumentTapBound &&
            ((t.__monumentTapBound = !0),
              t.on("click", () => {
                (monumentsLayer.eachLayer((e) => {
                  e !== t &&
                    e.getTooltip &&
                    e.getTooltip() &&
                    e.closeTooltip();
                }),
                  t.getTooltip() && t.toggleTooltip());
              })))
          : (t.__monumentTapBound && (t.__monumentTapBound = !1),
            t.getTooltip() && (t.closeTooltip(), t.unbindTooltip())));
    }));
}
function refreshLectureTooltipsIfNeeded() {
  ("lecture" !== getGameMode() && !0 !== isLectureMode) ||
    setLectureTooltipsEnabled(!0);
}
function loadQuartierPolygons() {
  fetch("data/marseille_quartiers_111.geojson?v=2")
    .then((e) => {
      if (!e.ok) throw new Error("Erreur HTTP " + e.status);
      return e.json();
    })
    .then((e) => {
      const t = e.features || [];
      (quartierPolygonsByName.clear(),
        t.forEach((e) => {
          const t = e.properties || {},
            r = "string" == typeof t.nom_qua ? t.nom_qua.trim() : "";
          r && quartierPolygonsByName.set(r, e);
        }),
        console.log("Quartiers chargés :", quartierPolygonsByName.size),
        console.log("Noms de quartiers (polygones):"),
        console.log(Array.from(quartierPolygonsByName.keys()).sort()));
    })
    .catch((e) => {
      console.error("Erreur lors du chargement des quartiers :", e);
    });
}
function highlightQuartier(e) {
  if ((clearQuartierOverlay(), !e)) return;
  const t = quartierPolygonsByName.get(e);
  if (!t)
    return void console.warn("Aucun polygone trouvé pour le quartier :", e);
  quartierOverlay = L.geoJSON(t, {
    style: { color: UI_THEME.mapQuartier, weight: 2, fill: !1 },
    interactive: !1,
  }).addTo(map);
  const r = quartierOverlay.getBounds();
  if (r && r.isValid && r.isValid()) {
    const e =
      window.innerWidth <= 900
        ? { padding: [40, 40], maxZoom: 14 }
        : { padding: [40, 40] };
    map.fitBounds(r, { ...e, animate: !0, duration: 1.5 });
  }
}
function clearQuartierOverlay() {
  quartierOverlay &&
    (map.removeLayer(quartierOverlay), (quartierOverlay = null));
}
function populateQuartiers() {
  const e = document.getElementById("quartier-select"),
    t = document.getElementById("quartier-select-list"),
    r = document.getElementById("quartier-select-button"),
    a = r ? r.querySelector(".custom-select-label") : null;
  if (!e) return;
  const n = new Set();
  allStreetFeatures.forEach((e) => {
    const t = (e.properties || {}).quartier;
    "string" == typeof t && "" !== t.trim() && n.add(t.trim());
  });
  const s = Array.from(n).sort((e, t) =>
    e.localeCompare(t, "fr", { sensitivity: "base" }),
  );
  if (
    ((e.innerHTML = ""),
      s.forEach((t) => {
        const r = document.createElement("option");
        ((r.value = t), (r.textContent = t), e.appendChild(r));
      }),
      t &&
      ((t.innerHTML = ""),
        s.forEach((n) => {
          const s = document.createElement("li");
          s.dataset.value = n;
          const i = document.createElement("span");
          ((i.textContent = n), s.appendChild(i));
          const l = arrondissementByQuartier.get(normalizeQuartierKey(n));
          if (l) {
            const e = document.createElement("span");
            ((e.className = "difficulty-pill difficulty-pill--arrondissement"),
              (e.textContent = l),
              s.appendChild(e));
          }
          (s.addEventListener("click", () => {
            a && (a.textContent = n);
            const i = s.querySelector(".difficulty-pill");
            if (r) {
              const e = r.querySelector(".difficulty-pill");
              if (i) {
                const t = i.cloneNode(!0);
                e ? e.replaceWith(t) : r.appendChild(t);
              } else e && e.remove();
            }
            ((e.value = n),
              e.dispatchEvent(new Event("change")),
              t.classList.remove("visible"));
          }),
            t.appendChild(s));
        }),
        s.length > 0 && r))
  ) {
    const t = s[0];
    a && (a.textContent = t);
    const n = arrondissementByQuartier.get(normalizeQuartierKey(t));
    if (n) {
      const e = r.querySelector(".difficulty-pill"),
        t = document.createElement("span");
      ((t.className = "difficulty-pill difficulty-pill--arrondissement"),
        (t.textContent = n),
        e ? e.replaceWith(t) : r.appendChild(t));
    }
    e.value = t;
  }
}
function scrollSidebarToTargetPanel() {
  if (window.innerWidth >= 900) return;
  const e = document.getElementById("sidebar"),
    t = document.querySelector(".target-panel");
  e &&
    t &&
    setTimeout(() => {
      const r = t.offsetTop,
        a = t.offsetHeight,
        n = r - e.clientHeight / 2 + a / 2;
      e.scrollTo({ top: n, behavior: "smooth" });
    }, 350);
}
function ensureLectureBackButton() {
  if (document.getElementById("lecture-back-btn")) return;
  const e = document.querySelector(".target-panel");
  if (!e) return;
  const t = document.createElement("button");
  ((t.id = "lecture-back-btn"),
    (t.type = "button"),
    (t.className = "btn btn-secondary lecture-back-btn"),
    (t.textContent = "Retour au menu"),
    e.insertAdjacentElement("afterend", t),
    t.addEventListener("click", exitLectureModeToMenu),
    (t.style.display = "none"));
}
function exitLectureModeToMenu() {
  ((isLectureMode = !1),
    setLectureTooltipsEnabled(!1),
    (isSessionRunning = !1),
    (isChronoMode = !1),
    (chronoEndTime = null),
    (sessionStartTime = null),
    (streetStartTime = null),
    (isPaused = !1),
    (pauseStartTime = null),
    (remainingChronoMs = null));
  const e = document.getElementById("game-mode-select");
  e && (e.value = "classique");
  const t = document.getElementById("game-mode-select-button"),
    r = document.getElementById("game-mode-select-list");
  if (t && r) {
    const e = t.querySelector(".custom-select-label"),
      a = r.querySelector('li[data-value="classique"]');
    if (e && a) {
      e.textContent = a.childNodes[0].textContent.trim();
      const r = a.querySelector(".difficulty-pill");
      if (r) {
        const e = r.cloneNode(!0),
          a = t.querySelector(".difficulty-pill");
        a ? a.replaceWith(e) : t.appendChild(e);
      }
    }
  }
  const a = document.getElementById("target-street");
  (a && (a.textContent = "—"),
    updateTargetPanelTitle(),
    updateTimeUI(0, 0),
    updateStartStopButton(),
    updatePauseButton(),
    updateGameModeControls(),
    refreshLectureStreetSearchForCurrentMode(),
    updateLayoutSessionState(),
    showMessage("Retour au menu.", "info"));
}
function startNewSession() {
  document.body.classList.remove("session-ended");
  const e = document.getElementById("quartier-select"),
    t = getZoneMode(),
    r = getGameMode(),
    a = document.getElementById("street-info");
  (a && ((a.textContent = ""), (a.style.display = "none")),
    clearHighlight(),
    (correctCount = 0),
    (totalAnswered = 0),
    (summaryData = []),
    (weightedScore = 0),
    (errorsCount = 0),
    (isPaused = !1),
    (pauseStartTime = null),
    (remainingChronoMs = null),
    updateScoreUI(),
    updateTimeUI(0, 0),
    updateScoreMetricUI(),
    updateWeightedScoreUI(),
    updateSessionProgressBar());
  const n = document.getElementById("summary");
  if (
    (n && n.classList.add("hidden"),
      (isChronoMode = "chrono" === r),
      (chronoEndTime = isChronoMode ? performance.now() + 6e4 : null),
      setLectureTooltipsEnabled(!1),
      "lecture" === r)
  ) {
    ((isLectureMode = !0),
      (isSessionRunning = !1),
      (isChronoMode = !1),
      (chronoEndTime = null),
      (sessionStartTime = null),
      (streetStartTime = null),
      (currentTarget = null),
      setLectureTooltipsEnabled(!0),
      (currentMonumentTarget = null),
      (isPaused = !1),
      (pauseStartTime = null),
      (remainingChronoMs = null),
      updateTargetPanelTitle(),
      updateLayoutSessionState(),
      "monuments" === t
        ? (streetsLayer &&
          map.hasLayer(streetsLayer) &&
          map.removeLayer(streetsLayer),
          monumentsLayer &&
          !map.hasLayer(monumentsLayer) &&
          monumentsLayer.addTo(map),
          clearQuartierOverlay())
        : (monumentsLayer &&
          map.hasLayer(monumentsLayer) &&
          map.removeLayer(monumentsLayer),
          streetsLayer &&
          !map.hasLayer(streetsLayer) &&
          streetsLayer.addTo(map),
          "quartier" === t && e && e.value
            ? highlightQuartier(e.value)
            : clearQuartierOverlay()),
      (() => {
        const r = document.getElementById("target-street");
        r &&
          ("monuments" === t
            ? ((r.textContent = "Mode lecture : survolez la carte"),
              requestAnimationFrame(fitTargetStreetText))
            : (r.textContent = "—"));
      })(),
      refreshLectureStreetSearchForCurrentMode());
    const r = document.getElementById("pause-btn");
    r && ((r.disabled = !0), (r.textContent = "Pause"));
    const a = document.getElementById("skip-btn");
    return (
      a && (a.style.display = "none"),
      updateStartStopButton(),
      updatePauseButton(),
      updateTimeUI(0, 0),
      setLectureTooltipsEnabled(!0),
      void showMessage(
        "Mode lecture : utilisez la recherche ou survolez la carte pour voir les noms.",
        "info",
      )
    );
  }
  if (
    ((isLectureMode = !1),
      updateTargetPanelTitle(),
      refreshLectureStreetSearchForCurrentMode(),
      "monuments" === t)
  ) {
    if (!allMonuments.length)
      return void showMessage(
        "Aucun monument disponible (vérifiez data/marseille_monuments.geojson).",
        "error",
      );
    if (
      (streetsLayer &&
        map.hasLayer(streetsLayer) &&
        map.removeLayer(streetsLayer),
        monumentsLayer &&
        !map.hasLayer(monumentsLayer) &&
        monumentsLayer.addTo(map),
        clearQuartierOverlay(),
        "marathon" === r)
    )
      sessionMonuments = sampleWithoutReplacement(
        allMonuments,
        allMonuments.length,
      );
    else if ("chrono" === r)
      sessionMonuments = sampleWithoutReplacement(
        allMonuments,
        allMonuments.length,
      );
    else {
      const e = Math.min(20, allMonuments.length);
      sessionMonuments = sampleWithoutReplacement(allMonuments, e);
    }
    ((currentMonumentIndex = 0),
      (currentMonumentTarget = null),
      (currentTarget = null),
      (isMonumentsMode = !0),
      (sessionStartTime = performance.now()),
      (streetStartTime = null),
      (isSessionRunning = !0),
      updateStartStopButton(),
      updatePauseButton(),
      updateLayoutSessionState(),
      scrollSidebarToTargetPanel());
    const e = document.getElementById("skip-btn");
    return (
      e && (e.style.display = "inline-block"),
      setNewTarget(),
      showMessage("Session monuments démarrée.", "info"),
      void updateLayoutSessionState()
    );
  }
  if (
    ((isLectureMode = !1),
      (isMonumentsMode = !1),
      0 === allStreetFeatures.length)
  )
    return void showMessage(
      "Impossible de démarrer : données rues non chargées.",
      "error",
    );
  const s = getCurrentZoneStreets();
  if (0 === s.length)
    return void showMessage("Aucune rue disponible pour cette zone.", "error");
  const i = buildUniqueStreetList(s);
  if (0 === i.length)
    return void showMessage(
      "Aucune rue nommée disponible pour cette zone.",
      "error",
    );
  if ("marathon" === r) sessionStreets = sampleWithoutReplacement(i, i.length);
  else if ("chrono" === r)
    sessionStreets = sampleWithoutReplacement(i, i.length);
  else {
    const e = Math.min(20, i.length);
    sessionStreets = sampleWithoutReplacement(i, e);
  }
  ((currentIndex = 0),
    "quartier" === t && e && e.value
      ? highlightQuartier(e.value)
      : clearQuartierOverlay(),
    monumentsLayer &&
    map.hasLayer(monumentsLayer) &&
    map.removeLayer(monumentsLayer),
    streetsLayer && !map.hasLayer(streetsLayer) && streetsLayer.addTo(map),
    (sessionStartTime = performance.now()),
    (currentTarget = null),
    (currentMonumentTarget = null),
    (streetStartTime = null),
    (isSessionRunning = !0),
    updateStartStopButton(),
    updatePauseButton(),
    updateLayoutSessionState(),
    scrollSidebarToTargetPanel());
  const l = document.getElementById("skip-btn");
  (l && !isLectureMode && (l.style.display = "inline-block"),
    setNewTarget(),
    showMessage("Session démarrée.", "info"));
}
function getCurrentZoneStreets() {
  const e = document.getElementById("quartier-select"),
    t = getZoneMode();
  if ("quartier" === t && e && e.value) {
    const t = e.value;
    return allStreetFeatures.filter(
      (e) =>
        e.properties &&
        "string" == typeof e.properties.quartier &&
        e.properties.quartier === t,
    );
  }
  return "rues-principales" === t || "main" === t
    ? allStreetFeatures.filter((e) => {
      const t = normalizeName(e.properties && e.properties.name);
      return MAIN_STREET_NAMES.has(t);
    })
    : "rues-celebres" === t
      ? allStreetFeatures.filter((e) => {
        const t = normalizeName(e.properties && e.properties.name);
        return FAMOUS_STREET_NAMES.has(t);
      })
      : allStreetFeatures;
}
function buildUniqueStreetList(e) {
  const t = new Map();
  return (
    e.forEach((e) => {
      const r =
        "string" == typeof e.properties.name ? e.properties.name.trim() : "";
      if (!r) return;
      const a = normalizeName(r);
      t.has(a) || t.set(a, e);
    }),
    Array.from(t.values())
  );
}
function sampleWithoutReplacement(e, t) {
  const r = Array.from(e.keys());
  return (shuffle(r), r.slice(0, t).map((t) => e[t]));
}
function shuffle(e) {
  for (let t = e.length - 1; t > 0; t--) {
    const r = Math.floor(Math.random() * (t + 1));
    [e[t], e[r]] = [e[r], e[t]];
  }
}
function setNewTarget() {
  const e = getGameMode();
  if ("monuments" === getZoneMode()) {
    if (currentMonumentIndex >= sessionMonuments.length) {
      if ("chrono" !== e) return void endSession();
      (shuffle(sessionMonuments), (currentMonumentIndex = 0));
    }
    ((currentTarget = null),
      (currentMonumentTarget = sessionMonuments[currentMonumentIndex]),
      (streetStartTime = performance.now()),
      (hasAnsweredCurrentItem = !1),
      resetWeightedBar());
    const t = currentMonumentTarget.properties.name,
      r = document.getElementById("target-street");
    return (
      r &&
      ((r.textContent = t || "—"),
        requestAnimationFrame(fitTargetStreetText)),
      void triggerTargetPulse()
    );
  }
  if (currentIndex >= sessionStreets.length) {
    if ("chrono" !== e) return void endSession();
    (shuffle(sessionStreets), (currentIndex = 0));
  }
  ((currentMonumentTarget = null),
    (currentTarget = sessionStreets[currentIndex]),
    (streetStartTime = performance.now()),
    (hasAnsweredCurrentItem = !1),
    resetWeightedBar());
  const t = currentTarget.properties.name,
    r = document.getElementById("target-street");
  (r &&
    ((r.textContent = t || "—"), requestAnimationFrame(fitTargetStreetText)),
    triggerTargetPulse());
}
function triggerTargetPulse() {
  const e = document.querySelector(".target-panel");
  e && (e.classList.remove("pulse"), e.offsetWidth, e.classList.add("pulse"));
}
function updateStartStopButton() {
  const e = document.getElementById("restart-btn"),
    t = document.getElementById("skip-btn");
  if (e)
    return "lecture" === getGameMode()
      ? ((e.style.display = "none"), void (t && (t.style.display = "none")))
      : ((e.style.display = ""),
        void (isSessionRunning
          ? ((e.textContent = "Arrêter la session"),
            e.classList.remove("btn-primary"),
            e.classList.add("btn-stop"),
            t && (t.style.display = "block"))
          : ((e.textContent = "Commencer la session"),
            e.classList.remove("btn-stop"),
            e.classList.add("btn-primary"),
            t && (t.style.display = "none"))));
}
function stopSessionManually() {
  (isSessionRunning || isDailyMode) &&
    (("function" == typeof handleDailyStop && handleDailyStop()) ||
      endSession());
}
function togglePause() {
  if (isSessionRunning) {
    if (isPaused) {
      const e = performance.now(),
        t = e - pauseStartTime;
      (null !== sessionStartTime && (sessionStartTime += t),
        null !== streetStartTime && (streetStartTime += t),
        isChronoMode &&
        null !== remainingChronoMs &&
        ((chronoEndTime = e + remainingChronoMs), (remainingChronoMs = null)),
        (isPaused = !1),
        (pauseStartTime = null));
    } else
      ((isPaused = !0),
        (pauseStartTime = performance.now()),
        isChronoMode &&
        null !== chronoEndTime &&
        (remainingChronoMs = chronoEndTime - pauseStartTime));
    updatePauseButton();
  }
}
function updatePauseButton() {
  const e = document.getElementById("pause-btn");
  if (e)
    if ("lecture" !== getGameMode()) {
      if (!isSessionRunning)
        return (
          (e.style.display = "none"),
          (e.textContent = "Pause"),
          void (e.disabled = !0)
        );
      ((e.style.display = "block"),
        (e.disabled = !1),
        (e.textContent = isPaused ? "Reprendre" : "Pause"));
    } else e.style.display = "none";
}
function updateLayoutSessionState() {
  const e = document.body;
  if (!e) return;
  if (
    (isSessionRunning || isLectureMode
      ? e.classList.add("session-running")
      : e.classList.remove("session-running"),
      isLectureMode
        ? e.classList.add("lecture-mode")
        : e.classList.remove("lecture-mode"),
      map && setTimeout(() => map.invalidateSize(), 300),
      isLectureMode)
  ) {
    const e = document.getElementById("sidebar"),
      t = document.querySelector(".target-panel");
    e &&
      t &&
      setTimeout(() => {
        e.scrollTo({ top: t.offsetTop - 8, behavior: "smooth" });
      }, 120);
  }
  const t = document.getElementById("lecture-back-btn");
  if (t) {
    const e = window.innerWidth <= 900;
    isLectureMode && e
      ? ((t.style.display = "block"),
        t.__didAutoFocus ||
        ((t.__didAutoFocus = !0),
          setTimeout(() => {
            try {
              t.focus({ preventScroll: !0 });
            } catch (e) {
              t.focus();
            }
          }, 200)))
      : ((t.style.display = "none"), (t.__didAutoFocus = !1));
  }
  updateDailyResultPanel();
}
function computeItemPoints(e) {
  return Math.max(0, 10 - e);
}
function handleStreetClick(e, t, r) {
  const a = getZoneMode();
  if ("monuments" === a) return;
  if ("rues-principales" === a || "main" === a) {
    const t = normalizeName(e.properties.name);
    if (!MAIN_STREET_NAMES.has(t)) return;
  }
  if ("rues-celebres" === a) {
    const t = normalizeName(e.properties.name);
    if (!FAMOUS_STREET_NAMES.has(t)) return;
  }
  if ("quartier" === a) {
    const t = getSelectedQuartier(),
      r =
        e.properties && "string" == typeof e.properties.quartier
          ? e.properties.quartier.trim()
          : null;
    if (t && r !== t) return;
  }
  if (isPaused) return;
  if (isDailyMode) {
    if (!dailyTargetData || !dailyTargetGeoJson) return;
    const a = dailyTargetData.userStatus || {};
    if (a.success || (a.attempts_count || 0) >= 7 || window._dailyGameOver)
      return;
    if (window._dailyGuessInFlight) return;
    window._dailyGuessInFlight = !0;
    const n =
      normalizeName(e.properties.name) ===
      normalizeName(dailyTargetData.streetName);
    let s = 0,
      i = "";
    const l = computeFeatureCentroid(e),
      o = dailyTargetGeoJson;
    if (!n) {
      let e = l[0],
        t = l[1];
      r && r.latlng && ((e = r.latlng.lng), (t = r.latlng.lat));
      const a = normalizeName(dailyTargetData.streetName),
        n = allStreetFeatures.find(
          (e) => e.properties && normalizeName(e.properties.name) === a,
        );
      ((s =
        n && n.geometry
          ? getDistanceToFeature(t, e, n.geometry)
          : getDistanceMeters(t, e, o[1], o[0])),
        (i = getDirectionArrow(l, o)));
    }
    if (!n && t && "function" == typeof t.setStyle) {
      const e = getBaseStreetStyle(t);
      (t.setStyle({ color: UI_THEME.timerWarn, weight: 6, opacity: 1 }),
        setTimeout(() => {
          t && map.hasLayer(t) && t.setStyle(e);
        }, 2e3));
    }
    (dailyGuessHistory.push({
      streetName: e.properties.name,
      distance: Math.round(s),
      arrow: i,
    }),
      saveDailyGuessesToStorage());
    const u = dailyGuessHistory.length,
      d = 7 - u;
    if (n) {
      ((window._dailyGameOver = !0),
        (isSessionRunning = !1),
        document.body.classList.add("daily-game-over"),
        typeof confetti === "function" && confetti({ particleCount: 150, zIndex: 10000, spread: 80, origin: { y: 0.6 } }),
        showMessage(
          `🎉 BRAVO ! Trouvé en ${u} essai${u > 1 ? "s" : ""} !`,
          "success",
        ),
        triggerHaptic('success'),
        renderDailyGuessHistory({ success: !0, attempts: u }));
      const e = document.getElementById("target-panel-title");
      e && (e.textContent = "🎉 Défi réussi !");
      const t = document.getElementById("restart-btn");
      t &&
        ((t.textContent = "Commencer la session"),
          t.classList.remove("btn-stop"),
          t.classList.add("btn-primary"));
      const r = normalizeName(dailyTargetData.streetName),
        a = allStreetFeatures.find(
          (e) => e.properties && normalizeName(e.properties.name) === r,
        );
      a && a.geometry && highlightDailyTarget(a.geometry, !0);
    } else if (d <= 0) {
      ((window._dailyGameOver = !0),
        (isSessionRunning = !1),
        document.body.classList.add("daily-game-over"),
        showMessage(
          `❌ Dommage ! C'était « ${dailyTargetData.streetName} ». Fin du défi.`,
          "error",
        ),
        triggerHaptic('error'),
        renderDailyGuessHistory({ success: !1 }));
      const e = document.getElementById("target-panel-title");
      e && (e.textContent = "❌ Défi échoué");
      const t = document.getElementById("restart-btn");
      t &&
        ((t.textContent = "Commencer la session"),
          t.classList.remove("btn-stop"),
          t.classList.add("btn-primary"));
      const r = normalizeName(dailyTargetData.streetName),
        a = allStreetFeatures.find(
          (e) => e.properties && normalizeName(e.properties.name) === r,
        );
      a && a.geometry && highlightDailyTarget(a.geometry, !1);
    } else
      (renderDailyGuessHistory(),
        triggerHaptic('error'),
        showMessage(
          `❌ Raté ! Distance : ${s >= 1e3 ? `${(s / 1e3).toFixed(1)} km` : `${Math.round(s)} m`}. Plus que ${d} essai${d > 1 ? "s" : ""}.`,
          "warning",
        ));
    return (
      updateDailyUI(),
      updateStartStopButton(),
      updateLayoutSessionState(),
      void fetch(API_URL + "/api/daily/guess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          date: dailyTargetData.date,
          distanceMeters: Math.round(s),
          isSuccess: n,
        }),
      })
        .then((e) => e.json())
        .then((e) => {
          ((dailyTargetData.userStatus = e),
            e.targetGeometry &&
            (e.success || e.attempts_count >= 7) &&
            highlightDailyTarget(e.targetGeometry, !!e.success));
        })
        .catch((e) => {
          console.warn("Daily sync error (non-bloquant):", e);
        })
        .finally(() => {
          window._dailyGuessInFlight = !1;
        })
    );
  }
  if (!currentTarget || null === sessionStartTime || null === streetStartTime)
    return;
  const n = getGameMode(),
    s = (performance.now() - streetStartTime) / 1e3,
    i =
      normalizeName(e.properties.name) ===
      normalizeName(currentTarget.properties.name),
    l = currentTarget;
  if (i) {
    correctCount += 1;
    (hasAnsweredCurrentItem = !0);
    if ("classique" === n) {
      const e = computeItemPoints(s);
      ((weightedScore += e),
        updateWeightedBar(e / 10),
        showMessage(
          `Correct (${s.toFixed(1)} s, +${e.toFixed(1)} pts)`,
          "success",
        ));
    } else if ("marathon" === n) {
      const e = getCurrentSessionPoolSize();
      showMessage(
        `Correct (${correctCount}/${e > 0 ? e : "?"})`,
        "success",
      );
    } else showMessage(`Correct (${correctCount} trouvées)`, "success");
    (updateSessionProgressBar(),
      highlightStreet(UI_THEME.mapCorrect),
      triggerHaptic('success'),
      feedbackCorrect());
  } else
    ((errorsCount += 1),
      showMessage(
        "marathon" === n && errorsCount >= 3
          ? "Incorrect (limite de 3 erreurs atteinte)"
          : "Incorrect",
        "error",
      ),
      highlightStreet(UI_THEME.mapWrong),
      "classique" === n ? updateWeightedBar(0) : updateSessionProgressBar(),
      triggerHaptic('error'),
      feedbackError());
  ((totalAnswered += 1),
    summaryData.push({
      name: currentTarget.properties.name,
      correct: i,
      time: s.toFixed(1),
    }),
    trackAnswer(currentTarget.properties.name, getZoneMode(), i, s),
    updateWeightedScoreUI(),
    updateScoreUI(),
    showStreetInfo(l),
    !i && "marathon" === n && errorsCount >= 3
      ? endSession()
      : ((currentIndex += 1), setNewTarget()));
}
function handleMonumentClick(e, t) {
  if ("monuments" !== getZoneMode()) return;
  if (isPaused) return;
  if (
    !currentMonumentTarget ||
    null === sessionStartTime ||
    null === streetStartTime
  )
    return;
  const r = getGameMode(),
    a = (performance.now() - streetStartTime) / 1e3,
    n =
      normalizeName(e.properties.name) ===
      normalizeName(currentMonumentTarget.properties.name),
    s = currentMonumentTarget.properties.name,
    i = findMonumentLayerByName(currentMonumentTarget.properties.name);
  if (n) {
    correctCount += 1;
    (hasAnsweredCurrentItem = !0);
    if ("classique" === r) {
      const e = computeItemPoints(a);
      ((weightedScore += e),
        updateWeightedBar(e / 10),
        showMessage(
          `Correct (${a.toFixed(1)} s, +${e.toFixed(1)} pts)`,
          "success",
        ));
    } else if ("marathon" === r) {
      const e = getCurrentSessionPoolSize();
      showMessage(
        `Correct (${correctCount}/${e > 0 ? e : "?"})`,
        "success",
      );
    } else showMessage(`Correct (${correctCount} trouvés)`, "success");
    (updateSessionProgressBar(),
      highlightMonument(i, UI_THEME.mapCorrect),
      triggerHaptic('success'),
      feedbackCorrect());
  } else
    ((errorsCount += 1),
      showMessage(
        "marathon" === r && errorsCount >= 3
          ? "Incorrect (limite de 3 erreurs atteinte)"
          : "Incorrect",
        "error",
      ),
      highlightMonument(i, UI_THEME.mapWrong),
      "classique" === r ? updateWeightedBar(0) : updateSessionProgressBar(),
      triggerHaptic('error'),
      feedbackError());
  ((totalAnswered += 1),
    summaryData.push({ name: s, correct: n, time: a.toFixed(1) }),
    trackAnswer(s, "monuments", n, a),
    updateWeightedScoreUI(),
    updateScoreUI(),
    !n && "marathon" === r && errorsCount >= 3
      ? endSession()
      : ((currentMonumentIndex += 1), setNewTarget()));
}
function highlightMonument(e, t) {
  e &&
    (e.setStyle({ color: t, fillColor: t }),
      setTimeout(() => {
        e.setStyle &&
          e.setStyle({
            color: UI_THEME.mapMonumentStroke,
            fillColor: UI_THEME.mapMonumentFill,
          });
      }, 5e3));
}
function showStreetInfo(e) {
  const t = document.getElementById("street-info-panel"),
    r = document.getElementById("street-info");
  if (!t || !r || !e) return;
  const a = getZoneMode();
  updateStreetInfoPanelTitle(a);
  
  const isMain = "rues-principales" === a || "main" === a;
  const isFamous = "rues-celebres" === a || "famous" === a;
  
  if (!isMain && !isFamous)
    return (
      (t.style.display = "none"),
      t.classList.remove("is-visible"),
      (r.textContent = ""),
      void r.classList.remove("is-visible")
    );
    
  const n = e.properties.name || "",
    s = normalizeName(n);
    
  let i;
  if (isMain) {
    i = MAIN_STREET_INFOS[s];
    if (!i && MAIN_STREET_NAMES.has(s)) {
      i = "Rue principale : informations historiques à compléter.";
    }
  } else if (isFamous) {
    i = FAMOUS_STREET_INFOS[s];
    if (!i && FAMOUS_STREET_NAMES.has(s)) {
      i = "Rue célèbre : informations historiques à compléter.";
    }
  }
  
  if (!i)
    return (
      (t.style.display = "none"),
      t.classList.remove("is-visible"),
      (r.textContent = ""),
      void r.classList.remove("is-visible")
    );
  ((t.style.display = "block"),
    (r.style.display = "block"),
    r.classList.remove("is-visible"),
    r.offsetWidth,
    (r.innerHTML = `<strong>${n}</strong><br>${i}`),
    t.classList.add("is-visible"),
    r.classList.add("is-visible"));
}
function trackAnswer(e, t, r, a) {
  e &&
    fetch(API_URL + "/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streetName: e, mode: t, correct: r, timeSec: a }),
    }).catch(() => { });
}
function feedbackCorrect() {
  if (
    (playDing(),
      "function" == typeof confetti &&
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.7 },
        colors: [UI_THEME.mapCorrect, UI_THEME.mapMonumentFill, "#a9b8ec", UI_THEME.mapStreet],
        gravity: 1.2,
        scalar: 0.8,
        ticks: 120,
      }),
      highlightedLayers && highlightedLayers.length > 0)
  ) {
    let e = 0;
    const t = setInterval(() => {
      const r = e % 2 == 0 ? 12 : 6,
        a = e % 2 == 0 ? 1 : 0.5;
      (highlightedLayers.forEach((e) => {
        e.setStyle && e.setStyle({ weight: r, opacity: a });
      }),
        e++,
        e >= 6 &&
        (clearInterval(t),
          highlightedLayers.forEach((e) => {
            e.setStyle && e.setStyle({ weight: 8, opacity: 1 });
          })));
    }, 200);
  }
}
function feedbackError() {
  playBuzz();
  const e = document.getElementById("map");
  e &&
    (e.classList.add("map-shake"),
      setTimeout(() => e.classList.remove("map-shake"), 500));
}
function highlightStreet(e) {
  currentTarget && highlightStreetByName(currentTarget.properties.name, e);
}
function highlightStreetByName(e, t) {
  clearHighlight();
  const r = normalizeName(e);
  if (!r) return [];
  const a = [];
  if (
    (streetLayersById.forEach((e) => {
      normalizeName(e.feature.properties.name) === r && a.push(e);
    }),
      0 === a.length)
  )
    return [];
  ((highlightedLayers = a),
    highlightedLayers.forEach((e) => {
      e.setStyle({ color: t, weight: 8 });
    }));
  let n = null;
  return (
    a.forEach((e) => {
      if ("function" == typeof e.getBounds) {
        const t = e.getBounds();
        n = n ? n.extend(t) : t;
      }
    }),
    n &&
    n.isValid &&
    n.isValid() &&
    map.fitBounds(n, { padding: [60, 60], animate: !0, duration: 1.5 }),
    (highlightTimeoutId = setTimeout(() => {
      (highlightedLayers.forEach((e) => {
        e.setStyle({ color: UI_THEME.mapStreet, weight: 5 });
      }),
        (highlightedLayers = []),
        (highlightTimeoutId = null));
    }, 5e3)),
    a
  );
}
function findMonumentLayerByName(e) {
  if (!monumentsLayer || !e) return null;
  const t = normalizeName(e);
  let r = null;
  return (
    monumentsLayer.eachLayer((e) => {
      normalizeName(e.feature?.properties?.name) === t && (r = e);
    }),
    r
  );
}
function clearHighlight() {
  (null !== highlightTimeoutId &&
    (clearTimeout(highlightTimeoutId), (highlightTimeoutId = null)),
    highlightedLayers &&
    highlightedLayers.length > 0 &&
    (highlightedLayers.forEach((e) => {
      e.setStyle({ color: UI_THEME.mapStreet, weight: 5 });
    }),
      (highlightedLayers = [])));
}
function focusStreetByName(e) {
  const t = highlightStreetByName(e, UI_THEME.mapStreetHover);
  if (!t || 0 === t.length) return null;
  let r = null;
  (t.forEach((e) => {
    if ("function" == typeof e.getBounds) {
      const t = e.getBounds();
      r = r ? r.extend(t) : t;
    }
  }),
    r &&
    r.isValid &&
    r.isValid() &&
    map.fitBounds(r, { padding: [40, 40], animate: !0, duration: 1.5 }));
  return t[0] || null;
}
function endSession() {
  document.body.classList.add("session-ended");
  playVictory();
  const e = performance.now(),
    t = sessionStartTime ? (e - sessionStartTime) / 1e3 : 0;
  ((sessionStartTime = null),
    (streetStartTime = null),
    (currentTarget = null),
    (currentMonumentTarget = null),
    (isSessionRunning = !1),
    (isChronoMode = !1),
    (chronoEndTime = null),
    isDailyMode && ((isDailyMode = !1), updateDailyUI()),
    (isLectureMode = !1),
    updateTargetPanelTitle(),
    updateLayoutSessionState(),
    (isPaused = !1),
    (pauseStartTime = null),
    (remainingChronoMs = null),
    updateStartStopButton(),
    updatePauseButton(),
    updateLayoutSessionState());
  const r = document.getElementById("skip-btn");
  r && (r.style.display = "none");
  const a = summaryData.length,
    n = summaryData.filter((e) => e.correct).length,
    s = 0 === a ? 0 : Math.round((n / a) * 100),
    i =
      0 === a ? 0 : summaryData.reduce((e, t) => e + parseFloat(t.time), 0) / a,
    l = getGameMode(),
    o = getZoneMode(),
    uScore = getSessionScoreValue(l),
    poolSize =
      "marathon" === l || "chrono" === l ? getCurrentSessionPoolSize() : a;
  let u = null;
  if ("quartier" === o) {
    const e = document.getElementById("quartier-select");
    e && e.value && (u = e.value);
  }
  const d = document.getElementById("summary");
  if (!d) return;
  if (100 === s && a > 0) {
    const e = 5e3,
      t = Date.now() + e,
      r = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 },
      a = (e, t) => Math.random() * (t - e) + e,
      n = setInterval(function () {
        const s = t - Date.now();
        if (s <= 0) return clearInterval(n);
        const i = (s / e) * 50;
        (confetti({
          ...r,
          particleCount: i,
          origin: { x: a(0.1, 0.3), y: Math.random() - 0.2 },
        }),
          confetti({
            ...r,
            particleCount: i,
            origin: { x: a(0.7, 0.9), y: Math.random() - 0.2 },
          }));
      }, 250);
  }
  d.innerHTML = "";
  const c = document.createElement("div");
  c.className = "summary-global";
  const m = document.createElement("h2");
  let p;
  ((m.textContent = "Récapitulatif de la session"),
    c.appendChild(m),
    (p =
      "marathon" === l
        ? "Mode : Marathon (max. 3 erreurs)"
        : "chrono" === l
          ? "Mode : Chrono (60 s)"
          : "Mode : Classique (20 items max)"),
    (p += ` – Zone : ${o}`),
    u && (p += ` – Quartier : ${u}`));
  const g = document.createElement("p");
  ((g.textContent = p), c.appendChild(g));
  const h = document.createElement("div");
  const yScoreLine =
    "classique" === l
      ? `<p>Score pondéré : <strong>${uScore.toFixed(1)} pts</strong></p>`
      : "marathon" === l
        ? `<p>Rues trouvées : <strong>${Math.round(uScore)} / ${poolSize || 0}</strong></p>`
        : `<p>Rues trouvées : <strong>${Math.round(uScore)}</strong> en 60 s</p>`;
  ((h.className = "summary-stats"),
    (h.innerHTML = `<p>Temps total : <strong>${t.toFixed(1)} s</strong></p>\n     <p>Temps moyen par item : <strong>${i.toFixed(1)} s</strong></p>\n     <p>Score : <strong>${s} %</strong> (${n} bonnes réponses / ${a})</p>\n     ${yScoreLine}`),
    c.appendChild(h),
    d.appendChild(c));
  const y = document.createElement("div");
  y.className = "summary-detail";
  const v = document.createElement("div");
  v.className = "summary-detail-header";
  const f = document.createElement("h3");
  ((f.textContent = "Détail par item (cliquable pour zoomer et voir la fiche)"),
    v.appendChild(f));
  const b = document.createElement("div");
  b.className = "summary-filters";
  let S = "all";
  ([
    { value: "all", label: "Tous" },
    { value: "correct", label: "Corrects" },
    { value: "incorrect", label: "Incorrects" },
  ].forEach((e) => {
    const t = document.createElement("button");
    ((t.type = "button"),
      (t.className = "summary-filter-btn"),
      (t.dataset.filter = e.value),
      (t.textContent = e.label),
      e.value === S && t.classList.add("is-active"),
      b.appendChild(t));
  }),
    v.appendChild(b),
    y.appendChild(v));
  const L = document.createElement("ul");
  function M(e) {
    L.querySelectorAll(".summary-item").forEach((t) => {
      const r = "true" === t.dataset.correct;
      let a = !1;
      ("all" === e
        ? (a = !0)
        : "correct" === e
          ? (a = r)
          : "incorrect" === e && (a = !r),
        (t.style.display = a ? "" : "none"));
    });
  }
  ((L.className = "summary-list"),
    summaryData.forEach((e) => {
      const t = document.createElement("li");
      (t.classList.add("summary-item"),
        (t.dataset.correct = e.correct ? "true" : "false"),
        e.correct
          ? t.classList.add("summary-item--correct")
          : t.classList.add("summary-item--incorrect"),
        (t.textContent = `${e.name} – ${e.correct ? "Correct" : "Incorrect"} – ${e.time} s`),
        (t.dataset.streetName = e.name),
        t.addEventListener("click", () => {
          const t = focusStreetByName(e.name);
          t && t.feature && showStreetInfo(t.feature);
        }),
        L.appendChild(t));
    }),
    y.appendChild(L),
    d.appendChild(y),
    b.querySelectorAll(".summary-filter-btn").forEach((e) => {
      e.addEventListener("click", () => {
        const t = e.dataset.filter;
        t &&
          t !== S &&
          ((S = t),
            b.querySelectorAll(".summary-filter-btn").forEach((t) => {
              t.classList.toggle("is-active", t === e);
            }),
            M(S));
      });
    }),
    M(S),
    d.classList.remove("hidden"),
    showMessage("Session terminée.", "info"));
  const T = document.getElementById("target-street");
  (T && ((T.textContent = "—"), requestAnimationFrame(fitTargetStreetText)),
    refreshLectureStreetSearchForCurrentMode(),
    currentUser &&
    currentUser.token &&
    sendScoreToServer({
      zoneMode: o,
      quartierName: u,
      gameMode: l,
      score: uScore,
      percentCorrect: s,
      totalTimeSec: t,
      itemsTotal: poolSize,
      itemsCorrect: n,
    }),
    loadLeaderboard(o, u, l));
}
function updateScoreUI() {
  const e = document.getElementById("score"),
    t = document.getElementById("score-pill");
  if (!e) return;
  if (0 === totalAnswered)
    return (
      (e.textContent = "0 / 0 (0 %)"),
      void (t && (t.className = "score-pill score-pill--neutral"))
    );
  const r = Math.round((correctCount / totalAnswered) * 100);
  ((e.textContent = `${correctCount} / ${totalAnswered} (${r} %)`),
    t &&
    (t.className =
      r > 50
        ? "score-pill score-pill--good"
        : r > 0
          ? "score-pill score-pill--warn"
          : "score-pill score-pill--neutral"));
}
function updateTimeUI(e, t, r) {
  const a = document.getElementById("total-time"),
    n = document.getElementById("street-time");
  (a &&
    (null != r
      ? ((a.textContent = r.toFixed(1) + " s"),
        r > 30
          ? ((a.style.color = UI_THEME.timerSafe),
            a.classList.remove("chrono-blink"))
          : r > 10
            ? ((a.style.color = UI_THEME.timerWarn),
              a.classList.remove("chrono-blink"))
            : ((a.style.color = UI_THEME.timerDanger),
              r <= 5 && a.classList.add("chrono-blink")))
      : ((a.textContent = e.toFixed(1) + " s"),
        (a.style.color = ""),
        a.classList.remove("chrono-blink"))),
    n && (n.textContent = t.toFixed(1) + " s"));
}
function updateWeightedScoreUI() {
  const e = document.getElementById("weighted-score");
  if (!e) return;
  const t = getScoreMetricUIConfig(),
    r = getSessionScoreValue();
  e.textContent =
    t.decimals > 0 ? r.toFixed(t.decimals) : String(Math.round(r));
}
function updateWeightedBar(e) {
  const t = document.getElementById("weighted-score-bar");
  if (!t) return;
  const r = 100 * Math.max(0, Math.min(1, e));
  t.style.width = r + "%";
}
function updateSessionProgressBar() {
  const e = getGameMode();
  if ("classique" === e) return;
  if ("marathon" === e) {
    const e = getCurrentSessionPoolSize();
    return void updateWeightedBar(e > 0 ? correctCount / e : 0);
  }
  if ("chrono" === e) {
    const e = getTitleThresholds(
      getZoneMode(),
      "chrono",
      getCurrentSessionPoolSize(),
    ),
      t = Math.max(1, e.MV || 1);
    return void updateWeightedBar(correctCount / t);
  }
  updateWeightedBar(0);
}
function resetWeightedBar() {
  "classique" === getGameMode() ? updateWeightedBar(1) : updateSessionProgressBar();
}
function saveCurrentUserToStorage(e) {
  if (e)
    try {
      window.localStorage.setItem("camino_user", JSON.stringify(e));
    } catch (e) {
      console.warn("Impossible de sauvegarder l’utilisateur.", e);
    }
}
function loadCurrentUserFromStorage() {
  const e = window.localStorage.getItem("camino_user");
  if (!e) return null;
  try {
    return JSON.parse(e);
  } catch (e) {
    return (console.error("Erreur parsing user storage", e), null);
  }
}
function clearCurrentUserFromStorage() {
  try {
    window.localStorage.removeItem("camino_user");
  } catch (e) {
    console.warn("Impossible de supprimer l’utilisateur stocké.", e);
  }
}

function renderUserSticker() {
  const sticker = document.getElementById("user-sticker"),
    loginHint = document.getElementById("login-hint");
  if (!sticker) return;
  if (currentUser && currentUser.username) {
    const avatarValue = currentUser.avatar || '👤',
      avatarEl = document.createElement("span"),
      nameEl = document.createElement("span");
    ((avatarEl.className = "user-sticker-avatar"),
      (avatarEl.textContent = avatarValue),
      (nameEl.className = "user-sticker-name"),
      (nameEl.textContent = currentUser.username),
      sticker.replaceChildren(avatarEl, nameEl),
      (sticker.style.display = "inline-flex"),
      loginHint && (loginHint.style.display = "none"));
    return;
  }
  ((sticker.textContent = ""),
    (sticker.style.display = "none"),
    loginHint && (loginHint.style.display = ""));
}

function updateUserUI() {
  const e = document.getElementById("current-user-label"),
    t = document.querySelector(".auth-block"),
    r = document.getElementById("logout-btn"),
    a = document.getElementById("daily-mode-btn");
  if (currentUser && currentUser.username) {
    (e && (e.textContent = `Connecté en tant que ${currentUser.username}`),
      renderUserSticker(),
      t &&
      (t.querySelectorAll("input").forEach((e) => (e.style.display = "none")),
        t
          .querySelectorAll("button:not(#logout-btn)")
          .forEach((e) => (e.style.display = "none"))),
      r && (r.style.display = "inline-block"),
      a && (a.style.display = "inline-flex"));
    const i = document.getElementById("profile-panel");
    (i && (i.style.display = "block"), loadProfile());
  } else {
    (e && (e.textContent = "Non connecté."),
      renderUserSticker(),
      t &&
      (t.querySelectorAll("input").forEach((e) => (e.style.display = "")),
        t
          .querySelectorAll("button:not(#logout-btn)")
          .forEach((e) => (e.style.display = ""))),
      r && (r.style.display = "none"),
      a && (a.style.display = "none"));
    const i = document.getElementById("profile-panel");
    i && (i.style.display = "none");
  }
}
(infoEl && (infoEl.textContent = ""),
  (function () {
    const e = document.getElementById("weighted-score-help-btn"),
      t = document.getElementById("weighted-score-help");
    if (!e || !t) return;
    (t.id || (t.id = "weighted-score-help"),
      e.setAttribute("aria-controls", t.id),
      e.setAttribute("aria-expanded", "false"));
    const r = () => {
      (t.classList.remove("hidden"),
        t.classList.add("is-open"),
        e.setAttribute("aria-expanded", "true"));
    },
      a = () => {
        (t.classList.remove("is-open"),
          e.setAttribute("aria-expanded", "false"));
      };
    (e.addEventListener("mouseenter", r),
      e.addEventListener("mouseleave", a),
      t.addEventListener("mouseenter", r),
      t.addEventListener("mouseleave", a),
      e.addEventListener("focus", r),
      e.addEventListener("blur", a),
      e.addEventListener("click", (e) => {
        (e.preventDefault(), t.classList.contains("is-open") ? a() : r());
      }),
      document.addEventListener(
        "click",
        (r) => {
          e.contains(r.target) || t.contains(r.target) || a();
        },
        !0,
      ),
      document.addEventListener("keydown", (e) => {
        "Escape" === e.key && a();
      }));
  })());
const BADGE_DEFINITIONS = [
  {
    id: "first_game",
    emoji: "🎮",
    name: "Première Partie",
    desc: "Terminer une session",
    check: (e) => (parseInt(e.overall?.total_games) || 0) >= 1,
  },
  {
    id: "games_10",
    emoji: "🔟",
    name: "25 Parties",
    desc: "Jouer 25 sessions",
    check: (e) => (parseInt(e.overall?.total_games) || 0) >= 25,
  },
  {
    id: "games_50",
    emoji: "💯",
    name: "Habitué",
    desc: "Jouer 100 sessions",
    check: (e) => (parseInt(e.overall?.total_games) || 0) >= 100,
  },
  {
    id: "games_100",
    emoji: "💎",
    name: "Vétéran",
    desc: "Jouer 250 sessions",
    check: (e) => (parseInt(e.overall?.total_games) || 0) >= 250,
  },
  {
    id: "minot",
    emoji: "🧒",
    name: "Minot",
    desc: "Atteindre Minot dans tous les modes et toutes les zones",
    check: (e) => hasReachedGlobalRank(e, "M"),
  },
  {
    id: "habitue",
    emoji: "⚓",
    name: "Habitué du Vieux-Port",
    desc: "Atteindre Habitué dans tous les modes et toutes les zones",
    check: (e) => hasReachedGlobalRank(e, "H"),
  },
  {
    id: "vrai",
    emoji: "💪",
    name: "Vrai Marseillais",
    desc: "Atteindre Vrai Marseillais dans tous les modes et toutes les zones",
    check: (e) => hasReachedGlobalRank(e, "V"),
  },
  {
    id: "maire",
    emoji: "🏛️",
    name: "Maire de la Ville",
    desc: "Atteindre Maire dans tous les modes et toutes les zones",
    check: (e) => hasReachedGlobalRank(e, "MV"),
  },
  {
    id: "celebres",
    emoji: "⭐",
    name: "Étoile de la Caneb",
    desc: "Jouer en Rues Célèbres",
    check: (e) => (e.modes || []).some((e) => "rues-celebres" === e.mode),
  },
  {
    id: "ville",
    emoji: "🏙️",
    name: "Explorateur",
    desc: "Jouer en Ville Entière",
    check: (e) => (e.modes || []).some((e) => "ville" === e.mode),
  },
  {
    id: "monuments",
    emoji: "🗿",
    name: "Touriste Culturel",
    desc: "Jouer en mode Monuments",
    check: (e) => (e.modes || []).some((e) => "monuments" === e.mode),
  },
  {
    id: "all_zones",
    emoji: "🧭",
    name: "Globe-trotter",
    desc: "Jouer dans chaque zone",
    check: (e) => {
      const t = new Set((e.modes || []).map((e) => e.mode));
      return [
        "ville",
        "quartier",
        "rues-principales",
        "rues-celebres",
        "monuments",
      ].every((e) => t.has(e));
    },
  },
  {
    id: "daily_first",
    emoji: "📅",
    name: "Premier Daily",
    desc: "Réussir un Daily Challenge",
    check: (e) => (parseInt(e.daily?.successes) || 0) >= 1,
  },
  {
    id: "daily_5",
    emoji: "🔥",
    name: "Série de 10",
    desc: "10 Daily Challenges réussis d'affilée",
    check: (e) => (parseInt(e.daily?.max_streak) || 0) >= 10,
  },
  {
    id: "daily_10",
    emoji: "⚡",
    name: "Série de 20",
    desc: "20 Daily Challenges réussis d'affilée",
    check: (e) => (parseInt(e.daily?.max_streak) || 0) >= 20,
  },
  {
    id: "daily_30",
    emoji: "🏆",
    name: "Champion du Mois",
    desc: "50 Daily Challenges réussis d'affilée",
    check: (e) => (parseInt(e.daily?.max_streak) || 0) >= 50,
  },
  {
    id: "perfect",
    emoji: "🎯",
    name: "Sans Faute",
    desc: "Score de 100 dans une session",
    check: (e) => (parseFloat(e.overall?.best_score) || 0) >= 100,
  },
  {
    id: "multi_mode",
    emoji: "🌟",
    name: "Polyvalent",
    desc: "Jouer dans 3 modes de jeu différents",
    check: (e) => new Set((e.modes || []).map((e) => e.game_type)).size >= 3,
  },
];
function computeBadges(e) {
  return BADGE_DEFINITIONS.map((t) => ({ ...t, unlocked: t.check(e) }));
}
function loadProfile() {
  if (!currentUser || !currentUser.token) return;
  const e = document.getElementById("profile-content");
  e &&
    ((e.innerHTML =
      '<div class="skeleton skeleton-avatar"></div><div class="skeleton skeleton-line skeleton-line--60"></div><div class="skeleton skeleton-block"></div><div class="skeleton skeleton-line skeleton-line--80"></div>'),
      fetch(API_URL + "/api/profile", {
        headers: { Authorization: "Bearer " + currentUser.token },
      })
        .then((e) => {
          if (!e.ok) throw new Error("HTTP " + e.status);
          return e.json();
        })
        .then((t) => {
          if (currentUser) {
            const e = t.avatar || '👤',
              r = t.username || currentUser.username,
              a = currentUser.avatar !== e || currentUser.username !== r;
            ((currentUser.avatar = e),
              (currentUser.username = r),
              a && saveCurrentUserToStorage(currentUser),
              renderUserSticker());
          }
          const r = parseFloat(t.overall?.best_score) || 0,
            gRank = getGlobalRankMeta(t),
            a = gRank.title,
            n = parseInt(t.overall?.total_games) || 0,
            s = parseFloat(t.overall?.avg_score) || 0,
            i = parseInt(t.daily?.total_days) || 0,
            l = parseInt(t.daily?.successes) || 0,
            o = parseFloat(t.daily?.avg_attempts) || 0,
            u = t.memberSince
              ? new Date(t.memberSince).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
              : "—";
          let d = `\n        <div class="profile-header">
          <div class="profile-avatar">
            ${t.avatar || '👤'}
            <button type="button" class="edit-avatar-badge" id="btn-edit-avatar" title="Changer d'avatar" aria-label="Changer d'avatar">✏️</button>
          </div>\n          <div class="profile-info">\n            <div class="profile-name">${t.username}</div>\n            <div class="profile-title">${a}</div>\n          </div>\n        </div>\n\n        <div class="profile-stats-grid">\n          <div class="profile-stat">\n            <span class="profile-stat-value">${n}</span>\n            <span class="profile-stat-label">Parties</span>\n          </div>\n          <div class="profile-stat">\n            <span class="profile-stat-value">${r.toFixed(1)}</span>\n            <span class="profile-stat-label">Meilleur</span>\n          </div>\n          <div class="profile-stat">\n            <span class="profile-stat-value">${s}</span>\n            <span class="profile-stat-label">Moyenne</span>\n          </div>\n          <div class="profile-stat">\n            <span class="profile-stat-value">${l}/${i}</span>\n            <span class="profile-stat-label">Daily ✅</span>\n          </div>\n        </div>`;
          (t.modes &&
            t.modes.length > 0 &&
            ((d += '<div class="profile-modes-title">Détail par mode</div>'),
              (d += '<div class="profile-modes">'),
              t.modes.forEach((e) => {
                const t = ZONE_LABELS[e.mode] || e.mode,
                  r = GAME_LABELS[e.game_type] || e.game_type,
                  n = parseFloat(e.high_score) || 0,
                  s =
                    "classique" === e.game_type
                      ? n.toFixed(1)
                      : String(Math.round(n)),
                  a = getPlayerTitle(
                    n,
                    e.mode,
                    e.game_type,
                    e.best_items_total || 0,
                    e.best_items_correct || 0,
                  );
                d += `\n            <div class="profile-mode-row">\n              <div class="profile-mode-name">${t} — ${r}</div>\n              <div class="profile-mode-details">\n                <span>🏆 ${s}</span>\n                <span>📊 Ø${parseFloat(e.avg_score).toFixed(1)}</span>\n                <span>🎮 ${e.games_played}</span>\n              </div>\n              <div class="profile-mode-title">${a}</div>\n            </div>`;
              }),
              (d += "</div>")),
            i > 0 &&
            (d += `\n          <div class="profile-daily-summary">\n            <span>📅 Daily : ${o} essais en moyenne</span>\n            ${t.daily?.current_streak > 0 ? `<br><span class="profile-daily-current-streak">🔥 Série actuelle : ${t.daily.current_streak}</span>` : ''}\n            ${t.daily?.max_streak > 0 ? `<br><span class="profile-daily-best-streak">🏆 Meilleure série : ${t.daily.max_streak}</span>` : ''}\n          </div>`));
          const c = computeBadges(t),
            m = c.filter((e) => e.unlocked),
            p = c.filter((e) => !e.unlocked);
          ((d += `<div class="profile-badges-title">Succès (${m.length}/${c.length})</div>`),
            (d += '<div class="profile-badges-grid">'),
            m.forEach((e) => {
              d += `<div class="profile-badge unlocked" tabindex="0" title="${e.name}\n✅ ${e.desc}" aria-label="${e.name} débloqué. ${e.desc}">\n          <span class="badge-emoji">${e.emoji}</span>\n          <span class="badge-name">${e.name}</span>\n        </div>`;
            }),
            p.forEach((e) => {
              d += `<div class="profile-badge locked" tabindex="0" title="${e.name}\n🔒 ${e.desc}" aria-label="${e.name} verrouillé. ${e.desc}">\n          <span class="badge-emoji">🔒</span>\n          <span class="badge-name">${e.name}</span>\n        </div>`;
            }),
            (d += "</div>"),
            (d += `<div class="profile-member-since">Membre depuis le ${u}</div>`),
            (e.innerHTML = d));
          
          initAvatarSelector(t.avatar || '👤', gRank.level);
          
        })
        .catch((t) => {
          (console.warn("Profile error:", t.message),
            (e.innerHTML =
              '<p class="profile-unavailable">Profil indisponible.</p>'));
        }));
}

function initAvatarSelector(currentAvatar, globalRankLevel) {
  const btnEdit = document.getElementById('btn-edit-avatar');
  const modal = document.getElementById('avatar-selector-modal');
  const closeBtn = document.getElementById('avatar-modal-close');
  const grid = document.getElementById('avatar-grid');
  const profileStatsGrid = document.querySelector('.profile-stats-grid');
  
  if (!btnEdit || !modal || !grid) return;

  // Move the modal explicitly after the profile stats grid
  if (profileStatsGrid && profileStatsGrid.parentNode) {
    profileStatsGrid.parentNode.insertBefore(modal, profileStatsGrid.nextSibling);
  }

  btnEdit.addEventListener('click', () => {
    modal.style.display = 'block';
    renderAvatarGrid(currentAvatar, globalRankLevel);
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

function renderAvatarGrid(currentAvatar, globalRankLevel) {
  const grid = document.getElementById('avatar-grid');
  grid.innerHTML = '';
  
  AVATAR_UNLOCKS.forEach(avatarDef => {
    let requiredLevel = 0;
    let isUnlocked = false;

    if (typeof avatarDef.check === 'function') {
      isUnlocked = avatarDef.check(currentUser);
    } else {
      requiredLevel = getGlobalRankLevelForTitleIndex(avatarDef.reqTitleIdx);
      isUnlocked = globalRankLevel >= requiredLevel;
    }
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'avatar-item';
    item.textContent = avatarDef.emoji;
    
    if (avatarDef.emoji === currentAvatar) {
      item.classList.add('selected');
    }
    
    if (typeof avatarDef.check === 'function') {
      if (!isUnlocked) {
        item.classList.add('locked');
        item.disabled = true;
        item.title = `Titre spécifique requis:\n🔒 ${avatarDef.name}\n(${avatarDef.desc})`;
      } else {
        item.title = `Débloqué:\n✅ ${avatarDef.name}\n- ${avatarDef.desc}`;
      }
    } else {
      const reqTitle = TITLE_NAMES[avatarDef.reqTitleIdx];

      if (!isUnlocked) {
        item.classList.add('locked');
        item.disabled = true;
        item.title = `Titre global requis:\n🔒 ${reqTitle}\n(à atteindre dans tous les modes et zones)`;
      } else {
        item.title = `Débloqué:\n✅ ${reqTitle} (global)`;
        if (avatarDef.desc) item.title += ` - ${avatarDef.desc}`;
      }
    }
    
    if (isUnlocked) {
      item.addEventListener('click', () => {
        // Save avatar API call
        fetch(API_URL + '/api/profile/avatar', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentUser.token 
          },
          body: JSON.stringify({ avatar: avatarDef.emoji })
        })
        .then(res => {
          if (!res.ok) throw new Error('Erreur sauvegarde avatar');
          return res.json();
        })
        .then(data => {
          // Update local status
          currentUser.avatar = avatarDef.emoji;
          saveCurrentUserToStorage(currentUser);
          updateUserUI(); // Will refresh header & reload profile
          document.getElementById('avatar-selector-modal').style.display = 'none';
          showMessage("Avatar mis à jour !", "success");
        })
        .catch(err => {
          console.error(err);
          showMessage("Erreur lors de la sauvegarde de l'avatar", "error");
        });
      });
    }
    
    grid.appendChild(item);
  });
}

function sendScoreToServer(e) {
  if (!isDailyMode && currentUser && currentUser.token)
    try {
      fetch(API_URL + "/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + currentUser.token,
        },
        body: JSON.stringify({
          mode: e.zoneMode,
          gameType: e.gameMode,
          score: e.score,
          itemsCorrect: e.itemsCorrect,
          itemsTotal: e.itemsTotal,
          timeSec: e.totalTimeSec,
          quartierName: e.quartierName,
        }),
      })
        .then((e) => e.json())
        .then(() => {
          loadAllLeaderboards();
        })
        .catch((e) => {
          console.error("Erreur envoi score :", e);
        });
    } catch (e) {
      console.error("Erreur envoi score (synchrone) :", e);
    }
}
const TITLE_THRESHOLDS_BY_MODE = {
  classique: {
    "rues-celebres": { M: 60, H: 100, V: 140, MV: 180 },
    "rues-principales": { M: 50, H: 90, V: 130, MV: 170 },
    quartier: { M: 40, H: 80, V: 120, MV: 160 },
    ville: { M: 30, H: 70, V: 110, MV: 150 },
    monuments: { M: 40, H: 80, V: 120, MV: 160 },
  },
  marathon: {
    "rues-celebres": { M: 10, H: 20, V: 35, MV: 55 },
    "rues-principales": { M: 9, H: 18, V: 30, MV: 48 },
    ville: { M: 8, H: 16, V: 28, MV: 44 },
    monuments: { M: 9, H: 18, V: 30, MV: 46 },
  },
  chrono: {
    "rues-celebres": { M: 7, H: 11, V: 16, MV: 22 },
    "rues-principales": { M: 6, H: 10, V: 14, MV: 19 },
    quartier: { M: 5, H: 8, V: 12, MV: 16 },
    ville: { M: 4, H: 7, V: 10, MV: 14 },
    monuments: { M: 5, H: 8, V: 12, MV: 16 },
  },
},
  TITLE_NAMES = [
    "🏛️ Maire de la Ville",
    "💪 Vrai Marseillais",
    "⚓ Habitué du Vieux-Port",
    "🧒 Minot",
    "🧳 Touriste",
  ];
function buildQuartierMarathonThresholds(e) {
  const t = Math.max(1, parseInt(e, 10) || 55),
    r = Math.min(t, Math.max(1, Math.ceil(0.1 * t))),
    a = Math.min(t, Math.max(r + 1, Math.ceil(0.2 * t))),
    n = Math.min(t, Math.max(a + 1, Math.ceil(0.35 * t))),
    s = Math.min(t, Math.max(n + 1, Math.ceil(0.55 * t)));
  return { M: r, H: a, V: n, MV: s };
}
function getTitleThresholds(e, t = "classique", r = 0) {
  const a = TITLE_THRESHOLDS_BY_MODE[t] || TITLE_THRESHOLDS_BY_MODE.classique;
  if ("marathon" === t && "quartier" === e) return buildQuartierMarathonThresholds(r);
  return (
    a[e] ||
    a.quartier ||
    TITLE_THRESHOLDS_BY_MODE.classique[e] ||
    TITLE_THRESHOLDS_BY_MODE.classique.quartier
  );
}
function getTitleScoreValue(e, t, r = "classique") {
  if ("classique" === r) return parseFloat(e) || 0;
  const a = parseFloat(t);
  return Number.isFinite(a) ? a : parseFloat(e) || 0;
}
const SCORING_GAME_TYPES = ["classique", "marathon", "chrono"],
  SCORING_ZONES = [
    "rues-celebres",
    "rues-principales",
    "quartier",
    "monuments",
  ];
function getGlobalRankLevelForTitleIndex(e) {
  const parsed = parseInt(e, 10);
  return Math.max(0, 4 - (isNaN(parsed) ? 4 : parsed));
}
function getGlobalRankTitleFromLevel(e) {
  return e >= 4
    ? TITLE_NAMES[0]
    : e >= 3
      ? TITLE_NAMES[1]
      : e >= 2
        ? TITLE_NAMES[2]
        : e >= 1
          ? TITLE_NAMES[3]
          : TITLE_NAMES[4];
}
function buildScoringComboMap(e) {
  const t = new Map();
  return (
    (e?.modes || []).forEach((e) => {
      if (!e || !SCORING_GAME_TYPES.includes(e.game_type) || !SCORING_ZONES.includes(e.mode))
        return;
      t.set(`${e.mode}|${e.game_type}`, e);
    }),
    t
  );
}
function hasReachedGlobalRank(e, t) {
  const r = buildScoringComboMap(e);
  return SCORING_GAME_TYPES.every((a) =>
    SCORING_ZONES.every((n) => {
      const s = r.get(`${n}|${a}`);
      if (!s) return !1;
      const i = getTitleThresholds(n, a, s.best_items_total || 0),
        l = getTitleScoreValue(s.high_score, s.best_items_correct, a);
      return "number" == typeof i?.[t] && l >= i[t];
    }),
  );
}
function getGlobalRankLevel(e) {
  return hasReachedGlobalRank(e, "MV")
    ? 4
    : hasReachedGlobalRank(e, "V")
      ? 3
      : hasReachedGlobalRank(e, "H")
        ? 2
        : hasReachedGlobalRank(e, "M")
          ? 1
          : 0;
}
function getGlobalRankMeta(e) {
  const t = getGlobalRankLevel(e);
  return { level: t, title: getGlobalRankTitleFromLevel(t) };
}

const AVATAR_UNLOCKS = [
  // Default (0 pts)
  { emoji: '👤', reqScore: 0, reqTitleIdx: 4 },
  { emoji: '🧑', reqScore: 0, reqTitleIdx: 4 },
  { emoji: '👧', reqScore: 0, reqTitleIdx: 4 },
  
  // Minot (index 3)
  { emoji: '🧒', reqScore: 50, reqTitleIdx: 3 },
  { emoji: '🛴', reqScore: 50, reqTitleIdx: 3 },
  { emoji: '🍕', reqScore: 50, reqTitleIdx: 3 },

  // Habitué (index 2)
  { emoji: '⚓', reqScore: 80, reqTitleIdx: 2 },
  { emoji: '🐟', reqScore: 80, reqTitleIdx: 2 },
  { emoji: '⛵', reqScore: 80, reqTitleIdx: 2 },
  { emoji: '🌊', reqScore: 80, reqTitleIdx: 2 },

  // Vrai Marseillais (index 1)
  { emoji: '💪', reqScore: 120, reqTitleIdx: 1 },
  { emoji: '☀️', reqScore: 120, reqTitleIdx: 1 },
  { emoji: '🏖️', reqScore: 120, reqTitleIdx: 1 },
  { emoji: '😎', reqScore: 120, reqTitleIdx: 1 },

  // Maire (index 0)
  { emoji: '🏛️', reqScore: 150, reqTitleIdx: 0 },
  { emoji: '🦅', reqScore: 150, reqTitleIdx: 0, desc: 'Gabian' },
  { emoji: '⚽', reqScore: 150, reqTitleIdx: 0 },
  { emoji: '👑', reqScore: 150, reqTitleIdx: 0 },
  
  // Ville Spécial 
  { 
    emoji: '🛸',
    name: "Extraterrestre",
    desc: "Atteindre Maire sur la Ville Entière (Tous modes)",
    check: (user) => isMayorOfVille(user)
  },
  { 
    emoji: '🚀',
    name: "Astronaute",
    desc: "Atteindre Maire sur la Ville Entière (Tous modes)",
    check: (user) => isMayorOfVille(user)
  }
];

function isMayorOfVille(user) {
  const r = buildScoringComboMap(user);
  return SCORING_GAME_TYPES.every((gameType) => {
    const s = r.get(`ville|${gameType}`);
    if (!s) return false;
    const i = getTitleThresholds("ville", gameType, s.best_items_total || 0),
      l = getTitleScoreValue(s.high_score, s.best_items_correct, gameType);
    return typeof i?.MV === "number" && l >= i.MV;
  });
}
function getPlayerTitle(e, t, r = "classique", a = 0, n = null) {
  const s = getTitleThresholds(t, r, a),
    i = getTitleScoreValue(e, n, r);
  return i >= s.MV
    ? TITLE_NAMES[0]
    : i >= s.V
      ? TITLE_NAMES[1]
      : i >= s.H
        ? TITLE_NAMES[2]
        : i >= s.M
          ? TITLE_NAMES[3]
          : TITLE_NAMES[4];
}
const ZONE_LABELS = {
  ville: "Ville entière",
  "rues-principales": "Rues principales",
  "rues-celebres": "Rues célèbres",
  quartier: "Quartier",
  monuments: "Monuments",
},
  GAME_LABELS = {
    classique: "Classique",
    marathon: "Marathon",
    chrono: "Chrono",
    lecture: "Lecture",
  },
  ZONE_ORDER = [
    "rues-celebres",
    "rues-principales",
    "quartier",
    "ville",
    "monuments",
  ],
  GAME_ORDER = ["classique", "marathon", "chrono", "lecture"];
function loadAllLeaderboards() {
  const e = document.getElementById("leaderboard");
  e &&
    ((e.innerHTML =
      '<div class="skeleton skeleton-line skeleton-line--50"></div><div class="skeleton skeleton-block"></div><div class="skeleton skeleton-block"></div>'),
      Promise.all([
        fetch(API_URL + "/api/leaderboards").then(res => {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        }),
        fetch(API_URL + "/api/daily/leaderboard").then(res => {
          if (!res.ok) return [];
          return res.json();
        }).catch(() => [])
      ])
        .then(([t, dailyRows]) => {
          const r = Object.keys(t);
          if (0 === r.length && 0 === dailyRows.length)
            return void (e.innerHTML = "<p>Aucun score enregistré.</p>");

          (e.innerHTML = "");

          // 1. Build Daily Leaderboard first
          if (dailyRows && dailyRows.length > 0) {
            const dailyDetails = document.createElement("details");
            dailyDetails.className = "leaderboard-zone-details";
            dailyDetails.open = true; // explicitly keep daily open by default
            const dailySummary = document.createElement("summary");

            const todayStr = new Intl.DateTimeFormat('fr-FR', {
              day: '2-digit', month: '2-digit', year: '2-digit'
            }).format(new Date());

            dailySummary.innerHTML = `<span class="leaderboard-zone-title">Daily du ${todayStr}</span>`;
            dailyDetails.appendChild(dailySummary);

            const dailyContent = document.createElement("div");
            dailyContent.className = "leaderboard-zone-content";

            const table = document.createElement("table");
            table.className = "leaderboard-table";
            table.innerHTML = "<thead><tr><th>#</th><th>Joueur</th><th>Essais</th></tr></thead>";

            const tbody = document.createElement("tbody");
            dailyRows.forEach((row, i) => {
              const tr = document.createElement("tr");
              const rank = (0 === i ? "🥇 " : 1 === i ? "🥈 " : 2 === i ? "🥉 " : "") || `${i + 1}`;
              const pAvatar = row.avatar || '👤';
              tr.innerHTML = `<td>${rank}</td><td><span class="leaderboard-avatar">${pAvatar}</span>${row.username || "Anonyme"}</td><td>${row.attempts_count}/7</td>`;
              tbody.appendChild(tr);
            });
            table.appendChild(tbody);

            const modeContainer = document.createElement("div");
            modeContainer.className = "leaderboard-mode-container";
            const modeTitle = document.createElement("h4");
            modeTitle.className = "leaderboard-mode-title";
            modeTitle.textContent = "Défi du Jour";
            modeContainer.appendChild(modeTitle);

            const section = document.createElement("div");
            section.className = "leaderboard-section";
            section.appendChild(table);
            modeContainer.appendChild(section);

            dailyContent.appendChild(modeContainer);
            dailyDetails.appendChild(dailyContent);
            e.appendChild(dailyDetails);
          }

          // 2. Process all other leaderboards
          const a = {};
          (r.forEach((e) => {
            const r = e.split("|"),
              n = r[0],
              s = r[1],
              i = r[2] || null,
              l = t[e];
            l &&
              0 !== l.length &&
              (a[n] || (a[n] = {}),
                a[n][s] || (a[n][s] = []),
                a[n][s].push({ quartierName: i, rows: l }));
          }),
            ZONE_ORDER.forEach((t) => {
              if (!a[t]) return;
              const r = a[t],
                n = document.createElement("details");
              n.className = "leaderboard-zone-details";
              const s = document.createElement("summary"),
                i = ZONE_LABELS[t] || t;
              ((s.innerHTML = `<span class="leaderboard-zone-title">${i}</span>`), n.appendChild(s));
              const l = document.createElement("div");
              ((l.className = "leaderboard-zone-content"),
                GAME_ORDER.forEach((e) => {
                  if (!r[e]) return;
                  const a = r[e],
                    n = document.createElement("div");
                  n.className = "leaderboard-mode-container";
                  const s = document.createElement("h4");
                  ((s.className = "leaderboard-mode-title"),
                    (s.textContent = GAME_LABELS[e] || e),
                    n.appendChild(s),
                    a.sort((e, t) =>
                      e.quartierName && t.quartierName
                        ? e.quartierName.localeCompare(t.quartierName)
                        : 0,
                    ),
                    a.forEach((r) => {
                      const isQuartier = "quartier" === t && r.quartierName && "unknown" !== r.quartierName;
                      const a = document.createElement(isQuartier ? "details" : "div");
                      if (
                        ((a.className = "leaderboard-section"),
                          isQuartier)
                      ) {
                        const e = document.createElement("summary");
                        ((e.className = "leaderboard-quartier-title"),
                          (e.textContent = r.quartierName),
                          a.appendChild(e));
                      }
                      const s = document.createElement("table");
                      s.className = "leaderboard-table";
                      const i = document.createElement("thead");
                      let l = "<tr><th>#</th><th>Joueur</th>";
                      l += "classique" === e ? "<th>Score</th>" : "<th>Rues trouvées</th>";
                      "marathon" === e && (l += "<th>Max zone</th>");
                      "chrono" === e && (l += "<th>Temps</th>");
                      l += "<th>Parties</th></tr>";
                      i.innerHTML = l;
                      s.appendChild(i);
                      const o = document.createElement("tbody"),
                        u = document.createElement("tbody");
                      if (
                        ((u.className = "leaderboard-hidden-rows"),
                          (u.style.display = "none"),
                          r.rows.forEach((r, a) => {
                            const n = document.createElement("tr"),
                              s =
                                (0 === a
                                  ? "🥇 "
                                  : 1 === a
                                    ? "🥈 "
                                    : 2 === a
                                      ? "🥉 "
                                      : "") || `${a + 1}`,
                              i = getPlayerTitle(
                                r.high_score || 0,
                                t,
                                e,
                                r.items_total || 0,
                                r.items_correct || 0,
                              ),
                              pAvatar = r.avatar || '👤';
                            let l = `<td>${s}</td><td><span class="leaderboard-avatar">${pAvatar}</span>${r.username || "Anonyme"}<br><small class="leaderboard-player-meta">${i}</small></td>`;
                            const scoreCell =
                              "classique" === e
                                ? "number" == typeof r.high_score
                                  ? r.high_score.toFixed(1)
                                  : "-"
                                : `${r.items_correct || 0}`;
                            ((l += `<td>${scoreCell}</td>`),
                              "marathon" === e &&
                              (l += `<td>${r.items_total || 0}</td>`),
                              "chrono" === e &&
                              (l += `<td>${(r.time_sec || 0).toFixed(1)}s</td>`),
                              (l += `<td>${r.games_played || 0}</td>`),
                              (n.innerHTML = l),
                              a < LEADERBOARD_VISIBLE_ROWS
                                ? o.appendChild(n)
                                : u.appendChild(n));
                          }),
                          s.appendChild(o),
                          s.appendChild(u),
                          a.appendChild(s),
                          r.rows.length > LEADERBOARD_VISIBLE_ROWS)
                      ) {
                        const e = document.createElement("div");
                        e.className = "leaderboard-toggle-wrap";
                        const t = document.createElement("button");
                        ((t.className = "leaderboard-toggle-btn"),
                          (t.textContent = "▼ Voir les autres scores"),
                          (t.onclick = () => {
                            "none" === u.style.display
                              ? ((u.style.display = "table-row-group"),
                                (t.textContent = "▲ Masquer les scores"))
                              : ((u.style.display = "none"),
                                (t.textContent = "▼ Voir les autres scores"));
                          }),
                          e.appendChild(t),
                          a.appendChild(e));
                      }
                      n.appendChild(a);
                    }),
                    l.appendChild(n));
                }),
                n.appendChild(l),
                e.appendChild(n));
            }));

          // 3. Fallback open logic if Daily isn't present
          if (!dailyRows || dailyRows.length === 0) {
            const n = e.querySelector("details");
            n && (n.open = !0);
          }
        })
        .catch((t) => {
          (console.warn("Leaderboard indisponible :", t.message),
            (e.innerHTML = "<p>Aucun score enregistré.</p>"));
        }));
}
function loadLeaderboard(e, t, r) {
  loadAllLeaderboards();
}
async function handleDailyModeClick() {
  if (currentUser && currentUser.token)
    try {
      const e = await fetch(API_URL + "/api/daily", {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      });
      if (!e.ok) throw new Error("Erreur chargement défi");
      startDailySession(await e.json());
    } catch (e) {
      (console.error(e),
        showMessage("Impossible de charger le défi quotidien.", "error"));
    }
  else showMessage("Connectez-vous pour accéder au défi quotidien.", "warning");
}
let dailyTargetData = null,
  dailyTargetGeoJson = null,
  isDailyMode = !1,
  dailyHighlightLayer = null,
  dailyGuessHistory = [];
function startDailySession(e) {
  document.body.classList.remove("session-ended", "daily-game-over");
  ((dailyTargetData = e), (dailyTargetGeoJson = JSON.parse(e.targetGeoJson)));
  const t = e.userStatus || {};
  let r = !1,
    a = null;
  (t.success
    ? ((r = !0), (a = { success: !0, attempts: t.attempts_count }))
    : t.attempts_count >= 7 &&
    ((r = !0), (a = { success: !1, attempts: t.attempts_count })),
    (isDailyMode = !0),
    (isLectureMode = !1),
    setLectureTooltipsEnabled(!1),
    (dailyGuessHistory = []),
    (window._dailyGameOver = !1),
    (window._dailyGuessInFlight = !1));
  const n = document.getElementById("daily-guesses-history");
  (n && ((n.style.display = "none"), (n.innerHTML = "")),
    r
      ? restoreDailyGuessesFromStorage(e.date)
      : (t.attempts_count || 0) > 0 &&
      !t.success &&
      (restoreDailyGuessesFromStorage(e.date),
        dailyGuessHistory.length > 0 && renderDailyGuessHistory()),
    cleanOldDailyGuessStorage(e.date),
    isSessionRunning && endSession(),
    removeDailyHighlight(),
    (currentZoneMode = "ville"));
  const s = document.getElementById("mode-select"),
    i = document.getElementById("mode-select-button");
  s &&
    ((s.value = "ville"),
      i &&
      (i.innerHTML =
        '<span class="custom-select-label">Ville entière</span><span class="difficulty-pill difficulty-pill--hard">Difficile</span>'));
  const l = document.getElementById("target-street");
  l &&
    ((l.textContent = e.streetName),
      requestAnimationFrame(fitTargetStreetText));
  const o = Math.max(0, 7 - (t.attempts_count || 0)),
    u = document.getElementById("target-panel-title");
  (u &&
    (u.textContent = r
      ? t.success
        ? "🎉 Défi réussi !"
        : "❌ Défi échoué"
      : `🎯 Défi quotidien — ${o} essai${o > 1 ? "s" : ""} restant${o > 1 ? "s" : ""}`),
    (isSessionRunning = !0),
    refreshLectureStreetSearchForCurrentMode(),
    updateLayoutSessionState());
  const d = document.getElementById("skip-btn"),
    c = document.getElementById("pause-btn");
  (d && (d.style.display = "none"), c && (c.style.display = "none"));
  const m = document.getElementById("restart-btn");
  (m &&
    ((m.textContent = "Quitter le défi"),
      m.classList.remove("btn-primary"),
      m.classList.add("btn-stop"),
      (m.style.display = "")),
    s && s.dispatchEvent(new Event("change")),
    r
      ? (dailyGuessHistory.length > 0 && renderDailyGuessHistory(a),
        e.targetGeometry && highlightDailyTarget(e.targetGeometry, t.success),
        t.success
          ? showMessage(
            `🎉 Déjà réussi aujourd'hui en ${t.attempts_count} essai${t.attempts_count > 1 ? "s" : ""} !`,
            "success",
          )
          : showMessage(
            `❌ Plus d'essais pour aujourd'hui. La rue était « ${e.streetName} ».`,
            "error",
          ))
      : showMessage(`Trouvez : ${e.streetName} (${o} essais restants)`, "info"),
    updateDailyUI());
}
function endDailySession() {
  document.body.classList.remove("daily-game-over");
  ((isDailyMode = !1),
    (isSessionRunning = !1),
    (window._dailyGameOver = !1),
    (window._dailyGuessInFlight = !1));
  (updateTargetPanelTitle(),
    refreshLectureStreetSearchForCurrentMode(),
    updateStartStopButton(),
    updatePauseButton(),
    updateLayoutSessionState(),
    updateDailyUI(),
    updateDailyResultPanel());
}
function renderDailyGuessHistory(e) {
  try {
    const t = document.getElementById("daily-guesses-history");
    if (!t) return;
    if (!(0 !== dailyGuessHistory.length || (e && e.success)))
      return ((t.style.display = "none"), void (t.innerHTML = ""));
    t.style.display = "block";
    let r = "";
    dailyGuessHistory.length > 0 &&
      ((r += '<div class="daily-history-title">Essais précédents</div>'),
        (r += '<table class="daily-history-table">'),
        (r +=
          "<thead><tr><th>#</th><th>Rue tentée</th><th>Distance</th><th></th></tr></thead>"),
        (r += "<tbody>"),
        dailyGuessHistory.forEach((t, a) => {
          const n =
            t.distance >= 1e3
              ? `${(t.distance / 1e3).toFixed(1)} km`
              : `${Math.round(t.distance)} m`,
            s = a === dailyGuessHistory.length - 1 && !e;
          let i = "dist-cold";
          (t.distance < 500
            ? (i = "dist-hot")
            : t.distance < 2e3 && (i = "dist-warm"),
            (r += `<tr class="${s ? "daily-row-enter" : ""}">`),
            (r += `<td>${a + 1}</td>`),
            (r += `<td>${t.streetName}</td>`),
            (r += `<td class="${i}">${n}</td>`),
            (r += `<td class="daily-arrow">${t.arrow || ""}</td>`),
            (r += "</tr>"));
        }),
        (r += "</tbody></table>"));
    const a = dailyGuessHistory.length;
    if (a >= 2 && dailyTargetData && !e) {
      ((r += '<div class="daily-hints">'),
        (r += '<div class="daily-hints-title">💡 Indices</div>'));
      const t = dailyTargetData.quartier || "";
      try {
        const e = normalizeQuartierKey(t);
        if (arrondissementByQuartier && arrondissementByQuartier.has(e)) {
          const t = arrondissementByQuartier.get(e);
          t &&
            (r += `<div class="daily-hint">📍 Arrondissement : <strong>${t}</strong></div>`);
        }
      } catch (e) {
        console.error("Error with Hint 1:", e);
      }
      if (
        (a >= 4 &&
          t &&
          (r += `<div class="daily-hint">🏘️ Quartier : <strong>${t}</strong></div>`),
          a >= 6 && dailyTargetData.streetName)
      )
        try {
          const e = calculateStreetLength(dailyTargetData.streetName);
          if (e > 0) {
            const t =
              e >= 1e3 ? `${(e / 1e3).toFixed(1)} km` : `${Math.round(e)} m`;
            r += `<div class="daily-hint">📏 Longueur : <strong>~ ${t}</strong></div>`;
          }
        } catch (e) {
          console.error("Error with Hint 3:", e);
        }
      r += "</div>";
    }
    const historyContainer = document.getElementById("daily-guesses-history");
    if (historyContainer) {
      historyContainer.innerHTML = r;
    }
    const targetPanel = document.querySelector(".target-panel");
    if (targetPanel) {
      requestAnimationFrame(() => {
        targetPanel.scrollTop = targetPanel.scrollHeight;
      });
    }
  } catch (err) {
    console.error("Error in renderDailyGuessHistory:", err);
  }
}

function updateDailyResultPanel() {
  const panel = document.getElementById("daily-result-panel");
  const content = document.getElementById("daily-result-content");
  if (!panel || !content) return;

  if (isSessionRunning) {
    panel.style.display = "none";
    return;
  }

  let guesses = dailyGuessHistory;

  if (guesses.length === 0 && !window._dailyGameOver) {
    const today = new Date().toISOString().split("T")[0];
    const stored = localStorage.getItem(`camino_daily_guesses_${today}`);
    if (stored) {
      try {
        guesses = JSON.parse(stored);
      } catch (err) { }
    }
  }

  if (guesses.length === 0) {
    panel.style.display = "none";
    return;
  }

  const isSuccess = guesses.some(g => g.distance < 20);
  const isFinished = isSuccess || guesses.length >= 7 || window._dailyGameOver;

  if (!isFinished) {
    panel.style.display = "none";
    return;
  }

  const e = {
    success: isSuccess,
    attempts: guesses.length
  };

  let r = "";
  if (isSuccess) {
    const t = e.attempts;
    r += `<div class="daily-result daily-result--success">🎉 Bravo, vous avez trouvé la rue en ${t} essai${t > 1 ? "s" : ""} !</div>`;
  } else {
    const minDistance = Math.min(...guesses.map((g) => g.distance));
    const t = minDistance >= 1e3 ? `${(minDistance / 1e3).toFixed(1)} km` : `${Math.round(minDistance)} m`;
    r += `<div class="daily-result daily-result--fail">Votre meilleur score est ${t} en sept essais</div>`;
  }

  r += '<div class="daily-share-buttons">';
  r += '<button id="daily-share-text" class="btn-secondary daily-share-btn">📋 Copier le texte</button>';
  r += '<button id="daily-share-image" class="btn-primary daily-share-btn">📸 Partager l\'image</button>';
  r += "</div>";
  r += '<p class="daily-share-hint">L\'image est plus impactante sur les réseaux !</p>';

  content.innerHTML = r;
  panel.style.display = "block";

  const shareTextBtn = document.getElementById("daily-share-text"),
    shareImageBtn = document.getElementById("daily-share-image");
  if (shareTextBtn) shareTextBtn.onclick = () => handleDailyShareText(e);
  if (shareImageBtn) shareImageBtn.onclick = () => handleDailyShareImage(e);
}

function formatDailyDistanceForShare(e) {
  return e >= 1e3 ? `${(e / 1e3).toFixed(1)} km` : `${Math.round(e)} m`;
}
function getDailyShareDateLabel() {
  let e = null;
  if (dailyTargetData && "string" == typeof dailyTargetData.date) {
    const t = new Date(`${dailyTargetData.date}T12:00:00`);
    Number.isNaN(t.getTime()) || (e = t);
  }
  return (
    e || (e = new Date()),
    new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(e)
  );
}
function handleDailyShareText(e) {
  if (!dailyTargetData) return;
  const t = e.success ? e.attempts : "X",
    r = getDailyShareDateLabel(),
    a = dailyTargetData.streetName || "Rue inconnue",
    n =
      dailyGuessHistory.length > 0
        ? Math.min(...dailyGuessHistory.map((e) => e.distance))
        : null;
  let s = `🗺️ Camino Daily — ${r}\n📍 Rue: ${a}\n${e.success ? "✅" : "❌"} Résultat: ${t}/7\n\n`;
  (dailyGuessHistory.length > 0
    ? dailyGuessHistory.forEach((t, r) => {
      if (e.success && r === dailyGuessHistory.length - 1) s += "🟩 🏁\n";
      else {
        let e = "🟥";
        (t.distance < 500 ? (e = "🟩") : t.distance < 2e3 && (e = "🟨"),
          (s += `${e} ${t.arrow || "•"}\n`));
      }
    })
    : (s += "Aucun essai enregistré.\n"),
    null !== n &&
    Number.isFinite(n) &&
    (s += `\n🎯 Meilleure distance: ${formatDailyDistanceForShare(n)}\n`),
    (s += "Essaie de faire mieux sur camino-ajm.pages.dev"));
  if (navigator.clipboard && window.isSecureContext)
    navigator.clipboard
      .writeText(s)
      .then(() => {
        showMessage("Texte copié !", "success");
      })
      .catch(() => showMessage("Erreur lors de la copie", "error"));
  else
    try {
      const e = document.createElement("textarea");
      ((e.value = s),
        document.body.appendChild(e),
        e.select(),
        document.execCommand("copy"),
        document.body.removeChild(e),
        showMessage("Texte copié !", "success"));
    } catch (e) {
      showMessage("Impossible de copier", "error");
    }
}
function handleDailyShareImage(e) {
  if (!dailyTargetData) return;
  const t = document.createElement("canvas");
  ((t.width = 1080), (t.height = 1350));
  const r = t.getContext("2d");
  if (!r) return void showMessage("Erreur lors de la génération", "error");
  const a = t.width,
    n = t.height,
    s = a / 2,
    i = e.success ? e.attempts : "X",
    l = dailyTargetData.streetName || "Rue inconnue",
    o = getDailyShareDateLabel(),
    u =
      dailyGuessHistory.length > 0
        ? Math.min(...dailyGuessHistory.map((e) => e.distance))
        : null,
    d =
      null !== u && Number.isFinite(u) ? formatDailyDistanceForShare(u) : "—";
  function c(e, t, r, a, n, s, i) {
    const l = [],
      o = String(e).split(/\s+/);
    let u = "";
    o.forEach((e) => {
      const n = u ? `${u} ${e}` : e;
      r.measureText(n).width <= a || !u ? (u = n) : (l.push(u), (u = e));
    }),
      u && l.push(u);
    const d = Math.min(l.length, i);
    for (let e = 0; e < d; e++) {
      let a = l[e];
      e === i - 1 && l.length > i && (a += "…");
      r.fillText(a, t, n + e * s);
    }
    return d;
  }
  const m = r.createLinearGradient(0, 0, 0, n);
  (m.addColorStop(0, "#f8dca5"),
    m.addColorStop(0.35, "#f2a900"),
    m.addColorStop(0.68, "#4057b2"),
    m.addColorStop(1, "#12297a"),
    (r.fillStyle = m),
    r.fillRect(0, 0, a, n));
  const p = n * 0.47;
  ((r.globalAlpha = 0.3),
    (r.fillStyle = "#fff5cc"),
    r.beginPath(),
    r.arc(200, 190, 110, 0, 2 * Math.PI),
    r.fill(),
    (r.globalAlpha = 1));
  const g = r.createLinearGradient(0, p, 0, n);
  (g.addColorStop(0, "rgba(18,41,122,0.85)"),
    g.addColorStop(1, "rgba(12,29,87,0.95)"),
    (r.fillStyle = g),
    r.fillRect(0, p, a, n - p),
    (r.fillStyle = "rgba(10,23,69,0.55)"),
    r.beginPath(),
    r.moveTo(0, p + 30),
    r.lineTo(120, p + 8),
    r.lineTo(220, p - 22),
    r.lineTo(340, p + 18),
    r.lineTo(470, p - 8),
    r.lineTo(600, p + 26),
    r.lineTo(760, p - 3),
    r.lineTo(910, p + 20),
    r.lineTo(1080, p + 5),
    r.lineTo(1080, n),
    r.lineTo(0, n),
    r.closePath(),
    r.fill(),
    (r.strokeStyle = "rgba(255,255,255,0.15)"),
    (r.lineWidth = 2));
  for (let e = 0; e < 4; e++) {
    const t = p + 120 + 50 * e;
    (r.beginPath(),
      r.moveTo(80, t),
      r.bezierCurveTo(220, t - 18, 380, t + 20, 560, t),
      r.bezierCurveTo(730, t - 20, 910, t + 18, 1000, t),
      r.stroke());
  }
  const h = { x: 60, y: 60, w: a - 120, h: n - 120 };
  ((r.fillStyle = "rgba(2, 6, 23, 0.68)"),
    r.beginPath(),
    r.roundRect(h.x, h.y, h.w, h.h, 36),
    r.fill(),
    (r.strokeStyle = "rgba(255,255,255,0.22)"),
    (r.lineWidth = 2.5),
    r.stroke(),
    (r.textAlign = "center"),
    (r.fillStyle = "#f8fafc"),
    (r.font =
      '700 66px "Montserrat", "Avenir Next", "Segoe UI", sans-serif'),
    r.fillText("CAMINO DAILY", s, 170),
    (r.fillStyle = "rgba(226,232,240,0.95)"),
    (r.font = '500 32px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
    r.fillText(`Défi du ${o}`, s, 220),
    (r.fillStyle = "#fde68a"),
    (r.font = '600 32px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
    r.fillText("Rue du jour", s, 280),
    (r.fillStyle = "#ffffff"),
    (r.font = '700 42px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
    c(l, s, r, 820, 338, 54, 2));
  const y = { x: s - 150, y: 410, w: 300, h: 170 };
  ((r.fillStyle = e.success ? "#1f9d66" : "#d2463c"),
    r.beginPath(),
    r.roundRect(y.x, y.y, y.w, y.h, 28),
    r.fill(),
    (r.fillStyle = "#ffffff"),
    (r.font = '700 82px "Montserrat", "Avenir Next", "Segoe UI", sans-serif'),
    r.fillText(`${i}/7`, s, y.y + 98),
    (r.font = '600 28px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
    r.fillText(e.success ? "Défi réussi" : "Défi non résolu", s, y.y + 140));
  const v = h.x + 70,
    f = h.w - 140,
    b = 74,
    S = 610;
  if (dailyGuessHistory.length > 0)
    dailyGuessHistory.slice(0, 7).forEach((t, a) => {
      const n = S + a * (b + 12),
        i = e.success && a === dailyGuessHistory.length - 1;
      let l = "#d2463c";
      (i || t.distance < 500
        ? (l = "#1f9d66")
        : t.distance < 2e3 && (l = "#e08a00"),
        (r.fillStyle = "rgba(15,23,42,0.62)"),
        r.beginPath(),
        r.roundRect(v, n, f, b, 20),
        r.fill(),
        (r.strokeStyle = "rgba(148,163,184,0.25)"),
        (r.lineWidth = 1.4),
        r.stroke(),
        (r.fillStyle = "#e2e8f0"),
        (r.font = '600 30px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
        (r.textAlign = "left"),
        r.fillText(`#${a + 1}`, v + 24, n + 47),
        (r.fillStyle = l),
        r.beginPath(),
        r.roundRect(v + 112, n + 14, 42, 42, 10),
        r.fill(),
        (r.fillStyle = "#f8fafc"),
        (r.font = '600 34px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
        r.fillText(i ? "🏁" : t.arrow || "•", v + 174, n + 49),
        (r.fillStyle = i ? "#86efac" : "#e2e8f0"),
        (r.font = '600 30px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
        r.fillText(
          i ? "Trouvé !" : formatDailyDistanceForShare(t.distance),
          v + 246,
          n + 48,
        ));
    });
  else
    ((r.fillStyle = "rgba(226,232,240,0.9)"),
      (r.font = '600 30px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
      r.fillText("Aucun essai enregistré", v, S + 44));
  const L = { x: s + 20, y: S + 2 * (b + 12) - 6, w: h.x + h.w - 70 - (s + 20), h: 3 * (b + 12) + 12 };
  ((r.fillStyle = "rgba(15,23,42,0.82)"),
    r.beginPath(),
    r.roundRect(L.x, L.y, L.w, L.h, 20),
    r.fill(),
    (r.strokeStyle = "rgba(148,163,184,0.3)"),
    (r.lineWidth = 1.5),
    r.stroke());
  const Lcx = L.x + L.w / 2;
  ((r.textAlign = "center"),
    (r.fillStyle = "#f8fafc"),
    (r.font = '700 28px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
    r.fillText(`🎯 Meilleure`, Lcx, L.y + 42),
    r.fillText(`distance : ${d}`, Lcx, L.y + 76),
    (r.fillStyle = "#cbd5e1"),
    (r.font = '500 22px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
    r.fillText("Essaie de faire", Lcx, L.y + 130),
    r.fillText("mieux sur", Lcx, L.y + 158),
    (r.fillStyle = "#93c5fd"),
    (r.font = '700 24px "Nunito", "Avenir Next", "Segoe UI", sans-serif'),
    r.fillText("camino-ajm.pages.dev", Lcx, L.y + 200));
  t.toBlob(async (e) => {
    if (!e) return void showMessage("Erreur lors de la génération", "error");
    const t = new File([e], "camino-daily.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [t] }))
      try {
        return (
          await navigator.share({
            title: "Camino - Défi Quotidien",
            text: `${dailyTargetData.streetName} • ${i}/7\nEssaie de faire mieux sur camino-ajm.pages.dev`,
            files: [t],
          }),
          void showMessage("Partagé !", "success")
        );
      } catch (e) {
        if ("AbortError" === e.name) return;
      }
    if (navigator.clipboard && "undefined" != typeof ClipboardItem)
      try {
        return (
          await navigator.clipboard.write([new ClipboardItem({ "image/png": e })]),
          void showMessage("Image copiée dans le presse-papier !", "success")
        );
      } catch (e) { }
    const r = URL.createObjectURL(e),
      a = document.createElement("a");
    ((a.href = r),
      (a.download = "camino-daily.png"),
      a.click(),
      URL.revokeObjectURL(r),
      showMessage("Image téléchargée !", "success"));
  }, "image/png");
}
function getDirectionArrow(e, t) {
  const r = t[0] - e[0],
    a = t[1] - e[1],
    n = ((((180 * Math.atan2(r, a)) / Math.PI) % 360) + 360) % 360;
  return ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"][
    Math.round(n / 45) % 8
  ];
}
function saveDailyGuessesToStorage() {
  if (dailyTargetData && dailyTargetData.date)
    try {
      const e = `camino_daily_guesses_${dailyTargetData.date}`;
      localStorage.setItem(e, JSON.stringify(dailyGuessHistory));
    } catch (e) { }
}
function restoreDailyGuessesFromStorage(e) {
  try {
    const t = `camino_daily_guesses_${e}`,
      r = localStorage.getItem(t);
    r && (dailyGuessHistory = JSON.parse(r));
  } catch (e) {
    dailyGuessHistory = [];
  }
}
function cleanOldDailyGuessStorage(e) {
  try {
    for (let t = localStorage.length - 1; t >= 0; t--) {
      const r = localStorage.key(t);
      r &&
        r.startsWith("camino_daily_guesses_") &&
        !r.endsWith(e) &&
        localStorage.removeItem(r);
    }
  } catch (e) { }
}
function highlightDailyTarget(e, t) {
  if ((removeDailyHighlight(), !e || !map)) return;
  let r;
  try {
    r = "string" == typeof e ? JSON.parse(e) : e;
  } catch (e) {
    return void console.error("Invalid target geometry:", e);
  }
  const a = t ? UI_THEME.mapCorrect : UI_THEME.mapWrong;
  dailyHighlightLayer = L.geoJSON(
    { type: "Feature", geometry: r, properties: {} },
    {
      style: { color: a, weight: 6, opacity: 1, dashArray: t ? null : "8, 4" },
    },
  ).addTo(map);
  try {
    if (
      dailyHighlightLayer &&
      Object.keys(dailyHighlightLayer._layers).length > 0
    ) {
      const e = dailyHighlightLayer.getBounds();
      e &&
        e.isValid() &&
        map.fitBounds(e, {
          padding: [40, 40],
          maxZoom: 16,
          animate: !0,
          duration: 1.5,
        });
    }
  } catch (e) {
    console.error("Could not fit logic bounds", e);
  }
}
function removeDailyHighlight() {
  dailyHighlightLayer &&
    map &&
    (map.removeLayer(dailyHighlightLayer), (dailyHighlightLayer = null));
}
function getDistanceMeters(e, t, r, a) {
  const n = (e * Math.PI) / 180,
    s = (r * Math.PI) / 180,
    i = ((r - e) * Math.PI) / 180,
    l = ((a - t) * Math.PI) / 180,
    o =
      Math.sin(i / 2) * Math.sin(i / 2) +
      Math.cos(n) * Math.cos(s) * Math.sin(l / 2) * Math.sin(l / 2);
  return 2 * Math.atan2(Math.sqrt(o), Math.sqrt(1 - o)) * 6371e3;
}
function pointToSegmentDistance(e, t, r, a, n, s) {
  const i = 6371e3,
    l = Math.cos((e * Math.PI) / 180),
    o = (t * l * i * Math.PI) / 180,
    u = (e * i * Math.PI) / 180,
    d = (r * l * i * Math.PI) / 180,
    c = (a * i * Math.PI) / 180,
    m = (n * l * i * Math.PI) / 180 - d,
    p = (s * i * Math.PI) / 180 - c,
    g = o - d,
    h = u - c,
    y = m * m + p * p;
  let v = 0;
  0 !== y && (v = Math.max(0, Math.min(1, (g * m + h * p) / y)));
  const f = d + v * m,
    b = c + v * p,
    S = (o - f) * (o - f) + (u - b) * (u - b);
  return Math.sqrt(S);
}
function getDistanceToFeature(e, t, r) {
  if (!r) return 0;
  let a = 1 / 0;
  function n(r) {
    for (let n = 0; n < r.length - 1; n++) {
      const [s, i] = r[n],
        [l, o] = r[n + 1],
        u = pointToSegmentDistance(e, t, s, i, l, o);
      u < a && (a = u);
    }
  }
  return (
    "LineString" === r.type
      ? n(r.coordinates)
      : "MultiLineString" === r.type
        ? r.coordinates.forEach(n)
        : "Point" === r.type &&
        (a = getDistanceMeters(e, t, r.coordinates[1], r.coordinates[0])),
    a !== 1 / 0 ? a : 0
  );
}
function calculateStreetLength(e) {
  try {
    if (!e || !allStreetFeatures) return 0;
    const t = normalizeName(e),
      r = allStreetFeatures.find(
        (e) =>
          e &&
          e.properties &&
          e.properties.name &&
          normalizeName(e.properties.name) === t,
      );
    if (!r || !r.geometry || !r.geometry.coordinates) return 0;
    let a = 0;
    const n = r.geometry;
    if ("LineString" === n.type)
      for (let e = 0; e < n.coordinates.length - 1; e++) {
        const [t, r] = n.coordinates[e],
          [s, i] = n.coordinates[e + 1];
        a += getDistanceMeters(r, t, i, s);
      }
    else if ("MultiLineString" === n.type)
      for (const e of n.coordinates)
        for (let t = 0; t < e.length - 1; t++) {
          const [r, n] = e[t],
            [s, i] = e[t + 1];
          a += getDistanceMeters(n, r, i, s);
        }
    return a;
  } catch (e) {
    return (console.error("Error calculating street length:", e), 0);
  }
}
function computeFeatureCentroid(e) {
  const t = e.geometry;
  let r = [];
  if ("LineString" === t.type) r = t.coordinates;
  else {
    if ("MultiLineString" !== t.type)
      return "Point" === t.type ? t.coordinates : [5.3698, 43.2965];
    r = t.coordinates.flat();
  }
  if (0 === r.length) return [5.3698, 43.2965];
  const a = r.reduce((e, t) => [e[0] + t[0], e[1] + t[1]], [0, 0]);
  return [a[0] / r.length, a[1] / r.length];
}
function updateDailyUI() {
  const e = dailyTargetData ? dailyTargetData.userStatus : {},
    t = Math.max(dailyGuessHistory.length, e.attempts_count || 0),
    r = 7 - t;
  if (isDailyMode) {
    const t = document.getElementById("target-panel-title");
    t &&
      (e.success
        ? (t.textContent = "🎉 Défi réussi !")
        : (t.textContent =
          r <= 0
            ? "❌ Défi échoué"
            : `🎯 Défi quotidien — ${r} essai${r > 1 ? "s" : ""} restant${r > 1 ? "s" : ""}`));
  }
  const a = document.getElementById("daily-tries-counter");
  a &&
    (isDailyMode
      ? ((a.style.display = "flex"),
        (a.innerHTML = `<span>🎯</span> ${t} / 7 essais`))
      : (a.style.display = "none"));
}
function handleDailyStop() {
  triggerHaptic('click');
  return !!isDailyMode && (endDailySession(), removeDailyHighlight(), !0);
}
function fitTargetStreetText() {
  const e = document.getElementById("target-street");
  if (!e) return;
  if (!window.matchMedia("(max-width: 600px)").matches)
    return void (e.style.fontSize = "");
  e.style.whiteSpace = "nowrap";
  const t = e.clientWidth;
  if (t <= 0) return;
  if (((e.style.fontSize = "18px"), e.scrollWidth <= t)) return;
  let r = 11,
    a = 18,
    n = 11;
  for (; r <= a;) {
    const s = Math.floor((r + a) / 2);
    ((e.style.fontSize = s + "px"),
      e.scrollWidth <= t ? ((n = s), (r = s + 1)) : (a = s - 1));
  }
  e.style.fontSize = n + "px";
}
(window.addEventListener("resize", () => {
  requestAnimationFrame(fitTargetStreetText);
}),
  window.addEventListener("orientationchange", () => {
    requestAnimationFrame(fitTargetStreetText);
  }),
  "serviceWorker" in navigator &&
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((e) => {
        console.log("SW registered:", e.scope);
        e.update().catch(() => {});
      })
      .catch((e) => console.warn("SW registration failed:", e));

    updateHapticsUI();

    const userPanelDetails = document.querySelector('.user-panel details');
    if (userPanelDetails) {
      userPanelDetails.addEventListener('toggle', () => {
        triggerHaptic('click');
      });
    }
  }));

// --- HAPTIC FEEDBACK ---
const HAPTICS_ENABLED_KEY = "camino_haptics_enabled";

function isHapticsEnabled() {
  return localStorage.getItem(HAPTICS_ENABLED_KEY) !== "false"; // Default to true
}

function toggleHaptics() {
  const current = isHapticsEnabled();
  localStorage.setItem(HAPTICS_ENABLED_KEY, !current);
  updateHapticsUI();
  if (!current) {
    triggerHaptic('success'); // Demo the activation
  }
}

function updateHapticsUI() {
  const btn = document.getElementById("haptics-toggle");
  if (btn) {
    btn.textContent = isHapticsEnabled() ? "📳" : "📴";
  }
}

function triggerHaptic(type = 'click') {
  if (!isHapticsEnabled() || !navigator.vibrate) return;
  
  try {
    switch (type) {
      case 'click':
        navigator.vibrate(15);
        break;
      case 'success':
        navigator.vibrate([40, 30, 80]); // Light, pause, stronger
        break;
      case 'error':
        navigator.vibrate([50, 60, 50]); // Two distinct bumps
        break;
      case 'warm':
        navigator.vibrate(10); // Very light
        break;
    }
  } catch (e) {
    console.warn("Haptics failed or blocked:", e);
  }
}
