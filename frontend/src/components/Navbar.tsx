import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// Custom icons using SVG
const TruckIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2 2H6a2 2 0 01-2-2v0a2 2 0 01-2-2V9a2 2 0 012-2h2z" />
  </svg>
);

const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const RouteIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const Navbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="modern-navbar">
      <div className="modern-navbar-content">
        <div className="modern-navbar-inner">
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ color: '#2563eb' }}>
              <TruckIcon />
            </div>
            <h1 style={{ 
              marginLeft: '0.75rem', 
              fontSize: '1.25rem', 
              fontWeight: 'bold', 
              color: '#111827' 
            }}>
              TruckLog Pro
            </h1>
          </div>

          {/* Navigation Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Link
              to="/"
              className={`modern-nav-link ${isActive('/') ? 'active' : ''}`}
            >
              <DashboardIcon />
              <span style={{ marginLeft: '0.5rem' }}>Dashboard</span>
            </Link>
            
            <Link
              to="/plan-trip"
              className={`modern-nav-link ${isActive('/plan-trip') ? 'active' : ''}`}
            >
              <RouteIcon />
              <span style={{ marginLeft: '0.5rem' }}>Plan Trip</span>
            </Link>
            
            <Link
              to="/eld-logs"
              className={`modern-nav-link ${isActive('/eld-logs') ? 'active' : ''}`}
            >
              <ClipboardIcon />
              <span style={{ marginLeft: '0.5rem' }}>ELD Logs</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
