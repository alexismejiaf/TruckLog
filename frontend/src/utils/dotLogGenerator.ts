import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface ELDLog {
  id: number;
  trip: number;
  driver_name: string;
  log_date: string;
  duty_status: string;
  location: string;
  odometer_reading: number;
  hours_driven_today: number;
  hours_on_duty_today: number;
}

interface DailyLogData {
  date: string;
  driver_name: string;
  co_driver?: string;
  truck_number?: string;
  trailer_number?: string;
  odometer_start: number;
  odometer_end: number;
  total_miles: number;
  logs: ELDLog[];
}

export const generateDOTDailyLogSheet = (data: DailyLogData): void => {
  const pdf = new jsPDF();
  
  // Page setup
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Header
  pdf.setFontSize(18);
  pdf.text('DRIVER\'S DAILY LOG', pageWidth / 2, 20, { align: 'center' });
  
  pdf.setFontSize(10);
  pdf.text('(As required by DOT Section 395.8)', pageWidth / 2, 28, { align: 'center' });
  
  // Driver information section
  pdf.setFontSize(12);
  pdf.text('DRIVER INFORMATION', 20, 45);
  
  pdf.setFontSize(10);
  // Left column
  pdf.text(`Date: ${data.date}`, 20, 55);
  pdf.text(`Driver: ${data.driver_name}`, 20, 65);
  pdf.text(`Co-Driver: ${data.co_driver || 'N/A'}`, 20, 75);
  pdf.text(`Home Terminal: Brooklyn, NY`, 20, 85);
  
  // Right column
  pdf.text(`Truck #: ${data.truck_number || 'T-1247'}`, 120, 55);
  pdf.text(`Trailer #: ${data.trailer_number || 'TR-8901'}`, 120, 65);
  pdf.text(`Odometer Begin: ${data.odometer_start.toLocaleString()}`, 120, 75);
  pdf.text(`Odometer End: ${data.odometer_end.toLocaleString()}`, 120, 85);
  pdf.text(`Total Miles: ${data.total_miles.toLocaleString()}`, 120, 95);
  
  // Duty status legend
  pdf.setFontSize(12);
  pdf.text('DUTY STATUS', 20, 110);
  
  pdf.setFontSize(9);
  const dutyStatuses = [
    '1. Off Duty (including sleeper berth time)',
    '2. Sleeper Berth',
    '3. Driving',
    '4. On-Duty Not Driving'
  ];
  
  dutyStatuses.forEach((status, index) => {
    pdf.text(status, 20, 120 + (index * 8));
  });
  
  // Time grid setup
  const gridStartY = 155;
  const gridHeight = 40;
  const gridStartX = 20;
  const gridWidth = 168; // 24 hours * 7 pixels per hour
  
  pdf.setFontSize(10);
  pdf.text('24-HOUR PERIOD (MIDNIGHT TO MIDNIGHT)', gridStartX, gridStartY - 5);
  
  // Draw time grid
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.2);
  
  // Vertical lines for hours
  for (let hour = 0; hour <= 24; hour++) {
    const x = gridStartX + (hour * 7);
    pdf.line(x, gridStartY, x, gridStartY + gridHeight);
    
    // Hour labels (every 2 hours)
    if (hour % 2 === 0) {
      pdf.setFontSize(8);
      pdf.text(hour.toString().padStart(2, '0'), x - 3, gridStartY + gridHeight + 8);
    }
  }
  
  // Horizontal lines for duty status rows
  const rowHeight = gridHeight / 4;
  for (let i = 0; i <= 4; i++) {
    const y = gridStartY + (i * rowHeight);
    pdf.line(gridStartX, y, gridStartX + gridWidth, y);
    
    // Row labels
    if (i < 4) {
      pdf.setFontSize(8);
      pdf.text((i + 1).toString(), gridStartX - 8, y + rowHeight / 2 + 2);
    }
  }
  
  // Fill in duty status bars based on logs
  data.logs.forEach((log) => {
    const logTime = new Date(log.log_date);
    const hour = logTime.getHours() + (logTime.getMinutes() / 60);
    const x = gridStartX + (hour * 7);
    
    let rowIndex = 0;
    switch (log.duty_status) {
      case 'off_duty':
        rowIndex = 0;
        pdf.setFillColor(200, 200, 200); // Light gray
        break;
      case 'sleeper':
        rowIndex = 1;
        pdf.setFillColor(150, 150, 255); // Light blue
        break;
      case 'driving':
        rowIndex = 2;
        pdf.setFillColor(255, 150, 150); // Light red
        break;
      case 'on_duty':
        rowIndex = 3;
        pdf.setFillColor(255, 255, 150); // Light yellow
        break;
    }
    
    const y = gridStartY + (rowIndex * rowHeight);
    // Draw a small rectangle for this time period (assume 30-minute blocks)
    pdf.rect(x, y + 1, 3.5, rowHeight - 2, 'F');
  });
  
  // Location and remarks section
  const remarksY = gridStartY + gridHeight + 25;
  
  pdf.setFontSize(10);
  pdf.text('LOCATION WHERE WORK BEGAN:', 20, remarksY);
  pdf.text('Brooklyn, NY - Logistics Center', 20, remarksY + 10);
  
  pdf.text('LOCATION WHERE WORK ENDED:', 20, remarksY + 25);
  const lastLog = data.logs[data.logs.length - 1];
  pdf.text(lastLog?.location || 'Harrisburg, PA - Rest Stop', 20, remarksY + 35);
  
  // Shipping documents
  pdf.text('SHIPPING DOCUMENTS:', 120, remarksY);
  pdf.text('Bill of Lading: BL-2025-001247', 120, remarksY + 10);
  pdf.text('Manifest: MF-2025-001247', 120, remarksY + 20);
  
  // Remarks
  pdf.text('REMARKS:', 20, remarksY + 55);
  pdf.text('Regular interstate delivery. No incidents or violations.', 20, remarksY + 65);
  pdf.text('Vehicle inspection completed. All systems operational.', 20, remarksY + 75);
  
  // Driver certification
  pdf.setFontSize(9);
  pdf.text('DRIVER CERTIFICATION:', 20, remarksY + 95);
  pdf.text('I hereby certify that my data entries are true and correct.', 20, remarksY + 105);
  
  // Signature line
  pdf.line(20, remarksY + 120, 100, remarksY + 120);
  pdf.text('Driver Signature', 20, remarksY + 130);
  
  pdf.line(120, remarksY + 120, 180, remarksY + 120);
  pdf.text('Date', 120, remarksY + 130);
  
  // Save the PDF
  const fileName = `daily_log_${data.driver_name.replace(' ', '_')}_${format(new Date(data.date), 'yyyy_MM_dd')}.pdf`;
  pdf.save(fileName);
};

