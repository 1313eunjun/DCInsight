import asyncio
import time

from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from simulation import Server, LoadBalancer


MIN_SERVERS = 3
MAX_SERVERS = 6

SCALE_OUT_CPU_THRESHOLD = 75
SCALE_OUT_QUEUE_THRESHOLD = 6

SCALE_IN_CPU_THRESHOLD = 35
SCALE_IN_QUEUE_THRESHOLD = 1

SCALE_OUT_COOLDOWN = 5
SCALE_IN_COOLDOWN = 8

LOW_LOAD_REQUIRED_TICKS = 5


servers = [
    Server(1),
    Server(2),
    Server(3),
]

load_balancer = LoadBalancer(
    servers
)

next_server_id = 4

last_scale_out_time = 0
last_scale_in_time = 0

low_load_ticks = 0

events = []


def add_event(event_type, message):
    events.insert(
        0,
        {
            "time": datetime.now().strftime(
                "%H:%M:%S"
            ),
            "type": event_type,
            "message": message,
        }
    )

    if len(events) > 100:
        events.pop()


def get_active_servers():
    return [
        server
        for server in servers
        if server.status != "failed"
    ]


def get_average_cpu(active_servers):
    if not active_servers:
        return 0

    return sum(
        server.cpu_usage
        for server in active_servers
    ) / len(active_servers)


def get_average_queue(active_servers):
    if not active_servers:
        return 0

    return sum(
        server.queue_length
        for server in active_servers
    ) / len(active_servers)


def maybe_scale_out():
    global next_server_id
    global last_scale_out_time
    global low_load_ticks

    active_servers = get_active_servers()

    if not active_servers:
        return

    if len(servers) >= MAX_SERVERS:
        return

    current_time = time.time()

    time_since_last_scale_out = (
        current_time
        - last_scale_out_time
    )

    if (
        time_since_last_scale_out
        < SCALE_OUT_COOLDOWN
    ):
        return

    average_cpu = get_average_cpu(
        active_servers
    )

    average_queue = get_average_queue(
        active_servers
    )

    if (
        average_cpu
        >= SCALE_OUT_CPU_THRESHOLD
        or
        average_queue
        >= SCALE_OUT_QUEUE_THRESHOLD
    ):
        new_server = Server(
            next_server_id
        )

        servers.append(
            new_server
        )

        add_event(
            "scale_out",
            (
                f"Server {new_server.server_id} "
                f"added by autoscaler"
            ),
        )

        next_server_id += 1

        last_scale_out_time = (
            current_time
        )

        low_load_ticks = 0


def maybe_scale_in():
    global last_scale_in_time
    global low_load_ticks

    if len(servers) <= MIN_SERVERS:
        low_load_ticks = 0
        return

    active_servers = get_active_servers()

    if not active_servers:
        low_load_ticks = 0
        return

    average_cpu = get_average_cpu(
        active_servers
    )

    average_queue = get_average_queue(
        active_servers
    )

    low_load = (
        average_cpu
        <= SCALE_IN_CPU_THRESHOLD
        and
        average_queue
        <= SCALE_IN_QUEUE_THRESHOLD
    )

    if low_load:
        low_load_ticks += 1
    else:
        low_load_ticks = 0
        return

    if (
        low_load_ticks
        < LOW_LOAD_REQUIRED_TICKS
    ):
        return

    current_time = time.time()

    time_since_last_scale_in = (
        current_time
        - last_scale_in_time
    )

    if (
        time_since_last_scale_in
        < SCALE_IN_COOLDOWN
    ):
        return

    removable_server = None

    for server in reversed(servers):
        if (
            server.status == "healthy"
            and
            server.queue_length == 0
        ):
            removable_server = server
            break

    if removable_server is None:
        return

    servers.remove(
        removable_server
    )

    add_event(
        "scale_in",
        (
            f"Server {removable_server.server_id} "
            f"removed after low load"
        ),
    )

    last_scale_in_time = (
        current_time
    )

    low_load_ticks = 0


async def simulation_loop():
    while True:
        await asyncio.sleep(1)

        for server in servers:
            server.cool_down()

        maybe_scale_out()
        maybe_scale_in()


@asynccontextmanager
async def lifespan(app: FastAPI):
    add_event(
        "system",
        "DCInsight simulation started",
    )

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


@app.get("/events")
def get_events():
    return events


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

            add_event(
                "failure",
                f"Server {server_id} failed",
            )

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

            add_event(
                "recovery",
                f"Server {server_id} recovered",
            )

            return {
                "message":
                    f"Server {server_id} recovered"
            }

    return {
        "message":
            "Server not found"
    }
