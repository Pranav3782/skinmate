# Use the full Python image for better compatibility
FROM python:3.12

# Set the working directory
WORKDIR /app

# Update system packages and install Tesseract with the English language pack
RUN apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-eng

# Copy and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .
