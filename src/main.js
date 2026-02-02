import { ARRONDISSEMENT_PAR_QUARTIER } from './data/arrondissements.js';
import { SESSION_SIZE, MAX_ERRORS_MARATHON, MAX_TIME_SECONDS, CHRONO_DURATION, HIGHLIGHT_DURATION_MS, MAX_POINTS_PER_ITEM } from './data/constants.js';
import { MONUMENT_NAMES_NORMALIZED } from './data/monuments.js';
import { FAMOUS_STREET_NAMES, MAIN_STREET_NAMES, MAIN_STREET_INFOS } from './data/streets.js';
import { computeItemPoints } from './scoring/points.js';
import { showMessage } from './ui/messages.js';
import { setMapStatus } from './ui/status.js';
import { normalizeName, normalizeQuartierKey } from './utils/normalize.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ------------------------
// Variables globales
// ------------------------

let map = null;

// Zones
let currentZoneMode = 'ville';      // 'ville' | 'quartier' | 'rues-celebres' | 'rues-principales' | 'monuments'

// Données et couches rues
let streetsLayer = null;
let allStreetFeatures = [];
let streetLayersById = new Map();

// Données et couches monuments
let monumentsLayer = null;
let allMonuments = [];
let sessionMonuments = [];
let currentMonumentIndex = 0;
let currentMonumentTarget = null;
let isMonumentsMode = false;

// Quartiers
let quartierPolygonsByName = new Map();
let quartierOverlay = null;

// Map normalisée quartier → arrondissement (1er, 2e, etc.)
let arrondissementByQuartier = new Map();
Object.entries(ARRONDISSEMENT_PAR_QUARTIER).forEach(([label, arr]) => {
  const key = normalizeQuartierKey(label);
  arrondissementByQuartier.set(key, arr);
});

// Session en cours (rues)
let sessionStreets = [];
let currentIndex = 0;
let currentTarget = null;
let isSessionRunning = false;

// Timers + Pause + Chrono
let sessionStartTime   = null;
let streetStartTime    = null;

let isPaused           = false;
let pauseStartTime     = null;
let remainingChronoMs  = null;

let isChronoMode       = false;
let chronoEndTime      = null;

// Scores
let correctCount = 0;
let totalAnswered = 0;
let summaryData = [];
let weightedScore = 0;
let errorsCount = 0;

// Surbrillance rues
let highlightTimeoutId = null;
let highlightedLayers = [];


// Utilisateur courant (auth)
let currentUser = null;
let supabase = null;

let isLectureMode = false;

let hasAnsweredCurrentItem = false;


// ------------------------
// Détection appareil tactile / mobile
// ------------------------
const IS_TOUCH_DEVICE =
  ('ontouchstart' in window) ||
  navigator.maxTouchPoints > 0;

// ------------------------
// Helpers zone / mode
// ------------------------

function getSelectedQuartier() {
  const sel = document.getElementById('quartier-select');
  if (!sel) return null;
  const value = sel.value;
  return value && value.trim() !== '' ? value.trim() : null;
}

function getZoneMode() {
  return currentZoneMode;
}

function updateModeDifficultyPill() {
  const modeSelect = document.getElementById('mode-select');
  const pill = document.getElementById('mode-difficulty-pill');
  if (!modeSelect || !pill) return;

  const value = modeSelect.value;

  pill.classList.remove(
    'difficulty-pill--easy',
    'difficulty-pill--medium',
    'difficulty-pill--hard'
  );

  if (value === 'rues-celebres') {
    pill.textContent = 'Très facile';
    pill.classList.add('difficulty-pill--easy');
  } else if (value === 'rues-principales') {
    pill.textContent = 'Facile';
    pill.classList.add('difficulty-pill--easy');
  } else if (value === 'quartier' || value === 'monuments') {
    pill.textContent = 'Faisable';
    pill.classList.add('difficulty-pill--medium');
  } else if (value === 'ville') {
    pill.textContent = 'Difficile';
    pill.classList.add('difficulty-pill--hard');
  } else {
    // Valeur inattendue : neutralisation
    pill.textContent = '';
  }
}

function updateTargetPanelTitle() {
  const titleEl = document.getElementById('target-panel-title')
    || document.querySelector('.target-panel .panel-title');
  if (!titleEl) return;

  const zoneMode = getZoneMode();

  if (zoneMode === 'monuments') {
    titleEl.textContent = 'Monument à trouver';
  } else {
    // ville entière, par quartier, rues principales (et tout mode non-monuments)
    titleEl.textContent = 'Rue à trouver';
  }
}

function getGameMode() {
  const select = document.getElementById('game-mode-select');
  return select ? select.value : 'classique';
}

function updateGameModeControls() {
  const gameModeSelect = document.getElementById('game-mode-select');
  const restartBtn = document.getElementById('restart-btn');
  const pauseBtn = document.getElementById('pause-btn');

  if (!gameModeSelect || !restartBtn || !pauseBtn) return;

  if (gameModeSelect.value === 'lecture') {
    // Mode lecture : pas de contrôle de session
    restartBtn.style.display = 'none';
    pauseBtn.style.display = 'none';
  } else {
    // Autres modes : on les montre
    restartBtn.style.display = '';
    pauseBtn.style.display = '';
  }
}

function updateStreetInfoPanelVisibility() {
  const panel = document.getElementById('street-info-panel');
  const infoEl = document.getElementById('street-info');
  if (!panel || !infoEl) return;

  const zoneMode = getZoneMode();
  if (zoneMode === 'rues-principales' || zoneMode === 'main') {
    panel.style.display = 'block';
    // on ne met pas is-visible ici : ce sera géré par showStreetInfo
  } else {
    panel.style.display = 'none';
    panel.classList.remove('is-visible');
    infoEl.textContent = '';
    infoEl.classList.remove('is-visible');
  }
}

// ------------------------
// Initialisation
// ------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Sur mobile : petit statut "Chargement" dans le header
  setMapStatus('Chargement', 'loading');

  initMap();
  initUI();
  startTimersLoop();
  loadStreets();
  loadQuartierPolygons();
  loadMonuments();
});

// ------------------------
// Carte
// ------------------------

function initMap() {
  map = L.map('map', {
    tap: true,              // ← nécessaire pour activer les interactions tactiles
    tapTolerance: IS_TOUCH_DEVICE ? 25 : 15,       // ← meilleure sensibilité mobile
    doubleTapZoom: true     // ← zoomer au double-tap
  }).setView([43.2965, 5.37], 13);
  
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: 'Tiles © Esri'
    }
  ).addTo(map);
}

// ------------------------
// Interface
// ------------------------

