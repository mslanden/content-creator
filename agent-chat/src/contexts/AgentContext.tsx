'use client';

import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import {
  createSession,
  sendMessage,
  getSession,
  getPersonalityPresets,
  getAllSessions,
  deleteSession,
  ChatMessage,
  ChatSession,
  OrganizationSettings,
  PersonalitySettings,
  BackgroundInfo
} from '../lib/agent-api';

interface AgentContextType {
  isInitialized: boolean;
  isLoading: boolean;
  sessionId: string | null;
  messages: ChatMessage[];
  sessions: ChatSession[];
  personalityPresets: Record<string, any>;
  currentSettings: {
    organization: OrganizationSettings;
  };
  sendMessage: (message: string) => Promise<void>;
  initializeSession: (settings: OrganizationSettings) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updatePersonality: (personality: PersonalitySettings) => void;
  updateBackground: (background: BackgroundInfo) => void;
  updateOrganizationName: (name: string) => void;
}

interface SidebarContextType {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

const defaultOrganizationSettings: OrganizationSettings = {
  name: 'Agentica AI',
  personality: { type: 'Balanced' },
  background: { items: [] },
  tools: {
    background_search: true,
    memory_storage: true,
    memory_retrieval: true,
    web_search: true
  }
};

export const AgentContext = createContext<AgentContextType>({
  isInitialized: false,
  isLoading: false,
  sessionId: null,
  messages: [],
  sessions: [],
  personalityPresets: {},
  currentSettings: {
    organization: defaultOrganizationSettings
  },
  sendMessage: async () => {},
  initializeSession: async () => {},
  loadSession: async () => {},
  createNewSession: async () => {},
  deleteSession: async () => {},
  updatePersonality: () => {},
  updateBackground: () => {},
  updateOrganizationName: () => {}
});

export const useAgent = () => useContext(AgentContext);

export const SidebarContext = createContext<SidebarContextType>({
  isExpanded: true,
  setIsExpanded: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface AgentProviderProps {
  children: ReactNode;
}

export const AgentProvider = ({ children }: AgentProviderProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [personalityPresets, setPersonalityPresets] = useState<Record<string, any>>({});
  const [currentSettings, setCurrentSettings] = useState({
    organization: defaultOrganizationSettings
  });

  // Load personality presets and sessions on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Load personality presets
        const presets = await getPersonalityPresets();
        setPersonalityPresets(presets);
        
        // Load all chat sessions
        const allSessions = await getAllSessions();
        setSessions(allSessions);
        
        // Check if there's a stored session ID to restore
        const lastSessionId = localStorage.getItem('lastSessionId');
        if (lastSessionId) {
          try {
            await loadSession(lastSessionId);
          } catch (error) {
            console.error('Failed to load saved session:', error);
            // Clear invalid session ID
            localStorage.removeItem('lastSessionId');
          }
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
        // Fallback to use preset definitions from frontend for offline mode
      }
    }

    loadInitialData();
  }, []);

