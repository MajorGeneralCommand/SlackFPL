module.exports = {
  apps: [
    {
      name: 'fpl-bot',
      script: 'app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