function initUI() {
  // Mode "doigt" pour mobile / tactile
  if (IS_TOUCH_DEVICE) {
    document.body.classList.add('touch-mode');
  }
  const restartBtn       = document.getElementById('restart-btn');
  const modeSelect       = document.getElementById('mode-select');
  const quartierBlock    = document.getElementById('quartier-block');
  const quartierSelect   = document.getElementById('quartier-select');
  const skipBtn          = document.getElementById('skip-btn');
  const pauseBtn         = document.getElementById('pause-btn');
    // Faux select "quartier"
  const quartierBtn   = document.getElementById('quartier-select-button');
  const quartierList  = document.getElementById('quartier-select-list');
  const quartierLabel = quartierBtn
    ? quartierBtn.querySelector('.custom-select-label')
    : null;

  const loginBtn         = document.getElementById('login-btn');
  const registerBtn      = document.getElementById('register-btn');
  const logoutBtn        = document.getElementById('logout-btn');
  const emailInput       = document.getElementById('auth-email');
  const usernameInput    = document.getElementById('auth-username');
  const passwordInput    = document.getElementById('auth-password');

  if (modeSelect) {
    currentZoneMode = modeSelect.value;
  }
  updateModeDifficultyPill();

  // ----- Nouveau select personnalisé "zone de jeu" -----
const modeBtn = document.getElementById("mode-select-button");
const modeList = document.getElementById("mode-select-list");
const modeLabel = modeBtn.querySelector(".custom-select-label");

modeBtn.addEventListener("click", () => {
  modeList.classList.toggle("visible");
});

modeList.querySelectorAll("li").forEach(item => {
  item.addEventListener("click", () => {
    const value = item.dataset.value;

    // Mise à jour du label
    modeLabel.textContent = item.childNodes[0].textContent.trim();

    // Mise à jour pastille
    const pill = item.querySelector(".difficulty-pill").cloneNode(true);
    modeBtn.querySelector(".difficulty-pill").replaceWith(pill);

    // Mise à jour interne
    const fakeSelect = document.getElementById("mode-select");
    if (fakeSelect) {
      fakeSelect.value = value;

      // Correction essentielle :
      // déclenchement manuel du "change"
      fakeSelect.dispatchEvent(new Event("change"));
    }

    modeList.classList.remove("visible");
  });
});

  // ----- Select personnalisé "type de partie" -----
  const gameModeBtn   = document.getElementById("game-mode-select-button");
  const gameModeList  = document.getElementById("game-mode-select-list");
  const gameModeLabel = gameModeBtn
    ? gameModeBtn.querySelector(".custom-select-label")
    : null;
  const gameModeSelect = document.getElementById("game-mode-select");

  if (gameModeBtn && gameModeList && gameModeLabel && gameModeSelect) {
    gameModeBtn.addEventListener("click", () => {
      gameModeList.classList.toggle("visible");
    });

    gameModeList.querySelectorAll("li").forEach(item => {
      item.addEventListener("click", () => {
        const value = item.dataset.value;

        // Mise à jour du label (Classique / Marathon / Chrono / Lecture)
        gameModeLabel.textContent = item.childNodes[0].textContent.trim();

        // Mise à jour de la pastille (20 rues / 3 erreurs max / 1 minute / Apprentissage)
        const pillInList = item.querySelector(".difficulty-pill");
        if (pillInList) {
          const newPill = pillInList.cloneNode(true);
          const btnPill = gameModeBtn.querySelector(".difficulty-pill");
          if (btnPill) {
            btnPill.replaceWith(newPill);
          } else {
            gameModeBtn.appendChild(newPill);
          }
        }

        // Mise à jour du <select> caché (utilisé par getGameMode())
        gameModeSelect.value = value;

        // Si une session est en cours et qu'on change de mode, on la termine proprement
        if (isSessionRunning) {
          endSession();
        }

        // Met à jour la visibilité des boutons selon le mode
        updateGameModeControls();

        // Toujours : rembobiner la liste + fermer
        gameModeList.scrollTop = 0;           // <<< AJOUT
        gameModeList.classList.remove("visible");

        // Lecture : lancer APRÈS fermeture/layout stable
        if (value === 'lecture') {
          requestAnimationFrame(() => startNewSession());   // <<< MODIF MINIMALE
        }
      });
    });
  }

  // ----- Select personnalisé "quartier" (sans pastille) -----
  if (quartierBtn && quartierList && quartierLabel && quartierSelect) {
    // Ouverture / fermeture de la liste
    quartierBtn.addEventListener('click', () => {
      quartierList.classList.toggle('visible');
    });

    // Le contenu de la liste (les <li>) sera créé dans populateQuartiers()
    // On gérera là-bas les clics sur <li> pour mettre à jour le label et le <select> caché.
  }
  
// Ferme la liste déroulante si clic ailleurs
document.addEventListener("click", (e) => {
  // Zone de jeu
  if (modeBtn && modeList &&
      !modeBtn.contains(e.target) &&
      !modeList.contains(e.target)) {
    modeList.classList.remove("visible");
  }

  // Type de partie
  if (gameModeBtn && gameModeList &&
      !gameModeBtn.contains(e.target) &&
      !gameModeList.contains(e.target)) {
    gameModeList.classList.remove("visible");
  }

  // Quartier
  if (quartierBtn && quartierList &&
      !quartierBtn.contains(e.target) &&
      !quartierList.contains(e.target)) {
    quartierList.classList.remove("visible");
  }
});

  // Recharger l'utilisateur courant depuis le stockage local
  currentUser = loadCurrentUserFromStorage();
  updateUserUI();
  supabase = initSupabaseClient();
  if (supabase) {
    syncSupabaseSession();
  }

  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      if (!isSessionRunning) {
        startNewSession();
      } else {
        stopSessionManually();
      }
    });
  }

  updateTargetPanelTitle();

  // Bouton Pause
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (!isSessionRunning) return;
      togglePause();
    });
  }

  // Bouton "Passer" (tous les modes)
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      if (!isSessionRunning || isPaused) return;

      const zoneMode = getZoneMode();

      if (zoneMode === 'monuments') {
        if (!currentMonumentTarget) return;
        summaryData.push({
          name: currentMonumentTarget.properties.name,
          correct: false,
          time: 0
        });
        totalAnswered += 1;
        updateScoreUI();
        currentMonumentIndex += 1;
        setNewTarget();
        return;
      }

      if (!currentTarget) return;
      summaryData.push({
        name: currentTarget.properties.name,
        correct: false,
        time: 0
      });
      totalAnswered += 1;
      updateScoreUI();
      currentIndex += 1;
      setNewTarget();
    });
  }

  // Changement de zone
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      currentZoneMode = modeSelect.value;
      const zoneMode = currentZoneMode;
      updateTargetPanelTitle();
      updateModeDifficultyPill();

      // Restyle toutes les rues en fonction du nouveau mode
      if (streetsLayer && streetLayersById.size) {
        streetLayersById.forEach(layer => {
          const base = getBaseStreetStyle(layer);
          layer.setStyle({
            color: base.color,
            weight: base.weight
          });
          // on laisse les handlers décider si le clic est pertinent (voir handleStreetClick)
          layer.options.interactive = true;
        });
      }

      // Quartier UI
      if (zoneMode === 'quartier') {
        quartierBlock.style.display = 'block';
        if (quartierSelect && quartierSelect.value) {
          highlightQuartier(quartierSelect.value);
        }
      } else {
        quartierBlock.style.display = 'none';
        clearQuartierOverlay();
      }

      // Couches
      if (zoneMode === 'monuments') {
        if (streetsLayer && map.hasLayer(streetsLayer)) {
          map.removeLayer(streetsLayer);
        }
        if (monumentsLayer && !map.hasLayer(monumentsLayer)) {
          monumentsLayer.addTo(map);
        }
      } else {
        if (monumentsLayer && map.hasLayer(monumentsLayer)) {
          map.removeLayer(monumentsLayer);
        }
        if (streetsLayer && !map.hasLayer(streetsLayer)) {
          streetsLayer.addTo(map);
        }
      }
      updateStreetInfoPanelVisibility();
      refreshLectureTooltipsIfNeeded();

      // >>> ICI : gestion de la boîte "infos rues principales"
      const infoEl = document.getElementById('street-info');
      if (infoEl) {
        if (zoneMode === 'rues-principales' || zoneMode === 'main') {
          // On peut garder le contenu, ou le vider pour repartir propre :
          // infoEl.textContent = '';
          // infoEl.style.display = 'none'; // elle ne se ré-affichera que sur clic via showStreetInfo
        } else {
          infoEl.textContent = '';
          infoEl.style.display = 'none';
        }
      }
    });
  }
  if (quartierSelect) {
    quartierSelect.addEventListener('change', () => {
      const zoneMode = getZoneMode();
      if (zoneMode === 'quartier' && quartierSelect.value) {
        highlightQuartier(quartierSelect.value);
      } else {
        clearQuartierOverlay();
      }

      // IMPORTANT : on applique le nouveau filtre de style à toutes les rues
      if (streetsLayer && streetLayersById.size) {
        streetLayersById.forEach(layer => {
          const base = getBaseStreetStyle(layer);
          layer.setStyle({
            color: base.color,
            weight: base.weight
          });
        });
      }
    });
  }

  // Auth events
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      if (!supabase) {
        showMessage('Auth non configurée. Vérifiez les variables Supabase.', 'error');
        return;
      }
      const email = (emailInput?.value || '').trim();
      const password = passwordInput?.value || '';
      if (!email || !password) {
        showMessage('Email et mot de passe requis.', 'error');
        return;
      }
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        const profile = await fetchUserProfile(data.user?.id);
        currentUser = buildCurrentUser(data.user, profile?.username, data.session);
        saveCurrentUserToStorage(currentUser);
        updateUserUI();
        showMessage('Connexion réussie.', 'success');
      } catch (err) {
        console.error('Erreur login :', err);
        if (supabase) {
          await supabase.auth.signOut();
        }
        showMessage('Erreur de connexion.', 'error');
      }
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      if (!supabase) {
        showMessage('Auth non configurée. Vérifiez les variables Supabase.', 'error');
        return;
      }
      const email = (emailInput?.value || '').trim();
      const username = (usernameInput?.value || '').trim();
      const password = passwordInput?.value || '';
      if (!email || !username || !password) {
        showMessage('Email, pseudo et mot de passe requis.', 'error');
        return;
      }
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;

        const userId = data.user?.id;
        if (!userId) {
          showMessage('Compte créé. Vérifiez votre email pour confirmer.', 'info');
          return;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ id: userId, username });

        if (profileError) {
          if (isUniqueViolation(profileError)) {
            showMessage('Ce pseudo est déjà utilisé. Choisissez-en un autre.', 'error');
            await deleteAuthUser(userId);
          } else {
            showMessage('Erreur lors de la création du profil.', 'error');
          }
          await supabase.auth.signOut();
          return;
        }

        if (!data.session) {
          showMessage('Compte créé. Vérifiez votre email pour vous connecter.', 'info');
          return;
        }

        currentUser = buildCurrentUser(data.user, username, data.session);
        saveCurrentUserToStorage(currentUser);
        updateUserUI();
        showMessage('Compte créé et connecté.', 'success');
      } catch (err) {
        console.error('Erreur register :', err);
        showMessage('Erreur lors de la création du compte.', 'error');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        if (supabase) {
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.error('Erreur logout :', err);
      } finally {
        currentUser = null;
        clearCurrentUserFromStorage();
        updateUserUI();
        showMessage('Déconnecté.', 'info');
      }
    });
  }

  const targetStreetEl = document.getElementById('target-street');
  if (targetStreetEl) {
    targetStreetEl.textContent = '—';
  }

  updateScoreUI();
  updateTimeUI(0, 0);
  updateWeightedScoreUI();
  updateStartStopButton();
  updatePauseButton();
  updateStreetInfoPanelVisibility();
  updateLayoutSessionState();
  updateGameModeControls();
  ensureLectureBackButton();

  // Si le mode est déjà "lecture" au chargement, on lance directement ce mode
  if (getGameMode() === 'lecture') {
    startNewSession();
  } else {
    showMessage(
      'Cliquez sur "Commencer la session" une fois que la carte est chargée.',
      'info'
    );
  }
  const summaryEl = document.getElementById('summary');
  if (summaryEl) {
    summaryEl.classList.add('hidden');
  }

  if (skipBtn) {
    skipBtn.style.display = 'inline-block';
  }
}

const infoEl = document.getElementById('street-info');
if (infoEl) {
  infoEl.textContent = '';
}

// ------------------------
// Tooltip "Score pondéré" (survol du ?)
// ------------------------
(function initWeightedScoreTooltip() {
  const btn  = document.getElementById('weighted-score-help-btn');
  const tip  = document.getElementById('weighted-score-help');
  if (!btn || !tip) return;

  // Accessibilité
  if (!tip.id) tip.id = 'weighted-score-help';
  btn.setAttribute('aria-controls', tip.id);
  btn.setAttribute('aria-expanded', 'false');

  const open = () => {
    tip.classList.remove('hidden');      // au cas où
    tip.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    tip.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  };

  const toggle = () => {
    if (tip.classList.contains('is-open')) close();
    else open();
  };

  // Desktop : hover
  btn.addEventListener('mouseenter', open);
  btn.addEventListener('mouseleave', close);
  tip.addEventListener('mouseenter', open);
  tip.addEventListener('mouseleave', close);

  // Clavier : focus
  btn.addEventListener('focus', open);
  btn.addEventListener('blur', close);

  // Mobile/touch : click toggle
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    toggle();
  });

  // Fermer si clic ailleurs (utile sur mobile)
  document.addEventListener('click', (e) => {
    if (btn.contains(e.target) || tip.contains(e.target)) return;
    close();
  }, true);

  // Fermer avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();

