#!/bin/bash

# Check if a virtual environment is currently active
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "No virtual environment is currently active."
else
    # Deactivate the virtual environment
    deactivate
    echo "Virtual environment deactivated."
fi

# Specify the virtual environment folder if needed (or assume current directory)
VENV_DIR=${1:-"env"}  # default to "venv" folder if not specified

# Check if the specified virtual environment directory exists
if [ -d "$VENV_DIR" ]; then
    echo "Cleaning up virtual environment files in $VENV_DIR..."
    rm -rf "$VENV_DIR"
    echo "Environment files removed."
else
    echo "Specified environment directory '$VENV_DIR' does not exist."
fi

VENV_DIR=${1:-"__pycache__"}  # default to "venv" folder if not specified

# Check if the specified virtual environment directory exists
if [ -d "$VENV_DIR" ]; then
    echo "Cleaning up virtual environment files in $VENV_DIR..."
    rm -rf "$VENV_DIR"
    echo "Environment files removed."
else
    echo "Specified environment directory '$VENV_DIR' does not exist."
fi