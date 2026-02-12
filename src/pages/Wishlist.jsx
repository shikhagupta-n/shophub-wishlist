import React, { useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Container,
  Divider,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import { Delete as DeleteIcon, ShoppingCart as CartIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Logical errors (wishlist page).
// Reason: when fail mode is ON, stacktraces should point to this remote/page file.
const LOGICAL_ERRORS = [
  { code: 'LOGIC_001', message: 'Incorrect conditional flow: action allowed when preconditions are not met.' },
  { code: 'LOGIC_002', message: 'Wrong state transition: attempted to update UI state from a stale snapshot.' },
  { code: 'LOGIC_003', message: 'Broken UI rendering logic: computed view model is inconsistent with inputs.' },
  { code: 'LOGIC_004', message: 'Invalid business rule: checkout/wishlist operation violates domain constraints.' },
  { code: 'LOGIC_005', message: 'Routing logic error: navigation target resolved to an unexpected route.' },
];
let logicalErrorCounter = 0;

function isFailModeOn() {
  try {
    return JSON.parse(localStorage.getItem('ecommerce_fail_mode') || 'false') === true;
  } catch {
    return false;
  }
}

function maybeInjectLogicalError(event, routeRemoteHint) {
  if (!isFailModeOn()) return false;
  const target = event?.target;
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-skip-logical-error="true"]')) return false;
  const buttonEl = target.closest('button, [role="button"], a, input[type="button"], input[type="submit"]');
  if (!buttonEl) return false;

  // Block normal flow so only logical errors are produced while fail mode is enabled.
  event.preventDefault();
  event.stopPropagation();

  const chosen = LOGICAL_ERRORS[logicalErrorCounter % LOGICAL_ERRORS.length];
  logicalErrorCounter += 1;
  const buttonText = (buttonEl.getAttribute('aria-label') || buttonEl.textContent || '').trim().slice(0, 80) || 'unknown';

  const err = new Error(`[${routeRemoteHint}] ${chosen.code}: ${chosen.message}`);
  err.name = 'ShophubLogicalError';

  if (window.zipy) {
    window.zipy.logMessage('Logical error injected (fail mode)', { code: chosen.code, routeRemoteHint, buttonText });
    window.zipy.logException(err);
  }

  // eslint-disable-next-line no-console
  console.error(`[${routeRemoteHint}][LogicalError]`, { ...chosen, buttonText });
  return true;
}

/**
 * Wishlist page remote.
 *
 * Contract:
 * - When rendered by the shell, wishlist state is passed in via props (shell owns it).
 * - When rendered standalone, it falls back to an empty list to keep the remote runnable.
 */
export default function Wishlist({
  items = [],
  removeFromWishlist = () => {},
  clearWishlist = () => {},
  addToCart = async () => true,
  showSuccess = () => {},
  showError = () => {},
}) {
  const navigate = useNavigate();

  const isEmpty = useMemo(() => !items || items.length === 0, [items]);

  const handleMoveToCart = async (product) => {
    try {
      await addToCart(product);
      removeFromWishlist(product.id);
      showSuccess('Moved to cart');
    } catch (e) {
      // Reason: shell snackbar handles UX; fallback to console in standalone.
      // eslint-disable-next-line no-console
      console.error('Move to cart failed:', e);
      showError('Failed to move item to cart');
    }
  };

  return (
    <Box
      onClickCapture={(e) => {
        // Reason: generate logical errors from this page when fail mode is enabled.
        maybeInjectLogicalError(e, 'wishlist');
      }}
      sx={{ minHeight: '100vh', background: '#fafafa', py: 5 }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            border: '1px solid rgba(0, 0, 0, 0.06)',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            mb: 4,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                Wishlist
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Save items you love and come back anytime.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/products')}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
              >
                Continue shopping
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  clearWishlist();
                  showSuccess('Wishlist cleared');
                }}
                disabled={isEmpty}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
              >
                Clear
              </Button>
            </Box>
          </Box>
        </Paper>

        {isEmpty ? (
          <Paper
            elevation={0}
            sx={{
              p: 6,
              textAlign: 'center',
              borderRadius: 3,
              border: '1px dashed rgba(0, 0, 0, 0.15)',
              background: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              Your wishlist is empty
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Browse products and tap the heart icon to save them.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/products')}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #1a1a1a 0%, #404040 100%)',
              }}
            >
              Shop now
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {items.map((product) => (
              <Grid key={product.id} item xs={12} md={6}>
                <Card
                  sx={{
                    display: 'flex',
                    borderRadius: 3,
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <CardMedia
                    component="img"
                    image={product.image}
                    alt={product.title}
                    sx={{ width: 160, bgcolor: '#f8f9fa', objectFit: 'contain', p: 2 }}
                  />
                  <CardContent sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      {product.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {product.category}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        ${product.price}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="outlined"
                          startIcon={<DeleteIcon />}
                          color="error"
                          onClick={() => removeFromWishlist(product.id)}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                        >
                          Remove
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={<CartIcon />}
                          onClick={() => handleMoveToCart(product)}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                        >
                          Move to cart
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}

