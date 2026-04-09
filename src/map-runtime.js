export function addTouchBufferForLayerRuntime(layer, { isTouchDevice, map, L }) {
  if (!isTouchDevice || !map) {
    return;
  }

  const latLngs = layer.getLatLngs();
  if (!latLngs || latLngs.length === 0) {
    return;
  }

  const hitArea = L.polyline(latLngs, {
    color: "#000000",
    weight: 30,
    opacity: 0,
    interactive: true,
  });

  hitArea.on("click", (event) => {
    if (L && L.DomEvent && L.DomEvent.stop) {
      L.DomEvent.stop(event);
    }
    layer.fire("click");
  });
  hitArea.on("mouseover", () => layer.fire("mouseover"));
  hitArea.on("mouseout", () => layer.fire("mouseout"));
  hitArea.addTo(map);
  layer.touchBuffer = hitArea;
}

export async function loadStreetsRuntime({
  map,
  L,
  uiTheme,
  apiUrl = "",
  isTouchDevice = false,
  normalizeName,
  getBaseStreetStyle,
  isStreetVisibleInCurrentMode,
  isLayerHighlighted,
  handleStreetClick,
  addTouchBufferForLayer,
}) {
  const startedAt = performance.now();
  const remoteApiBase = String(apiUrl || "").trim().replace(/\/+$/, "");
  const candidateRequests = [
    {
      url: "data/marseille_rues_light.geojson?v=12",
      options: {},
    },
  ];
  if (remoteApiBase) {
    candidateRequests.push({
      url: `${remoteApiBase}/api/streets-light`,
      options: { cache: "no-store" },
    });
  }

  let response = null;
  let selectedUrl = "";
  let lastError = null;
  for (const candidate of candidateRequests) {
    try {
      const nextResponse = await fetch(candidate.url, candidate.options);
      if (!nextResponse.ok) {
        lastError = new Error(`Erreur HTTP ${nextResponse.status} (${candidate.url})`);
        continue;
      }
      response = nextResponse;
      selectedUrl = candidate.url;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw lastError || new Error("Impossible de charger les rues");
  }

  const payload = await response.json();
  const allStreetFeatures = payload.features || [];
  const streetLayersById = new Map();
  const streetLayersByName = new Map();
  let gameId = 0;

  const streetsLayer = L.geoJSON(allStreetFeatures, {
    style(feature) {
      return getBaseStreetStyle(feature);
    },
    onEachFeature: (feature, layer) => {
      const normalizedStreetName = normalizeName(feature.properties.name);
      const quartierName = feature.properties.quartier || null;
      feature._gameId = gameId++;
      streetLayersById.set(feature._gameId, layer);
      layer.feature = feature;

      if (!streetLayersByName.has(normalizedStreetName)) {
        streetLayersByName.set(normalizedStreetName, []);
      }
      streetLayersByName.get(normalizedStreetName).push(layer);

      if (isStreetVisibleInCurrentMode(normalizedStreetName, quartierName)) {
        addTouchBufferForLayer(layer);
      }

      if (!isTouchDevice) {
        let hoverTimeoutId = null;
        layer.on("mouseover", () => {
          clearTimeout(hoverTimeoutId);
          hoverTimeoutId = setTimeout(() => {
            if (!isStreetVisibleInCurrentMode(normalizedStreetName, quartierName)) {
              return;
            }
            (streetLayersByName.get(normalizedStreetName) || []).forEach((candidateLayer) => {
              if (candidateLayer.__caminoLockedStyle) {
                candidateLayer.setStyle(candidateLayer.__caminoLockedStyle);
                return;
              }
              candidateLayer.setStyle({ weight: 7, color: uiTheme.mapStreetHover });
            });
          }, 50);
        });

        layer.on("mouseout", () => {
          clearTimeout(hoverTimeoutId);
          hoverTimeoutId = setTimeout(() => {
            if (!isStreetVisibleInCurrentMode(normalizedStreetName, quartierName)) {
              return;
            }
            (streetLayersByName.get(normalizedStreetName) || []).forEach((candidateLayer) => {
              if (candidateLayer.__caminoLockedStyle) {
                candidateLayer.setStyle(candidateLayer.__caminoLockedStyle);
                return;
              }
              if (isLayerHighlighted(candidateLayer)) {
                return;
              }
              const baseStyle = getBaseStreetStyle(candidateLayer);
              candidateLayer.setStyle({ weight: baseStyle.weight, color: baseStyle.color });
            });
          }, 50);
        });
      }

      layer.on("click", (clickEvent) => {
        if (isStreetVisibleInCurrentMode(normalizedStreetName, quartierName)) {
          handleStreetClick(feature, layer, clickEvent);
        }
      });
    },
  }).addTo(map);

  return {
    allStreetFeatures,
    streetLayersById,
    streetLayersByName,
    streetsLayer,
    loadedFrom: selectedUrl || candidateRequests[0].url,
    loadedMs: (performance.now() - startedAt).toFixed(0),
  };
}

function getQuartierBaseStyle(uiTheme) {
  return {
    color: uiTheme.mapQuartier,
    weight: 2,
    opacity: 0.9,
    fillColor: uiTheme.mapQuartier,
    fillOpacity: 0.16,
  };
}

function getQuartierHoverStyle(uiTheme) {
  return {
    color: uiTheme.mapStreetHover,
    weight: 2.5,
    opacity: 1,
    fillColor: uiTheme.mapStreetHover,
    fillOpacity: 0.24,
  };
}

export async function loadQuartiersRuntime({
  map,
  L,
  uiTheme,
  normalizeQuartierKey,
  handleQuartierClick,
}) {
  const response = await fetch("data/marseille_quartiers_111.geojson?v=2");
  if (!response.ok) {
    throw new Error(`Impossible de charger les quartiers (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  const allQuartierFeatures = (payload.features || []).filter((feature) => {
    const name = feature?.properties?.nom_qua;
    const geometryType = feature?.geometry?.type;
    return (
      typeof name === "string" &&
      name.trim() !== "" &&
      (geometryType === "Polygon" || geometryType === "MultiPolygon")
    );
  });

  const quartierPolygonsByName = new Map();
  const quartierLayersByKey = new Map();
  allQuartierFeatures.forEach((feature) => {
    const quartierName = feature.properties.nom_qua.trim();
    quartierPolygonsByName.set(quartierName, feature);
  });

  const quartiersLayer = L.geoJSON(
    { type: "FeatureCollection", features: allQuartierFeatures },
    {
      style: () => getQuartierBaseStyle(uiTheme),
      onEachFeature: (feature, layer) => {
        const quartierName = feature?.properties?.nom_qua || "";
        const quartierKey =
          typeof normalizeQuartierKey === "function"
            ? normalizeQuartierKey(quartierName)
            : quartierName;

        if (quartierKey) {
          if (!quartierLayersByKey.has(quartierKey)) {
            quartierLayersByKey.set(quartierKey, []);
          }
          quartierLayersByKey.get(quartierKey).push(layer);
        }

        let hoverTimeoutId = null;

        layer.on("mouseover", () => {
          if (layer.__caminoLockedStyle) {
            return;
          }
          clearTimeout(hoverTimeoutId);
          hoverTimeoutId = setTimeout(() => {
            if (!layer.__caminoLockedStyle) {
              layer.setStyle(getQuartierHoverStyle(uiTheme));
            }
          }, 30);
        });

        layer.on("mouseout", () => {
          if (layer.__caminoLockedStyle) {
            return;
          }
          clearTimeout(hoverTimeoutId);
          hoverTimeoutId = setTimeout(() => {
            if (!layer.__caminoLockedStyle) {
              layer.setStyle(getQuartierBaseStyle(uiTheme));
            }
          }, 30);
        });

        layer.on("click", (event) => {
          if (typeof handleQuartierClick === "function") {
            handleQuartierClick(feature, layer, event);
          }
        });
      },
    },
  );

  return {
    allQuartierFeatures,
    quartierPolygonsByName,
    quartierLayersByKey,
    quartiersLayer,
  };
}

export async function loadMonumentsRuntime({
  map,
  L,
  uiTheme,
  isTouchDevice,
  handleMonumentClick,
  allowedMonumentNames,
  runtimeMonuments,
}) {
  const normalizeMonumentName = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’`´]/g, "'")
      .replace(/[-‐‑‒–—]/g, "-")
      .replace(/\s*-\s*/g, "-")
      .replace(/\s+/g, " ");

  let sourceFeatures = null;
  const useRuntimeMonuments = Array.isArray(runtimeMonuments);
  if (Array.isArray(runtimeMonuments)) {
    sourceFeatures = runtimeMonuments;
  } else {
    const response = await fetch("data/marseille_monuments.geojson");
    if (!response.ok) {
      throw new Error(`Impossible de charger les monuments (HTTP ${response.status}).`);
    }

    const payload = await response.json();
    sourceFeatures = payload.features || [];
  }
  const normalizedAllowedMonumentNames =
    allowedMonumentNames instanceof Set
      ? new Set(
        Array.from(allowedMonumentNames)
          .map((value) => normalizeMonumentName(value))
          .filter(Boolean),
      )
      : new Set();
  const hasMonumentFilter = !useRuntimeMonuments && normalizedAllowedMonumentNames.size > 0;
  const allMonuments = (sourceFeatures || []).filter(
    (feature) =>
      feature.geometry &&
      feature.geometry.type === "Point" &&
      feature.properties &&
      typeof feature.properties.name === "string" &&
      feature.properties.name.trim() !== "" &&
      (!hasMonumentFilter ||
        normalizedAllowedMonumentNames.has(normalizeMonumentName(feature.properties.name))),
  );

  let monumentsLayer = L.geoJSON(
    { type: "FeatureCollection", features: allMonuments },
    {
      renderer: L.svg({ pane: "markerPane" }),
      pointToLayer: (feature, latlng) => {
        const marker = L.circleMarker(latlng, {
          radius: 8,
          color: uiTheme.mapMonumentStroke,
          weight: 3,
          fillColor: uiTheme.mapMonumentFill,
          fillOpacity: 1,
          pane: "markerPane",
        });
        if (isTouchDevice) {
          marker._monumentFeature = feature;
        }
        return marker;
      },
      onEachFeature: (feature, layer) => {
        layer.on("click", () => handleMonumentClick(feature, layer));
      },
    },
  );

  if (isTouchDevice && monumentsLayer) {
    monumentsLayer.eachLayer((layer) => {
      const feature = layer._monumentFeature;
      if (!feature) {
        return;
      }
      const latlng = layer.getLatLng();
      const hitArea = L.circleMarker(latlng, {
        radius: 18,
        fillOpacity: 0,
        opacity: 0,
        pane: "markerPane",
      });
      hitArea.on("click", () => handleMonumentClick(feature, layer));
      hitArea._visibleMarker = layer;
      hitArea._isHitArea = true;
      monumentsLayer.addLayer(hitArea);
    });
  }

  return { allMonuments, monumentsLayer };
}

export function setLectureTooltipsEnabledRuntime(enabled, {
  streetsLayer,
  monumentsLayer,
  quartiersLayer,
  getBaseStreetStyle,
  isStreetVisibleInCurrentMode,
  normalizeName,
  isTouchDevice,
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

  function unbindMonumentTap(layer) {
    if (layer.__monumentTapBound) {
      if (layer.__monumentTapFn) {
        layer.off("click", layer.__monumentTapFn);
      }
      layer.__monumentTapBound = false;
      layer.__monumentTapFn = null;
    }
  }

  function unbindHitAreaTap(layer) {
    if (layer.__hitAreaTooltipBound) {
      if (layer.__hitAreaTooltipFn) {
        layer.off("click", layer.__hitAreaTooltipFn);
      }
      layer.__hitAreaTooltipBound = false;
      layer.__hitAreaTooltipFn = null;
    }
  }

  if (streetsLayer) {
    streetsLayer.eachLayer((layer) => {
      const streetName = layer.feature?.properties?.name || "";
      if (!streetName) {
        return;
      }

      const normalizedStreetName =
        typeof normalizeName === "function" ? normalizeName(streetName) : streetName;
      const quartierName =
        typeof layer.feature?.properties?.quartier === "string"
          ? layer.feature.properties.quartier
          : null;
      const isVisibleInCurrentMode =
        typeof isStreetVisibleInCurrentMode === "function"
          ? isStreetVisibleInCurrentMode(normalizedStreetName, quartierName)
          : getBaseStreetStyle(layer).weight > 0;

      if (enabled) {
        if (isVisibleInCurrentMode) {
          if (!layer.getTooltip()) {
            layer.bindTooltip(streetName, {
              direction: "top",
              sticky: !isTouchDevice,
              opacity: 0.9,
              className: "street-tooltip",
            });
          }

          if (isTouchDevice && !layer.__lectureTapTooltipBound) {
            layer.__lectureTapTooltipBound = true;
            layer.on(
              "click",
              (layer.__lectureTapTooltipFn = () => {
                if (layer.getTooltip()) {
                  layer.openTooltip();
                }

                if (streetsLayer) {
                  streetsLayer.eachLayer((candidateLayer) => {
                    if (candidateLayer !== layer && candidateLayer.getTooltip && candidateLayer.getTooltip()) {
                      candidateLayer.closeTooltip();
                    }
                  });
                }

                if (monumentsLayer) {
                  monumentsLayer.eachLayer((candidateLayer) => {
                    if (candidateLayer !== layer && candidateLayer.getTooltip && candidateLayer.getTooltip()) {
                      candidateLayer.closeTooltip();
                    }
                  });
                }
              }),
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

  if (monumentsLayer) {
    monumentsLayer.eachLayer((layer) => {
      if (layer._isHitArea) {
        if (enabled && isTouchDevice && !layer.__hitAreaTooltipBound) {
          layer.__hitAreaTooltipBound = true;
          layer.on(
            "click",
            (layer.__hitAreaTooltipFn = () => {
              const visibleMarker = layer._visibleMarker;
              if (!visibleMarker || !visibleMarker.getTooltip()) {
                return;
              }
              monumentsLayer.eachLayer((candidateLayer) => {
                if (
                  candidateLayer !== visibleMarker &&
                  candidateLayer.getTooltip &&
                  candidateLayer.getTooltip()
                ) {
                  candidateLayer.closeTooltip();
                }
              });
              visibleMarker.toggleTooltip();
            }),
          );
        } else if (!enabled || !isTouchDevice) {
          unbindHitAreaTap(layer);
        }
        return;
      }

      const monumentName = layer.feature?.properties?.name || "";
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
            className: "monument-tooltip",
          });
        }
        if (isTouchDevice && !layer.__monumentTapBound) {
          layer.__monumentTapBound = true;
          layer.on(
            "click",
            (layer.__monumentTapFn = () => {
              monumentsLayer.eachLayer((candidateLayer) => {
                if (
                  candidateLayer !== layer &&
                  candidateLayer.getTooltip &&
                  candidateLayer.getTooltip()
                ) {
                  candidateLayer.closeTooltip();
                }
              });
              if (layer.getTooltip()) {
                layer.toggleTooltip();
              }
            }),
          );
        } else if (!isTouchDevice) {
          unbindMonumentTap(layer);
        }
      } else {
        unbindMonumentTap(layer);
        if (layer.getTooltip()) {
          layer.closeTooltip();
          layer.unbindTooltip();
        }
      }
    });
  }

  if (quartiersLayer) {
    quartiersLayer.eachLayer((layer) => {
      const quartierName = layer.feature?.properties?.nom_qua || "";
      if (!quartierName) {
        return;
      }

      if (enabled) {
        if (!layer.getTooltip()) {
          layer.bindTooltip(quartierName, {
            direction: "top",
            sticky: !isTouchDevice,
            permanent: false,
            opacity: 0.9,
            className: "street-tooltip",
          });
        }
      } else if (layer.getTooltip()) {
        layer.closeTooltip();
        layer.unbindTooltip();
      }
    });
  }
}
