from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from app.db.base import Base

class SOSAlert(Base):
    __tablename__ = "sos_alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fisherman_id = Column(Integer, ForeignKey("fishermen.id", ondelete="SET NULL"), nullable=True)
    boat_id = Column(Integer, ForeignKey("boats.id", ondelete="SET NULL"), nullable=True)
    
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location = Column(Geography(geometry_type='POINT', srid=4326, spatial_index=False), nullable=False)
    
    emergency_type = Column(String(100), nullable=False)  # Medical, Engine Failure, Capsizing, Storm/Stranded, Fire, Collision, Other
    description = Column(String(1000), nullable=True)
    people_affected = Column(Integer, default=1, nullable=False)
    priority = Column(String(50), default="CRITICAL", nullable=False)  # CRITICAL, HIGH, MEDIUM, LOW
    status = Column(String(50), default="NEW", nullable=False)  # NEW, ACKNOWLEDGED, RESCUE_ASSIGNED, RESCUE_IN_PROGRESS, RESOLVED, CANCELLED, FALSE_ALARM
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    fisherman = relationship("Fisherman")
    boat = relationship("Boat")
    rescue_mission = relationship("RescueMission", back_populates="sos_alert", uselist=False)
