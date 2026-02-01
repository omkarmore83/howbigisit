import { useEffect, useRef, useCallback, useState } from 'react';
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

// Component to handle draggable overlays with touch support
function DraggableOverlay({ overlay, isSelected, onSelect, onUpdate, isEditMode }) {
  const map = useMap();
  const isDraggingRef = useRef(false);
  const isRotatingRef = useRef(false);
  const dragStartRef = useRef(null);
  const edgePanInterval = useRef(null);
  const lastTouchAngleRef = useRef(null);
  const geoJsonLayerRef = useRef(null);
  const overlayRef = useRef(overlay);
  const lastTapTime = useRef(0);
  const mapRef = useRef(map);
  const startRotationRef = useRef(0);

  // Keep refs updated
  overlayRef.current = overlay;
  mapRef.current = map;

  const style = {
    fillColor: overlay.color,
    fillOpacity: isSelected ? 0.6 : 0.4,
    color: isSelected ? '#333' : overlay.color,
    weight: isSelected ? 3 : 2,
    opacity: 1,
    // Visual indicator when in edit mode
    dashArray: isSelected && isEditMode ? '5, 5' : null
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
    isDraggingRef.current = false;
    isRotatingRef.current = false;
    dragStartRef.current = null;
    lastTouchAngleRef.current = null;
    startRotationRef.current = 0;
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
      isRotatingRef.current = true;
      isDraggingRef.current = false;
    } else {
      isDraggingRef.current = true;
      isRotatingRef.current = false;
    }
    
    const currentOverlay = overlayRef.current;
    dragStartRef.current = {
      latlng,
      centroid: [...currentOverlay.centroid],
      currentOffset: [...currentOverlay.offset],
      currentRotation: currentOverlay.rotation || 0
    };
    startRotationRef.current = currentOverlay.rotation || 0;
    
    map.dragging.disable();
    L.DomUtil.addClass(map.getContainer(), isRotationMode ? 'rotating-overlay' : 'dragging-overlay');
  }, [map]);

  // Handle mouse events
  useMapEvents({
    mousemove: (e) => {
      if (!dragStartRef.current) return;
      
      checkEdgePan(e.originalEvent.clientX, e.originalEvent.clientY);
      
      if (isRotatingRef.current) {
        const startAngle = calculateAngle(overlay.centroid, dragStartRef.current.latlng);
        const currentAngle = calculateAngle(overlay.centroid, e.latlng);
        const deltaAngle = currentAngle - startAngle;
        const newRotation = dragStartRef.current.currentRotation + deltaAngle;
        updateGeometry(overlay.offset, newRotation);
      } else if (isDraggingRef.current) {
        const deltaLng = e.latlng.lng - dragStartRef.current.latlng.lng;
        const deltaLat = e.latlng.lat - dragStartRef.current.latlng.lat;
        const newOffset = [
          dragStartRef.current.currentOffset[0] + deltaLng,
          dragStartRef.current.currentOffset[1] + deltaLat
        ];
        updateGeometry(newOffset, overlay.rotation);
      }
    },
    mouseup: () => {
      if (isDraggingRef.current || isRotatingRef.current) {
        cleanup();
      }
    }
  });

  // Set up layer event handlers
  const onEachFeature = useCallback((feature, layer) => {
    geoJsonLayerRef.current = layer;
    
    // Mouse events - desktop
    layer.on('mousedown', (e) => {
      if (e.originalEvent.button !== 0) return;
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      onSelect(overlay.id);
      if (isEditMode) {
        startDrag(e.latlng, e.originalEvent.shiftKey);
      }
    });
    
    // Double click to toggle edit mode
    layer.on('dblclick', (e) => {
      L.DomEvent.stopPropagation(e);
      onSelect(overlay.id, true); // true = toggle edit mode
    });
  }, [startDrag, onSelect, overlay.id, isEditMode]);

  // Touch event handlers - double tap to select, then drag works
  // Only touchstart is on the element; move/end are on document to persist across re-renders
  useEffect(() => {
    const layer = geoJsonLayerRef.current;
    if (!layer) return;

    const element = layer.getElement?.();
    if (!element) return;

    const handleTouchStart = (e) => {
      const touches = e.touches;
      const now = Date.now();
      
      if (touches.length === 1) {
        const touch = touches[0];
        
        // Check for double tap (within 300ms)
        if (now - lastTapTime.current < 300) {
          // Double tap - toggle edit mode
          e.stopPropagation();
          e.preventDefault();
          onSelect(overlay.id, true);
          lastTapTime.current = 0;
          return;
        }
        
        lastTapTime.current = now;
        
        // If in edit mode, start dragging
        if (isEditMode && isSelected) {
          e.stopPropagation();
          e.preventDefault();
          
          const rect = map.getContainer().getBoundingClientRect();
          const point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
          const latlng = map.containerPointToLatLng(point);
          
          startDrag(latlng, false);
        }
      } else if (touches.length === 2 && isEditMode && isSelected) {
        // Two finger rotation in edit mode
        e.stopPropagation();
        e.preventDefault();
        
        isRotatingRef.current = true;
        isDraggingRef.current = false;
        lastTouchAngleRef.current = getTouchAngle(touches[0], touches[1]);
        startRotationRef.current = overlayRef.current.rotation || 0;
        
        const currentOverlay = overlayRef.current;
        dragStartRef.current = {
          latlng: null,
          centroid: [...currentOverlay.centroid],
          currentOffset: [...currentOverlay.offset],
          currentRotation: currentOverlay.rotation || 0
        };
        
        map.dragging.disable();
        L.DomUtil.addClass(map.getContainer(), 'rotating-overlay');
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
    };
  }, [map, overlay.id, isEditMode, isSelected, startDrag, onSelect]);

  // Document-level touch move/end handlers - these persist across GeoJSON re-renders
  useEffect(() => {
    const handleTouchMove = (e) => {
      if (!isDraggingRef.current && !isRotatingRef.current) return;
      
      e.preventDefault();
      
      const touches = e.touches;
      const currentMap = mapRef.current;
      const rect = currentMap.getContainer().getBoundingClientRect();
      
      if (touches.length === 1 && isDraggingRef.current && dragStartRef.current) {
        const touch = touches[0];
        const point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
        const latlng = currentMap.containerPointToLatLng(point);
        
        checkEdgePan(touch.clientX, touch.clientY);
        
        const deltaLng = latlng.lng - dragStartRef.current.latlng.lng;
        const deltaLat = latlng.lat - dragStartRef.current.latlng.lat;
        const newOffset = [
          dragStartRef.current.currentOffset[0] + deltaLng,
          dragStartRef.current.currentOffset[1] + deltaLat
        ];
        updateGeometry(newOffset, dragStartRef.current.currentRotation);
      } else if (touches.length === 2 && isRotatingRef.current) {
        const currentAngle = getTouchAngle(touches[0], touches[1]);
        if (lastTouchAngleRef.current !== null) {
          const deltaAngle = currentAngle - lastTouchAngleRef.current;
          // Accumulate rotation from start
          const newRotation = startRotationRef.current + deltaAngle;
          startRotationRef.current = newRotation;
          updateGeometry(dragStartRef.current.currentOffset, newRotation);
        }
        lastTouchAngleRef.current = currentAngle;
      }
    };

    const handleTouchEnd = () => {
      if (isDraggingRef.current || isRotatingRef.current) {
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
  }, [cleanup, checkEdgePan, updateGeometry]);

  // Global mouseup handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current || isRotatingRef.current) {
        cleanup();
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [cleanup]);

  // Update layer geometry when overlay changes (for smooth dragging without key change)
  useEffect(() => {
    const layer = geoJsonLayerRef.current;
    if (!layer) return;
    
    const geojsonData = {
      type: 'Feature',
      properties: overlay,
      geometry: overlay.geometry
    };
    
    // Clear and re-add data to update the geometry
    layer.clearLayers();
    layer.addData(geojsonData);
    
    // Re-apply style
    layer.setStyle(style);
  }, [overlay.geometry, overlay.offset, overlay.rotation, style]);

  const geojson = {
    type: 'Feature',
    properties: overlay,
    geometry: overlay.geometry
  };

  // Use stable key - only changes when overlay is added/removed, not during drag
  const geoKey = overlay.id;

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
