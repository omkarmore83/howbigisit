import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  translateCoordinates, 
  rotateCoordinates,
  cloneGeometry,
  getMercatorScaleFactor
} from '../../utils/geoUtils';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

// Edge pan configuration
const EDGE_PAN_THRESHOLD = 50; // pixels from edge to start panning
const EDGE_PAN_SPEED = 15; // pixels to pan per frame

// Component to handle draggable overlays with touch support
function DraggableOverlay({ overlay, isSelected, onSelect, onUpdate }) {
  const map = useMap();
  const isDragging = useRef(false);
  const isRotating = useRef(false);
  const dragStart = useRef(null);
  const edgePanInterval = useRef(null);
  const lastTouchDistance = useRef(null);
  const lastTouchAngle = useRef(null);
  const touchStartTime = useRef(null);

  const style = {
    fillColor: overlay.color,
    fillOpacity: isSelected ? 0.6 : 0.4,
    color: isSelected ? '#333' : overlay.color,
    weight: isSelected ? 3 : 2,
    opacity: 1
  };

  // Stop edge panning
  const stopEdgePan = useCallback(() => {
    if (edgePanInterval.current) {
      clearInterval(edgePanInterval.current);
      edgePanInterval.current = null;
    }
  }, []);

  // Start edge panning based on cursor position
  const checkEdgePan = useCallback((clientX, clientY) => {
    const container = map.getContainer();
    const rect = container.getBoundingClientRect();
    
    let panX = 0;
    let panY = 0;
    
    // Check horizontal edges
    if (clientX - rect.left < EDGE_PAN_THRESHOLD) {
      panX = -EDGE_PAN_SPEED;
    } else if (rect.right - clientX < EDGE_PAN_THRESHOLD) {
      panX = EDGE_PAN_SPEED;
    }
    
    // Check vertical edges
    if (clientY - rect.top < EDGE_PAN_THRESHOLD) {
      panY = -EDGE_PAN_SPEED;
    } else if (rect.bottom - clientY < EDGE_PAN_THRESHOLD) {
      panY = EDGE_PAN_SPEED;
    }
    
    // Start or stop panning
    if (panX !== 0 || panY !== 0) {
      if (!edgePanInterval.current) {
        edgePanInterval.current = setInterval(() => {
          map.panBy([panX, panY], { animate: false });
        }, 16); // ~60fps
      }
    } else {
      stopEdgePan();
    }
  }, [map, stopEdgePan]);

  // Calculate angle between two touch points
  const getTouchAngle = (touch1, touch2) => {
    return Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
  };

  // Calculate distance between two touch points
  const getTouchDistance = (touch1, touch2) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle mouse/touch start
  const handleStart = useCallback((latlng, isShiftKey, clientX, clientY) => {
    if (isShiftKey) {
      isRotating.current = true;
      isDragging.current = false;
    } else {
      isDragging.current = true;
      isRotating.current = false;
    }
    
    dragStart.current = {
      latlng,
      centroid: [...overlay.centroid],
      currentOffset: [...overlay.offset],
      currentRotation: overlay.rotation || 0
    };
    
    map.dragging.disable();
    L.DomUtil.addClass(map.getContainer(), isRotating.current ? 'rotating-overlay' : 'dragging-overlay');
    onSelect(overlay.id);
  }, [map, overlay, onSelect]);

  const handleMouseDown = useCallback((e) => {
    if (e.originalEvent.button !== 0) return;
    L.DomEvent.stopPropagation(e);
    handleStart(e.latlng, e.originalEvent.shiftKey, e.originalEvent.clientX, e.originalEvent.clientY);
  }, [handleStart]);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    L.DomEvent.stopPropagation(e);
    const touches = e.originalEvent.touches;
    touchStartTime.current = Date.now();
    
    if (touches.length === 1) {
      // Single touch - drag mode
      const touch = touches[0];
      const latlng = map.containerPointToLatLng([touch.clientX - map.getContainer().getBoundingClientRect().left, touch.clientY - map.getContainer().getBoundingClientRect().top]);
      handleStart(latlng, false, touch.clientX, touch.clientY);
    } else if (touches.length === 2) {
      // Two finger - rotation mode
      isRotating.current = true;
      isDragging.current = false;
      lastTouchDistance.current = getTouchDistance(touches[0], touches[1]);
      lastTouchAngle.current = getTouchAngle(touches[0], touches[1]);
      
      dragStart.current = {
        ...dragStart.current,
        currentRotation: overlay.rotation || 0
      };
      
      map.dragging.disable();
      L.DomUtil.addClass(map.getContainer(), 'rotating-overlay');
      onSelect(overlay.id);
    }
  }, [map, overlay, onSelect, handleStart]);

  // Calculate angle between two points relative to a center
  const calculateAngle = (center, point) => {
    return Math.atan2(point.lat - center[1], point.lng - center[0]);
  };

  // Update geometry based on current state
  const updateGeometry = useCallback((newOffset, newRotation) => {
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
    
    if (newRotation) {
      newCoords = rotateCoordinates(
        newCoords,
        newCentroid[0],
        newCentroid[1],
        newRotation
      );
    }
    
    const newGeometry = cloneGeometry(overlay.originalGeometry);
    newGeometry.coordinates = newCoords;

    onUpdate(overlay.id, {
      offset: newOffset,
      geometry: newGeometry,
      centroid: newCentroid,
      rotation: newRotation,
      mercatorScale: visualScaleFactor
    });
  }, [overlay, onUpdate]);

  // Handle mouse move on the map
  useMapEvents({
    mousemove: (e) => {
      if (!dragStart.current) return;
      
      // Edge panning
      checkEdgePan(e.originalEvent.clientX, e.originalEvent.clientY);
      
      if (isRotating.current) {
        const startAngle = calculateAngle(overlay.centroid, dragStart.current.latlng);
        const currentAngle = calculateAngle(overlay.centroid, e.latlng);
        const deltaAngle = currentAngle - startAngle;
        const newRotation = dragStart.current.currentRotation + deltaAngle;
        updateGeometry(overlay.offset, newRotation);
      } else if (isDragging.current) {
        const deltaLng = e.latlng.lng - dragStart.current.latlng.lng;
        const deltaLat = e.latlng.lat - dragStart.current.latlng.lat;
        const newOffset = [
          dragStart.current.currentOffset[0] + deltaLng,
          dragStart.current.currentOffset[1] + deltaLat
        ];
        updateGeometry(newOffset, overlay.rotation);
      }
    },
    mouseup: () => {
      if (isDragging.current || isRotating.current) {
        cleanup();
      }
    }
  });

  // Cleanup function
  const cleanup = useCallback(() => {
    isDragging.current = false;
    isRotating.current = false;
    dragStart.current = null;
    lastTouchDistance.current = null;
    lastTouchAngle.current = null;
    stopEdgePan();
    map.dragging.enable();
    L.DomUtil.removeClass(map.getContainer(), 'dragging-overlay');
    L.DomUtil.removeClass(map.getContainer(), 'rotating-overlay');
  }, [map, stopEdgePan]);

  // Global event handlers
  useEffect(() => {
    const container = map.getContainer();
    
    const handleGlobalMouseUp = () => {
      if (isDragging.current || isRotating.current) {
        cleanup();
      }
    };
    
    const handleTouchMove = (e) => {
      if (!dragStart.current && !isRotating.current && !isDragging.current) return;
      
      const touches = e.touches;
      const rect = container.getBoundingClientRect();
      
      if (touches.length === 1 && isDragging.current) {
        // Single finger drag
        const touch = touches[0];
        const latlng = map.containerPointToLatLng([
          touch.clientX - rect.left, 
          touch.clientY - rect.top
        ]);
        
        checkEdgePan(touch.clientX, touch.clientY);
        
        const deltaLng = latlng.lng - dragStart.current.latlng.lng;
        const deltaLat = latlng.lat - dragStart.current.latlng.lat;
        const newOffset = [
          dragStart.current.currentOffset[0] + deltaLng,
          dragStart.current.currentOffset[1] + deltaLat
        ];
        updateGeometry(newOffset, overlay.rotation);
      } else if (touches.length === 2 && isRotating.current) {
        // Two finger rotation
        const currentAngle = getTouchAngle(touches[0], touches[1]);
        const deltaAngle = currentAngle - lastTouchAngle.current;
        lastTouchAngle.current = currentAngle;
        
        const newRotation = (overlay.rotation || 0) + deltaAngle;
        updateGeometry(overlay.offset, newRotation);
      }
    };
    
    const handleTouchEnd = () => {
      cleanup();
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      stopEdgePan();
    };
  }, [map, overlay, cleanup, checkEdgePan, updateGeometry, stopEdgePan]);

  const onEachFeature = (feature, layer) => {
    layer.on({
      mousedown: handleMouseDown,
      touchstart: handleTouchStart,
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        onSelect(overlay.id);
      }
    });
  };

  const geojson = {
    type: 'Feature',
    properties: overlay,
    geometry: overlay.geometry
  };

  const geoKey = `${overlay.id}-${overlay.offset[0].toFixed(4)}-${overlay.offset[1].toFixed(4)}-${(overlay.rotation || 0).toFixed(4)}`;

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
export default function MapView({ overlays, selectedOverlayId, onSelectOverlay, onUpdateOverlay }) {
  return (
    <MapContainer
      center={[30, 0]}
      zoom={3}
      minZoom={2}
      maxZoom={18}
      className="map-container"
      worldCopyJump={true}
      tap={false}
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
          onSelect={onSelectOverlay}
          onUpdate={onUpdateOverlay}
        />
      ))}
    </MapContainer>
  );
}
