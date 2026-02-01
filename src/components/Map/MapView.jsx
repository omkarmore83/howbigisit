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
const EDGE_PAN_THRESHOLD = 50;
const EDGE_PAN_SPEED = 15;

// Global touch state - persists across re-renders
const touchState = {
  activeOverlayId: null,
  isDragging: false,
  isRotating: false,
  dragStart: null,
  lastTouchAngle: null,
  edgePanInterval: null
};

// Component to handle draggable overlays with touch support
function DraggableOverlay({ overlay, isSelected, onSelect, onUpdate }) {
  const map = useMap();
  const isDragging = useRef(false);
  const isRotating = useRef(false);
  const dragStart = useRef(null);
  const edgePanInterval = useRef(null);
  const lastTouchAngle = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const overlayRef = useRef(overlay);

  // Keep overlay ref updated
  overlayRef.current = overlay;

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
    
    if (clientX - rect.left < EDGE_PAN_THRESHOLD) {
      panX = -EDGE_PAN_SPEED;
    } else if (rect.right - clientX < EDGE_PAN_THRESHOLD) {
      panX = EDGE_PAN_SPEED;
    }
    
    if (clientY - rect.top < EDGE_PAN_THRESHOLD) {
      panY = -EDGE_PAN_SPEED;
    } else if (rect.bottom - clientY < EDGE_PAN_THRESHOLD) {
      panY = EDGE_PAN_SPEED;
    }
    
    if (panX !== 0 || panY !== 0) {
      if (!edgePanInterval.current) {
        edgePanInterval.current = setInterval(() => {
          map.panBy([panX, panY], { animate: false });
        }, 16);
      }
    } else {
      stopEdgePan();
    }
  }, [map, stopEdgePan]);

  // Get touch angle
  const getTouchAngle = (touch1, touch2) => {
    return Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    isDragging.current = false;
    isRotating.current = false;
    dragStart.current = null;
    lastTouchAngle.current = null;
    touchState.activeOverlayId = null;
    touchState.isDragging = false;
    touchState.isRotating = false;
    touchState.dragStart = null;
    touchState.lastTouchAngle = null;
    if (touchState.edgePanInterval) {
      clearInterval(touchState.edgePanInterval);
      touchState.edgePanInterval = null;
    }
    stopEdgePan();
    map.dragging.enable();
    L.DomUtil.removeClass(map.getContainer(), 'dragging-overlay');
    L.DomUtil.removeClass(map.getContainer(), 'rotating-overlay');
  }, [map, stopEdgePan]);

  // Update geometry
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

  // Calculate angle for rotation
  const calculateAngle = (center, point) => {
    return Math.atan2(point.lat - center[1], point.lng - center[0]);
  };

  // Start dragging
  const startDrag = useCallback((latlng, isRotationMode = false) => {
    if (isRotationMode) {
      isRotating.current = true;
      isDragging.current = false;
    } else {
      isDragging.current = true;
      isRotating.current = false;
    }
    
    const currentOverlay = overlayRef.current;
    dragStart.current = {
      latlng,
      centroid: [...currentOverlay.centroid],
      currentOffset: [...currentOverlay.offset],
      currentRotation: currentOverlay.rotation || 0
    };
    
    // Also set global touch state for document-level handlers
    touchState.activeOverlayId = overlay.id;
    touchState.isDragging = !isRotationMode;
    touchState.isRotating = isRotationMode;
    touchState.dragStart = { ...dragStart.current };
    
    map.dragging.disable();
    L.DomUtil.addClass(map.getContainer(), isRotationMode ? 'rotating-overlay' : 'dragging-overlay');
    onSelect(overlay.id);
  }, [map, overlay.id, onSelect]);

  // Handle mouse events
  useMapEvents({
    mousemove: (e) => {
      if (!dragStart.current) return;
      
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

  // Set up layer event handlers
  const onEachFeature = useCallback((feature, layer) => {
    geoJsonLayerRef.current = layer;
    
    // Mouse events
    layer.on('mousedown', (e) => {
      if (e.originalEvent.button !== 0) return;
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      startDrag(e.latlng, e.originalEvent.shiftKey);
    });
    
    layer.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      onSelect(overlay.id);
    });
  }, [startDrag, onSelect, overlay.id]);

  // Touch event handlers on the layer element
  useEffect(() => {
    const layer = geoJsonLayerRef.current;
    if (!layer) return;

    const element = layer.getElement?.();
    if (!element) return;

    const handleTouchStart = (e) => {
      const touches = e.touches;
      
      if (touches.length === 1) {
        // Single touch - start drag
        e.stopPropagation();
        e.preventDefault();
        
        const touch = touches[0];
        const rect = map.getContainer().getBoundingClientRect();
        const point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
        const latlng = map.containerPointToLatLng(point);
        
        startDrag(latlng, false);
      } else if (touches.length === 2) {
        // Two finger - rotation
        e.stopPropagation();
        e.preventDefault();
        
        isRotating.current = true;
        isDragging.current = false;
        lastTouchAngle.current = getTouchAngle(touches[0], touches[1]);
        touchState.lastTouchAngle = lastTouchAngle.current;
        
        const currentOverlay = overlayRef.current;
        dragStart.current = {
          ...dragStart.current,
          currentRotation: currentOverlay.rotation || 0
        };
        touchState.dragStart = { ...dragStart.current };
        touchState.isRotating = true;
        touchState.isDragging = false;
        
        map.dragging.disable();
        L.DomUtil.addClass(map.getContainer(), 'rotating-overlay');
        onSelect(overlay.id);
      }
    };

    // Add touch listeners with passive: false to allow preventDefault
    element.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
    };
  }, [map, overlay.id, startDrag, onSelect]);

  // Global document-level touch handlers for move/end
  useEffect(() => {
    const handleTouchMove = (e) => {
      // Only handle if this overlay is the active one
      if (touchState.activeOverlayId !== overlay.id) return;
      if (!touchState.isDragging && !touchState.isRotating) return;
      
      e.preventDefault();
      
      const touches = e.touches;
      const rect = map.getContainer().getBoundingClientRect();
      
      if (touches.length === 1 && touchState.isDragging && touchState.dragStart) {
        const touch = touches[0];
        const point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
        const latlng = map.containerPointToLatLng(point);
        
        checkEdgePan(touch.clientX, touch.clientY);
        
        const deltaLng = latlng.lng - touchState.dragStart.latlng.lng;
        const deltaLat = latlng.lat - touchState.dragStart.latlng.lat;
        const newOffset = [
          touchState.dragStart.currentOffset[0] + deltaLng,
          touchState.dragStart.currentOffset[1] + deltaLat
        ];
        updateGeometry(newOffset, overlayRef.current.rotation);
      } else if (touches.length === 2 && touchState.isRotating) {
        const currentAngle = getTouchAngle(touches[0], touches[1]);
        if (touchState.lastTouchAngle !== null) {
          const deltaAngle = currentAngle - touchState.lastTouchAngle;
          const newRotation = (overlayRef.current.rotation || 0) + deltaAngle;
          updateGeometry(overlayRef.current.offset, newRotation);
        }
        touchState.lastTouchAngle = currentAngle;
      }
    };

    const handleTouchEnd = (e) => {
      if (touchState.activeOverlayId !== overlay.id) return;
      if (touchState.isDragging || touchState.isRotating) {
        cleanup();
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [map, overlay.id, cleanup, checkEdgePan, updateGeometry]);

  // Global mouseup handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging.current || isRotating.current) {
        cleanup();
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [cleanup]);

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
          onSelect={onSelectOverlay}
          onUpdate={onUpdateOverlay}
        />
      ))}
    </MapContainer>
  );
}
