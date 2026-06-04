module.exports = {
  apps: [
    {
      // Only backend needed — Express serves both API and React built files
      name: 'backend',
      script: 'index.js',
      cwd: '/home/ec2-user/CI-CD/server',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/home/ec2-user/CI-CD/logs/backend-error.log',
      out_file: '/home/ec2-user/CI-CD/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      restart_delay: 4000,
      watch: false,
      ignore_watch: ['node_modules', '.git', 'public']
    }
  ]
};
