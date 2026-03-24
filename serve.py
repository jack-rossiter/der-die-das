"""Serve the PWA on the local network so an iPhone can reach it."""

import functools
import http.server
import os
import socket
import socketserver


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Suppress noisy connection-reset tracebacks and favicon 404s."""

    def log_message(self, fmt, *args):
        # args[0] is the request line, e.g. "GET /favicon.ico HTTP/1.1"
        if len(args) >= 1 and "favicon.ico" in str(args[0]):
            return
        super().log_message(fmt, *args)

    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, BrokenPipeError):
            pass


def main():
    port = 8000
    directory = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

    handler = functools.partial(QuietHandler, directory=directory)

    class ReusableServer(http.server.HTTPServer):
        allow_reuse_address = True

    server = ReusableServer(("0.0.0.0", port), handler)

    ip = get_local_ip()
    print(f"Serving on:")
    print(f"  Local:   http://localhost:{port}")
    print(f"  Network: http://{ip}:{port}")
    print(f"\nOpen the Network URL on your iPhone, then use")
    print(f"Share → Add to Home Screen to install the app.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
