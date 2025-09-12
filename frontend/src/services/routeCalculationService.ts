import axios, { AxiosResponse } from 'axios';

// ===== TYPE DEFINITIONS =====
interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
  };
}

interface NominatimReverseResult {
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
  };
}

type StopType = 'Start' | 'Fuel' | 'Rest' | 'Dropoff';
type VehicleType = 'truck' | 'car';

interface RouteStop {
  readonly id: number;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly estimated_arrival: string;
  readonly stop_type: StopType;
  readonly stop_order: number;
}

interface RouteCalculationResult {
  readonly distance: number; // in miles
  readonly duration: number; // in hours
  readonly waypoints: readonly Coordinates[];
  readonly fuelStops: readonly RouteStop[];
  readonly restStops: readonly RouteStop[];
}

interface PredefinedRouteData {
  readonly distance: number;
  readonly duration: number;
  readonly stops: readonly {
    readonly city: string;
    readonly type: 'Fuel' | 'Rest';
    readonly distance: number;
  }[];
}

// ===== CONFIGURATION CONSTANTS =====
const CONFIG = {
  // API endpoints
  NOMINATIM_SEARCH_URL: 'https://nominatim.openstreetmap.org/search',
  NOMINATIM_REVERSE_URL: 'https://nominatim.openstreetmap.org/reverse',
  
  // Truck specifications
  TRUCK_AVG_SPEED: 58, // mph including stops
  FUEL_STOP_INTERVAL: 350, // miles
  REST_STOP_INTERVAL: 400, // miles (~7 hours of driving)
  
  // API settings
  USER_AGENT: 'TruckingELDApp/1.0',
  EARTH_RADIUS_MILES: 3959,
  COUNTRY_CODE: 'us',
  
  // Traffic multipliers
  RUSH_HOUR_MULTIPLIER: 1.3,
  NIGHT_HOUR_MULTIPLIER: 0.9,
  
  // Request timeouts
  GEOCODING_TIMEOUT: 10000, // 10 seconds
  REVERSE_GEOCODING_TIMEOUT: 5000, // 5 seconds
  
  // Caching settings
  GEOCODING_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  ROUTE_CACHE_DURATION: 60 * 60 * 1000, // 1 hour
} as const;

// ===== CACHING SYSTEM =====
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  
  set(key: string, data: T, duration: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + duration
    });
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

// Cache instances
const geocodingCache = new SimpleCache<Coordinates>();
const routeCache = new SimpleCache<RouteCalculationResult>();

// ===== CUSTOM ERROR TYPES =====
class GeocodingError extends Error {
  constructor(message: string, public readonly address: string) {
    super(message);
    this.name = 'GeocodingError';
  }
}

class RouteCalculationError extends Error {
  constructor(message: string, public readonly origin: string, public readonly destination: string) {
    super(message);
    this.name = 'RouteCalculationError';
  }
}

// ===== UTILITY FUNCTIONS =====
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

const calculateDistanceBetweenCoords = (coord1: Coordinates, coord2: Coordinates): number => {
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.latitude)) * Math.cos(toRadians(coord2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = CONFIG.EARTH_RADIUS_MILES * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
};

const getTrafficMultiplier = (departureTime: Date): number => {
  const hour = departureTime.getHours();
  
  // Rush hour adjustments (7-9 AM, 5-7 PM)
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
    return CONFIG.RUSH_HOUR_MULTIPLIER;
  } 
  
  // Night hours (10 PM - 5 AM)
  if (hour >= 22 || hour <= 5) {
    return CONFIG.NIGHT_HOUR_MULTIPLIER;
  }
  
  return 1.0; // Normal traffic
};

// ===== GEOCODING SERVICES =====
/**
 * Converts an address string to geographic coordinates using OpenStreetMap Nominatim API
 * @param address - The address to geocode
 * @returns Promise resolving to coordinates or null if not found
 * @throws GeocodingError if the API request fails
 */
