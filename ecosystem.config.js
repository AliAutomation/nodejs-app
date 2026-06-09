module.exports = {
  apps: [
    {
      name: "nodejs-app",
      script: "scripts/main.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};