  // Initialize session with organization settings
  const initializeSession = async (settings: OrganizationSettings) => {
    console.log('Initializing agent session with settings:', settings);
    setIsLoading(true);
    
    // Always create a new session - don't reuse old sessions
    try {
      const response = await createSession(settings);
      console.log('Session initialized with ID:', response.session_id);
      // Save session ID for future use
      localStorage.setItem('lastSessionId', response.session_id);
      setSessionId(response.session_id);
      setMessages([]);
      setCurrentSettings({ organization: settings });
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize session:', error);
      alert('Failed to initialize chat session. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  };

  // Send a message to the agent
  const sendUserMessage = async (message: string) => {
    console.log('sendUserMessage called with:', message);
    
    if (!sessionId) {
      console.error('Session not initialized, attempting to initialize...');
      // Reinitialize with current settings
      await initializeSession(currentSettings.organization);
      
      // If still no session ID after attempting to initialize, show error
      if (!sessionId) {
        console.error('Still no session ID after reinitialization');
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: 'Unable to initialize chat session. Please refresh the page and try again.'
        };
        setMessages([errorMessage]);
        return;
      }
    }

    console.log(`Sending message to agent with session ID: ${sessionId}`);
    setIsLoading(true);
    
    // Optimistically add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message
    };
    console.log('Adding user message to state');
    setMessages((prev) => {
      console.log('Previous messages:', prev);
      const newMessages = [...prev, userMessage];
      console.log('New messages:', newMessages);
      return newMessages;
    });

    try {
      // Direct API call
      console.log(`Making direct API call to http://localhost:8000/chat with session ID: ${sessionId}`);
      console.log('Request body:', JSON.stringify({ session_id: sessionId, message }));
      
      // Use the browser's native fetch
      const directResponse = await window.fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          session_id: sessionId, 
          message: message 
        }),
      });
      
      console.log('API response status:', directResponse.status);
      console.log('API response ok:', directResponse.ok);
      
      if (!directResponse.ok) {
        throw new Error(`API error: ${directResponse.status} ${directResponse.statusText}`);
      }
      
      const responseText = await directResponse.text();
      console.log('Raw response text:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("Parsed API response:", data);
      } catch (parseError) {
        console.error('Failed to parse API response:', parseError);
        throw new Error(`Failed to parse API response: ${responseText}`);
      }
      
      if (data && data.response) {
        console.log('Valid response found, adding assistant message');
        // Add assistant response
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response
        };
        
        setMessages((prev) => {
          console.log('Previous messages before adding assistant response:', prev);
          const newMessages = [...prev, assistantMessage];
          console.log('New messages with assistant response:', newMessages);
          return newMessages;
        });
        
        console.log('Assistant message added to state');
      } else {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Check if it's a 404 error (session not found)
      const errorString = String(error);
      const is404 = errorString.includes('404') || errorString.includes('not found');
      
      if (is404) {
        console.log('404 error detected, session not found');
        // Session expired or not found, try to create a new one
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: 'Your session has expired. Creating a new session...'
        };
        setMessages((prev) => [...prev, errorMessage]);
        
        // Reinitialize session
        await initializeSession(currentSettings.organization);
        
        // Let user know to try again
        const newSessionMessage: ChatMessage = {
          role: 'assistant',
          content: 'New session created. Please try your message again.'
        };
        setMessages((prev) => [...prev, newSessionMessage]);
      } else {
        // Generic error message
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `Sorry, there was an error processing your message: ${error instanceof Error ? error.message : String(error)}`
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      console.log('Setting isLoading to false');
      setIsLoading(false);
    }
  };

  // Update personality settings
  const updatePersonality = (personality: PersonalitySettings) => {
    setCurrentSettings((prev) => ({
      organization: {
        ...prev.organization,
        personality
      }
    }));
  };

  // Update background information
  const updateBackground = (background: BackgroundInfo) => {
    setCurrentSettings((prev) => ({
      organization: {
        ...prev.organization,
        background
      }
    }));
  };

  // Update organization name
  const updateOrganizationName = (name: string) => {
    setCurrentSettings((prev) => ({
      organization: {
        ...prev.organization,
        name
      }
    }));
  };

  // Load a specific session by ID
  const loadSession = async (sessionId: string) => {
    console.log(`Loading session with ID: ${sessionId}`);
    setIsLoading(true);
    
    try {
      // Clear messages first to ensure UI resets
      setMessages([]);
      
      const session = await getSession(sessionId);
      console.log('Session loaded:', session);
      
      // Update state with the loaded session data
      setSessionId(sessionId);
      setMessages(session.messages || []);
      setIsInitialized(true);
      localStorage.setItem('lastSessionId', sessionId);
      
      // Ensure the sessions list is updated
      const updatedSessions = await getAllSessions();
      setSessions(updatedSessions);
    } catch (error) {
      console.error('Failed to load session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create a new chat session
  const createNewSession = async () => {
    console.log('Creating new chat session');
    // Clear any existing messages first
    setMessages([]);
    // Use current settings to initialize a new session
    await initializeSession(currentSettings.organization);
    
    // Refresh the sessions list after creating a new one
    try {
      const updatedSessions = await getAllSessions();
      setSessions(updatedSessions);
    } catch (error) {
      console.error('Failed to refresh sessions after creating new one:', error);
    }
  };
  
  // Delete a chat session
  const deleteSessionById = async (idToDelete: string) => {
    console.log(`Deleting session with ID: ${idToDelete}`);
    
    try {
      await deleteSession(idToDelete);
      
      // Remove from local state
      setSessions(prevSessions => prevSessions.filter(s => s.session_id !== idToDelete));
      
      // If the deleted session was the active one, clear current session
      if (idToDelete === sessionId) {
        setSessionId(null);
        setMessages([]);
        setIsInitialized(false);
        localStorage.removeItem('lastSessionId');
      }
      
      console.log('Session deleted successfully');
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  };

  const contextValue = {
    isInitialized,
    isLoading,
    sessionId,
    messages,
    sessions,
    personalityPresets,
    currentSettings,
    sendMessage: sendUserMessage,
    initializeSession,
    loadSession,
    createNewSession,
    deleteSession: deleteSessionById,
    updatePersonality,
    updateBackground,
    updateOrganizationName
  };

  return (
    <AgentContext.Provider value={contextValue}>
      <SidebarContext.Provider value={{ isExpanded, setIsExpanded }}>
        {children}
      </SidebarContext.Provider>
    </AgentContext.Provider>
  );
};