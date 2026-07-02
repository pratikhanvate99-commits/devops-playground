import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Database, 
  Terminal, 
  Cpu, 
  AlertTriangle, 
  Play, 
  RefreshCw, 
  ExternalLink,
  Flame,
  Zap,
  Server,
  LayoutDashboard,
  ShieldAlert,
  GitBranch,
  ListTodo
} from 'lucide-react';

const API_BASE = 'http://localhost:5000';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [gatewayStatus, setGatewayStatus] = useState('offline');
  const [dbStatus, setDbStatus] = useState('offline');
  const [workerStatus, setWorkerStatus] = useState('offline');
  
  const [chaosState, setChaosState] = useState({
    latency: false,
    errors: false,
    memoryLeak: false,
    cpuSpike: false,
    authFailure: false,
    dbLatency: false
  });
  
  const [memoryUsage, setMemoryUsage] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  
  // Real-time Event Console Logs
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  // Sparkline data state (Real-time telemetry)
  const [latencyHistory, setLatencyHistory] = useState([40, 45, 42, 50, 48, 55, 47, 52, 49, 45]);
  const [requestHistory, setRequestHistory] = useState([12, 15, 18, 14, 16, 22, 19, 25, 21, 24]);

  // CI/CD Pipeline Simulator State
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState([]);
  const [activeStage, setActiveStage] = useState(-1);
  const [stageProgress, setStageProgress] = useState([0, 0, 0, 0, 0]);
  const pipelineLogsEndRef = useRef(null);

  const pipelineStages = [
    { title: 'Workspace Init & Checkout', duration: 2000 },
    { title: 'Static Code Linting & Test suites', duration: 3000 },
    { title: 'Docker Build & Multi-Stage Layering', duration: 4000 },
    { title: 'Trivy Container Security Vulnerability Scan', duration: 3000 },
    { title: 'Push Registry & GitOps Trigger Deployment', duration: 3000 }
  ];

  // Add a log entry
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }].slice(-50)); // Keep last 50 logs
  };

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (pipelineLogsEndRef.current) {
      pipelineLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pipelineLogs]);

  // Initial logs
  useEffect(() => {
    addLog('DevOps Control Room Initialized.', 'info');
    addLog('Establishing service loops for health probes...', 'info');
  }, []);

  // Poll Gateway and Services Status
  useEffect(() => {
    const pollStatus = async () => {
      // 1. Gateway Status
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (res.ok) {
          const data = await res.json();
          setGatewayStatus('online');
          setDbStatus(data.database === 'connected' ? 'online' : 'offline');
          setChaosState(prev => ({
            ...prev,
            latency: data.chaos.latency,
            errors: data.chaos.errors,
            memoryLeak: data.chaos.memoryLeak,
            authFailure: data.chaos.authFailure,
            dbLatency: data.chaos.dbLatency
          }));
          if (data.memoryUsage) {
            setMemoryUsage((data.memoryUsage.rss / 1024 / 1024).toFixed(1));
          }

          // Generate telemetry line metrics
          setLatencyHistory(prev => {
            let nextVal = data.chaos.latency ? 2000 + Math.floor(Math.random() * 80) : 40 + Math.floor(Math.random() * 20);
            if (data.chaos.dbLatency) nextVal += 3000;
            return [...prev.slice(1), nextVal];
          });

          setRequestHistory(prev => {
            const nextVal = data.chaos.errors ? 10 + Math.floor(Math.random() * 5) : 20 + Math.floor(Math.random() * 15);
            return [...prev.slice(1), nextVal];
          });

        } else {
          throw new Error();
        }
      } catch (err) {
        if (gatewayStatus === 'online') {
          addLog('CRITICAL: API Gateway went offline. Connection severed.', 'error');
        }
        setGatewayStatus('offline');
        setDbStatus('offline');
        setMemoryUsage(null);
      }

      // 2. Worker Status
      try {
        const res = await fetch('http://localhost:5001/health');
        if (res.ok) {
          const data = await res.json();
          setWorkerStatus('online');
          setChaosState(prev => ({
            ...prev,
            cpuSpike: data.cpu_spike
          }));
        } else {
          setWorkerStatus('offline');
        }
      } catch (err) {
        setWorkerStatus('offline');
      }

      // 3. Fetch Database Tasks
      try {
        const res = await fetch(`${API_BASE}/api/tasks`);
        if (res.ok) {
          const data = await res.json();
          setTasks(data);
        }
      } catch (err) {
        // DB or Gateway offline
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [gatewayStatus]);

  // Log status transitions
  const prevGateway = useRef(gatewayStatus);
  useEffect(() => {
    if (prevGateway.current !== gatewayStatus) {
      if (gatewayStatus === 'online') {
        addLog('Service Recovery: Gateway container health check returns OK.', 'success');
      }
      prevGateway.current = gatewayStatus;
    }
  }, [gatewayStatus]);

  const prevWorker = useRef(workerStatus);
  useEffect(() => {
    if (prevWorker.current !== workerStatus) {
      if (workerStatus === 'online') {
        addLog('Service Recovery: Task worker engine successfully spun up.', 'success');
      } else {
        addLog('Alert: Task worker container stopped responding to probes.', 'error');
      }
      prevWorker.current = workerStatus;
    }
  }, [workerStatus]);

  // Toggle Chaos Configs
  const toggleChaos = async (type, endpoint, currentState) => {
    try {
      addLog(`Sending configuration change request for ${type}...`, 'info');
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: !currentState })
      });
      if (res.ok) {
        const data = await res.json();
        addLog(data.message, !currentState ? 'warning' : 'success');
        setChaosState(prev => ({ ...prev, [type]: !currentState }));
      } else {
        addLog(`Request failed. Service answered with non-200 state.`, 'error');
      }
    } catch (err) {
      addLog(`Communication Failure: Endpoint ${endpoint} is unreachable.`, 'error');
    }
  };

  // Trigger Process Crash
  const triggerCrash = async (service, endpoint) => {
    if (!window.confirm(`Simulate OOM/Crash on ${service}? The process will exit and test Docker restart routines.`)) {
      return;
    }
    try {
      addLog(`Sending kill instruction to ${service}...`, 'warning');
      const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        addLog(data.message, 'error');
      }
    } catch (err) {
      addLog(`Connection reset: ${service} process terminated successfully.`, 'error');
    }
  };

  // Add Task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newTaskTitle, 
          description: newTaskDesc || 'Client Dashboard Queue Request' 
        })
      });
      if (res.ok) {
        const task = await res.json();
        addLog(`Task enqueued: "${task.title}" (Status: Pending)`, 'info');
        setNewTaskTitle('');
        setNewTaskDesc('');
        // Refresh
        const tasksRes = await fetch(`${API_BASE}/api/tasks`);
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setTasks(data);
        }
      }
    } catch (err) {
      addLog('Task creation failed. Gateway or database is offline.', 'error');
    }
  };

  // Run Simulated CI/CD Pipeline
  const runCicdPipeline = () => {
    if (pipelineRunning) return;
    setPipelineRunning(true);
    setPipelineLogs([]);
    setStageProgress([0, 0, 0, 0, 0]);
    setActiveStage(0);

    const logList = [
      // Stage 0 logs
      [
        '🚀 Initializing CI/CD workflow context...',
        'git checkout --ref=main --depth=1',
        'Repository: https://github.com/devops/playground.git',
        'Head: Commit 9a1c2f7 [Fix database connection pooling leak]',
        'Verified environment workspace: OK',
        '✔ Workspace checked out in 0.8s.'
      ],
      // Stage 1 logs
      [
        '🔍 Launching static analysis code checks...',
        'Node.js linter running: eslint ./services/gateway',
        '✔ ESLint checked: 0 warnings, 0 errors.',
        'Python worker check: flake8 ./services/worker',
        '✔ flake8 checked: 0 styling anomalies found.',
        'pytest -v ./services/worker/tests/',
        'Running 4 test modules... OK',
        '✔ All unit test checks passed successfully!'
      ],
      // Stage 2 logs
      [
        '🐳 Building Docker containers layers...',
        'docker build -t devops-gateway:release-1.4.2 ./services/gateway',
        '#1 [1/5] FROM node:20-alpine (CACHED)',
        '#2 [2/5] WORKDIR /usr/src/app (CACHED)',
        '#3 [3/5] COPY package*.json ./',
        '#4 [4/5] RUN npm install --omit=dev (Built in 1.4s)',
        '#5 [5/5] COPY . .',
        'Successfully built image layer sha256:8f4c2c9d1a',
        'docker build -t devops-worker:release-1.4.2 ./services/worker',
        'Successfully built image layer sha256:ea4c1c9e82',
        '✔ Docker image layers compiled successfully.'
      ],
      // Stage 3 logs
      [
        '🛡 Initiating Trivy Container Vulnerability Scan...',
        'trivy image devops-gateway:release-1.4.2 --severity CRITICAL,HIGH',
        'Vulnerability Scan Results: devops-gateway (alpine 3.19.1)',
        '==========================================================',
        'Total: 0 (Critical: 0, High: 0, Medium: 0, Low: 0)',
        '✔ Security audit passed. No blocking vulnerabilities detected.'
      ],
      // Stage 4 logs
      [
        '📦 Pushing compiled layers to container repository...',
        'docker push docker.io/devops/gateway:release-1.4.2 [Success]',
        'docker push docker.io/devops/worker:release-1.4.2 [Success]',
        '🔧 Dispatching GitOps manifest update webhook...',
        'Sending CD deployment payload to repository...',
        '✔ Rollout successfully updated! Environment sync initialized.',
        '🎉 CI/CD WORKFLOW PIPELINE SUCCESSFUL!'
      ]
    ];

    let currentStageIndex = 0;
    
    const executeStage = () => {
      if (currentStageIndex >= pipelineStages.length) {
        setPipelineRunning(false);
        setActiveStage(-1);
        return;
      }

      setActiveStage(currentStageIndex);
      const stage = pipelineStages[currentStageIndex];
      const logsForStage = logList[currentStageIndex];
      let elapsed = 0;
      const tick = 100; // Increment progress bar every 100ms

      const interval = setInterval(() => {
        elapsed += tick;
        const percent = Math.min((elapsed / stage.duration) * 100, 100);
        
        setStageProgress(prev => {
          const nextProg = [...prev];
          nextProg[currentStageIndex] = percent;
          return nextProg;
        });

        if (elapsed >= stage.duration) {
          clearInterval(interval);
          // Print logs for this stage
          logsForStage.forEach((line, idx) => {
            setTimeout(() => {
              const isError = line.includes('ERROR') || line.includes('Vulnerability');
              const isSuccess = line.includes('✔') || line.includes('🎉') || line.includes('Success');
              const type = isError ? 'error' : isSuccess ? 'success' : 'info';
              setPipelineLogs(prev => [...prev, { line, type }]);
            }, idx * 100);
          });

          currentStageIndex++;
          setTimeout(executeStage, 800);
        }
      }, tick);
    };

    executeStage();
  };

  // Helper to build SVG sparkline path
  const makeSparklinePath = (data) => {
    if (data.length === 0) return '';
    const width = 100;
    const height = 30;
    const padding = 2;
    const maxVal = Math.max(...data, 1);
    const minVal = Math.min(...data, 0);
    const range = maxVal - minVal;
    
    return data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="app-layout">
      {/* Sidebar Panel */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo">
            <div className="logo-icon">🚀</div>
            <div>
              <h1>DevOps Desk</h1>
              <div className="logo-sub">Cloud Control room v2.0</div>
            </div>
          </div>

          <nav className="nav-list">
            <div 
              className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <LayoutDashboard size={18} />
              Control Center
            </div>
            
            <div 
              className={`nav-item ${activeTab === 'chaos' ? 'active' : ''}`}
              onClick={() => setActiveTab('chaos')}
            >
              <Flame size={18} />
              Chaos Laboratory
            </div>

            <div 
              className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              <ListTodo size={18} />
              Database Sandbox
            </div>

            <div 
              className={`nav-item ${activeTab === 'pipeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('pipeline')}
            >
              <Terminal size={18} />
              CI/CD Pipeline
            </div>

            <div 
              className={`nav-item ${activeTab === 'observability' ? 'active' : ''}`}
              onClick={() => setActiveTab('observability')}
            >
              <Server size={18} />
              Telemetry Suite
            </div>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div>Workspace: devops-playground</div>
          <div className="sidebar-footer-item">
            <span className="status-dot"></span>
            Host: Local Docker Engine
          </div>
        </div>
      </aside>

      {/* Main Viewport Panel */}
      <main className="main-content">
        <header>
          <div className="header-title">
            {activeTab === 'overview' && 'SYSTEM SUMMARY REPORT'}
            {activeTab === 'chaos' && 'FAULT INJECTION DESK'}
            {activeTab === 'tasks' && 'DATABASE WRITER SANDBOX'}
            {activeTab === 'pipeline' && 'DEPLOYMENT ORCHESTRATION TERMINAL'}
            {activeTab === 'observability' && 'OBSERVABILITY SUITE TARGETS'}
          </div>
          <div className={`header-status ${gatewayStatus === 'offline' || dbStatus === 'offline' ? 'offline' : ''}`}>
            <span className="status-dot"></span>
            {gatewayStatus === 'online' && dbStatus === 'online' ? 'All Probes Normal' : 'Infrastructure Degraded'}
          </div>
        </header>

        <div className="viewport">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-pane">
              <div className="metrics-row">
                <div className={`metric-card ${gatewayStatus === 'online' ? 'healthy' : 'unhealthy'}`}>
                  <div className="metric-info">
                    <h3>API Gateway</h3>
                    <div className="metric-value">{gatewayStatus.toUpperCase()}</div>
                  </div>
                  <div className="metric-icon-wrapper">
                    <LayoutDashboard size={20} />
                  </div>
                </div>

                <div className={`metric-card ${dbStatus === 'online' ? 'healthy' : 'unhealthy'}`}>
                  <div className="metric-info">
                    <h3>PostgreSQL DB</h3>
                    <div className="metric-value">{dbStatus.toUpperCase()}</div>
                  </div>
                  <div className="metric-icon-wrapper">
                    <Database size={20} />
                  </div>
                </div>

                <div className={`metric-card ${workerStatus === 'online' ? 'healthy' : 'unhealthy'}`}>
                  <div className="metric-info">
                    <h3>Worker Daemon</h3>
                    <div className="metric-value">{workerStatus.toUpperCase()}</div>
                  </div>
                  <div className="metric-icon-wrapper">
                    <Cpu size={20} />
                  </div>
                </div>

                <div className="metric-card healthy">
                  <div className="metric-info">
                    <h3>Gateway Memory</h3>
                    <div className="metric-value">{memoryUsage ? `${memoryUsage} MB` : 'N/A'}</div>
                  </div>
                  <div className="metric-icon-wrapper">
                    <Activity size={20} />
                  </div>
                </div>
              </div>

              {/* Sparkline Telemetry Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title"><Activity size={16} className="link-icon" /> API Gateway Request Rate (Sparkline)</h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                        {requestHistory[requestHistory.length - 1]} <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>req/s</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Real-time scrape average</p>
                    </div>
                    <div className="sparkline-container">
                      <svg className="sparkline-svg">
                        <path className="sparkline-path" d={makeSparklinePath(requestHistory)} />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title"><Cpu size={16} className="link-icon" /> End-to-End API Latency (Sparkline)</h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                        {latencyHistory[latencyHistory.length - 1] >= 1000 
                          ? `${(latencyHistory[latencyHistory.length - 1] / 1000).toFixed(2)} s` 
                          : `${latencyHistory[latencyHistory.length - 1]} ms`}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Scrape average duration</p>
                    </div>
                    <div className="sparkline-container">
                      <svg className="sparkline-svg">
                        <path className="sparkline-path" d={makeSparklinePath(latencyHistory)} style={{ stroke: 'var(--color-secondary)' }} />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Logs Card */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title"><Terminal size={18} /> Real-time System Event Console</h2>
                  <button 
                    className="btn-submit" 
                    style={{ padding: '6px 12px', fontSize: '12px' }} 
                    onClick={() => setLogs([])}
                  >
                    Clear Console
                  </button>
                </div>
                <div className="logs-console">
                  {logs.map((log, idx) => (
                    <div key={idx} className={`log-entry ${log.type}`}>
                      <span className="log-time">[{log.timestamp}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHAOS LAB */}
          {activeTab === 'chaos' && (
            <div className="tab-pane">
              <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                  <h2 className="card-title"><Flame size={20} style={{ color: 'var(--color-warning)' }} /> Fault Injection Matrix</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Simulate common service degradation profiles to verify cluster resiliency.</p>
                </div>

                <div className="chaos-lab-grid">
                  {/* Latency Chaos */}
                  <div className="chaos-card">
                    <div className="chaos-card-title"><Activity size={18} /> Gateway Network Latency</div>
                    <p className="chaos-card-desc">Injects a flat 2.0-second delay into all incoming gateway API routes, simulating network congestion.</p>
                    <div className="chaos-card-control">
                      <span>{chaosState.latency ? 'Active' : 'Inactive'}</span>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={chaosState.latency}
                          onChange={() => toggleChaos('latency', '/api/chaos/latency', chaosState.latency)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  {/* 500 Error Chaos */}
                  <div className="chaos-card">
                    <div className="chaos-card-title"><ShieldAlert size={18} /> Gateway 500 Error Rate</div>
                    <p className="chaos-card-desc">Forces the gateway API endpoints to fail randomly with 500 Internal Server Errors (50% probability).</p>
                    <div className="chaos-card-control">
                      <span>{chaosState.errors ? 'Active' : 'Inactive'}</span>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={chaosState.errors}
                          onChange={() => toggleChaos('errors', '/api/chaos/errors', chaosState.errors)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  {/* Memory Leak */}
                  <div className="chaos-card">
                    <div className="chaos-card-title"><Zap size={18} /> Memory Leak (Gateway)</div>
                    <p className="chaos-card-desc">Rapidly allocates Heap memory blocks inside V8 node engine (~5MB every 100ms) to trigger Docker OOM killer routines.</p>
                    <div className="chaos-card-control">
                      <span>{chaosState.memoryLeak ? 'Active' : 'Inactive'}</span>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={chaosState.memoryLeak}
                          onChange={() => toggleChaos('memoryLeak', '/api/chaos/memory-leak', chaosState.memoryLeak)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  {/* CPU Spike */}
                  <div className="chaos-card">
                    <div className="chaos-card-title"><Cpu size={18} /> Worker CPU Stress</div>
                    <p className="chaos-card-desc">Locks up Python worker background threads into a math calculation busy-loop to simulate localized CPU load peaks.</p>
                    <div className="chaos-card-control">
                      <span>{chaosState.cpuSpike ? 'Active' : 'Inactive'}</span>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={chaosState.cpuSpike}
                          onChange={() => toggleChaos('cpuSpike', '/api/chaos/worker/cpu', chaosState.cpuSpike)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  {/* NEW: Auth token failure */}
                  <div className="chaos-card">
                    <div className="chaos-card-title"><ShieldAlert size={18} style={{ color: 'var(--color-danger)' }} /> Corrupted Auth Tokens</div>
                    <p className="chaos-card-desc">Simulates token expiry validation failures. Returns 401 Unauthorized codes randomly (30% probability) on endpoints.</p>
                    <div className="chaos-card-control">
                      <span>{chaosState.authFailure ? 'Active' : 'Inactive'}</span>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={chaosState.authFailure}
                          onChange={() => toggleChaos('authFailure', '/api/chaos/auth-failure', chaosState.authFailure)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  {/* NEW: Database query latency */}
                  <div className="chaos-card">
                    <div className="chaos-card-title"><Database size={18} style={{ color: 'var(--color-primary)' }} /> Database Query Bottleneck</div>
                    <p className="chaos-card-desc">Injects a 3.0-second delay directly inside the PostgreSQL query transactions pool, testing gateway client timeouts.</p>
                    <div className="chaos-card-control">
                      <span>{chaosState.dbLatency ? 'Active' : 'Inactive'}</span>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={chaosState.dbLatency}
                          onChange={() => toggleChaos('dbLatency', '/api/chaos/db-latency', chaosState.dbLatency)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Destructive Crash Actions */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title" style={{ color: 'var(--color-danger)' }}><AlertTriangle size={18} /> Destructive Container Terminations</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Instantly kill service runtime environments. Verifies that the Docker daemon restart configurations trigger self-healing.</p>
                </div>
                <div className="destruction-row">
                  <button 
                    className="btn-destroy" 
                    onClick={() => triggerCrash('API Gateway', '/api/chaos/crash')}
                  >
                    <Zap size={14} /> Kill API Gateway Container (SIGKILL)
                  </button>
                  <button 
                    className="btn-destroy warning" 
                    onClick={() => triggerCrash('Worker Service', '/api/chaos/worker/crash')}
                  >
                    <AlertTriangle size={14} /> Kill Task Worker Container (SIGTERM)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TASKS SANDBOX */}
          {activeTab === 'tasks' && (
            <div className="tab-pane">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title"><Database size={20} className="link-icon" /> Task Transaction Sandbox</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Enqueue task payloads to verify database write throughput and async worker polling loops.</p>
                </div>

                <div className="task-sandbox-container">
                  {/* Task Form */}
                  <form onSubmit={handleAddTask} className="task-form">
                    <div className="form-group">
                      <label>Task Title</label>
                      <input 
                        type="text" 
                        className="task-input" 
                        placeholder="e.g. process invoice layers" 
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        disabled={gatewayStatus === 'offline'}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Task Description (Optional)</label>
                      <textarea 
                        className="task-input" 
                        style={{ height: '80px', resize: 'none' }}
                        placeholder="Details of background processing job"
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.target.value)}
                        disabled={gatewayStatus === 'offline'}
                      />
                    </div>

                    <button type="submit" className="btn-submit" disabled={gatewayStatus === 'offline'}>
                      <Play size={16} /> Enqueue Task
                    </button>
                  </form>

                  {/* Task List */}
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                      Active Queue Log
                    </h3>
                    <div className="task-list-wrapper">
                      {tasks.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '40px 0' }}>
                          No tasks located in database queue. Submit a task using the client form.
                        </div>
                      ) : (
                        tasks.map(task => (
                          <div key={task.id} className="task-item">
                            <div>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{task.title}</h4>
                              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                ID: {task.id} • {task.description}
                              </p>
                            </div>
                            <span className={`task-badge ${task.status}`}>{task.status}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CI/CD TERMINAL */}
          {activeTab === 'pipeline' && (
            <div className="tab-pane">
              {/* Pipeline Progress Stages */}
              <div className="pipeline-progress-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600' }}>GitHub Actions Deployment Run</h3>
                  <button 
                    className="btn-submit" 
                    onClick={runCicdPipeline}
                    disabled={pipelineRunning}
                    style={{ background: 'var(--color-secondary)', color: '#fff' }}
                  >
                    <GitBranch size={16} /> {pipelineRunning ? 'Pipeline Running...' : 'Trigger Pipeline Rollout'}
                  </button>
                </div>

                <div>
                  {pipelineStages.map((stage, idx) => (
                    <div 
                      key={idx} 
                      className={`pipeline-stage ${activeStage === idx ? 'active' : ''} ${activeStage > idx ? 'completed' : ''}`}
                    >
                      <div className="stage-num">{activeStage > idx ? '✔' : idx + 1}</div>
                      <div className="stage-info">
                        <div className="stage-header">
                          <span style={{ fontWeight: activeStage === idx ? '600' : '400' }}>{stage.title}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                            {Math.round(stageProgress[idx])}%
                          </span>
                        </div>
                        <div className="progress-bar-container">
                          <div className="progress-bar-fill" style={{ width: `${stageProgress[idx]}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Terminal Window */}
              <div className="terminal-window">
                <div className="terminal-header">
                  <div className="terminal-dots">
                    <div className="terminal-dot close"></div>
                    <div className="terminal-dot minimize"></div>
                    <div className="terminal-dot maximize"></div>
                  </div>
                  <span className="terminal-title">Runner console: logs/build-runner.sh</span>
                  <div style={{ width: '40px' }}></div>
                </div>
                
                <div className="terminal-body">
                  {pipelineLogs.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '40px 0' }}>
                      Runner idle. Click 'Trigger Pipeline Rollout' to watch the CI/CD workflow execute.
                    </div>
                  ) : (
                    pipelineLogs.map((log, idx) => (
                      <div key={idx} className={`log-entry ${log.type}`}>
                        <span>$ {log.line}</span>
                      </div>
                    ))
                  )}
                  <div ref={pipelineLogsEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: OBSERVABILITY */}
          {activeTab === 'observability' && (
            <div className="tab-pane">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title"><Server size={18} className="link-icon" /> Observability Targets</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Launch the pre-provisioned open source monitoring portals directly.</p>
                </div>

                <div className="obs-suite-grid">
                  <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="obs-link-card grafana">
                    <div className="obs-card-icon">
                      <Activity size={24} />
                    </div>
                    <div className="obs-card-body">
                      <h3>Grafana Dashboard <ExternalLink size={14} /></h3>
                      <p>View visual, pre-provisioned dashboard charts for network throughput, HTTP latency histograms, database availability status, and cAdvisor container performance pools.</p>
                    </div>
                  </a>

                  <a href="http://localhost:9090" target="_blank" rel="noreferrer" className="obs-link-card">
                    <div className="obs-card-icon">
                      <Cpu size={24} />
                    </div>
                    <div className="obs-card-body">
                      <h3>Prometheus Console <ExternalLink size={14} /></h3>
                      <p>Run complex, ad-hoc PromQL metrics queries on Gateway client libraries, task worker scrapers, and local Docker daemon sockets directly.</p>
                    </div>
                  </a>

                  <a href="http://localhost:8088" target="_blank" rel="noreferrer" className="obs-link-card">
                    <div className="obs-card-icon" style={{ color: 'var(--color-secondary)', background: 'rgba(168, 85, 247, 0.08)' }}>
                      <Database size={24} />
                    </div>
                    <div className="obs-card-body">
                      <h3>cAdvisor Container Metrics <ExternalLink size={14} /></h3>
                      <p>Inspect raw resource allocations, CPU cores, RSS RAM sizes, network packet queues, and disk read/write logs directly from the Docker host socket.</p>
                    </div>
                  </a>

                  <a href="http://localhost:5000/metrics" target="_blank" rel="noreferrer" className="obs-link-card">
                    <div className="obs-card-icon" style={{ color: 'var(--color-success)', background: 'rgba(16, 185, 129, 0.08)' }}>
                      <Terminal size={24} />
                    </div>
                    <div className="obs-card-body">
                      <h3>Gateway Raw metrics <ExternalLink size={14} /></h3>
                      <p>Examine raw Prometheus scrape endpoints exposed directly by Node.js `prom-client` before collector parsing.</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
