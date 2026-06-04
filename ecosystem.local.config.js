// Local testing config — same as ecosystem.config.js but with Windows paths
// DO NOT commit this file
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'index.js',
      cwd: './server',
      env: {
        NODE_ENV: 'development'
      },
      restart_delay: 4000
    },
    {
      name: 'frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: '--host 0.0.0.0',
      cwd: './client',
      env: {
        NODE_ENV: 'development'
      },
      restart_delay: 4000
    }
  ]
};
