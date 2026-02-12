import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import Wishlist from '../pages/Wishlist.jsx';

// Standalone theme for running this remote by itself.
// Reason: the shell owns the real theme; this avoids a blank page in isolated runs.
const theme = createTheme();

export default function StandaloneApp() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh' }}>
        <Router>
          <Routes>
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/" element={<Navigate to="/wishlist" replace />} />
          </Routes>
        </Router>
      </Box>
    </ThemeProvider>
  );
}

