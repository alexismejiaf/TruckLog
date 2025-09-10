import axios from 'axios';

// Configure axios instance
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Driver {
  id: number;
  name: string;
  license_number: string;
  created_at: string;
}

export interface Trip {
  id: number;
  driver: number;
  driver_name: string;
  current_location: string;
  current_location_lat: number;
  current_location_lng: number;
  pickup_location: string;
  pickup_location_lat: number;
  pickup_location_lng: number;
  dropoff_location: string;
  dropoff_location_lat: number;
  dropoff_location_lng: number;
  current_cycle_used: number;
  total_distance: number;
  estimated_duration: number;
  status: string;
  created_at: string;
  updated_at: string;
  route_stops: RouteStop[];
}

export interface RouteStop {
  id: number;
  trip: number;
  stop_order: number;
  stop_type: string;
  location: string;
  location_lat: number;
  location_lng: number;
  estimated_arrival: string;
  estimated_departure: string;
  duration_minutes: number;
  distance_from_previous: number;
  cumulative_distance: number;
  notes: string;
}

export interface TripCreateData {
  driver_id: number;
  current_location: string;
  current_location_lat: number;
  current_location_lng: number;
  pickup_location: string;
  pickup_location_lat: number;
  pickup_location_lng: number;
  dropoff_location: string;
  dropoff_location_lat: number;
  dropoff_location_lng: number;
  current_cycle_used: number;
}

export interface RouteCalculation {
  current_location: {
    lat: number;
    lng: number;
    address: string;
  };
  pickup_location: {
    lat: number;
    lng: number;
    address: string;
  };
  dropoff_location: {
    lat: number;
    lng: number;
    address: string;
  };
  current_cycle_used: number;
}

export interface ComplianceResult {
  compliant: boolean;
  violations: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  warnings: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  trip_analysis: {
    total_driving_hours: number;
    total_duty_hours: number;
    cycle_hours_needed: number;
  };
}

export interface ELDLog {
  id: number;
  trip: number;
  driver: number;
  driver_name: string;
  date: string;
  start_time: string;
  end_time: string;
  duty_status: 'off_duty' | 'sleeper' | 'driving' | 'on_duty';
  location: string;
  odometer_start: number | null;
  odometer_end: number | null;
  hours: number;
  remarks: string;
  cycle_hours_used: number;
  daily_driving_hours: number;
  daily_duty_hours: number;
  created_at: string;
}

export interface DailyLogSheet {
  id: number;
  trip: number;
  driver: number;
  driver_name: string;
  date: string;
  total_miles_driven: number;
  eld_logs: ELDLog[];
  created_at: string;
}

export interface HOSViolation {
  id: number;
  driver: number;
  driver_name: string;
  violation_type: string;
  violation_type_display: string;
  severity: string;
  severity_display: string;
  description: string;
  violation_time: string;
  resolution_notes: string;
  resolved: boolean;
}

// API Service Class
class ApiService {
  // Driver methods
  async getDrivers(): Promise<Driver[]> {
    const response = await api.get('/drivers/');
    return response.data;
  }

  async createDriver(driverData: Omit<Driver, 'id' | 'created_at'>): Promise<Driver> {
    const response = await api.post('/drivers/', driverData);
    return response.data;
  }

  // Trip methods
  async getTrips(): Promise<Trip[]> {
    const response = await api.get('/trips/');
    return response.data;
  }

  async createTrip(tripData: TripCreateData): Promise<{
    trip: Trip;
    route: any;
    compliance: ComplianceResult;
  }> {
    const response = await api.post('/trips/', tripData);
    return response.data;
  }

  // Route calculation
  async calculateRoute(routeData: RouteCalculation): Promise<any> {
    const response = await api.post('/calculate-route/', routeData);
    return response.data;
  }

  // ELD Log methods
  async getELDLogs(filters?: {
    trip_id?: number;
    driver_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<ELDLog[]> {
    const params = new URLSearchParams();
    if (filters?.trip_id) params.append('trip_id', filters.trip_id.toString());
    if (filters?.driver_id) params.append('driver_id', filters.driver_id.toString());
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    
    const response = await api.get(`/eld-logs/?${params.toString()}`);
    return response.data;
  }

  async createELDLog(logData: Omit<ELDLog, 'id' | 'driver_name' | 'created_at'>): Promise<ELDLog> {
    const response = await api.post('/eld-logs/', logData);
    return response.data;
  }

  // Daily Log Sheet methods
  async getDailyLogSheets(filters?: {
    driver_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<DailyLogSheet[]> {
    const params = new URLSearchParams();
    if (filters?.driver_id) params.append('driver_id', filters.driver_id.toString());
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    
    const response = await api.get(`/daily-logs/?${params.toString()}`);
    return response.data;
  }

  // HOS Violation methods
  async getHOSViolations(filters?: {
    driver_id?: number;
  }): Promise<HOSViolation[]> {
    const params = new URLSearchParams();
    if (filters?.driver_id) params.append('driver_id', filters.driver_id.toString());
    
    const response = await api.get(`/hos-violations/?${params.toString()}`);
    return response.data;
  }

  // Download daily log PDF
  async downloadDailyLog(logId: number): Promise<Blob> {
    const response = await api.get(`/download-daily-log/${logId}/`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Geocoding helper method
  async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    // For now, return mock coordinates based on common addresses
    // In a real app, you would use Google Maps Geocoding API
    const mockCoordinates: { [key: string]: { lat: number; lng: number } } = {
      'Phoenix, AZ': { lat: 33.4484, lng: -112.0740 },
      'Denver, CO': { lat: 39.7392, lng: -104.9903 },
      'Chicago, IL': { lat: 41.8781, lng: -87.6298 },
      'Los Angeles, CA': { lat: 34.0522, lng: -118.2437 },
      'New York, NY': { lat: 40.7128, lng: -74.0060 },
      'Miami, FL': { lat: 25.7617, lng: -80.1918 },
      'Seattle, WA': { lat: 47.6062, lng: -122.3321 },
      'Dallas, TX': { lat: 32.7767, lng: -96.7970 },
    };

    // Try to find exact match first
    if (mockCoordinates[address]) {
      return mockCoordinates[address];
    }

    // Try partial matching for state/city combinations
    for (const [key, coords] of Object.entries(mockCoordinates)) {
      if (address.toLowerCase().includes(key.toLowerCase()) || 
          key.toLowerCase().includes(address.toLowerCase())) {
        return coords;
      }
    }

    // Default to Phoenix if no match found
    return { lat: 33.4484, lng: -112.0740 };
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;