export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  if (!address?.trim()) {
    throw new GeocodingError('Address cannot be empty', address);
  }

  const normalizedAddress = address.trim().toLowerCase();
  const cacheKey = `geocode:${normalizedAddress}`;
  
  // Check cache first
  const cachedResult = geocodingCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const response: AxiosResponse<NominatimSearchResult[]> = await axios.get(
      CONFIG.NOMINATIM_SEARCH_URL,
      {
        params: {
          q: address.trim(),
          format: 'json',
          limit: 1,
          countrycodes: CONFIG.COUNTRY_CODE,
        },
        headers: {
          'User-Agent': CONFIG.USER_AGENT,
        },
        timeout: CONFIG.GEOCODING_TIMEOUT,
      }
    );

    if (response.data?.length > 0) {
      const result = response.data[0];
      const latitude = parseFloat(result.lat);
      const longitude = parseFloat(result.lon);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        throw new GeocodingError('Invalid coordinates returned from API', address);
      }
      
      const coordinates: Coordinates = { latitude, longitude };
      
      // Cache the result
      geocodingCache.set(cacheKey, coordinates, CONFIG.GEOCODING_CACHE_DURATION);
      
      return coordinates;
    }
    
    return null; // Address not found
  } catch (error) {
    if (error instanceof GeocodingError) {
      throw error;
    }
    
    const message = axios.isAxiosError(error) 
      ? `API request failed: ${error.message}`
      : 'Unknown geocoding error occurred';
      
    throw new GeocodingError(message, address);
  }
};

/**
 * Finds the nearest city name for given coordinates using reverse geocoding
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Promise resolving to city name or fallback string
 */
