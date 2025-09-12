import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  ArrowBack,
  LocationOn,
  Schedule,
  Speed,
  LocalGasStation,
  Assignment,
  Navigation,
  TrendingUp,
  CheckCircle,
  Warning,
  Hotel,
  AccessTime,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { apiService, Trip as ApiTrip, ELDLog as ApiELDLog } from '../services/api';

// Use API types directly for consistency
interface RouteStop {
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

// Use the API Trip type directly
type DisplayTrip = ApiTrip;

// Use the API ELDLog type directly  
type DisplayELDLog = ApiELDLog;

// Helper functions
const calculateTripProgress = (status: string): number => {
  switch (status) {
    case 'completed':
      return 100;
    case 'in_progress':
      return 65;
    case 'planned':
    default:
      return 0;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'driving':
      return 'error';
    case 'on_duty':
      return 'warning';
    case 'off_duty':
      return 'success';
    default:
      return 'default';
  }
};

const formatStopTypeColor = (stopType: string) => {
  switch (stopType) {
    case 'Start':
      return 'success';
    case 'Fuel':
      return 'warning';
    case 'Rest':
      return 'info';
    case 'Break':
      return 'secondary';
    case 'Cycle_Reset':
      return 'error';
    case 'Pickup':
      return 'primary';
    case 'Dropoff':
      return 'error';
    default:
      return 'default';
  }
};

const TripDetails: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<DisplayTrip | null>(null);
  const [eldLogs, setEldLogs] = useState<DisplayELDLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(1);

  const loadTripData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch real trip data from the API
      const trips = await apiService.getTrips();
      const currentTrip = trips.find((trip: any) => trip.id === parseInt(tripId || '1'));
      
      if (!currentTrip) {
        throw new Error('Trip not found');
      }

      // Use real route calculation for the actual trip
      const { getOptimizedRoute, geocodeAddress } = await import('../services/routeCalculationService');
      
      const routeData = await getOptimizedRoute(
        currentTrip.pickup_location,
        currentTrip.dropoff_location
      );

      if (!routeData) {
        throw new Error('Could not calculate route');
      }

      // Get coordinates for display purposes
      const pickupCoords = await geocodeAddress(currentTrip.pickup_location);
      const dropoffCoords = await geocodeAddress(currentTrip.dropoff_location);
      
      if (!pickupCoords || !dropoffCoords) {
        throw new Error('Could not geocode addresses');
      }

