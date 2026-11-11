# A sandboxed AI agent (lesson 06)
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agent.py .
RUN useradd --create-home agent
USER agent
WORKDIR /workspace
ENTRYPOINT ["python", "/app/agent.py"]
