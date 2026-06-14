from pathlib import Path

from fastapi import FastAPI, Form, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from database import get_db, engine, Base
from models import Photo, Face, RecognitionEvent
import face_recognition
import base64
from io import BytesIO
from PIL import Image
import json
import numpy as np

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Raspberry Pi Photo API", description="API for handling photos from Raspberry Pi with face recognition", version="1.0.0")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def home():
    return FileResponse(STATIC_DIR / "index.html")

@app.post("/upload_photo")
async def upload_photo(image_base64: str = Form(...), metadata: str = Form(...), db: Session = Depends(get_db)):
    """
    Upload a photo with base64 image and metadata.
    Metadata should be a JSON string, e.g., {"timestamp": "2023-10-01T12:00:00", "event": "doorbell"}
    """
    try:
        metadata_dict = json.loads(metadata)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid metadata JSON") from exc

    photo = Photo(image_base64=image_base64, photo_metadata=metadata_dict)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return {"message": "Photo uploaded successfully", "photo_id": photo.id}

@app.post("/register_face")
async def register_face(name: str = Form(...), image_base64: str = Form(...), db: Session = Depends(get_db)):
    """
    Register a face by uploading an image. Extracts face encoding and stores it.
    """
    try:
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))
        image_np = np.array(image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(exc)}") from exc

    face_encodings = face_recognition.face_encodings(image_np)
    if not face_encodings:
        raise HTTPException(status_code=400, detail="No face detected in the image")

    encoding = face_encodings[0]  # Assume one face
    encoding_str = json.dumps(encoding.tolist())

    face = Face(name=name, encoding=encoding_str)
    db.add(face)
    db.commit()
    db.refresh(face)
    return {"message": f"Face registered for {name}", "face_id": face.id}

@app.post("/recognize_face")
async def recognize_face(image_base64: str = Form(...), db: Session = Depends(get_db)):
    """
    Recognize faces in an uploaded image by comparing with registered faces.
    Returns a message for each detected face and a summary for the image.
    """
    try:
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))
        image_np = np.array(image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(exc)}") from exc

    face_locations = face_recognition.face_locations(image_np)
    face_encodings = face_recognition.face_encodings(image_np, face_locations)
    if not face_encodings:
        payload = {
            "message": "Nenhuma pessoa detectada na imagem",
            "faces": [],
            "recognized": []
        }
        db.add(RecognitionEvent(image_base64=image_base64, recognition_result=payload))
        db.commit()
        return payload

    registered_faces = db.query(Face).all()
    known_encodings = []
    known_names = []
    for face in registered_faces:
        encoding = np.array(json.loads(face.encoding))
        known_encodings.append(encoding)
        known_names.append(face.name)

    results = []
    for encoding in face_encodings:
        if not known_encodings:
            results.append({
                "status": "unrecognized",
                "message": "Tem uma pessoa, mas nao identifiquei"
            })
            continue

        matches = face_recognition.compare_faces(known_encodings, encoding, tolerance=0.6)
        face_distances = face_recognition.face_distance(known_encodings, encoding)
        best_match_index = np.argmin(face_distances)
        if matches[best_match_index]:
            name = known_names[best_match_index]
            confidence = float(1 - face_distances[best_match_index])
            results.append({
                "status": "recognized",
                "name": name,
                "confidence": confidence,
                "message": f"Pessoa identificada: {name}"
            })
        else:
            results.append({
                "status": "unrecognized",
                "message": "Tem uma pessoa, mas nao identifiquei"
            })

    recognized = [face for face in results if face["status"] == "recognized"]
    if recognized and len(recognized) == len(results):
        summary_message = "Pessoa identificada"
    elif recognized:
        summary_message = "Pessoa identificada, mas ha alguem nao identificado"
    else:
        summary_message = "Tem uma pessoa, mas nao identifiquei"

    payload = {
        "message": summary_message,
        "faces": results,
        "recognized": recognized
    }

    db.add(RecognitionEvent(image_base64=image_base64, recognition_result=payload))
    db.commit()
    return payload

@app.get("/photos")
async def get_photos(db: Session = Depends(get_db)):
    """
    Get all uploaded photos.
    """
    photos = db.query(Photo).order_by(Photo.created_at.desc()).all()
    return [{"id": p.id, "image_base64": p.image_base64, "photo_metadata": p.photo_metadata, "created_at": p.created_at} for p in photos]

@app.get("/faces")
async def get_faces(db: Session = Depends(get_db)):
    """
    Get all registered faces.
    """
    faces = db.query(Face).all()
    return [{"id": f.id, "name": f.name, "created_at": f.created_at} for f in faces]


@app.get("/recognitions")
async def get_recognitions(db: Session = Depends(get_db)):
    events = db.query(RecognitionEvent).order_by(RecognitionEvent.created_at.desc()).all()
    return [
        {
            "id": event.id,
            "image_base64": event.image_base64,
            "recognition_result": event.recognition_result,
            "created_at": event.created_at,
        }
        for event in events
    ]