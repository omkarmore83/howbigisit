import { useState, useRef, useEffect } from 'react';
import './SearchBox.css';

export default function SearchBox({ searchQuery, setSearchQuery, searchResults, onSelectState, isLoading }) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setIsOpen(searchResults.length > 0 && searchQuery.length > 0);
    setHighlightedIndex(0);
  }, [searchResults, searchQuery]);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSelectState = (state) => {
    onSelectState(state);
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (searchResults[highlightedIndex]) {
          handleSelectState(searchResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const highlightedItem = listRef.current.children[highlightedIndex];
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div className="search-box">
      <div className="search-input-wrapper">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={isLoading ? "Loading states..." : "Search for a state..."}
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => searchResults.length > 0 && setIsOpen(true)}
          disabled={isLoading}
        />
        {searchQuery && (
          <button 
            className="clear-button"
            onClick={() => {
              setSearchQuery('');
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
      
      {isOpen && (
        <ul ref={listRef} className="search-results">
          {searchResults.map((state, index) => (
            <li
              key={`${state.properties.code}-${state.properties.country}`}
              className={`search-result-item ${index === highlightedIndex ? 'highlighted' : ''}`}
              onClick={() => handleSelectState(state)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="state-name">{state.properties.name}</span>
              <span className={`country-badge ${state.properties.country.toLowerCase()}`}>
                {state.properties.country === 'US' ? '🇺🇸 USA' : '🇮🇳 India'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
