# Start with a lightweight official Python image
FROM python:3.12-slim

# Set the working directory inside the container
WORKDIR /app

# Update package lists and install Tesseract AND its key dependency
# ADDED libgl1-mesa-glx TO FIX THE PATH ISSUE
RUN apt-get update && apt-get install -y tesseract-ocr libgl1-mesa-glx

# Copy your requirements file into the container
COPY requirements.txt .

# Install your Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend application code into the container
COPY . .

# The CMD to run the app will be handled by Render's Start Command