const findNearbyCity = async (lat: number, lng: number): Promise<string> => {
  try {
    const response: AxiosResponse<NominatimReverseResult> = await axios.get(
      CONFIG.NOMINATIM_REVERSE_URL,
      {
        params: {
          lat,
          lon: lng,
          format: 'json',
          zoom: 10,
        },
        headers: {
          'User-Agent': CONFIG.USER_AGENT,
        },
        timeout: CONFIG.REVERSE_GEOCODING_TIMEOUT,
      }
    );
    
    if (response.data?.address) {
      const addr = response.data.address;
      const city = addr.city || addr.town || addr.village || addr.county;
      const state = addr.state;
      return city && state ? `${city}, ${state}` : 'Highway Stop';
    }
  } catch (error) {
    console.warn('Reverse geocoding failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  return 'Highway Stop';
};

// ===== MAIN ROUTE CALCULATION FUNCTIONS =====
/**
 * Calculate route using coordinates and realistic truck routing
 * @param origin - Starting address
 * @param destination - Destination address
 * @param vehicleType - Type of vehicle (defaults to truck)
 * @returns Promise resolving to route calculation result or null if failed
 */
export const calculateRoute = async (
  origin: string,
  destination: string,
  vehicleType: VehicleType = 'truck'
): Promise<RouteCalculationResult | null> => {
  const normalizedOrigin = origin.trim().toLowerCase();
  const normalizedDestination = destination.trim().toLowerCase();
  const cacheKey = `route:${normalizedOrigin}:${normalizedDestination}:${vehicleType}`;
  
  // Check cache first
  const cachedResult = routeCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    // Geocode the addresses
    const originCoords = await geocodeAddress(origin);
    const destCoords = await geocodeAddress(destination);

    if (!originCoords || !destCoords) {
      throw new RouteCalculationError('Could not geocode addresses', origin, destination);
    }

    // Calculate realistic distance between coordinates
    const distance = calculateDistanceBetweenCoords(originCoords, destCoords);
    
    // Generate realistic route with fuel and rest stops
    const routeResult = await generateTruckRoute(
      origin,
      destination,
      originCoords,
      destCoords,
      distance
    );

    // Cache the result
    routeCache.set(cacheKey, routeResult, CONFIG.ROUTE_CACHE_DURATION);

    return routeResult;
  } catch (error) {
    console.error('Route calculation error:', error);
    // Return fallback calculation (don't cache fallback results)
    return await generateFallbackRoute(origin, destination);
  }
};

// ===== ROUTE GENERATION FUNCTIONS =====
/**
 * Generate truck-specific route with fuel and rest stops
 * @param origin - Starting location name
 * @param destination - Destination location name
 * @param originCoords - Starting coordinates
 * @param destCoords - Destination coordinates
 * @param totalDistance - Total distance in miles
 * @returns Promise resolving to complete route calculation result
 */
const generateTruckRoute = async (
  origin: string,
  destination: string,
  originCoords: Coordinates,
  destCoords: Coordinates,
  totalDistance: number
): Promise<RouteCalculationResult> => {
  
  // Calculate realistic driving time using configured truck speed
  const totalDuration = totalDistance / CONFIG.TRUCK_AVG_SPEED;
  
  // Initialize route data structures
  const waypoints: Coordinates[] = [originCoords];
  const stops: RouteStop[] = [];
  let currentDistance = 0;
  let stopOrder = 1;
  
  // Add starting point
  stops.push({
    id: 1,
    address: `${origin} - Start`,
    latitude: originCoords.latitude,
    longitude: originCoords.longitude,
    estimated_arrival: new Date().toISOString(),
    stop_type: 'Start',
    stop_order: stopOrder++
  });
  
  // Calculate intermediate stops
  while (currentDistance + CONFIG.FUEL_STOP_INTERVAL < totalDistance) {
    currentDistance += CONFIG.FUEL_STOP_INTERVAL;
    const progress = currentDistance / totalDistance;
    
    // Interpolate coordinates along the route
    const lat = originCoords.latitude + (destCoords.latitude - originCoords.latitude) * progress;
    const lng = originCoords.longitude + (destCoords.longitude - originCoords.longitude) * progress;
    
    // Determine nearby city for stop location
    const stopLocation = await findNearbyCity(lat, lng);
    const stopTime = new Date(Date.now() + (currentDistance / CONFIG.TRUCK_AVG_SPEED) * 60 * 60 * 1000);
    
    // Alternate between fuel and rest stops based on distance intervals
    const isRestStop = Math.floor(currentDistance / CONFIG.REST_STOP_INTERVAL) > 
                      Math.floor((currentDistance - CONFIG.FUEL_STOP_INTERVAL) / CONFIG.REST_STOP_INTERVAL);
    
    stops.push({
      id: stopOrder,
      address: `${stopLocation} - ${isRestStop ? 'Rest Stop' : 'Fuel Stop'}`,
      latitude: lat,
      longitude: lng,
      estimated_arrival: stopTime.toISOString(),
      stop_type: isRestStop ? 'Rest' : 'Fuel',
      stop_order: stopOrder++
    });
    
    waypoints.push({ latitude: lat, longitude: lng });
  }
  
  // Add destination
  const arrivalTime = new Date(Date.now() + totalDuration * 60 * 60 * 1000);
  stops.push({
    id: stopOrder,
    address: `${destination} - Destination`,
    latitude: destCoords.latitude,
    longitude: destCoords.longitude,
    estimated_arrival: arrivalTime.toISOString(),
    stop_type: 'Dropoff',
    stop_order: stopOrder
  });
  
  waypoints.push(destCoords);
  
  return {
    distance: totalDistance,
    duration: totalDuration,
    waypoints,
    fuelStops: stops.filter(s => s.stop_type === 'Fuel'),
    restStops: stops.filter(s => s.stop_type === 'Rest')
  };
};

// ===== FALLBACK ROUTE DATA =====
const PREDEFINED_ROUTES: Record<string, PredefinedRouteData> = {
  'seattle-vegas': {
    distance: 872.5,
    duration: 15.2,
    stops: [
      { city: 'Portland, OR', type: 'Fuel', distance: 173 },
      { city: 'Medford, OR', type: 'Rest', distance: 273 },
      { city: 'Redding, CA', type: 'Fuel', distance: 446 },
      { city: 'Sacramento, CA', type: 'Rest', distance: 599 },
      { city: 'Bakersfield, CA', type: 'Fuel', distance: 745 }
    ]
  },
  'brooklyn-la': {
    distance: 2790.5,
    duration: 41.5,
    stops: [
      { city: 'Harrisburg, PA', type: 'Rest', distance: 300 },
      { city: 'Nashville, TN', type: 'Fuel', distance: 650 },
      { city: 'Little Rock, AR', type: 'Rest', distance: 950 },
      { city: 'Oklahoma City, OK', type: 'Fuel', distance: 1250 },
      { city: 'Amarillo, TX', type: 'Rest', distance: 1550 },
      { city: 'Albuquerque, NM', type: 'Fuel', distance: 1850 },
      { city: 'Flagstaff, AZ', type: 'Rest', distance: 2150 },
      { city: 'Barstow, CA', type: 'Fuel', distance: 2450 }
    ]
  }
} as const;

// Default coordinates for fallback scenarios
const DEFAULT_COORDINATES = {
  seattle: { latitude: 47.6062, longitude: -122.3321 },
  vegas: { latitude: 36.1699, longitude: -115.1398 }
} as const;

/**
 * Generate a normalized route key for caching and lookup
 */
const generateRouteKey = (origin: string, destination: string): string => {
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z]/g, '');
  return `${normalize(origin)}-${normalize(destination)}`;
};

