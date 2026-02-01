import { formatArea } from '../../utils/geoUtils';
import './OverlayList.css';

export default function OverlayList({ 
  overlays, 
  selectedOverlayId,
  editModeId,
  onSelectOverlay, 
  onRemoveOverlay,
  onClearAll,
  onResetOverlay,
  onToggleEditMode
}) {
  if (overlays.length === 0) {
    return (
      <div className="overlay-list empty">
        <p className="empty-message">
          Search and select states to compare their sizes on the map.
        </p>
        <p className="hint">
          <strong>Double-tap</strong> a state to move it
        </p>
      </div>
    );
  }

  return (
    <div className="overlay-list">
      <div className="overlay-list-header">
        <h3>Active Overlays ({overlays.length})</h3>
        <button className="clear-all-button" onClick={onClearAll}>
          Clear All
        </button>
      </div>
      
      <ul className="overlays">
        {overlays.map(overlay => {
          const area = formatArea(overlay.area_km2);
          const scalePercent = overlay.mercatorScale ? Math.round(overlay.mercatorScale * 100) : 100;
          const scaleChanged = scalePercent !== 100;
          const rotationDeg = overlay.rotation ? Math.round((overlay.rotation * 180) / Math.PI) : 0;
          const hasTransforms = scaleChanged || rotationDeg !== 0;
          const isEditing = overlay.id === editModeId;
          
          return (
            <li
              key={overlay.id}
              className={`overlay-item ${overlay.id === selectedOverlayId ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
              onClick={() => onSelectOverlay(overlay.id)}
            >
              <div 
                className="color-indicator" 
                style={{ backgroundColor: overlay.color }}
              />
              <div className="overlay-info">
                <span className="overlay-name">
                  {overlay.name}
                  {isEditing && <span className="edit-badge">✏️</span>}
                </span>
                <span className="overlay-details">
                  {overlay.country === 'US' ? '🇺🇸' : '🇮🇳'} · {area.km2} km² · {area.mi2} mi²
                </span>
                <div className="transform-info">
                  {scaleChanged && (
                    <span className={`scale-indicator ${scalePercent > 100 ? 'larger' : 'smaller'}`}>
                      {scalePercent}% size
                    </span>
                  )}
                  {rotationDeg !== 0 && (
                    <span className="rotation-indicator">
                      ↻ {rotationDeg}°
                    </span>
                  )}
                  {hasTransforms && onResetOverlay && (
                    <button
                      className="reset-transform-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetOverlay(overlay.id);
                      }}
                      title="Reset position and rotation"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <button
                className={`edit-button ${isEditing ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleEditMode(overlay.id);
                }}
                title={isEditing ? "Exit edit mode" : "Edit mode - drag to move"}
              >
                ✏️
              </button>
              <button
                className="remove-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveOverlay(overlay.id);
                }}
                title="Remove overlay"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      
      <div className="overlay-list-footer">
        <p className="tip">💡 <strong>Double-tap</strong> state on map or tap ✏️ to edit</p>
      </div>
    </div>
  );
}