// ------------------------
// Boucle d'animation pour les chronos
// ------------------------

function startTimersLoop() {
  function loop() {
    if (sessionStartTime !== null &&
    streetStartTime !== null &&
    isSessionRunning &&
    !isPaused &&
    (currentTarget || currentMonumentTarget)) {

  const now = performance.now();
  const totalTimeSec  = (now - sessionStartTime) / 1000;
  const streetTimeSec = (now - streetStartTime) / 1000;

  if (totalTimeSec >= MAX_TIME_SECONDS || streetTimeSec >= MAX_TIME_SECONDS) {
    endSession();
    requestAnimationFrame(loop);
    return;
  }

  if (isChronoMode && chronoEndTime !== null && now >= chronoEndTime) {
    endSession();
    requestAnimationFrame(loop);
    return;
  }

  updateTimeUI(totalTimeSec, streetTimeSec);

  // === NOUVEAU : mise à jour dynamique de la barre tant qu'on n'a pas répondu ===
  if (!hasAnsweredCurrentItem) {
    const remainingPoints = computeItemPoints(streetTimeSec); // max(0, 10 - t)
    const ratio = remainingPoints / MAX_POINTS_PER_ITEM;      // 0 → 1
    updateWeightedBar(ratio);
  }
}

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ------------------------
// Chargement des rues
// ------------------------

function getBaseStreetStyleFromName(name) {
  const zoneMode = getZoneMode();
  const nameNorm = normalizeName(name || '');

  let color = '#ffd500';
  let weight = 5;

  if (zoneMode === 'rues-principales' || zoneMode === 'main') {
    if (!MAIN_STREET_NAMES.has(nameNorm)) {
      color = '#00000000';
      weight = 0;
    }
  }

  if (zoneMode === 'rues-celebres') {
    if (!FAMOUS_STREET_NAMES.has(nameNorm)) {
      color = '#00000000';
      weight = 0;
    }
  }

  return { color, weight };
}

function getBaseStreetStyle(featureOrLayer) {
  const feature = featureOrLayer.feature || featureOrLayer;
  const name = feature?.properties?.name || '';

  // Style de base selon le mode (ville / rues principales)
  let base = getBaseStreetStyleFromName(name);

  const zoneMode = getZoneMode();
  const selectedQuartier = getSelectedQuartier();
  const featureQuartier = feature?.properties?.quartier || null;

  // → En mode "quartier" : on masque toutes les rues hors quartier sélectionné
  if (zoneMode === 'quartier' && selectedQuartier) {
    if (featureQuartier !== selectedQuartier) {
      base = {
        color: '#00000000', // totalement transparent
        weight: 0
      };
    }
  }

  return base;
}

function addTouchBufferForLayer(baseLayer) {
  if (!IS_TOUCH_DEVICE || !map) return;

  const latlngs = baseLayer.getLatLngs();
  if (!latlngs || latlngs.length === 0) return;

  const buffer = L.polyline(latlngs, {
    color: '#000000',
    weight: 30,        // Épaisseur cliquable (virtuellement large)
    opacity: 0.0,      // Invisible
    interactive: true  // Capte les clics / taps
  });

  // Redirige le clic du buffer vers la vraie couche
  buffer.on('click', (e) => {
    // on évite que le clic remonte
    if (L && L.DomEvent && L.DomEvent.stop) {
      L.DomEvent.stop(e);
    }
    baseLayer.fire('click');
  });

  // Préserve les survols même si on est détecté comme tactile (fenêtre réduite, laptops hybrides)
  buffer.on('mouseover', () => baseLayer.fire('mouseover'));
  buffer.on('mouseout', () => baseLayer.fire('mouseout'));

  buffer.addTo(map);
}

function loadStreets() {
  fetch('data/marseille_rues_enrichi.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error('Erreur HTTP ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      const features = (data.features || []).filter(f =>
        f.properties &&
        typeof f.properties.name === 'string' &&
        f.properties.name.trim() !== ''
      );

      features.forEach(f => {
        f.properties.name = f.properties.name.trim();
      });

      allStreetFeatures = features;
      console.log('Nombre de rues chargées :', allStreetFeatures.length);

      streetLayersById.clear();
      let idCounter = 0;

      streetsLayer = L.geoJSON(allStreetFeatures, {
        // PLUS DE FILTER : toutes les rues sont chargées, le style gère la visibilité
        style: function (feature) {
          return getBaseStreetStyle(feature);
        },

        onEachFeature: (feature, layer) => {
          const nameNorm = normalizeName(feature.properties.name);

          feature._gameId = idCounter++;
          streetLayersById.set(feature._gameId, layer);
          layer.feature = feature;
          
          // Buffer tactile élargi pour les appareils tactiles
          addTouchBufferForLayer(layer);

          layer.on('mouseover', () => {
            const zoneMode = getZoneMode();
            const isMain = MAIN_STREET_NAMES.has(nameNorm);
            const isFamous = FAMOUS_STREET_NAMES.has(nameNorm);
            const selectedQuartier = getSelectedQuartier();
            const fq = feature.properties.quartier || null;

            // Rues secondaires ignorées en mode "rues principales"
            if ((zoneMode === 'rues-principales' || zoneMode === 'main') && !isMain) {
              return;
            }
            if (zoneMode === 'rues-celebres' && !isFamous) {
              return;
            }

            // Rues hors quartier ignorées en mode "quartier"
            if (zoneMode === 'quartier' && selectedQuartier && fq !== selectedQuartier) {
              return;
            }

            streetLayersById.forEach(l => {
              const n = normalizeName(l.feature.properties.name);
              if (n === nameNorm) {
                l.setStyle({
                  weight: 7,
                  color: '#ffffff'
                });
              }
            });
          });

          layer.on('mouseout', () => {
            const zoneMode = getZoneMode();
            const isMain = MAIN_STREET_NAMES.has(nameNorm);
            const isFamous = FAMOUS_STREET_NAMES.has(nameNorm);
            const selectedQuartier = getSelectedQuartier();
            const fq = feature.properties.quartier || null;

            if ((zoneMode === 'rues-principales' || zoneMode === 'main') && !isMain) {
              return;
            }
            if (zoneMode === 'rues-celebres' && !isFamous) {
              return;
            }
            if (zoneMode === 'quartier' && selectedQuartier && fq !== selectedQuartier) {
              return;
            }

            streetLayersById.forEach(l => {
              const n = normalizeName(l.feature.properties.name);
              if (n !== nameNorm) return;

              if (highlightedLayers && highlightedLayers.includes(l)) {
                return;
              }

              const base = getBaseStreetStyle(l);
              l.setStyle({
                weight: base.weight,
                color: base.color
              });
            });
          });

          layer.on('click', () => handleStreetClick(feature));
        }
      }).addTo(map);
      refreshLectureTooltipsIfNeeded();
      populateQuartiers();

      // Force l’application du mode courant une fois les rues effectivement chargées
      const modeSelect = document.getElementById('mode-select');
      if (modeSelect) {
        modeSelect.dispatchEvent(new Event('change'));
      }

      // Petit test mobile
      const isMobile = window.innerWidth <= 900;

      // Version longue uniquement sur desktop/tablette large
      if (!isMobile) {
        showMessage(
          'Carte chargée. Choisissez la zone, le type de partie, puis cliquez sur "Commencer la session".',
          'info'
        );
      }

      // Statut header (texte très court)
      setMapStatus('Carte OK', 'ready');

      // L'appli est prête : on peut appliquer les règles CSS "app-ready"
      document.body.classList.add('app-ready');
    })
    .catch(err => {
      console.error('Erreur lors du chargement des rues :', err);
      showMessage('Erreur de chargement des rues (voir console).', 'error');
      setMapStatus('Erreur', 'error');
    });
}

// ------------------------
// Chargement des monuments
// ------------------------

function loadMonuments() {
  fetch('data/marseille_monuments.geojson')
    .then(response => {
      if (!response.ok) {
        console.warn('Impossible de charger les monuments (HTTP ' + response.status + ').');
        return null;
      }
      return response.json();
    })
    .then(data => {
      if (!data) return;
      const features = (data.features || []).filter(f =>
        f.geometry &&
        f.geometry.type === 'Point' &&
        f.properties &&
        typeof f.properties.name === 'string' &&
        f.properties.name.trim() !== ''
      );

      features.forEach(f => {
        f.properties.name = f.properties.name.trim();
      });

      allMonuments = features;
      console.log('Nombre de monuments chargés :', allMonuments.length);

      if (monumentsLayer) {
        map.removeLayer(monumentsLayer);
        monumentsLayer = null;
      }

      monumentsLayer = L.geoJSON(
  { type: 'FeatureCollection', features: allMonuments },
  {
    pointToLayer: (feature, latlng) => {
      const marker = L.circleMarker(latlng, {
        radius: IS_TOUCH_DEVICE ? 11 : 7,
        color: '#1565c0',
        weight: 2,
        fillColor: '#2196f3',
        fillOpacity: 0.9
      });
      return marker;
    },
    onEachFeature: (feature, layer) => {
      layer.on('click', () => handleMonumentClick(feature, layer));
    }
  }
);
    refreshLectureTooltipsIfNeeded();
      // Si la zone active est déjà "monuments", on montre directement la couche
      if (getZoneMode() === 'monuments') {
        if (streetsLayer && map.hasLayer(streetsLayer)) {
          map.removeLayer(streetsLayer);
        }
        if (!map.hasLayer(monumentsLayer)) {
          monumentsLayer.addTo(map);
        }
      }
    })
    .catch(err => {
      console.error('Erreur lors du chargement des monuments :', err);
    });
}

// ------------------------
// Tooltips du mode lecture
// ------------------------

function setLectureTooltipsEnabled(enabled) {
  // helper: attache/retire le comportement "tap => tooltip"
  function attachTapTooltip(layer) {
    if (!IS_TOUCH_DEVICE) return;

    // éviter les doublons
    if (layer.__lectureTapTooltipBound) return;
    layer.__lectureTapTooltipBound = true;

    layer.on('click', layer.__lectureTapTooltipFn = () => {
      // ouvre le tooltip du layer tapé
      if (layer.getTooltip()) layer.openTooltip();

      // option: fermer les autres tooltips pour éviter l’empilement
      if (streetsLayer) {
        streetsLayer.eachLayer(l => {
          if (l !== layer && l.getTooltip && l.getTooltip()) l.closeTooltip();
        });
      }
      if (monumentsLayer) {
        monumentsLayer.eachLayer(l => {
          if (l !== layer && l.getTooltip && l.getTooltip()) l.closeTooltip();
        });
      }
    });
  }

  function detachTapTooltip(layer) {
    if (!layer.__lectureTapTooltipBound) return;
    if (layer.__lectureTapTooltipFn) {
      layer.off('click', layer.__lectureTapTooltipFn);
    }
    layer.__lectureTapTooltipBound = false;
    layer.__lectureTapTooltipFn = null;
  }

  // RUES
  if (streetsLayer) {
    streetsLayer.eachLayer(layer => {
      const name = layer.feature?.properties?.name || '';
      if (!name) return;

      if (enabled) {
        if (!layer.getTooltip()) {
          layer.bindTooltip(name, {
            direction: 'top',
            sticky: !IS_TOUCH_DEVICE,  // hover desktop
            opacity: 0.9,
            className: 'street-tooltip'
          });
        }
        attachTapTooltip(layer);
      } else {
        detachTapTooltip(layer);
        if (layer.getTooltip()) {
          layer.closeTooltip();
          layer.unbindTooltip();
        }
      }
    });
  }

  // MONUMENTS
  if (monumentsLayer) {
    monumentsLayer.eachLayer(layer => {
      const name = layer.feature?.properties?.name || '';
      if (!name) return;

      if (enabled) {
        if (!layer.getTooltip()) {
          layer.bindTooltip(name, {
            direction: 'top',
            sticky: !IS_TOUCH_DEVICE,
            opacity: 0.9,
            className: 'monument-tooltip'
          });
        }
        attachTapTooltip(layer);
      } else {
        detachTapTooltip(layer);
        if (layer.getTooltip()) {
          layer.closeTooltip();
          layer.unbindTooltip();
        }
      }
    });
  }
}

function refreshLectureTooltipsIfNeeded() {
  const gm = getGameMode();
  if (gm === 'lecture' || isLectureMode === true) {
    setLectureTooltipsEnabled(true);
  }
}

// ------------------------
// Chargement des quartiers
// ------------------------

function loadQuartierPolygons() {
  fetch('data/marseille_quartiers_111.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error('Erreur HTTP ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      const features = data.features || [];
      quartierPolygonsByName.clear();

      features.forEach(f => {
        const props = f.properties || {};
        const name = typeof props.nom_qua === 'string' ? props.nom_qua.trim() : '';
        if (name) {
          quartierPolygonsByName.set(name, f);
        }
      });

      console.log('Quartiers chargés :', quartierPolygonsByName.size);
      console.log('Noms de quartiers (polygones):');
      console.log(Array.from(quartierPolygonsByName.keys()).sort());
    })
    .catch(err => {
      console.error('Erreur lors du chargement des quartiers :', err);
    });
}

