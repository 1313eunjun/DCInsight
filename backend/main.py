import asyncio

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from simulation import Server, LoadBalancer


servers = [
    Server(1),
    Server(2),
    Server(3),
]

load_balancer = LoadBalancer(
    servers
)

next_server_id = 4


def maybe_scale_out():
    global next_server_id

    active_servers = [
        server
        for server in servers
        if server.status != "failed"
    ]

    if not active_servers:
        return

    average_cpu = sum(
        server.cpu_usage
        for server in active_servers
    ) / len(active_servers)

    average_queue = sum(
        server.queue_length
        for server in active_servers
    ) / len(active_servers)

    if (
        average_cpu >= 75
        or average_queue >= 6
    ):
        if len(servers) < 6:
            new_server = Server(
                next_server_id
            )

            servers.append(
                new_server
            )

            print(
                f"Autoscaler added "
                f"Server {new_server.server_id}"
            )

            next_server_id += 1


async def simulation_loop():
    while True:
        await asyncio.sleep(1)

        for server in servers:
            server.cool_down()

        maybe_scale_out()


@asynccontextmanager
async def lifespan(app: FastAPI):
    simulation_task = asyncio.create_task(
        simulation_loop()
    )

    yield

    simulation_task.cancel()

    try:
        await simulation_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message":
            "DCInsight backend is running"
    }


@app.get("/servers")
def get_servers():
    return [
        {
            "server_id":
                server.server_id,

            "request_count":
                server.request_count,

            "cpu_usage":
                server.cpu_usage,

            "memory_usage":
                server.memory_usage,

            "queue_length":
                server.queue_length,

            "latency":
                server.latency,

            "status":
                server.status,
        }
        for server in servers
    ]


@app.post("/request")
def send_request():
    load_balancer.route_request()

    maybe_scale_out()

    return {
        "message":
            "Request processed"
    }


@app.post(
    "/servers/{server_id}/fail"
)
def fail_server(server_id: int):
    for server in servers:
        if (
            server.server_id
            == server_id
        ):
            server.fail()

            return {
                "message":
                    f"Server {server_id} failed"
            }

    return {
        "message":
            "Server not found"
    }


@app.post(
    "/servers/{server_id}/recover"
)
def recover_server(server_id: int):
    for server in servers:
        if (
            server.server_id
            == server_id
        ):
            server.recover()

            return {
                "message":
                    f"Server {server_id} recovered"
            }

    return {
        "message":
            "Server not found"
    }
