import requests
import math
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
# from geopy.distance import geodesic  # Temporarily disabled - causes build issues
from django.conf import settings


def calculate_distance(coord1, coord2):
    """Simple distance calculation using Haversine formula"""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    
    # Haversine formula for distance calculation
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


class RouteCalculatorService:
    """Service for calculating routes with fuel stops and rest breaks"""
    
    def __init__(self):
        self.fuel_range_miles = 1000  # Fuel every 1000 miles
        self.google_api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        
    def calculate_route(self, current_location: Dict, pickup_location: Dict, dropoff_location: Dict) -> Dict:
        """Calculate route with fuel stops and travel times"""
        try:
            # Calculate route segments
            route_data = self._get_route_data(current_location, pickup_location, dropoff_location)
            
            # Add fuel stops
            route_with_stops = self._add_fuel_stops(route_data)
            
            # Calculate estimated times
            route_with_timing = self._calculate_timing(route_with_stops)
            
            return {
                'success': True,
                'route': route_with_timing,
                'total_distance': route_with_timing.get('total_distance', 0),
                'estimated_duration': route_with_timing.get('estimated_duration', 0)
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'route': None
            }
    
    def _get_route_data(self, current_location: Dict, pickup_location: Dict, dropoff_location: Dict) -> Dict:
        """Get route data from mapping service"""
        waypoints = [
            (current_location['lat'], current_location['lng']),
            (pickup_location['lat'], pickup_location['lng']),
            (dropoff_location['lat'], dropoff_location['lng'])
        ]
        
        # Calculate distances between waypoints
        total_distance = 0
        segments = []
        
        for i in range(len(waypoints) - 1):
            distance = calculate_distance(waypoints[i], waypoints[i + 1])
            total_distance += distance
            
            segments.append({
                'start': waypoints[i],
                'end': waypoints[i + 1],
                'distance': distance,
                'start_location': current_location if i == 0 else pickup_location,
                'end_location': pickup_location if i == 0 else dropoff_location
            })
        
        return {
            'segments': segments,
            'total_distance': total_distance,
            'waypoints': waypoints
        }
    
    def _add_fuel_stops(self, route_data: Dict) -> Dict:
        """Add fuel stops every 1000 miles"""
        stops = []
        cumulative_distance = 0
        
        # Add current location as starting point
        stops.append({
            'type': 'start',
            'location': route_data['segments'][0]['start_location'],
            'distance_from_previous': 0,
            'cumulative_distance': 0
        })
        
        for segment in route_data['segments']:
            segment_distance = segment['distance']
            
            # Check if we need fuel stops in this segment
            while cumulative_distance + segment_distance > (len([s for s in stops if s['type'] == 'fuel']) + 1) * self.fuel_range_miles:
                # Calculate fuel stop position
                fuel_distance = (len([s for s in stops if s['type'] == 'fuel']) + 1) * self.fuel_range_miles
                
                # Interpolate position along route
                fuel_lat, fuel_lng = self._interpolate_position(
                    segment['start'], segment['end'], 
                    (fuel_distance - cumulative_distance) / segment_distance
                )
                
                stops.append({
                    'type': 'fuel',
                    'location': {
                        'lat': fuel_lat,
                        'lng': fuel_lng,
                        'address': f"Fuel Stop {len([s for s in stops if s['type'] == 'fuel']) + 1}"
                    },
                    'distance_from_previous': fuel_distance - cumulative_distance,
                    'cumulative_distance': fuel_distance
                })
            
            cumulative_distance += segment_distance
            
            # Add pickup/dropoff stops
            if segment['end_location'] != route_data['segments'][-1]['end_location']:
                stops.append({
                    'type': 'pickup',
                    'location': segment['end_location'],
                    'distance_from_previous': segment_distance,
                    'cumulative_distance': cumulative_distance
                })
            else:
                stops.append({
                    'type': 'dropoff',
                    'location': segment['end_location'],
                    'distance_from_previous': segment_distance,
                    'cumulative_distance': cumulative_distance
                })
        
        route_data['stops'] = stops
        return route_data
    
    def _interpolate_position(self, start: Tuple, end: Tuple, ratio: float) -> Tuple:
        """Interpolate position between two coordinates"""
        lat = start[0] + (end[0] - start[0]) * ratio
        lng = start[1] + (end[1] - start[1]) * ratio
        return lat, lng
    
    def _calculate_timing(self, route_data: Dict) -> Dict:
        """Calculate timing for each stop including HOS requirements"""
        current_time = datetime.now()
        average_speed = 60  # mph
        
        for i, stop in enumerate(route_data['stops']):
            if i == 0:
                stop['estimated_arrival'] = current_time
                stop['estimated_departure'] = current_time
                stop['duration_minutes'] = 0
            else:
                # Calculate travel time from previous stop
                travel_time_hours = stop['distance_from_previous'] / average_speed
                arrival_time = route_data['stops'][i-1]['estimated_departure'] + timedelta(hours=travel_time_hours)
                
                # Determine stop duration
                if stop['type'] == 'fuel':
                    duration_minutes = 30
                elif stop['type'] in ['pickup', 'dropoff']:
                    duration_minutes = 60  # 1 hour as specified
                else:
                    duration_minutes = 0
                
                stop['estimated_arrival'] = arrival_time
                stop['estimated_departure'] = arrival_time + timedelta(minutes=duration_minutes)
                stop['duration_minutes'] = duration_minutes
        
        # Calculate total duration
        if route_data['stops']:
            total_duration = (route_data['stops'][-1]['estimated_departure'] - route_data['stops'][0]['estimated_arrival']).total_seconds() / 3600
            route_data['estimated_duration'] = total_duration
        
        return route_data


