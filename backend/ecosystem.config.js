module.exports = {
  apps: [
    {
      name: "starbucks-backend",
      script: "./dist/index.js",
      instances: "max", // Run on all available CPU cores
      exec_mode: "cluster", // Enable Node.js cluster mode
      watch: false,
      max_memory_restart: "1G", // Restart if memory exceeds 1GB
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
