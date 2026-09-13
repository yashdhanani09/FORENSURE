from pydantic import BaseModel


class SystemStatus(BaseModel):
    platform_supported: bool
    device_detection_available: bool
    message: str