class HOSComplianceService:
    """Service for Hours of Service compliance calculations"""
    
    def __init__(self):
        self.max_driving_hours_daily = 11
        self.max_duty_hours_daily = 14
        self.max_cycle_hours = 70
        self.cycle_days = 8
        self.min_off_duty_break = 10
        self.required_30_min_break = 0.5
        self.break_required_after_hours = 8
    
    def check_compliance(self, trip_data: Dict, current_cycle_hours: float) -> Dict:
        """Check HOS compliance for a trip"""
        violations = []
        warnings = []
        
        # Calculate trip duration and required breaks
        trip_analysis = self._analyze_trip_requirements(trip_data, current_cycle_hours)
        
        # Check for violations
        if trip_analysis['total_driving_hours'] > self.max_driving_hours_daily:
            violations.append({
                'type': '11_hour_driving',
                'severity': 'violation',
                'description': f"Trip requires {trip_analysis['total_driving_hours']:.1f} hours of driving, exceeding 11-hour limit"
            })
        
        if trip_analysis['total_duty_hours'] > self.max_duty_hours_daily:
            violations.append({
                'type': '14_hour_duty',
                'severity': 'violation',
                'description': f"Trip requires {trip_analysis['total_duty_hours']:.1f} hours on duty, exceeding 14-hour limit"
            })
        
        if current_cycle_hours + trip_analysis['cycle_hours_needed'] > self.max_cycle_hours:
            violations.append({
                'type': '70_hour_cycle',
                'severity': 'violation',
                'description': f"Trip would use {trip_analysis['cycle_hours_needed']:.1f} hours, exceeding available cycle time"
            })
        
        # Check for warnings
        if current_cycle_hours + trip_analysis['cycle_hours_needed'] > self.max_cycle_hours * 0.9:
            warnings.append({
                'type': '70_hour_cycle',
                'severity': 'warning',
                'description': "Trip will use more than 90% of available cycle hours"
            })
        
        return {
            'compliant': len(violations) == 0,
            'violations': violations,
            'warnings': warnings,
            'trip_analysis': trip_analysis,
            'required_breaks': self._calculate_required_breaks(trip_analysis)
        }
    
    def _analyze_trip_requirements(self, trip_data: Dict, current_cycle_hours: float) -> Dict:
        """Analyze trip requirements for HOS compliance"""
        total_distance = trip_data.get('total_distance', 0)
        estimated_duration = trip_data.get('estimated_duration', 0)
        
        # Estimate driving time (excluding stops)
        driving_hours = total_distance / 60  # Assuming 60 mph average
        
        # Add pickup/dropoff time
        duty_hours = driving_hours + 2  # 1 hour each for pickup and dropoff
        
        # Add fuel stop time
        fuel_stops = len([stop for stop in trip_data.get('stops', []) if stop.get('type') == 'fuel'])
        duty_hours += fuel_stops * 0.5  # 30 minutes per fuel stop
        
        return {
            'total_driving_hours': driving_hours,
            'total_duty_hours': duty_hours,
            'cycle_hours_needed': duty_hours,
            'fuel_stops_count': fuel_stops,
            'estimated_completion_time': datetime.now() + timedelta(hours=duty_hours)
        }
    
    def _calculate_required_breaks(self, trip_analysis: Dict) -> List[Dict]:
        """Calculate required rest breaks for compliance"""
        breaks = []
        
        # 30-minute break after 8 hours
        if trip_analysis['total_driving_hours'] > self.break_required_after_hours:
            breaks.append({
                'type': '30_minute_break',
                'duration_minutes': 30,
                'description': '30-minute break required after 8 hours of driving',
                'required_before_hour': 8
            })
        
        # 10-hour off-duty break
        if trip_analysis['total_duty_hours'] >= self.max_duty_hours_daily:
            breaks.append({
                'type': '10_hour_break',
                'duration_minutes': 600,
                'description': '10-hour off-duty break required',
                'required_after_completion': True
            })
        
        return breaks
    
    def generate_compliant_schedule(self, trip_data: Dict, current_cycle_hours: float) -> Dict:
        """Generate a HOS-compliant schedule for the trip"""
        compliance_check = self.check_compliance(trip_data, current_cycle_hours)
        
        if compliance_check['compliant']:
            return {
                'schedule': trip_data,
                'modifications': []
            }
        
        # If not compliant, suggest modifications
        modifications = []
        modified_schedule = dict(trip_data)
        
        # Add required breaks
        for violation in compliance_check['violations']:
            if violation['type'] == '11_hour_driving':
                modifications.append("Split driving time with mandatory 10-hour break")
                # Implementation would add break stops to the schedule
            elif violation['type'] == '14_hour_duty':
                modifications.append("Extend trip over multiple days")
            elif violation['type'] == '70_hour_cycle':
                modifications.append("Wait for cycle reset or take 34-hour restart")
        
        return {
            'schedule': modified_schedule,
            'modifications': modifications,
            'compliance_issues': compliance_check
        }