// ------------------------
// Gestion visuelle du quartier
// ------------------------

function highlightQuartier(quartierName) {
  clearQuartierOverlay();
  if (!quartierName) return;

  const feature = quartierPolygonsByName.get(quartierName);
  if (!feature) {
    console.warn('Aucun polygone trouvé pour le quartier :', quartierName);
    return;
  }

  quartierOverlay = L.geoJSON(feature, {
    style: {
      color: '#0077ff',
      weight: 2,
      fill: false
    },
    interactive: false
  }).addTo(map);

  const bounds = quartierOverlay.getBounds();
  if (bounds && bounds.isValid && bounds.isValid()) {
    const isMobile = window.innerWidth <= 900;

    const fitOptions = isMobile
      ? { padding: [40, 40], maxZoom: 14 } // ← limite le zoom en mode quartier sur mobile
      : { padding: [40, 40] };             // ← desktop : comportement inchangé

    map.fitBounds(bounds, fitOptions);
  }
}

function clearQuartierOverlay() {
  if (quartierOverlay) {
    map.removeLayer(quartierOverlay);
    quartierOverlay = null;
  }
}

// ------------------------
// Liste des quartiers (UI)
// ------------------------

function populateQuartiers() {
  const quartierSelect = document.getElementById('quartier-select');
  const quartierList   = document.getElementById('quartier-select-list');
  const quartierBtn    = document.getElementById('quartier-select-button');

  if (!quartierSelect) return;

  const setQuartiers = new Set();

  allStreetFeatures.forEach(f => {
    const props = f.properties || {};
    const q = props.quartier;
    if (typeof q === 'string' && q.trim() !== '') {
      setQuartiers.add(q.trim());
    }
  });

  const quartiers = Array.from(setQuartiers).sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  );

  // Remplir le <select> caché
  quartierSelect.innerHTML = '';
  quartiers.forEach(q => {
    const opt = document.createElement('option');
    opt.value = q;
    opt.textContent = q;
    quartierSelect.appendChild(opt);
  });

  // Remplir la liste du faux select avec pastille
  if (quartierList) {
    quartierList.innerHTML = '';

    quartiers.forEach(q => {
      const li = document.createElement('li');
      li.dataset.value = q;

      // Nom du quartier
      const nameSpan = document.createElement('span');
      nameSpan.textContent = q;
      li.appendChild(nameSpan);

      // Pastille arrondissement (si dispo)
      const arrLabel = arrondissementByQuartier.get(normalizeQuartierKey(q));
      if (arrLabel) {
        const pill = document.createElement('span');
        pill.className = 'difficulty-pill difficulty-pill--arrondissement';
        pill.textContent = arrLabel;
        li.appendChild(pill);
      }

      li.addEventListener('click', () => {
        // Met à jour le label du bouton
        const labelSpan = quartierBtn
          ? quartierBtn.querySelector('.custom-select-label')
          : null;
        if (labelSpan) {
          labelSpan.textContent = q;
        }

        // Met à jour la pastille sur le bouton
        const liPill  = li.querySelector('.difficulty-pill');
        if (quartierBtn) {
          const btnPill = quartierBtn.querySelector('.difficulty-pill');
          if (liPill) {
            const newPill = liPill.cloneNode(true);
            if (btnPill) {
              btnPill.replaceWith(newPill);
            } else {
              quartierBtn.appendChild(newPill);
            }
          } else if (btnPill) {
            // Aucun arrondissement connu pour ce quartier → on enlève la pastille
            btnPill.remove();
          }
        }

        // Met à jour le <select> caché
        quartierSelect.value = q;
        // Déclenche le "change"
        quartierSelect.dispatchEvent(new Event('change'));

        // Ferme le menu
        quartierList.classList.remove('visible');
      });

      quartierList.appendChild(li);
    });

    // Label + pastille par défaut (premier quartier, si dispo)
    if (quartiers.length > 0 && quartierBtn) {
      const q0 = quartiers[0];
      const labelSpan = quartierBtn.querySelector('.custom-select-label');

      if (labelSpan) {
        labelSpan.textContent = q0;
      }

      const arrLabel0 = arrondissementByQuartier.get(normalizeQuartierKey(q0));
      if (arrLabel0) {
        const existingPill = quartierBtn.querySelector('.difficulty-pill');
        const newPill = document.createElement('span');
        newPill.className = 'difficulty-pill difficulty-pill--arrondissement';
        newPill.textContent = arrLabel0;

        if (existingPill) {
          existingPill.replaceWith(newPill);
        } else {
          quartierBtn.appendChild(newPill);
        }
      }

      quartierSelect.value = q0;
      // Pas de dispatch ici : tu gardes ton comportement actuel
    }
  }
}

// ------------------------
// Gestion de session
// ------------------------

function scrollSidebarToTargetPanel() {
  // Seulement sur mobile
  if (window.innerWidth >= 900) return;

  const sidebar = document.getElementById('sidebar');
  const targetPanel = document.querySelector('.target-panel');
  if (!sidebar || !targetPanel) return;

  // On attend que le DOM et la transition CSS (layout mobile) se stabilisent
  setTimeout(() => {
    const panelTop = targetPanel.offsetTop;
    const panelHeight = targetPanel.offsetHeight;
    const sidebarHeight = sidebar.clientHeight;

    const scrollTarget = panelTop - (sidebarHeight / 2) + (panelHeight / 2);

    sidebar.scrollTo({
      top: scrollTarget,
      behavior: 'smooth'
    });
  }, 350); // délai idéal : permet au layout mobile d'appliquer min-height/max-height
}

function ensureLectureBackButton() {
  // Ne pas dupliquer le bouton
  if (document.getElementById('lecture-back-btn')) return;
  const targetPanel = document.querySelector('.target-panel');

  if (!targetPanel) return;

  const btn = document.createElement('button');
  btn.id = 'lecture-back-btn';
  btn.type = 'button';
  btn.className = 'btn btn-secondary lecture-back-btn';
  btn.textContent = 'Retour au menu';

  // Juste après le panneau "Rue à trouver"
  targetPanel.insertAdjacentElement('afterend', btn);

  // Action : sortir du mode lecture et revenir au menu
  btn.addEventListener('click', exitLectureModeToMenu);

  // Par défaut, caché (géré ensuite dans updateLayoutSessionState)
  btn.style.display = 'none';
}

