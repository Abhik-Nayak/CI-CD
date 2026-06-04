module.exports = {
  // "apps" is an array — each object inside is one app that PM2 will manage
  apps: [

    // ========================
    // BACKEND (Express Server)
    // ========================
    {
      name: 'backend',                  // Name shown in "pm2 list" and "pm2 logs"
      script: 'index.js',              // The file PM2 will run (server/index.js)
      cwd: '/home/ec2-user/CI-CD/server', // Working directory — PM2 will cd here before running the script
      instances: 1,                     // How many copies to run (1 = single instance)
      exec_mode: 'fork',               // "fork" = normal single process, "cluster" = multiple processes sharing a port
      env: {
        NODE_ENV: 'development'         // Environment variables passed to the app (PORT comes from server/.env via dotenv)
      },
      error_file: '/home/ec2-user/CI-CD/logs/backend-error.log',  // Where PM2 writes error logs (stderr)
      out_file: '/home/ec2-user/CI-CD/logs/backend-out.log',      // Where PM2 writes normal logs (stdout)
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',  // Adds timestamps like "2026-06-04 10:30:00 +0530" to every log line
      max_memory_restart: '500M',       // Auto-restart if the app uses more than 500MB RAM (prevents memory leaks)
      restart_delay: 4000,              // Wait 4 seconds before restarting after a crash (prevents rapid crash loops)
      watch: false,                     // Don't auto-restart on file changes (GitHub Actions handles redeployment)
      ignore_watch: ['node_modules', '.git']  // If watch were true, ignore these folders
    },

    // ========================
    // FRONTEND (Vite + React)
    // ========================
    {
      name: 'frontend',                // Name shown in "pm2 list" and "pm2 logs"
      script: 'node_modules/.bin/vite', // Runs the Vite dev server directly (instead of going through npm)
      args: '--host 0.0.0.0',          // Makes Vite accessible from any IP (not just localhost) — needed for EC2
      cwd: '/home/ec2-user/CI-CD/client', // Working directory — PM2 will cd here before running the script
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      error_file: '/home/ec2-user/CI-CD/logs/frontend-error.log',
      out_file: '/home/ec2-user/CI-CD/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      restart_delay: 4000,
      watch: false,
      ignore_watch: ['node_modules', '.git']
    }
  ]
};
