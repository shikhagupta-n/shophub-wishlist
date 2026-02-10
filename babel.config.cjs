// Babel config for Webpack builds.
// Reason: enable JSX transform + modern JS targeting without relying on Vite.
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: 'defaults',
      },
    ],
    [
      '@babel/preset-react',
      {
        runtime: 'automatic',
      },
    ],
  ],
};