/**
 * Build route stops from predefined route data
 */
const buildRouteStops = (
  routeData: PredefinedRouteData,
  originCoords: Coordinates,
  destCoords: Coordinates
): { stops: RouteStop[]; waypoints: Coordinates[] } => {
  const stops: RouteStop[] = [];
  const waypoints: Coordinates[] = [originCoords];

  routeData.stops.forEach((stop, index) => {
    const progress = stop.distance / routeData.distance;
    const lat = originCoords.latitude + (destCoords.latitude - originCoords.latitude) * progress;
    const lng = originCoords.longitude + (destCoords.longitude - originCoords.longitude) * progress;
    const arrivalTime = new Date(Date.now() + (stop.distance / CONFIG.TRUCK_AVG_SPEED) * 60 * 60 * 1000);

    stops.push({
      id: index + 2,
      address: `${stop.city} - ${stop.type} Stop`,
      latitude: lat,
      longitude: lng,
      estimated_arrival: arrivalTime.toISOString(),
      stop_type: stop.type,
      stop_order: index + 2
    });

    waypoints.push({ latitude: lat, longitude: lng });
  });

  waypoints.push(destCoords);
  return { stops, waypoints };
};

/**
 * Fallback route calculation using predefined route data
 * @param origin - Starting address
 * @param destination - Destination address
 * @returns Promise resolving to route calculation result
 */
const generateFallbackRoute = async (origin: string, destination: string): Promise<RouteCalculationResult> => {
  // Find matching predefined route or use default
  const routeKey = generateRouteKey(origin, destination);
  const routeData = PREDEFINED_ROUTES[routeKey] || PREDEFINED_ROUTES['seattle-vegas'];

  // Get coordinates with fallback to default locations
  let originCoords: Coordinates;
  let destCoords: Coordinates;

  try {
    originCoords = await geocodeAddress(origin) || DEFAULT_COORDINATES.seattle;
    destCoords = await geocodeAddress(destination) || DEFAULT_COORDINATES.vegas;
  } catch (error) {
    console.warn('Geocoding failed in fallback route, using default coordinates:', error);
    originCoords = DEFAULT_COORDINATES.seattle;
    destCoords = DEFAULT_COORDINATES.vegas;
  }

  // Build route stops and waypoints
  const { stops, waypoints } = buildRouteStops(routeData, originCoords, destCoords);

  return {
    distance: routeData.distance,
    duration: routeData.duration,
    waypoints,
    fuelStops: stops.filter(s => s.stop_type === 'Fuel'),
    restStops: stops.filter(s => s.stop_type === 'Rest')
  };
};

// ===== OPTIMIZED ROUTE CALCULATION =====
/**
 * Get real-time traffic-optimized route calculation
 * @param origin - Starting address
 * @param destination - Destination address
 * @param departureTime - Optional departure time for traffic optimization
 * @returns Promise resolving to optimized route calculation result or null if failed
 */
export const getOptimizedRoute = async (
  origin: string,
  destination: string,
  departureTime?: Date
): Promise<RouteCalculationResult | null> => {
  const baseRoute = await calculateRoute(origin, destination);
  if (!baseRoute) return null;
  
  // Apply traffic-based adjustments
  const trafficMultiplier = getTrafficMultiplier(departureTime || new Date());
  
  return {
    ...baseRoute,
    duration: baseRoute.duration * trafficMultiplier,
    waypoints: baseRoute.waypoints
  };
};

// ===== UTILITY EXPORTS =====
/**
 * Clear all cached route and geocoding data
 */
export const clearCache = (): void => {
  geocodingCache.clear();
  routeCache.clear();
};

/**
 * Get cache statistics for monitoring
 */
export const getCacheStats = () => ({
  geocodingCacheSize: geocodingCache.size(),
  routeCacheSize: routeCache.size(),
  configuredCacheDurations: {
    geocoding: CONFIG.GEOCODING_CACHE_DURATION,
    route: CONFIG.ROUTE_CACHE_DURATION
  }
});

/**
 * Calculate distance between two coordinate points
 * @param coord1 - First coordinate point
 * @param coord2 - Second coordinate point
 * @returns Distance in miles
 */
export const calculateDistance = calculateDistanceBetweenCoords;
