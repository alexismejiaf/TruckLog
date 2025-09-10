from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from datetime import datetime, date
import json

from routes.models import Driver, Trip, RouteStop
from logs.models import ELDLog, DailyLogSheet, HOSViolation
from routes.services import RouteCalculatorService, HOSComplianceService
from logs.services import ELDLogGenerator
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
        serializer = TripCreateSerializer(data=request.data)
        if serializer.is_valid():
            # Calculate route
            route_service = RouteCalculatorService()
            route_result = route_service.calculate_route(
                current_location={
                    'lat': serializer.validated_data['current_location_lat'],
                    'lng': serializer.validated_data['current_location_lng'],
                    'address': serializer.validated_data['current_location']
                },
                pickup_location={
                    'lat': serializer.validated_data['pickup_location_lat'],
                    'lng': serializer.validated_data['pickup_location_lng'],
                    'address': serializer.validated_data['pickup_location']
                },
                dropoff_location={
                    'lat': serializer.validated_data['dropoff_location_lat'],
                    'lng': serializer.validated_data['dropoff_location_lng'],
                    'address': serializer.validated_data['dropoff_location']
                }
            )
            
            if not route_result['success']:
                return Response(
                    {'error': 'Failed to calculate route: ' + route_result.get('error', 'Unknown error')},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create trip
            driver = get_object_or_404(Driver, id=serializer.validated_data['driver_id'])
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
    """Calculate route with fuel stops and timing"""
    serializer = RouteCalculationSerializer(data=request.data)
    if serializer.is_valid():
        route_service = RouteCalculatorService()
        result = route_service.calculate_route(
            serializer.validated_data['current_location'],
            serializer.validated_data['pickup_location'],
            serializer.validated_data['dropoff_location']
        )
        return Response(result)
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
    """Download daily log sheet as PDF"""
    try:
        daily_log = get_object_or_404(DailyLogSheet, id=log_id)
        generator = ELDLogGenerator()
        pdf_content = generator.generate_daily_log_pdf(daily_log)
        
        response = HttpResponse(pdf_content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="daily_log_{daily_log.driver.name}_{daily_log.date}.pdf"'
        return response
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
