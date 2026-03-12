import {
  API_URL,
  CHRONO_DURATION,
  HIGHLIGHT_DURATION_MS,
  MAX_ERRORS_MARATHON,
  MAX_LECTURE_SEARCH_RESULTS,
  MAX_TIME_SECONDS,
  SESSION_SIZE,
  UI_THEME,
} from "./config.js";
import {
  AVATAR_UNLOCKS,
  GAME_LABELS,
  TITLE_NAMES,
  ZONE_LABELS,
  getGlobalRankLevelForTitleIndex,
  getGlobalRankMeta,
  hasReachedGlobalRank,
  getPlayerTitle,
  getTitleThresholds,
  loadAllLeaderboards,
  loadLeaderboard,
} from "./leaderboard.js";
import {
  initAvatarSelectorRuntime,
  loadProfileRuntime,
  renderAvatarGridRuntime,
  renderUserStickerRuntime,
  sendScoreToServerRuntime,
  updateUserUIRuntime,
} from "./profile-runtime.js";
import {
  calculateStreetLengthFromFeatures,
  computeFeatureCentroid,
  getDistanceMeters,
  getDistanceToFeature,
} from "./map.js";
import {
  buildUniqueStreetList as buildUniqueStreetListCore,
  createArrondissementByQuartierMap,
  getBaseStreetStyle as getBaseStreetStyleCore,
  getBaseStreetStyleFromName as getBaseStreetStyleFromNameCore,
  getCurrentZoneStreets as getCurrentZoneStreetsCore,
  highlightQuartierOnMap,
  isStreetVisibleInCurrentMode as isStreetVisibleInCurrentModeCore,
  loadQuartierPolygonsMap,
  normalizeQuartierKey,
  populateQuartiersUI,
  clearQuartierOverlayLayer,
} from "./map-session-core.js";
import {
  addTouchBufferForLayerRuntime,
  loadMonumentsRuntime,
  loadStreetsRuntime,
  setLectureTooltipsEnabledRuntime,
} from "./map-runtime.js";
import {
  playBuzz,
  playDing,
  playTick,
  playVictory,
  syncSoundToggleUI,
  toggleSound,
} from "./audio.js";
import { initOnboardingBanner, loadUniqueVisitorCounter } from "./onboarding.js";
import { toggleHaptics, triggerHaptic, updateHapticsUI } from "./haptics.js";
import {
  formatDailyDistanceForShare,
  getDailyGuessesStorageKey,
  getDailyMetaStorageKey,
  getDailyShareDateLabelFromDate as getDailyShareDateLabel,
  getDirectionArrow,
  getTodayDailyStorageDate,
} from "./daily.js";
import {
  buildSessionShareText,
  copySessionShareText,
  shareSessionShareText,
} from "./session-share.js";
import {
  cleanOldDailyGuessStorageRuntime,
  fitTargetStreetTextRuntime,
  handleDailyShareImageRuntime,
  handleDailyShareTextRuntime,
  highlightDailyTargetRuntime,
  removeDailyHighlightRuntime,
  renderDailyGuessHistoryRuntime,
  restoreDailyGuessesFromStorageRuntime,
  restoreDailyMetaFromStorageRuntime,
  saveDailyGuessesToStorageRuntime,
  saveDailyMetaToStorageRuntime,
  updateDailyResultPanelRuntime,
  updateDailyUIRuntime,
} from "./daily-runtime.js";
import { clearCurrentUserFromStorage, loadCurrentUserFromStorage, saveCurrentUserToStorage } from "./auth.js";
import { computeItemPoints, sampleWithoutReplacement, shuffle } from "./session.js";

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
let tooltipPopupEl = null,
  tooltipPopupTarget = null,
  tooltipHideTimeoutId = null;