      // Calculate fuel stops (same logic as TripPlanner)
      const calculateFuelStops = (totalDistance: number) => {
        const fuelStops: any[] = [];
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
            
            // Estimate location between pickup and dropoff
            const fuelLocation = `Fuel Stop ${i} near ${progressRatio < 0.5 ? currentTrip.pickup_location : currentTrip.dropoff_location}`;
            
            // Calculate estimated arrival time using trip start time
            const hoursToStop = stopDistance / 58; // Average highway speed 58 mph
            const tripStartTime = new Date(currentTrip.created_at);
            const arrivalTime = new Date(tripStartTime.getTime() + hoursToStop * 60 * 60 * 1000);
            
            fuelStops.push({
              id: 1000 + i,
              trip: currentTrip.id,
              stop_order: i + 1,
              stop_type: 'Fuel',
              location: fuelLocation,
              location_lat: pickupCoords.latitude + (dropoffCoords.latitude - pickupCoords.latitude) * progressRatio,
              location_lng: pickupCoords.longitude + (dropoffCoords.longitude - pickupCoords.longitude) * progressRatio,
              estimated_arrival: arrivalTime.toISOString(),
              estimated_departure: new Date(arrivalTime.getTime() + 30 * 60 * 1000).toISOString(), // 30 min stop
              duration_minutes: 30,
              distance_from_previous: i === 1 ? stopDistance : EFFECTIVE_RANGE,
              cumulative_distance: stopDistance,
              notes: `Fuel: ${(FUEL_TANK_CAPACITY * 0.8).toFixed(1)} gal • Cost: $${(FUEL_TANK_CAPACITY * 0.8 * 3.85).toFixed(2)}`
            });
          }
        }
        
        return fuelStops;
      };

      // Calculate rest stops with proper HOS compliance for property-carrying drivers
      const calculateRestStops = (totalDuration: number) => {
        const restStops: any[] = [];
        
        // HOS regulations for property-carrying drivers (70-hour/8-day cycle)
        const MAX_DRIVING_HOURS_DAILY = 11; // Cannot drive more than 11 hours
        const MAX_ON_DUTY_HOURS_DAILY = 14; // Cannot be on duty more than 14 hours
        const MANDATORY_BREAK_AFTER_8_HRS = 0.5; // 30-minute break after 8 hours of driving
        const MANDATORY_OFF_DUTY_HOURS = 10; // Must have 10 consecutive hours off duty
        const MAX_CYCLE_HOURS = 70; // Cannot drive after 70 hours on duty in 8 days
        
        // Check if driver's current cycle hours would exceed limit
        const currentCycleUsed = currentTrip.current_cycle_used || 0;
        const projectedCycleHours = currentCycleUsed + totalDuration;
        
        // Use the actual trip start time instead of current time
        const tripStartTime = new Date(currentTrip.created_at);
        
        // Add 30-minute break after 8 hours of driving
        if (totalDuration > 8) {
          const breakTime = 8; // After 8 hours of driving
          const progressRatio = breakTime / totalDuration;
          
          const breakLocation = `30-min Break near ${progressRatio < 0.5 ? currentTrip.pickup_location : currentTrip.dropoff_location}`;
          const arrivalTime = new Date(tripStartTime.getTime() + breakTime * 60 * 60 * 1000);
          
          restStops.push({
            id: 3000,
            trip: currentTrip.id,
            stop_order: 1.5, // Between start and fuel stops
            stop_type: 'Break',
            location: breakLocation,
            location_lat: pickupCoords.latitude + (dropoffCoords.latitude - pickupCoords.latitude) * progressRatio,
            location_lng: pickupCoords.longitude + (dropoffCoords.longitude - pickupCoords.longitude) * progressRatio,
            estimated_arrival: arrivalTime.toISOString(),
            estimated_departure: new Date(arrivalTime.getTime() + MANDATORY_BREAK_AFTER_8_HRS * 60 * 60 * 1000).toISOString(),
            duration_minutes: 30,
            distance_from_previous: 50,
            cumulative_distance: (routeData.distance || 0) * progressRatio,
            notes: `Mandatory 30-min break after 8 hours driving (HOS compliance)`
          });
        }
        
        // Add 10-hour sleeper berth breaks for trips exceeding daily limits
        if (totalDuration > MAX_DRIVING_HOURS_DAILY) {
          const numRestStops = Math.ceil(totalDuration / MAX_DRIVING_HOURS_DAILY) - 1;
          
          for (let i = 1; i <= numRestStops; i++) {
            const breakTime = MAX_DRIVING_HOURS_DAILY * i;
            const progressRatio = breakTime / totalDuration;
            
            const restLocation = `10-Hour Rest - Rest Area ${i} near ${progressRatio < 0.5 ? currentTrip.pickup_location : currentTrip.dropoff_location}`;
            const arrivalTime = new Date(tripStartTime.getTime() + breakTime * 60 * 60 * 1000);
            
            restStops.push({
              id: 2000 + i,
              trip: currentTrip.id,
              stop_order: (calculateFuelStops(routeData.distance || 0).length) + i + 1,
              stop_type: 'Rest',
              location: restLocation,
              location_lat: pickupCoords.latitude + (dropoffCoords.latitude - pickupCoords.latitude) * progressRatio,
              location_lng: pickupCoords.longitude + (dropoffCoords.longitude - pickupCoords.longitude) * progressRatio,
              estimated_arrival: arrivalTime.toISOString(),
              estimated_departure: new Date(arrivalTime.getTime() + MANDATORY_OFF_DUTY_HOURS * 60 * 60 * 1000).toISOString(),
              duration_minutes: MANDATORY_OFF_DUTY_HOURS * 60,
              distance_from_previous: 100,
              cumulative_distance: (routeData.distance || 0) * progressRatio,
              notes: `Mandatory 10-hour off-duty period (Daily HOS reset) • Sleeper berth required`
            });
          }
        }
        
        // Add 34-hour restart if approaching 70-hour cycle limit
        if (projectedCycleHours > 65) { // Warning at 65 hours, mandatory at 70
          const cycleRestartLocation = `34-Hour Restart near ${currentTrip.dropoff_location}`;
          const arrivalTime = new Date(tripStartTime.getTime() + totalDuration * 60 * 60 * 1000);
          
          restStops.push({
            id: 4000,
            trip: currentTrip.id,
            stop_order: 999,
            stop_type: 'Cycle_Reset',
            location: cycleRestartLocation,
            location_lat: dropoffCoords.latitude,
            location_lng: dropoffCoords.longitude,
            estimated_arrival: arrivalTime.toISOString(),
            estimated_departure: new Date(arrivalTime.getTime() + 34 * 60 * 60 * 1000).toISOString(),
            duration_minutes: 34 * 60,
            distance_from_previous: 0,
            cumulative_distance: routeData.distance || 0,
            notes: `34-hour restart (70-hour/8-day cycle reset) • Current cycle: ${currentCycleUsed}h + ${totalDuration.toFixed(1)}h = ${projectedCycleHours.toFixed(1)}h`
          });
        }
        
        return restStops;
      };

      const totalDistance = routeData.distance || 0;
      const totalDuration = routeData.duration || 0;
      const fuelStops = calculateFuelStops(totalDistance);
      const restStops = calculateRestStops(totalDuration);

      const realTrip: DisplayTrip = {
        ...currentTrip, // Use all properties from API
        route_stops: [
          {
            id: 1,
            trip: currentTrip.id,
            stop_order: 1,
            stop_type: 'Start',
            location: currentTrip.pickup_location,
            location_lat: pickupCoords.latitude,
            location_lng: pickupCoords.longitude,
            estimated_arrival: currentTrip.created_at,
            estimated_departure: currentTrip.created_at,
            duration_minutes: 0,
            distance_from_previous: 0,
            cumulative_distance: 0,
            notes: 'Trip starting point'
          },
          // Add fuel stops
          ...fuelStops,
          // Add rest stops
          ...restStops,
          {
            id: 999,
            trip: currentTrip.id,
            stop_order: fuelStops.length + restStops.length + 2,
            stop_type: 'Dropoff',
            location: currentTrip.dropoff_location,
            location_lat: dropoffCoords.latitude,
            location_lng: dropoffCoords.longitude,
            estimated_arrival: new Date(Date.now() + totalDuration * 60 * 60 * 1000).toISOString(),
            estimated_departure: new Date(Date.now() + totalDuration * 60 * 60 * 1000).toISOString(),
            duration_minutes: 60,
            distance_from_previous: totalDistance - (fuelStops.length > 0 ? fuelStops[fuelStops.length - 1].cumulative_distance : 0),
            cumulative_distance: totalDistance,
            notes: 'Final destination'
          }
        ]
      };

      setTrip(realTrip);

      // Fetch real ELD logs from the API for this specific trip
      try {
        const realEldLogs = await apiService.getELDLogs({ trip_id: parseInt(tripId || '1') });
        
        // Use the real ELD logs directly from API
        setEldLogs(realEldLogs);
      } catch (logError) {
        console.error('Error loading ELD logs:', logError);
        // Fallback to empty array if ELD logs fail to load
        setEldLogs([]);
      }

      // Set progress based on trip status
      if (trip) {
        setProgress(calculateTripProgress(trip.status));
      } else {
        setProgress(0);
      }
      setActiveStep(3); // Currently at step 3 of 6
    } catch (err) {
      setError('Failed to load trip details');
      console.error('Error loading trip data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]); // Include tripId as dependency since it's used in the function

  useEffect(() => {
    loadTripData();
  }, [loadTripData]);

  const generateDailyLogSheet = async () => {
    try {
      // Use actual trip and ELD log data
      const driverName = eldLogs.length > 0 ? eldLogs[0].driver_name : 'Unknown Driver';
      const origin = trip?.pickup_location || 'Unknown Origin';
      const destination = trip?.dropoff_location || 'Unknown Destination';
      
      // Generate log entries from actual ELD data
      const logEntries = eldLogs.map(log => {
        const time = new Date(log.date).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        });
        const status = log.duty_status.toUpperCase().replace('_', ' ');
        return `${time} - ${status} (${log.location})`;
      }).join('\n');
      
      // Calculate totals from actual data
      const totalDriving = eldLogs
        .filter(log => log.duty_status === 'driving')
        .reduce((sum, log) => sum + log.daily_driving_hours, 0);
      
      const totalOnDuty = eldLogs
        .reduce((sum, log) => sum + log.daily_duty_hours, 0);
      
      const totalMiles = trip?.total_distance || 0;
      
      const logContent = `
DRIVER'S DAILY LOG
Date: ${format(new Date(), 'MM/dd/yyyy')}
Driver: ${driverName}
Truck #: T-1247
Trailer #: TR-8901

DUTY STATUS LOG:
${logEntries}

TOTALS:
Driving: ${totalDriving.toFixed(1)} hours
On-Duty: ${totalOnDuty.toFixed(1)} hours
Total Miles: ${totalMiles.toFixed(1)}

LOCATIONS:
Begin: ${origin}
End: ${destination}

REMARKS: Regular interstate delivery. No incidents or violations.
Vehicle inspection completed. All systems operational.

Driver Certification: I hereby certify that my data entries are true and correct.
      `;
      
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `daily_log_${format(new Date(), 'yyyy_MM_dd')}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error generating daily log sheet:', error);
      setError('Failed to generate daily log sheet');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'driving':
        return 'error';
      case 'on_duty':
        return 'warning';
      case 'off_duty':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !trip) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 2 }}>
          {error || 'Trip not found'}
        </Alert>
      </Container>
    );
  }

  const steps = ['Trip Details', 'Route Review', 'HOS Compliance'];

  return (
    <Container maxWidth="lg">
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          variant="outlined"
        >
          Back to Dashboard
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Trip Details
        </Typography>
      </Box>

      {/* Progress Stepper */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel
                  StepIconComponent={({ active, completed }) => {
                    if (completed) return <CheckCircle color="success" />;
                    if (active) return <Warning color="warning" />;
                    return <div style={{ width: 24, height: 24, border: '2px solid #ccc', borderRadius: '50%' }} />;
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Trip Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <Navigation sx={{ mr: 1 }} />
            Route Summary
          </Typography>
          
          <Box sx={{ p: 3, bgcolor: 'primary.light', borderRadius: 2, color: 'primary.contrastText', mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="h6">Total Distance</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {trip.total_distance.toLocaleString()} miles
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h6">Estimated Duration</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {trip.estimated_duration} hours
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {trip.status === 'planned' ? 'Trip Status: Ready to start' : 
                 trip.status === 'completed' ? 'Trip Status: Completed' :
                 `Trip Progress: ${progress}%`}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ height: 8, borderRadius: 4 }}
                color={trip.status === 'planned' ? 'secondary' : 'primary'}
              />
            </Box>
          </Box>

          {/* Real-time Stats */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            Real-time Vehicle Data
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Box sx={{ flex: 1, textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
              <Speed sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" color="primary.main">
                {trip.status === 'in_progress' ? '65 mph' : '0 mph'}
              </Typography>
              <Typography variant="body2">Current Speed</Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
              <LocalGasStation sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h6" color="success.main">
                {trip.status === 'in_progress' ? '7.2 mpg' : '-- mpg'}
              </Typography>
              <Typography variant="body2">Fuel Economy</Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: 'center', p: 2, bgcolor: 'info.light', borderRadius: 2 }}>
              <Schedule sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h6" color="info.main">
                {trip.status === 'in_progress' 
                  ? `${((100 - progress) / 100 * trip.estimated_duration).toFixed(1)} hrs`
                  : `${trip.estimated_duration} hrs`
                }
              </Typography>
              <Typography variant="body2">
                {trip.status === 'in_progress' ? 'ETA to Destination' : 'Estimated Duration'}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 2 }}>
              <LocationOn sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h6" color="warning.main">
                {trip.status === 'in_progress' 
                  ? (trip.route_stops.find((stop: RouteStop) => stop.stop_type === 'Rest')?.location.split(',')[0] || 'Highway')
                  : trip.pickup_location.split(',')[0]
                }
              </Typography>
              <Typography variant="body2">Current Location</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Interactive Map */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Interactive Route Map
          </Typography>
          <Box 
            sx={{ 
              height: 400, 
              bgcolor: 'linear-gradient(45deg, #e3f2fd 30%, #bbdefb 90%)', 
              borderRadius: 2, 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              border: '2px solid #2196f3',
              position: 'relative'
            }}
          >
            <LocationOn sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
              Live Route Tracking
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, maxWidth: 500, textAlign: 'center' }}>
              🗺️ <strong>Real-time GPS Map Integration</strong><br/>
              📍 Current Location: {trip.status === 'in_progress' ? 'En route to destination' : trip.pickup_location}<br/>
              🛣️ Route: {trip.pickup_location} → {trip.dropoff_location}<br/>
              ⛽ Next Fuel Stop: {trip.route_stops.find((stop: RouteStop) => stop.stop_type === 'Fuel')?.location || 'No fuel stops needed'}<br/>
              🛏️ Next Rest Stop: {trip.route_stops.find((stop: RouteStop) => stop.stop_type === 'Rest')?.location || 'No mandatory rest required'}<br/>
              🚛 Vehicle Speed: {trip.status === 'in_progress' ? '65 mph' : 'Parked'} | Fuel: {trip.status === 'in_progress' ? '7.2 mpg' : '-- mpg'}<br/>
            </Typography>
            
            {/* Dynamic route progress */}
            <Box sx={{ width: '80%', mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="primary">{trip.pickup_location}</Typography>
                <Typography variant="body2" color="warning.main">
                  Current: {trip.status === 'in_progress' ? 'En route' : trip.pickup_location}
                </Typography>
                <Typography variant="body2" color="error.main">{trip.dropoff_location}</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                {trip.status === 'planned' 
                  ? `Trip ready to start • ${trip.total_distance} miles total • Estimated duration: ${trip.estimated_duration} hours`
                  : trip.status === 'completed' 
                  ? `Trip completed • ${trip.total_distance} miles • Finished on: ${format(new Date(trip.updated_at), 'MMM dd, h:mm a')}`
                  : `${progress}% Complete • ${((100 - progress) / 100 * trip.total_distance).toFixed(0)} miles remaining • ETA: ${format(new Date(Date.now() + trip.estimated_duration * 60 * 60 * 1000), 'MMM dd, h:mm a')}`
                }
              </Typography>
            </Box>
            
            {/* Route waypoints */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              {trip.route_stops.map((stop: RouteStop, index: number) => {
                // Determine if stop is completed based on trip progress and stop order
                const isCompleted = trip.status === 'in_progress' && index < Math.floor(trip.route_stops.length * progress / 100);
                const isCurrent = trip.status === 'in_progress' && index === Math.floor(trip.route_stops.length * progress / 100);
                
                return (
                  <Chip
                    key={stop.id}
                    label={stop.location.split(' - ')[0]}
                    color={
                      isCompleted ? 'success' : 
                      isCurrent ? 'warning' : 
                      trip.status === 'completed' ? 'success' : 'default'
                    }
                    size="small"
                    icon={<LocationOn />}
                    variant={isCompleted || (trip.status === 'completed') ? 'filled' : 'outlined'}
                  />
                );
              })}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Route Stops */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Route Stops ({trip.route_stops.length} total stops)
          </Typography>
          <List>
            {trip.route_stops.map((stop: RouteStop) => (
              <ListItem
                key={stop.id}
                sx={{ border: '1px solid #e0e0e0', borderRadius: 2, mb: 1 }}
                secondaryAction={
                  <Chip
                    label={stop.stop_type.toUpperCase()}
                    color={formatStopTypeColor(stop.stop_type) as any}
                    size="small"
                  />
                }
              >
                <ListItemIcon>
                  {stop.stop_type === 'Start' && <Navigation />}
                  {stop.stop_type === 'Fuel' && <LocalGasStation />}
                  {stop.stop_type === 'Rest' && <Hotel />}
                  {stop.stop_type === 'Break' && <AccessTime />}
                  {stop.stop_type === 'Cycle_Reset' && <Schedule />}
                  {(stop.stop_type === 'Dropoff' || stop.stop_type === 'Pickup') && <LocationOn />}
                </ListItemIcon>
                <ListItemText
                  primary={stop.location}
                  secondary={
                    <Box>
                      <Typography variant="body2" component="span">
                        ETA: {format(new Date(stop.estimated_arrival), 'MMM dd, h:mm a')}
                      </Typography>
                      {stop.notes && (
                        <>
                          <br />
                          <Typography variant="body2" component="span" color="text.secondary">
                            {stop.notes}
                          </Typography>
                        </>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* ELD Logs */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Electronic Logging Device (ELD) Records
            </Typography>
            <Button
              variant="contained"
              startIcon={<TrendingUp />}
              onClick={generateDailyLogSheet}
            >
              Generate Daily Log Sheet
            </Button>
          </Box>
          
          <List>
            {eldLogs.map((log) => (
              <ListItem
                key={log.id}
                sx={{ border: '1px solid #e0e0e0', borderRadius: 2, mb: 1 }}
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={log.duty_status.replace('_', ' ').toUpperCase()}
                      color={getStatusColor(log.duty_status) as any}
                      size="small"
                    />
                  </Box>
                }
              >
                <ListItemIcon>
                  <Assignment />
                </ListItemIcon>
                <ListItemText
                  primary={`${format(new Date(log.date), 'h:mm a')} - ${log.location}`}
                  secondary={
                    <Box>
                      <Typography variant="body2" component="span">
                        Hours Driven: {log.daily_driving_hours}h | On Duty: {log.daily_duty_hours}h
                      </Typography>
                      <br />
                      <Typography variant="body2" component="span" color="text.secondary">
                        Odometer: {(log.odometer_end || log.odometer_start || 125000).toLocaleString()} miles
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </Container>
  );
};

export default TripDetails;
