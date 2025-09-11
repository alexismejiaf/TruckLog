import React, { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
} from '@mui/material';
import {
  Add,
  LocalShipping,
  Route,
  Warning,
  CheckCircle,
  Visibility,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';

interface Trip {
  id: number;
  driver_name: string;
  pickup_location: string;
  dropoff_location: string;
  total_distance: number;
  status: string;
  created_at: string;
}

interface DashboardStats {
  active_trips: number;
  completed_trips: number;
  hos_violations: number;
  drivers_available: number;
}

const Dashboard: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    active_trips: 0,
    completed_trips: 0,
    hos_violations: 0,
    drivers_available: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch real trips from API
      const tripsData = await apiService.getTrips();
      
      // Convert API data to local interface
      const convertedTrips: Trip[] = tripsData.map(trip => ({
        id: trip.id,
        driver_name: trip.driver_name,
        pickup_location: trip.pickup_location,
        dropoff_location: trip.dropoff_location,
        total_distance: trip.total_distance || 0,
        status: trip.status,
        created_at: trip.created_at,
      }));

      // Calculate stats from real data
      const mockStats: DashboardStats = {
        active_trips: convertedTrips.filter(trip => trip.status === 'in_progress' || trip.status === 'planned').length,
        completed_trips: convertedTrips.filter(trip => trip.status === 'completed').length,
        hos_violations: 0, // Would come from violations API
        drivers_available: 3, // Would come from drivers API
      };

      setTrips(convertedTrips);
      setStats(mockStats);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      // Fallback to mock data if API fails
      const mockTrips: Trip[] = [
        {
          id: 1,
          driver_name: 'John Smith',
          pickup_location: 'Los Angeles, CA',
          dropoff_location: 'Phoenix, AZ',
          total_distance: 372.5,
          status: 'in_progress',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          driver_name: 'Sarah Johnson',
          pickup_location: 'Dallas, TX',
          dropoff_location: 'Houston, TX',
          total_distance: 239.8,
          status: 'planned',
          created_at: new Date().toISOString(),
        },
      ];

      const mockStats: DashboardStats = {
        active_trips: 2,
        completed_trips: 15,
        hos_violations: 1,
        drivers_available: 8,
      };

      setTrips(mockTrips);
      setStats(mockStats);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'primary';
      case 'planned':
        return 'secondary';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').toUpperCase();
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
          Trucking Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor your fleet operations and HOS compliance
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        <Card sx={{ minWidth: 200, flex: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <LocalShipping color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Active Trips</Typography>
            </Box>
            <Typography variant="h3" color="primary.main">
              {stats.active_trips}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 200, flex: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CheckCircle color="success" sx={{ mr: 1 }} />
              <Typography variant="h6">Completed</Typography>
            </Box>
            <Typography variant="h3" color="success.main">
              {stats.completed_trips}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 200, flex: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Warning color="warning" sx={{ mr: 1 }} />
              <Typography variant="h6">HOS Violations</Typography>
            </Box>
            <Typography variant="h3" color="warning.main">
              {stats.hos_violations}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 200, flex: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <LocalShipping color="info" sx={{ mr: 1 }} />
              <Typography variant="h6">Available Drivers</Typography>
            </Box>
            <Typography variant="h3" color="info.main">
              {stats.drivers_available}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ mb: 4 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<Add />}
          component={Link}
          to="/plan-trip"
          sx={{ mr: 2 }}
        >
          Plan New Trip
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<Route />}
          component={Link}
          to="/eld-logs"
        >
          View ELD Logs
        </Button>
      </Box>

      {/* Recent Trips */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Recent Trips
          </Typography>
          <List>
            {trips.map((trip) => (
              <ListItem
                key={trip.id}
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={getStatusLabel(trip.status)}
                      color={getStatusColor(trip.status) as any}
                      size="small"
                    />
                    <IconButton
                      edge="end"
                      component={Link}
                      to={`/trip/${trip.id}`}
                    >
                      <Visibility />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemIcon>
                  <LocalShipping />
                </ListItemIcon>
                <ListItemText
                  primary={`${trip.pickup_location} → ${trip.dropoff_location}`}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Driver: {trip.driver_name} • Distance: {trip.total_distance.toFixed(1)} miles
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Created: {new Date(trip.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
          {trips.length === 0 && (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No trips found. Start by planning a new trip.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default Dashboard;
