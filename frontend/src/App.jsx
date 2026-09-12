import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import "./App.css";


function App() {
  const [servers, setServers] = useState([]);
  const [events, setEvents] = useState([]);

  const [metricsHistory, setMetricsHistory] =
    useState([]);

  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const [autoTraffic, setAutoTraffic] =
    useState(false);

  const [requestsPerSecond, setRequestsPerSecond] =
    useState(2);


  const fetchServers = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/servers"
      );

      if (!response.ok) {
        throw new Error();
      }

      const data = await response.json();

      setServers(data);
      setError("");

      if (data.length > 0) {
        const averageCpu =
          data.reduce(
            (total, server) =>
              total + server.cpu_usage,
            0
          ) / data.length;

        const averageLatency =
          data.reduce(
            (total, server) =>
              total + server.latency,
            0
          ) / data.length;

        const totalRequests =
          data.reduce(
            (total, server) =>
              total + server.request_count,
            0
          );

        const time =
          new Date().toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }
          );

        setMetricsHistory(
          (previousHistory) => {
            const updatedHistory = [
              ...previousHistory,
              {
                time: time,
                cpu: Number(
                  averageCpu.toFixed(1)
                ),
                latency: Number(
                  averageLatency.toFixed(1)
                ),
                requests: totalRequests,
              },
            ];

            return updatedHistory.slice(-30);
          }
        );
      }
    } catch {
      setError(
        "Could not connect to the DCInsight backend."
      );
    }
  };


  const fetchEvents = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/events"
      );

      if (!response.ok) {
        throw new Error();
      }

      const data = await response.json();

      setEvents(data);
    } catch {
      setError(
        "Could not load incident history."
      );
    }
  };


  const refreshDashboard = async () => {
    await Promise.all([
      fetchServers(),
      fetchEvents(),
    ]);
  };


  const sendRequests = async (count) => {
    setSending(true);
    setError("");

    try {
      for (let i = 0; i < count; i++) {
        const response = await fetch(
          "http://127.0.0.1:8000/request",
          {
            method: "POST",
          }
        );

        if (!response.ok) {
          throw new Error();
        }
      }

      await refreshDashboard();
    } catch {
      setError(
        "Could not send traffic to the backend."
      );
    } finally {
      setSending(false);
    }
  };


  const failServer = async (serverId) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/servers/${serverId}/fail`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error();
      }

      await refreshDashboard();
    } catch {
      setError(
        "Could not fail the selected server."
      );
    }
  };


  const recoverServer = async (serverId) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/servers/${serverId}/recover`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error();
      }

      await refreshDashboard();
    } catch {
      setError(
        "Could not recover the selected server."
      );
    }
  };


  useEffect(() => {
    refreshDashboard();

    const interval = setInterval(
      refreshDashboard,
      1000
    );

    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    if (!autoTraffic) {
      return;
    }

    const trafficInterval = setInterval(
      async () => {
        try {
          for (
            let i = 0;
            i < requestsPerSecond;
            i++
          ) {
            await fetch(
              "http://127.0.0.1:8000/request",
              {
                method: "POST",
              }
            );
          }

          await refreshDashboard();
        } catch {
          setError(
            "Auto traffic could not reach the backend."
          );
        }
      },
      1000
    );

    return () =>
      clearInterval(trafficInterval);
  }, [
    autoTraffic,
    requestsPerSecond,
  ]);


  const totalRequests =
    servers.reduce(
      (total, server) =>
        total + server.request_count,
      0
    );


  const healthyServers =
    servers.filter(
      (server) =>
        server.status === "healthy"
    ).length;


  const overloadedServers =
    servers.filter(
      (server) =>
        server.status === "overloaded"
    ).length;


  const failedServers =
    servers.filter(
      (server) =>
        server.status === "failed"
    ).length;


  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>DCInsight</h1>

          <p>
            Interactive datacenter simulation
            and infrastructure monitoring.
          </p>
        </div>

        <div className="live-badge">
          <span className="live-dot"></span>
          LIVE
        </div>
      </header>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <section className="traffic-controls">
        <div>
          <span className="control-label">
            TRAFFIC CONTROL
          </span>

          <h2>Generate Requests</h2>

          <p>
            Send simulated traffic through the
            Round Robin load balancer.
          </p>
        </div>

        <div className="traffic-buttons">
          <button
            onClick={() => sendRequests(1)}
            disabled={sending}
          >
            Send Request
          </button>

          <button
            className="secondary-button"
            onClick={() => sendRequests(10)}
            disabled={sending}
          >
            Send 10 Requests
          </button>
        </div>
      </section>

      <section className="auto-traffic-panel">
        <div className="auto-traffic-info">
          <span className="control-label">
            AUTO TRAFFIC
          </span>

          <h2>
            Continuous Request Generator
          </h2>

          <p>
            Automatically send traffic every
            second.
          </p>
        </div>

        <div className="auto-traffic-controls">
          <div className="rate-control">
            <label>
              Requests / second
            </label>

            <input
              type="range"
              min="1"
              max="10"
              value={requestsPerSecond}
              onChange={(event) =>
                setRequestsPerSecond(
                  Number(
                    event.target.value
                  )
                )
              }
            />

            <strong>
              {requestsPerSecond}
            </strong>
          </div>

          <button
            className={
              autoTraffic
                ? "stop-button"
                : "start-button"
            }
            onClick={() =>
              setAutoTraffic(
                !autoTraffic
              )
            }
          >
            {autoTraffic
              ? "Stop Auto Traffic"
              : "Start Auto Traffic"}
          </button>
        </div>
      </section>

      <section className="overview">
        <div className="overview-card">
          <span>Servers</span>
          <strong>{servers.length}</strong>
        </div>

        <div className="overview-card">
          <span>Healthy</span>
          <strong>{healthyServers}</strong>
        </div>

        <div className="overview-card">
          <span>Overloaded</span>
          <strong>{overloadedServers}</strong>
        </div>

        <div className="overview-card">
          <span>Failed</span>
          <strong>{failedServers}</strong>
        </div>

        <div className="overview-card">
          <span>Total Requests</span>
          <strong>{totalRequests}</strong>
        </div>
      </section>

      <section className="metrics-panel">
        <div className="metrics-header">
          <div>
            <span className="control-label">
              LIVE METRICS
            </span>

            <h2>Datacenter Performance</h2>
          </div>

          <span>
            Last 30 seconds
          </span>
        </div>

        <div className="charts-grid">
          <div className="chart-card">
            <h3>Average CPU</h3>

            <ResponsiveContainer
              width="100%"
              height={230}
            >
              <LineChart
                data={metricsHistory}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1d2c40"
                />

                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fontSize: 11 }}
                />

                <YAxis
                  domain={[0, 100]}
                  stroke="#64748b"
                  tick={{ fontSize: 11 }}
                />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  name="CPU %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Average Latency</h3>

            <ResponsiveContainer
              width="100%"
              height={230}
            >
              <LineChart
                data={metricsHistory}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1d2c40"
                />

                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fontSize: 11 }}
                />

                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 11 }}
                />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={false}
                  name="Latency ms"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="servers-section">
          <div className="section-title">
            <h2>Server Cluster</h2>

            <span>
              Round Robin Load Balancer
            </span>
          </div>

          <div className="server-grid">
            {servers.map((server) => (
              <div
                className={`server-card ${server.status}`}
                key={server.server_id}
              >
                <div className="server-card-header">
                  <div>
                    <span className="server-label">
                      SERVER
                    </span>

                    <h3>
                      Node {server.server_id}
                    </h3>
                  </div>

                  <div
                    className={`status-badge ${server.status}`}
                  >
                    {server.status}
                  </div>
                </div>

                <div className="metric">
                  <div className="metric-header">
                    <span>CPU</span>
                    <span>
                      {server.cpu_usage}%
                    </span>
                  </div>

                  <div className="metric-bar">
                    <div
                      className="metric-fill"
                      style={{
                        width: `${server.cpu_usage}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="metric">
                  <div className="metric-header">
                    <span>Memory</span>
                    <span>
                      {server.memory_usage}%
                    </span>
                  </div>

                  <div className="metric-bar">
                    <div
                      className="metric-fill"
                      style={{
                        width: `${server.memory_usage}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="server-stats">
                  <div>
                    <span>Latency</span>
                    <strong>
                      {server.latency.toFixed(1)} ms
                    </strong>
                  </div>

                  <div>
                    <span>Queue</span>
                    <strong>
                      {server.queue_length}
                    </strong>
                  </div>

                  <div>
                    <span>Requests</span>
                    <strong>
                      {server.request_count}
                    </strong>
                  </div>
                </div>

                <div className="server-actions">
                  {server.status === "failed" ? (
                    <button
                      className="recover-button"
                      onClick={() =>
                        recoverServer(
                          server.server_id
                        )
                      }
                    >
                      Recover Server
                    </button>
                  ) : (
                    <button
                      className="fail-button"
                      onClick={() =>
                        failServer(
                          server.server_id
                        )
                      }
                    >
                      Fail Server
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="incident-panel">
          <div className="incident-header">
            <div>
              <span className="control-label">
                EVENT STREAM
              </span>

              <h2>Incident Timeline</h2>
            </div>

            <span className="event-count">
              {events.length}
            </span>
          </div>

          <div className="incident-list">
            {events.length === 0 ? (
              <div className="empty-events">
                No events recorded yet.
              </div>
            ) : (
              events.map((event, index) => (
                <div
                  className="incident-item"
                  key={`${event.time}-${index}`}
                >
                  <div
                    className={`event-dot ${event.type}`}
                  ></div>

                  <div className="incident-content">
                    <div className="incident-meta">
                      <span
                        className={`event-type ${event.type}`}
                      >
                        {event.type.replace(
                          "_",
                          " "
                        )}
                      </span>

                      <span className="event-time">
                        {event.time}
                      </span>
                    </div>

                    <p>
                      {event.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}


export default App;
