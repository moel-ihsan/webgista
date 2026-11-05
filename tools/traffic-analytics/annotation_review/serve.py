#!/usr/bin/env python3
"""Serve the local-only review tool and checked-in demo assets."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
from email.utils import formatdate
import os

ROOT = Path(__file__).resolve().parents[3]
HOST, PORT = '127.0.0.1', 8765


def parse_byte_range(value, size):
    if not value:
        return None
    match = re.fullmatch(r'bytes=(\d*)-(\d*)', value.strip())
    if not match or size <= 0 or not any(match.groups()):
        raise ValueError('invalid byte range')
    first, last = match.groups()
    if not first:
        length = int(last)
        if length <= 0:
            raise ValueError('invalid suffix range')
        return max(0, size - length), size - 1
    start = int(first)
    end = min(int(last), size - 1) if last else size - 1
    if start >= size or end < start:
        raise ValueError('unsatisfiable byte range')
    return start, end


class RangeRequestHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            source = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None
        size = os.fstat(source.fileno()).st_size
        try:
            byte_range = parse_byte_range(self.headers.get('Range'), size)
        except ValueError:
            source.close()
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return None
        start, end = byte_range if byte_range else (0, size - 1)
        source.seek(start)
        self._response_bytes_left = max(0, end - start + 1)
        self.send_response(206 if byte_range else 200)
        self.send_header('Content-type', self.guess_type(path))
        self.send_header('Content-Length', str(self._response_bytes_left))
        self.send_header('Last-Modified', formatdate(os.fstat(source.fileno()).st_mtime, usegmt=True))
        self.send_header('Accept-Ranges', 'bytes')
        if byte_range:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        return source

    def copyfile(self, source, outputfile):
        if not hasattr(self, '_response_bytes_left'):
            return super().copyfile(source, outputfile)
        remaining = self._response_bytes_left
        while remaining:
            block = source.read(min(64 * 1024, remaining))
            if not block:
                break
            outputfile.write(block)
            remaining -= len(block)


if __name__ == '__main__':
    server = ThreadingHTTPServer((HOST, PORT), partial(RangeRequestHandler, directory=str(ROOT)))
    print(f'Open http://{HOST}:{PORT}/tools/traffic-analytics/annotation_review/')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
