#!/bin/bash

# Get the current date and time to the second and assign it to a variable
current_datetime=$(date +"%Y-%m-%d %H:%M:%S")

pip freeze > requirements.txt
# Deactivate the virtual environment if it is active
if [[ "$VIRTUAL_ENV" != "" ]]; then
    deactivate
fi
# Remove the virtual environment directory
rm -rf env

echo "Virtual environment 'env' has been removed."
# Create or open the .gitignore file and add .env to it
echo ".env" > .gitignore

# Remove .env from tracking if it was already tracked
git rm --cached .env

# Commit the changes
git add .gitignore
git commit -m "Add .env to .gitignore and remove it from tracking at $current_datetime"

# Push the changes to the remote repository
git push origin main
git add .
git commit -m "committing change at $current_datetime"
git push origin main

