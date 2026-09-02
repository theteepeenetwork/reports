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


class Server(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    with Server(('127.0.0.1', PORT), QuietHandler) as httpd:
        httpd.serve_forever()
