import { useEffect, useState } from "react";
import "./App.css";


function App() {
  const [servers, setServers] = useState([]);
  const [error, setError] = useState("");


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
    } catch {
      setError(
        "Could not connect to the DCInsight backend."
      );
    }
  };


  useEffect(() => {
    fetchServers();

    const interval = setInterval(
      fetchServers,
      1000
    );

    return () => clearInterval(interval);
  }, []);


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

      <section className="overview">
        <div className="overview-card">
          <span>Servers</span>
          <strong>
            {servers.length}
          </strong>
        </div>

        <div className="overview-card">
          <span>Healthy</span>
          <strong>
            {
              servers.filter(
                (server) =>
                  server.status === "healthy"
              ).length
            }
          </strong>
        </div>

        <div className="overview-card">
          <span>Overloaded</span>
          <strong>
            {
              servers.filter(
                (server) =>
                  server.status === "overloaded"
              ).length
            }
          </strong>
        </div>

        <div className="overview-card">
          <span>Total Requests</span>
          <strong>
            {
              servers.reduce(
                (total, server) =>
                  total + server.request_count,
                0
              )
            }
          </strong>
        </div>
      </section>

      <section className="servers-section">
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
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}


export default App;
