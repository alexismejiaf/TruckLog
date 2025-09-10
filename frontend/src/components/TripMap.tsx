import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RouteStop {
  id: number;
  address: string;
  latitude: number;
  longitude: number;
  stop_type: string;
  stop_order: number;
}

interface TripMapProps {
  route_stops: RouteStop[];
  currentPosition?: { latitude: number; longitude: number };
}

const TripMap: React.FC<TripMapProps> = ({ route_stops, currentPosition }) => {
  // Calculate route path coordinates
  const routeCoordinates: [number, number][] = route_stops
    .sort((a, b) => a.stop_order - b.stop_order)
    .map(stop => [stop.latitude, stop.longitude]);

  // Center map on the middle of the route
  const centerLat = route_stops.reduce((sum, stop) => sum + stop.latitude, 0) / route_stops.length;
  const centerLng = route_stops.reduce((sum, stop) => sum + stop.longitude, 0) / route_stops.length;

  // Custom icons for different stop types
  const getStopIcon = (stopType: string) => {
    const color = 
      stopType === 'Start' ? 'green' :
      stopType === 'Fuel' ? 'orange' :
      stopType === 'Rest' ? 'blue' :
      stopType === 'Dropoff' ? 'red' : 'gray';

    return new L.Icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  };

  // Current location icon
  const currentLocationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <div style={{ height: '400px', width: '100%' }}>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Route line */}
        <Polyline
          positions={routeCoordinates}
          pathOptions={{ color: 'blue', weight: 4, opacity: 0.7 }}
        />
        
        {/* Route stops */}
        {route_stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.latitude, stop.longitude]}
            icon={getStopIcon(stop.stop_type)}
          >
            <Popup>
              <div>
                <strong>{stop.address}</strong><br />
                <em>{stop.stop_type}</em><br />
                Stop #{stop.stop_order}
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Current position */}
        {currentPosition && (
          <Marker
            position={[currentPosition.latitude, currentPosition.longitude]}
            icon={currentLocationIcon}
          >
            <Popup>
              <div>
                <strong>Current Location</strong><br />
                Live GPS Position
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default TripMap;