function exitLectureModeToMenu() {
  // Désactivation du mode lecture
  isLectureMode = false;
  setLectureTooltipsEnabled(false);

  // Aucune session en cours
  isSessionRunning      = false;
  isChronoMode          = false;
  chronoEndTime         = null;
  sessionStartTime      = null;
  streetStartTime       = null;
  isPaused              = false;
  pauseStartTime        = null;
  remainingChronoMs     = null;

  // Remet le mode de jeu sur "classique" côté logique
  const gameModeSelect = document.getElementById('game-mode-select');
  if (gameModeSelect) {
    gameModeSelect.value = 'classique';
  }

  // Met à jour le sélecteur custom "Type de partie"
  const gameModeBtn  = document.getElementById('game-mode-select-button');
  const gameModeList = document.getElementById('game-mode-select-list');

  if (gameModeBtn) {
    const label = gameModeBtn.querySelector('.custom-select-label');
    if (label) {
      if (gameModeList) {
        const item = gameModeList.querySelector('li[data-value="classique"]');
        if (item) {
          const textNode = item.childNodes[0];
          label.textContent = textNode && textNode.textContent
            ? textNode.textContent.trim()
            : 'Classique';

          const pillInList = item.querySelector('.difficulty-pill');
          if (pillInList) {
            const newPill = pillInList.cloneNode(true);
            const btnPill = gameModeBtn.querySelector('.difficulty-pill');
            if (btnPill) {
              btnPill.replaceWith(newPill);
            } else {
              gameModeBtn.appendChild(newPill);
            }
          }
        } else {
          label.textContent = 'Classique';
        }
      } else {
        label.textContent = 'Classique';
      }
    }
  }

  // Réinitialise les infos de cible / temps
  const targetStreetEl = document.getElementById('target-street');
  if (targetStreetEl) {
    targetStreetEl.textContent = '—';
  }
  updateTimeUI(0, 0);

  updateStartStopButton();
  updatePauseButton();
  updateGameModeControls();
  updateLayoutSessionState();

  showMessage('Retour au menu.', 'info');
}

function startNewSession() {
  const quartierSelect = document.getElementById('quartier-select');
  const zoneMode = getZoneMode();
  const gameMode = getGameMode();
  const infoEl = document.getElementById('street-info');
  if (infoEl) {
    if (zoneMode === 'rues-principales' || zoneMode === 'main') {
      // On repart propre : masqué tant qu’aucune rue principale n’a été cliquée
      infoEl.textContent = '';
      infoEl.style.display = 'none';
    } else {
      infoEl.textContent = '';
      infoEl.style.display = 'none';
    }
  }
  
  clearHighlight();

  // Reset états communs
  correctCount   = 0;
  totalAnswered  = 0;
  summaryData    = [];
  weightedScore  = 0;
  errorsCount    = 0;

  isPaused          = false;
  pauseStartTime    = null;
  remainingChronoMs = null;

  updateScoreUI();
  updateTimeUI(0, 0);
  updateWeightedScoreUI();
  const summaryEl = document.getElementById('summary');
  if (summaryEl) {
    summaryEl.classList.add('hidden');
  }

  isChronoMode = (gameMode === 'chrono');
  if (isChronoMode) {
    chronoEndTime = performance.now() + CHRONO_DURATION * 1000;
  } else {
    chronoEndTime = null;
  }
  // Par défaut, on coupe les tooltips (sauf si mode lecture plus bas)
  setLectureTooltipsEnabled(false);

  // --------- MODE LECTURE (aucun chrono, aucune cible, seulement survol) ---------
  if (gameMode === 'lecture') {
    isLectureMode = true;
    isSessionRunning      = false;
    isChronoMode          = false;
    chronoEndTime         = null;
    sessionStartTime      = null;
    streetStartTime       = null;
    currentTarget         = null;
    currentMonumentTarget = null;
    isPaused              = false;
    pauseStartTime        = null;
    remainingChronoMs     = null;

    // Met à jour la classe sur le <body> (layout session / non-session)
    updateLayoutSessionState();

    // — Couches —
    if (zoneMode === 'monuments') {
      if (streetsLayer && map.hasLayer(streetsLayer)) {
        map.removeLayer(streetsLayer);
      }
      if (monumentsLayer && !map.hasLayer(monumentsLayer)) {
        monumentsLayer.addTo(map);
      }
      clearQuartierOverlay();
    } else {
      if (monumentsLayer && map.hasLayer(monumentsLayer)) {
        map.removeLayer(monumentsLayer);
      }
      if (streetsLayer && !map.hasLayer(streetsLayer)) {
        streetsLayer.addTo(map);
      }

      if (zoneMode === 'quartier' && quartierSelect && quartierSelect.value) {
        highlightQuartier(quartierSelect.value);
      } else {
        clearQuartierOverlay();
      }
    }

    // — UI —
    if (targetStreetEl) {
      targetStreetEl.textContent = 'Mode lecture : survolez la carte';
      requestAnimationFrame(fitTargetStreetText);
    }

    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.disabled = true;
      pauseBtn.textContent = 'Pause';
    }

    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) {
      skipBtn.style.display = 'none';
    }

    // Bouton start/stop + pause → cachés en mode lecture
    updateStartStopButton();
    updatePauseButton();
    updateTimeUI(0, 0);

    // Tooltips sur rues / monuments
    setLectureTooltipsEnabled(true);

    showMessage('Mode lecture : survolez les rues ou monuments pour voir leurs noms.', 'info');
    return;
  }

  // --------- MODE MONUMENTS ---------
  isLectureMode = false;
  if (zoneMode === 'monuments') {
    if (!allMonuments.length) {
      showMessage('Aucun monument disponible (vérifiez data/marseille_monuments.geojson).', 'error');
      return;
    }

    if (streetsLayer && map.hasLayer(streetsLayer)) {
      map.removeLayer(streetsLayer);
    }
    if (monumentsLayer && !map.hasLayer(monumentsLayer)) {
      monumentsLayer.addTo(map);
    }
    clearQuartierOverlay();

    if (gameMode === 'marathon') {
      sessionMonuments = sampleWithoutReplacement(allMonuments, allMonuments.length);
    } else if (gameMode === 'chrono') {
      sessionMonuments = sampleWithoutReplacement(allMonuments, allMonuments.length);
    } else {
      const n = Math.min(SESSION_SIZE, allMonuments.length);
      sessionMonuments = sampleWithoutReplacement(allMonuments, n);
    }

    currentMonumentIndex = 0;
    currentMonumentTarget = null;
    currentTarget = null;
    isMonumentsMode = true;

    sessionStartTime = performance.now();
    streetStartTime = null;
    isSessionRunning = true;
    updateStartStopButton();
    updatePauseButton();
    updateLayoutSessionState();
    scrollSidebarToTargetPanel();

    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) skipBtn.style.display = 'inline-block';

    setNewTarget();
    showMessage('Session monuments démarrée.', 'info');
    
    updateLayoutSessionState();

    return;
  }

  // --------- MODES RUES ---------
  isLectureMode = false;
  isMonumentsMode = false;

  if (allStreetFeatures.length === 0) {
    showMessage('Impossible de démarrer : données rues non chargées.', 'error');
    return;
  }

  const candidates = getCurrentZoneStreets();
  if (candidates.length === 0) {
    showMessage('Aucune rue disponible pour cette zone.', 'error');
    return;
  }

  const uniqueStreets = buildUniqueStreetList(candidates);
  if (uniqueStreets.length === 0) {
    showMessage('Aucune rue nommée disponible pour cette zone.', 'error');
    return;
  }

  if (gameMode === 'marathon') {
    sessionStreets = sampleWithoutReplacement(uniqueStreets, uniqueStreets.length);
  } else if (gameMode === 'chrono') {
    sessionStreets = sampleWithoutReplacement(uniqueStreets, uniqueStreets.length);
  } else {
    const n = Math.min(SESSION_SIZE, uniqueStreets.length);
    sessionStreets = sampleWithoutReplacement(uniqueStreets, n);
  }

  currentIndex = 0;

  if (zoneMode === 'quartier' && quartierSelect && quartierSelect.value) {
    highlightQuartier(quartierSelect.value);
  } else {
    clearQuartierOverlay();
  }

  if (monumentsLayer && map.hasLayer(monumentsLayer)) {
    map.removeLayer(monumentsLayer);
  }
  if (streetsLayer && !map.hasLayer(streetsLayer)) {
    streetsLayer.addTo(map);
  }

  sessionStartTime = performance.now();
  currentTarget = null;
  currentMonumentTarget = null;
  streetStartTime = null;

  isSessionRunning = true;
  updateStartStopButton();
  updatePauseButton();
  updateLayoutSessionState();
  scrollSidebarToTargetPanel();

  const skipBtn = document.getElementById('skip-btn');
  if (skipBtn) skipBtn.style.display = 'inline-block';

  setNewTarget();
  showMessage('Session démarrée.', 'info');
}

// Récupère la liste de rues candidates selon la zone choisie
function getCurrentZoneStreets() {
  const quartierSelect = document.getElementById('quartier-select');
  const zoneMode = getZoneMode();

  if (zoneMode === 'quartier' && quartierSelect && quartierSelect.value) {
    const targetQuartier = quartierSelect.value;
    return allStreetFeatures.filter(f =>
      f.properties &&
      typeof f.properties.quartier === 'string' &&
      f.properties.quartier === targetQuartier
    );
  }

  if (zoneMode === 'rues-principales' || zoneMode === 'main') {
    return allStreetFeatures.filter(f => {
      const nm = normalizeName(f.properties && f.properties.name);
      return MAIN_STREET_NAMES.has(nm);
    });
  }

  if (zoneMode === 'rues-celebres') {
    return allStreetFeatures.filter(f => {
      const nm = normalizeName(f.properties && f.properties.name);
      return FAMOUS_STREET_NAMES.has(nm);
    });
  }

  return allStreetFeatures;
}

// Construit une liste de rues uniques
function buildUniqueStreetList(features) {
  const byName = new Map();

  features.forEach(f => {
    const rawName = typeof f.properties.name === 'string'
      ? f.properties.name.trim()
      : '';
    if (!rawName) return;
    const key = normalizeName(rawName);
    if (!byName.has(key)) {
      byName.set(key, f);
    }
  });

  return Array.from(byName.values());
}

// Tirage sans remise
function sampleWithoutReplacement(array, n) {
  const indices = Array.from(array.keys());
  shuffle(indices);
  return indices.slice(0, n).map(i => array[i]);
}

