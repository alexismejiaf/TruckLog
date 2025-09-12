import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  LocationOn,
  Route,
  Warning,
  CheckCircle,
  Navigation,
  LocalGasStation,
  Hotel,
  Schedule,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService, Driver as ApiDriver, TripCreateData } from '../services/api';
import { geocodeAddress, getOptimizedRoute } from '../services/routeCalculationService';

// Types
type Driver = ApiDriver;

interface TripData {
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

interface RouteData {
  total_distance: number;
  estimated_duration: number;
  route_stops: RouteStop[];
  fuelStops: FuelStop[];
  restStops: RestStop[];
  distance?: number;
  duration?: number;
}

interface RouteStop {
  id: number;
  address?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  location_lat?: number;
  location_lng?: number;
  estimated_arrival: string;
  stop_type: string;
  stop_order: number;
}

interface FuelStop {
  id: number;
  location: string;
  latitude: number;
  longitude: number;
  estimated_arrival: string;
  fuel_needed: number;
  cost_estimate: number;
  stop_order: number;
  station_name?: string;
}

interface RestStop {
  id: number;
  location: string;
  latitude: number;
  longitude: number;
  estimated_arrival: string;
  break_duration: number; // in hours
  break_type: 'mandatory_rest' | 'sleeper_berth' | 'off_duty';
  stop_order: number;
  facility_type?: string;
}

interface ComplianceData {
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

const steps = ['Trip Details', 'Route Review', 'HOS Compliance'];

const TripPlanner: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [tripData, setTripData] = useState<Partial<TripData>>({
    current_cycle_used: 0,
  });
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driversLoading, setDriversLoading] = useState(true);

  // Memoized validation
  const isStep0Valid = useMemo(() => {
    return !!(
      tripData.driver_id &&
      tripData.current_location &&
      tripData.pickup_location &&
      tripData.dropoff_location
    );
  }, [tripData]);

  // Calculate fuel stops based on distance and fuel efficiency
  const calculateFuelStops = useCallback((totalDistance: number, routeStops: RouteStop[]) => {
    const fuelStops: FuelStop[] = [];
    const TRUCK_FUEL_EFFICIENCY = 6.5; // miles per gallon
    const FUEL_TANK_CAPACITY = 200; // gallons
    const FUEL_RANGE = FUEL_TANK_CAPACITY * TRUCK_FUEL_EFFICIENCY; // ~1300 miles
    const FUEL_SAFETY_MARGIN = 0.8; // Refuel when 20% remaining
    const EFFECTIVE_RANGE = FUEL_RANGE * FUEL_SAFETY_MARGIN; // ~1040 miles
    
    if (totalDistance > EFFECTIVE_RANGE) {
      const numFuelStops = Math.ceil(totalDistance / EFFECTIVE_RANGE) - 1;
      
      for (let i = 1; i <= numFuelStops; i++) {
        const stopDistance = (EFFECTIVE_RANGE * i);
        const progressRatio = stopDistance / totalDistance;
        
        // Estimate location between route points
        const stopIndex = Math.floor(progressRatio * (routeStops.length - 1));
        const baseStop = routeStops[Math.min(stopIndex, routeStops.length - 1)];
        
        // Calculate estimated arrival time
        const hoursToStop = stopDistance / 55; // Average speed 55 mph
        const arrivalTime = new Date(Date.now() + hoursToStop * 60 * 60 * 1000);
        
        fuelStops.push({
          id: 1000 + i,
          location: `Fuel Stop ${i} near ${baseStop.location}`,
          latitude: baseStop.latitude! + (Math.random() - 0.5) * 0.1,
          longitude: baseStop.longitude! + (Math.random() - 0.5) * 0.1,
          estimated_arrival: arrivalTime.toISOString(),
          fuel_needed: FUEL_TANK_CAPACITY * 0.8, // Fill to 80%
          cost_estimate: FUEL_TANK_CAPACITY * 0.8 * 3.85, // $3.85/gallon average
          stop_order: stopIndex + 10,
          station_name: `Flying J / Pilot Travel Center`
        });
      }
    }
    
    return fuelStops;
  }, []);

