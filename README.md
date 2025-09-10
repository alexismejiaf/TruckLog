# TruckLog Pro - ELD & Route Planning Application

A comprehensive Django and React application for trucking companies to manage Electronic Logging Device (ELD) compliance, route planning, and Hours of Service (HOS) tracking.

## Features

### Core Functionality
- **Trip Planning**: Input current location, pickup, and dropoff locations
- **Route Optimization**: Automatic fuel stops every 1,000 miles
- **HOS Compliance**: 70-hour/8-day cycle monitoring and violation detection
- **ELD Log Generation**: Visual daily log sheets with duty status tracking
- **Real-time Monitoring**: Dashboard with trip status and compliance overview

### Technical Features
- **Modern UI**: Material-UI components with professional trucking theme
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **RESTful API**: Django REST Framework backend
- **TypeScript**: Type-safe React frontend
- **Database**: SQLite for development, easily configurable for production

## Architecture

### Backend (Django)
```
trucking_eld/          # Main Django project
├── routes/            # Trip and route management
├── logs/              # ELD logging and HOS compliance
├── api/               # REST API endpoints
└── trucking_eld/      # Project settings
```

### Frontend (React + TypeScript)
```
frontend/src/
├── components/        # Reusable UI components
├── pages/            # Main application pages
├── services/         # API integration
└── App.tsx           # Main application component
```

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. **Navigate to project directory**
   ```bash
   cd Assestment-Django-React
   ```

2. **Activate virtual environment**
   ```bash
   # Windows
   .venv/Scripts/activate
   
   # macOS/Linux
   source .venv/bin/activate
   ```

3. **Install dependencies** (already installed)
   ```bash
   pip install django djangorestframework django-cors-headers requests python-decouple Pillow reportlab geopy
   ```

4. **Run migrations**
   ```bash
   python manage.py migrate
   ```

5. **Create sample data** (already done)
   ```bash
   python -c "import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trucking_eld.settings'); import django; django.setup(); exec(open('create_sample_data.py').read())"
   ```

6. **Start Django server**
   ```bash
   python manage.py runserver
   ```
   Backend will be available at: http://127.0.0.1:8000

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies** (already installed)
   ```bash
   npm install
   ```

3. **Start React development server**
   ```bash
   npm start
   ```
   Frontend will be available at: http://localhost:3000

## Application Pages

### 1. Dashboard (`/`)
- **Overview**: Active trips, completed trips, HOS violations, available drivers
- **Recent Trips**: List of recent trips with status indicators
- **Quick Actions**: Plan new trip, view ELD logs

### 2. Trip Planner (`/plan-trip`)
- **Step 1**: Enter trip details (driver, locations, current cycle hours)
- **Step 2**: Review calculated route with fuel stops
- **Step 3**: HOS compliance check and violation warnings
- **Result**: Create trip with full compliance analysis

### 3. Trip Details (`/trip/:id`)
- **Trip Information**: Complete trip details and status
- **Route Map**: Interactive map with stops and progress
- **ELD Logs**: Associated electronic logs for the trip

### 4. ELD Logs (`/eld-logs`)
- **Log Management**: View, filter, and export daily logs
- **Compliance Status**: Visual indicators for violations
- **Statistics**: Compliance metrics and trends

## API Endpoints

### Drivers
- `GET /api/drivers/` - List all drivers
- `POST /api/drivers/` - Create new driver

### Trips
- `GET /api/trips/` - List all trips
- `POST /api/trips/` - Create new trip with route calculation
- `GET /api/trips/:id/` - Get trip details

### Route Calculation
- `POST /api/calculate-route/` - Calculate route with fuel stops

## HOS Compliance Rules

The application enforces federal Hours of Service regulations:

- **11-Hour Driving Limit**: Maximum 11 hours driving per day
- **14-Hour Duty Limit**: Maximum 14 hours on duty per day
- **70-Hour/8-Day Cycle**: Maximum 70 hours in 8 consecutive days
- **10-Hour Break**: Minimum 10 hours off duty between shifts
- **30-Minute Break**: Required after 8 hours of driving

