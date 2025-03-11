"""
API for Agentica AI using FastAPI.
This module provides API endpoints that connect the frontend to the LangGraph agent.
"""

import os
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from agent_backend import (
    initialize_state, 
    process_message, 
    PERSONALITY_PRESETS, 
    scrape_website, 
    summarize_background_from_content
)

# Create the FastAPI app
app = FastAPI(title="Agentica AI API")

# Add CORS middleware to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://content-creator-khaki.vercel.app",  # Production Vercel domain
        "http://localhost:3000",                     # Local development
        "https://localhost:3000"                     # Local development with HTTPS
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
print("CORS middleware configured for specific domains")

# Store chat sessions in memory (would use a database in production)
chat_sessions = {}

# Models for API requests and responses
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatSession(BaseModel):
    session_id: str
    messages: List[ChatMessage]
    title: Optional[str] = None
    createdAt: Optional[str] = None
    lastMessageAt: Optional[str] = None

class PersonalitySettings(BaseModel):
    type: str = "Balanced"
    custom: Optional[Dict] = None

class BackgroundInfo(BaseModel):
    items: List[str] = []

class ToolSettings(BaseModel):
    background_search: bool = True
    memory_storage: bool = True
    memory_retrieval: bool = True
    web_search: bool = False

class OrganizationSettings(BaseModel):
    name: str = "Agentica AI"
    personality: PersonalitySettings = PersonalitySettings()
    background: BackgroundInfo = BackgroundInfo()
    tools: ToolSettings = ToolSettings()

class MessageRequest(BaseModel):
    session_id: str
    message: str

class MessageResponse(BaseModel):
    session_id: str
    response: str

class SessionRequest(BaseModel):
    organization: OrganizationSettings = OrganizationSettings()

class SessionResponse(BaseModel):
    session_id: str
    message: str

class PersonalityListResponse(BaseModel):
    presets: Dict
    
class WebsiteScrapeRequest(BaseModel):
    url: str
    max_pages: int = 5
    max_items: int = 10
    
class WebsiteScrapeResponse(BaseModel):
    status: str
    message: str
    background_items: Optional[List[str]] = None

# Routes
@app.get("/")
async def root():
    """Root endpoint for API health check."""
    return {"status": "online", "service": "Agentica AI API"}

@app.get("/personalities", response_model=PersonalityListResponse)
async def get_personalities():
    """Get list of available personality presets."""
    return {"presets": PERSONALITY_PRESETS}

@app.post("/sessions", response_model=SessionResponse)
async def create_session(request: SessionRequest):
    """Create a new chat session with specified organization settings."""
    print("Received session creation request:", request)  # Debug logging
    
    # Generate a new session ID
    import uuid
    from datetime import datetime
    
    # Create ISO format timestamps
    current_time = datetime.now().isoformat()
    
    session_id = str(uuid.uuid4())
    print(f"Generated session ID: {session_id}")  # Debug logging
    
    # Initialize state with organization settings and tool settings
    tools_config = {
        "background_search": request.organization.tools.background_search,
        "memory_storage": request.organization.tools.memory_storage,
        "memory_retrieval": request.organization.tools.memory_retrieval,
        "web_search": request.organization.tools.web_search
    }
    
    print(f"Tool settings: {tools_config}")  # Debug logging
    
    state = initialize_state(
        personality_type=request.organization.personality.type,
        custom_personality=request.organization.personality.custom,
        background_info=request.organization.background.items,
        organization_name=request.organization.name,
        tools_config=tools_config
    )
    
    # Add timestamps and title
    state["created_at"] = current_time
    state["last_message_at"] = current_time
    state["title"] = f"New Chat {current_time.split('T')[0]}"
    
    # Store the session
    chat_sessions[session_id] = state
    print(f"Session created and stored with ID: {session_id}")  # Debug logging
    
    response = SessionResponse(
        session_id=session_id,
        message=f"Session created for {request.organization.name}"
    )
    print("Returning response:", response)  # Debug logging
    return response

