# Raspberry Pi Photo API

This is a FastAPI application for handling photos from a Raspberry Pi, including face registration and recognition using PostgreSQL as the database.

## Features

- Upload photos with base64 encoding and metadata
- Register faces for recognition
- Recognize faces in uploaded images
- Automatic Swagger documentation at `/docs`

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Set up PostgreSQL database and update `.env` with your DATABASE_URL.

3. Create the database tables:
   ```
   python -c "from database import Base, engine; Base.metadata.create_all(bind=engine)"
   ```

4. Run the server:
   ```
   uvicorn main:app --reload
   ```

5. Access the API documentation at `http://localhost:8000/docs`

## Endpoints

- `POST /upload_photo`: Upload a photo with base64 image and JSON metadata.
- `POST /register_face`: Register a face by uploading an image.
- `POST /recognize_face`: Recognize faces in an uploaded image.
- `GET /photos`: Retrieve all uploaded photos.
- `GET /faces`: Retrieve all registered faces.

## Usage with Raspberry Pi

The Raspberry Pi can send POST requests to `/upload_photo` with the photo in base64 and metadata like timestamp and event type.