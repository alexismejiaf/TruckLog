import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  LocalShipping,
  Dashboard,
  Route,
  Assignment,
  AccountCircle,
} from '@mui/icons-material';

const Navbar: React.FC = () => {
  const location = useLocation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 0 }}>
          <LocalShipping sx={{ mr: 1, fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mr: 4 }}>
            TruckLog Pro
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexGrow: 1, gap: 2 }}>
          <Button
            color="inherit"
            component={Link}
            to="/"
            startIcon={<Dashboard />}
            sx={{
              backgroundColor: isActive('/') ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderRadius: 2,
              px: 2,
            }}
          >
            Dashboard
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/plan-trip"
            startIcon={<Route />}
            sx={{
              backgroundColor: isActive('/plan-trip') ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderRadius: 2,
              px: 2,
            }}
          >
            Plan Trip
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/eld-logs"
            startIcon={<Assignment />}
            sx={{
              backgroundColor: isActive('/eld-logs') ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderRadius: 2,
              px: 2,
            }}
          >
            ELD Logs
          </Button>
        </Box>

        <Box>
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            <AccountCircle />
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem onClick={handleClose}>Profile</MenuItem>
            <MenuItem onClick={handleClose}>Settings</MenuItem>
            <MenuItem onClick={handleClose}>Logout</MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