function prefersTouchTooltips() {
  return !!(
    window.matchMedia &&
    window.matchMedia("(hover: none), (pointer: coarse)").matches
  );
}
function getTooltipTextFromTarget(e) {
  if (!e || "function" != typeof e.getAttribute) return "";
  const t = e.getAttribute("data-tooltip");
  return "string" == typeof t ? t.trim() : "";
}
function clearTooltipAutoHide() {
  tooltipHideTimeoutId &&
    (clearTimeout(tooltipHideTimeoutId), (tooltipHideTimeoutId = null));
}
function positionTooltipPopup(e) {
  if (!tooltipPopupEl || !e) return;
  const t = 8;
  tooltipPopupEl.style.maxWidth = `${Math.max(180, Math.min(280, window.innerWidth - 2 * t))}px`;
  const r = e.getBoundingClientRect();
  tooltipPopupEl.style.left = `${t}px`;
  tooltipPopupEl.style.top = `${t}px`;
  const a = tooltipPopupEl.getBoundingClientRect();
  let n = r.left + r.width / 2 - a.width / 2;
  n = Math.max(t, Math.min(n, window.innerWidth - a.width - t));
  let s = r.top - a.height - t;
  s < t && (s = r.bottom + t);
  const i = window.innerHeight - a.height - t;
  i < t ? (s = t) : s > i && (s = i);
  ((tooltipPopupEl.style.left = `${Math.round(n)}px`),
    (tooltipPopupEl.style.top = `${Math.round(s)}px`));
}
function showTooltipPopup(e) {
  if (!tooltipPopupEl || !e) return;
  const t = getTooltipTextFromTarget(e);
  if (!t) return;
  clearTooltipAutoHide(),
    (tooltipPopupTarget = e),
    (tooltipPopupEl.textContent = t),
    tooltipPopupEl.classList.add("visible"),
    positionTooltipPopup(e);
}
function hideTooltipPopup() {
  clearTooltipAutoHide(),
    tooltipPopupEl && tooltipPopupEl.classList.remove("visible"),
    (tooltipPopupTarget = null);
}
function scheduleTooltipAutoHide() {
  clearTooltipAutoHide(),
    (tooltipHideTimeoutId = setTimeout(() => {
      hideTooltipPopup();
    }, 2600));
}
function shouldShowTapTooltip(e) {
  return !!(
    e &&
    (e.classList.contains("tooltip-icon") ||
      e.classList.contains("profile-badge") ||
      (e.classList.contains("avatar-item") && e.classList.contains("locked")))
  );
}
function initTooltipPopup() {
  if (tooltipPopupEl) return;
  ((tooltipPopupEl = document.createElement("div")),
    (tooltipPopupEl.className = "tooltip-popup"),
    document.body.appendChild(tooltipPopupEl),
    document.addEventListener("mouseover", (e) => {
      if (prefersTouchTooltips()) return;
      const t = e.target.closest("[data-tooltip]");
      t && showTooltipPopup(t);
    }),
    document.addEventListener("mouseout", (e) => {
      if (prefersTouchTooltips()) return;
      const t = e.target.closest("[data-tooltip]");
      if (!t || t !== tooltipPopupTarget) return;
      const r = e.relatedTarget;
      (!r || !t.contains(r)) && hideTooltipPopup();
    }),
    document.addEventListener("focusin", (e) => {
      const t = e.target.closest("[data-tooltip]");
      t && showTooltipPopup(t);
    }),
    document.addEventListener("focusout", (e) => {
      const t = e.target.closest("[data-tooltip]");
      t && t === tooltipPopupTarget && hideTooltipPopup();
    }),
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-tooltip]");
      if (!t) return void (tooltipPopupTarget && hideTooltipPopup());
      if (!prefersTouchTooltips() || !shouldShowTapTooltip(t)) return;
      tooltipPopupTarget === t && tooltipPopupEl.classList.contains("visible")
        ? hideTooltipPopup()
        : (showTooltipPopup(t), scheduleTooltipAutoHide());
    }),
    window.addEventListener("scroll", () => {
      tooltipPopupTarget && positionTooltipPopup(tooltipPopupTarget);
    }, !0),
    window.addEventListener("resize", () => {
      tooltipPopupTarget && positionTooltipPopup(tooltipPopupTarget);
    }));
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
let arrondissementByQuartier = createArrondissementByQuartierMap(ARRONDISSEMENT_PAR_QUARTIER);
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
  const S = document.getElementById("sound-toggle"),
    N = document.getElementById("haptics-toggle");
  (S &&
    (syncSoundToggleUI(),
      S.addEventListener("click", () => {
        toggleSound();
      })),
    N &&
    (updateHapticsUI(),
      N.addEventListener("click", () => {
        toggleHaptics();
      })),
    initOnboardingBanner(),
    loadUniqueVisitorCounter());
  function L(e) {
    const t = document.getElementById("offline-banner");
    t && (t.style.display = e ? "block" : "none");
  }
  (initTooltipPopup(),
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
  (I && ((I.classList.add("hidden"), (I.innerHTML = ""))), clearSessionShareSlot());
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
function clearSessionShareSlot() {
  const e = document.getElementById("session-share-slot");
  e && ((e.innerHTML = ""), e.classList.add("hidden"));
}
function getBaseStreetStyleFromName(e) {
  return getBaseStreetStyleFromNameCore({
    zoneMode: getZoneMode(),
    streetName: e,
    normalizeName,
    uiTheme: UI_THEME,
    mainStreetNames: MAIN_STREET_NAMES,
    famousStreetNames: FAMOUS_STREET_NAMES,
  });
}
function getBaseStreetStyle(e) {
  return getBaseStreetStyleCore({
    layerOrFeature: e,
    zoneMode: getZoneMode(),
    selectedQuartier: getSelectedQuartier(),
    normalizeName,
    uiTheme: UI_THEME,
    mainStreetNames: MAIN_STREET_NAMES,
    famousStreetNames: FAMOUS_STREET_NAMES,
  });
}
function isStreetVisibleInCurrentMode(e, t) {
  return isStreetVisibleInCurrentModeCore({
    zoneMode: getZoneMode(),
    normalizedStreetName: e,
    quartierName: t,
    selectedQuartier: getSelectedQuartier(),
    famousStreetNames: FAMOUS_STREET_NAMES,
    mainStreetNames: MAIN_STREET_NAMES,
  });
}
function addTouchBufferForLayer(e) {
  addTouchBufferForLayerRuntime(e, { isTouchDevice: IS_TOUCH_DEVICE, map, L });
}
function loadStreets() {
  loadStreetsRuntime({
    map,
    L,
    uiTheme: UI_THEME,
    normalizeName,
    getBaseStreetStyle,
    isStreetVisibleInCurrentMode,
    isLayerHighlighted: (layer) => highlightedLayers && highlightedLayers.includes(layer),
    handleStreetClick,
    addTouchBufferForLayer,
  })
    .then((result) => {
      allStreetFeatures = result.allStreetFeatures;
      streetsLayer = result.streetsLayer;
      streetLayersById = result.streetLayersById;
      streetLayersByName = result.streetLayersByName;

      console.log(`Rues chargées : ${allStreetFeatures.length} en ${result.loadedMs}ms`);
      refreshLectureTooltipsIfNeeded();
      refreshLectureStreetSearchForCurrentMode({ preserveQuery: !0 });
      populateQuartiers();

      const modeSelect = document.getElementById("mode-select");
      if (modeSelect) {
        modeSelect.dispatchEvent(new Event("change"));
      }

      if (window.innerWidth > 900) {
        showMessage(
          'Carte chargée. Choisissez la zone, le type de partie, puis cliquez sur "Commencer la session".',
          "info",
        );
      }

      setMapStatus("Carte OK", "ready");
      document.body.classList.add("app-ready");
    })
    .catch((e) => {
      console.error("Erreur lors du chargement des rues :", e);
      showMessage("Erreur de chargement des rues (voir console).", "error");
      setMapStatus("Erreur", "error");
    });
}
function loadMonuments() {
  loadMonumentsRuntime({
    map,
    L,
    uiTheme: UI_THEME,
    isTouchDevice: IS_TOUCH_DEVICE,
    handleMonumentClick,
  })
    .then((result) => {
      allMonuments = result.allMonuments;
      console.log("Nombre de monuments chargés :", allMonuments.length);
      if (allMonuments.length === 0) {
        console.warn("Aucun monument trouvé après filtrage.");
      }

      if (monumentsLayer) {
        map.removeLayer(monumentsLayer);
        monumentsLayer = null;
      }
      monumentsLayer = result.monumentsLayer;

      refreshLectureTooltipsIfNeeded();
      if (getZoneMode() === "monuments") {
        map.hasLayer(monumentsLayer) || monumentsLayer.addTo(map);
        if (streetsLayer && map.hasLayer(streetsLayer)) {
          map.removeLayer(streetsLayer);
        }
      }
    })
    .catch((e) => {
      console.error("Erreur lors du chargement des monuments :", e);
    });
}
function setLectureTooltipsEnabled(e) {
  setLectureTooltipsEnabledRuntime(e, {
    streetsLayer,
    monumentsLayer,
    getBaseStreetStyle,
    isTouchDevice: IS_TOUCH_DEVICE,
  });
}
function refreshLectureTooltipsIfNeeded() {
  ("lecture" !== getGameMode() && !0 !== isLectureMode) ||
    setLectureTooltipsEnabled(!0);
}
function loadQuartierPolygons() {
  loadQuartierPolygonsMap()
    .then((byName) => {
      quartierPolygonsByName = byName;
      console.log("Quartiers chargés :", quartierPolygonsByName.size);
      console.log("Noms de quartiers (polygones):");
      console.log(Array.from(quartierPolygonsByName.keys()).sort());
    })
    .catch((e) => {
      console.error("Erreur lors du chargement des quartiers :", e);
    });
}
function highlightQuartier(e) {
  quartierOverlay = highlightQuartierOnMap({
    map,
    L,
    quartierName: e,
    quartierPolygonsByName,
    uiTheme: UI_THEME,
    existingOverlay: quartierOverlay,
  });
}
function clearQuartierOverlay() {
  quartierOverlay = clearQuartierOverlayLayer(map, quartierOverlay);
}
function populateQuartiers() {
  populateQuartiersUI({
    allStreetFeatures,
    arrondissementByQuartier,
    onQuartierChange: () => {
      const nativeSelect = document.getElementById("quartier-select");
      nativeSelect && nativeSelect.dispatchEvent(new Event("change"));
    },
  });
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
    (n && ((n.classList.add("hidden"), (n.innerHTML = ""))),
      clearSessionShareSlot(),
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
  return getCurrentZoneStreetsCore({
    allStreetFeatures,
    zoneMode: getZoneMode(),
    selectedQuartier: getSelectedQuartier(),
    normalizeName,
    mainStreetNames: MAIN_STREET_NAMES,
    famousStreetNames: FAMOUS_STREET_NAMES,
  });
}
function buildUniqueStreetList(e) {
  return buildUniqueStreetListCore(e, normalizeName);
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
    c.appendChild(h));
  const shareHost =
    window.location &&
    window.location.hostname &&
    "localhost" !== window.location.hostname &&
    "127.0.0.1" !== window.location.hostname
      ? window.location.host
      : "camino-ajm.pages.dev";
  const sessionShareText = buildSessionShareText({
    summaryData,
    gameMode: l,
    zoneMode: o,
    quartierName: u,
    totalTimeSec: t,
    averageTimeSec: i,
    scorePercent: s,
    correctCount: n,
    answeredCount: a,
    sessionScoreValue: uScore,
    poolSize,
    gameLabels: GAME_LABELS,
    zoneLabels: ZONE_LABELS,
    host: shareHost,
  });
  d.appendChild(c);
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
  const sessionSharePanel = document.createElement("div");
  sessionSharePanel.className = "session-share";
  const sessionShareButtons = document.createElement("div");
  sessionShareButtons.className = "daily-share-buttons session-share-buttons";
  const copyShareBtn = document.createElement("button");
  ((copyShareBtn.type = "button"),
    (copyShareBtn.className = "btn-secondary daily-share-btn"),
    (copyShareBtn.textContent = "📋 Copier le partage"),
    copyShareBtn.addEventListener("click", async () => {
      (copyShareBtn.disabled = !0);
      const e = await copySessionShareText(sessionShareText);
      ((copyShareBtn.disabled = !1),
        showMessage(e ? "Résultat copié !" : "Impossible de copier le résultat.", e ? "success" : "error"));
    }));
  const nativeShareBtn = document.createElement("button");
  ((nativeShareBtn.type = "button"),
    (nativeShareBtn.className = "btn-primary daily-share-btn"),
    (nativeShareBtn.textContent = "📤 Partager"));
  if (navigator.share)
    nativeShareBtn.addEventListener("click", async () => {
      (nativeShareBtn.disabled = !0);
      const e = await shareSessionShareText(sessionShareText);
      ((nativeShareBtn.disabled = !1),
        !0 === e
          ? showMessage("Partage envoyé !", "success")
          : !1 === e && showMessage("Impossible de partager ce résultat.", "error"));
    });
  else nativeShareBtn.style.display = "none";
  (sessionShareButtons.appendChild(copyShareBtn),
    sessionShareButtons.appendChild(nativeShareBtn),
    sessionSharePanel.appendChild(sessionShareButtons));
  const sessionShareHint = document.createElement("p");
  ((sessionShareHint.className = "daily-share-hint session-share-hint"),
    (sessionShareHint.textContent = "Résumé en grille emoji (format type Wordle)."),
    sessionSharePanel.appendChild(sessionShareHint));
  const sessionShareSlot = document.getElementById("session-share-slot");
  sessionShareSlot &&
    ((sessionShareSlot.innerHTML = ""),
      sessionShareSlot.appendChild(sessionSharePanel),
      sessionShareSlot.classList.remove("hidden"));
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
function renderUserSticker() {
  renderUserStickerRuntime(currentUser);
}

function updateUserUI() {
  updateUserUIRuntime({
    currentUser,
    renderUserSticker,
    loadProfile,
  });
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
function loadProfile() {
  loadProfileRuntime({
    currentUser,
    apiUrl: API_URL,
    saveCurrentUserToStorage,
    renderUserSticker,
    getGlobalRankMeta,
    getPlayerTitle,
    zoneLabels: ZONE_LABELS,
    gameLabels: GAME_LABELS,
    hasReachedGlobalRank,
    initAvatarSelector,
  });
}

function initAvatarSelector(currentAvatar, globalRankLevel) {
  initAvatarSelectorRuntime({
    currentAvatar,
    globalRankLevel,
    renderAvatarGrid: (avatar, rankLevel) => {
      renderAvatarGrid(avatar, rankLevel);
    },
  });
}

function renderAvatarGrid(currentAvatar, globalRankLevel) {
  renderAvatarGridRuntime({
    currentAvatar,
    globalRankLevel,
    avatarUnlocks: AVATAR_UNLOCKS,
    titleNames: TITLE_NAMES,
    currentUser,
    getGlobalRankLevelForTitleIndex,
    apiUrl: API_URL,
    saveCurrentUserToStorage,
    updateUserUI,
    showMessage,
  });
}

function sendScoreToServer(e) {
  sendScoreToServerRuntime({
    isDailyMode,
    currentUser,
    apiUrl: API_URL,
    payload: e,
    loadAllLeaderboards,
  });
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
  saveDailyMetaToStorage();
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
    clearSessionShareSlot(),
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
  renderDailyGuessHistoryRuntime({
    dailyGuessHistory,
    finalStatus: e,
    dailyTargetData,
    normalizeQuartierKey,
    arrondissementByQuartier,
    calculateStreetLengthFromFeatures,
    allStreetFeatures,
    normalizeName,
  });
}
function restoreDailyMetaFromStorage(e) {
  const t = restoreDailyMetaFromStorageRuntime(e, dailyTargetData, getDailyMetaStorageKey);
  if (!t) return !1;
  return ((dailyTargetData = t), !0);
}
async function ensureDailyShareContext(e, t) {
  Array.isArray(t) &&
    t.length > 0 &&
    (dailyGuessHistory = t.slice(0, 7).map((e) => ({ ...e })));
  if (
    dailyTargetData &&
    dailyTargetData.streetName &&
    (!e || !dailyTargetData.date || dailyTargetData.date === e)
  )
    return !0;
  if (restoreDailyMetaFromStorage(e)) return !0;
  if (!(currentUser && currentUser.token)) return !1;
  try {
    const t = await fetch(API_URL + "/api/daily", {
      headers: { Authorization: `Bearer ${currentUser.token}` },
    });
    if (!t.ok) return !1;
    const r = await t.json();
    if (!r || !r.streetName) return !1;
    if (e && r.date && r.date !== e) return !1;
    return (
      (dailyTargetData = { ...(dailyTargetData || {}), ...r }),
      saveDailyMetaToStorage(),
      !0
    );
  } catch (t) {
    return !1;
  }
}

function updateDailyResultPanel() {
  updateDailyResultPanelRuntime({
    isSessionRunning,
    dailyGuessHistory,
    dailyTargetData,
    isDailyGameOver: !!window._dailyGameOver,
    setDailyGuessHistory: (e) => {
      dailyGuessHistory = e;
    },
    getTodayDailyStorageDate,
    getDailyGuessesStorageKey,
    restoreDailyMetaFromStorage,
    ensureDailyShareContext,
    handleDailyShareText,
    handleDailyShareImage,
    showMessage,
  });
}

function handleDailyShareText(e) {
  handleDailyShareTextRuntime({
    result: e,
    dailyTargetData,
    dailyGuessHistory,
    getDailyShareDateLabel,
    formatDailyDistanceForShare,
    showMessage,
  });
}
function handleDailyShareImage(e) {
  handleDailyShareImageRuntime({
    result: e,
    dailyTargetData,
    dailyGuessHistory,
    getDailyShareDateLabel,
    formatDailyDistanceForShare,
    showMessage,
  });
}
function saveDailyGuessesToStorage() {
  saveDailyGuessesToStorageRuntime({
    dailyTargetData,
    dailyGuessHistory,
    getDailyGuessesStorageKey,
    getDailyMetaStorageKey,
  });
}
function saveDailyMetaToStorage() {
  saveDailyMetaToStorageRuntime(dailyTargetData, getDailyMetaStorageKey);
}
function restoreDailyGuessesFromStorage(e) {
  dailyGuessHistory = restoreDailyGuessesFromStorageRuntime(e, getDailyGuessesStorageKey);
}
function cleanOldDailyGuessStorage(e) {
  cleanOldDailyGuessStorageRuntime(e, { getDailyGuessesStorageKey, getDailyMetaStorageKey });
}
function highlightDailyTarget(e, t) {
  dailyHighlightLayer = highlightDailyTargetRuntime({
    targetGeometry: e,
    isSuccess: t,
    map,
    L,
    uiTheme: UI_THEME,
    dailyHighlightLayer,
  });
}
function removeDailyHighlight() {
  dailyHighlightLayer = removeDailyHighlightRuntime(map, dailyHighlightLayer);
}
function updateDailyUI() {
  updateDailyUIRuntime({
    isDailyMode,
    dailyTargetData,
    dailyGuessHistory,
  });
}
function handleDailyStop() {
  triggerHaptic('click');
  return !!isDailyMode && (endDailySession(), removeDailyHighlight(), !0);
}
function fitTargetStreetText() {
  fitTargetStreetTextRuntime("target-street");
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
