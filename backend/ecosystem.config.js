module.exports = {
  apps: [{
    name: "worknova-api",
    script: "./src/index.ts",
    interpreter: "node",
    interpreter_args: "--import tsx",
    instances: "max", // Utilize all CPU cores (Clustering)
    exec_mode: "cluster", // PM2 Cluster Mode
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
}
