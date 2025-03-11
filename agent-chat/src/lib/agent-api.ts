/**
 * Agent API client for interacting with the LangGraph backend
 */

// Use environment variable if available, otherwise fallback to the deployed backend URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'ec2-54-235-6-245.compute-1.amazonaws.com';
console.log('API base URL:', API_BASE_URL);

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  session_id: string;
  messages: ChatMessage[];
  title?: string;
  createdAt?: string;
  lastMessageAt?: string;
}

export interface PersonalitySettings {
  type: string;
  custom?: Record<string, string>;
}

export interface BackgroundInfo {
  items: string[];
}

export interface ToolSettings {
  background_search: boolean;
  memory_storage: boolean;
  memory_retrieval: boolean;
  web_search: boolean;
}

export interface OrganizationSettings {
  name: string;
  personality: PersonalitySettings;
  background: BackgroundInfo;
  tools: ToolSettings;
}

export interface SessionRequest {
  organization: OrganizationSettings;
}

export interface SessionResponse {
  session_id: string;
  message: string;
}

export interface MessageRequest {
  session_id: string;
  message: string;
}

export interface MessageResponse {
  session_id: string;
  response: string;
}

/**
 * Creates a new chat session with the specified organization settings
 */
export async function createSession(settings: OrganizationSettings): Promise<SessionResponse> {
  try {
    console.log(`Creating session at ${API_BASE_URL}/sessions with settings:`, settings);
    
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organization: settings }),
    });
    
    if (!response.ok) {
      console.error(`Response error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error details: ${errorText}`);
      throw new Error(`Failed to create session: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Session created:', result);
    return result;
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

/**
 * Sends a chat message and gets a response
 */
export async function sendMessage(sessionId: string, message: string): Promise<MessageResponse> {
  try {
    console.log(`Sending message to ${API_BASE_URL}/chat with session ID: ${sessionId}`);
    
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId, message }),
    });
    
    if (!response.ok) {
      console.error(`Response error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error details: ${errorText}`);
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Received response:', result);
    return result;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Gets the messages from a specific chat session
 */
export async function getSession(sessionId: string): Promise<ChatSession> {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting session:', error);
    throw error;
  }
}

/**
 * Gets available personality presets
 */
export async function getPersonalityPresets(): Promise<Record<string, any>> {
  try {
    const response = await fetch(`${API_BASE_URL}/personalities`);
    
    if (!response.ok) {
      throw new Error(`Failed to get personality presets: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.presets;
  } catch (error) {
    console.error('Error getting personality presets:', error);
    throw error;
  }
}

/**
 * Gets all chat sessions for the user
 */
export async function getAllSessions(): Promise<ChatSession[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`);
    
    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting all sessions:', error);
    // For development, return mock data if API isn't available
    console.warn('Returning mock chat sessions');
    return [
      { 
        session_id: "1", 
        title: "Project Planning", 
        messages: [{role: 'assistant', content: "Let's schedule..."}],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        lastMessageAt: new Date(Date.now() - 3600000).toISOString()
      },
      { 
        session_id: "2", 
        title: "Tech Support", 
        messages: [{role: 'assistant', content: "The error is..."}],
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        lastMessageAt: new Date(Date.now() - 7200000).toISOString()
      },
      { 
        session_id: "3", 
        title: "Brainstorming", 
        messages: [{role: 'assistant', content: "New ideas for..."}],
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        lastMessageAt: new Date(Date.now() - 10800000).toISOString()
      }
    ];
  }
}

/**
 * Deletes a specific chat session
 */
export async function deleteSession(sessionId: string): Promise<{ success: boolean, message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.statusText}`);
    }
    
    return { success: true, message: 'Session deleted successfully' };
  } catch (error) {
    console.error('Error deleting session:', error);
    return { 
      success: false, 
      message: `Error deleting session: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Interface for website scraping request
 */
export interface WebsiteScrapeRequest {
  url: string;
  max_pages?: number;
  max_items?: number;
}

/**
 * Interface for website scraping response
 */
export interface WebsiteScrapeResponse {
  status: 'success' | 'error';
  message: string;
  background_items: string[];
}

/**
 * Scrapes a website for background information
 */
export async function scrapeWebsite(request: WebsiteScrapeRequest): Promise<WebsiteScrapeResponse> {
  try {
    console.log(`Scraping website at ${request.url}`);
    
    const response = await fetch(`${API_BASE_URL}/scrape-website`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      console.error(`Response error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error details: ${errorText}`);
      throw new Error(`Failed to scrape website: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Website scraping result:', result);
    return result;
  } catch (error) {
    console.error('Error scraping website:', error);
    throw error;
  }
}