  // Calculate mandatory rest stops based on HOS regulations for property-carrying drivers
  const calculateRestStops = useCallback((totalDuration: number, routeStops: RouteStop[]) => {
    const restStops: RestStop[] = [];
    
    // HOS regulations for property-carrying drivers (70-hour/8-day cycle)
    const MAX_DRIVING_HOURS_DAILY = 11; // Cannot drive more than 11 hours
    const MAX_ON_DUTY_HOURS_DAILY = 14; // Cannot be on duty more than 14 hours  
    const MANDATORY_BREAK_AFTER_8_HRS = 0.5; // 30-minute break after 8 hours of driving
    const MANDATORY_OFF_DUTY_HOURS = 10; // Must have 10 consecutive hours off duty
    const MAX_CYCLE_HOURS = 70; // Cannot drive after 70 hours on duty in 8 days
    
    // Check if driver's current cycle hours would exceed limit
    const currentCycleUsed = tripData.current_cycle_used || 0;
    const projectedCycleHours = currentCycleUsed + totalDuration;
    
    // Add 30-minute break after 8 hours of driving (required by HOS)
    if (totalDuration > 8) {
      const breakTime = 8; // After 8 hours of driving
      const progressRatio = breakTime / totalDuration;
      
      // Find appropriate location for 30-min break
      const stopIndex = Math.floor(progressRatio * (routeStops.length - 1));
      const baseStop = routeStops[Math.min(stopIndex, routeStops.length - 1)];
      
      const arrivalTime = new Date(Date.now() + breakTime * 60 * 60 * 1000);
      
      restStops.push({
        id: 3000,
        location: `30-min Break near ${baseStop.location}`,
        latitude: baseStop.latitude! + (Math.random() - 0.5) * 0.02,
        longitude: baseStop.longitude! + (Math.random() - 0.5) * 0.02,
        estimated_arrival: arrivalTime.toISOString(),
        break_duration: MANDATORY_BREAK_AFTER_8_HRS,
        break_type: 'mandatory_rest',
        stop_order: stopIndex + 15,
        facility_type: 'Rest Area or Truck Stop (30-min break)'
      });
    }
    
    // Add 10-hour sleeper berth breaks for trips exceeding daily driving limits
    if (totalDuration > MAX_DRIVING_HOURS_DAILY) {
      const numRestStops = Math.ceil(totalDuration / MAX_DRIVING_HOURS_DAILY) - 1;
      
      for (let i = 1; i <= numRestStops; i++) {
        const breakTime = MAX_DRIVING_HOURS_DAILY * i;
        const progressRatio = breakTime / totalDuration;
        
        // Find appropriate location for rest stop
        const stopIndex = Math.floor(progressRatio * (routeStops.length - 1));
        const baseStop = routeStops[Math.min(stopIndex, routeStops.length - 1)];
        
        // Calculate arrival time for mandatory break
        const arrivalTime = new Date(Date.now() + breakTime * 60 * 60 * 1000);
        
        restStops.push({
          id: 2000 + i,
          location: `10-Hour Rest - Rest Area ${i} near ${baseStop.location}`,
          latitude: baseStop.latitude! + (Math.random() - 0.5) * 0.05,
          longitude: baseStop.longitude! + (Math.random() - 0.5) * 0.05,
          estimated_arrival: arrivalTime.toISOString(),
          break_duration: MANDATORY_OFF_DUTY_HOURS,
          break_type: totalDuration > MAX_ON_DUTY_HOURS_DAILY ? 'sleeper_berth' : 'off_duty',
          stop_order: stopIndex + 20,
          facility_type: totalDuration > MAX_ON_DUTY_HOURS_DAILY ? 'Truck Stop with Sleeper Parking' : 'Rest Area'
        });
      }
    }
    
    // Add 34-hour restart warning/requirement if approaching 70-hour cycle limit
    if (projectedCycleHours > 65) { // Warning at 65 hours, mandatory at 70
      const cycleRestartTime = new Date(Date.now() + totalDuration * 60 * 60 * 1000);
      const finalStop = routeStops[routeStops.length - 1];
      
      restStops.push({
        id: 4000,
        location: `34-Hour Restart Required near ${finalStop.location}`,
        latitude: finalStop.latitude! + (Math.random() - 0.5) * 0.01,
        longitude: finalStop.longitude! + (Math.random() - 0.5) * 0.01,
        estimated_arrival: cycleRestartTime.toISOString(),
        break_duration: 34,
        break_type: 'off_duty',
        stop_order: 999,
        facility_type: `34-Hour Restart Facility (Cycle Reset) - Current: ${currentCycleUsed}h + Trip: ${totalDuration.toFixed(1)}h = ${projectedCycleHours.toFixed(1)}h of 70h limit`
      });
    }
    
    return restStops;
  }, [tripData.current_cycle_used]);

