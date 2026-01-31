// Calculate centroid of a polygon
export function calculateCentroid(coordinates) {
  let totalX = 0;
  let totalY = 0;
  let totalPoints = 0;

  const processCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      totalX += coords[0];
      totalY += coords[1];
      totalPoints++;
    } else {
      coords.forEach(processCoords);
    }
  };

  processCoords(coordinates);
  
  return [totalX / totalPoints, totalY / totalPoints];
}

// Get Mercator scale factor at a given latitude
// This determines how much larger things appear at that latitude
export function getMercatorScaleFactor(latDegrees) {
  // Clamp latitude to avoid infinity at poles
  const lat = Math.max(-85, Math.min(85, latDegrees));
  const latRad = (lat * Math.PI) / 180;
  // Mercator scale factor is 1/cos(lat) = sec(lat)
  return 1 / Math.cos(latRad);
}

// Translate GeoJSON coordinates by a delta
export function translateCoordinates(coordinates, deltaLng, deltaLat) {
  if (typeof coordinates[0] === 'number') {
    return [coordinates[0] + deltaLng, coordinates[1] + deltaLat];
  }
  return coordinates.map(coord => translateCoordinates(coord, deltaLng, deltaLat));
}

// Scale GeoJSON coordinates around a center point
export function scaleCoordinates(coordinates, centerLng, centerLat, scaleFactor) {
  if (typeof coordinates[0] === 'number') {
    const newLng = centerLng + (coordinates[0] - centerLng) * scaleFactor;
    const newLat = centerLat + (coordinates[1] - centerLat) * scaleFactor;
    return [newLng, newLat];
  }
  return coordinates.map(coord => scaleCoordinates(coord, centerLng, centerLat, scaleFactor));
}

// Rotate GeoJSON coordinates around a center point
export function rotateCoordinates(coordinates, centerLng, centerLat, angleRad) {
  if (typeof coordinates[0] === 'number') {
    const dx = coordinates[0] - centerLng;
    const dy = coordinates[1] - centerLat;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const newLng = centerLng + dx * cos - dy * sin;
    const newLat = centerLat + dx * sin + dy * cos;
    return [newLng, newLat];
  }
  return coordinates.map(coord => rotateCoordinates(coord, centerLng, centerLat, angleRad));
}

// Deep clone GeoJSON geometry
export function cloneGeometry(geometry) {
  return JSON.parse(JSON.stringify(geometry));
}

// Format area for display
export function formatArea(areaKm2) {
  const areaMi2 = areaKm2 * 0.386102;
  return {
    km2: areaKm2.toLocaleString(),
    mi2: Math.round(areaMi2).toLocaleString()
  };
}

// Get bounds of coordinates
export function getBounds(coordinates) {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  const processCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      minLng = Math.min(minLng, coords[0]);
      maxLng = Math.max(maxLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLat = Math.max(maxLat, coords[1]);
    } else {
      coords.forEach(processCoords);
    }
  };

  processCoords(coordinates);
  
  return { minLng, maxLng, minLat, maxLat };
}
