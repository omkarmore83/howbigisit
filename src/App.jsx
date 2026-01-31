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

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isLoading
  } = useStateSearch();

  const handleSelectState = (stateFeature) => {
    addOverlay(stateFeature);
  };

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
            onSelectOverlay={selectOverlay}
            onRemoveOverlay={removeOverlay}
            onClearAll={clearAllOverlays}
            onResetOverlay={resetOverlay}
          />
        </aside>
        
        <main className="map-wrapper">
          <MapView
            overlays={overlays}
            selectedOverlayId={selectedOverlayId}
            onSelectOverlay={selectOverlay}
            onUpdateOverlay={updateOverlay}
          />
        </main>
      </div>
      
      <footer className="app-footer">
        <p>
          Drag states on the map to see how the Mercator projection distorts sizes at different latitudes.
          States appear larger near the poles and smaller near the equator.
        </p>
      </footer>
    </div>
  )
}

export default App