@app.post("/chat", response_model=MessageResponse)
async def chat(request: MessageRequest):
    """Process a message in a specific chat session."""
    print(f"Received chat request: {request}")  # Debug logging
    
    # Check if session exists
    if request.session_id not in chat_sessions:
        print(f"Session not found: {request.session_id}")
        print(f"Available sessions: {list(chat_sessions.keys())}")
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get the session state
    state = chat_sessions[request.session_id]
    print(f"Retrieved session state for {request.session_id}")
    
    try:
        # Process the message
        print(f"Processing message: {request.message}")
        new_state, response = process_message(state, request.message)
        print(f"Processed message, response: {response[:50]}...")
        
        # Update the timestamp for last activity
        from datetime import datetime
        new_state["last_message_at"] = datetime.now().isoformat()
        
        # Update the session state
        chat_sessions[request.session_id] = new_state
        
        response_obj = MessageResponse(
            session_id=request.session_id,
            response=response
        )
        print(f"Returning response object")
        return response_obj
    except Exception as e:
        print(f"Error processing message: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

@app.get("/sessions", response_model=List[ChatSession])
async def get_all_sessions():
    """Get all chat sessions for the user."""
    result = []
    
    # Convert each session to the ChatSession format
    for session_id, state in chat_sessions.items():
        # Extract timestamp information if available
        created_at = state.get("created_at", None)
        last_message_at = state.get("last_message_at", None)
        title = state.get("title", f"Chat {session_id[:8]}")
        
        # Convert internal message format to API format
        messages = []
        for msg in state["messages"]:
            messages.append(ChatMessage(
                role="user" if msg.type == "human" else "assistant",
                content=msg.content
            ))
        
        # Create ChatSession object with additional metadata
        session = ChatSession(
            session_id=session_id,
            messages=messages,
            title=title,
            createdAt=created_at,
            lastMessageAt=last_message_at
        )
        
        result.append(session)
    
    return result

@app.get("/sessions/{session_id}", response_model=ChatSession)
async def get_session(session_id: str):
    """Get the messages from a specific chat session."""
    # Check if session exists
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get the session state
    state = chat_sessions[session_id]
    
    # Convert internal message format to API format
    messages = []
    for msg in state["messages"]:
        messages.append(ChatMessage(
            role="user" if msg.type == "human" else "assistant",
            content=msg.content
        ))
    
    return ChatSession(
        session_id=session_id,
        messages=messages
    )

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a specific chat session."""
    # Check if session exists
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete the session
    del chat_sessions[session_id]
    
    return {"success": True, "message": f"Session {session_id} deleted successfully"}

@app.post("/scrape-website", response_model=WebsiteScrapeResponse)
async def scrape_website_endpoint(request: WebsiteScrapeRequest):
    """
    Scrape a website for background information about an organization.
    This endpoint will scrape the given website URL, with a focus on blog posts
    and main content areas, and generate concise background information points.
    """
    print(f"Received request to scrape website: {request.url}")
    
    try:
        # Scrape the website
        scraped_content = scrape_website(request.url, max_pages=request.max_pages)
        
        if not scraped_content:
            return WebsiteScrapeResponse(
                status="error",
                message="Could not extract any content from the website",
                background_items=[]
            )
            
        # Process the scraped content into background information points
        background_items = summarize_background_from_content(
            scraped_content, 
            max_items=request.max_items
        )
        
        return WebsiteScrapeResponse(
            status="success",
            message=f"Successfully extracted {len(background_items)} background items from {request.url}",
            background_items=background_items
        )
        
    except Exception as e:
        import traceback
        print(f"Error scraping website: {str(e)}")
        print(traceback.format_exc())
        return WebsiteScrapeResponse(
            status="error",
            message=f"Error scraping website: {str(e)}",
            background_items=[]
        )

# Run with: uvicorn api:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)