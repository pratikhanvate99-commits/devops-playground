import os
import time
import sys
import threading
from flask import Flask, jsonify, request
import psycopg2
from psycopg2.extras import RealDictCursor
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, Gauge, Histogram

app = Flask(__name__)

# Prometheus metrics
TASKS_PROCESSED = Counter('worker_tasks_processed_total', 'Total number of tasks processed by the worker', ['status'])
WORKER_STATUS = Gauge('worker_active_status', 'Status of the worker service (1 = online)')
CPU_SPIKE_STATUS = Gauge('worker_cpu_spike_active', 'Whether a CPU spike simulation is running (1 = active, 0 = inactive)')
DB_CONNECT_STATUS = Gauge('worker_db_connection_status', 'Worker database connection status (1 = connected, 0 = disconnected)')

WORKER_STATUS.set(1)
CPU_SPIKE_STATUS.set(0)

# DB config from env
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/devops_db")

def get_db_connection():
    return psycopg2.connect(DB_URL)

# Thread flags and states
cpu_spike_active = False

def cpu_spike_worker():
    global cpu_spike_active
    CPU_SPIKE_STATUS.set(1)
    end_time = time.time() + 20  # Spike CPU for 20 seconds
    while time.time() < end_time and cpu_spike_active:
        # Busy loop to consume CPU
        _ = 12345 * 54321
    cpu_spike_active = False
    CPU_SPIKE_STATUS.set(0)

def poll_and_process_tasks():
    print("Background worker thread started...")
    while True:
        try:
            conn = get_db_connection()
            DB_CONNECT_STATUS.set(1)
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Find one pending task
                cursor.execute(
                    "UPDATE tasks SET status = 'processing', updated_at = NOW() "
                    "WHERE id = (SELECT id FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED) "
                    "RETURNING id, title;"
                )
                task = cursor.fetchone()
                conn.commit()

                if task:
                    print(f"Processing task {task['id']}: {task['title']}")
                    # Simulate processing duration
                    time.sleep(2.0)

                    # Mark completed
                    cursor.execute(
                        "UPDATE tasks SET status = 'completed', updated_at = NOW() WHERE id = %s;",
                        (task['id'],)
                    )
                    conn.commit()
                    print(f"Completed task {task['id']}")
                    TASKS_PROCESSED.labels(status='completed').inc()
                else:
                    # No pending tasks, sleep for a short duration
                    time.sleep(1.0)
            conn.close()
        except psycopg2.OperationalError:
            DB_CONNECT_STATUS.set(0)
            print("Database connection offline. Retrying in 5 seconds...")
            time.sleep(5.0)
        except Exception as e:
            print(f"Error in task poller: {str(e)}")
            time.sleep(2.0)

# Start background worker thread
threading.Thread(target=poll_and_process_tasks, daemon=True).start()

@app.route('/health')
def health():
    db_connected = False
    try:
        conn = get_db_connection()
        conn.close()
        db_connected = True
    except:
        pass

    return jsonify({
        "status": "healthy",
        "database": "connected" if db_connected else "disconnected",
        "cpu_spike": cpu_spike_active
    })

@app.route('/metrics')
def metrics():
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route('/chaos/cpu-spike', methods=['POST'])
def trigger_cpu_spike():
    global cpu_spike_active
    data = request.get_json() or {}
    enable = data.get('enable', True)

    if enable:
        if not cpu_spike_active:
            cpu_spike_active = True
            threading.Thread(target=cpu_spike_worker, daemon=True).start()
            return jsonify({"message": "CPU spike triggered for 20 seconds."})
        return jsonify({"message": "CPU spike is already running."})
    else:
        cpu_spike_active = False
        return jsonify({"message": "CPU spike cancelled."})

@app.route('/chaos/crash', methods=['POST'])
def crash():
    print("Crash simulated. Exiting worker...")
    WORKER_STATUS.set(0)
    # Give it a tiny bit of time to send the response before exiting
    def kill_now():
        time.sleep(0.5)
        sys.exit(1)
    threading.Thread(target=kill_now).start()
    return jsonify({"message": "Worker process terminating. Watch container restart policy in action!"})

if __name__ == '__main__':
    # Run the Flask app
    app.run(host='0.0.0.0', port=5001)