// Mélange en place
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ------------------------
// Sélection de la cible suivante (rue ou monument)
// ------------------------

function setNewTarget() {
  const gameMode = getGameMode();
  const zoneMode = getZoneMode();

  // Monuments
  if (zoneMode === 'monuments') {
    if (currentMonumentIndex >= sessionMonuments.length) {
      if (gameMode === 'chrono') {
        shuffle(sessionMonuments);
        currentMonumentIndex = 0;
      } else {
        endSession();
        return;
      }
    }

    currentTarget = null;
    currentMonumentTarget = sessionMonuments[currentMonumentIndex];
    streetStartTime = performance.now();
    hasAnsweredCurrentItem = false;
    resetWeightedBar();

    const targetName = currentMonumentTarget.properties.name;
    const targetEl = document.getElementById('target-street');
    if (targetEl) {
      targetEl.textContent = targetName || '—';
      requestAnimationFrame(fitTargetStreetText);
    }
  

    triggerTargetPulse();
    return;
  }

  // Rues
  if (currentIndex >= sessionStreets.length) {
    if (gameMode === 'chrono') {
      shuffle(sessionStreets);
      currentIndex = 0;
    } else {
      endSession();
      return;
    }
  }

  currentMonumentTarget = null;
  currentTarget = sessionStreets[currentIndex];
  streetStartTime = performance.now();
  hasAnsweredCurrentItem = false;
  resetWeightedBar();  

  const targetName = currentTarget.properties.name;
  const targetEl = document.getElementById('target-street');
  if (targetEl) {
    targetEl.textContent = targetName || '—';
    requestAnimationFrame(fitTargetStreetText);
  }

  triggerTargetPulse();
}

// Animation panneau "Rue à trouver"
function triggerTargetPulse() {
  const panel = document.querySelector('.target-panel');
  if (!panel) return;
  panel.classList.remove('pulse');
  void panel.offsetWidth;
  panel.classList.add('pulse');
}

// ------------------------
// Start / Stop + Pause
// ------------------------

function updateStartStopButton() {
  const btn = document.getElementById('restart-btn');
  if (!btn) return;

  const gameMode = getGameMode();

  // En mode lecture : bouton totalement caché
  if (gameMode === 'lecture') {
    btn.style.display = 'none';
    return;
  } else {
    btn.style.display = '';
  }

  if (isSessionRunning) {
    btn.textContent = 'Arrêter la session';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-stop');
  } else {
    btn.textContent = 'Commencer la session';
    btn.classList.remove('btn-stop');
    btn.classList.add('btn-primary');
  }
}

function stopSessionManually() {
  if (!isSessionRunning) return;
  endSession();
}

function togglePause() {
  if (!isSessionRunning) return;

  if (!isPaused) {
    // Mise en pause
    isPaused = true;
    pauseStartTime = performance.now();

    if (isChronoMode && chronoEndTime !== null) {
      remainingChronoMs = chronoEndTime - pauseStartTime;
    }
  } else {
    // Reprise
    const now = performance.now();
    const pausedDelta = now - pauseStartTime;

    if (sessionStartTime !== null) {
      sessionStartTime += pausedDelta;
    }
    if (streetStartTime !== null) {
      streetStartTime += pausedDelta;
    }

    if (isChronoMode && remainingChronoMs !== null) {
      chronoEndTime = now + remainingChronoMs;
      remainingChronoMs = null;
    }

    isPaused = false;
    pauseStartTime = null;
  }

  updatePauseButton();
}

function updatePauseButton() {
  const pauseBtn = document.getElementById('pause-btn');
  if (!pauseBtn) return;

  const gameMode = getGameMode();

  // En mode lecture : bouton totalement caché
  if (gameMode === 'lecture') {
    pauseBtn.style.display = 'none';
    return;
  } else {
    pauseBtn.style.display = '';
  }

  if (!isSessionRunning) {
    pauseBtn.textContent = 'Pause';
    pauseBtn.disabled = true;
    return;
  }

  pauseBtn.disabled = false;
  pauseBtn.textContent = isPaused ? 'Reprendre' : 'Pause';
}

function updateLayoutSessionState() {
  const body = document.body;
  if (!body) return;

  const hasMapLayout = isSessionRunning || isLectureMode;

  if (hasMapLayout) body.classList.add('session-running');
  else body.classList.remove('session-running');

  if (isLectureMode) body.classList.add('lecture-mode');
  else body.classList.remove('lecture-mode');

  if (map) {
    setTimeout(() => map.invalidateSize(), 300);
  }

  // Centrage auto du panneau cible en mode lecture (mobile)
  if (isLectureMode) {
    const sidebar = document.getElementById('sidebar');
    const targetPanel = document.querySelector('.target-panel');

    if (sidebar && targetPanel) {
      setTimeout(() => {
        sidebar.scrollTo({
          top: targetPanel.offsetTop - 8,
          behavior: 'smooth'
        });
      }, 120);
    }
  }

  // Affichage du bouton "Retour au menu" uniquement en mode lecture + mobile
  const backBtn = document.getElementById('lecture-back-btn');
  if (backBtn) {
    const isMobile = window.innerWidth <= 900;

    if (isLectureMode && isMobile) {
      backBtn.style.display = 'block';

      // >>> AJOUT MINIMAL : focus uniquement ici (lecture + mobile)
      if (!backBtn.__didAutoFocus) {
        backBtn.__didAutoFocus = true;

        // Attendre que display + layout + scroll soient stables
        setTimeout(() => {
          try {
            backBtn.focus({ preventScroll: true });
          } catch (_) {
            backBtn.focus();
          }
        }, 200);
      }
    } else {
      backBtn.style.display = 'none';
      backBtn.__didAutoFocus = false; // reset quand on sort du mode/du mobile
    }
  }
}

// ------------------------
// Gestion des clics sur les rues
// ------------------------

function handleStreetClick(clickedFeature) {
  const zoneMode = getZoneMode();

  if (zoneMode === 'monuments') return;

  // En mode "rues principales" : on ignore les rues non principales
  if (zoneMode === 'rues-principales' || zoneMode === 'main') {
    const nameNorm = normalizeName(clickedFeature.properties.name);
    if (!MAIN_STREET_NAMES.has(nameNorm)) {
      return;
    }
  }
  if (zoneMode === 'rues-celebres') {
    const nameNorm = normalizeName(clickedFeature.properties.name);
    if (!FAMOUS_STREET_NAMES.has(nameNorm)) {
      return;
    }
  }

  // En mode "quartier" : on ignore les rues hors quartier
  if (zoneMode === 'quartier') {
    const selectedQuartier = getSelectedQuartier();
    if (selectedQuartier &&
        clickedFeature.properties.quartier !== selectedQuartier) {
      return;
    }
  }

  if (isPaused) return;
  if (!currentTarget || sessionStartTime === null || streetStartTime === null) {
    return;
  }

  const gameMode = getGameMode();
  const now = performance.now();
  const streetTimeSec = (now - streetStartTime) / 1000;

  const clickedName   = normalizeName(clickedFeature.properties.name);
  const targetNameNorm= normalizeName(currentTarget.properties.name);

  const isCorrect = (clickedName === targetNameNorm);
  const answeredFeature = currentTarget;

  if (isCorrect) {
    correctCount += 1;
    const points = computeItemPoints(streetTimeSec);
    weightedScore += points;
    updateWeightedScoreUI();
    updateWeightedBar(points / 10);
    hasAnsweredCurrentItem = true;

    showMessage(
      `Correct (${streetTimeSec.toFixed(1)} s, +${points.toFixed(1)} pts)`,
      'success'
    );
    highlightStreet('#00aa00');
  } else {
    errorsCount += 1;
    if (gameMode === 'marathon' && errorsCount >= MAX_ERRORS_MARATHON) {
      showMessage(
        `Incorrect (limite de ${MAX_ERRORS_MARATHON} erreurs atteinte)`,
        'error'
      );
    } else {
      showMessage('Incorrect', 'error');
    }
    highlightStreet('#d00');
    updateWeightedBar(0);
  }

  totalAnswered += 1;
  summaryData.push({
    name: currentTarget.properties.name,
    correct: isCorrect,
    time: streetTimeSec.toFixed(1)
  });

  updateScoreUI();

  // Infos historiques pour rues principales
  showStreetInfo(answeredFeature);

  if (!isCorrect && gameMode === 'marathon' && errorsCount >= MAX_ERRORS_MARATHON) {
    endSession();
    return;
  }

  currentIndex += 1;
  setNewTarget();
}

// ------------------------
// Gestion des clics sur les monuments
// ------------------------

function handleMonumentClick(clickedFeature, clickedLayer) {
  const zoneMode = getZoneMode();
  if (zoneMode !== 'monuments') return;
  if (isPaused) return;

  if (!currentMonumentTarget || sessionStartTime === null || streetStartTime === null) {
    return;
  }

  const gameMode = getGameMode();
  const now = performance.now();
  const itemTimeSec = (now - streetStartTime) / 1000;

  const clickedName    = normalizeName(clickedFeature.properties.name);
  const targetNameNorm = normalizeName(currentMonumentTarget.properties.name);

  const isCorrect = (clickedName === targetNameNorm);
  const answeredName = currentMonumentTarget.properties.name;

  // On récupère toujours le layer correspondant au monument CIBLE
const correctLayer = findMonumentLayerByName(
  currentMonumentTarget.properties.name
);

if (isCorrect) {
  correctCount += 1;
  const points = computeItemPoints(itemTimeSec);
  weightedScore += points;
  updateWeightedScoreUI();
  updateWeightedBar(points / 10);
  hasAnsweredCurrentItem = true;

  showMessage(
    `Correct (${itemTimeSec.toFixed(1)} s, +${points.toFixed(1)} pts)`,
    'success'
  );
  // On surligne le monument CIBLE en vert
  highlightMonument(correctLayer, '#00aa00');
} else {
  errorsCount += 1;
  if (gameMode === 'marathon' && errorsCount >= MAX_ERRORS_MARATHON) {
    showMessage(
      `Incorrect (limite de ${MAX_ERRORS_MARATHON} erreurs atteinte)`,
      'error'
    );
  } else {
    showMessage('Incorrect', 'error');
  }
  // On surligne le monument CIBLE en rouge
  highlightMonument(correctLayer, '#d00');
  updateWeightedBar(0);
}

  totalAnswered += 1;
  summaryData.push({
    name: answeredName,
    correct: isCorrect,
    time: itemTimeSec.toFixed(1)
  });

  updateScoreUI();

  if (!isCorrect && gameMode === 'marathon' && errorsCount >= MAX_ERRORS_MARATHON) {
    endSession();
    return;
  }

  currentMonumentIndex += 1;
  setNewTarget();
}

