from rest_framework import serializers
from routes.models import Driver, Trip, RouteStop
from logs.models import ELDLog, DailyLogSheet, HOSViolation


class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = '__all__'


class RouteStopSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteStop
        fields = '__all__'


class TripSerializer(serializers.ModelSerializer):
    route_stops = RouteStopSerializer(many=True, read_only=True)
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    
    class Meta:
        model = Trip
        fields = '__all__'


class TripCreateSerializer(serializers.Serializer):
    driver_id = serializers.IntegerField()
    current_location = serializers.CharField(max_length=255)
    current_location_lat = serializers.FloatField()
    current_location_lng = serializers.FloatField()
    pickup_location = serializers.CharField(max_length=255)
    pickup_location_lat = serializers.FloatField()
    pickup_location_lng = serializers.FloatField()
    dropoff_location = serializers.CharField(max_length=255)
    dropoff_location_lat = serializers.FloatField()
    dropoff_location_lng = serializers.FloatField()
    current_cycle_used = serializers.FloatField(min_value=0, max_value=70)


class ELDLogSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    
    class Meta:
        model = ELDLog
        fields = '__all__'


class DailyLogSheetSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    eld_logs = ELDLogSerializer(many=True, read_only=True)
    
    class Meta:
        model = DailyLogSheet
        fields = '__all__'


class HOSViolationSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    violation_type_display = serializers.CharField(source='get_violation_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    
    class Meta:
        model = HOSViolation
        fields = '__all__'


class RouteCalculationSerializer(serializers.Serializer):
    current_location = serializers.DictField()
    pickup_location = serializers.DictField()
    dropoff_location = serializers.DictField()
    current_cycle_used = serializers.FloatField()


class HOSComplianceSerializer(serializers.Serializer):
    trip_data = serializers.DictField()
    current_cycle_hours = serializers.FloatField()
