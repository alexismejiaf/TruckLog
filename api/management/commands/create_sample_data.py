from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from routes.models import Driver, Trip, RouteStop
from logs.models import ELDLog
from datetime import datetime, timedelta, date, time
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
            },
            {
                'driver': drivers[2],
                'current_location': 'Las Vegas, NV',
                'current_location_lat': 36.1699,
                'current_location_lng': -115.1398,
                'pickup_location': 'Las Vegas, NV',
                'pickup_location_lat': 36.1699,
                'pickup_location_lng': -115.1398,
                'dropoff_location': 'Austin, TX',
                'dropoff_location_lat': 30.2672,
                'dropoff_location_lng': -97.7431,
                'total_distance': 1090.0,
                'estimated_duration': 960,
                'status': 'in_progress',
                'current_cycle_used': 28.0,
            },
            {
                'driver': drivers[0],  # John Smith gets a second trip (planned)
                'current_location': 'Phoenix, AZ',
                'current_location_lat': 33.4484,
                'current_location_lng': -112.0740,
                'pickup_location': 'Phoenix, AZ',
                'pickup_location_lat': 33.4484,
                'pickup_location_lng': -112.0740,
                'dropoff_location': 'Denver, CO',
                'dropoff_location_lat': 39.7392,
                'dropoff_location_lng': -104.9903,
                'total_distance': 602.0,
                'estimated_duration': 540,
                'status': 'planned',
                'current_cycle_used': 15.5,
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

        # Create sample ELD logs for all trips
        if trips:
            
            for trip in trips:
                driver = trip.driver
                trip_date = trip.created_at.date()
                
                # Generate ELD logs based on trip status
                if trip.status == 'in_progress':
                    # Trip in progress - realistic journey progression
                    if 'Los Angeles' in trip.pickup_location and 'Phoenix' in trip.dropoff_location:
                        # LA to Phoenix trip - currently en route
                        eld_logs_data = [
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(6, 0),
                                'end_time': time(7, 0),
                                'duty_status': 'on_duty',
                                'location': 'Los Angeles, CA',
                                'odometer_start': 100000,
                                'odometer_end': 100000,
                                'hours': 1.0,
                                'remarks': 'Pre-trip inspection and vehicle check'
                            },
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(7, 0),
                                'end_time': time(10, 30),
                                'duty_status': 'driving',
                                'location': 'En route to Phoenix, AZ',
                                'odometer_start': 100000,
                                'odometer_end': 100210,
                                'hours': 3.5,
                                'remarks': 'Highway driving on I-10 East'
                            },
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(10, 30),
                                'end_time': time(11, 0),
                                'duty_status': 'on_duty',
                                'location': 'Rest Area - I-10 East',
                                'odometer_start': 100210,
                                'odometer_end': 100210,
                                'hours': 0.5,
                                'remarks': 'Mandatory 30-minute break'
                            },
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(11, 0),
                                'end_time': time(15, 0),
                                'duty_status': 'driving',
                                'location': 'Currently near Quartzsite, AZ',
                                'odometer_start': 100210,
                                'odometer_end': int(100210 + trip.total_distance * 0.75),  # 75% complete
                                'hours': 4.0,
                                'remarks': 'Continuing to Phoenix - ETA 16:00'
                            }
                        ]
                    elif 'Las Vegas' in trip.pickup_location and 'Austin' in trip.dropoff_location:
                        # Vegas to Austin trip - long haul in progress
                        eld_logs_data = [
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(5, 0),
                                'end_time': time(6, 0),
                                'duty_status': 'on_duty',
                                'location': 'Las Vegas, NV',
                                'odometer_start': 95000,
                                'odometer_end': 95000,
                                'hours': 1.0,
                                'remarks': 'Pre-trip inspection and cargo loading'
                            },
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(6, 0),
                                'end_time': time(9, 0),
                                'duty_status': 'driving',
                                'location': 'En route through Arizona',
                                'odometer_start': 95000,
                                'odometer_end': 95180,
                                'hours': 3.0,
                                'remarks': 'Interstate driving towards Texas'
                            },
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(9, 0),
                                'end_time': time(9, 30),
                                'duty_status': 'off_duty',
                                'location': 'Flagstaff, AZ',
                                'odometer_start': 95180,
                                'odometer_end': 95180,
                                'hours': 0.5,
                                'remarks': 'Fuel and meal break'
                            },
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(9, 30),
                                'end_time': time(14, 0),
                                'duty_status': 'driving',
                                'location': 'Currently in New Mexico',
                                'odometer_start': 95180,
                                'odometer_end': int(95180 + trip.total_distance * 0.4),  # 40% of remaining journey
                                'hours': 4.5,
                                'remarks': 'Cross-country to Texas - making good time'
                            }
                        ]
                    else:
                        # Generic in-progress trip
                        eld_logs_data = [
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(7, 0),
                                'end_time': time(8, 0),
                                'duty_status': 'on_duty',
                                'location': trip.pickup_location,
                                'odometer_start': 100000 + (driver.id * 1000),
                                'odometer_end': 100000 + (driver.id * 1000),
                                'hours': 1.0,
                                'remarks': 'Vehicle inspection and departure prep'
                            },
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(8, 0),
                                'end_time': time(12, 0),
                                'duty_status': 'driving',
                                'location': f'En route to {trip.dropoff_location}',
                                'odometer_start': 100000 + (driver.id * 1000),
                                'odometer_end': int(100000 + (driver.id * 1000) + trip.total_distance * 0.6),
                                'hours': 4.0,
                                'remarks': 'Highway driving - trip in progress'
                            }
                        ]
                
                elif trip.status == 'planned':
                    # Trip planned - realistic pre-trip activities based on route
                    if 'Dallas' in trip.pickup_location and 'Houston' in trip.dropoff_location:
                        # Short Dallas to Houston route
                        eld_logs_data = [
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(8, 0),
                                'end_time': time(8, 30),
                                'duty_status': 'on_duty',
                                'location': 'Dallas, TX',
                                'odometer_start': 102500,
                                'odometer_end': 102500,
                                'hours': 0.5,
                                'remarks': 'Route planning for Dallas-Houston delivery'
                            },
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(8, 30),
                                'end_time': time(9, 0),
                                'duty_status': 'on_duty',
                                'location': 'Dallas, TX',
                                'odometer_start': 102500,
                                'odometer_end': 102500,
                                'hours': 0.5,
                                'remarks': 'Pre-trip vehicle inspection - ready for departure'
                            }
                        ]
                    elif 'Phoenix' in trip.pickup_location and 'Denver' in trip.dropoff_location:
                        # Phoenix to Denver route
                        eld_logs_data = [
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(7, 30),
                                'end_time': time(8, 0),
                                'duty_status': 'on_duty',
                                'location': 'Phoenix, AZ',
                                'odometer_start': 100650,  # Different odometer for this driver
                                'odometer_end': 100650,
                                'hours': 0.5,
                                'remarks': 'Long-haul trip prep - Phoenix to Denver'
                            },
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(8, 0),
                                'end_time': time(8, 45),
                                'duty_status': 'on_duty',
                                'location': 'Phoenix, AZ',
                                'odometer_start': 100650,
                                'odometer_end': 100650,
                                'hours': 0.75,
                                'remarks': 'Thorough vehicle inspection for mountain route'
                            }
                        ]
                    else:
                        # Generic planned trip
                        eld_logs_data = [
                            {
                                'trip': trip,
                                'driver': driver,
                                'date': trip_date,
                                'start_time': time(8, 0),
                                'end_time': time(8, 30),
                                'duty_status': 'on_duty',
                                'location': trip.pickup_location,
                                'odometer_start': 95000 + (driver.id * 1000),
                                'odometer_end': 95000 + (driver.id * 1000),
                                'hours': 0.5,
                                'remarks': 'Trip planning and route preparation'
                            }
                        ]
                
                elif trip.status == 'completed':
                    # Completed trip - full journey logs
                    eld_logs_data = [
                        {
                            'trip': trip,
                            'driver': driver,
                            'date': trip_date - timedelta(days=1),  # Yesterday
                            'start_time': time(6, 0),
                            'end_time': time(7, 0),
                            'duty_status': 'on_duty',
                            'location': trip.current_location,
                            'odometer_start': 90000 + (driver.id * 1000),
                            'odometer_end': 90000 + (driver.id * 1000),
                            'hours': 1.0,
                            'remarks': 'Pre-trip inspection'
                        },
                        {
                            'trip': trip,
                            'driver': driver,
                            'date': trip_date - timedelta(days=1),
                            'start_time': time(7, 0),
                            'end_time': time(12, 0),
                            'duty_status': 'driving',
                            'location': trip.pickup_location,
                            'odometer_start': 90000 + (driver.id * 1000),
                            'odometer_end': int(90000 + (driver.id * 1000) + trip.total_distance * 0.4),
                            'hours': 5.0,
                            'remarks': 'Completed journey to pickup'
                        },
                        {
                            'trip': trip,
                            'driver': driver,
                            'date': trip_date - timedelta(days=1),
                            'start_time': time(12, 0),
                            'end_time': time(13, 0),
                            'duty_status': 'on_duty',
                            'location': trip.pickup_location,
                            'odometer_start': int(90000 + (driver.id * 1000) + trip.total_distance * 0.4),
                            'odometer_end': int(90000 + (driver.id * 1000) + trip.total_distance * 0.4),
                            'hours': 1.0,
                            'remarks': 'Loading completed'
                        },
                        {
                            'trip': trip,
                            'driver': driver,
                            'date': trip_date - timedelta(days=1),
                            'start_time': time(13, 0),
                            'end_time': time(18, 0),
                            'duty_status': 'driving',
                            'location': trip.dropoff_location,
                            'odometer_start': int(90000 + (driver.id * 1000) + trip.total_distance * 0.4),
                            'odometer_end': int(90000 + (driver.id * 1000) + trip.total_distance),
                            'hours': 5.0,
                            'remarks': 'Trip completed successfully'
                        },
                        {
                            'trip': trip,
                            'driver': driver,
                            'date': trip_date - timedelta(days=1),
                            'start_time': time(18, 0),
                            'end_time': time(18, 30),
                            'duty_status': 'on_duty',
                            'location': trip.dropoff_location,
                            'odometer_start': int(90000 + (driver.id * 1000) + trip.total_distance),
                            'odometer_end': int(90000 + (driver.id * 1000) + trip.total_distance),
                            'hours': 0.5,
                            'remarks': 'Unloading and delivery confirmation'
                        }
                    ]
                
                else:
                    # Default case
                    eld_logs_data = [
                        {
                            'trip': trip,
                            'driver': driver,
                            'date': trip_date,
                            'start_time': time(8, 0),
                            'end_time': time(9, 0),
                            'duty_status': 'on_duty',
                            'location': trip.current_location,
                            'odometer_start': 100000 + (driver.id * 1000),
                            'odometer_end': 100000 + (driver.id * 1000),
                            'hours': 1.0,
                            'remarks': 'Standard duty log entry'
                        }
                    ]

                # Create the ELD logs for this trip
                for log_data in eld_logs_data:
                    log, created = ELDLog.objects.get_or_create(
                        trip=log_data['trip'],
                        driver=log_data['driver'],
                        date=log_data['date'],
                        start_time=log_data['start_time'],
                        defaults=log_data
                    )
                    if created:
                        self.stdout.write(f'Created ELD log: {log.duty_status} for {log.driver.name} on trip {trip.pickup_location} → {trip.dropoff_location}')

        # Add realistic off-duty and rest logs for compliance
        if drivers and trips:
            additional_logs = [
                # John Smith - Previous day rest
                {
                    'trip': trips[0],  # Associate with his LA-Phoenix trip
                    'driver': drivers[0],
                    'date': date.today() - timedelta(days=1),
                    'start_time': time(20, 0),
                    'end_time': time(6, 0),  # 10-hour sleeper berth
                    'duty_status': 'sleeper',
                    'location': 'Truck Stop - Barstow, CA',
                    'odometer_start': 99850,
                    'odometer_end': 99850,
                    'hours': 10.0,
                    'remarks': 'Required 10-hour rest period'
                },
                # Sarah Johnson - Current day meal break  
                {
                    'trip': trips[1] if len(trips) > 1 else trips[0],
                    'driver': drivers[1] if len(drivers) > 1 else drivers[0],
                    'date': date.today(),
                    'start_time': time(12, 0),
                    'end_time': time(13, 0),
                    'duty_status': 'off_duty',
                    'location': 'Dallas, TX',
                    'odometer_start': 102500,
                    'odometer_end': 102500,
                    'hours': 1.0,
                    'remarks': 'Lunch break before trip departure'
                },
                # Mike Williams - Rest break during long haul
                {
                    'trip': trips[2] if len(trips) > 2 else trips[0],
                    'driver': drivers[2] if len(drivers) > 2 else drivers[0],
                    'date': date.today(),
                    'start_time': time(14, 0),
                    'end_time': time(14, 30),
                    'duty_status': 'off_duty',
                    'location': 'Rest Area - I-40 East',
                    'odometer_start': int(95180 + 150),  # Continuing from driving log
                    'odometer_end': int(95180 + 150),
                    'hours': 0.5,
                    'remarks': 'Required 30-minute break - long haul compliance'
                }
            ]

            for log_data in additional_logs:
                log, created = ELDLog.objects.get_or_create(
                    trip=log_data['trip'],
                    driver=log_data['driver'],
                    date=log_data['date'],
                    start_time=log_data['start_time'],
                    defaults=log_data
                )
                if created:
                    self.stdout.write(f'Created additional ELD log: {log.duty_status} for {log.driver.name}')

        self.stdout.write(self.style.SUCCESS('Sample data created successfully!'))