## Database Models

### Core Models
- **Driver**: Driver information and license details
- **Trip**: Trip details with pickup/dropoff locations
- **RouteStop**: Individual stops along the route
- **ELDLog**: Electronic logging device entries
- **DailyLogSheet**: Generated daily log sheets
- **HOSViolation**: Hours of Service violation records

## UI/UX Design

### Design Principles
- **Professional**: Clean, industry-appropriate styling
- **Intuitive**: Easy navigation for truck drivers and dispatchers
- **Responsive**: Works on all device sizes
- **Accessible**: High contrast and readable fonts

### Color Scheme
- **Primary**: Professional blue (#1976d2)
- **Secondary**: Orange accents (#ff9800)
- **Success**: Green (#4caf50)
- **Warning**: Orange (#ff9800)
- **Error**: Red (#f44336)

## 🔄 Integration Points

### External APIs (Configurable)
- **Google Maps**: Geocoding and mapping services
- **OpenRouteService**: Alternative routing service
- **Weather APIs**: Weather-based route adjustments

### Configuration
Update `.env` file with your API keys:
```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
OPENROUTE_API_KEY=your_openroute_api_key
```

## Production Deployment

### Quick Deploy (Recommended)
- **Frontend**: Deploy to Vercel (React app in `/frontend` directory)
- **Backend**: Deploy to Railway (Django API with PostgreSQL)
- **Configuration**: Use provided environment files (`.env.production`)

### Requirements
- `requirements.txt` - Python dependencies with production packages
- `Procfile` - For Railway/Heroku deployment
- `vercel.json` - Frontend configuration for Vercel
- Production environment variables configured

### Backend (Railway/Heroku)
1. Deploy from GitHub repository
2. Add PostgreSQL database
3. Set environment variables from `.env.production`
4. Run: `python manage.py migrate && python manage.py collectstatic`

### Frontend (Vercel)
1. Import from GitHub, select `/frontend` directory
2. Framework: Create React App
3. Set `REACT_APP_API_BASE_URL` to your backend URL
4. Deploy automatically

### Testing

### Run Django Tests
```bash
python manage.py test
```

### Run React Tests
```bash
cd frontend
npm test
```

## Production Deployment

### Backend
1. Set `DEBUG=False` in settings
2. Configure production database (PostgreSQL recommended)
3. Set up static file serving
4. Configure CORS for production domain
5. Use production WSGI server (Gunicorn, uWSGI)

### Frontend
1. Build production version: `npm run build`
2. Serve static files via web server (Nginx, Apache)
3. Configure API base URL for production

## Development Notes

### Key Technologies
- **Backend**: Django 5.2.6, Django REST Framework
- **Frontend**: React 18, TypeScript, Material-UI 5
- **Database**: SQLite (dev), PostgreSQL (prod)
- **Styling**: Material-UI theme with custom trucking design

### Architecture Decisions
- **Separation of Concerns**: Clear separation between route planning, logging, and API layers
- **RESTful Design**: Standard REST API patterns for frontend-backend communication
- **Component Architecture**: Reusable React components with TypeScript
- **Service Layer**: Dedicated API service for clean data management

## Future Enhancements

1. **Real-time GPS Tracking**: Integration with GPS devices
2. **Mobile App**: React Native mobile application
3. **Advanced Analytics**: Detailed reporting and analytics
4. **Fleet Management**: Multi-company and fleet features
5. **Integration**: ERP and accounting system integration
6. **IoT Sensors**: Vehicle health and cargo monitoring
7. **Machine Learning**: Predictive route optimization

## License

This project is for assessment purposes. All rights reserved.

## Support

For questions or issues regarding this assessment project, please contact the development team.

---

**TruckLog Pro** - Professional ELD and Route Planning Solution
