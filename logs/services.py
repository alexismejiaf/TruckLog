from datetime import datetime, timedelta, time
from typing import List, Dict
# from PIL import Image, ImageDraw, ImageFont  # Temporarily disabled for deployment
# from reportlab.pdfgen import canvas  # Temporarily disabled for deployment
# from reportlab.lib.pagesizes import letter
# from reportlab.lib import colors
# from reportlab.lib.units import inch
import io
import os


class ELDLogGenerator:
    """Service for generating visual ELD log sheets"""
    
    def __init__(self):
        self.log_width = 800
        self.log_height = 600
        self.grid_start_x = 100
        self.grid_start_y = 150
        self.grid_width = 600
        self.grid_height = 300
        self.hours_per_day = 24
        
        # Duty status colors
        self.duty_colors = {
            'off_duty': '#4CAF50',      # Green
            'sleeper': '#2196F3',       # Blue
            'driving': '#FF9800',       # Orange
            'on_duty': '#F44336'        # Red
        }
    
    def generate_daily_log_sheet(self, trip_id: int, driver_name: str, date: datetime.date, 
                                eld_logs: List[Dict], vehicle_info: Dict = None) -> bytes:
        """Generate a daily log sheet image - temporarily disabled for deployment"""
        # Return empty bytes for now
        return b""
        
        # Try to load a font, fall back to default if not available
        try:
            title_font = ImageFont.truetype("arial.ttf", 16)
            header_font = ImageFont.truetype("arial.ttf", 12)
            text_font = ImageFont.truetype("arial.ttf", 10)
        except OSError:
            title_font = ImageFont.load_default()
            header_font = ImageFont.load_default()
            text_font = ImageFont.load_default()
        
        # Draw header
        self._draw_header(draw, title_font, header_font, driver_name, date, vehicle_info)
        
        # Draw grid
        self._draw_grid(draw, text_font)
        
        # Draw duty status legend
        self._draw_legend(draw, text_font)
        
        # Draw log entries
        self._draw_log_entries(draw, eld_logs, date)
        
        # Draw remarks section
        self._draw_remarks(draw, text_font, eld_logs)
        
        # Draw totals
        self._draw_totals(draw, text_font, eld_logs)
        
        # Convert to bytes
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        return img_byte_arr.getvalue()
    
    def _draw_header(self, draw, title_font, header_font, driver_name: str, 
                    date: datetime.date, vehicle_info: Dict):
        """Draw the log sheet header"""
        # Title
        draw.text((self.log_width // 2 - 100, 20), "Driver's Daily Log", 
                 fill='black', font=title_font)
        
        # Date
        draw.text((50, 60), f"Date: {date.strftime('%m/%d/%Y')}", 
                 fill='black', font=header_font)
        
        # Driver name
        draw.text((300, 60), f"Driver: {driver_name}", 
                 fill='black', font=header_font)
        
        # Vehicle info
        if vehicle_info:
            draw.text((500, 60), f"Vehicle: {vehicle_info.get('vehicle_id', 'N/A')}", 
                     fill='black', font=header_font)
        
        # Odometer info
        if vehicle_info:
            draw.text((50, 80), f"Odometer Start: {vehicle_info.get('odometer_start', 'N/A')}", 
                     fill='black', font=header_font)
            draw.text((300, 80), f"Odometer End: {vehicle_info.get('odometer_end', 'N/A')}", 
                     fill='black', font=header_font)
            draw.text((500, 80), f"Total Miles: {vehicle_info.get('total_miles', 'N/A')}", 
                     fill='black', font=header_font)
    
    def _draw_grid(self, draw, text_font):
        """Draw the 24-hour grid"""
        # Draw outer border
        draw.rectangle([self.grid_start_x, self.grid_start_y, 
                       self.grid_start_x + self.grid_width, 
                       self.grid_start_y + self.grid_height], 
                      outline='black', width=2)
        
        # Draw hour lines
        hour_width = self.grid_width / self.hours_per_day
        for i in range(self.hours_per_day + 1):
            x = self.grid_start_x + (i * hour_width)
            draw.line([x, self.grid_start_y, x, self.grid_start_y + self.grid_height], 
                     fill='gray', width=1)
            
            # Draw hour labels
            if i < self.hours_per_day:
                hour_label = f"{i:02d}"
                draw.text((x + 5, self.grid_start_y - 20), hour_label, 
                         fill='black', font=text_font)
        
        # Draw duty status rows
        duty_statuses = ['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty (Not Driving)']
        row_height = self.grid_height / len(duty_statuses)
        
        for i, status in enumerate(duty_statuses):
            y = self.grid_start_y + (i * row_height)
            
            # Draw horizontal line
            draw.line([self.grid_start_x, y, self.grid_start_x + self.grid_width, y], 
                     fill='gray', width=1)
            
            # Draw status label
            draw.text((10, y + row_height//2 - 5), status, 
                     fill='black', font=text_font)
    
    def _draw_legend(self, draw, text_font):
        """Draw the duty status color legend"""
        legend_y = self.grid_start_y + self.grid_height + 20
        legend_items = [
            ('Off Duty', self.duty_colors['off_duty']),
            ('Sleeper Berth', self.duty_colors['sleeper']),
            ('Driving', self.duty_colors['driving']),
            ('On Duty', self.duty_colors['on_duty'])
        ]
        
        for i, (label, color) in enumerate(legend_items):
            x = 50 + (i * 150)
            # Draw color box
            draw.rectangle([x, legend_y, x + 20, legend_y + 15], 
                          fill=color, outline='black')
            # Draw label
            draw.text((x + 25, legend_y + 2), label, fill='black', font=text_font)
    
    def _draw_log_entries(self, draw, eld_logs: List[Dict], date: datetime.date):
        """Draw the actual log entries on the grid"""
        duty_statuses = ['off_duty', 'sleeper', 'driving', 'on_duty']
        row_height = self.grid_height / len(duty_statuses)
        hour_width = self.grid_width / self.hours_per_day
        
        for log_entry in eld_logs:
            if log_entry['date'] != date:
                continue
                
            duty_status = log_entry['duty_status']
            start_time = log_entry['start_time']
            end_time = log_entry['end_time']
            
            # Calculate positions
            start_hour = start_time.hour + start_time.minute / 60
            end_hour = end_time.hour + end_time.minute / 60
            
            # Handle overnight entries
            if end_hour < start_hour:
                end_hour += 24
            
            row_index = duty_statuses.index(duty_status)
            y = self.grid_start_y + (row_index * row_height) + 2
            
            x_start = self.grid_start_x + (start_hour * hour_width)
            x_end = self.grid_start_x + (end_hour * hour_width)
            
            # Draw duty status bar
            color = self.duty_colors.get(duty_status, '#CCCCCC')
            draw.rectangle([x_start, y, x_end, y + row_height - 4], 
                          fill=color, outline='black', width=1)
    
    def _draw_remarks(self, draw, text_font, eld_logs: List[Dict]):
        """Draw the remarks section"""
        remarks_y = self.grid_start_y + self.grid_height + 60
        draw.text((50, remarks_y), "Remarks:", fill='black', font=text_font)
        
        # Collect all remarks
        all_remarks = []
        for log_entry in eld_logs:
            if log_entry.get('remarks'):
                time_str = log_entry['start_time'].strftime('%H:%M')
                all_remarks.append(f"{time_str}: {log_entry['remarks']}")
        
        # Draw remarks
        for i, remark in enumerate(all_remarks[:5]):  # Limit to 5 remarks
            draw.text((50, remarks_y + 20 + (i * 15)), remark, 
                     fill='black', font=text_font)
    
    def _draw_totals(self, draw, text_font, eld_logs: List[Dict]):
        """Draw the daily totals section"""
        totals_y = self.log_height - 80
        
        # Calculate totals
        totals = self._calculate_daily_totals(eld_logs)
        
        draw.text((50, totals_y), f"Total Driving: {totals['driving']:.1f} hrs", 
                 fill='black', font=text_font)
        draw.text((200, totals_y), f"Total On Duty: {totals['on_duty']:.1f} hrs", 
                 fill='black', font=text_font)
        draw.text((350, totals_y), f"Total Off Duty: {totals['off_duty']:.1f} hrs", 
                 fill='black', font=text_font)
        draw.text((500, totals_y), f"Sleeper Berth: {totals['sleeper']:.1f} hrs", 
                 fill='black', font=text_font)
    
    def _calculate_daily_totals(self, eld_logs: List[Dict]) -> Dict[str, float]:
        """Calculate daily totals for each duty status"""
        totals = {'driving': 0, 'on_duty': 0, 'off_duty': 0, 'sleeper': 0}
        
        for log_entry in eld_logs:
            duty_status = log_entry['duty_status']
            hours = log_entry['hours']
            
            if duty_status in totals:
                totals[duty_status] += hours
        
        return totals
    
    def generate_trip_summary_pdf(self, trip_data: Dict, daily_logs: List[Dict]) -> bytes:
        """Generate a PDF summary of the entire trip - temporarily disabled for deployment"""
        # Return empty bytes for now
        return b""
    
    def generate_daily_log_pdf(self, driver_name: str, date: str, log_entries: List[Dict]) -> bytes:
        """Generate PDF for daily log - temporarily disabled for deployment"""
        # Return empty bytes for now
        return b""
        
        trip_details = [
            f"Driver: {trip_data.get('driver_name', 'N/A')}",
            f"Total Distance: {trip_data.get('total_distance', 0):.1f} miles",
            f"Trip Duration: {trip_data.get('estimated_duration', 0):.1f} hours",
            f"Status: {trip_data.get('status', 'N/A')}",
        ]
        
        for detail in trip_details:
            p.drawString(50, y_position, detail)
            y_position -= 20
        
        # Daily log summaries
        y_position -= 30
        p.setFont("Helvetica-Bold", 14)
        p.drawString(50, y_position, "Daily Log Summary")
        y_position -= 30
        
        p.setFont("Helvetica", 10)
        headers = ["Date", "Driving", "On Duty", "Off Duty", "Sleeper"]
        for i, header in enumerate(headers):
            p.drawString(50 + (i * 100), y_position, header)
        y_position -= 20
        
        for daily_log in daily_logs:
            row_data = [
                daily_log['date'].strftime('%m/%d/%Y'),
                f"{daily_log.get('total_driving_hours', 0):.1f}",
                f"{daily_log.get('total_on_duty_hours', 0):.1f}",
                f"{daily_log.get('total_off_duty_hours', 0):.1f}",
                f"{daily_log.get('total_sleeper_hours', 0):.1f}"
            ]
            
            for i, data in enumerate(row_data):
                p.drawString(50 + (i * 100), y_position, data)
            y_position -= 15
        
        p.showPage()
        p.save()
        buffer.seek(0)
        return buffer.getvalue()
    
    def generate_hos_compliance_report(self, trip_data: Dict, violations: List[Dict]) -> bytes:
        """Generate HOS compliance report - temporarily disabled for deployment"""
        # Return empty bytes for now
        return b""
