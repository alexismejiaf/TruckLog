from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from datetime import datetime, date, timedelta
import json
import math

from routes.models import Driver, Trip, RouteStop
from logs.models import ELDLog, DailyLogSheet, HOSViolation
# from routes.services import RouteCalculatorService, HOSComplianceService  # Removed for simplicity
# from logs.services import ELDLogGenerator  # Removed for simplicity
from .serializers import (
    DriverSerializer, TripSerializer, TripCreateSerializer, 
    ELDLogSerializer, DailyLogSheetSerializer, HOSViolationSerializer,
    RouteCalculationSerializer, HOSComplianceSerializer
)


class DriverListCreateView(APIView):
    """List all drivers or create a new driver"""
    
    def get(self, request):
        drivers = Driver.objects.all()
        serializer = DriverSerializer(drivers, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        serializer = DriverSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TripListCreateView(APIView):
    """List all trips or create a new trip with route calculation"""
    
    def get(self, request):
        trips = Trip.objects.all().order_by('-created_at')
        serializer = TripSerializer(trips, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        try:
            serializer = TripCreateSerializer(data=request.data)
            if serializer.is_valid():
                # Get the driver
                driver = get_object_or_404(Driver, id=serializer.validated_data['driver_id'])
                
                # Calculate simple distance (fallback method)
                pickup_lat = serializer.validated_data['pickup_location_lat']
                pickup_lng = serializer.validated_data['pickup_location_lng']
                dropoff_lat = serializer.validated_data['dropoff_location_lat']
                dropoff_lng = serializer.validated_data['dropoff_location_lng']
                
                # Simple distance calculation using Haversine formula
                def calculate_distance(lat1, lon1, lat2, lon2):
                    import math
                    R = 3959  # Earth radius in miles
                    dlat = math.radians(lat2 - lat1)
                    dlon = math.radians(lon2 - lon1)
                    a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
                    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                    return R * c
                
                total_distance = calculate_distance(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
                estimated_duration = total_distance / 60  # Assume 60 mph average
                
                # Create trip with simple calculation
                trip = Trip.objects.create(
                    driver=driver,
                    current_location=serializer.validated_data['current_location'],
                    current_location_lat=serializer.validated_data['current_location_lat'],
                    current_location_lng=serializer.validated_data['current_location_lng'],
                    pickup_location=serializer.validated_data['pickup_location'],
                    pickup_location_lat=serializer.validated_data['pickup_location_lat'],
                    pickup_location_lng=serializer.validated_data['pickup_location_lng'],
                    dropoff_location=serializer.validated_data['dropoff_location'],
                    dropoff_location_lat=serializer.validated_data['dropoff_location_lat'],
                    dropoff_location_lng=serializer.validated_data['dropoff_location_lng'],
                    current_cycle_used=serializer.validated_data['current_cycle_used'],
                    total_distance=total_distance,
                    estimated_duration=estimated_duration,
                    status='planned'
                )
                
                # Create basic route stops
                RouteStop.objects.create(
                    trip=trip,
                    stop_order=1,
                    stop_type='pickup',
                    location=serializer.validated_data['pickup_location'],
                    location_lat=pickup_lat,
                    location_lng=pickup_lng,
                    estimated_arrival=datetime.now() + timedelta(hours=1),
                    estimated_departure=datetime.now() + timedelta(hours=2),
                    duration_minutes=60,
                    distance_from_previous=0,
                    cumulative_distance=0
                )
                
                RouteStop.objects.create(
                    trip=trip,
                    stop_order=2,
                    stop_type='dropoff',
                    location=serializer.validated_data['dropoff_location'],
                    location_lat=dropoff_lat,
                    location_lng=dropoff_lng,
                    estimated_arrival=datetime.now() + timedelta(hours=estimated_duration),
                    estimated_departure=datetime.now() + timedelta(hours=estimated_duration + 1),
                    duration_minutes=60,
                    distance_from_previous=total_distance,
                    cumulative_distance=total_distance
                )
                
                # Simple HOS compliance check
                compliance_result = {
                    'is_compliant': True,
                    'violations': [],
                    'warnings': [],
                    'recommendations': []
                }
                
                # Basic compliance logic
                if estimated_duration > 11:
                    compliance_result['is_compliant'] = False
                    compliance_result['violations'].append({
                        'type': 'driving_time_exceeded',
                        'message': 'Estimated driving time exceeds 11-hour limit'
                    })
                
                if serializer.validated_data['current_cycle_used'] + estimated_duration > 70:
                    compliance_result['warnings'].append({
                        'type': 'cycle_hours_warning',
                        'message': 'Trip may approach 70-hour cycle limit'
                    })
                
                # Return response
                return Response({
                    'trip': TripSerializer(trip).data,
                    'route': {
                        'total_distance': total_distance,
                        'estimated_duration': estimated_duration,
                        'stops': [
                            {
                                'type': 'pickup',
                                'location': {'address': trip.pickup_location, 'lat': pickup_lat, 'lng': pickup_lng}
                            },
                            {
                                'type': 'dropoff', 
                                'location': {'address': trip.dropoff_location, 'lat': dropoff_lat, 'lng': dropoff_lng}
                            }
                        ]
                    },
                    'compliance': compliance_result
                }, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            import traceback
            print(f"Trip creation error: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {'error': f'Internal server error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
                current_location_lng=serializer.validated_data['current_location_lng'],
                pickup_location=serializer.validated_data['pickup_location'],
                pickup_location_lat=serializer.validated_data['pickup_location_lat'],
                pickup_location_lng=serializer.validated_data['pickup_location_lng'],
                dropoff_location=serializer.validated_data['dropoff_location'],
                dropoff_location_lat=serializer.validated_data['dropoff_location_lat'],
                dropoff_location_lng=serializer.validated_data['dropoff_location_lng'],
                current_cycle_used=serializer.validated_data['current_cycle_used'],
                total_distance=route_result['total_distance'],
                estimated_duration=route_result['estimated_duration']
            )
            
            # Create route stops
            for i, stop in enumerate(route_result['route']['stops']):
                RouteStop.objects.create(
                    trip=trip,
                    stop_order=i,
                    stop_type=stop['type'],
                    location=stop['location'].get('address', 'Unknown'),
                    location_lat=stop['location'].get('lat', 0),
                    location_lng=stop['location'].get('lng', 0),
                    estimated_arrival=stop.get('estimated_arrival', datetime.now()),
                    estimated_departure=stop.get('estimated_departure', datetime.now()),
                    duration_minutes=stop.get('duration_minutes', 0),
                    distance_from_previous=stop.get('distance_from_previous', 0),
                    cumulative_distance=stop.get('cumulative_distance', 0)
                )
            
            # Check HOS compliance
            hos_service = HOSComplianceService()
            compliance_result = hos_service.check_compliance(
                {
                    'total_distance': route_result['total_distance'],
                    'estimated_duration': route_result['estimated_duration'],
                    'stops': route_result['route']['stops']
                },
                serializer.validated_data['current_cycle_used']
            )
            
            # Create violation records if any
            for violation in compliance_result['violations']:
                HOSViolation.objects.create(
                    trip=trip,
                    driver=driver,
                    violation_type=violation['type'],
                    severity=violation['severity'],
                    description=violation['description'],
                    violation_time=datetime.now()
                )
            
            trip_serializer = TripSerializer(trip)
            return Response({
                'trip': trip_serializer.data,
                'route': route_result['route'],
                'compliance': compliance_result
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def calculate_route(request):
    """Calculate route with simple distance calculation"""
    serializer = RouteCalculationSerializer(data=request.data)
    if serializer.is_valid():
        # Simple route calculation without external services
        try:
            current = serializer.validated_data['current_location']
            pickup = serializer.validated_data['pickup_location']
            dropoff = serializer.validated_data['dropoff_location']
            
            # Calculate simple distance
            def calculate_distance(lat1, lon1, lat2, lon2):
                R = 3959  # Earth radius in miles
                dlat = math.radians(lat2 - lat1)
                dlon = math.radians(lon2 - lon1)
                a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                return R * c
            
            total_distance = calculate_distance(
                pickup.get('lat', 0), pickup.get('lng', 0),
                dropoff.get('lat', 0), dropoff.get('lng', 0)
            )
            
            result = {
                'success': True,
                'route': {
                    'total_distance': total_distance,
                    'estimated_duration': total_distance / 60,  # Assume 60 mph
                    'stops': [
                        {'type': 'pickup', 'location': pickup},
                        {'type': 'dropoff', 'location': dropoff}
                    ]
                },
                'total_distance': total_distance,
                'estimated_duration': total_distance / 60
            }
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ELDLogListCreateView(APIView):
    """List all ELD logs or create a new ELD log"""
    
    def get(self, request):
        logs = ELDLog.objects.all().order_by('-date', '-start_time')
        
        # Filter by trip if provided
        trip_id = request.query_params.get('trip_id')
        if trip_id:
            logs = logs.filter(trip_id=trip_id)
        
        # Filter by driver if provided
        driver_id = request.query_params.get('driver_id')
        if driver_id:
            logs = logs.filter(driver_id=driver_id)
        
        # Filter by date range if provided
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            logs = logs.filter(date__gte=start_date)
        if end_date:
            logs = logs.filter(date__lte=end_date)
        
        serializer = ELDLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        serializer = ELDLogSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DailyLogSheetListView(APIView):
    """List daily log sheets"""
    
    def get(self, request):
        sheets = DailyLogSheet.objects.all().order_by('-date')
        
        # Filter by driver if provided
        driver_id = request.query_params.get('driver_id')
        if driver_id:
            sheets = sheets.filter(driver_id=driver_id)
        
        # Filter by date range if provided
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            sheets = sheets.filter(date__gte=start_date)
        if end_date:
            sheets = sheets.filter(date__lte=end_date)
        
        serializer = DailyLogSheetSerializer(sheets, many=True)
        return Response(serializer.data)


class HOSViolationListView(APIView):
    """List HOS violations"""
    
    def get(self, request):
        violations = HOSViolation.objects.all().order_by('-violation_time')
        
        # Filter by driver if provided
        driver_id = request.query_params.get('driver_id')
        if driver_id:
            violations = violations.filter(driver_id=driver_id)
        
        serializer = HOSViolationSerializer(violations, many=True)
        return Response(serializer.data)


@api_view(['GET'])
def download_daily_log(request, log_id):
    """Download daily log sheet as PDF (simplified)"""
    try:
        daily_log = get_object_or_404(DailyLogSheet, id=log_id)
        
        # For now, return a simple response - PDF generation can be added later
        response_data = {
            'message': 'PDF generation temporarily disabled for stability',
            'log_id': log_id,
            'driver': daily_log.driver.name,
            'date': daily_log.date
        }
        return Response(response_data)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
