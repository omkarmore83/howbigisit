import * as topojson from 'topojson-client';

// URLs for accurate GeoJSON/TopoJSON data
const US_STATES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const INDIA_STATES_URL = 'https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson';
const PAKISTAN_PROVINCES_URL = 'https://raw.githubusercontent.com/PakData/GISData/master/PAK-GeoJSON/PAK_adm1.json';

// State areas in km² (accurate data)
const STATE_AREAS = {
  // US States
  'Alabama': 135767, 'Alaska': 1723337, 'Arizona': 295234, 'Arkansas': 137732,
  'California': 423967, 'Colorado': 269601, 'Connecticut': 14357, 'Delaware': 6446,
  'Florida': 170312, 'Georgia': 153910, 'Hawaii': 28313, 'Idaho': 216443,
  'Illinois': 149995, 'Indiana': 94326, 'Iowa': 145746, 'Kansas': 213100,
  'Kentucky': 104656, 'Louisiana': 135659, 'Maine': 91633, 'Maryland': 32131,
  'Massachusetts': 27336, 'Michigan': 250487, 'Minnesota': 225163, 'Mississippi': 125438,
  'Missouri': 180540, 'Montana': 380831, 'Nebraska': 200330, 'Nevada': 286380,
  'New Hampshire': 24214, 'New Jersey': 22591, 'New Mexico': 314917, 'New York': 141297,
  'North Carolina': 139391, 'North Dakota': 183108, 'Ohio': 116098, 'Oklahoma': 181037,
  'Oregon': 254799, 'Pennsylvania': 119280, 'Rhode Island': 4001, 'South Carolina': 82933,
  'South Dakota': 199729, 'Tennessee': 109153, 'Texas': 695662, 'Utah': 219882,
  'Vermont': 24906, 'Virginia': 110787, 'Washington': 184661, 'West Virginia': 62756,
  'Wisconsin': 169635, 'Wyoming': 253335, 'District of Columbia': 177,
  // India States
  'Andhra Pradesh': 162975, 'Arunachal Pradesh': 83743, 'Assam': 78438, 'Bihar': 94163,
  'Chhattisgarh': 135192, 'Goa': 3702, 'Gujarat': 196024, 'Haryana': 44212,
  'Himachal Pradesh': 55673, 'Jharkhand': 79716, 'Karnataka': 191791, 'Kerala': 38863,
  'Madhya Pradesh': 308252, 'Maharashtra': 307713, 'Manipur': 22327, 'Meghalaya': 22429,
  'Mizoram': 21081, 'Nagaland': 16579, 'Odisha': 155707, 'Punjab': 50362,
  'Rajasthan': 342239, 'Sikkim': 7096, 'Tamil Nadu': 130060, 'Telangana': 112077,
  'Tripura': 10486, 'Uttar Pradesh': 240928, 'Uttarakhand': 53483, 'West Bengal': 88752,
  'Delhi': 1484, 'Jammu and Kashmir': 222236, 'Ladakh': 59146,
  // Pakistan Provinces
  'Balochistan': 347190, 'Khyber Pakhtunkhwa': 101741, 'Punjab': 205344, 'Sindh': 140914,
  'Islamabad Capital Territory': 906, 'Gilgit-Baltistan': 72971, 'Azad Kashmir': 13297,
  'F.A.T.A.': 27220, 'Federally Administered Tribal Areas': 27220
};

// US state codes
const US_STATE_CODES = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
};

let cachedUSStates = null;
let cachedIndiaStates = null;
let cachedPakistanProvinces = null;

export async function loadUSStates() {
  if (cachedUSStates) return cachedUSStates;
  
  try {
    const response = await fetch(US_STATES_URL);
    const topology = await response.json();
    const geojson = topojson.feature(topology, topology.objects.states);
    
    // Add properties
    cachedUSStates = {
      type: 'FeatureCollection',
      features: geojson.features.map(feature => {
        const name = feature.properties.name;
        return {
          ...feature,
          properties: {
            name: name,
            code: US_STATE_CODES[name] || name.substring(0, 2).toUpperCase(),
            country: 'US',
            area_km2: STATE_AREAS[name] || 100000
          }
        };
      }).filter(f => f.properties.name) // Filter out any without names
    };
    
    return cachedUSStates;
  } catch (error) {
    console.error('Failed to load US states:', error);
    return { type: 'FeatureCollection', features: [] };
  }
}

export async function loadIndiaStates() {
  if (cachedIndiaStates) return cachedIndiaStates;
  
  try {
    const response = await fetch(INDIA_STATES_URL);
    const geojson = await response.json();
    
    cachedIndiaStates = {
      type: 'FeatureCollection',
      features: geojson.features.map(feature => {
        const name = feature.properties.NAME_1 || feature.properties.name || feature.properties.NAME;
        return {
          ...feature,
          properties: {
            name: name,
            code: name ? name.substring(0, 2).toUpperCase() : 'XX',
            country: 'IN',
            area_km2: STATE_AREAS[name] || 50000
          }
        };
      }).filter(f => f.properties.name)
    };
    
    return cachedIndiaStates;
  } catch (error) {
    console.error('Failed to load India states:', error);
    return { type: 'FeatureCollection', features: [] };
  }
}

export async function loadPakistanProvinces() {
  if (cachedPakistanProvinces) return cachedPakistanProvinces;
  
  try {
    const response = await fetch(PAKISTAN_PROVINCES_URL);
    const geojson = await response.json();
    
    cachedPakistanProvinces = {
      type: 'FeatureCollection',
      features: geojson.features.map(feature => {
        const name = feature.properties.NAME_1 || feature.properties.name || feature.properties.NAME;
        return {
          ...feature,
          properties: {
            name: name,
            code: name ? name.substring(0, 2).toUpperCase() : 'XX',
            country: 'PK',
            area_km2: STATE_AREAS[name] || 50000
          }
        };
      }).filter(f => f.properties.name)
    };
    
    return cachedPakistanProvinces;
  } catch (error) {
    console.error('Failed to load Pakistan provinces:', error);
    return { type: 'FeatureCollection', features: [] };
  }
}

export async function loadAllStates() {
  const [usStates, indiaStates, pakistanProvinces] = await Promise.all([
    loadUSStates(),
    loadIndiaStates(),
    loadPakistanProvinces()
  ]);
  
  return {
    type: 'FeatureCollection',
    features: [...usStates.features, ...indiaStates.features, ...pakistanProvinces.features]
  };
}

export function getStateArea(name) {
  return STATE_AREAS[name] || null;
}
