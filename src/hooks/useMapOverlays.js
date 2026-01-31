import { useState, useCallback } from 'react';
import { getNextColor, resetColorIndex } from '../utils/colorUtils';
import { cloneGeometry, calculateCentroid, getMercatorScaleFactor } from '../utils/geoUtils';

export function useMapOverlays() {
  const [overlays, setOverlays] = useState([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);

  const addOverlay = useCallback((stateFeature) => {
    const id = `${stateFeature.properties.code}-${Date.now()}`;
    const color = getNextColor();
    const geometry = cloneGeometry(stateFeature.geometry);
    const centroid = calculateCentroid(geometry.coordinates);
    
    const newOverlay = {
      id,
      name: stateFeature.properties.name,
      code: stateFeature.properties.code,
      country: stateFeature.properties.country,
      area_km2: stateFeature.properties.area_km2,
      color,
      geometry,
      originalGeometry: cloneGeometry(stateFeature.geometry),
      centroid,
      originalCentroid: [...centroid], // Store original centroid for scale calculations
      rotation: 0,
      scale: 1,
      offset: [0, 0],
      mercatorScale: 1 // Track the visual scale due to Mercator projection
    };
    
    setOverlays(prev => [...prev, newOverlay]);
    setSelectedOverlayId(id);
    return id;
  }, []);

  const removeOverlay = useCallback((id) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
    if (selectedOverlayId === id) {
      setSelectedOverlayId(null);
    }
  }, [selectedOverlayId]);

  const updateOverlay = useCallback((id, updates) => {
    setOverlays(prev => prev.map(o => 
      o.id === id ? { ...o, ...updates } : o
    ));
  }, []);

  const clearAllOverlays = useCallback(() => {
    setOverlays([]);
    setSelectedOverlayId(null);
    resetColorIndex();
  }, []);

  const resetOverlay = useCallback((id) => {
    setOverlays(prev => prev.map(o => {
      if (o.id !== id) return o;
      return {
        ...o,
        geometry: cloneGeometry(o.originalGeometry),
        centroid: [...o.originalCentroid],
        offset: [0, 0],
        rotation: 0,
        mercatorScale: 1
      };
    }));
  }, []);

  const selectOverlay = useCallback((id) => {
    setSelectedOverlayId(id);
  }, []);

  const getSelectedOverlay = useCallback(() => {
    return overlays.find(o => o.id === selectedOverlayId) || null;
  }, [overlays, selectedOverlayId]);

  return {
    overlays,
    selectedOverlayId,
    addOverlay,
    removeOverlay,
    updateOverlay,
    clearAllOverlays,
    resetOverlay,
    selectOverlay,
    getSelectedOverlay
  };
}
