#!/bin/bash

# Set OpenAI API key if not already set
if [ -z "$OPENAI_API_KEY" ]; then
  echo "OPENAI_API_KEY is not set. Please set it before running this script."
  echo "Example: export OPENAI_API_KEY=your_api_key_here"
  exit 1
fi

# Run the FastAPI backend
echo "Starting Agentica AI backend server..."
uvicorn api:app --reload --host 0.0.0.0 --port 8000