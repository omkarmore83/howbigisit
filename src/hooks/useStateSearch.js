import { useState, useMemo, useCallback, useEffect } from 'react';
import { loadAllStates } from '../data/stateLoader';

export function useStateSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [allStates, setAllStates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load states on mount
  useEffect(() => {
    let mounted = true;
    
    async function loadStates() {
      setIsLoading(true);
      try {
        const data = await loadAllStates();
        if (mounted) {
          const states = data.features.map(f => ({
            ...f,
            searchKey: `${f.properties.name} ${f.properties.code} ${
              f.properties.country === 'US' ? 'USA United States' : 
              f.properties.country === 'IN' ? 'India' :
              f.properties.country === 'PK' ? 'Pakistan' : 'China'
            } `.toLowerCase()
          })).sort((a, b) => a.properties.name.localeCompare(b.properties.name));
          setAllStates(states);
        }
      } catch (error) {
        console.error('Failed to load states:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    
    loadStates();
    return () => { mounted = false; };
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || allStates.length === 0) {
      return [];
    }
    
    const query = searchQuery.toLowerCase().trim();
    const results = allStates.filter(state => 
      state.searchKey.includes(query)
    );
    
    // Sort by relevance - exact matches first, then starts with, then contains
    return results.sort((a, b) => {
      const aName = a.properties.name.toLowerCase();
      const bName = b.properties.name.toLowerCase();
      
      const aExact = aName === query;
      const bExact = bName === query;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;
      
      const aStarts = aName.startsWith(query);
      const bStarts = bName.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;
      
      return aName.localeCompare(bName);
    }).slice(0, 10); // Limit to 10 results
  }, [searchQuery, allStates]);

  const getStateByCode = useCallback((code, country) => {
    return allStates.find(s => 
      s.properties.code === code && s.properties.country === country
    );
  }, [allStates]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    allStates,
    getStateByCode,
    isLoading
  };
}
