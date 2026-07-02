const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// JSON body parser
app.use(express.json());

// Initialize Prometheus Metrics registry
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'gateway_http_requests_total',
  help: 'Total number of HTTP requests processed by the API gateway',
  labelNames: ['method', 'route', 'status']
});

const httpRequestDuration = new client.Histogram({
  name: 'gateway_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const chaosModeGauge = new client.Gauge({
  name: 'gateway_chaos_mode',
  help: 'Current active chaos simulations (0 = none, 1 = latency, 2 = errors, 3 = both)',
  labelNames: ['type']
});

const dbStatusGauge = new client.Gauge({
  name: 'gateway_db_connection_status',
  help: 'Database connection status (1 = online, 0 = offline)'
});

// Chaos config state
let chaosConfig = {
  latencyActive: false,
  errorActive: false,
  memoryLeakActive: false,
  authFailureActive: false,
  dbLatencyActive: false,
  memoryLeakInterval: null
};

// Memory leak simulator array to hold references and prevent GC
let leakArray = [];

// Latency & Error Injection Middleware
app.use(async (req, res, next) => {
  const start = Date.now();
  
  // Track metrics when response finishes
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    httpRequestsTotal.labels(req.method, route, res.statusCode).inc();
    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
  });

  // Inject Auth Token Failures (30% probability)
  if (chaosConfig.authFailureActive && !req.path.startsWith('/api/chaos') && Math.random() < 0.3) {
    return res.status(401).json({ error: 'Chaos Simulator: 401 Unauthorized! Expired credentials token.' });
  }

  // Inject Latency (2 seconds delay)
  if (chaosConfig.latencyActive && !req.path.startsWith('/api/chaos')) {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Inject 500 Errors (50% probability)
  if (chaosConfig.errorActive && !req.path.startsWith('/api/chaos') && Math.random() < 0.5) {
    return res.status(500).json({ error: 'Chaos Simulator: Internal Server Error injected!' });
  }

  next();
});

// Database pool setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/devops_db',
  max: 5,
  connectionTimeoutMillis: 2000
});

// Background DB health check
setInterval(async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    dbStatusGauge.set(1);
  } catch (err) {
    dbStatusGauge.set(0);
  }
}, 5000);

// Endpoints
app.get('/api/status', async (req, res) => {
  let dbHealthy = false;
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    dbHealthy = true;
  } catch (err) {
    // Database connection failed
  }

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
    chaos: {
      latency: chaosConfig.latencyActive,
      errors: chaosConfig.errorActive,
      memoryLeak: chaosConfig.memoryLeakActive,
      authFailure: chaosConfig.authFailureActive,
      dbLatency: chaosConfig.dbLatencyActive
    },
    memoryUsage: process.memoryUsage()
  });
});

app.post('/api/chaos/latency', (req, res) => {
  const { enable } = req.body;
  chaosConfig.latencyActive = !!enable;
  chaosModeGauge.labels('latency').set(chaosConfig.latencyActive ? 1 : 0);
  res.json({ message: `Latency simulation ${chaosConfig.latencyActive ? 'enabled' : 'disabled'}` });
});

app.post('/api/chaos/errors', (req, res) => {
  const { enable } = req.body;
  chaosConfig.errorActive = !!enable;
  chaosModeGauge.labels('errors').set(chaosConfig.errorActive ? 1 : 0);
  res.json({ message: `Error injection simulation ${chaosConfig.errorActive ? 'enabled' : 'disabled'}` });
});

app.post('/api/chaos/memory-leak', (req, res) => {
  const { enable } = req.body;
  chaosConfig.memoryLeakActive = !!enable;
  
  if (chaosConfig.memoryLeakActive) {
    // Start generating leak objects every 100ms
    if (!chaosConfig.memoryLeakInterval) {
      chaosConfig.memoryLeakInterval = setInterval(() => {
        // Allocate ~5MB of random string data every 100ms
        const str = 'X'.repeat(5 * 1024 * 1024);
        leakArray.push({ str, timestamp: Date.now() });
      }, 100);
    }
    chaosModeGauge.labels('memory_leak').set(1);
    res.json({ message: 'Memory leak simulator started. Memory consumption will rise rapidly.' });
  } else {
    // Stop and clear
    if (chaosConfig.memoryLeakInterval) {
      clearInterval(chaosConfig.memoryLeakInterval);
      chaosConfig.memoryLeakInterval = null;
    }
    leakArray = [];
    if (global.gc) {
      global.gc();
    }
    chaosModeGauge.labels('memory_leak').set(0);
    res.json({ message: 'Memory leak simulator stopped and memory references cleared.' });
  }
});

app.post('/api/chaos/auth-failure', (req, res) => {
  const { enable } = req.body;
  chaosConfig.authFailureActive = !!enable;
  chaosModeGauge.labels('auth_failure').set(chaosConfig.authFailureActive ? 1 : 0);
  res.json({ message: `Authentication failure simulation ${chaosConfig.authFailureActive ? 'enabled' : 'disabled'}` });
});

app.post('/api/chaos/db-latency', (req, res) => {
  const { enable } = req.body;
  chaosConfig.dbLatencyActive = !!enable;
  chaosModeGauge.labels('db_latency').set(chaosConfig.dbLatencyActive ? 1 : 0);
  res.json({ message: `Database query latency simulation ${chaosConfig.dbLatencyActive ? 'enabled' : 'disabled'}` });
});

// Process crash simulation endpoint (kills gateway)
app.post('/api/chaos/crash', (req, res) => {
  res.json({ message: 'Gateway process terminating in 1 second. Watch self-healing in action!' });
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Proxy worker crash endpoint
app.post('/api/chaos/worker/crash', async (req, res) => {
  try {
    const response = await fetch('http://worker:5001/chaos/crash', { method: 'POST' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to contact worker: ' + err.message });
  }
});

// Proxy worker CPU spike endpoint
app.post('/api/chaos/worker/cpu', async (req, res) => {
  try {
    const response = await fetch('http://worker:5001/chaos/cpu-spike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to contact worker: ' + err.message });
  }
});

// Endpoint to fetch data from database (demonstrating DB connectivity)
app.get('/api/tasks', async (req, res) => {
  if (chaosConfig.dbLatencyActive) {
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database query failed: ' + err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (chaosConfig.dbLatencyActive) {
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, description, status) VALUES ($1, $2, $3) RETURNING *',
      [title, description || '', 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task: ' + err.message });
  }
});

// Metrics endpoint for Prometheus scraping
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.listen(port, () => {
  console.log(`Gateway service running on port ${port}`);
});
