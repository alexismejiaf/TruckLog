from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from routes.models import Driver, Trip, RouteStop
from logs.models import ELDLog
from datetime import datetime, timedelta
from django.utils import timezone

class Command(BaseCommand):
    help = 'Create sample data for the TruckLog application'

    def handle(self, *args, **options):
        self.stdout.write('Creating sample data...')

        # Create sample drivers
        drivers_data = [
            {'name': 'John Smith', 'license_number': 'CDL123456'},
            {'name': 'Sarah Johnson', 'license_number': 'CDL789012'},
            {'name': 'Mike Williams', 'license_number': 'CDL345678'},
        ]

        drivers = []
        for driver_data in drivers_data:
            driver, created = Driver.objects.get_or_create(
                license_number=driver_data['license_number'],
                defaults=driver_data
            )
            drivers.append(driver)
            if created:
                self.stdout.write(f'Created driver: {driver.name}')

        # Create sample trips
        trips_data = [
            {
                'driver': drivers[0],
                'current_location': 'Phoenix, AZ',
                'current_location_lat': 33.4484,
                'current_location_lng': -112.0740,
                'pickup_location': 'Los Angeles, CA',
                'pickup_location_lat': 34.0522,
                'pickup_location_lng': -118.2437,
                'dropoff_location': 'Phoenix, AZ', 
                'dropoff_location_lat': 33.4484,
                'dropoff_location_lng': -112.0740,
                'total_distance': 372.5,
                'estimated_duration': 360,
                'status': 'in_progress',
                'current_cycle_used': 8.5,
            },
            {
                'driver': drivers[1],
                'current_location': 'Dallas, TX',
                'current_location_lat': 32.7767,
                'current_location_lng': -96.7970,
                'pickup_location': 'Dallas, TX',
                'pickup_location_lat': 32.7767,
                'pickup_location_lng': -96.7970,
                'dropoff_location': 'Houston, TX',
                'dropoff_location_lat': 29.7604,
                'dropoff_location_lng': -95.3698,
                'total_distance': 239.8,
                'estimated_duration': 240,
                'status': 'planned',
                'current_cycle_used': 4.2,
            }
        ]

        trips = []
        for trip_data in trips_data:
            trip, created = Trip.objects.get_or_create(
                driver=trip_data['driver'],
                pickup_location=trip_data['pickup_location'],
                dropoff_location=trip_data['dropoff_location'],
                defaults=trip_data
            )
            trips.append(trip)
            if created:
                self.stdout.write(f'Created trip: {trip.pickup_location} → {trip.dropoff_location}')

        # Create sample route stops
        if trips:
            route_stops_data = [
                {
                    'trip': trips[0],
                    'stop_order': 1,
                    'stop_type': 'pickup',
                    'location': 'Los Angeles, CA',
                    'location_lat': 34.0522,
                    'location_lng': -118.2437,
                    'estimated_arrival': timezone.now() + timedelta(hours=1),
                    'estimated_departure': timezone.now() + timedelta(hours=2),
                    'duration_minutes': 60,
                    'distance_from_previous': 0,
                    'cumulative_distance': 0,
                    'notes': 'Pickup location'
                },
                {
                    'trip': trips[0],
                    'stop_order': 2,
                    'stop_type': 'dropoff',
                    'location': 'Phoenix, AZ',
                    'location_lat': 33.4484,
                    'location_lng': -112.0740,
                    'estimated_arrival': timezone.now() + timedelta(hours=6),
                    'estimated_departure': timezone.now() + timedelta(hours=7),
                    'duration_minutes': 60,
                    'distance_from_previous': 372.5,
                    'cumulative_distance': 372.5,
                    'notes': 'Final destination'
                }
            ]

            for stop_data in route_stops_data:
                stop, created = RouteStop.objects.get_or_create(
                    trip=stop_data['trip'],
                    stop_order=stop_data['stop_order'],
                    defaults=stop_data
                )
                if created:
                    self.stdout.write(f'Created route stop: {stop.location}')

        # Create sample ELD logs
        if trips:
            eld_logs_data = [
                {
                    'trip': trips[0],
                    'driver': drivers[0],
                    'event_type': 'on_duty',
                    'start_time': timezone.now() - timedelta(hours=8),
                    'end_time': timezone.now() - timedelta(hours=7),
                    'duration_minutes': 60,
                    'location': 'Los Angeles, CA',
                    'location_lat': 34.0522,
                    'location_lng': -118.2437,
                    'notes': 'Pre-trip inspection'
                },
                {
                    'trip': trips[0],
                    'driver': drivers[0],
                    'event_type': 'driving',
                    'start_time': timezone.now() - timedelta(hours=7),
                    'end_time': timezone.now() - timedelta(hours=2),
                    'duration_minutes': 300,
                    'location': 'En route to Phoenix',
                    'location_lat': 33.8,
                    'location_lng': -115.5,
                    'notes': 'Highway driving'
                }
            ]

            for log_data in eld_logs_data:
                log, created = ELDLog.objects.get_or_create(
                    trip=log_data['trip'],
                    driver=log_data['driver'],
                    event_type=log_data['event_type'],
                    start_time=log_data['start_time'],
                    defaults=log_data
                )
                if created:
                    self.stdout.write(f'Created ELD log: {log.event_type} for {log.driver.name}')

        self.stdout.write(self.style.SUCCESS('Sample data created successfully!'))