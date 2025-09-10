from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from routes.models import Trip, Driver


class ELDLog(models.Model):
    """Electronic Logging Device log entries"""
    DUTY_STATUS_CHOICES = [
        ('off_duty', 'Off Duty'),
        ('sleeper', 'Sleeper Berth'),
        ('driving', 'Driving'),
        ('on_duty', 'On Duty (Not Driving)'),
    ]
    
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='eld_logs')
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE)
    
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    duty_status = models.CharField(max_length=20, choices=DUTY_STATUS_CHOICES)
    
    location = models.CharField(max_length=255, blank=True)
    odometer_start = models.IntegerField(null=True, blank=True)
    odometer_end = models.IntegerField(null=True, blank=True)
    
    hours = models.FloatField()
    remarks = models.TextField(blank=True)
    
    # HOS tracking fields
    cycle_hours_used = models.FloatField(default=0)
    daily_driving_hours = models.FloatField(default=0)
    daily_duty_hours = models.FloatField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['date', 'start_time']
    
    def __str__(self):
        return f"{self.driver.name} - {self.date} - {self.get_duty_status_display()}"


class DailyLogSheet(models.Model):
    """Daily log sheet model for generating visual logs"""
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='daily_logs')
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE)
    date = models.DateField()
    
    # Vehicle information
    vehicle_id = models.CharField(max_length=50, blank=True)
    odometer_start = models.IntegerField(null=True, blank=True)
    odometer_end = models.IntegerField(null=True, blank=True)
    total_miles = models.IntegerField(null=True, blank=True)
    
    # Daily totals
    total_driving_hours = models.FloatField(default=0)
    total_on_duty_hours = models.FloatField(default=0)
    total_off_duty_hours = models.FloatField(default=0)
    total_sleeper_hours = models.FloatField(default=0)
    
    # HOS compliance
    cycle_hours_remaining = models.FloatField(default=70)
    next_drive_time_available = models.DateTimeField(null=True, blank=True)
    
    # File path to generated log sheet image
    log_sheet_file = models.FileField(upload_to='log_sheets/', null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['trip', 'driver', 'date']
        ordering = ['date']
    
    def __str__(self):
        return f"{self.driver.name} - Daily Log - {self.date}"


class HOSViolation(models.Model):
    """Track Hours of Service violations"""
    VIOLATION_TYPE_CHOICES = [
        ('11_hour_driving', '11-Hour Driving Limit'),
        ('14_hour_duty', '14-Hour Duty Limit'),
        ('70_hour_cycle', '70-Hour/8-Day Cycle'),
        ('10_hour_break', '10-Hour Break Requirement'),
        ('30_minute_break', '30-Minute Break Requirement'),
    ]
    
    SEVERITY_CHOICES = [
        ('warning', 'Warning'),
        ('violation', 'Violation'),
        ('critical', 'Critical'),
    ]
    
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='violations')
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE)
    eld_log = models.ForeignKey(ELDLog, on_delete=models.CASCADE, null=True, blank=True)
    
    violation_type = models.CharField(max_length=30, choices=VIOLATION_TYPE_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    description = models.TextField()
    
    violation_time = models.DateTimeField()
    resolved = models.BooleanField(default=False)
    resolution_notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.get_violation_type_display()} - {self.driver.name}"
