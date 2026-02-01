import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  translateCoordinates, 
  rotateCoordinates,
  cloneGeometry,
  getMercatorScaleFactor
} from '../../utils/geoUtils';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

// Draggable overlay using CSS transforms for smooth mobile dragging
function DraggableOverlay({ overlay, isSelected, onSelect, onUpdate, isEditMode }) {
  const map = useMap();
  const layerRef = useRef(null);
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    element: null
  });
  const lastTapRef = useRef(0);

  const style = {
    fillColor: overlay.color,
    fillOpacity: isSelected ? 0.6 : 0.4,
    color: isSelected ? '#333' : overlay.color,
    weight: isSelected ? 3 : 2,
    opacity: 1,
    dashArray: isSelected && isEditMode ? '5, 5' : null
  };

  // Convert pixel delta to lat/lng delta
  const pixelToLatLng = useCallback((dx, dy) => {
    const startPoint = map.latLngToContainerPoint([0, 0]);
    const endPoint = L.point(startPoint.x + dx, startPoint.y + dy);
    const startLatLng = map.containerPointToLatLng(startPoint);
    const endLatLng = map.containerPointToLatLng(endPoint);
    return {
      dLat: endLatLng.lat - startLatLng.lat,
      dLng: endLatLng.lng - startLatLng.lng
    };
  }, [map]);

  // Apply final geometry update
  const applyDrag = useCallback((dx, dy) => {
    const { dLat, dLng } = pixelToLatLng(dx, dy);
    
    const newOffset = [
      overlay.offset[0] + dLng,
      overlay.offset[1] + dLat
    ];

    const newCentroidLat = overlay.originalCentroid[1] + newOffset[1];
    const originalCentroidLat = overlay.originalCentroid[1];
    const originalScale = getMercatorScaleFactor(originalCentroidLat);
    const newScale = getMercatorScaleFactor(newCentroidLat);
    const visualScaleFactor = newScale / originalScale;

    let newCoords = translateCoordinates(
      overlay.originalGeometry.coordinates,
      newOffset[0],
      newOffset[1]
    );

    const newCentroid = [
      overlay.originalCentroid[0] + newOffset[0],
      overlay.originalCentroid[1] + newOffset[1]
    ];

    if (overlay.rotation) {
      newCoords = rotateCoordinates(
        newCoords,
        newCentroid[0],
        newCentroid[1],
        overlay.rotation
      );
    }

    const newGeometry = cloneGeometry(overlay.originalGeometry);
    newGeometry.coordinates = newCoords;

    onUpdate(overlay.id, {
      offset: newOffset,
      geometry: newGeometry,
      centroid: newCentroid,
      rotation: overlay.rotation,
      mercatorScale: visualScaleFactor
    });
  }, [overlay, onUpdate, pixelToLatLng]);

  // Set up all event handlers
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const element = layer.getElement?.();
    if (!element) return;

    const state = dragStateRef.current;

    // Get touch/mouse position
    const getPosition = (e) => {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    };

    // Start drag
    const handleStart = (e) => {
      const now = Date.now();
      const isTouch = e.type === 'touchstart';
      
      // Handle double tap/click for edit mode toggle
      if (now - lastTapRef.current < 300) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(overlay.id, true);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      // Only drag if in edit mode
      if (!isEditMode || !isSelected) {
        onSelect(overlay.id);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const pos = getPosition(e);
      state.active = true;
      state.startX = pos.x;
      state.startY = pos.y;
      state.currentX = 0;
      state.currentY = 0;
      state.element = element;

      map.dragging.disable();
      element.style.cursor = 'grabbing';
    };

    // During drag - use CSS transform for smooth movement
    const handleMove = (e) => {
      if (!state.active) return;
      
      e.preventDefault();

      const pos = getPosition(e);
      state.currentX = pos.x - state.startX;
      state.currentY = pos.y - state.startY;

      // Apply CSS transform for instant visual feedback
      if (state.element) {
        state.element.style.transform = `translate(${state.currentX}px, ${state.currentY}px)`;
      }
    };

    // End drag - apply actual coordinate change
    const handleEnd = (e) => {
      if (!state.active) return;

      e.preventDefault();

      // Remove CSS transform
      if (state.element) {
        state.element.style.transform = '';
        state.element.style.cursor = '';
      }

      // Apply the actual geometry change
      if (state.currentX !== 0 || state.currentY !== 0) {
        applyDrag(state.currentX, state.currentY);
      }

      state.active = false;
      state.element = null;
      map.dragging.enable();
    };

    // Add element-level handlers
    element.addEventListener('mousedown', handleStart);
    element.addEventListener('touchstart', handleStart, { passive: false });

    // Add document-level handlers for move/end
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      element.removeEventListener('mousedown', handleStart);
      element.removeEventListener('touchstart', handleStart);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [map, overlay.id, isEditMode, isSelected, onSelect, applyDrag]);

  const onEachFeature = useCallback((feature, layer) => {
    layerRef.current = layer;
  }, []);

  const geojson = {
    type: 'Feature',
    properties: overlay,
    geometry: overlay.geometry
  };

  return (
    <GeoJSON
      key={overlay.id}
      data={geojson}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}

// Main Map component
export default function MapView({ overlays, selectedOverlayId, editModeId, onSelectOverlay, onUpdateOverlay }) {
  return (
    <MapContainer
      center={[30, 0]}
      zoom={3}
      minZoom={2}
      maxZoom={18}
      className="map-container"
      worldCopyJump={true}
      tap={false}
      touchZoom={true}
      dragging={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {overlays.map(overlay => (
        <DraggableOverlay
          key={overlay.id}
          overlay={overlay}
          isSelected={overlay.id === selectedOverlayId}
          isEditMode={overlay.id === editModeId}
          onSelect={onSelectOverlay}
          onUpdate={onUpdateOverlay}
        />
      ))}
    </MapContainer>
  );
}
