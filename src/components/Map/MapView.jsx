import { useEffect, useRef, useCallback, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  translateCoordinates, 
  rotateCoordinates,
  cloneGeometry,
  getMercatorScaleFactor,
  getBounds
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
    lastAngle: 0, // Track last angle for incremental rotation
    element: null
  });
  const lastTapRef = useRef(0);
  const edgePanRef = useRef(null); // For edge-pan animation frame

  // Edge pan configuration
  const EDGE_THRESHOLD = 60; // pixels from edge to start panning
  const PAN_SPEED = 8; // pixels per frame

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

  // Apply incremental rotation update (called during gesture)
  const applyRotation = useCallback((deltaAngle) => {
    if (Math.abs(deltaAngle) < 0.001) return; // Skip tiny rotations
    
    const newRotation = (overlay.rotation || 0) + deltaAngle;
    
    // Rotate around the shape's current centroid
    let newCoords = translateCoordinates(
      overlay.originalGeometry.coordinates,
      overlay.offset[0],
      overlay.offset[1]
    );

    // Apply the TOTAL rotation around centroid
    newCoords = rotateCoordinates(
      newCoords,
      overlay.centroid[0],
      overlay.centroid[1],
      newRotation
    );

    const newGeometry = cloneGeometry(overlay.originalGeometry);
    newGeometry.coordinates = newCoords;

    onUpdate(overlay.id, {
      geometry: newGeometry,
      rotation: newRotation
    });
    
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
      
      // Handle double tap/click for edit mode toggle (only for single touch)
      if (isTouch && e.touches.length === 1 && now - lastTapRef.current < 300) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(overlay.id, true);
        lastTapRef.current = 0;
        return;
      }
      if (isTouch && e.touches.length === 1) {
        lastTapRef.current = now;
      }

      // Only drag/rotate if in edit mode
      if (!isEditMode || !isSelected) {
        onSelect(overlay.id);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Two-finger rotation - start immediately or switch from drag
      if (isTouch && e.touches.length >= 2) {
        state.active = true;
        state.mode = 'rotate';
        state.startAngle = getTouchAngle(e.touches[0], e.touches[1]);
        state.lastAngle = state.startAngle;
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

      // Check if we should switch from drag to rotate (second finger added)
      if (state.mode === 'drag' && e.touches && e.touches.length >= 2) {
        state.mode = 'rotate';
        state.startAngle = getTouchAngle(e.touches[0], e.touches[1]);
        state.lastAngle = state.startAngle;
        // Reset drag transform
        if (state.element) {
          state.element.style.transform = '';
        }
      }

      if (state.mode === 'rotate' && e.touches && e.touches.length >= 2) {
        const currentAngle = getTouchAngle(e.touches[0], e.touches[1]);
        const deltaAngle = currentAngle - state.lastAngle;
        state.lastAngle = currentAngle;
        
        // Negate angle because screen Y is inverted vs geographic coordinates
        applyRotation(-deltaAngle);
      } else if (state.mode === 'drag') {
        const pos = getPosition(e);
        state.currentX = pos.x - state.startX;
        state.currentY = pos.y - state.startY;

        // Apply CSS translate transform
        if (state.element) {
          state.element.style.transform = `translate(${state.currentX}px, ${state.currentY}px)`;
        }

        // Edge-pan: pan map when dragging near edges
        const mapContainer = map.getContainer();
        const rect = mapContainer.getBoundingClientRect();
        let panX = 0, panY = 0;

        if (pos.x - rect.left < EDGE_THRESHOLD) panX = -PAN_SPEED;
        else if (rect.right - pos.x < EDGE_THRESHOLD) panX = PAN_SPEED;
        if (pos.y - rect.top < EDGE_THRESHOLD) panY = -PAN_SPEED;
        else if (rect.bottom - pos.y < EDGE_THRESHOLD) panY = PAN_SPEED;

        if (panX !== 0 || panY !== 0) {
          // Pan the map and adjust start position to keep shape under finger
          map.panBy([panX, panY], { animate: false });
          state.startX += panX;
          state.startY += panY;
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

      // Apply the actual geometry change (rotation is already applied incrementally)
      if (state.mode === 'drag' && (state.currentX !== 0 || state.currentY !== 0)) {
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

// Component to fly to newly added overlays
function FlyToOverlay({ overlays }) {
  const map = useMap();
  const prevCountRef = useRef(overlays.length);

  useEffect(() => {
    // Only fly when a new overlay is added (count increased)
    if (overlays.length > prevCountRef.current) {
      const newOverlay = overlays[overlays.length - 1];
      const bounds = getBounds(newOverlay.geometry.coordinates);
      
      map.flyToBounds(
        [[bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.maxLng]],
        { padding: [50, 50], duration: 0.5 }
      );
    }
    prevCountRef.current = overlays.length;
  }, [overlays, map]);

  return null;
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
      <FlyToOverlay overlays={overlays} />
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
