# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend Runtime
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend dist to the location expected by backend/app/main.py
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Default environment configuration
ENV PORT=8000
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

EXPOSE 8000

# Run FastAPI backend using Uvicorn
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
