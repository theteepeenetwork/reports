#!/usr/bin/env python3
"""Quiet static file server for the test suite.
Owner: QA (docs/OWNERSHIP.md)

`python3 -m http.server` logs every request — a few hundred lines per run,
which buries the actual test results. It logs those to STDERR, not stdout,
so silencing them via Playwright's webServer.stdout does nothing. Overriding
log_message here drops the access log while leaving real errors (a port
clash, a traceback) on stderr where Playwright will surface them.
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # access log only — log_error still writes to stderr


class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    # Threaded with a deep backlog: Playwright's parallel workers (desk + class
    # projects, fullyParallel) open many connections at once. A single-threaded
    # server with the default backlog of 5 makes macOS reset the overflow
    # (ERR_CONNECTION_RESET / ERR_SOCKET_NOT_CONNECTED on js/css), so pages
    # never finish loading and specs time out in their open() helpers.
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128


if __name__ == '__main__':
    with Server(('127.0.0.1', PORT), QuietHandler) as httpd:
        httpd.serve_forever()
