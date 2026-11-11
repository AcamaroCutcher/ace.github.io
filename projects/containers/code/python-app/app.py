"""A tiny web app: the smallest thing worth putting in a container (lesson 03)."""
import os
import platform
import socket

from flask import Flask

app = Flask(__name__)


@app.get("/")
def home():
    return {
        "message": os.environ.get("GREETING", "Hello from a container"),
        "hostname": socket.gethostname(),  # inside Docker this is the container ID
        "python": platform.python_version(),
    }


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
