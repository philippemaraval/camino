export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;
  const toRadians = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRadians;
  const dLon = (lon2 - lon1) * toRadians;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRadians) *
      Math.cos(lat2 * toRadians) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  // Approximate local projection (meters) to avoid degree-based distances.
  const earthRadius = 6371000;
  const cosLat = Math.cos((px * Math.PI) / 180);

  const pxMeters = (py * cosLat * earthRadius * Math.PI) / 180;
  const pyMeters = (px * earthRadius * Math.PI) / 180;

  const x1Meters = (x1 * cosLat * earthRadius * Math.PI) / 180;
  const y1Meters = (y1 * earthRadius * Math.PI) / 180;
  const x2Meters = (x2 * cosLat * earthRadius * Math.PI) / 180;
  const y2Meters = (y2 * earthRadius * Math.PI) / 180;

  const dx = x2Meters - x1Meters;
  const dy = y2Meters - y1Meters;
  const l2 = dx * dx + dy * dy;
  let t = 0;
  if (l2 !== 0) {
    t = Math.max(
      0,
      Math.min(1, ((pxMeters - x1Meters) * dx + (pyMeters - y1Meters) * dy) / l2),
    );
  }

  const projX = x1Meters + t * dx;
  const projY = y1Meters + t * dy;
  const dist2 = (pxMeters - projX) * (pxMeters - projX) + (pyMeters - projY) * (pyMeters - projY);
  return Math.sqrt(dist2);
}

export function getDistanceToFeature(lat, lon, geometry) {
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

export function calculateStreetLengthFromFeatures(streetName, allStreetFeatures, normalizeName) {
  try {
    if (!streetName || !Array.isArray(allStreetFeatures)) {
      return 0;
    }

    const normalizedStreetName = normalizeName(streetName);
    const feature = allStreetFeatures.find(
      (candidate) =>
        candidate &&
        candidate.properties &&
        candidate.properties.name &&
        normalizeName(candidate.properties.name) === normalizedStreetName,
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

export function computeFeatureCentroid(feature) {
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
    [0, 0],
  );
  return [sumLon / coordinates.length, sumLat / coordinates.length];
}
