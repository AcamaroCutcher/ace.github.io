# Dockerfile for the tiny Flask app (lesson 03)
FROM python:3.13-slim

# don't write .pyc files, and print logs straight away
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

# 1) dependencies first: this layer stays cached until requirements.txt changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2) then the code, which changes often
COPY app.py .

# run as an ordinary user, not root
RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