function highlightMonument(layer, color) {
  if (!layer) return;

  layer.setStyle({ color: color, fillColor: color });

  setTimeout(() => {
    if (!layer.setStyle) return;
    layer.setStyle({ color: '#1565c0', fillColor: '#2196f3' });
  }, HIGHLIGHT_DURATION_MS);
}

// ------------------------
// Infos historiques rues principales
// ------------------------

function showStreetInfo(feature) {
  const panel = document.getElementById('street-info-panel');
  const infoEl = document.getElementById('street-info');
  if (!panel || !infoEl || !feature) return;

  const zoneMode = getZoneMode();

  // Si on n’est pas en mode "rues principales", on masque le panneau
  if (zoneMode !== 'rues-principales' && zoneMode !== 'main') {
    panel.style.display = 'none';
    panel.classList.remove('is-visible');
    infoEl.textContent = '';
    infoEl.classList.remove('is-visible');
    return;
  }

  const rawName = feature.properties.name || '';
  const key = normalizeName(rawName);

  let info = MAIN_STREET_INFOS[key];

  if (!info && MAIN_STREET_NAMES.has(key)) {
    info = "Rue principale : informations historiques à compléter.";
  }

  if (!info) {
    panel.style.display = 'none';
    panel.classList.remove('is-visible');
    infoEl.textContent = '';
    infoEl.classList.remove('is-visible');
    return;
  }

  // Affichage + animation
  panel.style.display = 'block';
  infoEl.style.display = 'block';        // ← AJOUT ESSENTIEL

  // Reset animation du texte
  infoEl.classList.remove('is-visible');
  // force reflow pour relancer la transition
  void infoEl.offsetWidth;

  infoEl.innerHTML = `<strong>${rawName}</strong><br>${info}`;

  panel.classList.add('is-visible');
  infoEl.classList.add('is-visible');
}

// ------------------------
// Surbrillance de la rue cible
// ------------------------

function highlightStreet(color) {
  if (!currentTarget) return;
  const streetName = currentTarget.properties.name;
  highlightStreetByName(streetName, color);
}

function highlightStreetByName(streetName, color) {
  clearHighlight();
  const targetName = normalizeName(streetName);
  if (!targetName) return [];

  const layersToHighlight = [];
  streetLayersById.forEach(layer => {
    const name = normalizeName(layer.feature.properties.name);
    if (name === targetName) {
      layersToHighlight.push(layer);
    }
  });

  if (layersToHighlight.length === 0) return [];

  highlightedLayers = layersToHighlight;

  highlightedLayers.forEach(layer => {
    layer.setStyle({ color: color, weight: 8 });
  });

  let bounds = null;
  layersToHighlight.forEach(layer => {
    if (typeof layer.getBounds === 'function') {
      const b = layer.getBounds();
      if (!bounds) bounds = b;
      else bounds = bounds.extend(b);
    }
  });

  if (bounds && bounds.isValid && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [60, 60] });
  }

  highlightTimeoutId = setTimeout(() => {
    highlightedLayers.forEach(layer => {
      layer.setStyle({ color: '#ffd500', weight: 5 });
    });
    highlightedLayers = [];
    highlightTimeoutId = null;
  }, HIGHLIGHT_DURATION_MS);

  return layersToHighlight;
}

function findMonumentLayerByName(name) {
  if (!monumentsLayer || !name) return null;

  const target = normalizeName(name);
  let foundLayer = null;

  monumentsLayer.eachLayer(layer => {
    const layerName = normalizeName(
      layer.feature?.properties?.name
    );
    if (layerName === target) {
      foundLayer = layer;
    }
  });

  return foundLayer;
}

function clearHighlight() {
  if (highlightTimeoutId !== null) {
    clearTimeout(highlightTimeoutId);
    highlightTimeoutId = null;
  }

  if (highlightedLayers && highlightedLayers.length > 0) {
    highlightedLayers.forEach(layer => {
      layer.setStyle({ color: '#ffd500', weight: 5 });
    });
    highlightedLayers = [];
  }
}

// ------------------------
// Focus depuis le récapitulatif (rues uniquement)
// ------------------------

function focusStreetByName(streetName) {
  const layers = highlightStreetByName(streetName, '#ffcc00');
  if (!layers || layers.length === 0) return;

  let bounds = null;
  layers.forEach(layer => {
    if (typeof layer.getBounds === 'function') {
      const b = layer.getBounds();
      if (!bounds) {
        bounds = b;
      } else {
        bounds = bounds.extend(b);
      }
    }
  });

  if (bounds && bounds.isValid && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

// ------------------------
// Fin de session & récapitulatif
// ------------------------

function endSession() {
  const now = performance.now();
  const totalTimeSec = sessionStartTime ? (now - sessionStartTime) / 1000 : 0;

  sessionStartTime      = null;
  streetStartTime       = null;
  currentTarget         = null;
  currentMonumentTarget = null;
  isSessionRunning      = false;
  isChronoMode          = false;
  chronoEndTime         = null;

  // Désactive explicitement le mode lecture
  isLectureMode = false;
  updateLayoutSessionState();

  isPaused          = false;
  pauseStartTime    = null;
  remainingChronoMs = null;

  updateStartStopButton();
  updatePauseButton();
  updateLayoutSessionState();

  const skipBtn = document.getElementById('skip-btn');
  if (skipBtn) skipBtn.style.display = 'inline-block';

  const total     = summaryData.length;
  const nbCorrect = summaryData.filter(r => r.correct).length;
  const percent   = total === 0 ? 0 : Math.round((nbCorrect / total) * 100);

  const avgTime = total === 0
    ? 0
    : summaryData.reduce((acc, r) => acc + parseFloat(r.time), 0) / total;

  const gameMode = getGameMode();
  const zoneMode = getZoneMode();

  let quartierName = null;
  if (zoneMode === 'quartier') {
    const quartierSelect = document.getElementById('quartier-select');
    if (quartierSelect && quartierSelect.value) {
      quartierName = quartierSelect.value;
    }
  }

  const summaryEl = document.getElementById('summary');
  if (!summaryEl) return;

  // -------------------------------
  // STRUCTURE DU RÉCAP
  // -------------------------------
  summaryEl.innerHTML = '';

  // --- Bloc global ---
  const globalWrapper = document.createElement('div');
  globalWrapper.className = 'summary-global';

  const title = document.createElement('h2');
  title.textContent = 'Récapitulatif de la session';
  globalWrapper.appendChild(title);

  let modeText;
  if (gameMode === 'marathon') {
    modeText = `Mode : Marathon (max. ${MAX_ERRORS_MARATHON} erreurs)`;
  } else if (gameMode === 'chrono') {
    modeText = `Mode : Chrono (${CHRONO_DURATION} s)`;
  } else {
    modeText = `Mode : Classique (${SESSION_SIZE} items max)`;
  }

  modeText += ` – Zone : ${zoneMode}`;
  if (quartierName) {
    modeText += ` – Quartier : ${quartierName}`;
  }
  const modeInfo = document.createElement('p');
  modeInfo.textContent = modeText;
  globalWrapper.appendChild(modeInfo);

  const stats = document.createElement('div');
  stats.className = 'summary-stats';
  stats.innerHTML =
    `<p>Temps total : <strong>${totalTimeSec.toFixed(1)} s</strong></p>
     <p>Temps moyen par item : <strong>${avgTime.toFixed(1)} s</strong></p>
     <p>Score : <strong>${percent} %</strong> (${nbCorrect} bonnes réponses / ${total})</p>
     <p>Score pondéré : <strong>${weightedScore.toFixed(1)} pts</strong></p>`;
  globalWrapper.appendChild(stats);

  summaryEl.appendChild(globalWrapper);

  // --- Bloc détail + filtres ---
  const detailWrapper = document.createElement('div');
  detailWrapper.className = 'summary-detail';

  // En-tête liste
  const listHeader = document.createElement('div');
  listHeader.className = 'summary-detail-header';

  const listTitle = document.createElement('h3');
  listTitle.textContent = 'Détail par item (cliquable pour zoomer sur les rues)';
  listHeader.appendChild(listTitle);

  // Filtres
  const filterContainer = document.createElement('div');
  filterContainer.className = 'summary-filters';

  const filters = [
    { value: 'all',       label: 'Tous' },
    { value: 'correct',   label: 'Corrects' },
    { value: 'incorrect', label: 'Incorrects' }
  ];

  let activeFilter = 'all';

  filters.forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'summary-filter-btn';
    btn.dataset.filter = f.value;
    btn.textContent = f.label;
    if (f.value === activeFilter) {
      btn.classList.add('is-active');
    }
    filterContainer.appendChild(btn);
  });

  listHeader.appendChild(filterContainer);
  detailWrapper.appendChild(listHeader);

  // Liste
  const list = document.createElement('ul');
  list.className = 'summary-list';

  summaryData.forEach(r => {
    const li = document.createElement('li');
    li.classList.add('summary-item');
    li.dataset.correct = r.correct ? 'true' : 'false';

    if (r.correct) {
      li.classList.add('summary-item--correct');
    } else {
      li.classList.add('summary-item--incorrect');
    }

    li.textContent = `${r.name} – ${r.correct ? 'Correct' : 'Incorrect'} – ${r.time} s`;
    li.dataset.streetName = r.name;

    li.addEventListener('click', () => {
      // Pour les rues, ça zoome ; pour les monuments, ça ne fera rien de spécial
      focusStreetByName(r.name);
    });

    list.appendChild(li);
  });

  detailWrapper.appendChild(list);
  summaryEl.appendChild(detailWrapper);

  // -------------------------------
  // LOGIQUE DE FILTRAGE
  // -------------------------------
  function applySummaryFilter(filter) {
    const items = list.querySelectorAll('.summary-item');
    items.forEach(li => {
      const isCorrect = li.dataset.correct === 'true';

      let visible = false;
      if (filter === 'all') {
        visible = true;
      } else if (filter === 'correct') {
        visible = isCorrect;
      } else if (filter === 'incorrect') {
        visible = !isCorrect;
      }

      li.style.display = visible ? '' : 'none';
    });
  }

  filterContainer.querySelectorAll('.summary-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newFilter = btn.dataset.filter;
      if (!newFilter || newFilter === activeFilter) return;

      activeFilter = newFilter;

      // état visuel
      filterContainer.querySelectorAll('.summary-filter-btn').forEach(b => {
        b.classList.toggle('is-active', b === btn);
      });

      // application du filtre
      applySummaryFilter(activeFilter);
    });
  });

  // Filtre initial
  applySummaryFilter(activeFilter);

  // Affiche le bloc récap
  summaryEl.classList.remove('hidden');

  showMessage('Session terminée.', 'info');
  const targetStreetEl = document.getElementById('target-street');
    if (targetStreetEl) {
    targetStreetEl.textContent = '—';
    requestAnimationFrame(fitTargetStreetText);
  }

  // Envoi du score au backend (si connecté)
  if (currentUser && currentUser.token) {
    sendScoreToServer({
      zoneMode,
      quartierName,
      gameMode,
      weightedScore,
      percentCorrect: percent,
      totalTimeSec,
      itemsAnswered: total,
      itemsCorrect: nbCorrect
    });
  }

  // Chargement du leaderboard pour ce mode
  loadLeaderboard(zoneMode, quartierName, gameMode);
}

