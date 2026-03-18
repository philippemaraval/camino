(() => {
  // src/config.js
  var API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:" ? "http://localhost:3000" : "https://camino2.onrender.com";
  var MAX_POINTS_PER_ITEM = 10;
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

  // src/leaderboard.js
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
  var SCORING_GAME_TYPES = ["classique", "marathon", "chrono"];
  var SCORING_ZONES = ["rues-celebres", "rues-principales", "quartier", "monuments"];
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
  var ZONE_ORDER = ["rues-celebres", "rues-principales", "quartier", "ville", "monuments"];
  var GAME_ORDER = ["classique", "marathon", "chrono", "lecture"];
  function buildQuartierMarathonThresholds(maxItems) {
    const total = Math.max(1, parseInt(maxItems, 10) || 55);
    const minot = Math.min(total, Math.max(1, Math.ceil(0.1 * total)));
    const habitue = Math.min(total, Math.max(minot + 1, Math.ceil(0.2 * total)));
    const vrai = Math.min(total, Math.max(habitue + 1, Math.ceil(0.35 * total)));
    const maire = Math.min(total, Math.max(vrai + 1, Math.ceil(0.55 * total)));
    return { M: minot, H: habitue, V: vrai, MV: maire };
  }
  function getTitleThresholds(mode, gameType = "classique", maxItems = 0) {
    const modeThresholds = TITLE_THRESHOLDS_BY_MODE[gameType] || TITLE_THRESHOLDS_BY_MODE.classique;
    if (gameType === "marathon" && mode === "quartier") {
      return buildQuartierMarathonThresholds(maxItems);
    }
    return modeThresholds[mode] || modeThresholds.quartier || TITLE_THRESHOLDS_BY_MODE.classique[mode] || TITLE_THRESHOLDS_BY_MODE.classique.quartier;
  }
  function getTitleScoreValue(highScore, bestItemsCorrect, gameType = "classique") {
    if (gameType === "classique") {
      return parseFloat(highScore) || 0;
    }
    const parsedItems = parseFloat(bestItemsCorrect);
    return Number.isFinite(parsedItems) ? parsedItems : parseFloat(highScore) || 0;
  }
  function getGlobalRankLevelForTitleIndex(titleIndex) {
    const parsed = parseInt(titleIndex, 10);
    return Math.max(0, 4 - (isNaN(parsed) ? 4 : parsed));
  }
  function getGlobalRankTitleFromLevel(level) {
    return level >= 4 ? TITLE_NAMES[0] : level >= 3 ? TITLE_NAMES[1] : level >= 2 ? TITLE_NAMES[2] : level >= 1 ? TITLE_NAMES[3] : TITLE_NAMES[4];
  }
  function buildScoringComboMap(userStats) {
    const combos = /* @__PURE__ */ new Map();
    ((userStats == null ? void 0 : userStats.modes) || []).forEach((modeStats) => {
      if (!modeStats || !SCORING_GAME_TYPES.includes(modeStats.game_type) || !SCORING_ZONES.includes(modeStats.mode)) {
        return;
      }
      combos.set(`${modeStats.mode}|${modeStats.game_type}`, modeStats);
    });
    return combos;
  }
  function hasReachedGlobalRank(userStats, rankLetter) {
    const combos = buildScoringComboMap(userStats);
    return SCORING_GAME_TYPES.every(
      (gameType) => SCORING_ZONES.every((zoneMode) => {
        const combo = combos.get(`${zoneMode}|${gameType}`);
        if (!combo) {
          return false;
        }
        const thresholds = getTitleThresholds(zoneMode, gameType, combo.best_items_total || 0);
        const scoreValue = getTitleScoreValue(combo.high_score, combo.best_items_correct, gameType);
        return typeof (thresholds == null ? void 0 : thresholds[rankLetter]) === "number" && scoreValue >= thresholds[rankLetter];
      })
    );
  }
  function getGlobalRankLevel(userStats) {
    return hasReachedGlobalRank(userStats, "MV") ? 4 : hasReachedGlobalRank(userStats, "V") ? 3 : hasReachedGlobalRank(userStats, "H") ? 2 : hasReachedGlobalRank(userStats, "M") ? 1 : 0;
  }
  function getGlobalRankMeta(userStats) {
    const level = getGlobalRankLevel(userStats);
    return { level, title: getGlobalRankTitleFromLevel(level) };
  }
  function hasReachedVilleRank(userStats, rankLetter) {
    const combos = buildScoringComboMap(userStats);
    return SCORING_GAME_TYPES.every((gameType) => {
      const combo = combos.get(`ville|${gameType}`);
      if (!combo) {
        return false;
      }
      const thresholds = getTitleThresholds("ville", gameType, combo.best_items_total || 0);
      const scoreValue = getTitleScoreValue(combo.high_score, combo.best_items_correct, gameType);
      return typeof (thresholds == null ? void 0 : thresholds[rankLetter]) === "number" && scoreValue >= thresholds[rankLetter];
    });
  }
  var AVATAR_UNLOCKS = [
    { emoji: "\u{1F464}", reqScore: 0, reqTitleIdx: 4 },
    { emoji: "\u{1F9D1}", reqScore: 0, reqTitleIdx: 4 },
    { emoji: "\u{1F467}", reqScore: 0, reqTitleIdx: 4 },
    { emoji: "\u{1F9D2}", reqScore: 50, reqTitleIdx: 3 },
    { emoji: "\u{1F6F4}", reqScore: 50, reqTitleIdx: 3 },
    { emoji: "\u{1F355}", reqScore: 50, reqTitleIdx: 3 },
    { emoji: "\u2693", reqScore: 80, reqTitleIdx: 2 },
    { emoji: "\u{1F41F}", reqScore: 80, reqTitleIdx: 2 },
    { emoji: "\u26F5", reqScore: 80, reqTitleIdx: 2 },
    { emoji: "\u{1F30A}", reqScore: 80, reqTitleIdx: 2 },
    { emoji: "\u{1F4AA}", reqScore: 120, reqTitleIdx: 1 },
    { emoji: "\u2600\uFE0F", reqScore: 120, reqTitleIdx: 1 },
    { emoji: "\u{1F3D6}\uFE0F", reqScore: 120, reqTitleIdx: 1 },
    { emoji: "\u{1F60E}", reqScore: 120, reqTitleIdx: 1 },
    { emoji: "\u{1F3DB}\uFE0F", reqScore: 150, reqTitleIdx: 0 },
    { emoji: "\u{1F985}", reqScore: 150, reqTitleIdx: 0, desc: "Gabian" },
    { emoji: "\u26BD", reqScore: 150, reqTitleIdx: 0 },
    { emoji: "\u{1F451}", reqScore: 150, reqTitleIdx: 0 },
    {
      emoji: "\u{1F680}",
      name: "Astronaute",
      desc: "Atteindre Minot sur la Ville Enti\xE8re (Tous modes)",
      check: (userStats) => hasReachedVilleRank(userStats, "M")
    },
    {
      emoji: "\u2B50\uFE0F",
      name: "\xC9toile",
      desc: "Atteindre Habitu\xE9 sur la Ville Enti\xE8re (Tous modes)",
      check: (userStats) => hasReachedVilleRank(userStats, "H")
    },
    {
      emoji: "\u{1F6F8}",
      name: "Extraterrestre",
      desc: "Atteindre Vrai Marseillais sur la Ville Enti\xE8re (Tous modes)",
      check: (userStats) => hasReachedVilleRank(userStats, "V")
    },
    {
      emoji: "\u{1F47D}",
      name: "Alien",
      desc: "Atteindre Maire sur la Ville Enti\xE8re (Tous modes)",
      check: (userStats) => hasReachedVilleRank(userStats, "MV")
    }
  ];
  function getPlayerTitle(score, zoneMode, gameType = "classique", itemsTotal = 0, itemsCorrect = null) {
    const thresholds = getTitleThresholds(zoneMode, gameType, itemsTotal);
    const scoreValue = getTitleScoreValue(score, itemsCorrect, gameType);
    return scoreValue >= thresholds.MV ? TITLE_NAMES[0] : scoreValue >= thresholds.V ? TITLE_NAMES[1] : scoreValue >= thresholds.H ? TITLE_NAMES[2] : scoreValue >= thresholds.M ? TITLE_NAMES[3] : TITLE_NAMES[4];
  }
  function hasLeaderboardRows(boards) {
    return Object.values(boards || {}).some((rows) => Array.isArray(rows) && rows.length > 0);
  }
  function appendZoneLeaderboards(rootElement, boards) {
    const boardKeys = Object.keys(boards || {});
    const groupedByZone = {};
    boardKeys.forEach((key) => {
      const [zoneMode, gameType, quartierNameOrNull] = key.split("|");
      const rows = boards[key];
      if (!rows || rows.length === 0) {
        return;
      }
      if (!groupedByZone[zoneMode]) {
        groupedByZone[zoneMode] = {};
      }
      if (!groupedByZone[zoneMode][gameType]) {
        groupedByZone[zoneMode][gameType] = [];
      }
      groupedByZone[zoneMode][gameType].push({ quartierName: quartierNameOrNull || null, rows });
    });
    ZONE_ORDER.forEach((zoneMode) => {
      if (!groupedByZone[zoneMode]) {
        return;
      }
      const groupedByGameType = groupedByZone[zoneMode];
      const zoneDetails = document.createElement("details");
      zoneDetails.className = "leaderboard-zone-details";
      const zoneSummary = document.createElement("summary");
      zoneSummary.innerHTML = `<span class="leaderboard-zone-title">${ZONE_LABELS[zoneMode] || zoneMode}</span>`;
      zoneDetails.appendChild(zoneSummary);
      const zoneContent = document.createElement("div");
      zoneContent.className = "leaderboard-zone-content";
      GAME_ORDER.forEach((gameType) => {
        if (!groupedByGameType[gameType]) {
          return;
        }
        const sections = groupedByGameType[gameType];
        const modeContainer = document.createElement("div");
        modeContainer.className = "leaderboard-mode-container";
        const modeTitle = document.createElement("h4");
        modeTitle.className = "leaderboard-mode-title";
        modeTitle.textContent = GAME_LABELS[gameType] || gameType;
        modeContainer.appendChild(modeTitle);
        sections.sort(
          (left, right) => left.quartierName && right.quartierName ? left.quartierName.localeCompare(right.quartierName) : 0
        );
        sections.forEach((sectionData) => {
          const isQuartierSection = zoneMode === "quartier" && sectionData.quartierName && sectionData.quartierName !== "unknown";
          const section = document.createElement(isQuartierSection ? "details" : "div");
          section.className = "leaderboard-section";
          if (isQuartierSection) {
            const quartierSummary = document.createElement("summary");
            quartierSummary.className = "leaderboard-quartier-title";
            quartierSummary.textContent = sectionData.quartierName;
            section.appendChild(quartierSummary);
          }
          const table = document.createElement("table");
          table.className = "leaderboard-table";
          const thead = document.createElement("thead");
          let header = "<tr><th>#</th><th>Joueur</th>";
          header += gameType === "classique" ? "<th>Score</th>" : "<th>Rues trouv\xE9es</th>";
          if (gameType === "marathon") {
            header += "<th>Max zone</th>";
          }
          if (gameType === "chrono") {
            header += "<th>Temps</th>";
          }
          header += "<th>Parties</th></tr>";
          thead.innerHTML = header;
          table.appendChild(thead);
          const visibleTbody = document.createElement("tbody");
          const hiddenTbody = document.createElement("tbody");
          hiddenTbody.className = "leaderboard-hidden-rows";
          hiddenTbody.style.display = "none";
          sectionData.rows.forEach((row, index) => {
            const tr = document.createElement("tr");
            const rank = (index === 0 ? "\u{1F947} " : index === 1 ? "\u{1F948} " : index === 2 ? "\u{1F949} " : "") || `${index + 1}`;
            const title = getPlayerTitle(
              row.high_score || 0,
              zoneMode,
              gameType,
              row.items_total || 0,
              row.items_correct || 0
            );
            const playerAvatar = row.avatar || "\u{1F464}";
            let rowHtml = `<td>${rank}</td><td><span class="leaderboard-avatar">${playerAvatar}</span>${row.username || "Anonyme"}<br><small class="leaderboard-player-meta">${title}</small></td>`;
            const scoreCell = gameType === "classique" ? typeof row.high_score === "number" ? row.high_score.toFixed(1) : "-" : `${row.items_correct || 0}`;
            rowHtml += `<td>${scoreCell}</td>`;
            if (gameType === "marathon") {
              rowHtml += `<td>${row.items_total || 0}</td>`;
            }
            if (gameType === "chrono") {
              rowHtml += `<td>${(row.time_sec || 0).toFixed(1)}s</td>`;
            }
            rowHtml += `<td>${row.games_played || 0}</td>`;
            tr.innerHTML = rowHtml;
            if (index < LEADERBOARD_VISIBLE_ROWS) {
              visibleTbody.appendChild(tr);
            } else {
              hiddenTbody.appendChild(tr);
            }
          });
          table.appendChild(visibleTbody);
          table.appendChild(hiddenTbody);
          section.appendChild(table);
          if (sectionData.rows.length > LEADERBOARD_VISIBLE_ROWS) {
            const toggleWrap = document.createElement("div");
            toggleWrap.className = "leaderboard-toggle-wrap";
            const toggleButton = document.createElement("button");
            toggleButton.className = "leaderboard-toggle-btn";
            toggleButton.textContent = "\u25BC Voir les autres scores";
            toggleButton.onclick = () => {
              if (hiddenTbody.style.display === "none") {
                hiddenTbody.style.display = "table-row-group";
                toggleButton.textContent = "\u25B2 Masquer les scores";
              } else {
                hiddenTbody.style.display = "none";
                toggleButton.textContent = "\u25BC Voir les autres scores";
              }
            };
            toggleWrap.appendChild(toggleButton);
            section.appendChild(toggleWrap);
          }
          modeContainer.appendChild(section);
        });
        zoneContent.appendChild(modeContainer);
      });
      zoneDetails.appendChild(zoneContent);
      rootElement.appendChild(zoneDetails);
    });
  }
  function getCurrentMonthlyLeaderboardLabel() {
    const label = new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "Europe/Paris"
    }).format(/* @__PURE__ */ new Date());
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  function loadAllLeaderboards() {
    const leaderboardRoot = document.getElementById("leaderboard");
    if (!leaderboardRoot) {
      return;
    }
    leaderboardRoot.innerHTML = '<div class="skeleton skeleton-line skeleton-line--50"></div><div class="skeleton skeleton-block"></div><div class="skeleton skeleton-block"></div>';
    Promise.all([
      fetch(`${API_URL}/api/leaderboards`).then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      }),
      fetch(`${API_URL}/api/leaderboards?period=month`).then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      }),
      fetch(`${API_URL}/api/daily/leaderboard`).then((response) => response.ok ? response.json() : []).catch(() => [])
    ]).then(([allBoards, monthlyBoards, dailyRows]) => {
      const hasAllTimeRows = hasLeaderboardRows(allBoards);
      const hasMonthlyRows = hasLeaderboardRows(monthlyBoards);
      const hasDailyRows = !!(dailyRows && dailyRows.length > 0);
      if (!hasAllTimeRows && !hasMonthlyRows && !hasDailyRows) {
        leaderboardRoot.innerHTML = "<p>Aucun score enregistr\xE9.</p>";
        return;
      }
      leaderboardRoot.innerHTML = "";
      if (hasDailyRows) {
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
        dailyRows.forEach((row, index) => {
          const tr = document.createElement("tr");
          const rank = (index === 0 ? "\u{1F947} " : index === 1 ? "\u{1F948} " : index === 2 ? "\u{1F949} " : "") || `${index + 1}`;
          const playerAvatar = row.avatar || "\u{1F464}";
          tr.innerHTML = `<td>${rank}</td><td><span class="leaderboard-avatar">${playerAvatar}</span>${row.username || "Anonyme"}</td><td>${row.attempts_count}/7</td>`;
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
        leaderboardRoot.appendChild(dailyDetails);
      }
      if (hasAllTimeRows) {
        appendZoneLeaderboards(leaderboardRoot, allBoards);
      }
      const monthlyDetails = document.createElement("details");
      monthlyDetails.className = "leaderboard-zone-details";
      monthlyDetails.open = true;
      const monthlySummary = document.createElement("summary");
      monthlySummary.innerHTML = `<span class="leaderboard-zone-title">Classement mensuel \u2014 ${getCurrentMonthlyLeaderboardLabel()}</span>`;
      monthlyDetails.appendChild(monthlySummary);
      const monthlyContent = document.createElement("div");
      monthlyContent.className = "leaderboard-zone-content";
      if (hasMonthlyRows) {
        appendZoneLeaderboards(monthlyContent, monthlyBoards);
      } else {
        monthlyContent.innerHTML = "<p>Aucun score ce mois-ci.</p>";
      }
      monthlyDetails.appendChild(monthlyContent);
      leaderboardRoot.appendChild(monthlyDetails);
      if (!hasDailyRows) {
        const firstDetails = leaderboardRoot.querySelector("details");
        if (firstDetails) {
          firstDetails.open = true;
        }
      }
    }).catch((error) => {
      console.warn("Leaderboard indisponible :", error.message);
      leaderboardRoot.innerHTML = "<p>Aucun score enregistr\xE9.</p>";
    });
  }
  function loadLeaderboard() {
    loadAllLeaderboards();
  }

  // src/profile-runtime.js
  function getBadgeDefinitions(hasReachedGlobalRank2) {
    return [
      {
        id: "first_game",
        emoji: "\u{1F3AE}",
        name: "Premi\xE8re Partie",
        desc: "Terminer une session",
        check: (profile) => {
          var _a;
          return (parseInt((_a = profile.overall) == null ? void 0 : _a.total_games) || 0) >= 1;
        }
      },
      {
        id: "games_10",
        emoji: "\u{1F51F}",
        name: "25 Parties",
        desc: "Jouer 25 sessions",
        check: (profile) => {
          var _a;
          return (parseInt((_a = profile.overall) == null ? void 0 : _a.total_games) || 0) >= 25;
        }
      },
      {
        id: "games_50",
        emoji: "\u{1F4AF}",
        name: "Habitu\xE9",
        desc: "Jouer 100 sessions",
        check: (profile) => {
          var _a;
          return (parseInt((_a = profile.overall) == null ? void 0 : _a.total_games) || 0) >= 100;
        }
      },
      {
        id: "games_100",
        emoji: "\u{1F48E}",
        name: "V\xE9t\xE9ran",
        desc: "Jouer 250 sessions",
        check: (profile) => {
          var _a;
          return (parseInt((_a = profile.overall) == null ? void 0 : _a.total_games) || 0) >= 250;
        }
      },
      {
        id: "minot",
        emoji: "\u{1F9D2}",
        name: "Minot",
        desc: "Atteindre Minot dans tous les modes et toutes les zones",
        check: (profile) => hasReachedGlobalRank2(profile, "M")
      },
      {
        id: "habitue",
        emoji: "\u2693",
        name: "Habitu\xE9 du Vieux-Port",
        desc: "Atteindre Habitu\xE9 dans tous les modes et toutes les zones",
        check: (profile) => hasReachedGlobalRank2(profile, "H")
      },
      {
        id: "vrai",
        emoji: "\u{1F4AA}",
        name: "Vrai Marseillais",
        desc: "Atteindre Vrai Marseillais dans tous les modes et toutes les zones",
        check: (profile) => hasReachedGlobalRank2(profile, "V")
      },
      {
        id: "maire",
        emoji: "\u{1F3DB}\uFE0F",
        name: "Maire de la Ville",
        desc: "Atteindre Maire dans tous les modes et toutes les zones",
        check: (profile) => hasReachedGlobalRank2(profile, "MV")
      },
      {
        id: "celebres",
        emoji: "\u2B50",
        name: "\xC9toile de la Caneb",
        desc: "Jouer en Rues C\xE9l\xE8bres",
        check: (profile) => (profile.modes || []).some((modeEntry) => modeEntry.mode === "rues-celebres")
      },
      {
        id: "ville",
        emoji: "\u{1F3D9}\uFE0F",
        name: "Explorateur",
        desc: "Jouer en Ville Enti\xE8re",
        check: (profile) => (profile.modes || []).some((modeEntry) => modeEntry.mode === "ville")
      },
      {
        id: "monuments",
        emoji: "\u{1F5FF}",
        name: "Touriste Culturel",
        desc: "Jouer en mode Monuments",
        check: (profile) => (profile.modes || []).some((modeEntry) => modeEntry.mode === "monuments")
      },
      {
        id: "all_zones",
        emoji: "\u{1F9ED}",
        name: "Globe-trotter",
        desc: "Jouer dans chaque zone",
        check: (profile) => {
          const playedModes = new Set((profile.modes || []).map((modeEntry) => modeEntry.mode));
          return [
            "ville",
            "quartier",
            "rues-principales",
            "rues-celebres",
            "monuments"
          ].every((mode) => playedModes.has(mode));
        }
      },
      {
        id: "daily_first",
        emoji: "\u{1F4C5}",
        name: "Premier Daily",
        desc: "R\xE9ussir un Daily Challenge",
        check: (profile) => {
          var _a;
          return (parseInt((_a = profile.daily) == null ? void 0 : _a.successes) || 0) >= 1;
        }
      },
      {
        id: "daily_5",
        emoji: "\u{1F525}",
        name: "S\xE9rie de 10",
        desc: "10 Daily Challenges r\xE9ussis d'affil\xE9e",
        check: (profile) => {
          var _a;
          return (parseInt((_a = profile.daily) == null ? void 0 : _a.max_streak) || 0) >= 10;
        }
      },
      {
        id: "daily_10",
        emoji: "\u26A1",
        name: "S\xE9rie de 20",
        desc: "20 Daily Challenges r\xE9ussis d'affil\xE9e",
        check: (profile) => {
          var _a;
          return (parseInt((_a = profile.daily) == null ? void 0 : _a.max_streak) || 0) >= 20;
        }
      },
      {
        id: "daily_30",
        emoji: "\u{1F3C6}",
        name: "Champion du Mois",
        desc: "50 Daily Challenges r\xE9ussis d'affil\xE9e",
        check: (profile) => {
          var _a;
          return (parseInt((_a = profile.daily) == null ? void 0 : _a.max_streak) || 0) >= 50;
        }
      },
      {
        id: "perfect",
        emoji: "\u{1F3AF}",
        name: "Sans Faute",
        desc: "Score de 100 dans une session",
        check: (profile) => {
          var _a;
          return (parseFloat((_a = profile.overall) == null ? void 0 : _a.best_score) || 0) >= 100;
        }
      },
      {
        id: "multi_mode",
        emoji: "\u{1F31F}",
        name: "Polyvalent",
        desc: "Jouer dans 3 modes de jeu diff\xE9rents",
        check: (profile) => new Set((profile.modes || []).map((modeEntry) => modeEntry.game_type)).size >= 3
      }
    ];
  }
  function computeBadgesRuntime(profile, hasReachedGlobalRank2) {
    return getBadgeDefinitions(hasReachedGlobalRank2).map((definition) => ({
      ...definition,
      unlocked: definition.check(profile)
    }));
  }
  function toNumber(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function weightedAverage(rows, key) {
    let weightTotal = 0;
    let weightedSum = 0;
    rows.forEach((row) => {
      const weight = toNumber(row == null ? void 0 : row.games_played, 0);
      const value = toNumber(row == null ? void 0 : row[key], 0);
      if (weight > 0) {
        weightTotal += weight;
        weightedSum += value * weight;
      }
    });
    return weightTotal > 0 ? weightedSum / weightTotal : 0;
  }
  function getTrendMeta(weeklyProgress) {
    const currentWindow = weeklyProgress.slice(-4);
    const previousWindow = weeklyProgress.slice(-8, -4);
    const currentAvg = weightedAverage(currentWindow, "avg_score");
    const previousAvg = weightedAverage(previousWindow, "avg_score");
    if (previousAvg <= 0 && currentAvg <= 0) {
      return { icon: "\u2192", label: "Stable", delta: 0 };
    }
    if (previousAvg <= 0) {
      return { icon: "\u2197", label: "En hausse", delta: currentAvg };
    }
    const delta = currentAvg - previousAvg;
    if (delta > 1) {
      return { icon: "\u2197", label: "En hausse", delta };
    }
    if (delta < -1) {
      return { icon: "\u2198", label: "En baisse", delta };
    }
    return { icon: "\u2192", label: "Stable", delta };
  }
  function getModeLabel(mode, zoneLabels) {
    return (zoneLabels == null ? void 0 : zoneLabels[mode]) || mode || "\u2014";
  }
  function getHeatClass(gamesPlayed, successRate) {
    if (gamesPlayed < 3) {
      return "profile-heat--unknown";
    }
    if (successRate >= 70) {
      return "profile-heat--known";
    }
    if (successRate >= 45) {
      return "profile-heat--mid";
    }
    return "profile-heat--weak";
  }
  function buildProfileCompactStatsHTML(profile, zoneLabels) {
    const weeklyProgress = Array.isArray(profile.weekly_progress) ? profile.weekly_progress : [];
    const quartierStats = Array.isArray(profile.quartier_stats) ? profile.quartier_stats : [];
    const difficultyStats = Array.isArray(profile.difficulty_stats) ? profile.difficulty_stats : [];
    const globalSuccessRate = weightedAverage(difficultyStats, "success_rate");
    const globalAvgTime = weightedAverage(difficultyStats, "avg_time_sec");
    const trend = getTrendMeta(weeklyProgress);
    const weakestMode = [...difficultyStats].filter((row) => toNumber(row.games_played) > 2).sort((left, right) => toNumber(left.success_rate) - toNumber(right.success_rate))[0];
    const insight = weakestMode ? `Zone \xE0 travailler: ${getModeLabel(weakestMode.mode, zoneLabels)} (${toNumber(weakestMode.success_rate).toFixed(1)}% de r\xE9ussite).` : "Joue quelques sessions pour d\xE9bloquer des insights personnalis\xE9s.";
    const maxWeeklyGames = Math.max(1, ...weeklyProgress.map((row) => toNumber(row.games_played, 0)));
    const weeklyChartHtml = weeklyProgress.length > 0 ? weeklyProgress.map((row) => {
      const gamesPlayed = toNumber(row.games_played, 0);
      const barHeight = gamesPlayed > 0 ? Math.max(4, Math.round(gamesPlayed / maxWeeklyGames * 44)) : 2;
      const avgScore = toNumber(row.avg_score, 0).toFixed(1);
      return `
          <div class="profile-weekly-col" title="${row.label} : ${gamesPlayed} parties \u2022 score moyen ${avgScore}">
            <div class="profile-weekly-bar" style="height:${barHeight}px"></div>
            <span class="profile-weekly-col-label">${row.label}</span>
          </div>`;
    }).join("") : '<p class="profile-stats-empty">Pas assez de sessions pour afficher une \xE9volution.</p>';
    const heatChipsHtml = quartierStats.length > 0 ? quartierStats.slice(0, 24).map((row) => {
      const gamesPlayed = toNumber(row.games_played, 0);
      const successRate = toNumber(row.success_rate, 0);
      const heatClass = getHeatClass(gamesPlayed, successRate);
      return `<span class="profile-heat-chip ${heatClass}" title="${row.quartier_name}: ${successRate.toFixed(1)}% \u2022 ${gamesPlayed} parties">${row.quartier_name}</span>`;
    }).join("") : '<p class="profile-stats-empty">Aucune donn\xE9e quartier pour le moment.</p>';
    const quartierRowsHtml = quartierStats.length > 0 ? quartierStats.slice(0, 10).map((row) => `
      <tr>
        <td>${row.quartier_name}</td>
        <td>${toNumber(row.success_rate, 0).toFixed(1)}%</td>
        <td>${toNumber(row.avg_time_sec, 0).toFixed(1)} s</td>
      </tr>`).join("") : '<tr><td colspan="3">Aucune donn\xE9e disponible.</td></tr>';
    const orderedModes = ["rues-celebres", "rues-principales", "quartier", "ville", "monuments"];
    const difficultyMap = new Map(difficultyStats.map((row) => [row.mode, row]));
    const difficultyRows = orderedModes.filter((mode) => difficultyMap.has(mode)).map((mode) => difficultyMap.get(mode));
    const difficultyBarsHtml = difficultyRows.length > 0 ? difficultyRows.map((row) => {
      const successRate = Math.max(0, Math.min(100, toNumber(row.success_rate, 0)));
      const avgTime = toNumber(row.avg_time_sec, 0);
      return `
        <div class="profile-difficulty-row">
          <div class="profile-difficulty-head">
            <span>${getModeLabel(row.mode, zoneLabels)}</span>
            <span>${successRate.toFixed(1)}%</span>
          </div>
          <div class="profile-difficulty-bar-track">
            <div class="profile-difficulty-bar-fill" style="width:${successRate.toFixed(0)}%"></div>
          </div>
          <div class="profile-difficulty-meta">\u23F1 ${avgTime.toFixed(1)} s</div>
        </div>`;
    }).join("") : '<p class="profile-stats-empty">Aucune donn\xE9e de difficult\xE9 disponible.</p>';
    return `
    <section class="profile-compact-stats">
      <div class="profile-compact-header">Mes stats (compact)</div>
      <div class="profile-kpi-grid">
        <div class="profile-kpi-card">
          <span class="profile-kpi-value">${globalSuccessRate.toFixed(1)}%</span>
          <span class="profile-kpi-label">R\xE9ussite globale</span>
        </div>
        <div class="profile-kpi-card">
          <span class="profile-kpi-value">${globalAvgTime.toFixed(1)} s</span>
          <span class="profile-kpi-label">Temps moyen</span>
        </div>
        <div class="profile-kpi-card">
          <span class="profile-kpi-value">${trend.icon} ${trend.delta >= 0 ? "+" : ""}${trend.delta.toFixed(1)}</span>
          <span class="profile-kpi-label">Progression</span>
        </div>
      </div>
      <p class="profile-compact-insight">${insight}</p>

      <div class="profile-stats-accordion" id="profile-stats-accordion">
        <details class="profile-stats-section" open>
          <summary>\xC9volution hebdomadaire</summary>
          <div class="profile-stats-section-content">
            <div class="profile-weekly-chart">${weeklyChartHtml}</div>
          </div>
        </details>

        <details class="profile-stats-section">
          <summary>Carte de chaleur quartiers</summary>
          <div class="profile-stats-section-content">
            <div class="profile-heat-grid">${heatChipsHtml}</div>
          </div>
        </details>

        <details class="profile-stats-section">
          <summary>Temps moyen par quartier</summary>
          <div class="profile-stats-section-content">
            <table class="profile-mini-table">
              <thead>
                <tr><th>Quartier</th><th>R\xE9ussite</th><th>Temps</th></tr>
              </thead>
              <tbody>${quartierRowsHtml}</tbody>
            </table>
          </div>
        </details>

        <details class="profile-stats-section">
          <summary>R\xE9ussite par difficult\xE9</summary>
          <div class="profile-stats-section-content">
            <div class="profile-difficulty-list">${difficultyBarsHtml}</div>
          </div>
        </details>
      </div>
    </section>`;
  }
  function bindSingleOpenAccordion(container) {
    const accordion = container == null ? void 0 : container.querySelector("#profile-stats-accordion");
    if (!accordion) {
      return;
    }
    const sections = Array.from(accordion.querySelectorAll("details"));
    sections.forEach((section) => {
      section.addEventListener("toggle", () => {
        if (!section.open) {
          return;
        }
        sections.forEach((other) => {
          if (other !== section) {
            other.open = false;
          }
        });
      });
    });
  }
  function renderUserStickerRuntime(currentUser2) {
    const sticker = document.getElementById("user-sticker");
    const loginHint = document.getElementById("login-hint");
    if (!sticker) {
      return;
    }
    if (currentUser2 && currentUser2.username) {
      const avatarValue = currentUser2.avatar || "\u{1F464}";
      const avatarEl = document.createElement("span");
      const nameEl = document.createElement("span");
      avatarEl.className = "user-sticker-avatar";
      avatarEl.textContent = avatarValue;
      nameEl.className = "user-sticker-name";
      nameEl.textContent = currentUser2.username;
      sticker.replaceChildren(avatarEl, nameEl);
      sticker.style.display = "inline-flex";
      if (loginHint) {
        loginHint.style.display = "none";
      }
      return;
    }
    sticker.textContent = "";
    sticker.style.display = "none";
    if (loginHint) {
      loginHint.style.display = "";
    }
  }
  function updateUserUIRuntime({
    currentUser: currentUser2,
    renderUserSticker: renderUserSticker2,
    loadProfile: loadProfile2
  }) {
    const currentUserLabel = document.getElementById("current-user-label");
    const authBlock = document.querySelector(".auth-block");
    const logoutBtn = document.getElementById("logout-btn");
    const dailyModeBtn = document.getElementById("daily-mode-btn");
    if (currentUser2 && currentUser2.username) {
      if (currentUserLabel) {
        currentUserLabel.textContent = `Connect\xE9 en tant que ${currentUser2.username}`;
      }
      renderUserSticker2();
      if (authBlock) {
        authBlock.querySelectorAll("input").forEach((input) => {
          input.style.display = "none";
        });
        authBlock.querySelectorAll("button:not(#logout-btn)").forEach((button) => {
          button.style.display = "none";
        });
      }
      if (logoutBtn) {
        logoutBtn.style.display = "inline-block";
      }
      if (dailyModeBtn) {
        dailyModeBtn.style.display = "inline-flex";
      }
      const profilePanel2 = document.getElementById("profile-panel");
      if (profilePanel2) {
        profilePanel2.style.display = "block";
      }
      loadProfile2();
      return;
    }
    if (currentUserLabel) {
      currentUserLabel.textContent = "Non connect\xE9.";
    }
    renderUserSticker2();
    if (authBlock) {
      authBlock.querySelectorAll("input").forEach((input) => {
        input.style.display = "";
      });
      authBlock.querySelectorAll("button:not(#logout-btn)").forEach((button) => {
        button.style.display = "";
      });
    }
    if (logoutBtn) {
      logoutBtn.style.display = "none";
    }
    if (dailyModeBtn) {
      dailyModeBtn.style.display = "none";
    }
    const profilePanel = document.getElementById("profile-panel");
    if (profilePanel) {
      profilePanel.style.display = "none";
    }
  }
  function loadProfileRuntime({
    currentUser: currentUser2,
    apiUrl,
    saveCurrentUserToStorage: saveCurrentUserToStorage2,
    renderUserSticker: renderUserSticker2,
    getGlobalRankMeta: getGlobalRankMeta2,
    getPlayerTitle: getPlayerTitle2,
    zoneLabels,
    gameLabels,
    hasReachedGlobalRank: hasReachedGlobalRank2,
    initAvatarSelector: initAvatarSelector2,
    onProfileRendered
  }) {
    if (!currentUser2 || !currentUser2.token) {
      return;
    }
    const profileContent = document.getElementById("profile-content");
    if (!profileContent) {
      return;
    }
    profileContent.innerHTML = '<div class="skeleton skeleton-avatar"></div><div class="skeleton skeleton-line skeleton-line--60"></div><div class="skeleton skeleton-block"></div><div class="skeleton skeleton-line skeleton-line--80"></div>';
    fetch(`${apiUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${currentUser2.token}` }
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }).then((profile) => {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      if (currentUser2) {
        const nextAvatar = profile.avatar || "\u{1F464}";
        const nextUsername = profile.username || currentUser2.username;
        const changed = currentUser2.avatar !== nextAvatar || currentUser2.username !== nextUsername;
        currentUser2.avatar = nextAvatar;
        currentUser2.username = nextUsername;
        if (changed) {
          saveCurrentUserToStorage2(currentUser2);
        }
        renderUserSticker2();
      }
      const bestScore = parseFloat((_a = profile.overall) == null ? void 0 : _a.best_score) || 0;
      const globalRankMeta = getGlobalRankMeta2(profile);
      const globalTitle = globalRankMeta.title;
      const totalGames = parseInt((_b = profile.overall) == null ? void 0 : _b.total_games) || 0;
      const averageScore = parseFloat((_c = profile.overall) == null ? void 0 : _c.avg_score) || 0;
      const dailyTotalDays = parseInt((_d = profile.daily) == null ? void 0 : _d.total_days) || 0;
      const dailySuccesses = parseInt((_e = profile.daily) == null ? void 0 : _e.successes) || 0;
      const dailyAverageAttempts = parseFloat((_f = profile.daily) == null ? void 0 : _f.avg_attempts) || 0;
      const memberSince = profile.memberSince ? new Date(profile.memberSince).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }) : "\u2014";
      let html = `
        <div class="profile-header">
          <div class="profile-avatar">
            ${profile.avatar || "\u{1F464}"}
            <button type="button" class="edit-avatar-badge" id="btn-edit-avatar" title="Changer d'avatar" aria-label="Changer d'avatar">\u270F\uFE0F</button>
          </div>
          <div class="profile-info">
            <div class="profile-name">${profile.username}</div>
            <div class="profile-title">${globalTitle}</div>
          </div>
        </div>

        <div class="profile-stats-grid">
          <div class="profile-stat">
            <span class="profile-stat-value">${totalGames}</span>
            <span class="profile-stat-label">Parties</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value">${bestScore.toFixed(1)}</span>
            <span class="profile-stat-label">Meilleur</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value">${averageScore}</span>
            <span class="profile-stat-label">Moyenne</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value">${dailySuccesses}/${dailyTotalDays}</span>
            <span class="profile-stat-label">Daily \u2705</span>
          </div>
        </div>`;
      html += buildProfileCompactStatsHTML(profile, zoneLabels);
      if (profile.modes && profile.modes.length > 0) {
        html += '<details class="profile-section-collapsible">';
        html += '<summary class="profile-section-title">D\xE9tail par mode</summary>';
        html += '<div class="profile-modes">';
        profile.modes.forEach((modeEntry) => {
          const zoneLabel = zoneLabels[modeEntry.mode] || modeEntry.mode;
          const gameLabel = gameLabels[modeEntry.game_type] || modeEntry.game_type;
          const highScore = parseFloat(modeEntry.high_score) || 0;
          const scoreLabel = modeEntry.game_type === "classique" ? highScore.toFixed(1) : String(Math.round(highScore));
          const title = getPlayerTitle2(
            highScore,
            modeEntry.mode,
            modeEntry.game_type,
            modeEntry.best_items_total || 0,
            modeEntry.best_items_correct || 0
          );
          html += `
            <div class="profile-mode-row">
              <div class="profile-mode-name">${zoneLabel} \u2014 ${gameLabel}</div>
              <div class="profile-mode-details">
                <span>\u{1F3C6} ${scoreLabel}</span>
                <span>\u{1F4CA} \xD8${parseFloat(modeEntry.avg_score).toFixed(1)}</span>
                <span>\u{1F3AE} ${modeEntry.games_played}</span>
              </div>
              <div class="profile-mode-title">${title}</div>
            </div>`;
        });
        html += "</div></details>";
      }
      if (dailyTotalDays > 0) {
        html += `
          <div class="profile-daily-summary">
            <span>\u{1F4C5} Daily : ${dailyAverageAttempts} essais en moyenne</span>
            ${((_g = profile.daily) == null ? void 0 : _g.current_streak) > 0 ? `<br><span class="profile-daily-current-streak">\u{1F525} S\xE9rie actuelle : ${profile.daily.current_streak}</span>` : ""}
            ${((_h = profile.daily) == null ? void 0 : _h.max_streak) > 0 ? `<br><span class="profile-daily-best-streak">\u{1F3C6} Meilleure s\xE9rie : ${profile.daily.max_streak}</span>` : ""}
          </div>`;
      }
      html += `
        <section class="profile-notification-card">
          <div class="profile-notification-title">Rappel Daily \xE0 10:00</div>
          <p id="daily-reminder-status" class="profile-notification-status">Chargement\u2026</p>
          <div class="profile-notification-actions">
            <button type="button" id="daily-reminder-enable-btn" class="btn-secondary">Activer le rappel</button>
            <button type="button" id="daily-reminder-disable-btn" class="btn-tertiary hidden">D\xE9sactiver</button>
          </div>
        </section>`;
      const badges = computeBadgesRuntime(profile, hasReachedGlobalRank2);
      const unlocked = badges.filter((badge) => badge.unlocked);
      const locked = badges.filter((badge) => !badge.unlocked);
      html += `<details class="profile-section-collapsible">`;
      html += `<summary class="profile-badges-title">Succ\xE8s (${unlocked.length}/${badges.length})</summary>`;
      html += '<div class="profile-badges-grid">';
      unlocked.forEach((badge) => {
        html += `<div class="profile-badge unlocked" tabindex="0" title="${badge.name}
\u2705 ${badge.desc}" data-tooltip="${badge.name}
\u2705 ${badge.desc}" aria-label="${badge.name} d\xE9bloqu\xE9. ${badge.desc}">
          <span class="badge-emoji">${badge.emoji}</span>
          <span class="badge-name">${badge.name}</span>
        </div>`;
      });
      locked.forEach((badge) => {
        html += `<div class="profile-badge locked" tabindex="0" title="${badge.name}
\u{1F512} ${badge.desc}" data-tooltip="${badge.name}
\u{1F512} ${badge.desc}" aria-label="${badge.name} verrouill\xE9. ${badge.desc}">
          <span class="badge-emoji">\u{1F512}</span>
          <span class="badge-name">${badge.name}</span>
        </div>`;
      });
      html += "</div></details>";
      html += `<div class="profile-member-since">Membre depuis le ${memberSince}</div>`;
      profileContent.innerHTML = html;
      initAvatarSelector2(profile.avatar || "\u{1F464}", globalRankMeta.level);
      bindSingleOpenAccordion(profileContent);
      if (typeof onProfileRendered === "function") {
        onProfileRendered();
      }
    }).catch((error) => {
      console.warn("Profile error:", error.message);
      profileContent.innerHTML = '<p class="profile-unavailable">Profil indisponible.</p>';
    });
  }
  function initAvatarSelectorRuntime({
    currentAvatar,
    globalRankLevel,
    renderAvatarGrid: renderAvatarGrid2
  }) {
    const btnEdit = document.getElementById("btn-edit-avatar");
    const modal = document.getElementById("avatar-selector-modal");
    const closeBtn = document.getElementById("avatar-modal-close");
    const grid = document.getElementById("avatar-grid");
    const profileStatsGrid = document.querySelector(".profile-stats-grid");
    if (!btnEdit || !modal || !grid || !closeBtn) {
      return;
    }
    if (profileStatsGrid && profileStatsGrid.parentNode) {
      profileStatsGrid.parentNode.insertBefore(modal, profileStatsGrid.nextSibling);
    }
    btnEdit.addEventListener("click", () => {
      modal.style.display = "block";
      renderAvatarGrid2(currentAvatar, globalRankLevel);
    });
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }
  function renderAvatarGridRuntime({
    currentAvatar,
    globalRankLevel,
    avatarUnlocks,
    titleNames,
    currentUser: currentUser2,
    getGlobalRankLevelForTitleIndex: getGlobalRankLevelForTitleIndex2,
    apiUrl,
    saveCurrentUserToStorage: saveCurrentUserToStorage2,
    updateUserUI: updateUserUI2,
    showMessage: showMessage2
  }) {
    const grid = document.getElementById("avatar-grid");
    if (!grid) {
      return;
    }
    grid.innerHTML = "";
    avatarUnlocks.forEach((avatarDef) => {
      let requiredLevel = 0;
      let isUnlocked = false;
      if (typeof avatarDef.check === "function") {
        isUnlocked = avatarDef.check(currentUser2);
      } else {
        requiredLevel = getGlobalRankLevelForTitleIndex2(avatarDef.reqTitleIdx);
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
        const requiredTitle = titleNames[avatarDef.reqTitleIdx];
        if (!isUnlocked) {
          item.classList.add("locked");
          item.title = `Titre global requis:
\u{1F512} ${requiredTitle}
(\xE0 atteindre dans tous les modes et zones)`;
          item.setAttribute("aria-disabled", "true");
        } else {
          item.title = `D\xE9bloqu\xE9:
\u2705 ${requiredTitle} (global)`;
          if (avatarDef.desc) {
            item.title += ` - ${avatarDef.desc}`;
          }
        }
      }
      item.setAttribute("data-tooltip", item.title || "");
      if (isUnlocked) {
        item.addEventListener("click", () => {
          fetch(`${apiUrl}/api/profile/avatar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentUser2.token}`
            },
            body: JSON.stringify({ avatar: avatarDef.emoji })
          }).then((response) => {
            if (!response.ok) {
              throw new Error("Erreur sauvegarde avatar");
            }
            return response.json();
          }).then(() => {
            currentUser2.avatar = avatarDef.emoji;
            saveCurrentUserToStorage2(currentUser2);
            updateUserUI2();
            const modal = document.getElementById("avatar-selector-modal");
            if (modal) {
              modal.style.display = "none";
            }
            showMessage2("Avatar mis \xE0 jour !", "success");
          }).catch((error) => {
            console.error(error);
            showMessage2("Erreur lors de la sauvegarde de l'avatar", "error");
          });
        });
      }
      grid.appendChild(item);
    });
  }
  function sendScoreToServerRuntime({
    isDailyMode: isDailyMode2,
    currentUser: currentUser2,
    apiUrl,
    payload,
    loadAllLeaderboards: loadAllLeaderboards2
  }) {
    if (isDailyMode2 || !currentUser2 || !currentUser2.token) {
      return;
    }
    try {
      fetch(`${apiUrl}/api/scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser2.token}`
        },
        body: JSON.stringify({
          mode: payload.zoneMode,
          gameType: payload.gameMode,
          score: payload.score,
          itemsCorrect: payload.itemsCorrect,
          itemsTotal: payload.itemsTotal,
          timeSec: payload.totalTimeSec,
          quartierName: payload.quartierName
        })
      }).then((response) => response.json()).then(() => {
        loadAllLeaderboards2();
      }).catch((error) => {
        console.error("Erreur envoi score :", error);
      });
    } catch (error) {
      console.error("Erreur envoi score (synchrone) :", error);
    }
  }

  // src/map.js
  function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const earthRadius = 6371e3;
    const toRadians = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRadians;
    const dLon = (lon2 - lon1) * toRadians;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * earthRadius * Math.asin(Math.sqrt(a));
  }
  function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const earthRadius = 6371e3;
    const cosLat = Math.cos(px * Math.PI / 180);
    const pxMeters = py * cosLat * earthRadius * Math.PI / 180;
    const pyMeters = px * earthRadius * Math.PI / 180;
    const x1Meters = x1 * cosLat * earthRadius * Math.PI / 180;
    const y1Meters = y1 * earthRadius * Math.PI / 180;
    const x2Meters = x2 * cosLat * earthRadius * Math.PI / 180;
    const y2Meters = y2 * earthRadius * Math.PI / 180;
    const dx = x2Meters - x1Meters;
    const dy = y2Meters - y1Meters;
    const l2 = dx * dx + dy * dy;
    let t = 0;
    if (l2 !== 0) {
      t = Math.max(
        0,
        Math.min(1, ((pxMeters - x1Meters) * dx + (pyMeters - y1Meters) * dy) / l2)
      );
    }
    const projX = x1Meters + t * dx;
    const projY = y1Meters + t * dy;
    const dist2 = (pxMeters - projX) * (pxMeters - projX) + (pyMeters - projY) * (pyMeters - projY);
    return Math.sqrt(dist2);
  }
  function getDistanceToFeature(lat, lon, geometry) {
    if (!geometry) {
      return 0;
    }
    let minDistance = Number.POSITIVE_INFINITY;
    function inspectLine(lineCoords) {
      for (let index = 0; index < lineCoords.length - 1; index++) {
        const [x1, y1] = lineCoords[index];
        const [x2, y2] = lineCoords[index + 1];
        const segmentDistance = pointToSegmentDistance(lat, lon, x1, y1, x2, y2);
        if (segmentDistance < minDistance) {
          minDistance = segmentDistance;
        }
      }
    }
    if (geometry.type === "LineString") {
      inspectLine(geometry.coordinates);
    } else if (geometry.type === "MultiLineString") {
      geometry.coordinates.forEach(inspectLine);
    } else if (geometry.type === "Point") {
      minDistance = getDistanceMeters(lat, lon, geometry.coordinates[1], geometry.coordinates[0]);
    }
    return Number.isFinite(minDistance) ? minDistance : 0;
  }
  function calculateStreetLengthFromFeatures(streetName, allStreetFeatures2, normalizeName2) {
    try {
      if (!streetName || !Array.isArray(allStreetFeatures2)) {
        return 0;
      }
      const normalizedStreetName = normalizeName2(streetName);
      const feature = allStreetFeatures2.find(
        (candidate) => candidate && candidate.properties && candidate.properties.name && normalizeName2(candidate.properties.name) === normalizedStreetName
      );
      if (!feature || !feature.geometry || !feature.geometry.coordinates) {
        return 0;
      }
      let totalMeters = 0;
      const geometry = feature.geometry;
      if (geometry.type === "LineString") {
        for (let index = 0; index < geometry.coordinates.length - 1; index++) {
          const [lon1, lat1] = geometry.coordinates[index];
          const [lon2, lat2] = geometry.coordinates[index + 1];
          totalMeters += getDistanceMeters(lat1, lon1, lat2, lon2);
        }
      } else if (geometry.type === "MultiLineString") {
        for (const line of geometry.coordinates) {
          for (let index = 0; index < line.length - 1; index++) {
            const [lon1, lat1] = line[index];
            const [lon2, lat2] = line[index + 1];
            totalMeters += getDistanceMeters(lat1, lon1, lat2, lon2);
          }
        }
      }
      return totalMeters;
    } catch (error) {
      console.error("Error calculating street length:", error);
      return 0;
    }
  }
  function computeFeatureCentroid(feature) {
    const geometry = feature.geometry;
    let coordinates = [];
    if (geometry.type === "LineString") {
      coordinates = geometry.coordinates;
    } else if (geometry.type === "MultiLineString") {
      coordinates = geometry.coordinates.flat();
    } else if (geometry.type === "Point") {
      return geometry.coordinates;
    } else {
      return [5.3698, 43.2965];
    }
    if (coordinates.length === 0) {
      return [5.3698, 43.2965];
    }
    const [sumLon, sumLat] = coordinates.reduce(
      (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
      [0, 0]
    );
    return [sumLon / coordinates.length, sumLat / coordinates.length];
  }

  // src/map-session-core.js
  function normalizeQuartierKey(quartierName) {
    if (!quartierName) {
      return "";
    }
    let normalized = quartierName.trim();
    const legacySuffixMatch = normalized.match(/^(.+)\s+\((L'|L’|La|Le|Les)\)$/i);
    if (legacySuffixMatch) {
      let body = legacySuffixMatch[1].trim();
      let article = legacySuffixMatch[2].trim();
      article = /^l[’']/i.test(article) ? "L'" : article.charAt(0).toUpperCase() + article.slice(1).toLowerCase();
      normalized = `${article} ${body}`;
    }
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalized = normalized.replace(/\s+/g, " ").toLowerCase();
    return normalized;
  }
  var FREE_MODE_EXCLUDED_PREFIXES = /* @__PURE__ */ new Set([
    "residence",
    "lotissement",
    "domaine",
    "gare",
    "station",
    "metro",
    "cite",
    "acces",
    "campagne",
    "parc",
    "sentier",
    "cour"
  ]);
  var FREE_MODE_EXCLUDED_KEYWORDS = [
    "hameau",
    "parking",
    "groupe",
    "entree",
    "depose",
    "copropriete",
    "lycee",
    "hlm",
    "hopital",
    "centre",
    "complexe"
  ];
  function normalizeStreetTextForFilters(streetName) {
    return (streetName || "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9' ]+/g, " ").replace(/’/g, "'").replace(/\s+/g, " ");
  }
  function isExcludedFromVilleAndQuartier(streetName) {
    const normalized = normalizeStreetTextForFilters(streetName);
    if (!normalized) {
      return true;
    }
    const firstToken = normalized.split(/[\s']/).filter(Boolean)[0];
    if (!firstToken) {
      return true;
    }
    if (FREE_MODE_EXCLUDED_PREFIXES.has(firstToken)) {
      return true;
    }
    return FREE_MODE_EXCLUDED_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }
  function createArrondissementByQuartierMap(arrondissementByQuartier2) {
    const map2 = /* @__PURE__ */ new Map();
    Object.entries(arrondissementByQuartier2).forEach(([quartierName, arrondissement]) => {
      map2.set(normalizeQuartierKey(quartierName), arrondissement);
    });
    return map2;
  }
  function getBaseStreetStyleFromName({
    zoneMode,
    streetName,
    normalizeName: normalizeName2,
    uiTheme,
    mainStreetNames,
    famousStreetNames
  }) {
    const normalizedStreetName = normalizeName2(streetName || "");
    let color = uiTheme.mapStreet;
    let weight = 5;
    if ((zoneMode === "rues-principales" || zoneMode === "main") && !mainStreetNames.has(normalizedStreetName)) {
      color = "#00000000";
      weight = 0;
    }
    if (zoneMode === "rues-celebres" && !famousStreetNames.has(normalizedStreetName)) {
      color = "#00000000";
      weight = 0;
    }
    return { color, weight };
  }
  function getBaseStreetStyle({
    layerOrFeature,
    zoneMode,
    selectedQuartier,
    normalizeName: normalizeName2,
    uiTheme,
    mainStreetNames,
    famousStreetNames
  }) {
    var _a, _b;
    const feature = layerOrFeature.feature || layerOrFeature;
    let style = getBaseStreetStyleFromName({
      zoneMode,
      streetName: ((_a = feature == null ? void 0 : feature.properties) == null ? void 0 : _a.name) || "",
      normalizeName: normalizeName2,
      uiTheme,
      mainStreetNames,
      famousStreetNames
    });
    if (zoneMode === "quartier" && selectedQuartier && (((_b = feature == null ? void 0 : feature.properties) == null ? void 0 : _b.quartier) || null) !== selectedQuartier) {
      style = { color: "#00000000", weight: 0 };
    }
    return style;
  }
  function isStreetVisibleInCurrentMode({
    zoneMode,
    normalizedStreetName,
    quartierName,
    selectedQuartier,
    famousStreetNames,
    mainStreetNames
  }) {
    if (zoneMode === "monuments") {
      return false;
    }
    if (zoneMode === "rues-celebres") {
      return famousStreetNames.has(normalizedStreetName);
    }
    if (zoneMode === "rues-principales" || zoneMode === "main") {
      return mainStreetNames.has(normalizedStreetName);
    }
    if (zoneMode === "quartier") {
      if (isExcludedFromVilleAndQuartier(normalizedStreetName)) {
        return false;
      }
      const cleanQuartierName = typeof quartierName === "string" ? quartierName.trim() : null;
      if (selectedQuartier && cleanQuartierName !== selectedQuartier) {
        return false;
      }
    }
    if (zoneMode === "ville" && isExcludedFromVilleAndQuartier(normalizedStreetName)) {
      return false;
    }
    return true;
  }
  function getCurrentZoneStreets({
    allStreetFeatures: allStreetFeatures2,
    zoneMode,
    selectedQuartier,
    normalizeName: normalizeName2,
    mainStreetNames,
    famousStreetNames
  }) {
    if (zoneMode === "quartier" && selectedQuartier) {
      return allStreetFeatures2.filter(
        (feature) => feature.properties && typeof feature.properties.quartier === "string" && feature.properties.quartier === selectedQuartier && !isExcludedFromVilleAndQuartier(normalizeName2(feature.properties.name))
      );
    }
    if (zoneMode === "rues-principales" || zoneMode === "main") {
      return allStreetFeatures2.filter((feature) => {
        const normalizedStreetName = normalizeName2(feature.properties && feature.properties.name);
        return mainStreetNames.has(normalizedStreetName);
      });
    }
    if (zoneMode === "rues-celebres") {
      return allStreetFeatures2.filter((feature) => {
        const normalizedStreetName = normalizeName2(feature.properties && feature.properties.name);
        return famousStreetNames.has(normalizedStreetName);
      });
    }
    return allStreetFeatures2.filter(
      (feature) => {
        var _a;
        return !isExcludedFromVilleAndQuartier(normalizeName2((_a = feature == null ? void 0 : feature.properties) == null ? void 0 : _a.name));
      }
    );
  }
  function buildUniqueStreetList(features, normalizeName2) {
    const byNormalizedName = /* @__PURE__ */ new Map();
    features.forEach((feature) => {
      const rawStreetName = typeof feature.properties.name === "string" ? feature.properties.name.trim() : "";
      if (!rawStreetName) {
        return;
      }
      const normalizedStreetName = normalizeName2(rawStreetName);
      if (!byNormalizedName.has(normalizedStreetName)) {
        byNormalizedName.set(normalizedStreetName, feature);
      }
    });
    return Array.from(byNormalizedName.values());
  }
  function populateQuartiersUI({
    allStreetFeatures: allStreetFeatures2,
    arrondissementByQuartier: arrondissementByQuartier2,
    onQuartierChange
  }) {
    const nativeSelect = document.getElementById("quartier-select");
    const customList = document.getElementById("quartier-select-list");
    const customButton = document.getElementById("quartier-select-button");
    const customLabel = customButton ? customButton.querySelector(".custom-select-label") : null;
    if (!nativeSelect) {
      return;
    }
    const quartiersSet = /* @__PURE__ */ new Set();
    allStreetFeatures2.forEach((feature) => {
      const quartierName = (feature.properties || {}).quartier;
      if (typeof quartierName === "string" && quartierName.trim() !== "") {
        quartiersSet.add(quartierName.trim());
      }
    });
    const quartiers = Array.from(quartiersSet).sort(
      (left, right) => left.localeCompare(right, "fr", { sensitivity: "base" })
    );
    nativeSelect.innerHTML = "";
    quartiers.forEach((quartierName) => {
      const option = document.createElement("option");
      option.value = quartierName;
      option.textContent = quartierName;
      nativeSelect.appendChild(option);
    });
    if (customList) {
      customList.innerHTML = "";
      quartiers.forEach((quartierName) => {
        const item = document.createElement("li");
        item.dataset.value = quartierName;
        const text = document.createElement("span");
        text.textContent = quartierName;
        item.appendChild(text);
        const arrondissement = arrondissementByQuartier2.get(normalizeQuartierKey(quartierName));
        if (arrondissement) {
          const badge = document.createElement("span");
          badge.className = "difficulty-pill difficulty-pill--arrondissement";
          badge.textContent = arrondissement;
          item.appendChild(badge);
        }
        item.addEventListener("click", () => {
          if (customLabel) {
            customLabel.textContent = quartierName;
          }
          const badgeInItem = item.querySelector(".difficulty-pill");
          if (customButton) {
            const badgeInButton = customButton.querySelector(".difficulty-pill");
            if (badgeInItem) {
              const clone = badgeInItem.cloneNode(true);
              if (badgeInButton) {
                badgeInButton.replaceWith(clone);
              } else {
                customButton.appendChild(clone);
              }
            } else if (badgeInButton) {
              badgeInButton.remove();
            }
          }
          nativeSelect.value = quartierName;
          onQuartierChange();
          customList.classList.remove("visible");
        });
        customList.appendChild(item);
      });
    }
    if (quartiers.length > 0 && customButton) {
      const firstQuartier = quartiers[0];
      if (customLabel) {
        customLabel.textContent = firstQuartier;
      }
      const arrondissement = arrondissementByQuartier2.get(normalizeQuartierKey(firstQuartier));
      if (arrondissement) {
        const existingBadge = customButton.querySelector(".difficulty-pill");
        const badge = document.createElement("span");
        badge.className = "difficulty-pill difficulty-pill--arrondissement";
        badge.textContent = arrondissement;
        if (existingBadge) {
          existingBadge.replaceWith(badge);
        } else {
          customButton.appendChild(badge);
        }
      }
      nativeSelect.value = firstQuartier;
    }
  }
  async function loadQuartierPolygonsMap() {
    const response = await fetch("data/marseille_quartiers_111.geojson?v=2");
    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }
    const payload = await response.json();
    const features = payload.features || [];
    const byName = /* @__PURE__ */ new Map();
    features.forEach((feature) => {
      const properties = feature.properties || {};
      const quartierName = typeof properties.nom_qua === "string" ? properties.nom_qua.trim() : "";
      if (quartierName) {
        byName.set(quartierName, feature);
      }
    });
    return byName;
  }
  function clearQuartierOverlayLayer(map2, quartierOverlay2) {
    if (quartierOverlay2) {
      map2.removeLayer(quartierOverlay2);
    }
    return null;
  }
  function highlightQuartierOnMap({
    map: map2,
    L: L2,
    quartierName,
    quartierPolygonsByName: quartierPolygonsByName2,
    uiTheme,
    existingOverlay
  }) {
    let overlay = clearQuartierOverlayLayer(map2, existingOverlay);
    if (!quartierName) {
      return overlay;
    }
    const quartierFeature = quartierPolygonsByName2.get(quartierName);
    if (!quartierFeature) {
      console.warn("Aucun polygone trouv\xE9 pour le quartier :", quartierName);
      return overlay;
    }
    overlay = L2.geoJSON(quartierFeature, {
      style: { color: uiTheme.mapQuartier, weight: 2, fill: false },
      interactive: false
    }).addTo(map2);
    const bounds = overlay.getBounds();
    if (bounds && bounds.isValid && bounds.isValid()) {
      const fitOptions = window.innerWidth <= 900 ? { padding: [40, 40], maxZoom: 14 } : { padding: [40, 40] };
      map2.fitBounds(bounds, { ...fitOptions, animate: true, duration: 1.5 });
    }
    return overlay;
  }

  // src/map-runtime.js
  function addTouchBufferForLayerRuntime(layer, { isTouchDevice, map: map2, L: L2 }) {
    if (!isTouchDevice || !map2) {
      return;
    }
    const latLngs = layer.getLatLngs();
    if (!latLngs || latLngs.length === 0) {
      return;
    }
    const hitArea = L2.polyline(latLngs, {
      color: "#000000",
      weight: 30,
      opacity: 0,
      interactive: true
    });
    hitArea.on("click", (event) => {
      if (L2 && L2.DomEvent && L2.DomEvent.stop) {
        L2.DomEvent.stop(event);
      }
      layer.fire("click");
    });
    hitArea.on("mouseover", () => layer.fire("mouseover"));
    hitArea.on("mouseout", () => layer.fire("mouseout"));
    hitArea.addTo(map2);
    layer.touchBuffer = hitArea;
  }
  async function loadStreetsRuntime({
    map: map2,
    L: L2,
    uiTheme,
    normalizeName: normalizeName2,
    getBaseStreetStyle: getBaseStreetStyle3,
    isStreetVisibleInCurrentMode: isStreetVisibleInCurrentMode3,
    isLayerHighlighted,
    handleStreetClick: handleStreetClick2,
    addTouchBufferForLayer: addTouchBufferForLayer2
  }) {
    const startedAt = performance.now();
    const response = await fetch("data/marseille_rues_light.geojson?v=11");
    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }
    const payload = await response.json();
    const allStreetFeatures2 = payload.features || [];
    const streetLayersById2 = /* @__PURE__ */ new Map();
    const streetLayersByName2 = /* @__PURE__ */ new Map();
    let gameId = 0;
    const streetsLayer2 = L2.geoJSON(allStreetFeatures2, {
      style(feature) {
        return getBaseStreetStyle3(feature);
      },
      onEachFeature: (feature, layer) => {
        const normalizedStreetName = normalizeName2(feature.properties.name);
        feature._gameId = gameId++;
        streetLayersById2.set(feature._gameId, layer);
        layer.feature = feature;
        if (!streetLayersByName2.has(normalizedStreetName)) {
          streetLayersByName2.set(normalizedStreetName, []);
        }
        streetLayersByName2.get(normalizedStreetName).push(layer);
        addTouchBufferForLayer2(layer);
        let hoverTimeoutId = null;
        layer.on("mouseover", () => {
          clearTimeout(hoverTimeoutId);
          hoverTimeoutId = setTimeout(() => {
            const quartierName = feature.properties.quartier || null;
            if (!isStreetVisibleInCurrentMode3(normalizedStreetName, quartierName)) {
              return;
            }
            (streetLayersByName2.get(normalizedStreetName) || []).forEach((candidateLayer) => {
              candidateLayer.setStyle({ weight: 7, color: uiTheme.mapStreetHover });
            });
          }, 50);
        });
        layer.on("mouseout", () => {
          clearTimeout(hoverTimeoutId);
          hoverTimeoutId = setTimeout(() => {
            const quartierName = feature.properties.quartier || null;
            if (!isStreetVisibleInCurrentMode3(normalizedStreetName, quartierName)) {
              return;
            }
            (streetLayersByName2.get(normalizedStreetName) || []).forEach((candidateLayer) => {
              if (isLayerHighlighted(candidateLayer)) {
                return;
              }
              const baseStyle = getBaseStreetStyle3(candidateLayer);
              candidateLayer.setStyle({ weight: baseStyle.weight, color: baseStyle.color });
            });
          }, 50);
        });
        layer.on("click", (clickEvent) => {
          const quartierName = feature.properties.quartier || null;
          if (isStreetVisibleInCurrentMode3(normalizedStreetName, quartierName)) {
            handleStreetClick2(feature, layer, clickEvent);
          }
        });
      }
    }).addTo(map2);
    return {
      allStreetFeatures: allStreetFeatures2,
      streetLayersById: streetLayersById2,
      streetLayersByName: streetLayersByName2,
      streetsLayer: streetsLayer2,
      loadedMs: (performance.now() - startedAt).toFixed(0)
    };
  }
  async function loadMonumentsRuntime({
    map: map2,
    L: L2,
    uiTheme,
    isTouchDevice,
    handleMonumentClick: handleMonumentClick2
  }) {
    const response = await fetch("data/marseille_monuments.geojson?v=2");
    if (!response.ok) {
      throw new Error(`Impossible de charger les monuments (HTTP ${response.status}).`);
    }
    const payload = await response.json();
    const allMonuments2 = (payload.features || []).filter(
      (feature) => feature.geometry && feature.geometry.type === "Point" && feature.properties && typeof feature.properties.name === "string" && feature.properties.name.trim() !== ""
    );
    let monumentsLayer2 = L2.geoJSON(
      { type: "FeatureCollection", features: allMonuments2 },
      {
        renderer: L2.svg({ pane: "markerPane" }),
        pointToLayer: (feature, latlng) => {
          const marker = L2.circleMarker(latlng, {
            radius: 8,
            color: uiTheme.mapMonumentStroke,
            weight: 3,
            fillColor: uiTheme.mapMonumentFill,
            fillOpacity: 1,
            pane: "markerPane"
          });
          if (isTouchDevice) {
            marker._monumentFeature = feature;
          }
          return marker;
        },
        onEachFeature: (feature, layer) => {
          layer.on("click", () => handleMonumentClick2(feature, layer));
        }
      }
    );
    if (isTouchDevice && monumentsLayer2) {
      monumentsLayer2.eachLayer((layer) => {
        const feature = layer._monumentFeature;
        if (!feature) {
          return;
        }
        const latlng = layer.getLatLng();
        const hitArea = L2.circleMarker(latlng, {
          radius: 18,
          fillOpacity: 0,
          opacity: 0,
          pane: "markerPane"
        });
        hitArea.on("click", () => handleMonumentClick2(feature, layer));
        hitArea._visibleMarker = layer;
        hitArea._isHitArea = true;
        monumentsLayer2.addLayer(hitArea);
      });
    }
    return { allMonuments: allMonuments2, monumentsLayer: monumentsLayer2 };
  }
  function setLectureTooltipsEnabledRuntime(enabled, {
    streetsLayer: streetsLayer2,
    monumentsLayer: monumentsLayer2,
    getBaseStreetStyle: getBaseStreetStyle3,
    isTouchDevice
  }) {
    function unbindLectureTap(layer) {
      if (layer.__lectureTapTooltipBound) {
        if (layer.__lectureTapTooltipFn) {
          layer.off("click", layer.__lectureTapTooltipFn);
        }
        layer.__lectureTapTooltipBound = false;
        layer.__lectureTapTooltipFn = null;
      }
    }
    if (streetsLayer2) {
      streetsLayer2.eachLayer((layer) => {
        var _a, _b;
        const streetName = ((_b = (_a = layer.feature) == null ? void 0 : _a.properties) == null ? void 0 : _b.name) || "";
        if (!streetName) {
          return;
        }
        if (enabled) {
          if (getBaseStreetStyle3(layer).weight > 0) {
            if (!layer.getTooltip()) {
              layer.bindTooltip(streetName, {
                direction: "top",
                sticky: !isTouchDevice,
                opacity: 0.9,
                className: "street-tooltip"
              });
            }
            if (isTouchDevice && !layer.__lectureTapTooltipBound) {
              layer.__lectureTapTooltipBound = true;
              layer.on(
                "click",
                layer.__lectureTapTooltipFn = () => {
                  if (layer.getTooltip()) {
                    layer.openTooltip();
                  }
                  if (streetsLayer2) {
                    streetsLayer2.eachLayer((candidateLayer) => {
                      if (candidateLayer !== layer && candidateLayer.getTooltip && candidateLayer.getTooltip()) {
                        candidateLayer.closeTooltip();
                      }
                    });
                  }
                  if (monumentsLayer2) {
                    monumentsLayer2.eachLayer((candidateLayer) => {
                      if (candidateLayer !== layer && candidateLayer.getTooltip && candidateLayer.getTooltip()) {
                        candidateLayer.closeTooltip();
                      }
                    });
                  }
                }
              );
            }
          } else {
            if (layer.getTooltip()) {
              layer.unbindTooltip();
            }
            unbindLectureTap(layer);
          }
        } else {
          unbindLectureTap(layer);
          if (layer.getTooltip()) {
            layer.closeTooltip();
            layer.unbindTooltip();
          }
        }
      });
    }
    if (monumentsLayer2) {
      monumentsLayer2.eachLayer((layer) => {
        var _a, _b;
        if (layer._isHitArea) {
          if (enabled && isTouchDevice && !layer.__hitAreaTooltipBound) {
            layer.__hitAreaTooltipBound = true;
            layer.on("click", () => {
              const visibleMarker = layer._visibleMarker;
              if (!visibleMarker || !visibleMarker.getTooltip()) {
                return;
              }
              monumentsLayer2.eachLayer((candidateLayer) => {
                if (candidateLayer !== visibleMarker && candidateLayer.getTooltip && candidateLayer.getTooltip()) {
                  candidateLayer.closeTooltip();
                }
              });
              visibleMarker.toggleTooltip();
            });
          } else if (!enabled) {
            layer.__hitAreaTooltipBound = false;
          }
          return;
        }
        const monumentName = ((_b = (_a = layer.feature) == null ? void 0 : _a.properties) == null ? void 0 : _b.name) || "";
        if (!monumentName) {
          return;
        }
        if (enabled) {
          if (!layer.getTooltip()) {
            layer.bindTooltip(monumentName, {
              direction: "top",
              sticky: false,
              permanent: false,
              opacity: 0.9,
              className: "monument-tooltip"
            });
          }
          if (isTouchDevice && !layer.__monumentTapBound) {
            layer.__monumentTapBound = true;
            layer.on("click", () => {
              monumentsLayer2.eachLayer((candidateLayer) => {
                if (candidateLayer !== layer && candidateLayer.getTooltip && candidateLayer.getTooltip()) {
                  candidateLayer.closeTooltip();
                }
              });
              if (layer.getTooltip()) {
                layer.toggleTooltip();
              }
            });
          }
        } else {
          if (layer.__monumentTapBound) {
            layer.__monumentTapBound = false;
          }
          if (layer.getTooltip()) {
            layer.closeTooltip();
            layer.unbindTooltip();
          }
        }
      });
    }
  }

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
  var VISITOR_COUNT_CACHE_KEY = "camino_visits_cache";
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
  function updateVisitorCounterLabel(visits) {
    const counter = document.getElementById("visitor-counter");
    if (!counter || !Number.isFinite(visits) || visits < 0) {
      return;
    }
    counter.textContent = `Visites : ${new Intl.NumberFormat("fr-FR").format(Math.trunc(visits))}`;
  }
  function readCachedVisitCount() {
    try {
      const raw = localStorage.getItem(VISITOR_COUNT_CACHE_KEY);
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0) {
        return Math.trunc(value);
      }
    } catch (error) {
    }
    return null;
  }
  function writeCachedVisitCount(visits) {
    if (!Number.isFinite(visits) || visits < 0) {
      return;
    }
    try {
      localStorage.setItem(VISITOR_COUNT_CACHE_KEY, String(Math.trunc(visits)));
    } catch (error) {
    }
  }
  function parseVisitsPayload(payload) {
    var _a;
    const visits = Number((_a = payload == null ? void 0 : payload.visits) != null ? _a : payload == null ? void 0 : payload.uniqueVisitors);
    if (!Number.isFinite(visits) || visits < 0) {
      return null;
    }
    return visits;
  }
  async function fetchVisits(url, options) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        return null;
      }
      const payload = await response.json();
      return parseVisitsPayload(payload);
    } catch (error) {
      return null;
    }
  }
  async function loadUniqueVisitorCounter() {
    const counter = document.getElementById("visitor-counter");
    if (!counter) {
      return;
    }
    const cachedVisits = readCachedVisitCount();
    if (cachedVisits !== null) {
      updateVisitorCounterLabel(cachedVisits);
    }
    const visitorId = getOrCreateVisitorId();
    if (!visitorId) {
      const fallbackCount2 = await fetchVisits(`${API_URL}/api/visitors/count`);
      if (fallbackCount2 !== null) {
        updateVisitorCounterLabel(fallbackCount2);
        writeCachedVisitCount(fallbackCount2);
      }
      return;
    }
    const postHitVisits = await fetchVisits(`${API_URL}/api/visitors/hit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId })
    });
    if (postHitVisits !== null) {
      updateVisitorCounterLabel(postHitVisits);
      writeCachedVisitCount(postHitVisits);
      return;
    }
    const getHitVisits = await fetchVisits(
      `${API_URL}/api/visitors/hit?visitorId=${encodeURIComponent(visitorId)}`
    );
    if (getHitVisits !== null) {
      updateVisitorCounterLabel(getHitVisits);
      writeCachedVisitCount(getHitVisits);
      return;
    }
    const fallbackCount = await fetchVisits(`${API_URL}/api/visitors/count`);
    if (fallbackCount !== null) {
      updateVisitorCounterLabel(fallbackCount);
      writeCachedVisitCount(fallbackCount);
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

  // src/install-prompt.js
  var INSTALL_BANNER_SEEN_KEY = "camino_install_banner_seen";
  var INSTALL_BANNER_REMIND_AT_KEY = "camino_install_banner_remind_at";
  var LATER_REMIND_DELAY_MS = 7 * 24 * 60 * 60 * 1e3;
  var IOS_SHEET_REMIND_DELAY_MS = 3 * 24 * 60 * 60 * 1e3;
  var INSTALLED_REMIND_DELAY_MS = 30 * 24 * 60 * 60 * 1e3;
  var MOBILE_WIDTH_QUERY = "(max-width: 900px)";
  var COARSE_POINTER_QUERY = "(pointer: coarse)";
  var deferredInstallPromptEvent = null;
  var installPromptInitialized = false;
  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }
  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
    }
  }
  function removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
    }
  }
  function readReminderTimestamp() {
    const raw = readStorage(INSTALL_BANNER_REMIND_AT_KEY);
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }
    return Math.trunc(value);
  }
  function scheduleReminder(delayMs) {
    writeStorage(INSTALL_BANNER_REMIND_AT_KEY, String(Date.now() + delayMs));
  }
  function clearReminder() {
    removeStorage(INSTALL_BANNER_REMIND_AT_KEY);
  }
  function setHidden(element, shouldHide) {
    if (!element) {
      return;
    }
    element.classList.toggle("hidden", shouldHide);
  }
  function setIosSheetVisibility(show) {
    const sheet = document.getElementById("install-ios-sheet");
    if (!sheet) {
      return;
    }
    setHidden(sheet, !show);
    sheet.setAttribute("aria-hidden", show ? "false" : "true");
  }
  function isStandaloneDisplayMode(isStandaloneDisplayModeFn) {
    if (typeof isStandaloneDisplayModeFn !== "function") {
      return false;
    }
    try {
      return !!isStandaloneDisplayModeFn();
    } catch (error) {
      return false;
    }
  }
  function isIOSDevice() {
    const ua = window.navigator.userAgent || "";
    const platform = window.navigator.platform || "";
    const iPhoneOrIPad = /iPad|iPhone|iPod/i.test(ua);
    const ipadOnDesktop = platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
    return iPhoneOrIPad || ipadOnDesktop;
  }
  function isIOSSafari() {
    if (!isIOSDevice()) {
      return false;
    }
    const ua = window.navigator.userAgent || "";
    const isSafari = /Safari/i.test(ua);
    const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/i.test(ua);
    return isSafari && !isOtherIOSBrowser;
  }
  function isAndroidDevice() {
    return /Android/i.test(window.navigator.userAgent || "");
  }
  function isMobileWebContext() {
    const widthMatches = typeof window.matchMedia === "function" ? window.matchMedia(MOBILE_WIDTH_QUERY).matches : window.innerWidth <= 900;
    const coarsePointer = typeof window.matchMedia === "function" ? window.matchMedia(COARSE_POINTER_QUERY).matches : "ontouchstart" in window || window.navigator.maxTouchPoints > 0;
    return widthMatches && coarsePointer;
  }
  function isInstallSupportedForCurrentDevice() {
    return Boolean(deferredInstallPromptEvent) || isIOSSafari() || isAndroidDevice();
  }
  function isInstalled(isStandaloneDisplayModeFn) {
    return isStandaloneDisplayMode(isStandaloneDisplayModeFn);
  }
  function showBannerIfEligible(isStandaloneDisplayModeFn) {
    const banner = document.getElementById("install-banner");
    const sticky = document.getElementById("install-sticky-btn");
    if (!banner || !sticky) {
      return;
    }
    const installed = isInstalled(isStandaloneDisplayModeFn);
    const eligibleContext = isMobileWebContext() && !installed;
    const canInstall = eligibleContext && isInstallSupportedForCurrentDevice();
    setHidden(sticky, !canInstall);
    if (!canInstall) {
      setHidden(banner, true);
      setIosSheetVisibility(false);
      return;
    }
    const hasSeenBanner = readStorage(INSTALL_BANNER_SEEN_KEY) === "1";
    const reminderAt = readReminderTimestamp();
    const reminderDue = reminderAt > 0 && Date.now() >= reminderAt;
    let showBanner = false;
    if (!hasSeenBanner) {
      showBanner = true;
      writeStorage(INSTALL_BANNER_SEEN_KEY, "1");
    } else if (reminderDue) {
      showBanner = true;
      clearReminder();
    }
    setHidden(banner, !showBanner);
  }
  function hideInstallBanner() {
    const banner = document.getElementById("install-banner");
    setHidden(banner, true);
  }
  async function handleInstallAction({ isStandaloneDisplayModeFn, showMessage: showMessage2 }) {
    if (isInstalled(isStandaloneDisplayModeFn)) {
      showBannerIfEligible(isStandaloneDisplayModeFn);
      return;
    }
    if (deferredInstallPromptEvent) {
      const promptEvent = deferredInstallPromptEvent;
      deferredInstallPromptEvent = null;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if ((choice == null ? void 0 : choice.outcome) === "dismissed") {
          scheduleReminder(LATER_REMIND_DELAY_MS);
        } else if ((choice == null ? void 0 : choice.outcome) === "accepted") {
          scheduleReminder(INSTALLED_REMIND_DELAY_MS);
        }
        hideInstallBanner();
      } catch (error) {
      }
      showBannerIfEligible(isStandaloneDisplayModeFn);
      return;
    }
    if (isIOSSafari()) {
      setIosSheetVisibility(true);
      return;
    }
    if (isAndroidDevice()) {
      if (typeof showMessage2 === "function") {
        showMessage2(
          "Sur Android: menu du navigateur (\u22EE) puis \u201CInstaller l\u2019application\u201D ou \u201CAjouter \xE0 l\u2019\xE9cran d\u2019accueil\u201D.",
          "info"
        );
      }
      return;
    }
    if (typeof showMessage2 === "function") {
      showMessage2(
        "Pour installer, ouvrez le menu du navigateur puis choisissez \u201CInstaller l\u2019application\u201D.",
        "info"
      );
    }
  }
  function initInstallPrompt({ isStandaloneDisplayModeFn, showMessage: showMessage2 } = {}) {
    if (!installPromptInitialized) {
      installPromptInitialized = true;
      const installBannerActionButton = document.getElementById("install-banner-action");
      const installBannerLaterButton = document.getElementById("install-banner-later");
      const installStickyButton = document.getElementById("install-sticky-btn");
      const installIosCloseButton = document.getElementById("install-ios-close");
      const installIosBackdrop = document.getElementById("install-ios-backdrop");
      const refreshUI = () => showBannerIfEligible(isStandaloneDisplayModeFn);
      const onInstallClick = () => handleInstallAction({ isStandaloneDisplayModeFn, showMessage: showMessage2 });
      installBannerActionButton && installBannerActionButton.addEventListener("click", onInstallClick);
      installStickyButton && installStickyButton.addEventListener("click", onInstallClick);
      installBannerLaterButton && installBannerLaterButton.addEventListener("click", () => {
        scheduleReminder(LATER_REMIND_DELAY_MS);
        hideInstallBanner();
      });
      const closeIosSheetWithCooldown = () => {
        scheduleReminder(IOS_SHEET_REMIND_DELAY_MS);
        hideInstallBanner();
        setIosSheetVisibility(false);
      };
      installIosCloseButton && installIosCloseButton.addEventListener("click", closeIosSheetWithCooldown);
      installIosBackdrop && installIosBackdrop.addEventListener("click", closeIosSheetWithCooldown);
      window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPromptEvent = event;
        refreshUI();
      });
      window.addEventListener("appinstalled", () => {
        deferredInstallPromptEvent = null;
        scheduleReminder(INSTALLED_REMIND_DELAY_MS);
        hideInstallBanner();
        setIosSheetVisibility(false);
        refreshUI();
      });
      window.addEventListener("resize", refreshUI, { passive: true });
      window.addEventListener("orientationchange", refreshUI);
    }
    showBannerIfEligible(isStandaloneDisplayModeFn);
  }

  // src/daily.js
  function getTodayDailyStorageDate() {
    return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  }
  function getDailyGuessesStorageKey(date) {
    return `${DAILY_GUESSES_STORAGE_PREFIX}${date}`;
  }
  function getDailyMetaStorageKey(date) {
    return `${DAILY_META_STORAGE_PREFIX}${date}`;
  }
  function formatDailyDistanceForShare(distanceMeters) {
    return distanceMeters >= 1e3 ? `${(distanceMeters / 1e3).toFixed(1)} km` : `${Math.round(distanceMeters)} m`;
  }
  function getDailyShareDateLabelFromDate(dailyDate) {
    let date = null;
    if (typeof dailyDate === "string") {
      const parsed = /* @__PURE__ */ new Date(`${dailyDate}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
    if (!date) {
      date = /* @__PURE__ */ new Date();
    }
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }
  function getDirectionArrow(fromCoords, targetCoords) {
    const dLon = targetCoords[0] - fromCoords[0];
    const dLat = targetCoords[1] - fromCoords[1];
    const angle = (180 * Math.atan2(dLon, dLat) / Math.PI % 360 + 360) % 360;
    return ["\u2B06\uFE0F", "\u2197\uFE0F", "\u27A1\uFE0F", "\u2198\uFE0F", "\u2B07\uFE0F", "\u2199\uFE0F", "\u2B05\uFE0F", "\u2196\uFE0F"][Math.round(angle / 45) % 8];
  }

  // src/session-share.js
  function chunk(items, size) {
    if (!Array.isArray(items) || items.length === 0 || size <= 0) {
      return [];
    }
    const rows = [];
    for (let i = 0; i < items.length; i += size) {
      rows.push(items.slice(i, i + size));
    }
    return rows;
  }
  function buildSessionEmojiGrid(summaryData2, {
    columns = 5,
    correctEmoji = "\u{1F7E9}",
    wrongEmoji = "\u{1F7E5}",
    emptyEmoji = "\u2B1C"
  } = {}) {
    if (!Array.isArray(summaryData2) || summaryData2.length === 0) {
      return emptyEmoji;
    }
    const cells = summaryData2.map((item) => item && item.correct ? correctEmoji : wrongEmoji);
    return chunk(cells, columns).map((row) => row.join("")).join("\n");
  }
  function getSessionResultLine({
    gameMode,
    scorePercent,
    correctCount: correctCount2,
    answeredCount,
    sessionScoreValue,
    poolSize
  }) {
    if (gameMode === "marathon") {
      return `\u{1F3AF} R\xE9sultat : ${Math.round(sessionScoreValue)} / ${poolSize || 0} rues trouv\xE9es`;
    }
    if (gameMode === "chrono") {
      return `\u{1F3AF} R\xE9sultat : ${Math.round(sessionScoreValue)} rues trouv\xE9es en 60 s`;
    }
    return `\u{1F3AF} R\xE9sultat : ${scorePercent}% (${correctCount2}/${answeredCount}) \u2022 ${sessionScoreValue.toFixed(1)} pts`;
  }
  function buildSessionShareText({
    summaryData: summaryData2,
    gameMode,
    zoneMode,
    quartierName,
    totalTimeSec,
    averageTimeSec,
    scorePercent,
    correctCount: correctCount2,
    answeredCount,
    sessionScoreValue,
    poolSize,
    gameLabels,
    zoneLabels,
    now = /* @__PURE__ */ new Date(),
    host = "camino-ajm.pages.dev"
  }) {
    const modeLabel = gameLabels[gameMode] || gameMode;
    const zoneLabel = zoneLabels[zoneMode] || zoneMode;
    const dateLabel = new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(now);
    let header = `\u{1F5FA}\uFE0F Camino \u2014 ${dateLabel}`;
    header += `
\u{1F9E9} ${modeLabel} \u2022 ${zoneLabel}`;
    if (quartierName) {
      header += ` (${quartierName})`;
    }
    const resultLine = getSessionResultLine({
      gameMode,
      scorePercent,
      correctCount: correctCount2,
      answeredCount,
      sessionScoreValue,
      poolSize
    });
    const timeLine = `\u23F1\uFE0F Temps : ${totalTimeSec.toFixed(1)} s (moyenne ${averageTimeSec.toFixed(1)} s)`;
    const grid = buildSessionEmojiGrid(summaryData2);
    return `${header}
${resultLine}
${timeLine}

${grid}

Essaie de faire mieux sur ${host}`;
  }
  async function copySessionShareText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
      }
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch (error) {
      return false;
    }
  }
  async function shareSessionShareText(text) {
    if (!navigator.share) {
      return false;
    }
    try {
      await navigator.share({
        title: "Camino - R\xE9sultat de session",
        text
      });
      return true;
    } catch (error) {
      if (error && error.name === "AbortError") {
        return null;
      }
      return false;
    }
  }

  // src/daily-runtime.js
  function saveDailyMetaToStorageRuntime(dailyTargetData2, getDailyMetaStorageKey2) {
    if (dailyTargetData2 && dailyTargetData2.date) {
      try {
        localStorage.setItem(
          getDailyMetaStorageKey2(dailyTargetData2.date),
          JSON.stringify({
            date: dailyTargetData2.date,
            streetName: dailyTargetData2.streetName || "",
            quartier: dailyTargetData2.quartier || ""
          })
        );
      } catch (error) {
      }
    }
  }
  function saveDailyGuessesToStorageRuntime({
    dailyTargetData: dailyTargetData2,
    dailyGuessHistory: dailyGuessHistory2,
    getDailyGuessesStorageKey: getDailyGuessesStorageKey2,
    getDailyMetaStorageKey: getDailyMetaStorageKey2
  }) {
    if (dailyTargetData2 && dailyTargetData2.date) {
      try {
        const storageKey = getDailyGuessesStorageKey2(dailyTargetData2.date);
        localStorage.setItem(storageKey, JSON.stringify(dailyGuessHistory2));
        saveDailyMetaToStorageRuntime(dailyTargetData2, getDailyMetaStorageKey2);
      } catch (error) {
      }
    }
  }
  function restoreDailyGuessesFromStorageRuntime(dailyDate, getDailyGuessesStorageKey2) {
    try {
      const storageKey = getDailyGuessesStorageKey2(dailyDate);
      const rawValue = localStorage.getItem(storageKey);
      if (!rawValue) {
        return [];
      }
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  function cleanOldDailyGuessStorageRuntime(dailyDate, {
    getDailyGuessesStorageKey: getDailyGuessesStorageKey2,
    getDailyMetaStorageKey: getDailyMetaStorageKey2
  }) {
    try {
      const guessesPrefix = getDailyGuessesStorageKey2("");
      const metaPrefix = getDailyMetaStorageKey2("");
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(guessesPrefix) && !key.endsWith(dailyDate)) {
          localStorage.removeItem(key);
        }
        if (key && key.startsWith(metaPrefix) && !key.endsWith(dailyDate)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
    }
  }
  function restoreDailyMetaFromStorageRuntime(dailyDate, dailyTargetData2, getDailyMetaStorageKey2) {
    if (!dailyDate) {
      return null;
    }
    try {
      const rawValue = localStorage.getItem(getDailyMetaStorageKey2(dailyDate));
      if (!rawValue) {
        return null;
      }
      const parsed = JSON.parse(rawValue);
      if (!parsed || !parsed.streetName) {
        return null;
      }
      return {
        ...dailyTargetData2 || {},
        date: dailyDate,
        streetName: parsed.streetName,
        quartier: parsed.quartier || (dailyTargetData2 == null ? void 0 : dailyTargetData2.quartier) || ""
      };
    } catch (error) {
      return null;
    }
  }
  function removeDailyHighlightRuntime(map2, dailyHighlightLayer2) {
    if (dailyHighlightLayer2 && map2) {
      map2.removeLayer(dailyHighlightLayer2);
    }
    return null;
  }
  function highlightDailyTargetRuntime({
    targetGeometry,
    isSuccess,
    map: map2,
    L: L2,
    uiTheme,
    dailyHighlightLayer: dailyHighlightLayer2
  }) {
    let nextLayer = removeDailyHighlightRuntime(map2, dailyHighlightLayer2);
    if (!targetGeometry || !map2) {
      return nextLayer;
    }
    let geometry;
    try {
      geometry = typeof targetGeometry === "string" ? JSON.parse(targetGeometry) : targetGeometry;
    } catch (error) {
      console.error("Invalid target geometry:", error);
      return nextLayer;
    }
    const color = isSuccess ? uiTheme.mapCorrect : uiTheme.mapWrong;
    nextLayer = L2.geoJSON(
      { type: "Feature", geometry, properties: {} },
      {
        style: { color, weight: 6, opacity: 1, dashArray: isSuccess ? null : "8, 4" }
      }
    ).addTo(map2);
    try {
      if (nextLayer && Object.keys(nextLayer._layers).length > 0) {
        const bounds = nextLayer.getBounds();
        if (bounds && bounds.isValid()) {
          map2.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 16,
            animate: true,
            duration: 1.5
          });
        }
      }
    } catch (error) {
      console.error("Could not fit logic bounds", error);
    }
    return nextLayer;
  }
  function renderDailyGuessHistoryRuntime({
    dailyGuessHistory: dailyGuessHistory2,
    finalStatus,
    dailyTargetData: dailyTargetData2,
    normalizeQuartierKey: normalizeQuartierKey2,
    arrondissementByQuartier: arrondissementByQuartier2,
    calculateStreetLengthFromFeatures: calculateStreetLengthFromFeatures2,
    allStreetFeatures: allStreetFeatures2,
    normalizeName: normalizeName2
  }) {
    try {
      const historyRoot = document.getElementById("daily-guesses-history");
      if (!historyRoot) {
        return;
      }
      if (!(dailyGuessHistory2.length !== 0 || finalStatus && finalStatus.success)) {
        historyRoot.style.display = "none";
        historyRoot.innerHTML = "";
        return;
      }
      historyRoot.style.display = "block";
      let html = "";
      if (dailyGuessHistory2.length > 0) {
        html += '<div class="daily-history-title">Essais pr\xE9c\xE9dents</div>';
        html += '<table class="daily-history-table">';
        html += "<thead><tr><th>#</th><th>Rue tent\xE9e</th><th>Distance</th><th></th></tr></thead>";
        html += "<tbody>";
        dailyGuessHistory2.forEach((guess, index) => {
          const distanceLabel = guess.distance >= 1e3 ? `${(guess.distance / 1e3).toFixed(1)} km` : `${Math.round(guess.distance)} m`;
          const isLastAnimatedRow = index === dailyGuessHistory2.length - 1 && !finalStatus;
          let distanceClass = "dist-cold";
          if (guess.distance < 500) {
            distanceClass = "dist-hot";
          } else if (guess.distance < 2e3) {
            distanceClass = "dist-warm";
          }
          html += `<tr class="${isLastAnimatedRow ? "daily-row-enter" : ""}">`;
          html += `<td>${index + 1}</td>`;
          html += `<td>${guess.streetName}</td>`;
          html += `<td class="${distanceClass}">${distanceLabel}</td>`;
          html += `<td class="daily-arrow">${guess.arrow || ""}</td>`;
          html += "</tr>";
        });
        html += "</tbody></table>";
      }
      const guessCount = dailyGuessHistory2.length;
      if (guessCount >= 2 && dailyTargetData2 && !finalStatus) {
        html += '<div class="daily-hints">';
        html += '<div class="daily-hints-title">\u{1F4A1} Indices</div>';
        const quartierName = dailyTargetData2.quartier || "";
        try {
          const normalizedQuartier = normalizeQuartierKey2(quartierName);
          if (arrondissementByQuartier2 && arrondissementByQuartier2.has(normalizedQuartier)) {
            const arrondissement = arrondissementByQuartier2.get(normalizedQuartier);
            if (arrondissement) {
              html += `<div class="daily-hint">\u{1F4CD} Arrondissement : <strong>${arrondissement}</strong></div>`;
            }
          }
        } catch (error) {
          console.error("Error with Hint 1:", error);
        }
        if (guessCount >= 4 && quartierName) {
          html += `<div class="daily-hint">\u{1F3D8}\uFE0F Quartier : <strong>${quartierName}</strong></div>`;
        }
        if (guessCount >= 6 && dailyTargetData2.streetName) {
          try {
            const lengthMeters = calculateStreetLengthFromFeatures2(
              dailyTargetData2.streetName,
              allStreetFeatures2,
              normalizeName2
            );
            if (lengthMeters > 0) {
              const lengthLabel = lengthMeters >= 1e3 ? `${(lengthMeters / 1e3).toFixed(1)} km` : `${Math.round(lengthMeters)} m`;
              html += `<div class="daily-hint">\u{1F4CF} Longueur : <strong>~ ${lengthLabel}</strong></div>`;
            }
          } catch (error) {
            console.error("Error with Hint 3:", error);
          }
        }
        html += "</div>";
      }
      historyRoot.innerHTML = html;
      const targetPanel = document.querySelector(".target-panel");
      if (targetPanel) {
        requestAnimationFrame(() => {
          targetPanel.scrollTop = targetPanel.scrollHeight;
        });
      }
    } catch (error) {
      console.error("Error in renderDailyGuessHistory:", error);
    }
  }
  function updateDailyUIRuntime({
    isDailyMode: isDailyMode2,
    dailyTargetData: dailyTargetData2,
    dailyGuessHistory: dailyGuessHistory2
  }) {
    const userStatus = dailyTargetData2 ? dailyTargetData2.userStatus : {};
    const attempts = Math.max(dailyGuessHistory2.length, userStatus.attempts_count || 0);
    const remaining = 7 - attempts;
    if (isDailyMode2) {
      const targetPanelTitle = document.getElementById("target-panel-title");
      if (targetPanelTitle) {
        if (userStatus.success) {
          targetPanelTitle.textContent = "\u{1F389} D\xE9fi r\xE9ussi !";
        } else {
          targetPanelTitle.textContent = remaining <= 0 ? "\u274C D\xE9fi \xE9chou\xE9" : `\u{1F3AF} D\xE9fi quotidien \u2014 ${remaining} essai${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`;
        }
      }
    }
    const triesCounter = document.getElementById("daily-tries-counter");
    if (triesCounter) {
      if (isDailyMode2) {
        triesCounter.style.display = "flex";
        triesCounter.innerHTML = `<span>\u{1F3AF}</span> ${attempts} / 7 essais`;
      } else {
        triesCounter.style.display = "none";
      }
    }
  }
  function handleDailyShareTextRuntime({
    result,
    dailyTargetData: dailyTargetData2,
    dailyGuessHistory: dailyGuessHistory2,
    getDailyShareDateLabel,
    formatDailyDistanceForShare: formatDailyDistanceForShare2,
    showMessage: showMessage2
  }) {
    if (!dailyTargetData2) {
      return;
    }
    const scoreLabel = result.success ? result.attempts : "X";
    const dateLabel = getDailyShareDateLabel(dailyTargetData2 == null ? void 0 : dailyTargetData2.date);
    const streetName = dailyTargetData2.streetName || "Rue inconnue";
    const minDistance = dailyGuessHistory2.length > 0 ? Math.min(...dailyGuessHistory2.map((guess) => guess.distance)) : null;
    let text = `\u{1F5FA}\uFE0F Camino Daily \u2014 ${dateLabel}
\u{1F4CD} Rue: ${streetName}
${result.success ? "\u2705" : "\u274C"} R\xE9sultat: ${scoreLabel}/7

`;
    if (dailyGuessHistory2.length > 0) {
      dailyGuessHistory2.forEach((guess, index) => {
        if (result.success && index === dailyGuessHistory2.length - 1) {
          text += "\u{1F7E9} \u{1F3C1}\n";
          return;
        }
        let tile = "\u{1F7E5}";
        if (guess.distance < 500) {
          tile = "\u{1F7E9}";
        } else if (guess.distance < 2e3) {
          tile = "\u{1F7E8}";
        }
        text += `${tile} ${guess.arrow || "\u2022"}
`;
      });
    } else {
      text += "Aucun essai enregistr\xE9.\n";
    }
    if (minDistance !== null && Number.isFinite(minDistance)) {
      text += `
\u{1F3AF} Meilleure distance: ${formatDailyDistanceForShare2(minDistance)}
`;
    }
    text += "Essaie de faire mieux sur camino-ajm.pages.dev";
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        showMessage2("Texte copi\xE9 !", "success");
      }).catch(() => showMessage2("Erreur lors de la copie", "error"));
      return;
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      showMessage2("Texte copi\xE9 !", "success");
    } catch (error) {
      showMessage2("Impossible de copier", "error");
    }
  }
  function handleDailyShareImageRuntime({
    result,
    dailyTargetData: dailyTargetData2,
    dailyGuessHistory: dailyGuessHistory2,
    getDailyShareDateLabel,
    formatDailyDistanceForShare: formatDailyDistanceForShare2,
    showMessage: showMessage2
  }) {
    if (!dailyTargetData2) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      showMessage2("Erreur lors de la g\xE9n\xE9ration", "error");
      return;
    }
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const resultLabel = result.success ? result.attempts : "X";
    const streetName = dailyTargetData2.streetName || "Rue inconnue";
    const dateLabel = getDailyShareDateLabel(dailyTargetData2 == null ? void 0 : dailyTargetData2.date);
    const minDistance = dailyGuessHistory2.length > 0 ? Math.min(...dailyGuessHistory2.map((guess) => guess.distance)) : null;
    const bestDistanceLabel = minDistance !== null && Number.isFinite(minDistance) ? formatDailyDistanceForShare2(minDistance) : "\u2014";
    function drawWrappedCenterText(text, center, context, maxWidth, startY, lineHeight, maxLines) {
      const lines = [];
      const words = String(text).split(/\s+/);
      let currentLine = "";
      words.forEach((word) => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (context.measureText(testLine).width <= maxWidth || !currentLine) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) {
        lines.push(currentLine);
      }
      const drawCount = Math.min(lines.length, maxLines);
      for (let i = 0; i < drawCount; i++) {
        let line = lines[i];
        if (i === maxLines - 1 && lines.length > maxLines) {
          line += "\u2026";
        }
        context.fillText(line, center, startY + i * lineHeight);
      }
      return drawCount;
    }
    const topGradient = ctx.createLinearGradient(0, 0, 0, height);
    topGradient.addColorStop(0, "#f8dca5");
    topGradient.addColorStop(0.35, "#f2a900");
    topGradient.addColorStop(0.68, "#4057b2");
    topGradient.addColorStop(1, "#12297a");
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, width, height);
    const horizonY = height * 0.47;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#fff5cc";
    ctx.beginPath();
    ctx.arc(200, 190, 110, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    const seaGradient = ctx.createLinearGradient(0, horizonY, 0, height);
    seaGradient.addColorStop(0, "rgba(18,41,122,0.85)");
    seaGradient.addColorStop(1, "rgba(12,29,87,0.95)");
    ctx.fillStyle = seaGradient;
    ctx.fillRect(0, horizonY, width, height - horizonY);
    ctx.fillStyle = "rgba(10,23,69,0.55)";
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 30);
    ctx.lineTo(120, horizonY + 8);
    ctx.lineTo(220, horizonY - 22);
    ctx.lineTo(340, horizonY + 18);
    ctx.lineTo(470, horizonY - 8);
    ctx.lineTo(600, horizonY + 26);
    ctx.lineTo(760, horizonY - 3);
    ctx.lineTo(910, horizonY + 20);
    ctx.lineTo(1080, horizonY + 5);
    ctx.lineTo(1080, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = horizonY + 120 + 50 * i;
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.bezierCurveTo(220, y - 18, 380, y + 20, 560, y);
      ctx.bezierCurveTo(730, y - 20, 910, y + 18, 1e3, y);
      ctx.stroke();
    }
    const panel = { x: 60, y: 60, w: width - 120, h: height - 120 };
    ctx.fillStyle = "rgba(2, 6, 23, 0.68)";
    ctx.beginPath();
    ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 36);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#f8fafc";
    ctx.font = '700 66px "Montserrat", "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText("CAMINO DAILY", centerX, 170);
    ctx.fillStyle = "rgba(226,232,240,0.95)";
    ctx.font = '500 32px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(`D\xE9fi du ${dateLabel}`, centerX, 220);
    ctx.fillStyle = "#fde68a";
    ctx.font = '600 32px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText("Rue du jour", centerX, 280);
    ctx.fillStyle = "#ffffff";
    ctx.font = '700 42px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
    drawWrappedCenterText(streetName, centerX, ctx, 820, 338, 54, 2);
    const scoreCard = { x: centerX - 150, y: 410, w: 300, h: 170 };
    ctx.fillStyle = result.success ? "#1f9d66" : "#d2463c";
    ctx.beginPath();
    ctx.roundRect(scoreCard.x, scoreCard.y, scoreCard.w, scoreCard.h, 28);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = '700 82px "Montserrat", "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(`${resultLabel}/7`, centerX, scoreCard.y + 98);
    ctx.font = '600 28px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText(result.success ? "D\xE9fi r\xE9ussi" : "D\xE9fi non r\xE9solu", centerX, scoreCard.y + 140);
    const rowX = panel.x + 70;
    const rowWidth = panel.w - 140;
    const rowHeight = 74;
    const rowsStartY = 610;
    if (dailyGuessHistory2.length > 0) {
      dailyGuessHistory2.slice(0, 7).forEach((guess, index) => {
        const rowY = rowsStartY + index * (rowHeight + 12);
        const isFinalSuccessRow = result.success && index === dailyGuessHistory2.length - 1;
        let accent = "#d2463c";
        if (isFinalSuccessRow || guess.distance < 500) {
          accent = "#1f9d66";
        } else if (guess.distance < 2e3) {
          accent = "#e08a00";
        }
        ctx.fillStyle = "rgba(15,23,42,0.62)";
        ctx.beginPath();
        ctx.roundRect(rowX, rowY, rowWidth, rowHeight, 20);
        ctx.fill();
        ctx.strokeStyle = "rgba(148,163,184,0.25)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = "#e2e8f0";
        ctx.font = '600 30px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
        ctx.textAlign = "left";
        ctx.fillText(`#${index + 1}`, rowX + 24, rowY + 47);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.roundRect(rowX + 112, rowY + 14, 42, 42, 10);
        ctx.fill();
        ctx.fillStyle = "#f8fafc";
        ctx.font = '600 34px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
        ctx.fillText(isFinalSuccessRow ? "\u{1F3C1}" : guess.arrow || "\u2022", rowX + 174, rowY + 49);
        ctx.fillStyle = isFinalSuccessRow ? "#86efac" : "#e2e8f0";
        ctx.font = '600 30px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
        ctx.fillText(
          isFinalSuccessRow ? "Trouv\xE9 !" : formatDailyDistanceForShare2(guess.distance),
          rowX + 246,
          rowY + 48
        );
      });
    } else {
      ctx.fillStyle = "rgba(226,232,240,0.9)";
      ctx.font = '600 30px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
      ctx.fillText("Aucun essai enregistr\xE9", rowX, rowsStartY + 44);
    }
    const bestPanel = {
      x: centerX + 20,
      y: rowsStartY + 2 * (rowHeight + 12) - 6,
      w: panel.x + panel.w - 70 - (centerX + 20),
      h: 3 * (rowHeight + 12) + 12
    };
    ctx.fillStyle = "rgba(15,23,42,0.82)";
    ctx.beginPath();
    ctx.roundRect(bestPanel.x, bestPanel.y, bestPanel.w, bestPanel.h, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const bestCenterX = bestPanel.x + bestPanel.w / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = "#f8fafc";
    ctx.font = '700 28px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText("\u{1F3AF} Meilleure", bestCenterX, bestPanel.y + 42);
    ctx.fillText(`distance : ${bestDistanceLabel}`, bestCenterX, bestPanel.y + 76);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = '500 22px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText("Essaie de faire", bestCenterX, bestPanel.y + 130);
    ctx.fillText("mieux sur", bestCenterX, bestPanel.y + 158);
    ctx.fillStyle = "#93c5fd";
    ctx.font = '700 24px "Nunito", "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText("camino-ajm.pages.dev", bestCenterX, bestPanel.y + 200);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        showMessage2("Erreur lors de la g\xE9n\xE9ration", "error");
        return;
      }
      const file = new File([blob], "camino-daily.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: "Camino - D\xE9fi Quotidien",
            text: `${dailyTargetData2.streetName} \u2022 ${resultLabel}/7
Essaie de faire mieux sur camino-ajm.pages.dev`,
            files: [file]
          });
          showMessage2("Partag\xE9 !", "success");
          return;
        } catch (error) {
          if (error.name === "AbortError") {
            return;
          }
        }
      }
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          showMessage2("Image copi\xE9e dans le presse-papier !", "success");
          return;
        } catch (error) {
        }
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "camino-daily.png";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      showMessage2("Image t\xE9l\xE9charg\xE9e !", "success");
    }, "image/png");
  }
  function updateDailyResultPanelRuntime({
    isSessionRunning: isSessionRunning2,
    dailyGuessHistory: dailyGuessHistory2,
    dailyTargetData: dailyTargetData2,
    isDailyGameOver,
    setDailyGuessHistory,
    getTodayDailyStorageDate: getTodayDailyStorageDate2,
    getDailyGuessesStorageKey: getDailyGuessesStorageKey2,
    restoreDailyMetaFromStorage: restoreDailyMetaFromStorage2,
    ensureDailyShareContext: ensureDailyShareContext2,
    handleDailyShareText: handleDailyShareText2,
    handleDailyShareImage: handleDailyShareImage2,
    showMessage: showMessage2
  }) {
    const panel = document.getElementById("daily-result-panel");
    const content = document.getElementById("daily-result-content");
    if (!panel || !content) {
      return;
    }
    if (isSessionRunning2) {
      panel.style.display = "none";
      return;
    }
    let guesses = Array.isArray(dailyGuessHistory2) ? dailyGuessHistory2.slice() : [];
    const dailyDate = (dailyTargetData2 == null ? void 0 : dailyTargetData2.date) || getTodayDailyStorageDate2();
    if (guesses.length === 0 && !isDailyGameOver && dailyDate) {
      const stored = localStorage.getItem(getDailyGuessesStorageKey2(dailyDate));
      if (stored) {
        try {
          guesses = JSON.parse(stored);
        } catch (error) {
          guesses = [];
        }
      }
    }
    if (!Array.isArray(guesses)) {
      guesses = [];
    }
    if (guesses.length === 0) {
      panel.style.display = "none";
      return;
    }
    const normalizedGuesses = guesses.slice(0, 7).map((guess) => ({ ...guess }));
    setDailyGuessHistory(normalizedGuesses);
    restoreDailyMetaFromStorage2(dailyDate);
    const isSuccess = guesses.some((guess) => guess.distance < 20);
    const isFinished = isSuccess || guesses.length >= 7 || isDailyGameOver;
    if (!isFinished) {
      panel.style.display = "none";
      return;
    }
    const result = {
      success: isSuccess,
      attempts: guesses.length
    };
    let html = "";
    if (isSuccess) {
      const attempts = result.attempts;
      html += `<div class="daily-result daily-result--success">\u{1F389} Bravo, vous avez trouv\xE9 la rue en ${attempts} essai${attempts > 1 ? "s" : ""} !</div>`;
    } else {
      const minDistance = Math.min(...guesses.map((guess) => guess.distance));
      const minDistanceLabel = minDistance >= 1e3 ? `${(minDistance / 1e3).toFixed(1)} km` : `${Math.round(minDistance)} m`;
      html += `<div class="daily-result daily-result--fail">Votre meilleur score est ${minDistanceLabel} en sept essais</div>`;
    }
    html += '<div class="daily-share-buttons">';
    html += '<button id="daily-share-text" class="btn-secondary daily-share-btn">\u{1F4CB} Copier le texte</button>';
    html += `<button id="daily-share-image" class="btn-primary daily-share-btn">\u{1F4F8} Partager l'image</button>`;
    html += "</div>";
    html += `<p class="daily-share-hint">L'image est plus impactante sur les r\xE9seaux !</p>`;
    content.innerHTML = html;
    panel.style.display = "block";
    const shareTextBtn = document.getElementById("daily-share-text");
    const shareImageBtn = document.getElementById("daily-share-image");
    if (shareTextBtn) {
      shareTextBtn.onclick = async () => {
        shareTextBtn.disabled = true;
        const contextReady = await ensureDailyShareContext2(dailyDate, guesses);
        shareTextBtn.disabled = false;
        if (!contextReady) {
          showMessage2("Impossible de pr\xE9parer le partage du Daily.", "error");
          return;
        }
        handleDailyShareText2(result);
      };
    }
    if (shareImageBtn) {
      shareImageBtn.onclick = async () => {
        shareImageBtn.disabled = true;
        const contextReady = await ensureDailyShareContext2(dailyDate, guesses);
        shareImageBtn.disabled = false;
        if (!contextReady) {
          showMessage2("Impossible de pr\xE9parer le partage du Daily.", "error");
          return;
        }
        handleDailyShareImage2(result);
      };
    }
  }
  function fitTargetStreetTextRuntime(targetStreetElementId = "target-street") {
    const targetStreetEl = document.getElementById(targetStreetElementId);
    if (!targetStreetEl) {
      return;
    }
    if (!window.matchMedia("(max-width: 600px)").matches) {
      targetStreetEl.style.fontSize = "";
      return;
    }
    targetStreetEl.style.whiteSpace = "nowrap";
    const availableWidth = targetStreetEl.clientWidth;
    if (availableWidth <= 0) {
      return;
    }
    targetStreetEl.style.fontSize = "18px";
    if (targetStreetEl.scrollWidth <= availableWidth) {
      return;
    }
    let low = 11;
    let high = 18;
    let best = 11;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      targetStreetEl.style.fontSize = `${mid}px`;
      if (targetStreetEl.scrollWidth <= availableWidth) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    targetStreetEl.style.fontSize = `${best}px`;
  }

  // src/auth.js
  var USER_STORAGE_KEY = "camino_user";
  function saveCurrentUserToStorage(user) {
    if (!user) {
      return;
    }
    try {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch (error) {
      console.warn("Impossible de sauvegarder l\u2019utilisateur.", error);
    }
  }
  function loadCurrentUserFromStorage() {
    const serializedUser = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!serializedUser) {
      return null;
    }
    try {
      return JSON.parse(serializedUser);
    } catch (error) {
      console.error("Erreur parsing user storage", error);
      return null;
    }
  }
  function clearCurrentUserFromStorage() {
    try {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    } catch (error) {
      console.warn("Impossible de supprimer l\u2019utilisateur stock\xE9.", error);
    }
  }

  // src/session.js
  function shuffle(items) {
    for (let index = items.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
    }
  }
  function sampleWithoutReplacement(items, count) {
    const indexes = [...Array(items.length).keys()];
    shuffle(indexes);
    return indexes.slice(0, count).map((index) => items[index]);
  }
  function computeItemPoints(elapsedSeconds) {
    return Math.max(0, MAX_POINTS_PER_ITEM - Math.floor(elapsedSeconds / 2));
  }

  // src/app.js
  var FAMOUS_STREET_INFOS = {};
  var MAIN_STREET_INFOS = {};
  var DEFAULT_REMINDER_CONFIG = {
    hour: 10,
    minute: 0,
    timezone: "Europe/Paris"
  };
  var swRegistrationPromise = null;
  var notificationConfigCache = null;
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
  function toPushServerKeyUint8Array(base64String) {
    const normalized = String(base64String || "").trim();
    const padding = "=".repeat((4 - normalized.length % 4) % 4);
    const base64 = (normalized + padding).replace(/-/g, "+").replace(/_/g, "/");
    const decoded = window.atob(base64);
    const output = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
      output[i] = decoded.charCodeAt(i);
    }
    return output;
  }
  function isPushReminderSupported() {
    return window.isSecureContext && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  }
  function isIOSMobileDevice() {
    const ua = window.navigator.userAgent || "";
    const platform = window.navigator.platform || "";
    const iPhoneOrIPad = /iPad|iPhone|iPod/i.test(ua);
    const ipadOnDesktop = platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
    return iPhoneOrIPad || ipadOnDesktop;
  }
  function requiresInstalledAppForMobilePush() {
    return isIOSMobileDevice() && !isStandaloneDisplayMode2();
  }
  function formatReminderTimeLabel(reminder = DEFAULT_REMINDER_CONFIG) {
    const hour = Number.isInteger(reminder == null ? void 0 : reminder.hour) ? reminder.hour : DEFAULT_REMINDER_CONFIG.hour;
    const minute = Number.isInteger(reminder == null ? void 0 : reminder.minute) ? reminder.minute : DEFAULT_REMINDER_CONFIG.minute;
    const timezone = (reminder == null ? void 0 : reminder.timezone) || DEFAULT_REMINDER_CONFIG.timezone;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} (${timezone})`;
  }
  function getDailyReminderElements() {
    return {
      statusEl: document.getElementById("daily-reminder-status"),
      enableBtn: document.getElementById("daily-reminder-enable-btn"),
      disableBtn: document.getElementById("daily-reminder-disable-btn")
    };
  }
  function setDailyReminderStatus(message, type = "neutral") {
    const { statusEl } = getDailyReminderElements();
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message;
    statusEl.classList.remove("is-error", "is-success");
    if (type === "error") {
      statusEl.classList.add("is-error");
    } else if (type === "success") {
      statusEl.classList.add("is-success");
    }
  }
  function setDailyReminderButtons({
    canEnable = false,
    canDisable = false,
    loading = false
  } = {}) {
    const { enableBtn, disableBtn } = getDailyReminderElements();
    if (!enableBtn || !disableBtn) {
      return;
    }
    enableBtn.classList.toggle("hidden", !canEnable);
    disableBtn.classList.toggle("hidden", !canDisable);
    enableBtn.disabled = loading;
    disableBtn.disabled = loading;
  }
  function isAuthStatus(status) {
    return status === 401 || status === 403;
  }
  async function buildApiError(response, fallbackMessage) {
    let message = fallbackMessage;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === "string" && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch (error) {
    }
    const err = new Error(message);
    err.status = response.status;
    return err;
  }
  function getReminderErrorMessage(error, fallback) {
    if (error && typeof error.message === "string" && error.message.trim()) {
      return error.message.trim();
    }
    return fallback;
  }
  function handleReminderAuthError() {
    setDailyReminderStatus("Session expir\xE9e. Reconnectez-vous pour g\xE9rer les rappels.", "error");
    setDailyReminderButtons({
      canEnable: false,
      canDisable: false,
      loading: false
    });
  }
  async function ensureServiceWorkerRegistration() {
    if (!("serviceWorker" in navigator)) {
      return null;
    }
    if (!swRegistrationPromise) {
      swRegistrationPromise = navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => {
        console.log("SW registered:", registration.scope);
        registration.update().catch(() => {
        });
        return registration;
      }).catch((error) => {
        swRegistrationPromise = null;
        console.warn("SW registration failed:", error);
        return null;
      });
    }
    return swRegistrationPromise;
  }
  async function getNotificationConfig(forceReload = false) {
    if (!forceReload && notificationConfigCache) {
      return notificationConfigCache;
    }
    const response = await fetch(`${API_URL}/api/notifications/public-key`);
    if (!response.ok) {
      throw await buildApiError(response, `HTTP ${response.status}`);
    }
    const payload = await response.json();
    notificationConfigCache = payload;
    return payload;
  }
  async function fetchNotificationStatus() {
    if (!(currentUser && currentUser.token)) {
      return null;
    }
    const response = await fetch(`${API_URL}/api/notifications/status`, {
      headers: {
        Authorization: `Bearer ${currentUser.token}`
      }
    });
    if (!response.ok) {
      throw await buildApiError(response, `HTTP ${response.status}`);
    }
    return response.json();
  }
  async function refreshDailyReminderControls() {
    const { statusEl, enableBtn, disableBtn } = getDailyReminderElements();
    if (!statusEl || !enableBtn || !disableBtn) {
      return;
    }
    setDailyReminderStatus("Chargement\u2026");
    setDailyReminderButtons({ loading: true });
    if (!(currentUser && currentUser.token)) {
      setDailyReminderStatus("Connectez-vous pour g\xE9rer le rappel Daily.", "error");
      setDailyReminderButtons({ canEnable: false, canDisable: false, loading: false });
      return;
    }
    if (requiresInstalledAppForMobilePush()) {
      setDailyReminderStatus(
        "Sur iPhone/iPad, installe Camino via \u201CAjouter \xE0 l\u2019\xE9cran d\u2019accueil\u201D pour activer les notifications.",
        "error"
      );
      setDailyReminderButtons({ canEnable: false, canDisable: false, loading: false });
      return;
    }
    if (!isPushReminderSupported()) {
      setDailyReminderStatus("Notifications push non disponibles sur ce navigateur.", "error");
      setDailyReminderButtons({ canEnable: false, canDisable: false, loading: false });
      return;
    }
    let config;
    try {
      config = await getNotificationConfig();
    } catch (error) {
      setDailyReminderStatus(
        `Impossible de charger la config des notifications: ${getReminderErrorMessage(error, "erreur serveur")}.`,
        "error"
      );
      setDailyReminderButtons({ canEnable: false, canDisable: false, loading: false });
      return;
    }
    if (!(config == null ? void 0 : config.enabled) || !(config == null ? void 0 : config.publicKey)) {
      setDailyReminderStatus("Rappels indisponibles: configuration serveur manquante.", "error");
      setDailyReminderButtons({ canEnable: false, canDisable: false, loading: false });
      return;
    }
    const scheduleLabel = formatReminderTimeLabel(config.reminder || DEFAULT_REMINDER_CONFIG);
    let registration;
    try {
      registration = await ensureServiceWorkerRegistration();
    } catch (error) {
      registration = null;
    }
    if (!registration) {
      setDailyReminderStatus("Service worker indisponible. Rechargez la page.", "error");
      setDailyReminderButtons({ canEnable: false, canDisable: false, loading: false });
      return;
    }
    try {
      const [serverStatus, browserSubscription] = await Promise.all([
        fetchNotificationStatus(),
        registration.pushManager.getSubscription()
      ]);
      const isSubscribed = Boolean((serverStatus == null ? void 0 : serverStatus.subscribed) && browserSubscription);
      if (isSubscribed) {
        setDailyReminderStatus(`Rappel actif tous les jours \xE0 ${scheduleLabel}.`, "success");
        setDailyReminderButtons({ canEnable: false, canDisable: true, loading: false });
      } else {
        setDailyReminderStatus(`Rappel inactif. Active-le pour ${scheduleLabel}.`);
        setDailyReminderButtons({ canEnable: true, canDisable: false, loading: false });
      }
    } catch (error) {
      if (isAuthStatus(error == null ? void 0 : error.status)) {
        handleReminderAuthError();
        return;
      }
      setDailyReminderStatus(
        `Impossible de lire le statut du rappel: ${getReminderErrorMessage(error, "erreur serveur")}.`,
        "error"
      );
      setDailyReminderButtons({ canEnable: true, canDisable: false, loading: false });
    }
  }
  async function enableDailyReminder() {
    if (!(currentUser && currentUser.token)) {
      showMessage("Connectez-vous pour activer le rappel Daily.", "warning");
      return;
    }
    if (requiresInstalledAppForMobilePush()) {
      setDailyReminderStatus(
        "Installe Camino sur l\u2019\xE9cran d\u2019accueil pour activer les notifications sur iPhone/iPad.",
        "error"
      );
      setDailyReminderButtons({ canEnable: false, canDisable: false, loading: false });
      showMessage(
        "Sur iPhone/iPad, les notifications push n\xE9cessitent la version install\xE9e (Ajouter \xE0 l\u2019\xE9cran d\u2019accueil).",
        "warning"
      );
      return;
    }
    setDailyReminderButtons({ loading: true });
    try {
      const config = await getNotificationConfig();
      if (!(config == null ? void 0 : config.enabled) || !(config == null ? void 0 : config.publicKey)) {
        throw new Error("Push disabled on server");
      }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        setDailyReminderStatus("Autorisation de notification refus\xE9e.", "error");
        setDailyReminderButtons({ canEnable: true, canDisable: false, loading: false });
        return;
      }
      const registration = await ensureServiceWorkerRegistration();
      if (!registration) {
        throw new Error("Missing service worker registration");
      }
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toPushServerKeyUint8Array(config.publicKey)
        });
      }
      const response = await fetch(`${API_URL}/api/notifications/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ subscription })
      });
      if (!response.ok) {
        throw await buildApiError(response, `HTTP ${response.status}`);
      }
      const scheduleLabel = formatReminderTimeLabel(config.reminder || DEFAULT_REMINDER_CONFIG);
      showMessage(`Rappel Daily activ\xE9 pour ${scheduleLabel}.`, "success");
    } catch (error) {
      console.warn("Enable daily reminder failed:", error);
      if (isAuthStatus(error == null ? void 0 : error.status)) {
        handleReminderAuthError();
        showMessage("Session expir\xE9e. Reconnectez-vous puis r\xE9essayez.", "warning");
      } else {
        showMessage(`Impossible d'activer le rappel Daily: ${getReminderErrorMessage(error, "erreur serveur")}.`, "error");
      }
    }
    await refreshDailyReminderControls();
  }
  async function disableDailyReminder() {
    if (!(currentUser && currentUser.token)) {
      return;
    }
    setDailyReminderButtons({ loading: true });
    try {
      const registration = await ensureServiceWorkerRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      await fetch(`${API_URL}/api/notifications/unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          endpoint: (subscription == null ? void 0 : subscription.endpoint) || ""
        })
      }).then(async (response) => {
        if (!response.ok) {
          throw await buildApiError(response, `HTTP ${response.status}`);
        }
      });
      if (subscription) {
        await subscription.unsubscribe().catch(() => {
        });
      }
      showMessage("Rappel Daily d\xE9sactiv\xE9.", "info");
    } catch (error) {
      console.warn("Disable daily reminder failed:", error);
      if (isAuthStatus(error == null ? void 0 : error.status)) {
        handleReminderAuthError();
        showMessage("Session expir\xE9e. Reconnectez-vous puis r\xE9essayez.", "warning");
      } else {
        showMessage(`Impossible de d\xE9sactiver le rappel Daily: ${getReminderErrorMessage(error, "erreur serveur")}.`, "error");
      }
    }
    await refreshDailyReminderControls();
  }
  function initDailyReminderControls() {
    const { enableBtn, disableBtn } = getDailyReminderElements();
    if (!enableBtn || !disableBtn) {
      return;
    }
    enableBtn.onclick = () => {
      enableDailyReminder().catch((error) => {
        console.warn("Enable reminder handler failed:", error);
      });
    };
    disableBtn.onclick = () => {
      disableDailyReminder().catch((error) => {
        console.warn("Disable reminder handler failed:", error);
      });
    };
    refreshDailyReminderControls().catch((error) => {
      console.warn("Refresh reminder controls failed:", error);
    });
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
  var arrondissementByQuartier = createArrondissementByQuartierMap(ARRONDISSEMENT_PAR_QUARTIER);
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
      help: "<strong>Score pond\xE9r\xE9</strong><br>Chaque bonne r\xE9ponse rapporte jusqu'\xE0 10 points selon la rapidit\xE9: 1 point en moins toutes les 2 secondes.<br>Au-del\xE0 de 20 secondes, aucun point.<br><br>Le score affich\xE9 est la somme des points de la session.",
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
  function isStandaloneDisplayMode2() {
    if (window.navigator.standalone === true) return true;
    if ("function" != typeof window.matchMedia) return false;
    return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || window.matchMedia("(display-mode: minimal-ui)").matches;
  }
  function getPullToRefreshTopZonePx() {
    return isStandaloneDisplayMode2() ? PULL_TO_REFRESH_TOP_ZONE_STANDALONE_PX : PULL_TO_REFRESH_TOP_ZONE_PX;
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
  function setTargetPanelTitleText(e) {
    const t = document.getElementById("target-panel-title-text");
    if (t) return void (t.textContent = e);
    const r = document.getElementById("target-panel-title") || document.querySelector(".target-panel .panel-title");
    r && (r.textContent = e);
  }
  function updateTargetItemCounter() {
    const e = document.getElementById("target-item-counter");
    if (!e) return;
    const t = isSessionRunning && !isDailyMode && !isLectureMode && "classique" === getGameMode();
    if (!t)
      return e.textContent = "", void e.classList.add("hidden");
    const r = "monuments" === getZoneMode(), a = r ? sessionMonuments.length : sessionStreets.length;
    if (!Number.isFinite(a) || a <= 0)
      return e.textContent = "", void e.classList.add("hidden");
    const n = r ? currentMonumentIndex : currentIndex, s = Math.min(a, Math.max(1, n + 1));
    e.textContent = `${s}/${a}`, e.classList.remove("hidden");
  }
  function updateTargetPanelTitle() {
    const e = getZoneMode();
    isLectureMode ? setTargetPanelTitleText("monuments" === e ? "Monument \xE0 explorer" : "Recherche de rue") : setTargetPanelTitleText("monuments" === e ? "Monument \xE0 trouver" : "Rue \xE0 trouver"), updateTargetItemCounter();
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
    const e = buildUniqueStreetList2(getCurrentZoneStreets2()), t = /* @__PURE__ */ new Set();
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
    })), initOnboardingBanner(), initInstallPrompt({
      isStandaloneDisplayModeFn: isStandaloneDisplayMode2,
      showMessage
    }), loadUniqueVisitorCounter();
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
        const t2 = getBaseStreetStyle2(e3), r2 = t2.weight > 0;
        e3.setStyle({ color: t2.color, weight: t2.weight }), e3.options.interactive = r2, e3.touchBuffer && (e3.touchBuffer.options.interactive = r2);
      }), "quartier" === e2 ? (r.style.display = "block", a && a.value && highlightQuartier(a.value)) : (r.style.display = "none", clearQuartierOverlay()), "monuments" === e2 ? (streetsLayer && map.hasLayer(streetsLayer) && map.removeLayer(streetsLayer), monumentsLayer && !map.hasLayer(monumentsLayer) && monumentsLayer.addTo(map)) : (monumentsLayer && map.hasLayer(monumentsLayer) && map.removeLayer(monumentsLayer), streetsLayer && !map.hasLayer(streetsLayer) && streetsLayer.addTo(map)), updateStreetInfoPanelVisibility(), refreshLectureTooltipsIfNeeded(), isLectureMode && refreshLectureStreetSearchForCurrentMode({ preserveQuery: true });
      const n2 = document.getElementById("street-info");
      n2 && ("rues-principales" === e2 || "main" === e2 || (n2.textContent = "", n2.style.display = "none"));
    }), a && a.addEventListener("change", () => {
      "quartier" === getZoneMode() && a.value ? highlightQuartier(a.value) : clearQuartierOverlay(), streetsLayer && streetLayersById.size && streetLayersById.forEach((e2) => {
        const t2 = getBaseStreetStyle2(e2), r2 = t2.weight > 0;
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
    I && (I.classList.add("hidden"), I.innerHTML = ""), clearSessionShareSlot();
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
  function clearSessionShareSlot() {
    const e = document.getElementById("session-share-slot");
    e && (e.innerHTML = "", e.classList.add("hidden"));
  }
  function getBaseStreetStyle2(e) {
    return getBaseStreetStyle({
      layerOrFeature: e,
      zoneMode: getZoneMode(),
      selectedQuartier: getSelectedQuartier(),
      normalizeName,
      uiTheme: UI_THEME,
      mainStreetNames: MAIN_STREET_NAMES,
      famousStreetNames: FAMOUS_STREET_NAMES
    });
  }
  function isStreetVisibleInCurrentMode2(e, t) {
    return isStreetVisibleInCurrentMode({
      zoneMode: getZoneMode(),
      normalizedStreetName: e,
      quartierName: t,
      selectedQuartier: getSelectedQuartier(),
      famousStreetNames: FAMOUS_STREET_NAMES,
      mainStreetNames: MAIN_STREET_NAMES
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
      getBaseStreetStyle: getBaseStreetStyle2,
      isStreetVisibleInCurrentMode: isStreetVisibleInCurrentMode2,
      isLayerHighlighted: (layer) => highlightedLayers && highlightedLayers.includes(layer),
      handleStreetClick,
      addTouchBufferForLayer
    }).then((result) => {
      allStreetFeatures = result.allStreetFeatures;
      streetsLayer = result.streetsLayer;
      streetLayersById = result.streetLayersById;
      streetLayersByName = result.streetLayersByName;
      console.log(`Rues charg\xE9es : ${allStreetFeatures.length} en ${result.loadedMs}ms`);
      refreshLectureTooltipsIfNeeded();
      refreshLectureStreetSearchForCurrentMode({ preserveQuery: true });
      populateQuartiers();
      const modeSelect = document.getElementById("mode-select");
      if (modeSelect) {
        modeSelect.dispatchEvent(new Event("change"));
      }
      if (window.innerWidth > 900) {
        showMessage(
          'Carte charg\xE9e. Choisissez la zone, le type de partie, puis cliquez sur "Commencer la session".',
          "info"
        );
      }
      setMapStatus("Carte OK", "ready");
      document.body.classList.add("app-ready");
    }).catch((e) => {
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
      handleMonumentClick
    }).then((result) => {
      allMonuments = result.allMonuments;
      console.log("Nombre de monuments charg\xE9s :", allMonuments.length);
      if (allMonuments.length === 0) {
        console.warn("Aucun monument trouv\xE9 apr\xE8s filtrage.");
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
    }).catch((e) => {
      console.error("Erreur lors du chargement des monuments :", e);
    });
  }
  function setLectureTooltipsEnabled(e) {
    setLectureTooltipsEnabledRuntime(e, {
      streetsLayer,
      monumentsLayer,
      getBaseStreetStyle: getBaseStreetStyle2,
      isTouchDevice: IS_TOUCH_DEVICE
    });
  }
  function refreshLectureTooltipsIfNeeded() {
    "lecture" !== getGameMode() && true !== isLectureMode || setLectureTooltipsEnabled(true);
  }
  function loadQuartierPolygons() {
    loadQuartierPolygonsMap().then((byName) => {
      quartierPolygonsByName = byName;
      console.log("Quartiers charg\xE9s :", quartierPolygonsByName.size);
      console.log("Noms de quartiers (polygones):");
      console.log(Array.from(quartierPolygonsByName.keys()).sort());
    }).catch((e) => {
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
      existingOverlay: quartierOverlay
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
      }
    });
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
    if (n && (n.classList.add("hidden"), n.innerHTML = ""), clearSessionShareSlot(), isChronoMode = "chrono" === r, chronoEndTime = isChronoMode ? performance.now() + 6e4 : null, setLectureTooltipsEnabled(false), "lecture" === r) {
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
    const s = getCurrentZoneStreets2();
    if (0 === s.length)
      return void showMessage("Aucune rue disponible pour cette zone.", "error");
    const i = buildUniqueStreetList2(s);
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
  function getCurrentZoneStreets2() {
    return getCurrentZoneStreets({
      allStreetFeatures,
      zoneMode: getZoneMode(),
      selectedQuartier: getSelectedQuartier(),
      normalizeName,
      mainStreetNames: MAIN_STREET_NAMES,
      famousStreetNames: FAMOUS_STREET_NAMES
    });
  }
  function buildUniqueStreetList2(e) {
    return buildUniqueStreetList(e, normalizeName);
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
      return r2 && (r2.textContent = t2 || "\u2014", requestAnimationFrame(fitTargetStreetText)), updateTargetItemCounter(), void triggerTargetPulse();
    }
    if (currentIndex >= sessionStreets.length) {
      if ("chrono" !== e) return void endSession();
      shuffle(sessionStreets), currentIndex = 0;
    }
    currentMonumentTarget = null, currentTarget = sessionStreets[currentIndex], streetStartTime = performance.now(), hasAnsweredCurrentItem = false, resetWeightedBar();
    const t = currentTarget.properties.name, r = document.getElementById("target-street");
    r && (r.textContent = t || "\u2014", requestAnimationFrame(fitTargetStreetText)), updateTargetItemCounter(), triggerTargetPulse();
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
      let m = l2[0], p = l2[1];
      r && r.latlng && (m = r.latlng.lng, p = r.latlng.lat);
      if (!n2) {
        const a3 = normalizeName(dailyTargetData.streetName), n3 = allStreetFeatures.find(
          (e2) => e2.properties && normalizeName(e2.properties.name) === a3
        );
        s2 = n3 && n3.geometry ? getDistanceToFeature(p, m, n3.geometry) : getDistanceMeters(p, m, o[1], o[0]), i2 = getDirectionArrow([m, p], o);
      }
      if (!n2 && t && "function" == typeof t.setStyle) {
        const e2 = getBaseStreetStyle2(t);
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
        setTargetPanelTitleText("\u{1F389} D\xE9fi r\xE9ussi !"), updateTargetItemCounter();
        const t2 = document.getElementById("restart-btn");
        t2 && (t2.textContent = "Commencer la session", t2.classList.remove("btn-stop"), t2.classList.add("btn-primary"));
        const r2 = normalizeName(dailyTargetData.streetName), a3 = allStreetFeatures.find(
          (e2) => e2.properties && normalizeName(e2.properties.name) === r2
        );
        a3 && a3.geometry && highlightDailyTarget(a3.geometry, true);
      } else if (d <= 0) {
        window._dailyGameOver = true, isSessionRunning = false, document.body.classList.add("daily-game-over"), showMessage(
          `\u274C Dommage ! C'\xE9tait \xAB ${dailyTargetData.streetName} \xBB. Fin du d\xE9fi.`,
          "error"
        ), triggerHaptic("error"), renderDailyGuessHistory({ success: false });
        setTargetPanelTitleText("\u274C D\xE9fi \xE9chou\xE9"), updateTargetItemCounter();
        const t2 = document.getElementById("restart-btn");
        t2 && (t2.textContent = "Commencer la session", t2.classList.remove("btn-stop"), t2.classList.add("btn-primary"));
        const r2 = normalizeName(dailyTargetData.streetName), a3 = allStreetFeatures.find(
          (e2) => e2.properties && normalizeName(e2.properties.name) === r2
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
        if (e2.success || e2.attempts_count >= 7) {
          loadAllLeaderboards();
        }
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
     ${yScoreLine}`, c.appendChild(h);
    const shareHost = window.location && window.location.hostname && "localhost" !== window.location.hostname && "127.0.0.1" !== window.location.hostname ? window.location.host : "camino-ajm.pages.dev";
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
      host: shareHost
    });
    d.appendChild(c);
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
    const sessionSharePanel = document.createElement("div");
    sessionSharePanel.className = "session-share";
    const sessionShareButtons = document.createElement("div");
    sessionShareButtons.className = "daily-share-buttons session-share-buttons";
    const copyShareBtn = document.createElement("button");
    copyShareBtn.type = "button", copyShareBtn.className = "btn-secondary daily-share-btn", copyShareBtn.textContent = "\u{1F4CB} Copier le partage", copyShareBtn.addEventListener("click", async () => {
      copyShareBtn.disabled = true;
      const e2 = await copySessionShareText(sessionShareText);
      copyShareBtn.disabled = false, showMessage(e2 ? "R\xE9sultat copi\xE9 !" : "Impossible de copier le r\xE9sultat.", e2 ? "success" : "error");
    });
    const nativeShareBtn = document.createElement("button");
    nativeShareBtn.type = "button", nativeShareBtn.className = "btn-primary daily-share-btn", nativeShareBtn.textContent = "\u{1F4E4} Partager";
    if (navigator.share)
      nativeShareBtn.addEventListener("click", async () => {
        nativeShareBtn.disabled = true;
        const e2 = await shareSessionShareText(sessionShareText);
        nativeShareBtn.disabled = false, true === e2 ? showMessage("Partage envoy\xE9 !", "success") : false === e2 && showMessage("Impossible de partager ce r\xE9sultat.", "error");
      });
    else nativeShareBtn.style.display = "none";
    sessionShareButtons.appendChild(copyShareBtn), sessionShareButtons.appendChild(nativeShareBtn), sessionSharePanel.appendChild(sessionShareButtons);
    const sessionShareHint = document.createElement("p");
    sessionShareHint.className = "daily-share-hint session-share-hint", sessionShareHint.textContent = "R\xE9sum\xE9 en grille emoji (format type Wordle).", sessionSharePanel.appendChild(sessionShareHint);
    const sessionShareSlot = document.getElementById("session-share-slot");
    sessionShareSlot && (sessionShareSlot.innerHTML = "", sessionShareSlot.appendChild(sessionSharePanel), sessionShareSlot.classList.remove("hidden"));
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
  function renderUserSticker() {
    renderUserStickerRuntime(currentUser);
  }
  function updateUserUI() {
    updateUserUIRuntime({
      currentUser,
      renderUserSticker,
      loadProfile
    });
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
      onProfileRendered: initDailyReminderControls
    });
  }
  function initAvatarSelector(currentAvatar, globalRankLevel) {
    initAvatarSelectorRuntime({
      currentAvatar,
      globalRankLevel,
      renderAvatarGrid: (avatar, rankLevel) => {
        renderAvatarGrid(avatar, rankLevel);
      }
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
      showMessage
    });
  }
  function sendScoreToServer(e) {
    sendScoreToServerRuntime({
      isDailyMode,
      currentUser,
      apiUrl: API_URL,
      payload: e,
      loadAllLeaderboards
    });
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
    n && (n.style.display = "none", n.innerHTML = ""), r ? restoreDailyGuessesFromStorage(e.date) : (t.attempts_count || 0) > 0 && !t.success && (restoreDailyGuessesFromStorage(e.date), dailyGuessHistory.length > 0 && renderDailyGuessHistory()), cleanOldDailyGuessStorage(e.date), isSessionRunning && endSession(), clearSessionShareSlot(), removeDailyHighlight(), currentZoneMode = "ville";
    const s = document.getElementById("mode-select"), i = document.getElementById("mode-select-button");
    s && (s.value = "ville", i && (i.innerHTML = '<span class="custom-select-label">Ville enti\xE8re</span><span class="difficulty-pill difficulty-pill--hard">Difficile</span>'));
    const l = document.getElementById("target-street");
    l && (l.textContent = e.streetName, requestAnimationFrame(fitTargetStreetText));
    const o = Math.max(0, 7 - (t.attempts_count || 0)), u = r ? t.success ? "\u{1F389} D\xE9fi r\xE9ussi !" : "\u274C D\xE9fi \xE9chou\xE9" : `\u{1F3AF} D\xE9fi quotidien \u2014 ${o} essai${o > 1 ? "s" : ""} restant${o > 1 ? "s" : ""}`;
    setTargetPanelTitleText(u), updateTargetItemCounter(), isSessionRunning = true, refreshLectureStreetSearchForCurrentMode(), updateLayoutSessionState();
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
    renderDailyGuessHistoryRuntime({
      dailyGuessHistory,
      finalStatus: e,
      dailyTargetData,
      normalizeQuartierKey,
      arrondissementByQuartier,
      calculateStreetLengthFromFeatures,
      allStreetFeatures,
      normalizeName
    });
  }
  function restoreDailyMetaFromStorage(e) {
    const t = restoreDailyMetaFromStorageRuntime(e, dailyTargetData, getDailyMetaStorageKey);
    if (!t) return false;
    return dailyTargetData = t, true;
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
      showMessage
    });
  }
  function handleDailyShareText(e) {
    handleDailyShareTextRuntime({
      result: e,
      dailyTargetData,
      dailyGuessHistory,
      getDailyShareDateLabel: getDailyShareDateLabelFromDate,
      formatDailyDistanceForShare,
      showMessage
    });
  }
  function handleDailyShareImage(e) {
    handleDailyShareImageRuntime({
      result: e,
      dailyTargetData,
      dailyGuessHistory,
      getDailyShareDateLabel: getDailyShareDateLabelFromDate,
      formatDailyDistanceForShare,
      showMessage
    });
  }
  function saveDailyGuessesToStorage() {
    saveDailyGuessesToStorageRuntime({
      dailyTargetData,
      dailyGuessHistory,
      getDailyGuessesStorageKey,
      getDailyMetaStorageKey
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
      dailyHighlightLayer
    });
  }
  function removeDailyHighlight() {
    dailyHighlightLayer = removeDailyHighlightRuntime(map, dailyHighlightLayer);
  }
  function updateDailyUI() {
    updateDailyUIRuntime({
      isDailyMode,
      dailyTargetData,
      dailyGuessHistory
    });
  }
  function handleDailyStop() {
    triggerHaptic("click");
    return !!isDailyMode && (endDailySession(), removeDailyHighlight(), true);
  }
  function fitTargetStreetText() {
    fitTargetStreetTextRuntime("target-street");
  }
  window.addEventListener("resize", () => {
    requestAnimationFrame(fitTargetStreetText);
  }), window.addEventListener("orientationchange", () => {
    requestAnimationFrame(fitTargetStreetText);
  }), window.addEventListener("load", () => {
    if ("serviceWorker" in navigator) {
      ensureServiceWorkerRegistration().catch(
        (e) => console.warn("SW registration failed:", e)
      );
    }
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
