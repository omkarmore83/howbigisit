import * as topojson from 'topojson-client';

// URLs for accurate GeoJSON/TopoJSON data
const US_STATES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const INDIA_STATES_URL = 'https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson';
const PAKISTAN_PROVINCES_URL = 'https://raw.githubusercontent.com/PakData/GISData/master/PAK-GeoJSON/PAK_adm1.json';
const CHINA_PROVINCES_URL = 'https://geojson.cn/api/china/100000.json';
const CANADA_PROVINCES_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson';

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
  'F.A.T.A.': 27220, 'Federally Administered Tribal Areas': 27220,
  // China Provinces
  'Xinjiang': 1664900, 'Tibet': 1228400, 'Inner Mongolia': 1183000, 'Qinghai': 722300,
  'Sichuan': 486100, 'Heilongjiang': 454800, 'Gansu': 425800, 'Yunnan': 394100,
  'Guangxi': 237600, 'Hunan': 211800, 'Shaanxi': 205800, 'Hebei': 188800,
  'Jilin': 187400, 'Hubei': 185900, 'Guangdong': 179700, 'Guizhou': 176200,
  'Henan': 167000, 'Jiangxi': 166900, 'Shandong': 157100, 'Shanxi': 156700,
  'Liaoning': 148400, 'Anhui': 139400, 'Fujian': 123900, 'Jiangsu': 102600,
  'Zhejiang': 101800, 'Chongqing': 82400, 'Ningxia': 66400, 'Hainan': 35354,
  'Beijing': 16411, 'Tianjin': 11917, 'Shanghai': 6340, 'Hong Kong': 1105,
  'Macau': 30, 'Taiwan': 36193,
  // Canada Provinces and Territories
  'Nunavut': 2093190, 'Quebec': 1542056, 'Northwest Territories': 1346106,
  'British Columbia': 944735, 'Ontario': 1076395, 'Alberta': 661848,
  'Saskatchewan': 651036, 'Manitoba': 647797, 'Yukon': 482443,
  'Newfoundland and Labrador': 405212, 'New Brunswick': 72908,
  'Nova Scotia': 55284, 'Prince Edward Island': 5660
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

// Chinese province name mapping (Chinese -> English)
const CHINA_PROVINCE_NAMES = {
  '北京市': 'Beijing', '天津市': 'Tianjin', '上海市': 'Shanghai', '重庆市': 'Chongqing',
  '河北省': 'Hebei', '山西省': 'Shanxi', '辽宁省': 'Liaoning', '吉林省': 'Jilin',
  '黑龙江省': 'Heilongjiang', '江苏省': 'Jiangsu', '浙江省': 'Zhejiang', '安徽省': 'Anhui',
  '福建省': 'Fujian', '江西省': 'Jiangxi', '山东省': 'Shandong', '河南省': 'Henan',
  '湖北省': 'Hubei', '湖南省': 'Hunan', '广东省': 'Guangdong', '海南省': 'Hainan',
  '四川省': 'Sichuan', '贵州省': 'Guizhou', '云南省': 'Yunnan', '陕西省': 'Shaanxi',
  '甘肃省': 'Gansu', '青海省': 'Qinghai', '台湾省': 'Taiwan',
  '内蒙古自治区': 'Inner Mongolia', '广西壮族自治区': 'Guangxi', '西藏自治区': 'Tibet',
  '宁夏回族自治区': 'Ningxia', '新疆维吾尔自治区': 'Xinjiang',
  '香港特别行政区': 'Hong Kong', '澳门特别行政区': 'Macau'
};

