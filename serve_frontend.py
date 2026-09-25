import http.server
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
ROUTES = {
    "/": "index.html",
    "/login": "login.html",
    "/register": "register.html",
    "/dashboard": "dashboard.html",
    "/admin": "admin.html",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        if path.startswith("/static/"):
            path = path[len("/static"):]
        return super().translate_path(path)

    def do_GET(self):
        clean = self.path.split("?", 1)[0].split("#", 1)[0]
        if clean in ROUTES:
            self.path = "/" + ROUTES[clean]
        elif not os.path.splitext(clean)[1] and os.path.exists(
            os.path.join(ROOT, clean + ".html")
        ):
            self.path = clean + ".html"
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler) as srv:
        print(f"Frontend en http://localhost:{port}")
        srv.serve_forever()
