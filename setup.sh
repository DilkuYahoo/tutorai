#!/bin/bash

# Create a virtual environment named 'env'
python3 -m venv env

# Activate the virtual environment
source env/bin/activate

# Install the required modules from requirements.txt
if [ -f requirements.txt ]; then
    pip install -r requirements.txt
else
    echo "requirements.txt file not found!"
fi

echo "Python environment setup complete and requirements installed."



