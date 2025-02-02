#!/bin/bash

# Activate virtual environment if exists
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated."
else
    echo "⚠️ No virtual environment found. Running without venv."
fi

# Set environment variables
export FLASK_APP=app.py
export FLASK_ENV=development

# Run Flask application
echo "🚀 Starting Flask server..."
flask run --host=0.0.0.0 --port=8080
