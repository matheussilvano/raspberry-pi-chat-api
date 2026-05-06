from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from sqlalchemy.sql import func
from database import Base
import json

class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    image_base64 = Column(Text, nullable=False)
    photo_metadata = Column(JSON, nullable=False)  # e.g., {"timestamp": "2023-10-01T12:00:00", "location": "door"}
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Face(Base):
    __tablename__ = "faces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    encoding = Column(Text, nullable=False)  # JSON string of face encoding
    created_at = Column(DateTime(timezone=True), server_default=func.now())