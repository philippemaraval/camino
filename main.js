(() => {
  // src/config.js
  var API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:" ? "http://localhost:3000" : "https://camino2.onrender.com";
  var LEADERBOARD_VISIBLE_ROWS = 3;
  var MAX_LECTURE_SEARCH_RESULTS = 8;
  var DAILY_GUESSES_STORAGE_PREFIX = "camino_daily_guesses_";
  var DAILY_META_STORAGE_PREFIX = "camino_daily_meta_";
  var UI_THEME = {
    mapStreet: "#f2a900",
    mapStreetHover: "#f8c870",
    mapCorrect: "#1f9d66",
    mapWrong: "#d2463c",
    mapQuartier: "#12297a",
    mapMonumentStroke: "#dfe6ff",
    mapMonumentFill: "#4057b2",
    timerSafe: "#1f9d66",
    timerWarn: "#e08a00",
    timerDanger: "#d2463c"
  };

  // src/haptics.js
  var HAPTICS_ENABLED_KEY = "camino_haptics_enabled";
  function isHapticsEnabled() {
    return localStorage.getItem(HAPTICS_ENABLED_KEY) !== "false";
  }
  function updateHapticsUI() {
    const button = document.getElementById("haptics-toggle");
    if (!button) {
      return;
    }
    button.textContent = isHapticsEnabled() ? "\u{1F4F3}" : "\u{1F4F4}";
  }
  function triggerHaptic(type = "click") {
    if (!isHapticsEnabled() || !navigator.vibrate) {
      return;
    }
    try {
      switch (type) {
        case "click":
          navigator.vibrate(15);
          break;
        case "success":
          navigator.vibrate([40, 30, 80]);
          break;
        case "error":
          navigator.vibrate([50, 60, 50]);
          break;
        case "warm":
          navigator.vibrate(10);
          break;
      }
    } catch (error) {
      console.warn("Haptics failed or blocked:", error);
    }
  }
  function toggleHaptics() {
    const currentValue = isHapticsEnabled();
    localStorage.setItem(HAPTICS_ENABLED_KEY, String(!currentValue));
    updateHapticsUI();
    if (!currentValue) {
      triggerHaptic("success");
    }
  }

  // src/audio.js
  var SOUND_STORAGE_KEY = "camino-sound";
  var soundEnabled = localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
  var audioContext = null;
  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return audioContext;
  }
  function playTone(frequency, durationSec, type = "sine", gain = 0.15, delaySec = 0) {
    if (!soundEnabled) {
      return;
    }
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(gain, ctx.currentTime + delaySec);
      envelope.gain.exponentialRampToValueAtTime(
        1e-3,
        ctx.currentTime + delaySec + durationSec
      );
      oscillator.connect(envelope);
      envelope.connect(ctx.destination);
      oscillator.start(ctx.currentTime + delaySec);
      oscillator.stop(ctx.currentTime + delaySec + durationSec);
    } catch (error) {
    }
  }
  function playDing() {
    playTone(880, 0.15, "sine", 0.12, 0);
    playTone(1320, 0.2, "sine", 0.1, 0.1);
  }
  function playBuzz() {
    playTone(150, 0.25, "sawtooth", 0.08, 0);
    playTone(120, 0.3, "square", 0.05, 0.05);
  }
  function playVictory() {
    playTone(523, 0.15, "sine", 0.12, 0);
    playTone(659, 0.15, "sine", 0.12, 0.15);
    playTone(784, 0.15, "sine", 0.12, 0.3);
    playTone(1047, 0.3, "triangle", 0.1, 0.45);
  }
  function syncSoundToggleUI() {
    const button = document.getElementById("sound-toggle");
    if (!button) {
      return;
    }
    button.textContent = soundEnabled ? "\u{1F50A}" : "\u{1F507}";
  }
  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_STORAGE_KEY, soundEnabled ? "on" : "off");
    syncSoundToggleUI();
    if (soundEnabled) {
      playDing();
    }
    triggerHaptic("click");
  }

  // src/onboarding.js
  var ONBOARDING_SEEN_KEY = "camino-onboarding-seen";
  var ONBOARDING_LEGACY_KEY = "camino-onboarded";
  var ONBOARDING_COOKIE_MAX_AGE_SECONDS = 31536e3;
  var VISITOR_ID_STORAGE_KEY = "camino_visitor_id";
  function readPersistentFlag(flagKey) {
    try {
      if (localStorage.getItem(flagKey) === "1") {
        return true;
      }
    } catch (error) {
    }
    try {
      return document.cookie.split(";").map((cookiePart) => cookiePart.trim()).some((cookiePart) => cookiePart === `${flagKey}=1`);
    } catch (error) {
      return false;
    }
  }
  function writePersistentFlag(flagKey) {
    try {
      localStorage.setItem(flagKey, "1");
    } catch (error) {
    }
    try {
      document.cookie = `${flagKey}=1; path=/; max-age=${ONBOARDING_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    } catch (error) {
    }
  }
  function hasSeenOnboarding() {
    return readPersistentFlag(ONBOARDING_SEEN_KEY) || readPersistentFlag(ONBOARDING_LEGACY_KEY);
  }
  function markOnboardingSeen() {
    writePersistentFlag(ONBOARDING_SEEN_KEY);
    writePersistentFlag(ONBOARDING_LEGACY_KEY);
  }
  function isValidVisitorId(value) {
    return typeof value === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
  }
  function generateVisitorId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID().replace(/-/g, "");
    }
    const fallback = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    return fallback.slice(0, 64);
  }
  function getOrCreateVisitorId() {
    try {
      const existingId = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
      if (isValidVisitorId(existingId)) {
        return existingId;
      }
    } catch (error) {
    }
    const newVisitorId = generateVisitorId();
    if (!isValidVisitorId(newVisitorId)) {
      return "";
    }
    try {
      localStorage.setItem(VISITOR_ID_STORAGE_KEY, newVisitorId);
    } catch (error) {
    }
    return newVisitorId;
  }
  function updateVisitorCounterLabel(uniqueVisitors) {
    const counter = document.getElementById("visitor-counter");
    if (!counter || !Number.isFinite(uniqueVisitors) || uniqueVisitors < 0) {
      return;
    }
    counter.textContent = `Visiteurs uniques : ${new Intl.NumberFormat("fr-FR").format(Math.trunc(uniqueVisitors))}`;
  }
  async function loadUniqueVisitorCounter() {
    const counter = document.getElementById("visitor-counter");
    if (!counter) {
      return;
    }
    const visitorId = getOrCreateVisitorId();
    if (!visitorId) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/visitors/hit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId })
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      const uniqueVisitors = Number(payload.uniqueVisitors);
      if (Number.isFinite(uniqueVisitors)) {
        updateVisitorCounterLabel(uniqueVisitors);
      }
    } catch (error) {
    }
  }
  function setOnboardingVisibility(showBanner) {
    const banner = document.getElementById("onboarding-banner");
    if (!banner) {
      return;
    }
    if (showBanner) {
      banner.classList.remove("hidden");
      banner.style.display = "flex";
      return;
    }
    banner.classList.add("hidden");
    banner.style.display = "none";
  }
  function initOnboardingBanner() {
    const closeButton = document.getElementById("onboarding-close");
    if (closeButton && !closeButton.__onboardingBound) {
      closeButton.__onboardingBound = true;
      closeButton.addEventListener("click", () => {
        markOnboardingSeen();
        setOnboardingVisibility(false);
      });
    }
    if (hasSeenOnboarding()) {
      setOnboardingVisibility(false);
      return;
    }
    markOnboardingSeen();
    setOnboardingVisibility(true);
  }

  // src/app.js
  var FAMOUS_STREET_INFOS = {};
  var MAIN_STREET_INFOS = {};
  async function loadStreetInfos() {
    try {
      const response = await fetch("data/street_infos.json?v=" + Date.now());
      const data = await response.json();
      FAMOUS_STREET_INFOS = data.famous || {};
      MAIN_STREET_INFOS = data.main || {};
      console.log("Street infos loaded");
    } catch (error) {
      console.error("Failed to load street infos", error);
    }
  }
  function normalizeName(e) {
    return (e || "").trim().toLowerCase();
  }
  function normalizeSearchText(e) {
    return normalizeName(e).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  var tooltipPopupEl = null;
  var tooltipPopupTarget = null;
  var tooltipHideTimeoutId = null;
  function prefersTouchTooltips() {
    return !!(window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches);
  }
  function getTooltipTextFromTarget(e) {
    if (!e || "function" != typeof e.getAttribute) return "";
    const t = e.getAttribute("data-tooltip");
    return "string" == typeof t ? t.trim() : "";
  }
  function clearTooltipAutoHide() {
    tooltipHideTimeoutId && (clearTimeout(tooltipHideTimeoutId), tooltipHideTimeoutId = null);
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
    i < t ? s = t : s > i && (s = i);
    tooltipPopupEl.style.left = `${Math.round(n)}px`, tooltipPopupEl.style.top = `${Math.round(s)}px`;
  }
  function showTooltipPopup(e) {
    if (!tooltipPopupEl || !e) return;
    const t = getTooltipTextFromTarget(e);
    if (!t) return;
    clearTooltipAutoHide(), tooltipPopupTarget = e, tooltipPopupEl.textContent = t, tooltipPopupEl.classList.add("visible"), positionTooltipPopup(e);
  }
  function hideTooltipPopup() {
    clearTooltipAutoHide(), tooltipPopupEl && tooltipPopupEl.classList.remove("visible"), tooltipPopupTarget = null;
  }
  function scheduleTooltipAutoHide() {
    clearTooltipAutoHide(), tooltipHideTimeoutId = setTimeout(() => {
      hideTooltipPopup();
    }, 2600);
  }
  function shouldShowTapTooltip(e) {
    return !!(e && (e.classList.contains("tooltip-icon") || e.classList.contains("profile-badge") || e.classList.contains("avatar-item") && e.classList.contains("locked")));
  }
  function initTooltipPopup() {
    if (tooltipPopupEl) return;
    tooltipPopupEl = document.createElement("div"), tooltipPopupEl.className = "tooltip-popup", document.body.appendChild(tooltipPopupEl), document.addEventListener("mouseover", (e) => {
      if (prefersTouchTooltips()) return;
      const t = e.target.closest("[data-tooltip]");
      t && showTooltipPopup(t);
    }), document.addEventListener("mouseout", (e) => {
      if (prefersTouchTooltips()) return;
      const t = e.target.closest("[data-tooltip]");
      if (!t || t !== tooltipPopupTarget) return;
      const r = e.relatedTarget;
      (!r || !t.contains(r)) && hideTooltipPopup();
    }), document.addEventListener("focusin", (e) => {
      const t = e.target.closest("[data-tooltip]");
      t && showTooltipPopup(t);
    }), document.addEventListener("focusout", (e) => {
      const t = e.target.closest("[data-tooltip]");
      t && t === tooltipPopupTarget && hideTooltipPopup();
    }), document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-tooltip]");
      if (!t) return void (tooltipPopupTarget && hideTooltipPopup());
      if (!prefersTouchTooltips() || !shouldShowTapTooltip(t)) return;
      tooltipPopupTarget === t && tooltipPopupEl.classList.contains("visible") ? hideTooltipPopup() : (showTooltipPopup(t), scheduleTooltipAutoHide());
    }), window.addEventListener("scroll", () => {
      tooltipPopupTarget && positionTooltipPopup(tooltipPopupTarget);
    }, true), window.addEventListener("resize", () => {
      tooltipPopupTarget && positionTooltipPopup(tooltipPopupTarget);
    });
  }
  var map = null;
  var currentZoneMode = "ville";
  var streetsLayer = null;
  var allStreetFeatures = [];
  var streetLayersById = /* @__PURE__ */ new Map();
  var streetLayersByName = /* @__PURE__ */ new Map();
  var monumentsLayer = null;
  var allMonuments = [];
  var sessionMonuments = [];
  var currentMonumentIndex = 0;
  var currentMonumentTarget = null;
  var isMonumentsMode = false;
  var quartierPolygonsByName = /* @__PURE__ */ new Map();
  var quartierOverlay = null;
  function normalizeQuartierKey(e) {
    if (!e) return "";
    let t = e.trim();
    const r = t.match(/^(.+)\s+\((L'|L’|La|Le|Les)\)$/i);
    if (r) {
      let e2 = r[1].trim(), a = r[2].trim();
      a = /^l[’']/i.test(a) ? "L'" : a.charAt(0).toUpperCase() + a.slice(1).toLowerCase(), t = `${a} ${e2}`;
    }
    return t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), t = t.replace(/\s+/g, " ").toLowerCase(), t;
  }
  var arrondissementByQuartier = /* @__PURE__ */ new Map();
  Object.entries(ARRONDISSEMENT_PAR_QUARTIER).forEach(([e, t]) => {
    arrondissementByQuartier.set(normalizeQuartierKey(e), t);
  });
  var sessionStreets = [];
  var currentIndex = 0;
  var currentTarget = null;
  var isSessionRunning = false;
  var sessionStartTime = null;
  var streetStartTime = null;
  var isPaused = false;
  var pauseStartTime = null;
  var remainingChronoMs = null;
  var isChronoMode = false;
  var chronoEndTime = null;
  var correctCount = 0;
  var totalAnswered = 0;
  var summaryData = [];
  var weightedScore = 0;
  var errorsCount = 0;
  var highlightTimeoutId = null;
  var highlightedLayers = [];
  var messageTimeoutId = null;
  var currentUser = null;
  var isLectureMode = false;
  var hasAnsweredCurrentItem = false;
  var lectureStreetSearchIndex = [];
  var lectureStreetSearchMatches = [];
  function getSessionScoreValue(e = getGameMode()) {
    return "classique" === e ? weightedScore : correctCount;
  }
  function getCurrentSessionPoolSize() {
    return "monuments" === getZoneMode() ? sessionMonuments.length : sessionStreets.length;
  }
  function getScoreMetricUIConfig(e = getGameMode()) {
    if ("marathon" === e)
      return {
        label: "Rues trouv\xE9es",
        legend: "Score = nombre de rues trouv\xE9es (objectif: aller le plus loin possible).",
        help: "<strong>Rues trouv\xE9es (Marathon)</strong><br>Le score correspond au nombre de rues trouv\xE9es avant la limite d'erreurs.<br><br>Le maximum d\xE9pend de la zone s\xE9lectionn\xE9e.",
        decimals: 0
      };
    if ("chrono" === e)
      return {
        label: "Rues trouv\xE9es",
        legend: "Score = nombre de rues trouv\xE9es en 60 secondes.",
        help: "<strong>Rues trouv\xE9es (Chrono)</strong><br>Le score correspond au nombre de rues trouv\xE9es dans le temps imparti (60 s).",
        decimals: 0
      };
    return {
      label: "Score pond\xE9r\xE9",
      legend: "Chaque bonne r\xE9ponse: jusqu'\xE0 10 points selon la rapidit\xE9.",
      help: "<strong>Score pond\xE9r\xE9</strong><br>Chaque bonne r\xE9ponse rapporte jusqu'\xE0 10 points selon la rapidit\xE9: 1 point en moins par seconde.<br>Au-del\xE0 de 10 secondes, aucun point.<br><br>Le score affich\xE9 est la somme des points de la session.",
      decimals: 1
    };
  }
  function updateScoreMetricUI() {
    const e = getScoreMetricUIConfig(), t = document.getElementById("weighted-score-label"), r = document.getElementById("weighted-score-legend"), a = document.getElementById("weighted-score-help"), n = document.getElementById("weighted-score-help-btn");
    t && (t.textContent = e.label);
    r && (r.textContent = e.legend);
    a && (a.innerHTML = e.help);
    n && n.setAttribute(
      "aria-label",
      "classique" === getGameMode() ? "Information sur le score pond\xE9r\xE9" : "Information sur le score"
    );
  }
  function setMapStatus(e, t) {
    const r = document.getElementById("map-status");
    r && (r.textContent = e, r.className = "map-status-pill", "loading" === t ? r.classList.add("map-status--loading") : "ready" === t ? r.classList.add("map-status--ready") : "error" === t && r.classList.add("map-status--error"));
  }
  var IS_TOUCH_DEVICE = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  var PULL_TO_REFRESH_THRESHOLD_PX = 92;
  var PULL_TO_REFRESH_TOP_ZONE_PX = 96;
  var PULL_TO_REFRESH_TOP_ZONE_STANDALONE_PX = 220;
  var isPullToRefreshBound = false;
  function isStandaloneDisplayMode() {
    if (window.navigator.standalone === true) return true;
    if ("function" != typeof window.matchMedia) return false;
    return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || window.matchMedia("(display-mode: minimal-ui)").matches;
  }
  function getPullToRefreshTopZonePx() {
    return isStandaloneDisplayMode() ? PULL_TO_REFRESH_TOP_ZONE_STANDALONE_PX : PULL_TO_REFRESH_TOP_ZONE_PX;
  }
  function getScrollableAncestor(e) {
    let t = e instanceof Element ? e : null;
    for (; t && t !== document.body; ) {
      const e2 = window.getComputedStyle(t), r = /(auto|scroll)/.test(e2.overflowY), a = t.scrollHeight - t.clientHeight > 2;
      if (r && a) return t;
      t = t.parentElement;
    }
    return null;
  }
  function canStartPullToRefresh(e, t) {
    if (t > getPullToRefreshTopZonePx()) return false;
    const r = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (r > 2) return false;
    const a = getScrollableAncestor(e);
    return !(a && a.scrollTop > 0);
  }
  function initMobilePullToRefresh() {
    if (!IS_TOUCH_DEVICE || isPullToRefreshBound) return;
    isPullToRefreshBound = true;
    let e = {
      active: false,
      eligible: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      maxPull: 0,
      reloaded: false
    };
    const t = () => {
      e = {
        active: false,
        eligible: false,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        maxPull: 0,
        reloaded: false
      };
    };
    document.addEventListener(
      "touchstart",
      (r2) => {
        if (1 !== r2.touches.length) return void t();
        const a = r2.touches[0], n = canStartPullToRefresh(r2.target, a.clientY);
        e = {
          active: true,
          eligible: n,
          startX: a.clientX,
          startY: a.clientY,
          lastX: a.clientX,
          lastY: a.clientY,
          maxPull: 0,
          reloaded: false
        };
      },
      { passive: true, capture: true }
    );
    document.addEventListener(
      "touchmove",
      (t2) => {
        if (!e.active || !e.eligible || e.reloaded || 1 !== t2.touches.length) return;
        const r2 = t2.touches[0], a = r2.clientY - e.startY, n = r2.clientX - e.startX;
        e.lastX = r2.clientX, e.lastY = r2.clientY;
        if (a < -12) return void (e.eligible = false);
        if (Math.abs(n) > Math.max(24, 1.25 * Math.abs(a)))
          return void (e.eligible = false);
        a > e.maxPull && (e.maxPull = a);
      },
      { passive: true, capture: true }
    );
    const r = (n) => {
      if (n.changedTouches && 1 === n.changedTouches.length) {
        const t2 = n.changedTouches[0];
        e.lastX = t2.clientX, e.lastY = t2.clientY;
      }
      if (!e.active || !e.eligible || e.reloaded) return void t();
      const a = Math.max(e.maxPull, e.lastY - e.startY), s = Math.abs(e.lastX - e.startX);
      if (a >= PULL_TO_REFRESH_THRESHOLD_PX && a > 1.35 * s) {
        e.reloaded = true, showMessage("Rafra\xEEchissement...", "info"), triggerHaptic("click"), setTimeout(() => window.location.reload(), 40);
        return;
      }
      t();
    };
    document.addEventListener("touchend", r, { passive: true, capture: true }), document.addEventListener("touchcancel", t, { passive: true, capture: true });
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
    const e = document.getElementById("mode-select"), t = document.getElementById("mode-difficulty-pill");
    if (!e || !t) return;
    const r = e.value;
    t.classList.remove(
      "difficulty-pill--easy",
      "difficulty-pill--medium",
      "difficulty-pill--hard"
    ), "rues-principales" === r ? (t.textContent = "Facile", t.classList.add("difficulty-pill--easy")) : "quartier" === r || "monuments" === r ? (t.textContent = "Faisable", t.classList.add("difficulty-pill--medium")) : "rues-celebres" === r ? (t.textContent = "Tr\xE8s Facile", t.classList.add("difficulty-pill--easy")) : "ville" === r ? (t.textContent = "Difficile", t.classList.add("difficulty-pill--hard")) : t.textContent = "";
  }
  function updateTargetPanelTitle() {
    const e = document.getElementById("target-panel-title") || document.querySelector(".target-panel .panel-title");
    if (!e) return;
    const t = getZoneMode();
    isLectureMode ? e.textContent = "monuments" === t ? "Monument \xE0 explorer" : "Recherche de rue" : e.textContent = "monuments" === t ? "Monument \xE0 trouver" : "Rue \xE0 trouver";
  }
  function getGameMode() {
    const e = document.getElementById("game-mode-select");
    return e ? e.value : "classique";
  }
  function updateGameModeControls() {
    const e = document.getElementById("game-mode-select"), t = document.getElementById("restart-btn"), r = document.getElementById("pause-btn");
    e && t && r && ("lecture" === e.value ? (t.style.display = "none", r.style.display = "none") : t.style.display = "", updateScoreMetricUI(), updateWeightedScoreUI(), updateSessionProgressBar(), refreshLectureStreetSearchForCurrentMode({ preserveQuery: true }));
  }
  function getLectureSearchElements() {
    return {
      container: document.getElementById("lecture-search"),
      input: document.getElementById("lecture-search-input"),
      results: document.getElementById("lecture-search-results"),
      target: document.getElementById("target-street")
    };
  }
  function closeLectureStreetSearchResults() {
    const { results } = getLectureSearchElements();
    results && (results.innerHTML = "", results.classList.add("hidden"));
    lectureStreetSearchMatches = [];
  }
  function setLectureStreetSearchVisible(e, t = false) {
    const { container, input, target } = getLectureSearchElements();
    if (!container || !target) return;
    if (e) {
      target.classList.add("hidden");
      container.classList.remove("hidden");
      return;
    }
    container.classList.add("hidden"), target.classList.remove("hidden"), closeLectureStreetSearchResults(), input && true !== t && (input.value = "", input.blur());
  }
  function buildLectureStreetSearchIndex() {
    if ("monuments" === getZoneMode())
      return void (lectureStreetSearchIndex = []);
    const e = buildUniqueStreetList(getCurrentZoneStreets()), t = /* @__PURE__ */ new Set();
    lectureStreetSearchIndex = e.map(
      (e2) => {
        var _a;
        return "string" == typeof ((_a = e2 == null ? void 0 : e2.properties) == null ? void 0 : _a.name) ? e2.properties.name.trim() : "";
      }
    ).filter((e2) => !!e2).filter((e2) => {
      const r = normalizeSearchText(e2);
      return !!r && (!t.has(r) && (t.add(r), true));
    }).map((e2) => {
      const t2 = normalizeSearchText(e2);
      return {
        name: e2,
        normalized: t2,
        words: t2.split(/[\s'’-]+/).filter(Boolean)
      };
    }).sort((e2, t2) => e2.name.localeCompare(t2.name, "fr", { sensitivity: "base" }));
  }
  function getLectureStreetMatchScore(e, t) {
    return e.normalized === t ? 0 : e.normalized.startsWith(t) ? 1 : e.words.some((e2) => e2.startsWith(t)) ? 2 : 3;
  }
  function findLectureStreetMatches(e) {
    const t = normalizeSearchText(e);
    if (!t) return [];
    return lectureStreetSearchIndex.filter((e2) => e2.normalized.includes(t)).sort((e2, r) => {
      const a = getLectureStreetMatchScore(e2, t), n = getLectureStreetMatchScore(r, t);
      return a - n || e2.name.localeCompare(r.name, "fr", { sensitivity: "base" });
    }).slice(0, MAX_LECTURE_SEARCH_RESULTS);
  }
  function renderLectureStreetSearchResults(e) {
    const { results } = getLectureSearchElements();
    if (!results) return;
    if (!e || 0 === e.length) {
      const e2 = document.createElement("div");
      return e2.className = "lecture-search-empty", e2.textContent = "Aucune rue trouv\xE9e.", results.innerHTML = "", results.appendChild(e2), void results.classList.remove("hidden");
    }
    results.innerHTML = "", e.forEach((e2) => {
      const t = document.createElement("button");
      t.type = "button", t.className = "lecture-search-result", t.textContent = e2.name, t.addEventListener("click", () => {
        focusLectureStreetBySearchName(e2.name);
      }), results.appendChild(t);
    }), results.classList.remove("hidden");
  }
  function focusLectureStreetBySearchName(e) {
    if (!e) return;
    const t = focusStreetByName(e);
    if (!t) return void showMessage("Rue introuvable dans la zone actuelle.", "error");
    const { input } = getLectureSearchElements();
    input && (input.value = e), closeLectureStreetSearchResults();
  }
  function updateLectureStreetSearchResults() {
    const { input } = getLectureSearchElements();
    if (!input) return;
    const e = input.value.trim();
    return e ? (lectureStreetSearchMatches = findLectureStreetMatches(e), void renderLectureStreetSearchResults(lectureStreetSearchMatches)) : void closeLectureStreetSearchResults();
  }
  function refreshLectureStreetSearchForCurrentMode(e = {}) {
    const t = true === e.preserveQuery, r = isLectureMode && "monuments" !== getZoneMode(), { input } = getLectureSearchElements();
    if (!r)
      return void setLectureStreetSearchVisible(false, t);
    setLectureStreetSearchVisible(true, t), buildLectureStreetSearchIndex(), input && (input.disabled = 0 === lectureStreetSearchIndex.length, input.placeholder = 0 === lectureStreetSearchIndex.length ? "Aucune rue disponible pour cette zone" : "Rechercher une rue (nom ou mot)", t && input.value.trim() && lectureStreetSearchIndex.length > 0 ? updateLectureStreetSearchResults() : closeLectureStreetSearchResults());
  }
  function initLectureStreetSearch() {
    const { container, input } = getLectureSearchElements();
    if (!container || !input || input.__lectureSearchBound) return;
    input.__lectureSearchBound = true, input.addEventListener("input", () => {
      updateLectureStreetSearchResults();
    }), input.addEventListener("focus", () => {
      input.value.trim() && updateLectureStreetSearchResults();
    }), input.addEventListener("keydown", (e) => {
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
        0 === lectureStreetSearchMatches.length && (lectureStreetSearchMatches = findLectureStreetMatches(t));
        const r = lectureStreetSearchMatches[0] || lectureStreetSearchIndex.find((e2) => e2.normalized === normalizeSearchText(t));
        r ? focusLectureStreetBySearchName(r.name) : showMessage("Rue introuvable dans la zone actuelle.", "error");
      }
    }), document.addEventListener("click", (e) => {
      container.contains(e.target) || closeLectureStreetSearchResults();
    });
  }
  function updateStreetInfoPanelVisibility() {
    const e = document.getElementById("street-info-panel"), t = document.getElementById("street-info");
    if (!e || !t) return;
    const r = getZoneMode();
    updateStreetInfoPanelTitle(r);
    "rues-principales" === r || "main" === r ? e.style.display = "block" : (e.style.display = "none", e.classList.remove("is-visible"), t.textContent = "", t.classList.remove("is-visible"));
  }
  function getStreetInfoPanelTitle(e = getZoneMode()) {
    return "rues-celebres" === e || "famous" === e ? "Infos rues c\xE9l\xE8bres" : "Infos rues principales";
  }
  function updateStreetInfoPanelTitle(e = getZoneMode()) {
    const t = document.getElementById("street-info-title");
    t && (t.textContent = getStreetInfoPanelTitle(e));
  }
  function initMap() {
    if (map = L.map("map", {
      tap: true,
      tapTolerance: IS_TOUCH_DEVICE ? 25 : 15,
      doubleTapZoom: true,
      renderer: L.canvas({ padding: 0.5 })
    }).setView([43.2965, 5.37], 13), L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles \xA9 Esri" }
    ).addTo(map), void 0 !== L.Control.MiniMap) {
      const e = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19, attribution: "\xA9 CartoDB" }
      );
      new L.Control.MiniMap(e, {
        position: "bottomright",
        toggleDisplay: true,
        minimized: IS_TOUCH_DEVICE,
        width: IS_TOUCH_DEVICE ? 100 : 150,
        height: IS_TOUCH_DEVICE ? 100 : 150,
        zoomLevelOffset: -5,
        zoomLevelFixed: false,
        collapsedWidth: 24,
        collapsedHeight: 24
      }).addTo(map);
    }
  }
  function initUI() {
    IS_TOUCH_DEVICE && document.body.classList.add("touch-mode"), initMobilePullToRefresh();
    const e = document.getElementById("restart-btn"), t = document.getElementById("mode-select"), r = document.getElementById("quartier-block"), a = document.getElementById("quartier-select"), n = document.getElementById("skip-btn"), s = document.getElementById("pause-btn"), i = document.getElementById("quartier-select-button"), l = document.getElementById("quartier-select-list"), o = (i && i.querySelector(".custom-select-label"), document.getElementById("login-btn")), u = document.getElementById("register-btn"), d = document.getElementById("logout-btn"), c = document.getElementById("auth-username"), m = document.getElementById("auth-password");
    t && (currentZoneMode = t.value), updateModeDifficultyPill();
    const p = document.getElementById("mode-select-button"), g = document.getElementById("mode-select-list"), h = p ? p.querySelector(".custom-select-label") : null;
    p && g && (p.addEventListener("click", (e2) => {
      e2.stopPropagation(), g.classList.toggle("visible");
    }), g.querySelectorAll("li").forEach((e2) => {
      e2.addEventListener("click", () => {
        const r2 = e2.dataset.value;
        h && (h.textContent = e2.childNodes[0].textContent.trim());
        const a2 = e2.querySelector(".difficulty-pill"), n2 = p.querySelector(".difficulty-pill");
        if (a2) {
          const e3 = a2.cloneNode(true);
          n2 ? n2.replaceWith(e3) : p.appendChild(e3);
        }
        t && (t.value = r2, t.dispatchEvent(new Event("change"))), g.classList.remove("visible");
      });
    }));
    const y = document.getElementById("game-mode-select-button"), v = document.getElementById("game-mode-select-list"), f = y ? y.querySelector(".custom-select-label") : null, b = document.getElementById("game-mode-select");
    y && v && b && (y.addEventListener("click", (e2) => {
      e2.stopPropagation(), v.classList.toggle("visible");
    }), v.querySelectorAll("li").forEach((e2) => {
      e2.addEventListener("click", () => {
        const t2 = e2.dataset.value;
        f && (f.textContent = e2.childNodes[0].textContent.trim());
        const r2 = e2.querySelector(".difficulty-pill");
        if (r2) {
          const e3 = r2.cloneNode(true), t3 = y.querySelector(".difficulty-pill");
          t3 ? t3.replaceWith(e3) : y.appendChild(e3);
        }
        b.value = t2, isSessionRunning && endSession(), "lecture" !== t2 && isLectureMode && (isLectureMode = false, setLectureTooltipsEnabled(false), refreshLectureStreetSearchForCurrentMode(), updateTargetPanelTitle(), updateLayoutSessionState()), updateGameModeControls(), v.scrollTop = 0, v.classList.remove("visible"), "lecture" === t2 && requestAnimationFrame(() => startNewSession());
      });
    })), i && l && i.addEventListener("click", (e2) => {
      e2.stopPropagation(), l.classList.toggle("visible");
    }), document.addEventListener("click", (e2) => {
      p && g && !p.contains(e2.target) && !g.contains(e2.target) && g.classList.remove("visible"), y && v && !y.contains(e2.target) && !v.contains(e2.target) && v.classList.remove("visible"), i && l && !i.contains(e2.target) && !l.contains(e2.target) && l.classList.remove("visible");
    }), currentUser = loadCurrentUserFromStorage(), updateUserUI(), initLectureStreetSearch();
    const S = document.getElementById("sound-toggle"), N = document.getElementById("haptics-toggle");
    S && (syncSoundToggleUI(), S.addEventListener("click", () => {
      toggleSound();
    })), N && (updateHapticsUI(), N.addEventListener("click", () => {
      toggleHaptics();
    })), initOnboardingBanner(), loadUniqueVisitorCounter();
    function L2(e2) {
      const t2 = document.getElementById("offline-banner");
      t2 && (t2.style.display = e2 ? "block" : "none");
    }
    initTooltipPopup(), window.addEventListener("offline", () => L2(true)), window.addEventListener("online", () => {
      fetch(API_URL + "/api/leaderboards", { method: "HEAD" }).then(() => L2(false)).catch(() => L2(true));
    }), navigator.onLine ? fetch(API_URL + "/api/leaderboards", { method: "HEAD" }).catch(
      () => L2(true)
    ) : L2(true), e && e.addEventListener("click", () => {
      isSessionRunning ? stopSessionManually() : startNewSession();
    }), updateTargetPanelTitle(), s && s.addEventListener("click", () => {
      isSessionRunning && togglePause();
    });
    const M = document.getElementById("daily-mode-btn");
    M && M.addEventListener("click", handleDailyModeClick), n && n.addEventListener("click", () => {
      if (isSessionRunning && !isPaused) {
        if ("monuments" === getZoneMode()) {
          if (!currentMonumentTarget) return;
          return summaryData.push({
            name: currentMonumentTarget.properties.name,
            correct: false,
            time: 0
          }), totalAnswered += 1, updateScoreUI(), currentMonumentIndex += 1, void setNewTarget();
        }
        currentTarget && (summaryData.push({
          name: currentTarget.properties.name,
          correct: false,
          time: 0
        }), totalAnswered += 1, updateScoreUI(), currentIndex += 1, setNewTarget());
      }
    }), t && t.addEventListener("change", () => {
      currentZoneMode = t.value;
      const e2 = currentZoneMode;
      updateTargetPanelTitle(), updateModeDifficultyPill(), streetsLayer && streetLayersById.size && streetLayersById.forEach((e3) => {
        const t2 = getBaseStreetStyle(e3), r2 = t2.weight > 0;
        e3.setStyle({ color: t2.color, weight: t2.weight }), e3.options.interactive = r2, e3.touchBuffer && (e3.touchBuffer.options.interactive = r2);
      }), "quartier" === e2 ? (r.style.display = "block", a && a.value && highlightQuartier(a.value)) : (r.style.display = "none", clearQuartierOverlay()), "monuments" === e2 ? (streetsLayer && map.hasLayer(streetsLayer) && map.removeLayer(streetsLayer), monumentsLayer && !map.hasLayer(monumentsLayer) && monumentsLayer.addTo(map)) : (monumentsLayer && map.hasLayer(monumentsLayer) && map.removeLayer(monumentsLayer), streetsLayer && !map.hasLayer(streetsLayer) && streetsLayer.addTo(map)), updateStreetInfoPanelVisibility(), refreshLectureTooltipsIfNeeded(), isLectureMode && refreshLectureStreetSearchForCurrentMode({ preserveQuery: true });
      const n2 = document.getElementById("street-info");
      n2 && ("rues-principales" === e2 || "main" === e2 || (n2.textContent = "", n2.style.display = "none"));
    }), a && a.addEventListener("change", () => {
      "quartier" === getZoneMode() && a.value ? highlightQuartier(a.value) : clearQuartierOverlay(), streetsLayer && streetLayersById.size && streetLayersById.forEach((e2) => {
        const t2 = getBaseStreetStyle(e2), r2 = t2.weight > 0;
        e2.setStyle({ color: t2.color, weight: t2.weight }), e2.options.interactive = r2, e2.touchBuffer && (e2.touchBuffer.options.interactive = r2);
      }), isLectureMode && refreshLectureStreetSearchForCurrentMode({ preserveQuery: true });
    });
    const T = document.getElementById("auth-feedback");
    function E(e2, t2) {
      T && (T.textContent = e2, T.className = "auth-feedback " + (t2 || ""));
    }
    const C = document.getElementById("toggle-password");
    C && m && C.addEventListener("click", () => {
      const e2 = "password" === m.type;
      m.type = e2 ? "text" : "password", C.textContent = e2 ? "\u{1F648}" : "\u{1F441}";
    }), o && o.addEventListener("click", async () => {
      E("", "");
      const e2 = ((c == null ? void 0 : c.value) || "").trim(), t2 = (m == null ? void 0 : m.value) || "";
      if (e2 && t2)
        try {
          const r2 = await fetch(API_URL + "/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: e2, password: t2 })
          }), a2 = await r2.json();
          if (!r2.ok)
            return void (401 === r2.status ? E("Identifiants incorrects.", "error") : E(a2.error || "Erreur de connexion.", "error"));
          currentUser = { id: a2.id, username: a2.username, token: a2.token }, saveCurrentUserToStorage(currentUser), updateUserUI(), E("Connexion r\xE9ussie !", "success");
        } catch (e3) {
          console.error("Erreur login :", e3), E("Serveur injoignable.", "error");
        }
      else E("Pseudo et mot de passe requis.", "error");
    }), u && u.addEventListener("click", async () => {
      E("", "");
      const e2 = ((c == null ? void 0 : c.value) || "").trim(), t2 = (m == null ? void 0 : m.value) || "";
      if (e2 && t2)
        if (t2.length < 4)
          E("Mot de passe trop court (min. 4 caract\xE8res).", "error");
        else
          try {
            const r2 = await fetch(API_URL + "/api/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: e2, password: t2 })
            }), a2 = await r2.json();
            if (!r2.ok)
              return void (a2.error && a2.error.includes("already taken") ? E("Ce pseudo est d\xE9j\xE0 pris.", "error") : E(a2.error || "Erreur lors de l'inscription.", "error"));
            currentUser = {
              id: a2.id,
              username: a2.username,
              token: a2.token
            }, saveCurrentUserToStorage(currentUser), updateUserUI(), E("Compte cr\xE9\xE9 !", "success");
          } catch (e3) {
            console.error("Erreur register :", e3), E("Serveur injoignable.", "error");
          }
      else E("Pseudo et mot de passe requis.", "error");
    }), d && d.addEventListener("click", () => {
      currentUser = null, clearCurrentUserFromStorage(), updateUserUI(), E("", "");
    });
    const q = document.getElementById("target-street");
    q && (q.textContent = "\u2014"), updateScoreUI(), updateTimeUI(0, 0), updateScoreMetricUI(), updateWeightedScoreUI(), updateSessionProgressBar(), updateStartStopButton(), updatePauseButton(), updateStreetInfoPanelVisibility(), updateLayoutSessionState(), updateGameModeControls(), ensureLectureBackButton(), "lecture" === getGameMode() ? startNewSession() : showMessage(
      'Cliquez sur "Commencer la session" une fois que la carte est charg\xE9e.',
      "info"
    );
    const I = document.getElementById("summary");
    I && I.classList.add("hidden");
  }
  document.addEventListener("DOMContentLoaded", () => {
    loadStreetInfos();
    setMapStatus("Chargement", "loading"), initMap(), initUI(), startTimersLoop(), loadStreets(), loadQuartierPolygons(), loadMonuments(), loadAllLeaderboards(), document.body.classList.add("app-ready");
  });
  var infoEl = document.getElementById("street-info");
  function startTimersLoop() {
    requestAnimationFrame(function e() {
      if (null !== sessionStartTime && null !== streetStartTime && isSessionRunning && !isPaused && (currentTarget || currentMonumentTarget)) {
        const t = performance.now(), r = (t - sessionStartTime) / 1e3, a = (t - streetStartTime) / 1e3;
        if (r >= 500 || a >= 500)
          return endSession(), void requestAnimationFrame(e);
        if (isChronoMode && null !== chronoEndTime && t >= chronoEndTime)
          return endSession(), void requestAnimationFrame(e);
        updateTimeUI(
          r,
          a,
          isChronoMode && null !== chronoEndTime ? Math.max(0, (chronoEndTime - t) / 1e3) : null
        ), "classique" === getGameMode() && (hasAnsweredCurrentItem || updateWeightedBar(computeItemPoints(a) / 10));
      }
      requestAnimationFrame(e);
    });
  }
  function showMessage(e, t) {
    const r = document.getElementById("message");
    r && (r.className = "message", "success" === t ? r.classList.add("message--success") : "error" === t ? r.classList.add("message--error") : r.classList.add("message--info"), r.textContent = e, r.classList.add("message--visible"), null !== messageTimeoutId && clearTimeout(messageTimeoutId), messageTimeoutId = setTimeout(() => {
      r.classList.remove("message--visible"), messageTimeoutId = null;
    }, 3e3));
  }
  function getBaseStreetStyleFromName(e) {
    const t = getZoneMode(), r = normalizeName(e || "");
    let a = UI_THEME.mapStreet, n = 5;
    return "rues-principales" !== t && "main" !== t || MAIN_STREET_NAMES.has(r) || (a = "#00000000", n = 0), "rues-celebres" === t && (FAMOUS_STREET_NAMES.has(r) || (a = "#00000000", n = 0)), { color: a, weight: n };
  }
  function getBaseStreetStyle(e) {
    var _a, _b;
    const t = e.feature || e;
    let r = getBaseStreetStyleFromName(((_a = t == null ? void 0 : t.properties) == null ? void 0 : _a.name) || "");
    const a = getZoneMode(), n = getSelectedQuartier();
    return "quartier" === a && n && (((_b = t == null ? void 0 : t.properties) == null ? void 0 : _b.quartier) || null) !== n && (r = { color: "#00000000", weight: 0 }), r;
  }
  function isStreetVisibleInCurrentMode(e, t) {
    const r = getZoneMode();
    if ("monuments" === r) return false;
    if ("rues-celebres" === r) return FAMOUS_STREET_NAMES.has(e);
    if ("rues-principales" === r || "main" === r) return MAIN_STREET_NAMES.has(e);
    if ("quartier" === r) {
      const e2 = getSelectedQuartier(), r2 = "string" == typeof t ? t.trim() : null;
      if (e2 && r2 !== e2) return false;
    }
    return true;
  }
  function addTouchBufferForLayer(e) {
    if (!IS_TOUCH_DEVICE || !map) return;
    const t = e.getLatLngs();
    if (!t || 0 === t.length) return;
    const r = L.polyline(t, {
      color: "#000000",
      weight: 30,
      opacity: 0,
      interactive: true
    });
    r.on("click", (t2) => {
      L && L.DomEvent && L.DomEvent.stop && L.DomEvent.stop(t2), e.fire("click");
    }), r.on("mouseover", () => e.fire("mouseover")), r.on("mouseout", () => e.fire("mouseout")), r.addTo(map), e.touchBuffer = r;
  }
  function loadStreets() {
    const e = performance.now();
    fetch("data/marseille_rues_light.geojson?v=11").then((e2) => {
      if (!e2.ok) throw new Error("Erreur HTTP " + e2.status);
      return e2.json();
    }).then((t) => {
      allStreetFeatures = t.features || [];
      const r = (performance.now() - e).toFixed(0);
      console.log(`Rues charg\xE9es : ${allStreetFeatures.length} en ${r}ms`), streetLayersById.clear(), streetLayersByName.clear();
      let a = 0;
      streetsLayer = L.geoJSON(allStreetFeatures, {
        style: function(e2) {
          return getBaseStreetStyle(e2);
        },
        onEachFeature: (e2, t2) => {
          const r2 = normalizeName(e2.properties.name);
          e2._gameId = a++, streetLayersById.set(e2._gameId, t2), t2.feature = e2, streetLayersByName.has(r2) || streetLayersByName.set(r2, []), streetLayersByName.get(r2).push(t2), addTouchBufferForLayer(t2);
          let n2 = null;
          t2.on("mouseover", () => {
            clearTimeout(n2), n2 = setTimeout(() => {
              const t3 = e2.properties.quartier || null;
              isStreetVisibleInCurrentMode(r2, t3) && (streetLayersByName.get(r2) || []).forEach((e3) => {
                e3.setStyle({ weight: 7, color: UI_THEME.mapStreetHover });
              });
            }, 50);
          }), t2.on("mouseout", () => {
            clearTimeout(n2), n2 = setTimeout(() => {
              const t3 = e2.properties.quartier || null;
              isStreetVisibleInCurrentMode(r2, t3) && (streetLayersByName.get(r2) || []).forEach((e3) => {
                if (highlightedLayers && highlightedLayers.includes(e3))
                  return;
                const t4 = getBaseStreetStyle(e3);
                e3.setStyle({ weight: t4.weight, color: t4.color });
              });
            }, 50);
          }), t2.on("click", (a2) => {
            const n3 = e2.properties.quartier || null;
            isStreetVisibleInCurrentMode(r2, n3) && handleStreetClick(e2, t2, a2);
          });
        }
      }).addTo(map), refreshLectureTooltipsIfNeeded(), refreshLectureStreetSearchForCurrentMode({ preserveQuery: true }), populateQuartiers();
      const n = document.getElementById("mode-select");
      n && n.dispatchEvent(new Event("change")), window.innerWidth <= 900 || showMessage(
        'Carte charg\xE9e. Choisissez la zone, le type de partie, puis cliquez sur "Commencer la session".',
        "info"
      ), setMapStatus("Carte OK", "ready"), document.body.classList.add("app-ready");
    }).catch((e2) => {
      console.error("Erreur lors du chargement des rues :", e2), showMessage("Erreur de chargement des rues (voir console).", "error"), setMapStatus("Erreur", "error");
    });
  }
  function loadMonuments() {
    fetch("data/marseille_monuments.geojson?v=2").then(
      (e) => e.ok ? e.json() : (console.warn(
        "Impossible de charger les monuments (HTTP " + e.status + ")."
      ), null)
    ).then((e) => {
      if (!e) return;
      const t = (e.features || []).filter(
        (e2) => e2.geometry && "Point" === e2.geometry.type && e2.properties && "string" == typeof e2.properties.name && "" !== e2.properties.name.trim()
      );
      allMonuments = t, console.log("Nombre de monuments charg\xE9s :", allMonuments.length), 0 === allMonuments.length && console.warn("Aucun monument trouv\xE9 apr\xE8s filtrage."), monumentsLayer && (map.removeLayer(monumentsLayer), monumentsLayer = null), monumentsLayer = L.geoJSON(
        { type: "FeatureCollection", features: allMonuments },
        {
          renderer: L.svg({ pane: "markerPane" }),
          pointToLayer: (e2, t2) => {
            const r = L.circleMarker(t2, {
              radius: 8,
              color: UI_THEME.mapMonumentStroke,
              weight: 3,
              fillColor: UI_THEME.mapMonumentFill,
              fillOpacity: 1,
              pane: "markerPane"
            });
            return IS_TOUCH_DEVICE && (r._monumentFeature = e2), r;
          },
          onEachFeature: (e2, t2) => {
            t2.on("click", () => handleMonumentClick(e2, t2));
          }
        }
      ), IS_TOUCH_DEVICE && monumentsLayer && monumentsLayer.eachLayer((e2) => {
        const t2 = e2._monumentFeature;
        if (!t2) return;
        const r = e2.getLatLng(), a = L.circleMarker(r, {
          radius: 18,
          fillOpacity: 0,
          opacity: 0,
          pane: "markerPane"
        });
        a.on("click", () => handleMonumentClick(t2, e2)), a._visibleMarker = e2, a._isHitArea = true, monumentsLayer.addLayer(a);
      }), refreshLectureTooltipsIfNeeded(), "monuments" === getZoneMode() && (map.hasLayer(monumentsLayer) || monumentsLayer.addTo(map), streetsLayer && map.hasLayer(streetsLayer) && map.removeLayer(streetsLayer));
    }).catch((e) => {
      console.error("Erreur lors du chargement des monuments :", e);
    });
  }
  function setLectureTooltipsEnabled(e) {
    function t(e2) {
      e2.__lectureTapTooltipBound && (e2.__lectureTapTooltipFn && e2.off("click", e2.__lectureTapTooltipFn), e2.__lectureTapTooltipBound = false, e2.__lectureTapTooltipFn = null);
    }
    streetsLayer && streetsLayer.eachLayer((r) => {
      var _a, _b;
      const a = ((_b = (_a = r.feature) == null ? void 0 : _a.properties) == null ? void 0 : _b.name) || "";
      a && (e ? getBaseStreetStyle(r).weight > 0 ? (r.getTooltip() || r.bindTooltip(a, {
        direction: "top",
        sticky: !IS_TOUCH_DEVICE,
        opacity: 0.9,
        className: "street-tooltip"
      }), function(e2) {
        IS_TOUCH_DEVICE && (e2.__lectureTapTooltipBound || (e2.__lectureTapTooltipBound = true, e2.on(
          "click",
          e2.__lectureTapTooltipFn = () => {
            e2.getTooltip() && e2.openTooltip(), streetsLayer && streetsLayer.eachLayer((t2) => {
              t2 !== e2 && t2.getTooltip && t2.getTooltip() && t2.closeTooltip();
            }), monumentsLayer && monumentsLayer.eachLayer((t2) => {
              t2 !== e2 && t2.getTooltip && t2.getTooltip() && t2.closeTooltip();
            });
          }
        )));
      }(r)) : (r.getTooltip() && r.unbindTooltip(), t(r)) : (t(r), r.getTooltip() && (r.closeTooltip(), r.unbindTooltip())));
    }), monumentsLayer && monumentsLayer.eachLayer((t2) => {
      var _a, _b;
      if (t2._isHitArea)
        return void (e && IS_TOUCH_DEVICE && !t2.__hitAreaTooltipBound ? (t2.__hitAreaTooltipBound = true, t2.on("click", () => {
          const e2 = t2._visibleMarker;
          e2 && e2.getTooltip() && (monumentsLayer.eachLayer((t3) => {
            t3 !== e2 && t3.getTooltip && t3.getTooltip() && t3.closeTooltip();
          }), e2.toggleTooltip());
        })) : e || (t2.__hitAreaTooltipBound = false));
      const r = ((_b = (_a = t2.feature) == null ? void 0 : _a.properties) == null ? void 0 : _b.name) || "";
      r && (e ? (t2.getTooltip() || t2.bindTooltip(r, {
        direction: "top",
        sticky: false,
        permanent: false,
        opacity: 0.9,
        className: "monument-tooltip"
      }), IS_TOUCH_DEVICE && !t2.__monumentTapBound && (t2.__monumentTapBound = true, t2.on("click", () => {
        monumentsLayer.eachLayer((e2) => {
          e2 !== t2 && e2.getTooltip && e2.getTooltip() && e2.closeTooltip();
        }), t2.getTooltip() && t2.toggleTooltip();
      }))) : (t2.__monumentTapBound && (t2.__monumentTapBound = false), t2.getTooltip() && (t2.closeTooltip(), t2.unbindTooltip())));
    });
  }
  function refreshLectureTooltipsIfNeeded() {
    "lecture" !== getGameMode() && true !== isLectureMode || setLectureTooltipsEnabled(true);
  }
  function loadQuartierPolygons() {
    fetch("data/marseille_quartiers_111.geojson?v=2").then((e) => {
      if (!e.ok) throw new Error("Erreur HTTP " + e.status);
      return e.json();
    }).then((e) => {
      const t = e.features || [];
      quartierPolygonsByName.clear(), t.forEach((e2) => {
        const t2 = e2.properties || {}, r = "string" == typeof t2.nom_qua ? t2.nom_qua.trim() : "";
        r && quartierPolygonsByName.set(r, e2);
      }), console.log("Quartiers charg\xE9s :", quartierPolygonsByName.size), console.log("Noms de quartiers (polygones):"), console.log(Array.from(quartierPolygonsByName.keys()).sort());
    }).catch((e) => {
      console.error("Erreur lors du chargement des quartiers :", e);
    });
  }
  function highlightQuartier(e) {
    if (clearQuartierOverlay(), !e) return;
    const t = quartierPolygonsByName.get(e);
    if (!t)
      return void console.warn("Aucun polygone trouv\xE9 pour le quartier :", e);
    quartierOverlay = L.geoJSON(t, {
      style: { color: UI_THEME.mapQuartier, weight: 2, fill: false },
      interactive: false
    }).addTo(map);
    const r = quartierOverlay.getBounds();
    if (r && r.isValid && r.isValid()) {
      const e2 = window.innerWidth <= 900 ? { padding: [40, 40], maxZoom: 14 } : { padding: [40, 40] };
      map.fitBounds(r, { ...e2, animate: true, duration: 1.5 });
    }
  }
  function clearQuartierOverlay() {
    quartierOverlay && (map.removeLayer(quartierOverlay), quartierOverlay = null);
  }
  function populateQuartiers() {
    const e = document.getElementById("quartier-select"), t = document.getElementById("quartier-select-list"), r = document.getElementById("quartier-select-button"), a = r ? r.querySelector(".custom-select-label") : null;
    if (!e) return;
    const n = /* @__PURE__ */ new Set();
    allStreetFeatures.forEach((e2) => {
      const t2 = (e2.properties || {}).quartier;
      "string" == typeof t2 && "" !== t2.trim() && n.add(t2.trim());
    });
    const s = Array.from(n).sort(
      (e2, t2) => e2.localeCompare(t2, "fr", { sensitivity: "base" })
    );
    if (e.innerHTML = "", s.forEach((t2) => {
      const r2 = document.createElement("option");
      r2.value = t2, r2.textContent = t2, e.appendChild(r2);
    }), t && (t.innerHTML = "", s.forEach((n2) => {
      const s2 = document.createElement("li");
      s2.dataset.value = n2;
      const i = document.createElement("span");
      i.textContent = n2, s2.appendChild(i);
      const l = arrondissementByQuartier.get(normalizeQuartierKey(n2));
      if (l) {
        const e2 = document.createElement("span");
        e2.className = "difficulty-pill difficulty-pill--arrondissement", e2.textContent = l, s2.appendChild(e2);
      }
      s2.addEventListener("click", () => {
        a && (a.textContent = n2);
        const i2 = s2.querySelector(".difficulty-pill");
        if (r) {
          const e2 = r.querySelector(".difficulty-pill");
          if (i2) {
            const t2 = i2.cloneNode(true);
            e2 ? e2.replaceWith(t2) : r.appendChild(t2);
          } else e2 && e2.remove();
        }
        e.value = n2, e.dispatchEvent(new Event("change")), t.classList.remove("visible");
      }), t.appendChild(s2);
    }), s.length > 0 && r)) {
      const t2 = s[0];
      a && (a.textContent = t2);
      const n2 = arrondissementByQuartier.get(normalizeQuartierKey(t2));
      if (n2) {
        const e2 = r.querySelector(".difficulty-pill"), t3 = document.createElement("span");
        t3.className = "difficulty-pill difficulty-pill--arrondissement", t3.textContent = n2, e2 ? e2.replaceWith(t3) : r.appendChild(t3);
      }
      e.value = t2;
    }
  }
  function scrollSidebarToTargetPanel() {
    if (window.innerWidth >= 900) return;
    const e = document.getElementById("sidebar"), t = document.querySelector(".target-panel");
    e && t && setTimeout(() => {
      const r = t.offsetTop, a = t.offsetHeight, n = r - e.clientHeight / 2 + a / 2;
      e.scrollTo({ top: n, behavior: "smooth" });
    }, 350);
  }
  function ensureLectureBackButton() {
    if (document.getElementById("lecture-back-btn")) return;
    const e = document.querySelector(".target-panel");
    if (!e) return;
    const t = document.createElement("button");
    t.id = "lecture-back-btn", t.type = "button", t.className = "btn btn-secondary lecture-back-btn", t.textContent = "Retour au menu", e.insertAdjacentElement("afterend", t), t.addEventListener("click", exitLectureModeToMenu), t.style.display = "none";
  }
  function exitLectureModeToMenu() {
    isLectureMode = false, setLectureTooltipsEnabled(false), isSessionRunning = false, isChronoMode = false, chronoEndTime = null, sessionStartTime = null, streetStartTime = null, isPaused = false, pauseStartTime = null, remainingChronoMs = null;
    const e = document.getElementById("game-mode-select");
    e && (e.value = "classique");
    const t = document.getElementById("game-mode-select-button"), r = document.getElementById("game-mode-select-list");
    if (t && r) {
      const e2 = t.querySelector(".custom-select-label"), a2 = r.querySelector('li[data-value="classique"]');
      if (e2 && a2) {
        e2.textContent = a2.childNodes[0].textContent.trim();
        const r2 = a2.querySelector(".difficulty-pill");
        if (r2) {
          const e3 = r2.cloneNode(true), a3 = t.querySelector(".difficulty-pill");
          a3 ? a3.replaceWith(e3) : t.appendChild(e3);
        }
      }
    }
    const a = document.getElementById("target-street");
    a && (a.textContent = "\u2014"), updateTargetPanelTitle(), updateTimeUI(0, 0), updateStartStopButton(), updatePauseButton(), updateGameModeControls(), refreshLectureStreetSearchForCurrentMode(), updateLayoutSessionState(), showMessage("Retour au menu.", "info");
  }
  function startNewSession() {
    document.body.classList.remove("session-ended");
    const e = document.getElementById("quartier-select"), t = getZoneMode(), r = getGameMode(), a = document.getElementById("street-info");
    a && (a.textContent = "", a.style.display = "none"), clearHighlight(), correctCount = 0, totalAnswered = 0, summaryData = [], weightedScore = 0, errorsCount = 0, isPaused = false, pauseStartTime = null, remainingChronoMs = null, updateScoreUI(), updateTimeUI(0, 0), updateScoreMetricUI(), updateWeightedScoreUI(), updateSessionProgressBar();
    const n = document.getElementById("summary");
    if (n && n.classList.add("hidden"), isChronoMode = "chrono" === r, chronoEndTime = isChronoMode ? performance.now() + 6e4 : null, setLectureTooltipsEnabled(false), "lecture" === r) {
      isLectureMode = true, isSessionRunning = false, isChronoMode = false, chronoEndTime = null, sessionStartTime = null, streetStartTime = null, currentTarget = null, setLectureTooltipsEnabled(true), currentMonumentTarget = null, isPaused = false, pauseStartTime = null, remainingChronoMs = null, updateTargetPanelTitle(), updateLayoutSessionState(), "monuments" === t ? (streetsLayer && map.hasLayer(streetsLayer) && map.removeLayer(streetsLayer), monumentsLayer && !map.hasLayer(monumentsLayer) && monumentsLayer.addTo(map), clearQuartierOverlay()) : (monumentsLayer && map.hasLayer(monumentsLayer) && map.removeLayer(monumentsLayer), streetsLayer && !map.hasLayer(streetsLayer) && streetsLayer.addTo(map), "quartier" === t && e && e.value ? highlightQuartier(e.value) : clearQuartierOverlay()), (() => {
        const r3 = document.getElementById("target-street");
        r3 && ("monuments" === t ? (r3.textContent = "Mode lecture : survolez la carte", requestAnimationFrame(fitTargetStreetText)) : r3.textContent = "\u2014");
      })(), refreshLectureStreetSearchForCurrentMode();
      const r2 = document.getElementById("pause-btn");
      r2 && (r2.disabled = true, r2.textContent = "Pause");
      const a2 = document.getElementById("skip-btn");
      return a2 && (a2.style.display = "none"), updateStartStopButton(), updatePauseButton(), updateTimeUI(0, 0), setLectureTooltipsEnabled(true), void showMessage(
        "Mode lecture : utilisez la recherche ou survolez la carte pour voir les noms.",
        "info"
      );
    }
    if (isLectureMode = false, updateTargetPanelTitle(), refreshLectureStreetSearchForCurrentMode(), "monuments" === t) {
      if (!allMonuments.length)
        return void showMessage(
          "Aucun monument disponible (v\xE9rifiez data/marseille_monuments.geojson).",
          "error"
        );
      if (streetsLayer && map.hasLayer(streetsLayer) && map.removeLayer(streetsLayer), monumentsLayer && !map.hasLayer(monumentsLayer) && monumentsLayer.addTo(map), clearQuartierOverlay(), "marathon" === r)
        sessionMonuments = sampleWithoutReplacement(
          allMonuments,
          allMonuments.length
        );
      else if ("chrono" === r)
        sessionMonuments = sampleWithoutReplacement(
          allMonuments,
          allMonuments.length
        );
      else {
        const e3 = Math.min(20, allMonuments.length);
        sessionMonuments = sampleWithoutReplacement(allMonuments, e3);
      }
      currentMonumentIndex = 0, currentMonumentTarget = null, currentTarget = null, isMonumentsMode = true, sessionStartTime = performance.now(), streetStartTime = null, isSessionRunning = true, updateStartStopButton(), updatePauseButton(), updateLayoutSessionState(), scrollSidebarToTargetPanel();
      const e2 = document.getElementById("skip-btn");
      return e2 && (e2.style.display = "inline-block"), setNewTarget(), showMessage("Session monuments d\xE9marr\xE9e.", "info"), void updateLayoutSessionState();
    }
    if (isLectureMode = false, isMonumentsMode = false, 0 === allStreetFeatures.length)
      return void showMessage(
        "Impossible de d\xE9marrer : donn\xE9es rues non charg\xE9es.",
        "error"
      );
    const s = getCurrentZoneStreets();
    if (0 === s.length)
      return void showMessage("Aucune rue disponible pour cette zone.", "error");
    const i = buildUniqueStreetList(s);
    if (0 === i.length)
      return void showMessage(
        "Aucune rue nomm\xE9e disponible pour cette zone.",
        "error"
      );
    if ("marathon" === r) sessionStreets = sampleWithoutReplacement(i, i.length);
    else if ("chrono" === r)
      sessionStreets = sampleWithoutReplacement(i, i.length);
    else {
      const e2 = Math.min(20, i.length);
      sessionStreets = sampleWithoutReplacement(i, e2);
    }
    currentIndex = 0, "quartier" === t && e && e.value ? highlightQuartier(e.value) : clearQuartierOverlay(), monumentsLayer && map.hasLayer(monumentsLayer) && map.removeLayer(monumentsLayer), streetsLayer && !map.hasLayer(streetsLayer) && streetsLayer.addTo(map), sessionStartTime = performance.now(), currentTarget = null, currentMonumentTarget = null, streetStartTime = null, isSessionRunning = true, updateStartStopButton(), updatePauseButton(), updateLayoutSessionState(), scrollSidebarToTargetPanel();
    const l = document.getElementById("skip-btn");
    l && !isLectureMode && (l.style.display = "inline-block"), setNewTarget(), showMessage("Session d\xE9marr\xE9e.", "info");
  }
  function getCurrentZoneStreets() {
    const e = document.getElementById("quartier-select"), t = getZoneMode();
    if ("quartier" === t && e && e.value) {
      const t2 = e.value;
      return allStreetFeatures.filter(
        (e2) => e2.properties && "string" == typeof e2.properties.quartier && e2.properties.quartier === t2
      );
    }
    return "rues-principales" === t || "main" === t ? allStreetFeatures.filter((e2) => {
      const t2 = normalizeName(e2.properties && e2.properties.name);
      return MAIN_STREET_NAMES.has(t2);
    }) : "rues-celebres" === t ? allStreetFeatures.filter((e2) => {
      const t2 = normalizeName(e2.properties && e2.properties.name);
      return FAMOUS_STREET_NAMES.has(t2);
    }) : allStreetFeatures;
  }
  function buildUniqueStreetList(e) {
    const t = /* @__PURE__ */ new Map();
    return e.forEach((e2) => {
      const r = "string" == typeof e2.properties.name ? e2.properties.name.trim() : "";
      if (!r) return;
      const a = normalizeName(r);
      t.has(a) || t.set(a, e2);
    }), Array.from(t.values());
  }
  function sampleWithoutReplacement(e, t) {
    const r = Array.from(e.keys());
    return shuffle(r), r.slice(0, t).map((t2) => e[t2]);
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
        shuffle(sessionMonuments), currentMonumentIndex = 0;
      }
      currentTarget = null, currentMonumentTarget = sessionMonuments[currentMonumentIndex], streetStartTime = performance.now(), hasAnsweredCurrentItem = false, resetWeightedBar();
      const t2 = currentMonumentTarget.properties.name, r2 = document.getElementById("target-street");
      return r2 && (r2.textContent = t2 || "\u2014", requestAnimationFrame(fitTargetStreetText)), void triggerTargetPulse();
    }
    if (currentIndex >= sessionStreets.length) {
      if ("chrono" !== e) return void endSession();
      shuffle(sessionStreets), currentIndex = 0;
    }
    currentMonumentTarget = null, currentTarget = sessionStreets[currentIndex], streetStartTime = performance.now(), hasAnsweredCurrentItem = false, resetWeightedBar();
    const t = currentTarget.properties.name, r = document.getElementById("target-street");
    r && (r.textContent = t || "\u2014", requestAnimationFrame(fitTargetStreetText)), triggerTargetPulse();
  }
  function triggerTargetPulse() {
    const e = document.querySelector(".target-panel");
    e && (e.classList.remove("pulse"), e.offsetWidth, e.classList.add("pulse"));
  }
  function updateStartStopButton() {
    const e = document.getElementById("restart-btn"), t = document.getElementById("skip-btn");
    if (e)
      return "lecture" === getGameMode() ? (e.style.display = "none", void (t && (t.style.display = "none"))) : (e.style.display = "", void (isSessionRunning ? (e.textContent = "Arr\xEAter la session", e.classList.remove("btn-primary"), e.classList.add("btn-stop"), t && (t.style.display = "block")) : (e.textContent = "Commencer la session", e.classList.remove("btn-stop"), e.classList.add("btn-primary"), t && (t.style.display = "none"))));
  }
  function stopSessionManually() {
    (isSessionRunning || isDailyMode) && ("function" == typeof handleDailyStop && handleDailyStop() || endSession());
  }
  function togglePause() {
    if (isSessionRunning) {
      if (isPaused) {
        const e = performance.now(), t = e - pauseStartTime;
        null !== sessionStartTime && (sessionStartTime += t), null !== streetStartTime && (streetStartTime += t), isChronoMode && null !== remainingChronoMs && (chronoEndTime = e + remainingChronoMs, remainingChronoMs = null), isPaused = false, pauseStartTime = null;
      } else
        isPaused = true, pauseStartTime = performance.now(), isChronoMode && null !== chronoEndTime && (remainingChronoMs = chronoEndTime - pauseStartTime);
      updatePauseButton();
    }
  }
  function updatePauseButton() {
    const e = document.getElementById("pause-btn");
    if (e)
      if ("lecture" !== getGameMode()) {
        if (!isSessionRunning)
          return e.style.display = "none", e.textContent = "Pause", void (e.disabled = true);
        e.style.display = "block", e.disabled = false, e.textContent = isPaused ? "Reprendre" : "Pause";
      } else e.style.display = "none";
  }
  function updateLayoutSessionState() {
    const e = document.body;
    if (!e) return;
    if (isSessionRunning || isLectureMode ? e.classList.add("session-running") : e.classList.remove("session-running"), isLectureMode ? e.classList.add("lecture-mode") : e.classList.remove("lecture-mode"), map && setTimeout(() => map.invalidateSize(), 300), isLectureMode) {
      const e2 = document.getElementById("sidebar"), t2 = document.querySelector(".target-panel");
      e2 && t2 && setTimeout(() => {
        e2.scrollTo({ top: t2.offsetTop - 8, behavior: "smooth" });
      }, 120);
    }
    const t = document.getElementById("lecture-back-btn");
    if (t) {
      const e2 = window.innerWidth <= 900;
      isLectureMode && e2 ? (t.style.display = "block", t.__didAutoFocus || (t.__didAutoFocus = true, setTimeout(() => {
        try {
          t.focus({ preventScroll: true });
        } catch (e3) {
          t.focus();
        }
      }, 200))) : (t.style.display = "none", t.__didAutoFocus = false);
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
      const t2 = normalizeName(e.properties.name);
      if (!MAIN_STREET_NAMES.has(t2)) return;
    }
    if ("rues-celebres" === a) {
      const t2 = normalizeName(e.properties.name);
      if (!FAMOUS_STREET_NAMES.has(t2)) return;
    }
    if ("quartier" === a) {
      const t2 = getSelectedQuartier(), r2 = e.properties && "string" == typeof e.properties.quartier ? e.properties.quartier.trim() : null;
      if (t2 && r2 !== t2) return;
    }
    if (isPaused) return;
    if (isDailyMode) {
      if (!dailyTargetData || !dailyTargetGeoJson) return;
      const a2 = dailyTargetData.userStatus || {};
      if (a2.success || (a2.attempts_count || 0) >= 7 || window._dailyGameOver)
        return;
      if (window._dailyGuessInFlight) return;
      window._dailyGuessInFlight = true;
      const n2 = normalizeName(e.properties.name) === normalizeName(dailyTargetData.streetName);
      let s2 = 0, i2 = "";
      const l2 = computeFeatureCentroid(e), o = dailyTargetGeoJson;
      if (!n2) {
        let e2 = l2[0], t2 = l2[1];
        r && r.latlng && (e2 = r.latlng.lng, t2 = r.latlng.lat);
        const a3 = normalizeName(dailyTargetData.streetName), n3 = allStreetFeatures.find(
          (e3) => e3.properties && normalizeName(e3.properties.name) === a3
        );
        s2 = n3 && n3.geometry ? getDistanceToFeature(t2, e2, n3.geometry) : getDistanceMeters(t2, e2, o[1], o[0]), i2 = getDirectionArrow(l2, o);
      }
      if (!n2 && t && "function" == typeof t.setStyle) {
        const e2 = getBaseStreetStyle(t);
        t.setStyle({ color: UI_THEME.timerWarn, weight: 6, opacity: 1 }), setTimeout(() => {
          t && map.hasLayer(t) && t.setStyle(e2);
        }, 2e3);
      }
      dailyGuessHistory.push({
        streetName: e.properties.name,
        distance: Math.round(s2),
        arrow: i2
      }), saveDailyGuessesToStorage();
      const u = dailyGuessHistory.length, d = 7 - u;
      if (n2) {
        window._dailyGameOver = true, isSessionRunning = false, document.body.classList.add("daily-game-over"), typeof confetti === "function" && confetti({ particleCount: 150, zIndex: 1e4, spread: 80, origin: { y: 0.6 } }), showMessage(
          `\u{1F389} BRAVO ! Trouv\xE9 en ${u} essai${u > 1 ? "s" : ""} !`,
          "success"
        ), triggerHaptic("success"), renderDailyGuessHistory({ success: true, attempts: u });
        const e2 = document.getElementById("target-panel-title");
        e2 && (e2.textContent = "\u{1F389} D\xE9fi r\xE9ussi !");
        const t2 = document.getElementById("restart-btn");
        t2 && (t2.textContent = "Commencer la session", t2.classList.remove("btn-stop"), t2.classList.add("btn-primary"));
        const r2 = normalizeName(dailyTargetData.streetName), a3 = allStreetFeatures.find(
          (e3) => e3.properties && normalizeName(e3.properties.name) === r2
        );
        a3 && a3.geometry && highlightDailyTarget(a3.geometry, true);
      } else if (d <= 0) {
        window._dailyGameOver = true, isSessionRunning = false, document.body.classList.add("daily-game-over"), showMessage(
          `\u274C Dommage ! C'\xE9tait \xAB ${dailyTargetData.streetName} \xBB. Fin du d\xE9fi.`,
          "error"
        ), triggerHaptic("error"), renderDailyGuessHistory({ success: false });
        const e2 = document.getElementById("target-panel-title");
        e2 && (e2.textContent = "\u274C D\xE9fi \xE9chou\xE9");
        const t2 = document.getElementById("restart-btn");
        t2 && (t2.textContent = "Commencer la session", t2.classList.remove("btn-stop"), t2.classList.add("btn-primary"));
        const r2 = normalizeName(dailyTargetData.streetName), a3 = allStreetFeatures.find(
          (e3) => e3.properties && normalizeName(e3.properties.name) === r2
        );
        a3 && a3.geometry && highlightDailyTarget(a3.geometry, false);
      } else
        renderDailyGuessHistory(), triggerHaptic("error"), showMessage(
          `\u274C Rat\xE9 ! Distance : ${s2 >= 1e3 ? `${(s2 / 1e3).toFixed(1)} km` : `${Math.round(s2)} m`}. Plus que ${d} essai${d > 1 ? "s" : ""}.`,
          "warning"
        );
      return updateDailyUI(), updateStartStopButton(), updateLayoutSessionState(), void fetch(API_URL + "/api/daily/guess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          date: dailyTargetData.date,
          distanceMeters: Math.round(s2),
          isSuccess: n2
        })
      }).then((e2) => e2.json()).then((e2) => {
        dailyTargetData.userStatus = e2, e2.targetGeometry && (e2.success || e2.attempts_count >= 7) && highlightDailyTarget(e2.targetGeometry, !!e2.success);
      }).catch((e2) => {
        console.warn("Daily sync error (non-bloquant):", e2);
      }).finally(() => {
        window._dailyGuessInFlight = false;
      });
    }
    if (!currentTarget || null === sessionStartTime || null === streetStartTime)
      return;
    const n = getGameMode(), s = (performance.now() - streetStartTime) / 1e3, i = normalizeName(e.properties.name) === normalizeName(currentTarget.properties.name), l = currentTarget;
    if (i) {
      correctCount += 1;
      hasAnsweredCurrentItem = true;
      if ("classique" === n) {
        const e2 = computeItemPoints(s);
        weightedScore += e2, updateWeightedBar(e2 / 10), showMessage(
          `Correct (${s.toFixed(1)} s, +${e2.toFixed(1)} pts)`,
          "success"
        );
      } else if ("marathon" === n) {
        const e2 = getCurrentSessionPoolSize();
        showMessage(
          `Correct (${correctCount}/${e2 > 0 ? e2 : "?"})`,
          "success"
        );
      } else showMessage(`Correct (${correctCount} trouv\xE9es)`, "success");
      updateSessionProgressBar(), highlightStreet(UI_THEME.mapCorrect), triggerHaptic("success"), feedbackCorrect();
    } else
      errorsCount += 1, showMessage(
        "marathon" === n && errorsCount >= 3 ? "Incorrect (limite de 3 erreurs atteinte)" : "Incorrect",
        "error"
      ), highlightStreet(UI_THEME.mapWrong), "classique" === n ? updateWeightedBar(0) : updateSessionProgressBar(), triggerHaptic("error"), feedbackError();
    totalAnswered += 1, summaryData.push({
      name: currentTarget.properties.name,
      correct: i,
      time: s.toFixed(1)
    }), trackAnswer(currentTarget.properties.name, getZoneMode(), i, s), updateWeightedScoreUI(), updateScoreUI(), showStreetInfo(l), !i && "marathon" === n && errorsCount >= 3 ? endSession() : (currentIndex += 1, setNewTarget());
  }
  function handleMonumentClick(e, t) {
    if ("monuments" !== getZoneMode()) return;
    if (isPaused) return;
    if (!currentMonumentTarget || null === sessionStartTime || null === streetStartTime)
      return;
    const r = getGameMode(), a = (performance.now() - streetStartTime) / 1e3, n = normalizeName(e.properties.name) === normalizeName(currentMonumentTarget.properties.name), s = currentMonumentTarget.properties.name, i = findMonumentLayerByName(currentMonumentTarget.properties.name);
    if (n) {
      correctCount += 1;
      hasAnsweredCurrentItem = true;
      if ("classique" === r) {
        const e2 = computeItemPoints(a);
        weightedScore += e2, updateWeightedBar(e2 / 10), showMessage(
          `Correct (${a.toFixed(1)} s, +${e2.toFixed(1)} pts)`,
          "success"
        );
      } else if ("marathon" === r) {
        const e2 = getCurrentSessionPoolSize();
        showMessage(
          `Correct (${correctCount}/${e2 > 0 ? e2 : "?"})`,
          "success"
        );
      } else showMessage(`Correct (${correctCount} trouv\xE9s)`, "success");
      updateSessionProgressBar(), highlightMonument(i, UI_THEME.mapCorrect), triggerHaptic("success"), feedbackCorrect();
    } else
      errorsCount += 1, showMessage(
        "marathon" === r && errorsCount >= 3 ? "Incorrect (limite de 3 erreurs atteinte)" : "Incorrect",
        "error"
      ), highlightMonument(i, UI_THEME.mapWrong), "classique" === r ? updateWeightedBar(0) : updateSessionProgressBar(), triggerHaptic("error"), feedbackError();
    totalAnswered += 1, summaryData.push({ name: s, correct: n, time: a.toFixed(1) }), trackAnswer(s, "monuments", n, a), updateWeightedScoreUI(), updateScoreUI(), !n && "marathon" === r && errorsCount >= 3 ? endSession() : (currentMonumentIndex += 1, setNewTarget());
  }
  function highlightMonument(e, t) {
    e && (e.setStyle({ color: t, fillColor: t }), setTimeout(() => {
      e.setStyle && e.setStyle({
        color: UI_THEME.mapMonumentStroke,
        fillColor: UI_THEME.mapMonumentFill
      });
    }, 5e3));
  }
  function showStreetInfo(e) {
    const t = document.getElementById("street-info-panel"), r = document.getElementById("street-info");
    if (!t || !r || !e) return;
    const a = getZoneMode();
    updateStreetInfoPanelTitle(a);
    const isMain = "rues-principales" === a || "main" === a;
    const isFamous = "rues-celebres" === a || "famous" === a;
    if (!isMain && !isFamous)
      return t.style.display = "none", t.classList.remove("is-visible"), r.textContent = "", void r.classList.remove("is-visible");
    const n = e.properties.name || "", s = normalizeName(n);
    let i;
    if (isMain) {
      i = MAIN_STREET_INFOS[s];
      if (!i && MAIN_STREET_NAMES.has(s)) {
        i = "Rue principale : informations historiques \xE0 compl\xE9ter.";
      }
    } else if (isFamous) {
      i = FAMOUS_STREET_INFOS[s];
      if (!i && FAMOUS_STREET_NAMES.has(s)) {
        i = "Rue c\xE9l\xE8bre : informations historiques \xE0 compl\xE9ter.";
      }
    }
    if (!i)
      return t.style.display = "none", t.classList.remove("is-visible"), r.textContent = "", void r.classList.remove("is-visible");
    t.style.display = "block", r.style.display = "block", r.classList.remove("is-visible"), r.offsetWidth, r.innerHTML = `<strong>${n}</strong><br>${i}`, t.classList.add("is-visible"), r.classList.add("is-visible");
  }
  function trackAnswer(e, t, r, a) {
    e && fetch(API_URL + "/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streetName: e, mode: t, correct: r, timeSec: a })
    }).catch(() => {
    });
  }
  function feedbackCorrect() {
    if (playDing(), "function" == typeof confetti && confetti({
      particleCount: 60,
      spread: 55,
      origin: { y: 0.7 },
      colors: [UI_THEME.mapCorrect, UI_THEME.mapMonumentFill, "#a9b8ec", UI_THEME.mapStreet],
      gravity: 1.2,
      scalar: 0.8,
      ticks: 120
    }), highlightedLayers && highlightedLayers.length > 0) {
      let e = 0;
      const t = setInterval(() => {
        const r = e % 2 == 0 ? 12 : 6, a = e % 2 == 0 ? 1 : 0.5;
        highlightedLayers.forEach((e2) => {
          e2.setStyle && e2.setStyle({ weight: r, opacity: a });
        }), e++, e >= 6 && (clearInterval(t), highlightedLayers.forEach((e2) => {
          e2.setStyle && e2.setStyle({ weight: 8, opacity: 1 });
        }));
      }, 200);
    }
  }
  function feedbackError() {
    playBuzz();
    const e = document.getElementById("map");
    e && (e.classList.add("map-shake"), setTimeout(() => e.classList.remove("map-shake"), 500));
  }
  function highlightStreet(e) {
    currentTarget && highlightStreetByName(currentTarget.properties.name, e);
  }
  function highlightStreetByName(e, t) {
    clearHighlight();
    const r = normalizeName(e);
    if (!r) return [];
    const a = [];
    if (streetLayersById.forEach((e2) => {
      normalizeName(e2.feature.properties.name) === r && a.push(e2);
    }), 0 === a.length)
      return [];
    highlightedLayers = a, highlightedLayers.forEach((e2) => {
      e2.setStyle({ color: t, weight: 8 });
    });
    let n = null;
    return a.forEach((e2) => {
      if ("function" == typeof e2.getBounds) {
        const t2 = e2.getBounds();
        n = n ? n.extend(t2) : t2;
      }
    }), n && n.isValid && n.isValid() && map.fitBounds(n, { padding: [60, 60], animate: true, duration: 1.5 }), highlightTimeoutId = setTimeout(() => {
      highlightedLayers.forEach((e2) => {
        e2.setStyle({ color: UI_THEME.mapStreet, weight: 5 });
      }), highlightedLayers = [], highlightTimeoutId = null;
    }, 5e3), a;
  }
  function findMonumentLayerByName(e) {
    if (!monumentsLayer || !e) return null;
    const t = normalizeName(e);
    let r = null;
    return monumentsLayer.eachLayer((e2) => {
      var _a, _b;
      normalizeName((_b = (_a = e2.feature) == null ? void 0 : _a.properties) == null ? void 0 : _b.name) === t && (r = e2);
    }), r;
  }
  function clearHighlight() {
    null !== highlightTimeoutId && (clearTimeout(highlightTimeoutId), highlightTimeoutId = null), highlightedLayers && highlightedLayers.length > 0 && (highlightedLayers.forEach((e) => {
      e.setStyle({ color: UI_THEME.mapStreet, weight: 5 });
    }), highlightedLayers = []);
  }
  function focusStreetByName(e) {
    const t = highlightStreetByName(e, UI_THEME.mapStreetHover);
    if (!t || 0 === t.length) return null;
    let r = null;
    t.forEach((e2) => {
      if ("function" == typeof e2.getBounds) {
        const t2 = e2.getBounds();
        r = r ? r.extend(t2) : t2;
      }
    }), r && r.isValid && r.isValid() && map.fitBounds(r, { padding: [40, 40], animate: true, duration: 1.5 });
    return t[0] || null;
  }
  function endSession() {
    document.body.classList.add("session-ended");
    playVictory();
    const e = performance.now(), t = sessionStartTime ? (e - sessionStartTime) / 1e3 : 0;
    sessionStartTime = null, streetStartTime = null, currentTarget = null, currentMonumentTarget = null, isSessionRunning = false, isChronoMode = false, chronoEndTime = null, isDailyMode && (isDailyMode = false, updateDailyUI()), isLectureMode = false, updateTargetPanelTitle(), updateLayoutSessionState(), isPaused = false, pauseStartTime = null, remainingChronoMs = null, updateStartStopButton(), updatePauseButton(), updateLayoutSessionState();
    const r = document.getElementById("skip-btn");
    r && (r.style.display = "none");
    const a = summaryData.length, n = summaryData.filter((e2) => e2.correct).length, s = 0 === a ? 0 : Math.round(n / a * 100), i = 0 === a ? 0 : summaryData.reduce((e2, t2) => e2 + parseFloat(t2.time), 0) / a, l = getGameMode(), o = getZoneMode(), uScore = getSessionScoreValue(l), poolSize = "marathon" === l || "chrono" === l ? getCurrentSessionPoolSize() : a;
    let u = null;
    if ("quartier" === o) {
      const e2 = document.getElementById("quartier-select");
      e2 && e2.value && (u = e2.value);
    }
    const d = document.getElementById("summary");
    if (!d) return;
    if (100 === s && a > 0) {
      const e2 = 5e3, t2 = Date.now() + e2, r2 = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }, a2 = (e3, t3) => Math.random() * (t3 - e3) + e3, n2 = setInterval(function() {
        const s2 = t2 - Date.now();
        if (s2 <= 0) return clearInterval(n2);
        const i2 = s2 / e2 * 50;
        confetti({
          ...r2,
          particleCount: i2,
          origin: { x: a2(0.1, 0.3), y: Math.random() - 0.2 }
        }), confetti({
          ...r2,
          particleCount: i2,
          origin: { x: a2(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
    }
    d.innerHTML = "";
    const c = document.createElement("div");
    c.className = "summary-global";
    const m = document.createElement("h2");
    let p;
    m.textContent = "R\xE9capitulatif de la session", c.appendChild(m), p = "marathon" === l ? "Mode : Marathon (max. 3 erreurs)" : "chrono" === l ? "Mode : Chrono (60 s)" : "Mode : Classique (20 items max)", p += ` \u2013 Zone : ${o}`, u && (p += ` \u2013 Quartier : ${u}`);
    const g = document.createElement("p");
    g.textContent = p, c.appendChild(g);
    const h = document.createElement("div");
    const yScoreLine = "classique" === l ? `<p>Score pond\xE9r\xE9 : <strong>${uScore.toFixed(1)} pts</strong></p>` : "marathon" === l ? `<p>Rues trouv\xE9es : <strong>${Math.round(uScore)} / ${poolSize || 0}</strong></p>` : `<p>Rues trouv\xE9es : <strong>${Math.round(uScore)}</strong> en 60 s</p>`;
    h.className = "summary-stats", h.innerHTML = `<p>Temps total : <strong>${t.toFixed(1)} s</strong></p>
     <p>Temps moyen par item : <strong>${i.toFixed(1)} s</strong></p>
     <p>Score : <strong>${s} %</strong> (${n} bonnes r\xE9ponses / ${a})</p>
     ${yScoreLine}`, c.appendChild(h), d.appendChild(c);
    const y = document.createElement("div");
    y.className = "summary-detail";
    const v = document.createElement("div");
    v.className = "summary-detail-header";
    const f = document.createElement("h3");
    f.textContent = "D\xE9tail par item (cliquable pour zoomer et voir la fiche)", v.appendChild(f);
    const b = document.createElement("div");
    b.className = "summary-filters";
    let S = "all";
    [
      { value: "all", label: "Tous" },
      { value: "correct", label: "Corrects" },
      { value: "incorrect", label: "Incorrects" }
    ].forEach((e2) => {
      const t2 = document.createElement("button");
      t2.type = "button", t2.className = "summary-filter-btn", t2.dataset.filter = e2.value, t2.textContent = e2.label, e2.value === S && t2.classList.add("is-active"), b.appendChild(t2);
    }), v.appendChild(b), y.appendChild(v);
    const L2 = document.createElement("ul");
    function M(e2) {
      L2.querySelectorAll(".summary-item").forEach((t2) => {
        const r2 = "true" === t2.dataset.correct;
        let a2 = false;
        "all" === e2 ? a2 = true : "correct" === e2 ? a2 = r2 : "incorrect" === e2 && (a2 = !r2), t2.style.display = a2 ? "" : "none";
      });
    }
    L2.className = "summary-list", summaryData.forEach((e2) => {
      const t2 = document.createElement("li");
      t2.classList.add("summary-item"), t2.dataset.correct = e2.correct ? "true" : "false", e2.correct ? t2.classList.add("summary-item--correct") : t2.classList.add("summary-item--incorrect"), t2.textContent = `${e2.name} \u2013 ${e2.correct ? "Correct" : "Incorrect"} \u2013 ${e2.time} s`, t2.dataset.streetName = e2.name, t2.addEventListener("click", () => {
        const t3 = focusStreetByName(e2.name);
        t3 && t3.feature && showStreetInfo(t3.feature);
      }), L2.appendChild(t2);
    }), y.appendChild(L2), d.appendChild(y), b.querySelectorAll(".summary-filter-btn").forEach((e2) => {
      e2.addEventListener("click", () => {
        const t2 = e2.dataset.filter;
        t2 && t2 !== S && (S = t2, b.querySelectorAll(".summary-filter-btn").forEach((t3) => {
          t3.classList.toggle("is-active", t3 === e2);
        }), M(S));
      });
    }), M(S), d.classList.remove("hidden"), showMessage("Session termin\xE9e.", "info");
    const T = document.getElementById("target-street");
    T && (T.textContent = "\u2014", requestAnimationFrame(fitTargetStreetText)), refreshLectureStreetSearchForCurrentMode(), currentUser && currentUser.token && sendScoreToServer({
      zoneMode: o,
      quartierName: u,
      gameMode: l,
      score: uScore,
      percentCorrect: s,
      totalTimeSec: t,
      itemsTotal: poolSize,
      itemsCorrect: n
    }), loadLeaderboard(o, u, l);
  }
  function updateScoreUI() {
    const e = document.getElementById("score"), t = document.getElementById("score-pill");
    if (!e) return;
    if (0 === totalAnswered)
      return e.textContent = "0 / 0 (0 %)", void (t && (t.className = "score-pill score-pill--neutral"));
    const r = Math.round(correctCount / totalAnswered * 100);
    e.textContent = `${correctCount} / ${totalAnswered} (${r} %)`, t && (t.className = r > 50 ? "score-pill score-pill--good" : r > 0 ? "score-pill score-pill--warn" : "score-pill score-pill--neutral");
  }
  function updateTimeUI(e, t, r) {
    const a = document.getElementById("total-time"), n = document.getElementById("street-time");
    a && (null != r ? (a.textContent = r.toFixed(1) + " s", r > 30 ? (a.style.color = UI_THEME.timerSafe, a.classList.remove("chrono-blink")) : r > 10 ? (a.style.color = UI_THEME.timerWarn, a.classList.remove("chrono-blink")) : (a.style.color = UI_THEME.timerDanger, r <= 5 && a.classList.add("chrono-blink"))) : (a.textContent = e.toFixed(1) + " s", a.style.color = "", a.classList.remove("chrono-blink"))), n && (n.textContent = t.toFixed(1) + " s");
  }
  function updateWeightedScoreUI() {
    const e = document.getElementById("weighted-score");
    if (!e) return;
    const t = getScoreMetricUIConfig(), r = getSessionScoreValue();
    e.textContent = t.decimals > 0 ? r.toFixed(t.decimals) : String(Math.round(r));
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
      const e2 = getCurrentSessionPoolSize();
      return void updateWeightedBar(e2 > 0 ? correctCount / e2 : 0);
    }
    if ("chrono" === e) {
      const e2 = getTitleThresholds(
        getZoneMode(),
        "chrono",
        getCurrentSessionPoolSize()
      ), t = Math.max(1, e2.MV || 1);
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
      } catch (e2) {
        console.warn("Impossible de sauvegarder l\u2019utilisateur.", e2);
      }
  }
  function loadCurrentUserFromStorage() {
    const e = window.localStorage.getItem("camino_user");
    if (!e) return null;
    try {
      return JSON.parse(e);
    } catch (e2) {
      return console.error("Erreur parsing user storage", e2), null;
    }
  }
  function clearCurrentUserFromStorage() {
    try {
      window.localStorage.removeItem("camino_user");
    } catch (e) {
      console.warn("Impossible de supprimer l\u2019utilisateur stock\xE9.", e);
    }
  }
  function renderUserSticker() {
    const sticker = document.getElementById("user-sticker"), loginHint = document.getElementById("login-hint");
    if (!sticker) return;
    if (currentUser && currentUser.username) {
      const avatarValue = currentUser.avatar || "\u{1F464}", avatarEl = document.createElement("span"), nameEl = document.createElement("span");
      avatarEl.className = "user-sticker-avatar", avatarEl.textContent = avatarValue, nameEl.className = "user-sticker-name", nameEl.textContent = currentUser.username, sticker.replaceChildren(avatarEl, nameEl), sticker.style.display = "inline-flex", loginHint && (loginHint.style.display = "none");
      return;
    }
    sticker.textContent = "", sticker.style.display = "none", loginHint && (loginHint.style.display = "");
  }
  function updateUserUI() {
    const e = document.getElementById("current-user-label"), t = document.querySelector(".auth-block"), r = document.getElementById("logout-btn"), a = document.getElementById("daily-mode-btn");
    if (currentUser && currentUser.username) {
      e && (e.textContent = `Connect\xE9 en tant que ${currentUser.username}`), renderUserSticker(), t && (t.querySelectorAll("input").forEach((e2) => e2.style.display = "none"), t.querySelectorAll("button:not(#logout-btn)").forEach((e2) => e2.style.display = "none")), r && (r.style.display = "inline-block"), a && (a.style.display = "inline-flex");
      const i = document.getElementById("profile-panel");
      i && (i.style.display = "block"), loadProfile();
    } else {
      e && (e.textContent = "Non connect\xE9."), renderUserSticker(), t && (t.querySelectorAll("input").forEach((e2) => e2.style.display = ""), t.querySelectorAll("button:not(#logout-btn)").forEach((e2) => e2.style.display = "")), r && (r.style.display = "none"), a && (a.style.display = "none");
      const i = document.getElementById("profile-panel");
      i && (i.style.display = "none");
    }
  }
  infoEl && (infoEl.textContent = ""), function() {
    const e = document.getElementById("weighted-score-help-btn"), t = document.getElementById("weighted-score-help");
    if (!e || !t) return;
    t.id || (t.id = "weighted-score-help"), e.setAttribute("aria-controls", t.id), e.setAttribute("aria-expanded", "false");
    const r = () => {
      t.classList.remove("hidden"), t.classList.add("is-open"), e.setAttribute("aria-expanded", "true");
    }, a = () => {
      t.classList.remove("is-open"), e.setAttribute("aria-expanded", "false");
    };
    e.addEventListener("mouseenter", r), e.addEventListener("mouseleave", a), t.addEventListener("mouseenter", r), t.addEventListener("mouseleave", a), e.addEventListener("focus", r), e.addEventListener("blur", a), e.addEventListener("click", (e2) => {
      e2.preventDefault(), t.classList.contains("is-open") ? a() : r();
    }), document.addEventListener(
      "click",
      (r2) => {
        e.contains(r2.target) || t.contains(r2.target) || a();
      },
      true
    ), document.addEventListener("keydown", (e2) => {
      "Escape" === e2.key && a();
    });
  }();
  var BADGE_DEFINITIONS = [
    {
      id: "first_game",
      emoji: "\u{1F3AE}",
      name: "Premi\xE8re Partie",
      desc: "Terminer une session",
      check: (e) => {
        var _a;
        return (parseInt((_a = e.overall) == null ? void 0 : _a.total_games) || 0) >= 1;
      }
    },
    {
      id: "games_10",
      emoji: "\u{1F51F}",
      name: "25 Parties",
      desc: "Jouer 25 sessions",
      check: (e) => {
        var _a;
        return (parseInt((_a = e.overall) == null ? void 0 : _a.total_games) || 0) >= 25;
      }
    },
    {
      id: "games_50",
      emoji: "\u{1F4AF}",
      name: "Habitu\xE9",
      desc: "Jouer 100 sessions",
      check: (e) => {
        var _a;
        return (parseInt((_a = e.overall) == null ? void 0 : _a.total_games) || 0) >= 100;
      }
    },
    {
      id: "games_100",
      emoji: "\u{1F48E}",
      name: "V\xE9t\xE9ran",
      desc: "Jouer 250 sessions",
      check: (e) => {
        var _a;
        return (parseInt((_a = e.overall) == null ? void 0 : _a.total_games) || 0) >= 250;
      }
    },
    {
      id: "minot",
      emoji: "\u{1F9D2}",
      name: "Minot",
      desc: "Atteindre Minot dans tous les modes et toutes les zones",
      check: (e) => hasReachedGlobalRank(e, "M")
    },
    {
      id: "habitue",
      emoji: "\u2693",
      name: "Habitu\xE9 du Vieux-Port",
      desc: "Atteindre Habitu\xE9 dans tous les modes et toutes les zones",
      check: (e) => hasReachedGlobalRank(e, "H")
    },
    {
      id: "vrai",
      emoji: "\u{1F4AA}",
      name: "Vrai Marseillais",
      desc: "Atteindre Vrai Marseillais dans tous les modes et toutes les zones",
      check: (e) => hasReachedGlobalRank(e, "V")
    },
    {
      id: "maire",
      emoji: "\u{1F3DB}\uFE0F",
      name: "Maire de la Ville",
      desc: "Atteindre Maire dans tous les modes et toutes les zones",
      check: (e) => hasReachedGlobalRank(e, "MV")
    },
    {
      id: "celebres",
      emoji: "\u2B50",
      name: "\xC9toile de la Caneb",
      desc: "Jouer en Rues C\xE9l\xE8bres",
      check: (e) => (e.modes || []).some((e2) => "rues-celebres" === e2.mode)
    },
    {
      id: "ville",
      emoji: "\u{1F3D9}\uFE0F",
      name: "Explorateur",
      desc: "Jouer en Ville Enti\xE8re",
      check: (e) => (e.modes || []).some((e2) => "ville" === e2.mode)
    },
    {
      id: "monuments",
      emoji: "\u{1F5FF}",
      name: "Touriste Culturel",
      desc: "Jouer en mode Monuments",
      check: (e) => (e.modes || []).some((e2) => "monuments" === e2.mode)
    },
    {
      id: "all_zones",
      emoji: "\u{1F9ED}",
      name: "Globe-trotter",
      desc: "Jouer dans chaque zone",
      check: (e) => {
        const t = new Set((e.modes || []).map((e2) => e2.mode));
        return [
          "ville",
          "quartier",
          "rues-principales",
          "rues-celebres",
          "monuments"
        ].every((e2) => t.has(e2));
      }
    },
    {
      id: "daily_first",
      emoji: "\u{1F4C5}",
      name: "Premier Daily",
      desc: "R\xE9ussir un Daily Challenge",
      check: (e) => {
        var _a;
        return (parseInt((_a = e.daily) == null ? void 0 : _a.successes) || 0) >= 1;
      }
    },
    {
      id: "daily_5",
      emoji: "\u{1F525}",
      name: "S\xE9rie de 10",
      desc: "10 Daily Challenges r\xE9ussis d'affil\xE9e",
      check: (e) => {
        var _a;
        return (parseInt((_a = e.daily) == null ? void 0 : _a.max_streak) || 0) >= 10;
      }
    },
    {
      id: "daily_10",
      emoji: "\u26A1",
      name: "S\xE9rie de 20",
      desc: "20 Daily Challenges r\xE9ussis d'affil\xE9e",
      check: (e) => {
        var _a;
        return (parseInt((_a = e.daily) == null ? void 0 : _a.max_streak) || 0) >= 20;
      }
    },
    {
      id: "daily_30",
      emoji: "\u{1F3C6}",
      name: "Champion du Mois",
      desc: "50 Daily Challenges r\xE9ussis d'affil\xE9e",
      check: (e) => {
        var _a;
        return (parseInt((_a = e.daily) == null ? void 0 : _a.max_streak) || 0) >= 50;
      }
    },
    {
      id: "perfect",
      emoji: "\u{1F3AF}",
      name: "Sans Faute",
      desc: "Score de 100 dans une session",
      check: (e) => {
        var _a;
        return (parseFloat((_a = e.overall) == null ? void 0 : _a.best_score) || 0) >= 100;
      }
    },
    {
      id: "multi_mode",
      emoji: "\u{1F31F}",
      name: "Polyvalent",
      desc: "Jouer dans 3 modes de jeu diff\xE9rents",
      check: (e) => new Set((e.modes || []).map((e2) => e2.game_type)).size >= 3
    }
  ];
  function computeBadges(e) {
    return BADGE_DEFINITIONS.map((t) => ({ ...t, unlocked: t.check(e) }));
  }
  function loadProfile() {
    if (!currentUser || !currentUser.token) return;
    const e = document.getElementById("profile-content");
    e && (e.innerHTML = '<div class="skeleton skeleton-avatar"></div><div class="skeleton skeleton-line skeleton-line--60"></div><div class="skeleton skeleton-block"></div><div class="skeleton skeleton-line skeleton-line--80"></div>', fetch(API_URL + "/api/profile", {
      headers: { Authorization: "Bearer " + currentUser.token }
    }).then((e2) => {
      if (!e2.ok) throw new Error("HTTP " + e2.status);
      return e2.json();
    }).then((t) => {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      if (currentUser) {
        const e2 = t.avatar || "\u{1F464}", r2 = t.username || currentUser.username, a2 = currentUser.avatar !== e2 || currentUser.username !== r2;
        currentUser.avatar = e2, currentUser.username = r2, a2 && saveCurrentUserToStorage(currentUser), renderUserSticker();
      }
      const r = parseFloat((_a = t.overall) == null ? void 0 : _a.best_score) || 0, gRank = getGlobalRankMeta(t), a = gRank.title, n = parseInt((_b = t.overall) == null ? void 0 : _b.total_games) || 0, s = parseFloat((_c = t.overall) == null ? void 0 : _c.avg_score) || 0, i = parseInt((_d = t.daily) == null ? void 0 : _d.total_days) || 0, l = parseInt((_e = t.daily) == null ? void 0 : _e.successes) || 0, o = parseFloat((_f = t.daily) == null ? void 0 : _f.avg_attempts) || 0, u = t.memberSince ? new Date(t.memberSince).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }) : "\u2014";
      let d = `
        <div class="profile-header">
          <div class="profile-avatar">
            ${t.avatar || "\u{1F464}"}
            <button type="button" class="edit-avatar-badge" id="btn-edit-avatar" title="Changer d'avatar" aria-label="Changer d'avatar">\u270F\uFE0F</button>
          </div>
          <div class="profile-info">
            <div class="profile-name">${t.username}</div>
            <div class="profile-title">${a}</div>
          </div>
        </div>

        <div class="profile-stats-grid">
          <div class="profile-stat">
            <span class="profile-stat-value">${n}</span>
            <span class="profile-stat-label">Parties</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value">${r.toFixed(1)}</span>
            <span class="profile-stat-label">Meilleur</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value">${s}</span>
            <span class="profile-stat-label">Moyenne</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value">${l}/${i}</span>
            <span class="profile-stat-label">Daily \u2705</span>
          </div>
        </div>`;
      t.modes && t.modes.length > 0 && (d += '<div class="profile-modes-title">D\xE9tail par mode</div>', d += '<div class="profile-modes">', t.modes.forEach((e2) => {
        const t2 = ZONE_LABELS[e2.mode] || e2.mode, r2 = GAME_LABELS[e2.game_type] || e2.game_type, n2 = parseFloat(e2.high_score) || 0, s2 = "classique" === e2.game_type ? n2.toFixed(1) : String(Math.round(n2)), a2 = getPlayerTitle(
          n2,
          e2.mode,
          e2.game_type,
          e2.best_items_total || 0,
          e2.best_items_correct || 0
        );
        d += `
            <div class="profile-mode-row">
              <div class="profile-mode-name">${t2} \u2014 ${r2}</div>
              <div class="profile-mode-details">
                <span>\u{1F3C6} ${s2}</span>
                <span>\u{1F4CA} \xD8${parseFloat(e2.avg_score).toFixed(1)}</span>
                <span>\u{1F3AE} ${e2.games_played}</span>
              </div>
              <div class="profile-mode-title">${a2}</div>
            </div>`;
      }), d += "</div>"), i > 0 && (d += `
          <div class="profile-daily-summary">
            <span>\u{1F4C5} Daily : ${o} essais en moyenne</span>
            ${((_g = t.daily) == null ? void 0 : _g.current_streak) > 0 ? `<br><span class="profile-daily-current-streak">\u{1F525} S\xE9rie actuelle : ${t.daily.current_streak}</span>` : ""}
            ${((_h = t.daily) == null ? void 0 : _h.max_streak) > 0 ? `<br><span class="profile-daily-best-streak">\u{1F3C6} Meilleure s\xE9rie : ${t.daily.max_streak}</span>` : ""}
          </div>`);
      const c = computeBadges(t), m = c.filter((e2) => e2.unlocked), p = c.filter((e2) => !e2.unlocked);
      d += `<div class="profile-badges-title">Succ\xE8s (${m.length}/${c.length})</div>`, d += '<div class="profile-badges-grid">', m.forEach((e2) => {
        d += `<div class="profile-badge unlocked" tabindex="0" title="${e2.name}
\u2705 ${e2.desc}" data-tooltip="${e2.name}
\u2705 ${e2.desc}" aria-label="${e2.name} d\xE9bloqu\xE9. ${e2.desc}">
          <span class="badge-emoji">${e2.emoji}</span>
          <span class="badge-name">${e2.name}</span>
        </div>`;
      }), p.forEach((e2) => {
        d += `<div class="profile-badge locked" tabindex="0" title="${e2.name}
\u{1F512} ${e2.desc}" data-tooltip="${e2.name}
\u{1F512} ${e2.desc}" aria-label="${e2.name} verrouill\xE9. ${e2.desc}">
          <span class="badge-emoji">\u{1F512}</span>
          <span class="badge-name">${e2.name}</span>
        </div>`;
      }), d += "</div>", d += `<div class="profile-member-since">Membre depuis le ${u}</div>`, e.innerHTML = d;
      initAvatarSelector(t.avatar || "\u{1F464}", gRank.level);
    }).catch((t) => {
      console.warn("Profile error:", t.message), e.innerHTML = '<p class="profile-unavailable">Profil indisponible.</p>';
    }));
  }
  function initAvatarSelector(currentAvatar, globalRankLevel) {
    const btnEdit = document.getElementById("btn-edit-avatar");
    const modal = document.getElementById("avatar-selector-modal");
    const closeBtn = document.getElementById("avatar-modal-close");
    const grid = document.getElementById("avatar-grid");
    const profileStatsGrid = document.querySelector(".profile-stats-grid");
    if (!btnEdit || !modal || !grid) return;
    if (profileStatsGrid && profileStatsGrid.parentNode) {
      profileStatsGrid.parentNode.insertBefore(modal, profileStatsGrid.nextSibling);
    }
    btnEdit.addEventListener("click", () => {
      modal.style.display = "block";
      renderAvatarGrid(currentAvatar, globalRankLevel);
    });
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }
  function renderAvatarGrid(currentAvatar, globalRankLevel) {
    const grid = document.getElementById("avatar-grid");
    grid.innerHTML = "";
    AVATAR_UNLOCKS.forEach((avatarDef) => {
      let requiredLevel = 0;
      let isUnlocked = false;
      if (typeof avatarDef.check === "function") {
        isUnlocked = avatarDef.check(currentUser);
      } else {
        requiredLevel = getGlobalRankLevelForTitleIndex(avatarDef.reqTitleIdx);
        isUnlocked = globalRankLevel >= requiredLevel;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.className = "avatar-item";
      item.textContent = avatarDef.emoji;
      if (avatarDef.emoji === currentAvatar) {
        item.classList.add("selected");
      }
      if (typeof avatarDef.check === "function") {
        if (!isUnlocked) {
          item.classList.add("locked");
          item.title = `Titre sp\xE9cifique requis:
\u{1F512} ${avatarDef.name}
(${avatarDef.desc})`;
          item.setAttribute("aria-disabled", "true");
        } else {
          item.title = `D\xE9bloqu\xE9:
\u2705 ${avatarDef.name}
- ${avatarDef.desc}`;
        }
      } else {
        const reqTitle = TITLE_NAMES[avatarDef.reqTitleIdx];
        if (!isUnlocked) {
          item.classList.add("locked");
          item.title = `Titre global requis:
\u{1F512} ${reqTitle}
(\xE0 atteindre dans tous les modes et zones)`;
          item.setAttribute("aria-disabled", "true");
        } else {
          item.title = `D\xE9bloqu\xE9:
\u2705 ${reqTitle} (global)`;
          if (avatarDef.desc) item.title += ` - ${avatarDef.desc}`;
        }
      }
      item.setAttribute("data-tooltip", item.title || "");
      if (isUnlocked) {
        item.addEventListener("click", () => {
          fetch(API_URL + "/api/profile/avatar", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + currentUser.token
            },
            body: JSON.stringify({ avatar: avatarDef.emoji })
          }).then((res) => {
            if (!res.ok) throw new Error("Erreur sauvegarde avatar");
            return res.json();
          }).then((data) => {
            currentUser.avatar = avatarDef.emoji;
            saveCurrentUserToStorage(currentUser);
            updateUserUI();
            document.getElementById("avatar-selector-modal").style.display = "none";
            showMessage("Avatar mis \xE0 jour !", "success");
          }).catch((err) => {
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
            Authorization: "Bearer " + currentUser.token
          },
          body: JSON.stringify({
            mode: e.zoneMode,
            gameType: e.gameMode,
            score: e.score,
            itemsCorrect: e.itemsCorrect,
            itemsTotal: e.itemsTotal,
            timeSec: e.totalTimeSec,
            quartierName: e.quartierName
          })
        }).then((e2) => e2.json()).then(() => {
          loadAllLeaderboards();
        }).catch((e2) => {
          console.error("Erreur envoi score :", e2);
        });
      } catch (e2) {
        console.error("Erreur envoi score (synchrone) :", e2);
      }
  }
  var TITLE_THRESHOLDS_BY_MODE = {
    classique: {
      "rues-celebres": { M: 60, H: 100, V: 140, MV: 180 },
      "rues-principales": { M: 50, H: 90, V: 130, MV: 170 },
      quartier: { M: 40, H: 80, V: 120, MV: 160 },
      ville: { M: 30, H: 70, V: 110, MV: 150 },
      monuments: { M: 40, H: 80, V: 120, MV: 160 }
    },
    marathon: {
      "rues-celebres": { M: 10, H: 20, V: 35, MV: 55 },
      "rues-principales": { M: 9, H: 18, V: 30, MV: 48 },
      ville: { M: 8, H: 16, V: 28, MV: 44 },
      monuments: { M: 9, H: 18, V: 30, MV: 46 }
    },
    chrono: {
      "rues-celebres": { M: 7, H: 11, V: 16, MV: 22 },
      "rues-principales": { M: 6, H: 10, V: 14, MV: 19 },
      quartier: { M: 5, H: 8, V: 12, MV: 16 },
      ville: { M: 4, H: 7, V: 10, MV: 14 },
      monuments: { M: 5, H: 8, V: 12, MV: 16 }
    }
  };
  var TITLE_NAMES = [
    "\u{1F3DB}\uFE0F Maire de la Ville",
    "\u{1F4AA} Vrai Marseillais",
    "\u2693 Habitu\xE9 du Vieux-Port",
    "\u{1F9D2} Minot",
    "\u{1F9F3} Touriste"
  ];
  function buildQuartierMarathonThresholds(e) {
    const t = Math.max(1, parseInt(e, 10) || 55), r = Math.min(t, Math.max(1, Math.ceil(0.1 * t))), a = Math.min(t, Math.max(r + 1, Math.ceil(0.2 * t))), n = Math.min(t, Math.max(a + 1, Math.ceil(0.35 * t))), s = Math.min(t, Math.max(n + 1, Math.ceil(0.55 * t)));
    return { M: r, H: a, V: n, MV: s };
  }
  function getTitleThresholds(e, t = "classique", r = 0) {
    const a = TITLE_THRESHOLDS_BY_MODE[t] || TITLE_THRESHOLDS_BY_MODE.classique;
    if ("marathon" === t && "quartier" === e) return buildQuartierMarathonThresholds(r);
    return a[e] || a.quartier || TITLE_THRESHOLDS_BY_MODE.classique[e] || TITLE_THRESHOLDS_BY_MODE.classique.quartier;
  }
  function getTitleScoreValue(e, t, r = "classique") {
    if ("classique" === r) return parseFloat(e) || 0;
    const a = parseFloat(t);
    return Number.isFinite(a) ? a : parseFloat(e) || 0;
  }
  var SCORING_GAME_TYPES = ["classique", "marathon", "chrono"];
  var SCORING_ZONES = [
    "rues-celebres",
    "rues-principales",
    "quartier",
    "monuments"
  ];
  function getGlobalRankLevelForTitleIndex(e) {
    const parsed = parseInt(e, 10);
    return Math.max(0, 4 - (isNaN(parsed) ? 4 : parsed));
  }
  function getGlobalRankTitleFromLevel(e) {
    return e >= 4 ? TITLE_NAMES[0] : e >= 3 ? TITLE_NAMES[1] : e >= 2 ? TITLE_NAMES[2] : e >= 1 ? TITLE_NAMES[3] : TITLE_NAMES[4];
  }
  function buildScoringComboMap(e) {
    const t = /* @__PURE__ */ new Map();
    return ((e == null ? void 0 : e.modes) || []).forEach((e2) => {
      if (!e2 || !SCORING_GAME_TYPES.includes(e2.game_type) || !SCORING_ZONES.includes(e2.mode))
        return;
      t.set(`${e2.mode}|${e2.game_type}`, e2);
    }), t;
  }
  function hasReachedGlobalRank(e, t) {
    const r = buildScoringComboMap(e);
    return SCORING_GAME_TYPES.every(
      (a) => SCORING_ZONES.every((n) => {
        const s = r.get(`${n}|${a}`);
        if (!s) return false;
        const i = getTitleThresholds(n, a, s.best_items_total || 0), l = getTitleScoreValue(s.high_score, s.best_items_correct, a);
        return "number" == typeof (i == null ? void 0 : i[t]) && l >= i[t];
      })
    );
  }
  function getGlobalRankLevel(e) {
    return hasReachedGlobalRank(e, "MV") ? 4 : hasReachedGlobalRank(e, "V") ? 3 : hasReachedGlobalRank(e, "H") ? 2 : hasReachedGlobalRank(e, "M") ? 1 : 0;
  }
  function getGlobalRankMeta(e) {
    const t = getGlobalRankLevel(e);
    return { level: t, title: getGlobalRankTitleFromLevel(t) };
  }
  var AVATAR_UNLOCKS = [
    // Default (0 pts)
    { emoji: "\u{1F464}", reqScore: 0, reqTitleIdx: 4 },
    { emoji: "\u{1F9D1}", reqScore: 0, reqTitleIdx: 4 },
    { emoji: "\u{1F467}", reqScore: 0, reqTitleIdx: 4 },
    // Minot (index 3)
    { emoji: "\u{1F9D2}", reqScore: 50, reqTitleIdx: 3 },
    { emoji: "\u{1F6F4}", reqScore: 50, reqTitleIdx: 3 },
    { emoji: "\u{1F355}", reqScore: 50, reqTitleIdx: 3 },
    // Habitué (index 2)
    { emoji: "\u2693", reqScore: 80, reqTitleIdx: 2 },
    { emoji: "\u{1F41F}", reqScore: 80, reqTitleIdx: 2 },
    { emoji: "\u26F5", reqScore: 80, reqTitleIdx: 2 },
    { emoji: "\u{1F30A}", reqScore: 80, reqTitleIdx: 2 },
    // Vrai Marseillais (index 1)
    { emoji: "\u{1F4AA}", reqScore: 120, reqTitleIdx: 1 },
    { emoji: "\u2600\uFE0F", reqScore: 120, reqTitleIdx: 1 },
    { emoji: "\u{1F3D6}\uFE0F", reqScore: 120, reqTitleIdx: 1 },
    { emoji: "\u{1F60E}", reqScore: 120, reqTitleIdx: 1 },
    // Maire (index 0)
    { emoji: "\u{1F3DB}\uFE0F", reqScore: 150, reqTitleIdx: 0 },
    { emoji: "\u{1F985}", reqScore: 150, reqTitleIdx: 0, desc: "Gabian" },
    { emoji: "\u26BD", reqScore: 150, reqTitleIdx: 0 },
    { emoji: "\u{1F451}", reqScore: 150, reqTitleIdx: 0 },
    // Ville Spécial 
    {
      emoji: "\u{1F680}",
      name: "Astronaute",
      desc: "Atteindre Minot sur la Ville Enti\xE8re (Tous modes)",
      check: (user) => hasReachedVilleRank(user, "M")
    },
    {
      emoji: "\u2B50\uFE0F",
      name: "\xC9toile",
      desc: "Atteindre Habitu\xE9 sur la Ville Enti\xE8re (Tous modes)",
      check: (user) => hasReachedVilleRank(user, "H")
    },
    {
      emoji: "\u{1F6F8}",
      name: "Extraterrestre",
      desc: "Atteindre Vrai Marseillais sur la Ville Enti\xE8re (Tous modes)",
      check: (user) => hasReachedVilleRank(user, "V")
    },
    {
      emoji: "\u{1F47D}",
      name: "Alien",
      desc: "Atteindre Maire sur la Ville Enti\xE8re (Tous modes)",
      check: (user) => hasReachedVilleRank(user, "MV")
    }
  ];
  function hasReachedVilleRank(user, rankLetter) {
    const r = buildScoringComboMap(user);
    return SCORING_GAME_TYPES.every((gameType) => {
      const s = r.get(`ville|${gameType}`);
      if (!s) return false;
      const i = getTitleThresholds("ville", gameType, s.best_items_total || 0), l = getTitleScoreValue(s.high_score, s.best_items_correct, gameType);
      return typeof (i == null ? void 0 : i[rankLetter]) === "number" && l >= i[rankLetter];
    });
  }
  function getPlayerTitle(e, t, r = "classique", a = 0, n = null) {
    const s = getTitleThresholds(t, r, a), i = getTitleScoreValue(e, n, r);
    return i >= s.MV ? TITLE_NAMES[0] : i >= s.V ? TITLE_NAMES[1] : i >= s.H ? TITLE_NAMES[2] : i >= s.M ? TITLE_NAMES[3] : TITLE_NAMES[4];
  }
  var ZONE_LABELS = {
    ville: "Ville enti\xE8re",
    "rues-principales": "Rues principales",
    "rues-celebres": "Rues c\xE9l\xE8bres",
    quartier: "Quartier",
    monuments: "Monuments"
  };
  var GAME_LABELS = {
    classique: "Classique",
    marathon: "Marathon",
    chrono: "Chrono",
    lecture: "Lecture"
  };
  var ZONE_ORDER = [
    "rues-celebres",
    "rues-principales",
    "quartier",
    "ville",
    "monuments"
  ];
  var GAME_ORDER = ["classique", "marathon", "chrono", "lecture"];
  function loadAllLeaderboards() {
    const e = document.getElementById("leaderboard");
    e && (e.innerHTML = '<div class="skeleton skeleton-line skeleton-line--50"></div><div class="skeleton skeleton-block"></div><div class="skeleton skeleton-block"></div>', Promise.all([
      fetch(API_URL + "/api/leaderboards").then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }),
      fetch(API_URL + "/api/daily/leaderboard").then((res) => {
        if (!res.ok) return [];
        return res.json();
      }).catch(() => [])
    ]).then(([t, dailyRows]) => {
      const r = Object.keys(t);
      if (0 === r.length && 0 === dailyRows.length)
        return void (e.innerHTML = "<p>Aucun score enregistr\xE9.</p>");
      e.innerHTML = "";
      if (dailyRows && dailyRows.length > 0) {
        const dailyDetails = document.createElement("details");
        dailyDetails.className = "leaderboard-zone-details";
        dailyDetails.open = true;
        const dailySummary = document.createElement("summary");
        const todayStr = new Intl.DateTimeFormat("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit"
        }).format(/* @__PURE__ */ new Date());
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
          const rank = (0 === i ? "\u{1F947} " : 1 === i ? "\u{1F948} " : 2 === i ? "\u{1F949} " : "") || `${i + 1}`;
          const pAvatar = row.avatar || "\u{1F464}";
          tr.innerHTML = `<td>${rank}</td><td><span class="leaderboard-avatar">${pAvatar}</span>${row.username || "Anonyme"}</td><td>${row.attempts_count}/7</td>`;
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        const modeContainer = document.createElement("div");
        modeContainer.className = "leaderboard-mode-container";
        const modeTitle = document.createElement("h4");
        modeTitle.className = "leaderboard-mode-title";
        modeTitle.textContent = "D\xE9fi du Jour";
        modeContainer.appendChild(modeTitle);
        const section = document.createElement("div");
        section.className = "leaderboard-section";
        section.appendChild(table);
        modeContainer.appendChild(section);
        dailyContent.appendChild(modeContainer);
        dailyDetails.appendChild(dailyContent);
        e.appendChild(dailyDetails);
      }
      const a = {};
      r.forEach((e2) => {
        const r2 = e2.split("|"), n = r2[0], s = r2[1], i = r2[2] || null, l = t[e2];
        l && 0 !== l.length && (a[n] || (a[n] = {}), a[n][s] || (a[n][s] = []), a[n][s].push({ quartierName: i, rows: l }));
      }), ZONE_ORDER.forEach((t2) => {
        if (!a[t2]) return;
        const r2 = a[t2], n = document.createElement("details");
        n.className = "leaderboard-zone-details";
        const s = document.createElement("summary"), i = ZONE_LABELS[t2] || t2;
        s.innerHTML = `<span class="leaderboard-zone-title">${i}</span>`, n.appendChild(s);
        const l = document.createElement("div");
        l.className = "leaderboard-zone-content", GAME_ORDER.forEach((e2) => {
          if (!r2[e2]) return;
          const a2 = r2[e2], n2 = document.createElement("div");
          n2.className = "leaderboard-mode-container";
          const s2 = document.createElement("h4");
          s2.className = "leaderboard-mode-title", s2.textContent = GAME_LABELS[e2] || e2, n2.appendChild(s2), a2.sort(
            (e3, t3) => e3.quartierName && t3.quartierName ? e3.quartierName.localeCompare(t3.quartierName) : 0
          ), a2.forEach((r3) => {
            const isQuartier = "quartier" === t2 && r3.quartierName && "unknown" !== r3.quartierName;
            const a3 = document.createElement(isQuartier ? "details" : "div");
            if (a3.className = "leaderboard-section", isQuartier) {
              const e3 = document.createElement("summary");
              e3.className = "leaderboard-quartier-title", e3.textContent = r3.quartierName, a3.appendChild(e3);
            }
            const s3 = document.createElement("table");
            s3.className = "leaderboard-table";
            const i2 = document.createElement("thead");
            let l2 = "<tr><th>#</th><th>Joueur</th>";
            l2 += "classique" === e2 ? "<th>Score</th>" : "<th>Rues trouv\xE9es</th>";
            "marathon" === e2 && (l2 += "<th>Max zone</th>");
            "chrono" === e2 && (l2 += "<th>Temps</th>");
            l2 += "<th>Parties</th></tr>";
            i2.innerHTML = l2;
            s3.appendChild(i2);
            const o = document.createElement("tbody"), u = document.createElement("tbody");
            if (u.className = "leaderboard-hidden-rows", u.style.display = "none", r3.rows.forEach((r4, a4) => {
              const n3 = document.createElement("tr"), s4 = (0 === a4 ? "\u{1F947} " : 1 === a4 ? "\u{1F948} " : 2 === a4 ? "\u{1F949} " : "") || `${a4 + 1}`, i3 = getPlayerTitle(
                r4.high_score || 0,
                t2,
                e2,
                r4.items_total || 0,
                r4.items_correct || 0
              ), pAvatar = r4.avatar || "\u{1F464}";
              let l3 = `<td>${s4}</td><td><span class="leaderboard-avatar">${pAvatar}</span>${r4.username || "Anonyme"}<br><small class="leaderboard-player-meta">${i3}</small></td>`;
              const scoreCell = "classique" === e2 ? "number" == typeof r4.high_score ? r4.high_score.toFixed(1) : "-" : `${r4.items_correct || 0}`;
              l3 += `<td>${scoreCell}</td>`, "marathon" === e2 && (l3 += `<td>${r4.items_total || 0}</td>`), "chrono" === e2 && (l3 += `<td>${(r4.time_sec || 0).toFixed(1)}s</td>`), l3 += `<td>${r4.games_played || 0}</td>`, n3.innerHTML = l3, a4 < LEADERBOARD_VISIBLE_ROWS ? o.appendChild(n3) : u.appendChild(n3);
            }), s3.appendChild(o), s3.appendChild(u), a3.appendChild(s3), r3.rows.length > LEADERBOARD_VISIBLE_ROWS) {
              const e3 = document.createElement("div");
              e3.className = "leaderboard-toggle-wrap";
              const t3 = document.createElement("button");
              t3.className = "leaderboard-toggle-btn", t3.textContent = "\u25BC Voir les autres scores", t3.onclick = () => {
                "none" === u.style.display ? (u.style.display = "table-row-group", t3.textContent = "\u25B2 Masquer les scores") : (u.style.display = "none", t3.textContent = "\u25BC Voir les autres scores");
              }, e3.appendChild(t3), a3.appendChild(e3);
            }
            n2.appendChild(a3);
          }), l.appendChild(n2);
        }), n.appendChild(l), e.appendChild(n);
      });
      if (!dailyRows || dailyRows.length === 0) {
        const n = e.querySelector("details");
        n && (n.open = true);
      }
    }).catch((t) => {
      console.warn("Leaderboard indisponible :", t.message), e.innerHTML = "<p>Aucun score enregistr\xE9.</p>";
    }));
  }
  function loadLeaderboard(e, t, r) {
    loadAllLeaderboards();
  }
  async function handleDailyModeClick() {
    if (currentUser && currentUser.token)
      try {
        const e = await fetch(API_URL + "/api/daily", {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        if (!e.ok) throw new Error("Erreur chargement d\xE9fi");
        startDailySession(await e.json());
      } catch (e) {
        console.error(e), showMessage("Impossible de charger le d\xE9fi quotidien.", "error");
      }
    else showMessage("Connectez-vous pour acc\xE9der au d\xE9fi quotidien.", "warning");
  }
  var dailyTargetData = null;
  var dailyTargetGeoJson = null;
  var isDailyMode = false;
  var dailyHighlightLayer = null;
  var dailyGuessHistory = [];
  function startDailySession(e) {
    document.body.classList.remove("session-ended", "daily-game-over");
    dailyTargetData = e, dailyTargetGeoJson = JSON.parse(e.targetGeoJson);
    saveDailyMetaToStorage();
    const t = e.userStatus || {};
    let r = false, a = null;
    t.success ? (r = true, a = { success: true, attempts: t.attempts_count }) : t.attempts_count >= 7 && (r = true, a = { success: false, attempts: t.attempts_count }), isDailyMode = true, isLectureMode = false, setLectureTooltipsEnabled(false), dailyGuessHistory = [], window._dailyGameOver = false, window._dailyGuessInFlight = false;
    const n = document.getElementById("daily-guesses-history");
    n && (n.style.display = "none", n.innerHTML = ""), r ? restoreDailyGuessesFromStorage(e.date) : (t.attempts_count || 0) > 0 && !t.success && (restoreDailyGuessesFromStorage(e.date), dailyGuessHistory.length > 0 && renderDailyGuessHistory()), cleanOldDailyGuessStorage(e.date), isSessionRunning && endSession(), removeDailyHighlight(), currentZoneMode = "ville";
    const s = document.getElementById("mode-select"), i = document.getElementById("mode-select-button");
    s && (s.value = "ville", i && (i.innerHTML = '<span class="custom-select-label">Ville enti\xE8re</span><span class="difficulty-pill difficulty-pill--hard">Difficile</span>'));
    const l = document.getElementById("target-street");
    l && (l.textContent = e.streetName, requestAnimationFrame(fitTargetStreetText));
    const o = Math.max(0, 7 - (t.attempts_count || 0)), u = document.getElementById("target-panel-title");
    u && (u.textContent = r ? t.success ? "\u{1F389} D\xE9fi r\xE9ussi !" : "\u274C D\xE9fi \xE9chou\xE9" : `\u{1F3AF} D\xE9fi quotidien \u2014 ${o} essai${o > 1 ? "s" : ""} restant${o > 1 ? "s" : ""}`), isSessionRunning = true, refreshLectureStreetSearchForCurrentMode(), updateLayoutSessionState();
    const d = document.getElementById("skip-btn"), c = document.getElementById("pause-btn");
    d && (d.style.display = "none"), c && (c.style.display = "none");
    const m = document.getElementById("restart-btn");
    m && (m.textContent = "Quitter le d\xE9fi", m.classList.remove("btn-primary"), m.classList.add("btn-stop"), m.style.display = ""), s && s.dispatchEvent(new Event("change")), r ? (dailyGuessHistory.length > 0 && renderDailyGuessHistory(a), e.targetGeometry && highlightDailyTarget(e.targetGeometry, t.success), t.success ? showMessage(
      `\u{1F389} D\xE9j\xE0 r\xE9ussi aujourd'hui en ${t.attempts_count} essai${t.attempts_count > 1 ? "s" : ""} !`,
      "success"
    ) : showMessage(
      `\u274C Plus d'essais pour aujourd'hui. La rue \xE9tait \xAB ${e.streetName} \xBB.`,
      "error"
    )) : showMessage(`Trouvez : ${e.streetName} (${o} essais restants)`, "info"), updateDailyUI();
  }
  function endDailySession() {
    document.body.classList.remove("daily-game-over");
    isDailyMode = false, isSessionRunning = false, window._dailyGameOver = false, window._dailyGuessInFlight = false;
    updateTargetPanelTitle(), refreshLectureStreetSearchForCurrentMode(), updateStartStopButton(), updatePauseButton(), updateLayoutSessionState(), updateDailyUI(), updateDailyResultPanel();
  }
  function renderDailyGuessHistory(e) {
    try {
      const t = document.getElementById("daily-guesses-history");
      if (!t) return;
      if (!(0 !== dailyGuessHistory.length || e && e.success))
        return t.style.display = "none", void (t.innerHTML = "");
      t.style.display = "block";
      let r = "";
      dailyGuessHistory.length > 0 && (r += '<div class="daily-history-title">Essais pr\xE9c\xE9dents</div>', r += '<table class="daily-history-table">', r += "<thead><tr><th>#</th><th>Rue tent\xE9e</th><th>Distance</th><th></th></tr></thead>", r += "<tbody>", dailyGuessHistory.forEach((t2, a2) => {
        const n = t2.distance >= 1e3 ? `${(t2.distance / 1e3).toFixed(1)} km` : `${Math.round(t2.distance)} m`, s = a2 === dailyGuessHistory.length - 1 && !e;
        let i = "dist-cold";
        t2.distance < 500 ? i = "dist-hot" : t2.distance < 2e3 && (i = "dist-warm"), r += `<tr class="${s ? "daily-row-enter" : ""}">`, r += `<td>${a2 + 1}</td>`, r += `<td>${t2.streetName}</td>`, r += `<td class="${i}">${n}</td>`, r += `<td class="daily-arrow">${t2.arrow || ""}</td>`, r += "</tr>";
      }), r += "</tbody></table>");
      const a = dailyGuessHistory.length;
      if (a >= 2 && dailyTargetData && !e) {
        r += '<div class="daily-hints">', r += '<div class="daily-hints-title">\u{1F4A1} Indices</div>';
        const t2 = dailyTargetData.quartier || "";
        try {
          const e2 = normalizeQuartierKey(t2);
          if (arrondissementByQuartier && arrondissementByQuartier.has(e2)) {
            const t3 = arrondissementByQuartier.get(e2);
            t3 && (r += `<div class="daily-hint">\u{1F4CD} Arrondissement : <strong>${t3}</strong></div>`);
          }
        } catch (e2) {
          console.error("Error with Hint 1:", e2);
        }
        if (a >= 4 && t2 && (r += `<div class="daily-hint">\u{1F3D8}\uFE0F Quartier : <strong>${t2}</strong></div>`), a >= 6 && dailyTargetData.streetName)
          try {
            const e2 = calculateStreetLength(dailyTargetData.streetName);
            if (e2 > 0) {
              const t3 = e2 >= 1e3 ? `${(e2 / 1e3).toFixed(1)} km` : `${Math.round(e2)} m`;
              r += `<div class="daily-hint">\u{1F4CF} Longueur : <strong>~ ${t3}</strong></div>`;
            }
          } catch (e2) {
            console.error("Error with Hint 3:", e2);
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
  function getTodayDailyStorageDate() {
    return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  }
  function getDailyGuessesStorageKey(e) {
    return `${DAILY_GUESSES_STORAGE_PREFIX}${e}`;
  }
  function getDailyMetaStorageKey(e) {
    return `${DAILY_META_STORAGE_PREFIX}${e}`;
  }
  function restoreDailyMetaFromStorage(e) {
    if (!e) return false;
    try {
      const t = localStorage.getItem(getDailyMetaStorageKey(e));
      if (!t) return false;
      const r = JSON.parse(t);
      return !(!r || !r.streetName) && (dailyTargetData = {
        ...dailyTargetData || {},
        date: e,
        streetName: r.streetName,
        quartier: r.quartier || (dailyTargetData == null ? void 0 : dailyTargetData.quartier) || ""
      }, true);
    } catch (e2) {
      return false;
    }
  }
  async function ensureDailyShareContext(e, t) {
    Array.isArray(t) && t.length > 0 && (dailyGuessHistory = t.slice(0, 7).map((e2) => ({ ...e2 })));
    if (dailyTargetData && dailyTargetData.streetName && (!e || !dailyTargetData.date || dailyTargetData.date === e))
      return true;
    if (restoreDailyMetaFromStorage(e)) return true;
    if (!(currentUser && currentUser.token)) return false;
    try {
      const t2 = await fetch(API_URL + "/api/daily", {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      if (!t2.ok) return false;
      const r = await t2.json();
      if (!r || !r.streetName) return false;
      if (e && r.date && r.date !== e) return false;
      return dailyTargetData = { ...dailyTargetData || {}, ...r }, saveDailyMetaToStorage(), true;
    } catch (t2) {
      return false;
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
    let guesses = Array.isArray(dailyGuessHistory) ? dailyGuessHistory.slice() : [];
    const dailyDate = (dailyTargetData == null ? void 0 : dailyTargetData.date) || getTodayDailyStorageDate();
    if (guesses.length === 0 && !window._dailyGameOver && dailyDate) {
      const stored = localStorage.getItem(getDailyGuessesStorageKey(dailyDate));
      if (stored) {
        try {
          guesses = JSON.parse(stored);
        } catch (err) {
        }
      }
    }
    Array.isArray(guesses) || (guesses = []);
    if (guesses.length === 0) {
      panel.style.display = "none";
      return;
    }
    dailyGuessHistory = guesses.slice(0, 7).map((e2) => ({ ...e2 }));
    restoreDailyMetaFromStorage(dailyDate);
    const isSuccess = guesses.some((g) => g.distance < 20);
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
      r += `<div class="daily-result daily-result--success">\u{1F389} Bravo, vous avez trouv\xE9 la rue en ${t} essai${t > 1 ? "s" : ""} !</div>`;
    } else {
      const minDistance = Math.min(...guesses.map((g) => g.distance));
      const t = minDistance >= 1e3 ? `${(minDistance / 1e3).toFixed(1)} km` : `${Math.round(minDistance)} m`;
      r += `<div class="daily-result daily-result--fail">Votre meilleur score est ${t} en sept essais</div>`;
    }
    r += '<div class="daily-share-buttons">';
    r += '<button id="daily-share-text" class="btn-secondary daily-share-btn">\u{1F4CB} Copier le texte</button>';
    r += `<button id="daily-share-image" class="btn-primary daily-share-btn">\u{1F4F8} Partager l'image</button>`;
    r += "</div>";
    r += `<p class="daily-share-hint">L'image est plus impactante sur les r\xE9seaux !</p>`;
    content.innerHTML = r;
    panel.style.display = "block";
    const shareTextBtn = document.getElementById("daily-share-text"), shareImageBtn = document.getElementById("daily-share-image");
    if (shareTextBtn)
      shareTextBtn.onclick = async () => {
        shareTextBtn.disabled = true;
        const t = await ensureDailyShareContext(dailyDate, guesses);
        if (shareTextBtn.disabled = false, !t) {
          showMessage("Impossible de pr\xE9parer le partage du Daily.", "error");
          return;
        }
        handleDailyShareText(e);
      };
    if (shareImageBtn)
      shareImageBtn.onclick = async () => {
        shareImageBtn.disabled = true;
        const t = await ensureDailyShareContext(dailyDate, guesses);
        if (shareImageBtn.disabled = false, !t) {
          showMessage("Impossible de pr\xE9parer le partage du Daily.", "error");
          return;
        }
        handleDailyShareImage(e);
      };
  }
  function formatDailyDistanceForShare(e) {
    return e >= 1e3 ? `${(e / 1e3).toFixed(1)} km` : `${Math.round(e)} m`;
  }
  function getDailyShareDateLabel() {
    let e = null;
    if (dailyTargetData && "string" == typeof dailyTargetData.date) {
      const t = /* @__PURE__ */ new Date(`${dailyTargetData.date}T12:00:00`);
      Number.isNaN(t.getTime()) || (e = t);
    }
    return e || (e = /* @__PURE__ */ new Date()), new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(e);
  }
  function handleDailyShareText(e) {
    if (!dailyTargetData) return;
    const t = e.success ? e.attempts : "X", r = getDailyShareDateLabel(), a = dailyTargetData.streetName || "Rue inconnue", n = dailyGuessHistory.length > 0 ? Math.min(...dailyGuessHistory.map((e2) => e2.distance)) : null;
    let s = `\u{1F5FA}\uFE0F Camino Daily \u2014 ${r}
\u{1F4CD} Rue: ${a}
${e.success ? "\u2705" : "\u274C"} R\xE9sultat: ${t}/7

`;
    dailyGuessHistory.length > 0 ? dailyGuessHistory.forEach((t2, r2) => {
      if (e.success && r2 === dailyGuessHistory.length - 1) s += "\u{1F7E9} \u{1F3C1}\n";
      else {
        let e2 = "\u{1F7E5}";
        t2.distance < 500 ? e2 = "\u{1F7E9}" : t2.distance < 2e3 && (e2 = "\u{1F7E8}"), s += `${e2} ${t2.arrow || "\u2022"}
`;
      }
    }) : s += "Aucun essai enregistr\xE9.\n", null !== n && Number.isFinite(n) && (s += `
\u{1F3AF} Meilleure distance: ${formatDailyDistanceForShare(n)}
`), s += "Essaie de faire mieux sur camino-ajm.pages.dev";
    if (navigator.clipboard && window.isSecureContext)
      navigator.clipboard.writeText(s).then(() => {
        showMessage("Texte copi\xE9 !", "success");
      }).catch(() => showMessage("Erreur lors de la copie", "error"));
    else
      try {
        const e2 = document.createElement("textarea");
        e2.value = s, document.body.appendChild(e2), e2.select(), document.execCommand("copy"), document.body.removeChild(e2), showMessage("Texte copi\xE9 !", "success");
      } catch (e2) {
        showMessage("Impossible de copier", "error");
      }
  }
  function handleDailyShareImage(e) {
    if (!dailyTargetData) return;
    const t = document.createElement("canvas");
    t.width = 1080, t.height = 1350;
    const r = t.getContext("2d");
    if (!r) return void showMessage("Erreur lors de la g\xE9n\xE9ration", "error");
    const a = t.width, n = t.height, s = a / 2, i = e.success ? e.attempts : "X", l = dailyTargetData.streetName || "Rue inconnue", o = getDailyShareDateLabel(), u = dailyGuessHistory.length > 0 ? Math.min(...dailyGuessHistory.map((e2) => e2.distance)) : null, d = null !== u && Number.isFinite(u) ? formatDailyDistanceForShare(u) : "\u2014";
    function c(e2, t2, r2, a2, n2, s2, i2) {
      const l2 = [], o2 = String(e2).split(/\s+/);
      let u2 = "";
      o2.forEach((e3) => {
        const n3 = u2 ? `${u2} ${e3}` : e3;
        r2.measureText(n3).width <= a2 || !u2 ? u2 = n3 : (l2.push(u2), u2 = e3);
      }), u2 && l2.push(u2);
      const d2 = Math.min(l2.length, i2);
      for (let e3 = 0; e3 < d2; e3++) {
        let a3 = l2[e3];
        e3 === i2 - 1 && l2.length > i2 && (a3 += "\u2026");
        r2.fillText(a3, t2, n2 + e3 * s2);
      }
      return d2;
    }
    const m = r.createLinearGradient(0, 0, 0, n);
    m.addColorStop(0, "#f8dca5"), m.addColorStop(0.35, "#f2a900"), m.addColorStop(0.68, "#4057b2"), m.addColorStop(1, "#12297a"), r.fillStyle = m, r.fillRect(0, 0, a, n);
    const p = n * 0.47;
    r.globalAlpha = 0.3, r.fillStyle = "#fff5cc", r.beginPath(), r.arc(200, 190, 110, 0, 2 * Math.PI), r.fill(), r.globalAlpha = 1;
    const g = r.createLinearGradient(0, p, 0, n);
    g.addColorStop(0, "rgba(18,41,122,0.85)"), g.addColorStop(1, "rgba(12,29,87,0.95)"), r.fillStyle = g, r.fillRect(0, p, a, n - p), r.fillStyle = "rgba(10,23,69,0.55)", r.beginPath(), r.moveTo(0, p + 30), r.lineTo(120, p + 8), r.lineTo(220, p - 22), r.lineTo(340, p + 18), r.lineTo(470, p - 8), r.lineTo(600, p + 26), r.lineTo(760, p - 3), r.lineTo(910, p + 20), r.lineTo(1080, p + 5), r.lineTo(1080, n), r.lineTo(0, n), r.closePath(), r.fill(), r.strokeStyle = "rgba(255,255,255,0.15)", r.lineWidth = 2;
    for (let e2 = 0; e2 < 4; e2++) {
      const t2 = p + 120 + 50 * e2;
      r.beginPath(), r.moveTo(80, t2), r.bezierCurveTo(220, t2 - 18, 380, t2 + 20, 560, t2), r.bezierCurveTo(730, t2 - 20, 910, t2 + 18, 1e3, t2), r.stroke();
    }
    const h = { x: 60, y: 60, w: a - 120, h: n - 120 };
    r.fillStyle = "rgba(2, 6, 23, 0.68)", r.beginPath(), r.roundRect(h.x, h.y, h.w, h.h, 36), r.fill(), r.strokeStyle = "rgba(255,255,255,0.22)", r.lineWidth = 2.5, r.stroke(), r.textAlign = "center", r.fillStyle = "#f8fafc", r.font = '700 66px "Montserrat", "Avenir Next", "Segoe UI", sans-serif', r.fillText("CAMINO DAILY", s, 170), r.fillStyle = "rgba(226,232,240,0.95)", r.font = '500 32px "Nunito", "Avenir Next", "Segoe UI", sans-serif', r.fillText(`D\xE9fi du ${o}`, s, 220), r.fillStyle = "#fde68a", r.font = '600 32px "Nunito", "Avenir Next", "Segoe UI", sans-serif', r.fillText("Rue du jour", s, 280), r.fillStyle = "#ffffff", r.font = '700 42px "Nunito", "Avenir Next", "Segoe UI", sans-serif', c(l, s, r, 820, 338, 54, 2);
    const y = { x: s - 150, y: 410, w: 300, h: 170 };
    r.fillStyle = e.success ? "#1f9d66" : "#d2463c", r.beginPath(), r.roundRect(y.x, y.y, y.w, y.h, 28), r.fill(), r.fillStyle = "#ffffff", r.font = '700 82px "Montserrat", "Avenir Next", "Segoe UI", sans-serif', r.fillText(`${i}/7`, s, y.y + 98), r.font = '600 28px "Nunito", "Avenir Next", "Segoe UI", sans-serif', r.fillText(e.success ? "D\xE9fi r\xE9ussi" : "D\xE9fi non r\xE9solu", s, y.y + 140);
    const v = h.x + 70, f = h.w - 140, b = 74, S = 610;
    if (dailyGuessHistory.length > 0)
      dailyGuessHistory.slice(0, 7).forEach((t2, a2) => {
        const n2 = S + a2 * (b + 12), i2 = e.success && a2 === dailyGuessHistory.length - 1;
        let l2 = "#d2463c";
        i2 || t2.distance < 500 ? l2 = "#1f9d66" : t2.distance < 2e3 && (l2 = "#e08a00"), r.fillStyle = "rgba(15,23,42,0.62)", r.beginPath(), r.roundRect(v, n2, f, b, 20), r.fill(), r.strokeStyle = "rgba(148,163,184,0.25)", r.lineWidth = 1.4, r.stroke(), r.fillStyle = "#e2e8f0", r.font = '600 30px "Nunito", "Avenir Next", "Segoe UI", sans-serif', r.textAlign = "left", r.fillText(`#${a2 + 1}`, v + 24, n2 + 47), r.fillStyle = l2, r.beginPath(), r.roundRect(v + 112, n2 + 14, 42, 42, 10), r.fill(), r.fillStyle = "#f8fafc", r.font = '600 34px "Nunito", "Avenir Next", "Segoe UI", sans-serif', r.fillText(i2 ? "\u{1F3C1}" : t2.arrow || "\u2022", v + 174, n2 + 49), r.fillStyle = i2 ? "#86efac" : "#e2e8f0", r.font = '600 30px "Nunito", "Avenir Next", "Segoe UI", sans-serif', r.fillText(
          i2 ? "Trouv\xE9 !" : formatDailyDistanceForShare(t2.distance),
          v + 246,
          n2 + 48
        );
      });
    else
      r.fillStyle = "rgba(226,232,240,0.9)", r.font = '600 30px "Nunito", "Avenir Next", "Segoe UI", sans-serif', r.fillText("Aucun essai enregistr\xE9", v, S + 44);
    const L2 = { x: s + 20, y: S + 2 * (b + 12) - 6, w: h.x + h.w - 70 - (s + 20), h: 3 * (b + 12) + 12 };
    r.fillStyle = "rgba(15,23,42,0.82)", r.beginPath(), r.roundRect(L2.x, L2.y, L2.w, L2.h, 20), r.fill(), r.strokeStyle = "rgba(148,163,184,0.3)", r.lineWidth = 1.5, r.stroke();
    const Lcx = L2.x + L2.w / 2;
    r.textAlign = "center", r.fillStyle = "#f8fafc", r.font = '700 28px "Nunito", "Avenir Next", "Segoe UI", sans-serif', r.fillText(`\u{1F3AF} Meilleure`, Lcx, L2.y + 42), r.fillText(`distance : ${d}`, Lcx, L2.y + 76), r.fillStyle = "#cbd5e1", r.font = '500 22px "Nunito", "Avenir Next", "Segoe UI", sans-serif', r.fillText("Essaie de faire", Lcx, L2.y + 130), r.fillText("mieux sur", Lcx, L2.y + 158), r.fillStyle = "#93c5fd", r.font = '700 24px "Nunito", "Avenir Next", "Segoe UI", sans-serif', r.fillText("camino-ajm.pages.dev", Lcx, L2.y + 200);
    t.toBlob(async (e2) => {
      if (!e2) return void showMessage("Erreur lors de la g\xE9n\xE9ration", "error");
      const t2 = new File([e2], "camino-daily.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [t2] }))
        try {
          return await navigator.share({
            title: "Camino - D\xE9fi Quotidien",
            text: `${dailyTargetData.streetName} \u2022 ${i}/7
Essaie de faire mieux sur camino-ajm.pages.dev`,
            files: [t2]
          }), void showMessage("Partag\xE9 !", "success");
        } catch (e3) {
          if ("AbortError" === e3.name) return;
        }
      if (navigator.clipboard && "undefined" != typeof ClipboardItem)
        try {
          return await navigator.clipboard.write([new ClipboardItem({ "image/png": e2 })]), void showMessage("Image copi\xE9e dans le presse-papier !", "success");
        } catch (e3) {
        }
      const r2 = URL.createObjectURL(e2), a2 = document.createElement("a");
      a2.href = r2, a2.download = "camino-daily.png", a2.click(), URL.revokeObjectURL(r2), showMessage("Image t\xE9l\xE9charg\xE9e !", "success");
    }, "image/png");
  }
  function getDirectionArrow(e, t) {
    const r = t[0] - e[0], a = t[1] - e[1], n = (180 * Math.atan2(r, a) / Math.PI % 360 + 360) % 360;
    return ["\u2B06\uFE0F", "\u2197\uFE0F", "\u27A1\uFE0F", "\u2198\uFE0F", "\u2B07\uFE0F", "\u2199\uFE0F", "\u2B05\uFE0F", "\u2196\uFE0F"][Math.round(n / 45) % 8];
  }
  function saveDailyGuessesToStorage() {
    if (dailyTargetData && dailyTargetData.date)
      try {
        const e = getDailyGuessesStorageKey(dailyTargetData.date);
        localStorage.setItem(e, JSON.stringify(dailyGuessHistory));
        saveDailyMetaToStorage();
      } catch (e) {
      }
  }
  function saveDailyMetaToStorage() {
    if (dailyTargetData && dailyTargetData.date)
      try {
        localStorage.setItem(
          getDailyMetaStorageKey(dailyTargetData.date),
          JSON.stringify({
            date: dailyTargetData.date,
            streetName: dailyTargetData.streetName || "",
            quartier: dailyTargetData.quartier || ""
          })
        );
      } catch (e) {
      }
  }
  function restoreDailyGuessesFromStorage(e) {
    try {
      const t = getDailyGuessesStorageKey(e), r = localStorage.getItem(t);
      r && (dailyGuessHistory = JSON.parse(r));
    } catch (e2) {
      dailyGuessHistory = [];
    }
  }
  function cleanOldDailyGuessStorage(e) {
    try {
      for (let t = localStorage.length - 1; t >= 0; t--) {
        const r = localStorage.key(t);
        r && r.startsWith(DAILY_GUESSES_STORAGE_PREFIX) && !r.endsWith(e) && localStorage.removeItem(r);
        r && r.startsWith(DAILY_META_STORAGE_PREFIX) && !r.endsWith(e) && localStorage.removeItem(r);
      }
    } catch (e2) {
    }
  }
  function highlightDailyTarget(e, t) {
    if (removeDailyHighlight(), !e || !map) return;
    let r;
    try {
      r = "string" == typeof e ? JSON.parse(e) : e;
    } catch (e2) {
      return void console.error("Invalid target geometry:", e2);
    }
    const a = t ? UI_THEME.mapCorrect : UI_THEME.mapWrong;
    dailyHighlightLayer = L.geoJSON(
      { type: "Feature", geometry: r, properties: {} },
      {
        style: { color: a, weight: 6, opacity: 1, dashArray: t ? null : "8, 4" }
      }
    ).addTo(map);
    try {
      if (dailyHighlightLayer && Object.keys(dailyHighlightLayer._layers).length > 0) {
        const e2 = dailyHighlightLayer.getBounds();
        e2 && e2.isValid() && map.fitBounds(e2, {
          padding: [40, 40],
          maxZoom: 16,
          animate: true,
          duration: 1.5
        });
      }
    } catch (e2) {
      console.error("Could not fit logic bounds", e2);
    }
  }
  function removeDailyHighlight() {
    dailyHighlightLayer && map && (map.removeLayer(dailyHighlightLayer), dailyHighlightLayer = null);
  }
  function getDistanceMeters(e, t, r, a) {
    const n = e * Math.PI / 180, s = r * Math.PI / 180, i = (r - e) * Math.PI / 180, l = (a - t) * Math.PI / 180, o = Math.sin(i / 2) * Math.sin(i / 2) + Math.cos(n) * Math.cos(s) * Math.sin(l / 2) * Math.sin(l / 2);
    return 2 * Math.atan2(Math.sqrt(o), Math.sqrt(1 - o)) * 6371e3;
  }
  function pointToSegmentDistance(e, t, r, a, n, s) {
    const i = 6371e3, l = Math.cos(e * Math.PI / 180), o = t * l * i * Math.PI / 180, u = e * i * Math.PI / 180, d = r * l * i * Math.PI / 180, c = a * i * Math.PI / 180, m = n * l * i * Math.PI / 180 - d, p = s * i * Math.PI / 180 - c, g = o - d, h = u - c, y = m * m + p * p;
    let v = 0;
    0 !== y && (v = Math.max(0, Math.min(1, (g * m + h * p) / y)));
    const f = d + v * m, b = c + v * p, S = (o - f) * (o - f) + (u - b) * (u - b);
    return Math.sqrt(S);
  }
  function getDistanceToFeature(e, t, r) {
    if (!r) return 0;
    let a = 1 / 0;
    function n(r2) {
      for (let n2 = 0; n2 < r2.length - 1; n2++) {
        const [s, i] = r2[n2], [l, o] = r2[n2 + 1], u = pointToSegmentDistance(e, t, s, i, l, o);
        u < a && (a = u);
      }
    }
    return "LineString" === r.type ? n(r.coordinates) : "MultiLineString" === r.type ? r.coordinates.forEach(n) : "Point" === r.type && (a = getDistanceMeters(e, t, r.coordinates[1], r.coordinates[0])), a !== 1 / 0 ? a : 0;
  }
  function calculateStreetLength(e) {
    try {
      if (!e || !allStreetFeatures) return 0;
      const t = normalizeName(e), r = allStreetFeatures.find(
        (e2) => e2 && e2.properties && e2.properties.name && normalizeName(e2.properties.name) === t
      );
      if (!r || !r.geometry || !r.geometry.coordinates) return 0;
      let a = 0;
      const n = r.geometry;
      if ("LineString" === n.type)
        for (let e2 = 0; e2 < n.coordinates.length - 1; e2++) {
          const [t2, r2] = n.coordinates[e2], [s, i] = n.coordinates[e2 + 1];
          a += getDistanceMeters(r2, t2, i, s);
        }
      else if ("MultiLineString" === n.type)
        for (const e2 of n.coordinates)
          for (let t2 = 0; t2 < e2.length - 1; t2++) {
            const [r2, n2] = e2[t2], [s, i] = e2[t2 + 1];
            a += getDistanceMeters(n2, r2, i, s);
          }
      return a;
    } catch (e2) {
      return console.error("Error calculating street length:", e2), 0;
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
    const a = r.reduce((e2, t2) => [e2[0] + t2[0], e2[1] + t2[1]], [0, 0]);
    return [a[0] / r.length, a[1] / r.length];
  }
  function updateDailyUI() {
    const e = dailyTargetData ? dailyTargetData.userStatus : {}, t = Math.max(dailyGuessHistory.length, e.attempts_count || 0), r = 7 - t;
    if (isDailyMode) {
      const t2 = document.getElementById("target-panel-title");
      t2 && (e.success ? t2.textContent = "\u{1F389} D\xE9fi r\xE9ussi !" : t2.textContent = r <= 0 ? "\u274C D\xE9fi \xE9chou\xE9" : `\u{1F3AF} D\xE9fi quotidien \u2014 ${r} essai${r > 1 ? "s" : ""} restant${r > 1 ? "s" : ""}`);
    }
    const a = document.getElementById("daily-tries-counter");
    a && (isDailyMode ? (a.style.display = "flex", a.innerHTML = `<span>\u{1F3AF}</span> ${t} / 7 essais`) : a.style.display = "none");
  }
  function handleDailyStop() {
    triggerHaptic("click");
    return !!isDailyMode && (endDailySession(), removeDailyHighlight(), true);
  }
  function fitTargetStreetText() {
    const e = document.getElementById("target-street");
    if (!e) return;
    if (!window.matchMedia("(max-width: 600px)").matches)
      return void (e.style.fontSize = "");
    e.style.whiteSpace = "nowrap";
    const t = e.clientWidth;
    if (t <= 0) return;
    if (e.style.fontSize = "18px", e.scrollWidth <= t) return;
    let r = 11, a = 18, n = 11;
    for (; r <= a; ) {
      const s = Math.floor((r + a) / 2);
      e.style.fontSize = s + "px", e.scrollWidth <= t ? (n = s, r = s + 1) : a = s - 1;
    }
    e.style.fontSize = n + "px";
  }
  window.addEventListener("resize", () => {
    requestAnimationFrame(fitTargetStreetText);
  }), window.addEventListener("orientationchange", () => {
    requestAnimationFrame(fitTargetStreetText);
  }), "serviceWorker" in navigator && window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((e) => {
      console.log("SW registered:", e.scope);
      e.update().catch(() => {
      });
    }).catch((e) => console.warn("SW registration failed:", e));
    updateHapticsUI();
    const userPanelDetails = document.querySelector(".user-panel details");
    if (userPanelDetails) {
      userPanelDetails.addEventListener("toggle", () => {
        triggerHaptic("click");
      });
    }
  });
})();
//# sourceMappingURL=main.js.map
