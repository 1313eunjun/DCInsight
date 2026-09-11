import random
import time


class Server:
    def __init__(self, server_id):
        self.server_id = server_id
        self.request_count = 0

        self.cpu_usage = 10
        self.memory_usage = 20
        self.latency = 20

        self.queue_length = 0

        self.status = "healthy"

    def handle_request(self):
        if self.status != "healthy":
            return

        self.request_count += 1

        self.queue_length += random.randint(
            0,
            3
        )

        self.cpu_usage = min(
            100,
            self.cpu_usage
            + random.randint(5, 12)
            + self.queue_length
        )

        self.memory_usage = min(
            100,
            self.memory_usage
            + random.randint(1, 5)
        )

        self.update_latency()
        self.update_status()

    def cool_down(self):
        if self.status == "failed":
            return

        if self.queue_length > 0:
            self.queue_length -= 1

        self.cpu_usage = max(
            10,
            self.cpu_usage
            - random.randint(3, 8)
        )

        self.memory_usage = max(
            20,
            self.memory_usage
            - random.randint(0, 3)
        )

        self.update_latency()
        self.update_status()

    def update_latency(self):
        self.latency = (
            20
            + self.cpu_usage * 0.4
            + self.queue_length * 5
        )

    def update_status(self):
        if self.status == "failed":
            return

        if (
            self.cpu_usage >= 90
            or self.queue_length >= 10
        ):
            self.status = "overloaded"
        else:
            self.status = "healthy"

    def fail(self):
        self.status = "failed"

        print(
            f"\nServer {self.server_id} FAILED\n"
        )

    def recover(self):
        self.status = "healthy"

        self.cpu_usage = 10
        self.memory_usage = 20
        self.latency = 20
        self.queue_length = 0

        print(
            f"\nServer {self.server_id} RECOVERED\n"
        )

    def display_status(self):
        print(
            f"Server {self.server_id} | "
            f"Requests: {self.request_count} | "
            f"CPU: {self.cpu_usage}% | "
            f"Memory: {self.memory_usage}% | "
            f"Queue: {self.queue_length} | "
            f"Latency: {self.latency:.1f} ms | "
            f"Status: {self.status}"
        )


class LoadBalancer:
    def __init__(self, servers):
        self.servers = servers
        self.current_index = 0

    def route_request(self):
        attempts = 0

        while attempts < len(self.servers):
            server = self.servers[
                self.current_index
            ]

            self.current_index += 1

            if self.current_index >= len(
                self.servers
            ):
                self.current_index = 0

            if server.status == "healthy":
                server.handle_request()
                return

            attempts += 1

        print(
            "No healthy servers available"
        )


def display_datacenter(servers):
    print("\n--- Datacenter Status ---")

    for server in servers:
        server.display_status()

    print("-------------------------\n")


if __name__ == "__main__":
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

    for tick in range(1, 21):
        print(
            f"=== Simulation Tick {tick} ==="
        )

        requests_this_tick = random.randint(
            1,
            5
        )

        print(
            f"Incoming requests: "
            f"{requests_this_tick}"
        )

        for _ in range(
            requests_this_tick
        ):
            load_balancer.route_request()

        for server in servers:
            server.cool_down()

        display_datacenter(
            servers
        )

        time.sleep(0.5)