// ------------------------
// Mise à jour de l'UI
// ------------------------

function updateScoreUI() {
  const scoreEl = document.getElementById('score');
  const pillEl  = document.getElementById('score-pill');

  if (!scoreEl) return;

  if (totalAnswered === 0) {
    scoreEl.textContent = '0 / 0 (0 %)';
    if (pillEl) {
      pillEl.className = 'score-pill score-pill--neutral';
    }
    return;
  }

  const percent = Math.round((correctCount / totalAnswered) * 100);
  scoreEl.textContent = `${correctCount} / ${totalAnswered} (${percent} %)`;

  if (!pillEl) return;

  if (percent > 50) {
    pillEl.className = 'score-pill score-pill--good';
  } else if (percent > 0) {
    pillEl.className = 'score-pill score-pill--warn';
  } else {
    pillEl.className = 'score-pill score-pill--neutral';
  }
}

function updateTimeUI(totalTimeSec, streetTimeSec) {
  const totalEl  = document.getElementById('total-time');
  const streetEl = document.getElementById('street-time');

  if (totalEl) {
    totalEl.textContent  = totalTimeSec.toFixed(1) + ' s';
  }
  if (streetEl) {
    streetEl.textContent = streetTimeSec.toFixed(1) + ' s';
  }
}

function updateWeightedScoreUI() {
  const el = document.getElementById('weighted-score');
  if (!el) return;
  el.textContent = weightedScore.toFixed(1);
}

// ------------------------
// Barre de progression du score pondéré (par question)
// ------------------------

function updateWeightedBar(ratio) {
  const bar = document.getElementById('weighted-score-bar');
  if (!bar) return;

  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  bar.style.width = pct + '%';
}

function resetWeightedBar() {
  // 100 % de potentiel au début de chaque question
  updateWeightedBar(1);
}

// ------------------------
// Auth helpers
// ------------------------

function getSupabaseConfig() {
  const dataset = document.body?.dataset || {};
  return {
    url: dataset.supabaseUrl || '',
    anonKey: dataset.supabaseAnonKey || ''
  };
}

function initSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    console.warn('Supabase non configuré (URL ou ANON KEY manquante).');
    return null;
  }
  return createClient(url, anonKey);
}

function buildCurrentUser(user, username, session) {
  if (!user || !username) return null;
  return {
    id: user.id,
    email: user.email || null,
    username,
    token: session?.access_token || null
  };
}

async function fetchUserProfile(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();
  if (error) {
    throw error;
  }
  return data;
}

function isUniqueViolation(error) {
  return error?.code === '23505' || /duplicate key/i.test(error?.message || '');
}

async function deleteAuthUser(userId) {
  if (!userId) return;
  try {
    const res = await fetch('/.netlify/functions/admin-delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    if (!res.ok) {
      const message = await res.text();
      console.warn('Suppression admin échouée :', message);
    }
  } catch (err) {
    console.warn('Suppression admin échouée :', err);
  }
}

async function syncSupabaseSession() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) {
      currentUser = null;
      clearCurrentUserFromStorage();
      updateUserUI();
      return;
    }
    const profile = await fetchUserProfile(data.session.user.id);
    currentUser = buildCurrentUser(data.session.user, profile?.username, data.session);
    saveCurrentUserToStorage(currentUser);
    updateUserUI();
  } catch (err) {
    console.warn('Impossible de synchroniser la session Supabase.', err);
  }
}

function loadCurrentUserFromStorage() {
  try {
    const raw = window.localStorage.getItem('marseille-quiz-user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Impossible de lire l’utilisateur stocké.', e);
    return null;
  }
}

function saveCurrentUserToStorage(user) {
  try {
    window.localStorage.setItem('marseille-quiz-user', JSON.stringify(user));
  } catch (e) {
    console.warn('Impossible de sauvegarder l’utilisateur.', e);
  }
}

function clearCurrentUserFromStorage() {
  try {
    window.localStorage.removeItem('marseille-quiz-user');
  } catch (e) {
    console.warn('Impossible de supprimer l’utilisateur stocké.', e);
  }
}

function updateUserUI() {
  const label = document.getElementById('current-user-label');
  const logoutBtn = document.getElementById('logout-btn');
  if (!label) return;

  if (currentUser && currentUser.username) {
    label.textContent = `Connecté : ${currentUser.username}`;
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
  } else {
    label.textContent = 'Non connecté.';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

// ------------------------
// API: envoi du score & leaderboard
// ------------------------

function sendScoreToServer(payload) {
  try {
    fetch('/api/scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(currentUser?.token ? { 'Authorization': 'Bearer ' + currentUser.token } : {})
      },
      body: JSON.stringify({
        zone_mode: payload.zoneMode,
        quartier_name: payload.quartierName || null,
        game_mode: payload.gameMode,
        weighted_score: payload.weightedScore,
        percent_correct: payload.percentCorrect,
        total_time_sec: payload.totalTimeSec,
        items_answered: payload.itemsAnswered,
        items_correct: payload.itemsCorrect
      })
    }).catch(err => {
      console.error('Erreur envoi score :', err);
    });
  } catch (err) {
    console.error('Erreur envoi score (synchrone) :', err);
  }
}

function loadLeaderboard(zoneMode, quartierName, gameMode) {
  const el = document.getElementById('leaderboard');
  if (!el) return;

  el.innerHTML = '<p>Chargement du leaderboard...</p>';

  const params = new URLSearchParams();
  params.set('zone_mode', zoneMode);
  params.set('game_mode', gameMode);
  if (quartierName) {
    params.set('quartier_name', quartierName);
  }

  fetch('/api/leaderboard?' + params.toString())
    .then(res => {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      return res.json();
    })
    .then(data => {
      const entries = data.entries || [];
      if (!entries.length) {
        el.innerHTML = '<p>Aucun score pour ce mode.</p>';
        return;
      }

      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>#</th><th>Joueur</th><th>Score pondéré</th><th>%</th><th>Temps</th></tr>';
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      entries.forEach((e, index) => {
        const tr = document.createElement('tr');
        const rank = e.rank != null ? e.rank : index + 1;
        const username = e.username || 'Anonyme';
        const score = typeof e.weighted_score === 'number' ? e.weighted_score.toFixed(1) : '-';
        const pc = typeof e.percent_correct === 'number' ? e.percent_correct + ' %' : '-';
        const time = typeof e.total_time_sec === 'number' ? e.total_time_sec.toFixed(1) + ' s' : '-';

        tr.innerHTML =
          `<td>${rank}</td>
           <td>${username}</td>
           <td>${score}</td>
           <td>${pc}</td>
           <td>${time}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      el.innerHTML = '';
      el.appendChild(table);
    })
    .catch(err => {
      console.error('Erreur leaderboard :', err);
      el.innerHTML = '<p>Erreur lors du chargement du leaderboard.</p>';
    });
}

function fitTargetStreetText() {
  const el = document.getElementById("target-street");
  if (!el) return;

  // Mobile uniquement
  if (!window.matchMedia("(max-width: 600px)").matches) {
    el.style.fontSize = ""; // reset desktop/tablette
    return;
  }

  // Mesure fiable : on force le nowrap (au cas où)
  el.style.whiteSpace = "nowrap";

  // Largeur disponible (padding inclus dans le parent, mais el est block)
  const maxWidth = el.clientWidth;
  if (maxWidth <= 0) return;

  // Bornes de taille (à ajuster si tu veux)
  const MAX = 18;  // taille "normale" mobile
  const MIN = 11;  // taille mini lisible

  // Reset à la taille max avant calcul
  el.style.fontSize = MAX + "px";

  // Si ça tient déjà, fini
  if (el.scrollWidth <= maxWidth) return;

  // Recherche binaire pour trouver la plus grande taille qui tient
  let lo = MIN, hi = MAX, best = MIN;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    el.style.fontSize = mid + "px";

    if (el.scrollWidth <= maxWidth) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  el.style.fontSize = best + "px";
}

// Refit sur resize / rotation
window.addEventListener("resize", () => {
  // RAF = attend que le layout soit stable
  requestAnimationFrame(fitTargetStreetText);
});
window.addEventListener("orientationchange", () => {
  requestAnimationFrame(fitTargetStreetText);
});
