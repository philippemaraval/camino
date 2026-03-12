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
  normalizeName,
  getBaseStreetStyle,
  isStreetVisibleInCurrentMode,
  isLayerHighlighted,
  handleStreetClick,
  addTouchBufferForLayer,
}) {
  const startedAt = performance.now();
  const response = await fetch("data/marseille_rues_light.geojson?v=11");
  if (!response.ok) {
    throw new Error(`Erreur HTTP ${response.status}`);
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
      feature._gameId = gameId++;
      streetLayersById.set(feature._gameId, layer);
      layer.feature = feature;

      if (!streetLayersByName.has(normalizedStreetName)) {
        streetLayersByName.set(normalizedStreetName, []);
      }
      streetLayersByName.get(normalizedStreetName).push(layer);

      addTouchBufferForLayer(layer);

      let hoverTimeoutId = null;
      layer.on("mouseover", () => {
        clearTimeout(hoverTimeoutId);
        hoverTimeoutId = setTimeout(() => {
          const quartierName = feature.properties.quartier || null;
          if (!isStreetVisibleInCurrentMode(normalizedStreetName, quartierName)) {
            return;
          }
          (streetLayersByName.get(normalizedStreetName) || []).forEach((candidateLayer) => {
            candidateLayer.setStyle({ weight: 7, color: uiTheme.mapStreetHover });
          });
        }, 50);
      });

      layer.on("mouseout", () => {
        clearTimeout(hoverTimeoutId);
        hoverTimeoutId = setTimeout(() => {
          const quartierName = feature.properties.quartier || null;
          if (!isStreetVisibleInCurrentMode(normalizedStreetName, quartierName)) {
            return;
          }
          (streetLayersByName.get(normalizedStreetName) || []).forEach((candidateLayer) => {
            if (isLayerHighlighted(candidateLayer)) {
              return;
            }
            const baseStyle = getBaseStreetStyle(candidateLayer);
            candidateLayer.setStyle({ weight: baseStyle.weight, color: baseStyle.color });
          });
        }, 50);
      });

      layer.on("click", (clickEvent) => {
        const quartierName = feature.properties.quartier || null;
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
    loadedMs: (performance.now() - startedAt).toFixed(0),
  };
}

export async function loadMonumentsRuntime({
  map,
  L,
  uiTheme,
  isTouchDevice,
  handleMonumentClick,
}) {
  const response = await fetch("data/marseille_monuments.geojson?v=2");
  if (!response.ok) {
    throw new Error(`Impossible de charger les monuments (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  const allMonuments = (payload.features || []).filter(
    (feature) =>
      feature.geometry &&
      feature.geometry.type === "Point" &&
      feature.properties &&
      typeof feature.properties.name === "string" &&
      feature.properties.name.trim() !== "",
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
  getBaseStreetStyle,
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

  if (streetsLayer) {
    streetsLayer.eachLayer((layer) => {
      const streetName = layer.feature?.properties?.name || "";
      if (!streetName) {
        return;
      }

      if (enabled) {
        if (getBaseStreetStyle(layer).weight > 0) {
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
          layer.on("click", () => {
            const visibleMarker = layer._visibleMarker;
            if (!visibleMarker || !visibleMarker.getTooltip()) {
              return;
            }
            monumentsLayer.eachLayer((candidateLayer) => {
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
          layer.on("click", () => {
            monumentsLayer.eachLayer((candidateLayer) => {
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
