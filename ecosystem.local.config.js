// Local testing config for PM2
// Run: cd client && npm run build (first time)
// Then: pm2 start ecosystem.local.config.js
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'index.js',
      cwd: './server',
      env: {
        NODE_ENV: 'production'
      },
      restart_delay: 4000
    }
  ]
};
