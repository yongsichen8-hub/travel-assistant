module.exports = {
  apps: [
    {
      name: 'travel-assistant',
      script: 'node_modules/.bin/next',
      args: 'start -p 888',
      cwd: '/opt/travel-assistant',
      env: {
        NODE_ENV: 'production',
        PORT: '888',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};
