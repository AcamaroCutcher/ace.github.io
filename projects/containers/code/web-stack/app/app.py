"""Visit counter: Flask + PostgreSQL, run together with Docker Compose (lesson 05)."""
import os

import psycopg
from flask import Flask

app = Flask(__name__)
DSN = os.environ["DATABASE_URL"]  # postgresql://app:PASSWORD@db:5432/app ("db" is the service name)


def connect():
    return psycopg.connect(DSN, autocommit=True)


# runs once at start-up (gunicorn --preload imports this file once, before forking workers)
with connect() as conn:
    conn.execute("CREATE TABLE IF NOT EXISTS visits (id serial PRIMARY KEY, at timestamptz DEFAULT now())")


@app.get("/")
def home():
    with connect() as conn:
        conn.execute("INSERT INTO visits DEFAULT VALUES")
        (count,) = conn.execute("SELECT count(*) FROM visits").fetchone()
    return f"<h1>Hello!</h1><p>This page has been visited {count} times.</p>"


@app.get("/health")
def health():
    return {"ok": True}
