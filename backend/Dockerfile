FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Make startup script executable and prepare storage directory
RUN chmod +x /app/start.sh && mkdir -p /app/storage && chmod 700 /app/storage

# Non-root user for security
RUN useradd -m -u 1001 trustvault && chown -R trustvault:trustvault /app
USER trustvault

EXPOSE 8000

CMD ["/app/start.sh"]

