from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class Driver(models.Model):
    """Driver information model"""
    name = models.CharField(max_length=100)
    license_number = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name


class Trip(models.Model):
    """Main trip model containing all trip details"""
    TRIP_STATUS_CHOICES = [
        ('planned', 'Planned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE)
    current_location = models.CharField(max_length=255)
    current_location_lat = models.FloatField()
    current_location_lng = models.FloatField()
    
    pickup_location = models.CharField(max_length=255)
    pickup_location_lat = models.FloatField()
    pickup_location_lng = models.FloatField()
    
    dropoff_location = models.CharField(max_length=255)
    dropoff_location_lat = models.FloatField()
    dropoff_location_lng = models.FloatField()
    
    current_cycle_used = models.FloatField(
        validators=[MinValueValidator(0), MaxValueValidator(70)],
        help_text="Current cycle hours used (0-70)"
    )
    
    total_distance = models.FloatField(null=True, blank=True)
    estimated_duration = models.FloatField(null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=TRIP_STATUS_CHOICES, default='planned')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Trip {self.id}: {self.pickup_location} to {self.dropoff_location}"


class RouteStop(models.Model):
    """Route stops including fuel stops, rest breaks, and mandatory stops"""
    STOP_TYPE_CHOICES = [
        ('pickup', 'Pickup'),
        ('dropoff', 'Dropoff'),
        ('fuel', 'Fuel Stop'),
        ('rest', 'Rest Break'),
        ('meal', 'Meal Break'),
        ('sleeper', 'Sleeper Break'),
    ]
    
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='route_stops')
    stop_order = models.IntegerField()
    stop_type = models.CharField(max_length=20, choices=STOP_TYPE_CHOICES)
    
    location = models.CharField(max_length=255)
    location_lat = models.FloatField()
    location_lng = models.FloatField()
    
    estimated_arrival = models.DateTimeField()
    estimated_departure = models.DateTimeField()
    duration_minutes = models.IntegerField()
    
    distance_from_previous = models.FloatField(default=0)
    cumulative_distance = models.FloatField(default=0)
    
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['stop_order']
    
    def __str__(self):
        return f"{self.get_stop_type_display()} - {self.location}"
