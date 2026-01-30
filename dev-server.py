#!/usr/bin/env python3
"""
Simple HTTP server with logging endpoint for development
Logs from browser will be written to debug.log file
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import sys
from datetime import datetime

class LoggingHTTPRequestHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/log':
            # Read the POST data
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                log_data = json.loads(post_data.decode('utf-8'))
                timestamp = datetime.now().isoformat()
                log_message = f"[{timestamp}] {log_data.get('level', 'LOG')}: {log_data.get('message', '')}\n"
                
                # Write to debug.log
                with open('debug.log', 'a') as f:
                    f.write(log_message)
                
                # Also print to terminal
                print(log_message, end='')
                
                # Send response
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}')
            except Exception as e:
                print(f"Error logging: {e}")
                self.send_response(500)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, LoggingHTTPRequestHandler)
    print(f'Starting development server on port {port}...')
    print(f'Browser logs will be written to debug.log and shown here')
    httpd.serve_forever()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run(port)
