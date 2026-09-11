from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from simulation import Server, LoadBalancer


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


server1 = Server(1)
server2 = Server(2)
server3 = Server(3)

servers = [
    server1,
    server2,
    server3,
]

load_balancer = LoadBalancer(
    servers
)


@app.get("/")
def root():
    return {
        "message": "DCInsight backend is running"
    }


@app.get("/servers")
def get_servers():
    return [
        {
            "server_id": server.server_id,
            "request_count": server.request_count,
            "cpu_usage": server.cpu_usage,
            "memory_usage": server.memory_usage,
            "queue_length": server.queue_length,
            "latency": server.latency,
            "status": server.status,
        }
        for server in servers
    ]


@app.post("/request")
def send_request():
    load_balancer.route_request()

    for server in servers:
        server.cool_down()

    return {
        "message": "Request processed"
    }
