import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Checkbox,
  Container,
  Divider,
  FormControlLabel,
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

function hasPermission(user, permission) {
  // Reason: `currentUser` (or its `permissions`) can be temporarily unavailable during boot,
  // and item shapes differ between admin and storefront hosts. This prevents `TypeError`s
  // while keeping permission checks explicit and centralized.
  const permissions = user?.permissions;
  return Array.isArray(permissions) && permissions.includes(permission);
}

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

  console.error(`[${routeRemoteHint}][LogicalError]`, { ...chosen, buttonText });
  return true;
}

function UserCard({ user }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {user?.name ?? 'Unknown'}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {user?.email ?? 'unknown@example.com'}
      </Typography>
      {user?.role ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Role: {user.role}
        </Typography>
      ) : null}
    </Box>
  );
}

function DeleteButton({ isAdminHost, productId, currentUser, onDelete, showError }) {
  const canDelete = hasPermission(currentUser, 'WISHLIST_DELETE');

  useEffect(() => {
    if (!isAdminHost) return;
    if (canDelete) return;
    // Reason: this action is admin-only; missing permission is a configuration/role issue.
    showError('Permission denied');
    window.zipy?.logMessage?.('Wishlist admin action blocked (missing permission)', {
      action: 'delete',
      requiredPermission: 'WISHLIST_DELETE',
    });
  }, [isAdminHost, canDelete, showError]);

  if (!isAdminHost) return null;
  if (!canDelete) return null;

  return (
    <Button
      variant="outlined"
      startIcon={<DeleteIcon />}
      color="error"
      onClick={() => onDelete(productId)}
      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
    >
      Delete
    </Button>
  );
}

function RemoveButton({ isAdminHost, product, currentUser, onRemove, showError }) {
  const productId = product?.id;
  const canRemove =
    Boolean(productId) && (!isAdminHost || hasPermission(currentUser, 'WISHLIST_REMOVE'));

  useEffect(() => {
    if (!isAdminHost) return;
    if (!productId) return;
    if (canRemove) return;
    // Reason: admin host should surface permission/config issues loudly for faster debugging.
    showError('Permission denied');
    window.zipy?.logMessage?.('Wishlist admin action blocked (missing permission)', {
      action: 'remove',
      requiredPermission: 'WISHLIST_REMOVE',
    });
  }, [isAdminHost, productId, canRemove, showError]);

  if (!productId) return null;

  // Storefront users should always be able to remove items from their own wishlist.
  // Reason: permission checks here are for the admin host only (diagnostics / privileged actions),
  // and the storefront item model does not include `addedBy` or any permissions metadata.
  if (!isAdminHost) {
    return (
      <Button
        variant="outlined"
        startIcon={<DeleteIcon />}
        color="error"
        onClick={() => onRemove(productId)}
        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
      >
        Remove
      </Button>
    );
  }

  if (!canRemove) return null;

  return (
    <Button
      variant="outlined"
      startIcon={<DeleteIcon />}
      color="error"
      onClick={() => onRemove(productId)}
      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
    >
      Remove
    </Button>
  );
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
  currentUser = null,
}) {
  const navigate = useNavigate();

  const isAdminHost = typeof window !== 'undefined' && window.__SHOPHUB_APP__ === 'admin';

  const FAIL_KEY = 'shophub:wishlist:simulateFailure:v1';
  const [simulateFailure, setSimulateFailure] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return JSON.parse(localStorage.getItem(FAIL_KEY) || 'false') === true;
    } catch {
      return false;
    }
  });

  const effectiveItems = useMemo(() => {
    if (!simulateFailure) return items;
    return { length: 1 };
  }, [items, simulateFailure]);

  const isEmpty = useMemo(() => !effectiveItems || effectiveItems.length === 0, [effectiveItems]);

  const handleMoveToCart = async (product) => {
    try {
      await addToCart(product);
      removeFromWishlist(product.id);
      showSuccess('Moved to cart');
    } catch (e) {
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
        {isAdminHost ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 2 },
              borderRadius: 3,
              border: '1px solid rgba(0, 0, 0, 0.06)',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px)',
              mb: 2,
            }}
            data-skip-logical-error="true"
          >
            <Typography sx={{ fontWeight: 900, mb: 0.5 }}>Diagnostics</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Toggle to intentionally break Wishlist.
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={simulateFailure}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setSimulateFailure(next);
                    try {
                      localStorage.setItem(FAIL_KEY, JSON.stringify(next));
                    } catch {
                      // Ignore storage failures in dev.
                    }
                  }}
                />
              }
              label="Simulate failure"
            />
          </Paper>
        ) : null}

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
            {effectiveItems.map((product) => (
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
                    {isAdminHost && product?.addedBy ? (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 800 }}>
                          Added by
                        </Typography>
                        <UserCard user={product.addedBy} />
                      </Box>
                    ) : null}
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        ${product.price}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <RemoveButton
                          isAdminHost={isAdminHost}
                          product={product}
                          currentUser={currentUser}
                          onRemove={removeFromWishlist}
                          showError={showError}
                        />
                        <DeleteButton
                          isAdminHost={isAdminHost}
                          productId={product.id}
                          currentUser={currentUser}
                          onDelete={removeFromWishlist}
                          showError={showError}
                        />
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

