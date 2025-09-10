import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Assignment,
  Download,
  Visibility,
  Close,
} from '@mui/icons-material';
import { apiService } from '../services/api';
import jsPDF from 'jspdf';

interface LogEntry {
  id: number;
  date: string;
  driver_name: string;
  start_time: string;
  end_time: string;
  duty_status: string;
  location: string;
  hours: number;
  odometer_start?: number | null;
  odometer_end?: number | null;
  remarks?: string;
}

const ELDLogs: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [driverSelectionOpen, setDriverSelectionOpen] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [tripId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch real ELD logs from the API, filtered by trip ID if available
      const filters = tripId ? { trip_id: parseInt(tripId) } : undefined;
      const realLogs = await apiService.getELDLogs(filters);
      
      // Transform API data to match our interface
      const transformedLogs: LogEntry[] = realLogs.map(log => ({
        id: log.id,
        date: log.date,
        driver_name: log.driver_name,
        start_time: log.start_time,
        end_time: log.end_time,
        duty_status: log.duty_status,
        location: log.location,
        hours: log.hours,
        odometer_start: log.odometer_start || undefined,
        odometer_end: log.odometer_end || undefined,
        remarks: log.remarks || ''
      }));

      setLogs(transformedLogs);
      
      // Extract unique driver names for driver selection
      const uniqueDrivers = Array.from(new Set(transformedLogs.map(log => log.driver_name)));
      setAvailableDrivers(uniqueDrivers);
    } catch (err) {
      setError('Failed to load ELD logs. Please try again.');
      console.error('Error loading ELD logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get duty status display info
  const getLogDisplayInfo = (log: LogEntry) => {
    const statusDisplay = {
      'off_duty': { label: 'OFF DUTY', color: 'success' as const },
      'sleeper': { label: 'SLEEPER BERTH', color: 'info' as const },
      'driving': { label: 'DRIVING', color: 'warning' as const },
      'on_duty': { label: 'ON DUTY', color: 'primary' as const }
    };
    
    return statusDisplay[log.duty_status as keyof typeof statusDisplay] || 
           { label: log.duty_status.toUpperCase(), color: 'default' as const };
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleViewLog = (log: LogEntry) => {
    setSelectedLog(log);
    setViewDialogOpen(true);
  };

  const handleDownloadLog = async (logId: number) => {
    try {
      const log = logs.find(l => l.id === logId);
      if (!log) return;
      
      // Create a simple text-based daily log for the specific ELD entry
      const content = `
Electronic Logging Device (ELD) Record
======================================

DRIVER INFORMATION:
Name: ${log.driver_name}
Date: ${log.date}

DUTY STATUS RECORD:
Time: ${log.start_time} - ${log.end_time}
Status: ${getLogDisplayInfo(log).label}
Location: ${log.location}
Hours: ${log.hours.toFixed(1)}
${log.odometer_start ? `Odometer: ${log.odometer_start} - ${log.odometer_end} miles` : ''}

${log.remarks ? `REMARKS:\n${log.remarks}` : ''}

Generated on: ${new Date().toLocaleString()}
DOT Compliance Record
      `.trim();

      // Create and download the file
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `eld-log-${log.driver_name.replace(/\s+/g, '-')}-${log.date}-${log.id}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading log:', error);
    }
  };

  const handleExportLogs = () => {
    // Export all logs as a combined file
    const content = logs.map(log => `
${log.date} ${log.start_time}-${log.end_time} | ${log.driver_name} | ${getLogDisplayInfo(log).label} | ${log.location} | ${log.hours}h
    `).join('');
    
    const fullContent = `ELD Logs Export\n==============\n${content}\nExported: ${new Date().toLocaleString()}`;
    
    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eld-logs-export-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateDailyLogSheet = () => {
    if (availableDrivers.length === 0) {
      alert('No drivers found in ELD logs.');
      return;
    }
    
    if (availableDrivers.length === 1) {
      // If only one driver, generate directly
      generateDailyLogSheetForDriver(availableDrivers[0]);
    } else {
      // Show driver selection dialog
      setDriverSelectionOpen(true);
    }
  };

  const generateDailyLogSheetForDriver = (selectedDriver: string) => {
    try {
      // Filter logs by selected driver only
      const driverLogs = logs.filter(log => log.driver_name === selectedDriver);
      
      if (driverLogs.length === 0) {
        alert(`No ELD logs found for driver ${selectedDriver}.`);
        return;
      }
      
      // Get the most recent date from driver's logs or use today
      const targetDate = driverLogs.length > 0 ? driverLogs[0].date : new Date().toISOString().split('T')[0];
      
      // Filter logs for the target date and selected driver
      const dailyLogs = driverLogs.filter(log => log.date === targetDate && log.driver_name === selectedDriver);
      
      if (dailyLogs.length === 0) {
        alert(`No ELD logs found for driver ${selectedDriver} on ${targetDate}.`);
        return;
      }

      // Create PDF in landscape orientation
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('DRIVER\'S DAILY LOG - DOT Section 395.8', pageWidth/2, 25, { align: 'center' });
      
      // Header Information - properly spaced for landscape layout
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Top row of header info
      doc.text(`DATE: ${targetDate}`, 30, 45);
      doc.text(`DRIVER: ${selectedDriver}`, 30, 58);
      doc.text(`CO-DRIVER: N/A`, 30, 71);
      
      // Center column
      doc.text(`TRUCK #: T-1247`, 300, 45);
      doc.text(`TRAILER #: TR-8901`, 300, 58);
      
      // Right column
      doc.text(`DOT COMPLIANCE LOG`, pageWidth - 200, 45);
      doc.text(`24-Hour Duty Period`, pageWidth - 200, 58);
      
      // Draw a line to separate header from content
      doc.setLineWidth(0.5);
      doc.line(30, 80, pageWidth - 30, 80);
      
      // Calculate totals from ELD data
      let totalDriving = 0;
      let totalOnDuty = 0;
      let totalOffDuty = 0;
      let totalSleeper = 0;
      
      dailyLogs.forEach(log => {
        switch(log.duty_status) {
          case 'driving':
            totalDriving += log.hours;
            totalOnDuty += log.hours;
            break;
          case 'on_duty':
            totalOnDuty += log.hours;
            break;
          case 'off_duty':
            totalOffDuty += log.hours;
            break;
          case 'sleeper':
            totalSleeper += log.hours;
            break;
        }
      });
      
      // Duty Status Record Table - better formatted
      let yPos = 95;
      doc.setFont('helvetica', 'bold');
      doc.text('DUTY STATUS RECORD:', 30, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 15;
      
      // Table headers with better spacing
      doc.setFont('helvetica', 'bold');
      doc.text('Time', 30, yPos);
      doc.text('Status', 120, yPos);
      doc.text('Location', 280, yPos);
      doc.text('Hours', 500, yPos);
      
      // Draw line under headers
      doc.setLineWidth(0.5);
      doc.line(30, yPos + 5, 550, yPos + 5);
      yPos += 15;
      
      // Add each log entry with proper spacing
      doc.setFont('helvetica', 'normal');
      dailyLogs.forEach(log => {
        const statusLabel = getLogDisplayInfo(log).label;
        doc.text(`${log.start_time} - ${log.end_time}`, 30, yPos);
        doc.text(statusLabel, 120, yPos);
        doc.text(log.location.substring(0, 35), 280, yPos); // Allow more space for location
        doc.text(log.hours.toFixed(1), 500, yPos);
        yPos += 12;
      });
      
      // Duty Status Grid (Visual representation) - properly formatted for landscape
      yPos += 20;
      doc.setFont('helvetica', 'bold');
      doc.text('DUTY STATUS GRID (24-Hour Period):', 30, yPos);
      yPos += 15;
      
      // Grid configuration - optimized for landscape
      const gridStartX = 30;
      const gridStartY = yPos;
      const labelWidth = 180; // More space for labels
      const gridWidth = 550; // Wider grid for better hour spacing
      const gridHeight = 80; // Taller for better line visibility
      const hourWidth = gridWidth / 24;
      
      // Grid row labels with proper spacing
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Line 1 - Off Duty', gridStartX, gridStartY + 15);
      doc.text('Line 2 - Sleeper Berth', gridStartX, gridStartY + 35);
      doc.text('Line 3 - Driving', gridStartX, gridStartY + 55);
      doc.text('Line 4 - On-Duty (Not Driving)', gridStartX, gridStartY + 75);
      
      // Draw vertical grid lines (hour markers)
      doc.setLineWidth(0.3);
      doc.setDrawColor(150, 150, 150); // Light gray for grid
      for (let i = 0; i <= 24; i++) {
        const x = gridStartX + labelWidth + (i * hourWidth);
        doc.line(x, gridStartY, x, gridStartY + gridHeight);
        
        // Hour labels at bottom
        if (i % 2 === 0) { // Show every 2 hours
          doc.setFontSize(8);
          doc.text(i.toString().padStart(2, '0'), x - 5, gridStartY + gridHeight + 15);
        }
      }
      
      // Draw horizontal grid lines (duty status lines)
      doc.setDrawColor(0, 0, 0); // Black for main lines
      doc.setLineWidth(0.5);
      for (let i = 0; i <= 4; i++) {
        const y = gridStartY + (i * 20); // 20pt spacing between lines
        doc.line(gridStartX + labelWidth, y, gridStartX + labelWidth + gridWidth, y);
      }
      
      // Add legend for line colors - positioned on the right side
      doc.setFontSize(8);
      const legendX = gridStartX + labelWidth + gridWidth + 20;
      
      // Legend with color samples
      doc.setDrawColor(0, 0, 255); // Blue
      doc.setLineWidth(3);
      doc.line(legendX, gridStartY + 10, legendX + 20, gridStartY + 10);
      doc.setDrawColor(0, 0, 0);
      doc.text('Blue: Off Duty', legendX + 25, gridStartY + 13);
      
      doc.setDrawColor(128, 0, 128); // Purple
      doc.setLineWidth(3);
      doc.line(legendX, gridStartY + 25, legendX + 20, gridStartY + 25);
      doc.setDrawColor(0, 0, 0);
      doc.text('Purple: Sleeper', legendX + 25, gridStartY + 28);
      
      doc.setDrawColor(255, 0, 0); // Red
      doc.setLineWidth(3);
      doc.line(legendX, gridStartY + 40, legendX + 20, gridStartY + 40);
      doc.setDrawColor(0, 0, 0);
      doc.text('Red: Driving', legendX + 25, gridStartY + 43);
      
      doc.setDrawColor(0, 128, 0); // Green
      doc.setLineWidth(3);
      doc.line(legendX, gridStartY + 55, legendX + 20, gridStartY + 55);
      doc.setDrawColor(0, 0, 0);
      doc.text('Green: On-Duty', legendX + 25, gridStartY + 58);
      
      // Reset font size
      doc.setFontSize(10);
      
      // Draw duty status lines based on actual log entries
      dailyLogs.forEach(log => {
        const startHour = parseInt(log.start_time.split(':')[0]);
        const endHour = parseInt(log.end_time.split(':')[0]);
        const startMinute = parseInt(log.start_time.split(':')[1]);
        const endMinute = parseInt(log.end_time.split(':')[1]);
        
        // Calculate precise positions on the grid
        const startX = gridStartX + labelWidth + (startHour + startMinute/60) * hourWidth;
        const endX = gridStartX + labelWidth + (endHour + endMinute/60) * hourWidth;
        
        // Determine which line to draw on based on duty status
        let lineY = gridStartY;
        let lineColor = [0, 0, 0]; // Default black
        
        switch(log.duty_status) {
          case 'off_duty':
            lineY = gridStartY + 10; // Line 1 - Off Duty
            lineColor = [0, 0, 255]; // Blue
            break;
          case 'sleeper':
            lineY = gridStartY + 30; // Line 2 - Sleeper Berth
            lineColor = [128, 0, 128]; // Purple
            break;
          case 'driving':
            lineY = gridStartY + 50; // Line 3 - Driving
            lineColor = [255, 0, 0]; // Red
            break;
          case 'on_duty':
            lineY = gridStartY + 70; // Line 4 - On-Duty (Not Driving)
            lineColor = [0, 128, 0]; // Green
            break;
        }
        
        // Set line color and thickness
        doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
        doc.setLineWidth(4); // Thicker lines for better visibility
        
        // Draw the duty status line
        doc.line(startX, lineY, endX, lineY);
        
        // Reset to default black for other drawing
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
      });
      
      // Summary totals - better positioned and formatted
      yPos = gridStartY + gridHeight + 30;
      doc.setFont('helvetica', 'bold');
      doc.text('TOTALS FOR 24-HOUR PERIOD:', 30, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 12;
      
      // Two column layout for totals
      doc.text(`Line 1 - Off Duty: ${totalOffDuty.toFixed(1)} hours`, 30, yPos);
      doc.text(`Line 3 - Driving: ${totalDriving.toFixed(1)} hours`, 300, yPos);
      yPos += 12;
      doc.text(`Line 2 - Sleeper Berth: ${totalSleeper.toFixed(1)} hours`, 30, yPos);
      doc.text(`Line 4 - On-Duty (Not Driving): ${(totalOnDuty - totalDriving).toFixed(1)} hours`, 300, yPos);
      yPos += 15;
      
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL DUTY HOURS: ${totalOnDuty.toFixed(1)}`, 30, yPos);
      doc.text(`TOTAL DRIVING HOURS: ${totalDriving.toFixed(1)}`, 300, yPos);
      
      // Vehicle Information
      yPos += 20;
      doc.text('VEHICLE INFORMATION:', 30, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 12;
      
      const firstLog = dailyLogs[0];
      const lastLog = dailyLogs[dailyLogs.length - 1];
      
      if (firstLog.odometer_start && lastLog.odometer_end) {
        doc.text(`Starting Odometer: ${firstLog.odometer_start} miles`, 30, yPos);
        doc.text(`Ending Odometer: ${lastLog.odometer_end} miles`, 300, yPos);
        yPos += 12;
        doc.text(`Total Miles: ${lastLog.odometer_end - firstLog.odometer_start} miles`, 30, yPos);
      } else {
        doc.text('Odometer readings not recorded', 30, yPos);
      }
      
      // Compliance check
      yPos += 20;
      doc.setFont('helvetica', 'bold');
      doc.text('HOS COMPLIANCE STATUS:', 30, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 12;
      
      const isCompliant = totalDriving <= 11 && totalOnDuty <= 14;
      const statusText = isCompliant ? 'COMPLIANT' : 'VIOLATION';
      const statusColor = isCompliant ? [0, 128, 0] : [255, 0, 0]; // Green or Red
      
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(`Status: ${statusText}`, 30, yPos);
      doc.setTextColor(0, 0, 0); // Reset to black
      doc.setFont('helvetica', 'normal');
      yPos += 12;
      
      const complianceMessage = isCompliant 
        ? 'All driving and duty time within DOT regulations.' 
        : 'ATTENTION: HOS violation detected.';
      doc.text(complianceMessage, 30, yPos);
      
      // Certification section
      yPos += 20;
      doc.setFont('helvetica', 'bold');
      doc.text('DRIVER CERTIFICATION:', 30, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 12;
      doc.text('I hereby certify that this log is true and correct, and that my data entries', 30, yPos);
      yPos += 12;
      doc.text('are accurate and complete as required by DOT Section 395.8.', 30, yPos);
      yPos += 20;
      
      // Signature lines
      doc.line(30, yPos, 250, yPos); // Signature line
      doc.line(400, yPos, 550, yPos); // Date line
      yPos += 15;
      doc.text('Driver Signature', 30, yPos);
      doc.text('Date', 400, yPos);
      
      // Footer
      doc.setFontSize(8);
      doc.text(`Generated by: Trucking ELD System v1.0 - ${new Date().toLocaleString()}`, 30, pageHeight - 15);
      
      // Save the PDF
      doc.save(`DOT_Daily_Log_${selectedDriver.replace(/\s+/g, '_')}_${targetDate}.pdf`);
      
    } catch (error) {
      console.error('Error generating daily log sheet:', error);
      alert('Failed to generate daily log sheet. Please try again.');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={loadData}>
          Retry
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Electronic Logging Device (ELD) Records
        </Typography>
        
        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExportLogs}
            disabled={loading || logs.length === 0}
            size="large"
          >
            Export All Logs
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Assignment />}
            onClick={generateDailyLogSheet}
            disabled={loading || logs.length === 0}
            size="large"
            sx={{ 
              px: 3,
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.25)',
              '&:hover': {
                boxShadow: '0 6px 16px rgba(25, 118, 210, 0.35)',
              }
            }}
          >
            Generate Daily Log Sheet
          </Button>
        </Box>
      </Box>

      {/* ELD Logs List */}
      <Typography variant="h6" component="h2" gutterBottom sx={{ mt: 2 }}>
        Daily Log Entries
      </Typography>

      {logs.length === 0 ? (
        <Alert severity="info">
          No ELD logs found. Create a new trip to start logging.
        </Alert>
      ) : (
        <List>
          {logs.map((log) => {
            const statusInfo = getLogDisplayInfo(log);
            return (
              <ListItem key={log.id} sx={{ mb: 1 }}>
                <Card sx={{ width: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" component="div" sx={{ mb: 1 }}>
                          {formatTime(log.start_time)} - {formatTime(log.end_time)} • {statusInfo.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Driver:</strong> {log.driver_name} • <strong>Date:</strong> {log.date}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Location:</strong> {log.location}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Hours:</strong> {log.hours.toFixed(1)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        <Chip 
                          label={statusInfo.label} 
                          color={statusInfo.color}
                          size="small"
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            startIcon={<Visibility />}
                            onClick={() => handleViewLog(log)}
                          >
                            View
                          </Button>
                          <Button
                            size="small"
                            startIcon={<Download />}
                            onClick={() => handleDownloadLog(log.id)}
                          >
                            Download
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </ListItem>
            );
          })}
        </List>
      )}

      {/* View Log Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            ELD Log Details
            <Button onClick={() => setViewDialogOpen(false)}>
              <Close />
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {selectedLog.driver_name}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Date:</strong> {selectedLog.date}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Time:</strong> {formatTime(selectedLog.start_time)} - {formatTime(selectedLog.end_time)}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Duration:</strong> {selectedLog.hours.toFixed(1)} hours
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Location:</strong> {selectedLog.location}
                  </Typography>
                  {selectedLog.odometer_start && selectedLog.odometer_end && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Odometer:</strong> {selectedLog.odometer_start} - {selectedLog.odometer_end} miles
                    </Typography>
                  )}
                </Box>
                <Box>
                  <Chip 
                    label={getLogDisplayInfo(selectedLog).label} 
                    color={getLogDisplayInfo(selectedLog).color}
                  />
                </Box>
              </Box>
              {selectedLog.remarks && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Remarks
                  </Typography>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2">
                      {selectedLog.remarks}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => selectedLog && handleDownloadLog(selectedLog.id)} startIcon={<Download />}>
            Download PDF
          </Button>
          <Button onClick={() => setViewDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Driver Selection Dialog */}
      <Dialog 
        open={driverSelectionOpen} 
        onClose={() => setDriverSelectionOpen(false)}
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Assignment />
            Select Driver for Daily Log Sheet
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Multiple drivers found in ELD logs. Please select which driver's daily log sheet you want to generate:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {availableDrivers.map((driverName) => {
              const driverLogCount = logs.filter(log => log.driver_name === driverName).length;
              return (
                <Button
                  key={driverName}
                  variant="outlined"
                  onClick={() => {
                    setDriverSelectionOpen(false);
                    generateDailyLogSheetForDriver(driverName);
                  }}
                  sx={{ 
                    justifyContent: 'flex-start', 
                    textAlign: 'left',
                    p: 2
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {driverName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {driverLogCount} ELD log{driverLogCount !== 1 ? 's' : ''} available
                    </Typography>
                  </Box>
                </Button>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDriverSelectionOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ELDLogs;