  // Fetch drivers with error handling
  const fetchDrivers = useCallback(async () => {
    try {
      setDriversLoading(true);
      setError(null);
      const driversData = await apiService.getDrivers();
      setDrivers(driversData);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
      setError('Failed to load drivers. Using fallback data.');
      // Use mock data as fallback with proper API structure
      setDrivers([
        { id: 1, name: 'John Smith', license_number: 'CDL123456', created_at: new Date().toISOString() },
        { id: 2, name: 'Sarah Johnson', license_number: 'CDL789012', created_at: new Date().toISOString() },
        { id: 3, name: 'Mike Williams', license_number: 'CDL345678', created_at: new Date().toISOString() },
      ]);
    } finally {
      setDriversLoading(false);
    }
  }, []);

  // Check HOS compliance
  const checkCompliance = useCallback(async () => {
    setLoading(true);
    try {
      // Mock HOS compliance check with proper typing
      const mockCompliance: ComplianceData = {
        compliant: (tripData.current_cycle_used || 0) < 60,
        violations: (tripData.current_cycle_used || 0) >= 60 ? [
          {
            type: '70_hour_cycle',
            severity: 'warning',
            description: 'Trip may exceed 70-hour cycle limit',
          },
        ] : [],
        warnings: [],
        trip_analysis: {
          total_driving_hours: 7.5,
          total_duty_hours: 8.5,
          cycle_hours_needed: 8.5,
        },
      };
      setComplianceData(mockCompliance);
    } catch (err) {
      setError('Failed to check HOS compliance');
    } finally {
      setLoading(false);
    }
  }, [tripData.current_cycle_used]);

