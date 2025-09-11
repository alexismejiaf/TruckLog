#!/usr/bin/env bash
# Render.com deployment script

set -o errexit  # exit on error

# Install Python dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --no-input

# Apply database migrations
python manage.py migrate
