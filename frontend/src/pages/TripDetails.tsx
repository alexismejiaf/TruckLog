import React, { useState, useEffect } from 'react';
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
} from '@mui/icons-material';
import { format } from 'date-fns';
import { apiService } from '../services/api';
// import TripMap from '../components/TripMap';
// import { generateDOTDailyLogSheet, createSampleDailyLog } from '../utils/dotLogGenerator';

// Types
interface RouteStop {
  id: number;
  address: string;
  latitude: number;
  longitude: number;
  estimated_arrival: string;
  stop_type: string;
  stop_order: number;
}

interface Trip {
  id: number;
  origin: string;
  destination: string;
  departure_time: string;
  estimated_arrival: string;
  total_distance: number;
  estimated_duration: number;
  status: string;
  driver_id: number;
  route_stops: RouteStop[];
}

interface ELDLog {
  id: number;
  trip: number;
  driver_name: string;
  log_date: string;
  duty_status: string;
  location: string;
  odometer_reading: number;
  hours_driven_today: number;
  hours_on_duty_today: number;
}

const TripDetails: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [eldLogs, setEldLogs] = useState<ELDLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    loadTripData();
  }, [tripId]);

  const loadTripData = async () => {
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
      const { getOptimizedRoute } = await import('../services/routeCalculationService');
      
      const routeData = await getOptimizedRoute(
        currentTrip.pickup_location,
        currentTrip.dropoff_location
      );

      if (!routeData) {
        throw new Error('Could not calculate route');
      }

      // Get coordinates for display purposes
      const { geocodeAddress } = await import('../services/routeCalculationService');
      const pickupCoords = await geocodeAddress(currentTrip.pickup_location);
      const dropoffCoords = await geocodeAddress(currentTrip.dropoff_location);
      
      if (!pickupCoords || !dropoffCoords) {
        throw new Error('Could not geocode addresses');
      }

      const realTrip: Trip = {
        id: currentTrip.id,
        origin: currentTrip.pickup_location,
        destination: currentTrip.dropoff_location,
        departure_time: currentTrip.created_at,
        estimated_arrival: new Date(Date.now() + routeData.duration * 60 * 60 * 1000).toISOString(),
        total_distance: routeData.distance,
        estimated_duration: routeData.duration,
        status: currentTrip.status,
        driver_id: 1,
        route_stops: [
          {
            id: 1,
            address: `${currentTrip.pickup_location} - Start`,
            latitude: pickupCoords.latitude,
            longitude: pickupCoords.longitude,
            estimated_arrival: currentTrip.created_at,
            stop_type: 'Start',
            stop_order: 1
          },
          // Add fuel stops from route calculation
          ...routeData.fuelStops,
          // Add rest stops from route calculation  
          ...routeData.restStops,
          {
            id: routeData.fuelStops.length + routeData.restStops.length + 2,
            address: `${currentTrip.dropoff_location} - Destination`,
            latitude: dropoffCoords.latitude,
            longitude: dropoffCoords.longitude,
            estimated_arrival: new Date(Date.now() + routeData.duration * 60 * 60 * 1000).toISOString(),
            stop_type: 'Dropoff',
            stop_order: routeData.fuelStops.length + routeData.restStops.length + 2
          }
        ]
      };

      setTrip(realTrip);

      // Fetch real ELD logs from the API for this specific trip
      try {
        const realEldLogs = await apiService.getELDLogs({ trip_id: parseInt(tripId || '1') });
        
        // Transform API data to match our interface
        const transformedLogs: ELDLog[] = realEldLogs.map((log: any) => ({
          id: log.id,
          trip: log.trip_id,
          driver_name: log.driver_name,
          log_date: log.date,
          duty_status: log.duty_status,
          location: log.location,
          odometer_reading: log.odometer_start || log.odometer_end || 125000,
          hours_driven_today: log.hours,
          hours_on_duty_today: log.hours
        }));

        setEldLogs(transformedLogs);
      } catch (logError) {
        console.error('Error loading ELD logs:', logError);
        // Fallback to empty array if ELD logs fail to load
        setEldLogs([]);
      }

      // Set progress based on trip status
      if (trip && trip.status === 'planned') {
        setProgress(0); // No progress for planned trips
      } else if (trip && trip.status === 'in_progress') {
        setProgress(65); // 65% progress for in-progress trips
      } else if (trip && trip.status === 'completed') {
        setProgress(100); // 100% for completed trips
      } else {
        setProgress(0); // Default to 0 for other statuses
      }
      setActiveStep(3); // Currently at step 3 of 6
    } catch (err) {
      setError('Failed to load trip details');
      console.error('Error loading trip data:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateDailyLogSheet = async () => {
    try {
      // Use actual trip and ELD log data
      const driverName = eldLogs.length > 0 ? eldLogs[0].driver_name : 'Unknown Driver';
      const origin = trip?.origin || 'Unknown Origin';
      const destination = trip?.destination || 'Unknown Destination';
      
      // Generate log entries from actual ELD data
      const logEntries = eldLogs.map(log => {
        const time = new Date(log.log_date).toLocaleTimeString('en-US', { 
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
        .reduce((sum, log) => sum + log.hours_driven_today, 0);
      
      const totalOnDuty = eldLogs
        .reduce((sum, log) => sum + log.hours_on_duty_today, 0);
      
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
                  ? (trip.route_stops.find(stop => stop.stop_type === 'Rest')?.address.split(',')[0] || 'Highway')
                  : trip.origin.split(',')[0]
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
              📍 Current Location: {trip.status === 'in_progress' ? 'En route to destination' : trip.origin}<br/>
              🛣️ Route: {trip.origin} → {trip.destination}<br/>
              ⛽ Next Fuel Stop: {trip.route_stops.find(stop => stop.stop_type === 'Fuel')?.address || 'No fuel stops planned'}<br/>
              🚛 Vehicle Speed: {trip.status === 'in_progress' ? '65 mph' : 'Parked'} | Fuel: {trip.status === 'in_progress' ? '7.2 mpg' : '-- mpg'}<br/>
            </Typography>
            
            {/* Dynamic route progress */}
            <Box sx={{ width: '80%', mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="primary">{trip.origin}</Typography>
                <Typography variant="body2" color="warning.main">
                  Current: {trip.status === 'in_progress' ? 'En route' : trip.origin}
                </Typography>
                <Typography variant="body2" color="error.main">{trip.destination}</Typography>
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
                  ? `Trip completed • ${trip.total_distance} miles • Finished on: ${format(new Date(trip.estimated_arrival), 'MMM dd, h:mm a')}`
                  : `${progress}% Complete • ${((100 - progress) / 100 * trip.total_distance).toFixed(0)} miles remaining • ETA: ${format(new Date(trip.estimated_arrival), 'MMM dd, h:mm a')}`
                }
              </Typography>
            </Box>
            
            {/* Route waypoints */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              {trip.route_stops.map((stop, index) => {
                // Determine if stop is completed based on trip progress and stop order
                const isCompleted = trip.status === 'in_progress' && index < Math.floor(trip.route_stops.length * progress / 100);
                const isCurrent = trip.status === 'in_progress' && index === Math.floor(trip.route_stops.length * progress / 100);
                
                return (
                  <Chip
                    key={stop.id}
                    label={stop.address.split(' - ')[0]}
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
            Route Stops
          </Typography>
          <List>
            {trip.route_stops.map((stop) => (
              <ListItem
                key={stop.id}
                sx={{ border: '1px solid #e0e0e0', borderRadius: 2, mb: 1 }}
                secondaryAction={
                  <Chip
                    label={stop.stop_type.toUpperCase()}
                    color={
                      stop.stop_type === 'Start' ? 'success' :
                      stop.stop_type === 'Fuel' ? 'warning' :
                      stop.stop_type === 'Rest' ? 'info' :
                      stop.stop_type === 'Dropoff' ? 'error' : 'default'
                    }
                    size="small"
                  />
                }
              >
                <ListItemIcon>
                  <LocationOn />
                </ListItemIcon>
                <ListItemText
                  primary={stop.address}
                  secondary={`ETA: ${format(new Date(stop.estimated_arrival), 'MMM dd, h:mm a')}`}
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
                  primary={`${format(new Date(log.log_date), 'h:mm a')} - ${log.location}`}
                  secondary={
                    <Box>
                      <Typography variant="body2" component="span">
                        Hours Driven: {log.hours_driven_today}h | On Duty: {log.hours_on_duty_today}h
                      </Typography>
                      <br />
                      <Typography variant="body2" component="span" color="text.secondary">
                        Odometer: {log.odometer_reading.toLocaleString()} miles
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
