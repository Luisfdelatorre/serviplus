module.exports = {
  apps: [
    {
      name: 'sp-server',
      script: 'server/index.js',
      cwd: __dirname,
      watch: ['server'],
      watch_delay: 1000,
      ignore_watch: [
        'node_modules',
        'client',
        'public',
        '*.log',
        '*.dat',
        '*.mdb',
        '.git'
      ],
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
        PORT: 80
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 80
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 80
      }
    },
    {
      name: 'sp-client',
      script: './node_modules/vite/bin/vite.js',
      args: '--host',
      cwd: './client',
      watch: false, // Vite maneja su propio Hot Module Replacement (HMR)
      autorestart: true,
      env: {
        NODE_ENV: 'development'
      },
      env_development: {
        NODE_ENV: 'development'
      }
    }
  ]
};

