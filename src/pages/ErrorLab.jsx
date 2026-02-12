import React, { useMemo, useState } from 'react';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';

/**
 * Error Lab (Wishlist remote)
 * Generates one error per click for Zipy verification.
 */

function logToZipy(type, payload) {
  if (typeof window === 'undefined') return;
  if (!window.zipy) return;
  if (type === 'message') window.zipy.logMessage(payload.message, payload.info);
  if (type === 'exception') window.zipy.logException(payload.error);
  if (type === 'error') window.zipy.logError(payload.errorType, payload.errorMessage, payload.category, payload.errInfo);
}

export default function ErrorLab() {
  const [intermittentToggle, setIntermittentToggle] = useState(false);

  const envInfo = useMemo(
    () => ({
      remote: 'wishlist',
      hasZipy: Boolean(typeof window !== 'undefined' && window.zipy),
      href: typeof window !== 'undefined' ? window.location.href : '',
    }),
    [],
  );

  return (
    <Box sx={{ minHeight: '100vh', background: '#fafafa', py: 6 }}>
      <Container maxWidth="md">
        <Paper sx={{ p: 4, mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>
            Error Lab — Wishlist Remote
          </Typography>
          <Typography color="text.secondary">Trigger errors one-by-one.</Typography>
          <Typography variant="body2" sx={{ mt: 2, fontFamily: 'monospace' }}>
            {JSON.stringify(envInfo)}
          </Typography>
        </Paper>

        <Stack spacing={2}>
          <Button
            variant="contained"
            onClick={() => {
              logToZipy('message', { message: '[wishlist] logical_error: about to throw', info: { kind: 'logical' } });
              throw new Error('[wishlist] LogicalError: simulated wishlist rendering bug');
            }}
          >
            Logical error (throw)
          </Button>

          <Button
            variant="outlined"
            onClick={() => {
              try {
                // Runtime error with a real stack.
                const obj = undefined;
                // eslint-disable-next-line no-unused-expressions
                obj.keys();
              } catch (err) {
                logToZipy('exception', { error: err });
                throw err;
              }
            }}
          >
            Runtime error (undefined method) + zipy.logException
          </Button>

          <Button
            variant="outlined"
            onClick={() => {
              setIntermittentToggle((p) => !p);
              const willFail = !intermittentToggle;

              if (!willFail) {
                logToZipy('message', { message: '[wishlist] intermittent: success path', info: { kind: 'intermittent' } });
                return;
              }

              const err = new Error('[wishlist] IntermittentError: simulated chunk load flake');
              logToZipy('exception', { error: err });
              throw err;
            }}
          >
            Intermittent error (every other click)
          </Button>

          <Button
            variant="outlined"
            onClick={async () => {
              const url = 'http://localhost:4000/api/fail-500';
              const fallbackUrl = 'https://httpstat.us/500';

              try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`[wishlist] Backend500 from ${url}: ${res.status}`);
              } catch {
                const res2 = await fetch(fallbackUrl);
                if (!res2.ok) {
                  const err = new Error(`[wishlist] Backend500 from ${fallbackUrl}: ${res2.status}`);
                  logToZipy('exception', { error: err });
                  throw err;
                }
              }
            }}
          >
            Backend 5xx (fetch) + stacktrace
          </Button>

          <Button
            variant="text"
            onClick={() => {
              logToZipy('error', {
                errorType: 'WishlistStateError',
                errorMessage: 'Simulated wishlist persistence issue (custom)',
                category: 'FE',
                errInfo: { remote: 'wishlist' },
              });
            }}
          >
            Custom app error (zipy.logError) — no crash
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

