# Agent Chat Application

A full-stack application with a Next.js frontend and Python FastAPI backend.

## Project Structure

- `/backend` - Python FastAPI backend code
  - `api.py` - Main API endpoints
  - `agent_backend.py` - Agent implementation logic
  - `requirements.txt` - Python dependencies

- `/frontend` - Next.js frontend application

## Setup Instructions

### Backend

```bash
cd backend
pip install -r requirements.txt
python api.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Deployment

- Backend: Deployed on AWS EC2
- Frontend: Deployed on Vercel at https://content-creator-coral.vercel.app
