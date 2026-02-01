import { useEffect, useRef, useCallback, useState } from 'react';
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
  const [version, setVersion] = useState(0); // Force re-render after drag
  const dragStateRef = useRef({
    active: false,
    mode: null, // 'drag' or 'rotate'
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startAngle: 0,
    currentRotation: 0,
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

  // Apply final geometry update for drag
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
    
    // Force re-render to show new position
    setVersion(v => v + 1);
  }, [overlay, onUpdate, pixelToLatLng]);

  // Apply final geometry update for rotation
  const applyRotation = useCallback((deltaAngle) => {
    const newRotation = (overlay.rotation || 0) + deltaAngle;
    
    let newCoords = translateCoordinates(
      overlay.originalGeometry.coordinates,
      overlay.offset[0],
      overlay.offset[1]
    );

    newCoords = rotateCoordinates(
      newCoords,
      overlay.centroid[0],
      overlay.centroid[1],
      newRotation
    );

    const newGeometry = cloneGeometry(overlay.originalGeometry);
    newGeometry.coordinates = newCoords;

    onUpdate(overlay.id, {
      offset: overlay.offset,
      geometry: newGeometry,
      centroid: overlay.centroid,
      rotation: newRotation,
      mercatorScale: overlay.mercatorScale
    });
    
    // Force re-render
    setVersion(v => v + 1);
  }, [overlay, onUpdate]);

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

    // Get angle between two touch points
    const getTouchAngle = (t1, t2) => {
      return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
    };

    // Start drag or rotate
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

      // Only drag/rotate if in edit mode
      if (!isEditMode || !isSelected) {
        onSelect(overlay.id);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Two-finger rotation
      if (isTouch && e.touches.length === 2) {
        state.active = true;
        state.mode = 'rotate';
        state.startAngle = getTouchAngle(e.touches[0], e.touches[1]);
        state.currentRotation = 0;
        state.element = element;
        map.dragging.disable();
        return;
      }

      // Single touch/click drag
      const pos = getPosition(e);
      state.active = true;
      state.mode = 'drag';
      state.startX = pos.x;
      state.startY = pos.y;
      state.currentX = 0;
      state.currentY = 0;
      state.element = element;

      map.dragging.disable();
      element.style.cursor = 'grabbing';
    };

    // During drag/rotate - use CSS transform for smooth movement
    const handleMove = (e) => {
      if (!state.active) return;
      
      e.preventDefault();

      if (state.mode === 'rotate' && e.touches && e.touches.length === 2) {
        const currentAngle = getTouchAngle(e.touches[0], e.touches[1]);
        state.currentRotation = currentAngle - state.startAngle;
        
        // Apply CSS rotation transform
        if (state.element) {
          const rotationDeg = (state.currentRotation * 180) / Math.PI;
          state.element.style.transformOrigin = 'center center';
          state.element.style.transform = `rotate(${rotationDeg}deg)`;
        }
      } else if (state.mode === 'drag') {
        const pos = getPosition(e);
        state.currentX = pos.x - state.startX;
        state.currentY = pos.y - state.startY;

        // Apply CSS translate transform
        if (state.element) {
          state.element.style.transform = `translate(${state.currentX}px, ${state.currentY}px)`;
        }
      }
    };

    // End drag/rotate - apply actual coordinate change
    const handleEnd = (e) => {
      if (!state.active) return;

      // Remove CSS transform
      if (state.element) {
        state.element.style.transform = '';
        state.element.style.transformOrigin = '';
        state.element.style.cursor = '';
      }

      // Apply the actual geometry change
      if (state.mode === 'rotate' && state.currentRotation !== 0) {
        applyRotation(state.currentRotation);
      } else if (state.mode === 'drag' && (state.currentX !== 0 || state.currentY !== 0)) {
        applyDrag(state.currentX, state.currentY);
      }

      state.active = false;
      state.mode = null;
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
  }, [map, overlay.id, isEditMode, isSelected, onSelect, applyDrag, applyRotation]);

  const onEachFeature = useCallback((feature, layer) => {
    layerRef.current = layer;
  }, []);

  const geojson = {
    type: 'Feature',
    properties: overlay,
    geometry: overlay.geometry
  };

  // Include version to force re-render after drag/rotate ends
  const geoKey = `${overlay.id}-${version}`;

  return (
    <GeoJSON
      key={geoKey}
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
