export function normalizeQuartierKey(quartierName) {
  if (!quartierName) {
    return "";
  }

  let normalized = quartierName.trim();
  const legacySuffixMatch = normalized.match(/^(.+)\s+\((L'|L’|La|Le|Les)\)$/i);
  if (legacySuffixMatch) {
    let body = legacySuffixMatch[1].trim();
    let article = legacySuffixMatch[2].trim();
    article = /^l[’']/i.test(article)
      ? "L'"
      : article.charAt(0).toUpperCase() + article.slice(1).toLowerCase();
    normalized = `${article} ${body}`;
  }

  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  normalized = normalized.replace(/[’`´]/g, "'");
  normalized = normalized.replace(/[-‐‑‒–—]/g, "-");
  normalized = normalized.replace(/\s*-\s*/g, "-");
  normalized = normalized.replace(/\s+/g, " ").toLowerCase();
  return normalized;
}

function isSameQuartierName(leftQuartierName, rightQuartierName) {
  const left = normalizeQuartierKey(leftQuartierName);
  const right = normalizeQuartierKey(rightQuartierName);
  return left !== "" && right !== "" && left === right;
}

const FREE_MODE_EXCLUDED_PREFIXES = new Set([
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
  "cour",
]);

const FREE_MODE_EXCLUDED_KEYWORDS = [
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
  "complexe",
];

function normalizeStreetTextForFilters(streetName) {
  return (streetName || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ");
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

export function createArrondissementByQuartierMap(arrondissementByQuartier) {
  const map = new Map();
  Object.entries(arrondissementByQuartier).forEach(([quartierName, arrondissement]) => {
    map.set(normalizeQuartierKey(quartierName), arrondissement);
  });
  return map;
}

export function getBaseStreetStyleFromName({
  zoneMode,
  streetName,
  normalizeName,
  uiTheme,
  mainStreetNames,
  famousStreetNames,
}) {
  const normalizedStreetName = normalizeName(streetName || "");
  let color = uiTheme.mapStreet;
  let weight = 5;

  if (zoneMode === "quartiers-ville") {
    color = "#00000000";
    weight = 0;
  }

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

export function getBaseStreetStyle({
  layerOrFeature,
  zoneMode,
  selectedQuartier,
  normalizeName,
  uiTheme,
  mainStreetNames,
  famousStreetNames,
}) {
  const feature = layerOrFeature.feature || layerOrFeature;
  let style = getBaseStreetStyleFromName({
    zoneMode,
    streetName: feature?.properties?.name || "",
    normalizeName,
    uiTheme,
    mainStreetNames,
    famousStreetNames,
  });

  if (
    zoneMode === "quartier" &&
    selectedQuartier &&
    !isSameQuartierName(feature?.properties?.quartier || null, selectedQuartier)
  ) {
    style = { color: "#00000000", weight: 0 };
  }
  return style;
}

export function isStreetVisibleInCurrentMode({
  zoneMode,
  normalizedStreetName,
  quartierName,
  selectedQuartier,
  famousStreetNames,
  mainStreetNames,
}) {
  if (zoneMode === "monuments" || zoneMode === "quartiers-ville") {
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
    if (selectedQuartier && !isSameQuartierName(cleanQuartierName, selectedQuartier)) {
      return false;
    }
  }

  if (zoneMode === "ville" && isExcludedFromVilleAndQuartier(normalizedStreetName)) {
    return false;
  }

  return true;
}

export function getCurrentZoneStreets({
  allStreetFeatures,
  zoneMode,
  selectedQuartier,
  normalizeName,
  mainStreetNames,
  famousStreetNames,
}) {
  if (zoneMode === "quartiers-ville") {
    return [];
  }

  if (zoneMode === "quartier" && selectedQuartier) {
    return allStreetFeatures.filter(
      (feature) =>
        feature.properties &&
        typeof feature.properties.quartier === "string" &&
        isSameQuartierName(feature.properties.quartier, selectedQuartier) &&
        !isExcludedFromVilleAndQuartier(normalizeName(feature.properties.name)),
    );
  }

  if (zoneMode === "rues-principales" || zoneMode === "main") {
    return allStreetFeatures.filter((feature) => {
      const normalizedStreetName = normalizeName(feature.properties && feature.properties.name);
      return mainStreetNames.has(normalizedStreetName);
    });
  }

  if (zoneMode === "rues-celebres") {
    return allStreetFeatures.filter((feature) => {
      const normalizedStreetName = normalizeName(feature.properties && feature.properties.name);
      return famousStreetNames.has(normalizedStreetName);
    });
  }

  return allStreetFeatures.filter(
    (feature) => !isExcludedFromVilleAndQuartier(normalizeName(feature?.properties?.name)),
  );
}

export function buildUniqueStreetList(features, normalizeName) {
  const byNormalizedName = new Map();
  features.forEach((feature) => {
    const rawStreetName =
      typeof feature.properties.name === "string" ? feature.properties.name.trim() : "";
    if (!rawStreetName) {
      return;
    }
    const normalizedStreetName = normalizeName(rawStreetName);
    if (!byNormalizedName.has(normalizedStreetName)) {
      byNormalizedName.set(normalizedStreetName, feature);
    }
  });
  return Array.from(byNormalizedName.values());
}

export function populateQuartiersUI({
  allStreetFeatures,
  arrondissementByQuartier,
  onQuartierChange,
}) {
  const nativeSelect = document.getElementById("quartier-select");
  const customList = document.getElementById("quartier-select-list");
  const customButton = document.getElementById("quartier-select-button");
  const customLabel = customButton ? customButton.querySelector(".custom-select-label") : null;
  if (!nativeSelect) {
    return;
  }

  const quartiersByKey = new Map();
  allStreetFeatures.forEach((feature) => {
    const quartierName = (feature.properties || {}).quartier;
    if (typeof quartierName === "string" && quartierName.trim() !== "") {
      const trimmed = quartierName.trim();
      const quartierKey = normalizeQuartierKey(trimmed);
      if (quartierKey && !quartiersByKey.has(quartierKey)) {
        quartiersByKey.set(quartierKey, trimmed);
      }
    }
  });

  const quartiers = Array.from(quartiersByKey.values()).sort((left, right) =>
    left.localeCompare(right, "fr", { sensitivity: "base" }),
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

      const arrondissement = arrondissementByQuartier.get(normalizeQuartierKey(quartierName));
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

    const arrondissement = arrondissementByQuartier.get(normalizeQuartierKey(firstQuartier));
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

export async function loadQuartierPolygonsMap() {
  const response = await fetch("data/marseille_quartiers_111.geojson?v=2");
  if (!response.ok) {
    throw new Error(`Erreur HTTP ${response.status}`);
  }

  const payload = await response.json();
  const features = payload.features || [];
  const byName = new Map();
  features.forEach((feature) => {
    const properties = feature.properties || {};
    const quartierName = typeof properties.nom_qua === "string" ? properties.nom_qua.trim() : "";
    if (quartierName) {
      byName.set(quartierName, feature);
    }
  });

  return byName;
}

export function clearQuartierOverlayLayer(map, quartierOverlay) {
  if (quartierOverlay) {
    map.removeLayer(quartierOverlay);
  }
  return null;
}

export function highlightQuartierOnMap({
  map,
  L,
  quartierName,
  quartierPolygonsByName,
  uiTheme,
  existingOverlay,
}) {
  let overlay = clearQuartierOverlayLayer(map, existingOverlay);
  if (!quartierName) {
    return overlay;
  }

  const quartierFeature = quartierPolygonsByName.get(quartierName);
  if (!quartierFeature) {
    console.warn("Aucun polygone trouvé pour le quartier :", quartierName);
    return overlay;
  }

  overlay = L.geoJSON(quartierFeature, {
    style: { color: uiTheme.mapQuartier, weight: 2, fill: false },
    interactive: false,
  }).addTo(map);

  const bounds = overlay.getBounds();
  if (bounds && bounds.isValid && bounds.isValid()) {
    const fitOptions =
      window.innerWidth <= 900
        ? { padding: [40, 40], maxZoom: 14 }
        : { padding: [40, 40] };
    map.fitBounds(bounds, { ...fitOptions, animate: true, duration: 1.5 });
  }

  return overlay;
}
