from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

class Message(BaseModel):
    role: str # "user", "assistant", "system"
    content: Union[str, List[Dict[str, Any]]]

class ChatRequest(BaseModel):
    endpoint: str = Field(..., description="Target server endpoint, e.g. https://api.openai.com/v1 or custom server")
    api_key: Optional[str] = Field(None, description="API Key for authorization")
    model: str = Field(..., description="Model name, e.g. qwen3.8")
    messages: List[Message]
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    max_tokens: Optional[int] = None
    stream: bool = True
    web_search: Optional[bool] = False

class TestConnectionRequest(BaseModel):
    endpoint: str
    api_key: Optional[str] = None
    model: Optional[str] = None

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    models: Optional[List[str]] = None

class ModelsRequest(BaseModel):
    endpoint: str
    api_key: Optional[str] = None

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    display_name: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class AuthUser(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    created_at: Optional[str] = None

class AuthResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    user: Optional[AuthUser] = None
    message: Optional[str] = None