// Helper function to create sample daily log data
export const createSampleDailyLog = (): DailyLogData => {
  return {
    date: format(new Date(), 'MM/dd/yyyy'),
    driver_name: 'John Smith',
    co_driver: '',
    truck_number: 'T-1247',
    trailer_number: 'TR-8901',
    odometer_start: 125420,
    odometer_end: 125720,
    total_miles: 300,
    logs: [
      {
        id: 1,
        trip: 1,
        driver_name: 'John Smith',
        log_date: '2025-09-10T06:00:00Z',
        duty_status: 'on_duty',
        location: 'Brooklyn, NY',
        odometer_reading: 125420,
        hours_driven_today: 0,
        hours_on_duty_today: 0
      },
      {
        id: 2,
        trip: 1,
        driver_name: 'John Smith',
        log_date: '2025-09-10T08:30:00Z',
        duty_status: 'driving',
        location: 'New Jersey Turnpike',
        odometer_reading: 125450,
        hours_driven_today: 0.5,
        hours_on_duty_today: 2.5
      },
      {
        id: 3,
        trip: 1,
        driver_name: 'John Smith',
        log_date: '2025-09-10T14:30:00Z',
        duty_status: 'off_duty',
        location: 'Harrisburg, PA - Rest Area',
        odometer_reading: 125720,
        hours_driven_today: 6.0,
        hours_on_duty_today: 8.5
      }
    ]
  };
};