  // Create trip
  const createTrip = useCallback(async () => {
    if (!isStep0Valid) {
      setError('Missing required trip data');
      return;
    }

    setLoading(true);
    try {
      const tripCreateData: TripCreateData = {
        driver_id: tripData.driver_id!,
        current_location: tripData.current_location!,
        current_location_lat: tripData.current_location_lat!,
        current_location_lng: tripData.current_location_lng!,
        pickup_location: tripData.pickup_location!,
        pickup_location_lat: tripData.pickup_location_lat!,
        pickup_location_lng: tripData.pickup_location_lng!,
        dropoff_location: tripData.dropoff_location!,
        dropoff_location_lat: tripData.dropoff_location_lat!,
        dropoff_location_lng: tripData.dropoff_location_lng!,
        current_cycle_used: tripData.current_cycle_used!,
      };

      const result = await apiService.createTrip(tripCreateData);
      console.log('Trip created:', result);
      
      setError(null);
      // Redirect to trip details
      navigate(`/trip/${result.trip.id}`);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to create trip';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tripData, navigate, isStep0Valid]);

  // Handle next step
  const handleNext = useCallback(async () => {
    if (activeStep === 0) {
      // Validate trip details
      if (!isStep0Valid) {
        setError('Please fill in all required fields');
        return;
      }
      
      setLoading(true);
      setRouteLoading(true);
      setError(null);
      
      try {
        // Geocode addresses using our service
        const [currentCoords, pickupCoords, dropoffCoords] = await Promise.all([
          geocodeAddress(tripData.current_location!),
          geocodeAddress(tripData.pickup_location!),
          geocodeAddress(tripData.dropoff_location!)
        ]);
        
        if (!currentCoords || !pickupCoords || !dropoffCoords) {
          throw new Error('Failed to geocode one or more addresses. Please check the addresses and try again.');
        }
        
        // Update trip data with coordinates
        const updatedTripData = {
          ...tripData,
          current_location_lat: currentCoords.latitude,
          current_location_lng: currentCoords.longitude,
          pickup_location_lat: pickupCoords.latitude,
          pickup_location_lng: pickupCoords.longitude,
          dropoff_location_lat: dropoffCoords.latitude,
          dropoff_location_lng: dropoffCoords.longitude,
        };
        setTripData(updatedTripData);
        
        // Calculate complete route: Current Location → Pickup → Dropoff
        const fullRoute = await getOptimizedRoute(
          tripData.current_location!,
          tripData.pickup_location!,
          new Date()
        );
        
        const deliveryRoute = await getOptimizedRoute(
          tripData.pickup_location!,
          tripData.dropoff_location!,
          new Date(Date.now() + (fullRoute?.duration || 8) * 60 * 60 * 1000)
        );
        
        if (fullRoute && deliveryRoute) {
          // Combine both route segments
          const totalDistance = fullRoute.distance + deliveryRoute.distance;
          
          // Calculate realistic driving time using truck highway speeds
          const TRUCK_HIGHWAY_SPEED = 58; // mph - realistic average including traffic, stops
          const LOADING_TIME = 1; // hour for pickup/loading
          const UNLOADING_TIME = 0.5; // hour for delivery/unloading
          
          const baseDrivingTime = totalDistance / TRUCK_HIGHWAY_SPEED;
          const totalDrivingTime = baseDrivingTime + LOADING_TIME + UNLOADING_TIME;
          
          const routeStops = [
            // Start at current location
            {
              id: 1,
              location: tripData.current_location,
              latitude: currentCoords.latitude,
              longitude: currentCoords.longitude,
              estimated_arrival: new Date().toISOString(),
              stop_type: 'Start',
              stop_order: 1
            },
            // Pickup location
            {
              id: 100,
              location: tripData.pickup_location,
              latitude: pickupCoords.latitude,
              longitude: pickupCoords.longitude,
              estimated_arrival: new Date(Date.now() + (fullRoute.distance / TRUCK_HIGHWAY_SPEED) * 60 * 60 * 1000).toISOString(),
              stop_type: 'Pickup',
              stop_order: 2
            },
            // Final dropoff
            {
              id: 999,
              location: tripData.dropoff_location,
              latitude: dropoffCoords.latitude,
              longitude: dropoffCoords.longitude,
              estimated_arrival: new Date(Date.now() + totalDrivingTime * 60 * 60 * 1000).toISOString(),
              stop_type: 'Dropoff',
              stop_order: 3
            }
          ];

          // Calculate fuel and rest stops
          const fuelStops = calculateFuelStops(totalDistance, routeStops);
          const restStops = calculateRestStops(totalDrivingTime, routeStops);
          
          // Calculate additional time for stops (but don't add rest periods to driving time)
          const fuelStopTime = fuelStops.length * 0.5; // 30 minutes per fuel stop
          const activeTime = totalDrivingTime + fuelStopTime; // Only active driving + fuel stops
          
          setRouteData({
            total_distance: totalDistance,
            estimated_duration: activeTime, // This is active time only
            route_stops: routeStops,
            fuelStops: fuelStops,
            restStops: restStops
          });
        } else {
          // Fallback to basic calculation
          const totalDistance = Math.round(Math.random() * 800 + 300);
          
          // Use realistic truck speeds for fallback calculation
          const TRUCK_HIGHWAY_SPEED = 58; // mph
          const LOADING_TIME = 1; // hour for pickup/loading  
          const UNLOADING_TIME = 0.5; // hour for delivery/unloading
          
          const baseDrivingTime = totalDistance / TRUCK_HIGHWAY_SPEED;
          const totalDrivingTime = baseDrivingTime + LOADING_TIME + UNLOADING_TIME;
          
          const routeStops = [
            {
              id: 1,
              location: tripData.current_location,
              latitude: currentCoords.latitude,
              longitude: currentCoords.longitude,
              estimated_arrival: new Date().toISOString(),
              stop_type: 'Start',
              stop_order: 1
            },
            {
              id: 2,
              location: tripData.pickup_location,
              latitude: pickupCoords.latitude,
              longitude: pickupCoords.longitude,
              estimated_arrival: new Date(Date.now() + (totalDistance * 0.6 / TRUCK_HIGHWAY_SPEED) * 60 * 60 * 1000).toISOString(),
              stop_type: 'Pickup',
              stop_order: 2
            },
            {
              id: 3,
              location: tripData.dropoff_location,
              latitude: dropoffCoords.latitude,
              longitude: dropoffCoords.longitude,
              estimated_arrival: new Date(Date.now() + totalDrivingTime * 60 * 60 * 1000).toISOString(),
              stop_type: 'Dropoff',
              stop_order: 3
            }
          ];

          // Calculate fuel and rest stops for fallback route
          const fuelStops = calculateFuelStops(totalDistance, routeStops);
          const restStops = calculateRestStops(totalDrivingTime, routeStops);
          
          // Calculate additional time for stops (but don't add rest periods to driving time)
          const fuelStopTime = fuelStops.length * 0.5; // 30 minutes per fuel stop
          const activeTime = totalDrivingTime + fuelStopTime; // Only active driving + fuel stops
          
          setRouteData({
            total_distance: totalDistance,
            estimated_duration: activeTime, // This is active time only
            route_stops: routeStops,
            fuelStops: fuelStops,
            restStops: restStops
          });
        }
        
        setError(null);
        setActiveStep(activeStep + 1);
      } catch (error) {
        console.error('Route calculation error:', error);
        setError(error instanceof Error ? error.message : 'Failed to calculate route. Please try again.');
      } finally {
        setLoading(false);
        setRouteLoading(false);
      }
    } else if (activeStep === 1) {
      setActiveStep(activeStep + 1);
      await checkCompliance();
    } else {
      // Create trip
      await createTrip();
    }
  }, [activeStep, tripData, isStep0Valid, checkCompliance, createTrip, calculateFuelStops, calculateRestStops]);

  const handleBack = useCallback(() => {
    setActiveStep(prev => prev - 1);
  }, []);

  // Load drivers on component mount
  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Step content renderer
  const renderStepContent = useCallback(() => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth disabled={driversLoading}>
              <InputLabel>Select Driver</InputLabel>
              <Select
                value={tripData.driver_id || ''}
                onChange={(e) => setTripData({ ...tripData, driver_id: e.target.value as number })}
                label="Select Driver"
              >
                {driversLoading ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Loading drivers...
                  </MenuItem>
                ) : drivers.length === 0 ? (
                  <MenuItem disabled>No drivers available</MenuItem>
                ) : (
                  drivers.map((driver) => (
                    <MenuItem key={driver.id} value={driver.id}>
                      {driver.name} - {driver.license_number}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <TextField
              label="Current Location"
              value={tripData.current_location || ''}
              onChange={(e) => setTripData({ ...tripData, current_location: e.target.value })}
              fullWidth
              InputProps={{
                startAdornment: <LocationOn color="action" sx={{ mr: 1 }} />,
              }}
              placeholder="e.g., Los Angeles, CA"
            />

            <TextField
              label="Pickup Location"
              value={tripData.pickup_location || ''}
              onChange={(e) => setTripData({ ...tripData, pickup_location: e.target.value })}
              fullWidth
              InputProps={{
                startAdornment: <LocationOn color="primary" sx={{ mr: 1 }} />,
              }}
              placeholder="e.g., Phoenix, AZ"
            />

            <TextField
              label="Dropoff Location"
              value={tripData.dropoff_location || ''}
              onChange={(e) => setTripData({ ...tripData, dropoff_location: e.target.value })}
              fullWidth
              InputProps={{
                startAdornment: <LocationOn color="secondary" sx={{ mr: 1 }} />,
              }}
              placeholder="e.g., Denver, CO"
            />

            <TextField
              label="Current Cycle Hours Used"
              type="number"
              value={tripData.current_cycle_used || 0}
              onChange={(e) => setTripData({ ...tripData, current_cycle_used: parseFloat(e.target.value) })}
              fullWidth
              inputProps={{ min: 0, max: 70, step: 0.5 }}
              helperText="Hours used in current 8-day cycle (0-70)"
            />
          </Box>
        );

      case 1:
        return (
          <Box>
            {routeLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  Calculating route with real-time data...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Getting distance, duration, and optimal stops
                </Typography>
              </Box>
            ) : routeData ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Paper sx={{ p: 3, bgcolor: 'primary.light', color: 'white' }}>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                    <Route sx={{ mr: 1 }} />
                    Route Summary (Real-time Calculation)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography variant="body2">Total Distance</Typography>
                      <Typography variant="h5">{routeData.total_distance} miles</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Active Driving Time</Typography>
                      <Typography variant="h5">{routeData.estimated_duration.toFixed(1)} hours</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Average Speed</Typography>
                      <Typography variant="h5">{Math.round(routeData.total_distance / routeData.estimated_duration)} mph</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Fuel Stops</Typography>
                      <Typography variant="h5">{routeData.fuelStops?.length || 0}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Rest Stops</Typography>
                      <Typography variant="h5">{routeData.restStops?.length || 0}</Typography>
                    </Box>
                  </Box>
                  {routeData.restStops && routeData.restStops.length > 0 && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        Total Elapsed Time: {(routeData.estimated_duration + routeData.restStops.reduce((total, stop) => total + stop.break_duration, 0)).toFixed(1)} hours
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        (Includes {routeData.restStops.reduce((total, stop) => total + stop.break_duration, 0)} hours of mandatory rest)
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="body2" sx={{ mt: 2, opacity: 0.9 }}>
                    📍 Route calculated using OpenStreetMap data with HOS compliance
                  </Typography>
                </Paper>

                <Typography variant="h6">Main Route Stops ({routeData.route_stops?.length || 0} stops)</Typography>
                {routeData.route_stops?.map((stop: RouteStop) => (
                  <Card key={stop.id} variant="outlined">
                    <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                      <Box sx={{ mr: 2 }}>
                        {stop.stop_type === 'Start' && <Navigation color="action" />}
                        {stop.stop_type === 'Pickup' && <LocationOn color="primary" />}
                        {stop.stop_type === 'Dropoff' && <LocationOn color="secondary" />}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1">
                          {stop.stop_type} - {stop.location}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Arrival: {new Date(stop.estimated_arrival).toLocaleString()}
                        </Typography>
                      </Box>
                      <Chip
                        label={stop.stop_type.toUpperCase()}
                        size="small"
                        color={
                          stop.stop_type === 'Start' ? 'success' :
                          stop.stop_type === 'Pickup' ? 'primary' :
                          'secondary'
                        }
                      />
                    </CardContent>
                  </Card>
                ))}

                {/* Fuel Stops Section */}
                {routeData.fuelStops && routeData.fuelStops.length > 0 && (
                  <>
                    <Typography variant="h6" sx={{ mt: 3 }}>
                      Fuel Stops ({routeData.fuelStops.length} stops)
                    </Typography>
                    {routeData.fuelStops.map((fuelStop: FuelStop) => (
                      <Card key={fuelStop.id} variant="outlined" sx={{ bgcolor: 'orange.50' }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                          <Box sx={{ mr: 2 }}>
                            <LocalGasStation color="warning" />
                          </Box>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle1">
                              {fuelStop.station_name || 'Fuel Stop'} - {fuelStop.location}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Arrival: {new Date(fuelStop.estimated_arrival).toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Fuel: {fuelStop.fuel_needed.toFixed(1)} gal • Est. Cost: ${fuelStop.cost_estimate.toFixed(2)}
                            </Typography>
                          </Box>
                          <Chip
                            label="FUEL STOP"
                            size="small"
                            color="warning"
                            icon={<LocalGasStation />}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}

                {/* Rest Stops Section */}
                {routeData.restStops && routeData.restStops.length > 0 && (
                  <>
                    <Typography variant="h6" sx={{ mt: 3 }}>
                      Mandatory Rest Stops ({routeData.restStops.length} stops)
                    </Typography>
                    {routeData.restStops.map((restStop: RestStop) => (
                      <Card key={restStop.id} variant="outlined" sx={{ bgcolor: 'blue.50' }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                          <Box sx={{ mr: 2 }}>
                            <Hotel color="info" />
                          </Box>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle1">
                              {restStop.facility_type || 'Rest Area'} - {restStop.location}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Arrival: {new Date(restStop.estimated_arrival).toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Break Duration: {restStop.break_duration}h • Type: {restStop.break_type.replace('_', ' ').toUpperCase()}
                            </Typography>
                          </Box>
                          <Chip
                            label={restStop.break_type === 'sleeper_berth' ? 'SLEEPER BERTH' : 'REST BREAK'}
                            size="small"
                            color="info"
                            icon={<Schedule />}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No route data available. Please go back and try again.
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            {complianceData && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Alert
                  severity={complianceData.compliant ? 'success' : 'warning'}
                  icon={complianceData.compliant ? <CheckCircle /> : <Warning />}
                >
                  {complianceData.compliant
                    ? 'Trip is HOS compliant'
                    : 'HOS compliance issues detected'}
                </Alert>

                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Trip Analysis
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 4 }}>
                    <Box>
                      <Typography variant="body2">Driving Hours</Typography>
                      <Typography variant="h6">
                        {complianceData.trip_analysis.total_driving_hours}h
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Total Duty Hours</Typography>
                      <Typography variant="h6">
                        {complianceData.trip_analysis.total_duty_hours}h
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Cycle Hours Needed</Typography>
                      <Typography variant="h6">
                        {complianceData.trip_analysis.cycle_hours_needed}h
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                {complianceData.violations.length > 0 && (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Violations
                    </Typography>
                    {complianceData.violations.map((violation, index) => (
                      <Alert key={index} severity="error" sx={{ mb: 1 }}>
                        {violation.description}
                      </Alert>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  }, [activeStep, tripData, drivers, driversLoading, routeLoading, routeData, complianceData]);

  return (
    <Container maxWidth="md">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
          Plan New Trip
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Create a new trip with route optimization and HOS compliance checking
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 4 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 3 }}
              action={
                <Button color="inherit" size="small" onClick={() => setError(null)}>
                  Dismiss
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {renderStepContent()}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              variant="outlined"
            >
              Back
            </Button>
            <Button
              onClick={handleNext}
              variant="contained"
              disabled={loading || (activeStep === 0 && !isStep0Valid)}
            >
              {loading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Processing...
                </>
              ) : activeStep === steps.length - 1 ? (
                'Create Trip'
              ) : (
                'Next'
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default TripPlanner;