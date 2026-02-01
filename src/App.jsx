import { useState, useCallback } from 'react'
import './App.css'
import MapView from './components/Map/MapView'
import SearchBox from './components/Search/SearchBox'
import OverlayList from './components/Sidebar/OverlayList'
import { useMapOverlays } from './hooks/useMapOverlays'
import { useStateSearch } from './hooks/useStateSearch'

function App() {
  const {
    overlays,
    selectedOverlayId,
    addOverlay,
    removeOverlay,
    updateOverlay,
    clearAllOverlays,
    resetOverlay,
    selectOverlay
  } = useMapOverlays();

  const [editModeId, setEditModeId] = useState(null);

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isLoading
  } = useStateSearch();

  const handleSelectState = (stateFeature) => {
    addOverlay(stateFeature);
  };

  // Handle overlay selection - with optional toggle for edit mode
  const handleSelectOverlay = useCallback((id, toggleEditMode = false) => {
    selectOverlay(id);
    if (toggleEditMode) {
      setEditModeId(prev => prev === id ? null : id);
    }
  }, [selectOverlay]);

  // Exit edit mode when removing overlay
  const handleRemoveOverlay = useCallback((id) => {
    if (editModeId === id) {
      setEditModeId(null);
    }
    removeOverlay(id);
  }, [editModeId, removeOverlay]);

  // Exit edit mode when clearing all
  const handleClearAll = useCallback(() => {
    setEditModeId(null);
    clearAllOverlays();
  }, [clearAllOverlays]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🗺️ True Size Comparison</h1>
        <p className="subtitle">Compare US & India state sizes on the map</p>
      </header>
      
      <div className="app-content">
        <aside className="sidebar">
          <SearchBox
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            onSelectState={handleSelectState}
            isLoading={isLoading}
          />
          
          <OverlayList
            overlays={overlays}
            selectedOverlayId={selectedOverlayId}
            editModeId={editModeId}
            onSelectOverlay={handleSelectOverlay}
            onRemoveOverlay={handleRemoveOverlay}
            onClearAll={handleClearAll}
            onResetOverlay={resetOverlay}
            onToggleEditMode={(id) => setEditModeId(prev => prev === id ? null : id)}
          />
        </aside>
        
        <main className="map-wrapper">
          <MapView
            overlays={overlays}
            selectedOverlayId={selectedOverlayId}
            editModeId={editModeId}
            onSelectOverlay={handleSelectOverlay}
            onUpdateOverlay={updateOverlay}
          />
          {editModeId && (
            <div className="edit-mode-banner">
              ✏️ Edit mode: Drag to move • Double-tap to exit
            </div>
          )}
        </main>
      </div>
      
      <footer className="app-footer">
        <p>
          Double-tap a state to enter edit mode. Drag to move, two-finger rotate.
          States appear larger near the poles (Mercator distortion).
        </p>
      </footer>
    </div>
  )
}

export default App
