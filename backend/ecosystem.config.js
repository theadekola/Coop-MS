module.exports = {
  apps: [
    {
      name: 'oshodi-coop-api',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 5000 },
      env_development: { NODE_ENV: 'development', PORT: 5000 },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 1000,
    },
  ],
}