// China province codes
const CHINA_PROVINCE_CODES = {
  'Beijing': 'BJ', 'Tianjin': 'TJ', 'Shanghai': 'SH', 'Chongqing': 'CQ',
  'Hebei': 'HE', 'Shanxi': 'SX', 'Liaoning': 'LN', 'Jilin': 'JL',
  'Heilongjiang': 'HL', 'Jiangsu': 'JS', 'Zhejiang': 'ZJ', 'Anhui': 'AH',
  'Fujian': 'FJ', 'Jiangxi': 'JX', 'Shandong': 'SD', 'Henan': 'HA',
  'Hubei': 'HB', 'Hunan': 'HN', 'Guangdong': 'GD', 'Hainan': 'HI',
  'Sichuan': 'SC', 'Guizhou': 'GZ', 'Yunnan': 'YN', 'Shaanxi': 'SN',
  'Gansu': 'GS', 'Qinghai': 'QH', 'Taiwan': 'TW',
  'Inner Mongolia': 'NM', 'Guangxi': 'GX', 'Tibet': 'XZ',
  'Ningxia': 'NX', 'Xinjiang': 'XJ',
  'Hong Kong': 'HK', 'Macau': 'MO'
};

// Canada province/territory codes
const CANADA_PROVINCE_CODES = {
  'Nunavut': 'NU', 'Quebec': 'QC', 'Northwest Territories': 'NT',
  'British Columbia': 'BC', 'Ontario': 'ON', 'Alberta': 'AB',
  'Saskatchewan': 'SK', 'Manitoba': 'MB', 'Yukon': 'YT',
  'Newfoundland and Labrador': 'NL', 'New Brunswick': 'NB',
  'Nova Scotia': 'NS', 'Prince Edward Island': 'PE'
};

let cachedUSStates = null;
let cachedIndiaStates = null;
let cachedPakistanProvinces = null;
let cachedChinaProvinces = null;
let cachedCanadaProvinces = null;

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

export async function loadChinaProvinces() {
  if (cachedChinaProvinces) return cachedChinaProvinces;
  
  try {
    const response = await fetch(CHINA_PROVINCES_URL);
    const geojson = await response.json();
    
    cachedChinaProvinces = {
      type: 'FeatureCollection',
      features: geojson.features.map(feature => {
        const chineseName = feature.properties.name;
        const englishName = CHINA_PROVINCE_NAMES[chineseName] || chineseName;
        return {
          ...feature,
          properties: {
            name: englishName,
            code: CHINA_PROVINCE_CODES[englishName] || englishName.substring(0, 2).toUpperCase(),
            country: 'CN',
            area_km2: STATE_AREAS[englishName] || 50000
          }
        };
      }).filter(f => f.properties.name)
    };
    
    return cachedChinaProvinces;
  } catch (error) {
    console.error('Failed to load China provinces:', error);
    return { type: 'FeatureCollection', features: [] };
  }
}

export async function loadCanadaProvinces() {
  if (cachedCanadaProvinces) return cachedCanadaProvinces;
  
  try {
    const response = await fetch(CANADA_PROVINCES_URL);
    const geojson = await response.json();
    
    cachedCanadaProvinces = {
      type: 'FeatureCollection',
      features: geojson.features.map(feature => {
        const name = feature.properties.name || feature.properties.NAME;
        return {
          ...feature,
          properties: {
            name: name,
            code: CANADA_PROVINCE_CODES[name] || name.substring(0, 2).toUpperCase(),
            country: 'CA',
            area_km2: STATE_AREAS[name] || 100000
          }
        };
      }).filter(f => f.properties.name)
    };
    
    return cachedCanadaProvinces;
  } catch (error) {
    console.error('Failed to load Canada provinces:', error);
    return { type: 'FeatureCollection', features: [] };
  }
}

export async function loadAllStates() {
  const [usStates, indiaStates, pakistanProvinces, chinaProvinces, canadaProvinces] = await Promise.all([
    loadUSStates(),
    loadIndiaStates(),
    loadPakistanProvinces(),
    loadChinaProvinces(),
    loadCanadaProvinces()
  ]);
  
  return {
    type: 'FeatureCollection',
    features: [...usStates.features, ...indiaStates.features, ...pakistanProvinces.features, ...chinaProvinces.features, ...canadaProvinces.features]
  };
}

export function getStateArea(name) {
  return STATE_AREAS[name] || null;
}
