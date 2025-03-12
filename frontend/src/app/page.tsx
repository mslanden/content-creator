"use client";

// Add TypeScript declaration for process.env in client components
declare const process: {
  env: {
    NEXT_PUBLIC_API_URL?: string;
  }
};

import { useState, useRef, useEffect } from "react";
import ChatMessage from "../components/ChatMessage";
import Sidebar from "../components/Sidebar";
import Settings from "../components/Settings";
import { useAgent } from "@/contexts/AgentContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const PERSONALITY_RESPONSES: Record<string, string[]> = {
  "Balanced": [
    "I'm an AI assistant created to help answer your questions and provide information on a wide range of topics.",
    "I can help with programming, writing, research, and many other tasks. What would you like assistance with today?",
    "That's an interesting question. Based on the available information, here's what I can tell you...",
    "I've analyzed your code and found a potential solution to the bug you're experiencing.",
    "Let me explain this concept in simpler terms to make it easier to understand."
  ],
  "Creative": [
    "Oh, that's a fascinating topic! Let me explore some imaginative ideas about this with you.",
    "I'm feeling inspired by your question! Here's a creative approach we could consider...",
    "This reminds me of several interesting connections across different domains. Let's weave them together...",
    "Let's think outside the box on this one. What if we approached it from a completely different angle?",
    "I can envision multiple colorful possibilities here. Let me paint you a picture of what could be."
  ],
  "Precise": [
    "Based on the available data, I can provide you with the following factual information...",
    "There are exactly three key factors to consider in this analysis. First...",
    "According to the relevant research, the most accurate answer is...",
    "To be precise, the methodology requires the following specific steps...",
    "Let me break this down into exact components with detailed specifications."
  ],
  "Friendly": [
    "Hey there! That's a great question, and I'd be happy to help you figure it out!",
    "I totally get what you're asking! Let's chat about this in a way that's easy to understand.",
    "You know what? That's something many people wonder about. Let me share what I know in a friendly way.",
    "I love discussing topics like this! Here's my take on it, in simple conversational terms.",
    "Absolutely! I'm here to help make this easy and enjoyable for you to understand."
  ],
  "Concise": [
    "Here's the key point: [brief answer]",
    "Short answer: [direct response]",
    "Three main factors: 1) [point] 2) [point] 3) [point]",
    "Solution: [brief technical answer]",
    "Summary: [condensed explanation]"
  ]
};

export default function Home() {
  const [input, setInput] = useState("");
  // Use local message state primarily to maintain message rendering between context updates
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'AI Personality' | 'Background Knowledge' | 'Available Tools'>('AI Personality');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Get personality and background from localStorage
  const getPersonality = (): string => {
    const savedPersonality = localStorage.getItem("aiPersonality");
    return savedPersonality || "Balanced"; // Default to Balanced if not set
  };
  
  const getCustomPrompt = (): string => {
    const customPrompt = localStorage.getItem("customPrompt");
    return customPrompt || "";
  };
  
  const getBackgroundTexts = (): string[] => {
    try {
      const savedBackgrounds = localStorage.getItem("backgroundTexts");
      if (savedBackgrounds) {
        const parsed = JSON.parse(savedBackgrounds);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("Failed to parse background texts:", error);
    }
    return [];
  };
  
  // Function to get enabled tools from localStorage
  const getEnabledTools = () => {
    try {
      const savedTools = localStorage.getItem('enabledTools');
      if (savedTools) {
        const parsedTools = JSON.parse(savedTools);
        return {
          background_search: parsedTools.backgroundSearch ?? true,
          memory_storage: parsedTools.memoryStorage ?? true,
          memory_retrieval: parsedTools.memoryRetrieval ?? true,
          web_search: parsedTools.webSearch ?? false
        };
      }
    } catch (error) {
      console.error('Failed to load saved tool settings:', error);
    }
    
    // Default tool settings if none are saved
    return {
      background_search: true,
      memory_storage: true,
      memory_retrieval: true,
      web_search: false
    };
  };
  
  const { 
    initializeSession, 
    sendMessage: sendAgentMessage, 
    messages: agentMessages, 
    isLoading: agentLoading,
    updatePersonality,
    updateBackground,
    updateOrganizationName,
    sessionId
  } = useAgent();

  // Initialize on mount
  useEffect(() => {
    const initializeAgent = async () => {
      try {
        // Test direct API connection
        console.log("Testing direct API connection");
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
        console.log("API base URL:", apiBaseUrl);
        
        const response = await fetch(`${apiBaseUrl}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log("Direct API test response status:", response.status);
        const data = await response.json();
        console.log("Direct API test response data:", data);
        
        // If API is available, clear any old session ID to force a fresh start
        localStorage.removeItem('lastSessionId');
      } catch (error) {
        console.error("Direct API test error:", error);
      }
      
      // Always proceed with initialization regardless of the API test
      console.log("Initializing agent with settings");
      // Use the getEnabledTools function defined at component level

      const orgSettings = {
        name: "Agentica AI",
        personality: { 
          type: getPersonality(), 
          custom: getPersonality() === "Custom" ? {
            description: getCustomPrompt(),
            tone: "custom",
            style: "custom"
          } : undefined
        },
        background: { items: getBackgroundTexts() },
        tools: getEnabledTools()
      };
      
      // Initialize with fresh session
      console.log("Calling initializeSession with settings:", orgSettings);
      await initializeSession(orgSettings);
      console.log("Session initialization complete");
    };
    
    initializeAgent();
  }, []);
  
  // Sync messages from AgentContext whenever they change or sessionId changes
  useEffect(() => {
    console.log('AgentContext messages or sessionId changed, updating local state', { 
      agentMessagesLength: agentMessages.length,
      sessionId
    });
    
    // Reset local messages when agent messages change to ensure consistency
    setMessages(agentMessages);
  }, [agentMessages, sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    console.log("*** handleSubmit called ***");
    e.preventDefault();
    console.log("Input:", input);
    console.log("isLoading:", isLoading);
    console.log("agentLoading:", agentLoading);
    
    if (!input.trim() || isLoading || agentLoading) {
      console.log("Returning early due to empty input or loading state");
      return;
    }

    // Store current input value
    const currentInput = input;
    console.log("Current input:", currentInput);
    setInput("");
    
    // Add the user message to local state
    const userMessage: Message = { role: "user", content: currentInput };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      // Get session ID from localStorage or create new one
      let sessionId = localStorage.getItem('lastSessionId') || '';
      if (!sessionId) {
        console.log("No session ID, creating new session");
        
        // Create session with current settings
        // Use the API_BASE_URL from environment in production
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
        const sessionResponse = await fetch(`${apiBaseUrl}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organization: {
              name: "Agentica AI",
              personality: { 
                type: getPersonality(), 
                custom: getPersonality() === "Custom" ? {
                  description: getCustomPrompt(),
                  tone: "custom",
                  style: "custom"
                } : undefined
              },
              background: { items: getBackgroundTexts() },
              tools: getEnabledTools()
            }
          }),
        });
        
        if (!sessionResponse.ok) {
          throw new Error(`Session creation failed: ${sessionResponse.status}`);
        }
        
        const sessionData = await sessionResponse.json();
        console.log("Session created:", sessionData);
        sessionId = sessionData.session_id;
        localStorage.setItem('lastSessionId', sessionId);
      }
      
      // Send the message
      console.log(`Sending message with session ID: ${sessionId}`);
      // Use the API_BASE_URL from environment in production
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const chatResponse = await fetch(`${apiBaseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: currentInput
        }),
      });
      
      if (!chatResponse.ok) {
        throw new Error(`API error: ${chatResponse.status}`);
      }
      
      const chatData = await chatResponse.json();
      console.log("Received API response:", chatData);
      
      // Add AI response to messages
      if (chatData && chatData.response) {
        const aiMessage: Message = {
          role: "assistant",
          content: chatData.response
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error: any) {
      console.error("Error in chat flow:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${error?.message || 'An unknown error occurred'}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Open settings modal with a specific tab
  const openSettings = (tab: "personality" | "background" | "tools" | "profile") => {
    // Map the tab name to what the Settings component expects
    if (tab === "personality") {
      setSettingsInitialTab('AI Personality');
    } else if (tab === "background") {
      setSettingsInitialTab('Background Knowledge');
    } else if (tab === "tools") {
      setSettingsInitialTab('Available Tools');
    }
    
    setShowSettings(true);
    console.log("Opening settings with tab:", tab);
  };

  // Auto-resize textarea height
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Reset height to auto to get the correct scrollHeight
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    console.log('Toggle sidebar clicked. Current state:', isSidebarOpen);
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    // Store preference in localStorage for persistence
    localStorage.setItem('sidebarOpen', newState.toString());
    console.log('Sidebar state updated to:', newState);
  };
  
  // Initialize sidebar state from localStorage if available
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarOpen');
    if (savedState !== null) {
      setIsSidebarOpen(savedState === 'true');
    } else {
      // Always start closed regardless of screen size
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Focus input field when ready
    if (inputRef.current && !isLoading) {
      inputRef.current.focus();
    }
  }, [messages, isLoading]);

  // Debug the render with sidebarOpen state
  useEffect(() => {
    console.log('Page rendering with isSidebarOpen:', isSidebarOpen);
  }, [isSidebarOpen]);
  
  // Function to directly handle the menu button click
  const handleMenuButtonClick = () => {
    console.log('Menu button clicked directly');
    toggleSidebar();
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Render sidebar component */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar} 
        onOpenSettings={() => openSettings("personality")} 
      />
      
      <div className="flex flex-col w-full h-full overflow-hidden">
        {/* Minimalist top header bar */}
        <header className="border-b border-gray-100 py-3 px-4 flex items-center justify-between bg-white">
          <div className="flex-1 flex items-center">
            <button 
              className="text-gray-600 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100 transition-all duration-200"
              onClick={handleMenuButtonClick}
              aria-label="Toggle menu"
              id="toggle-sidebar-button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <h1 className="text-xl font-semibold text-center flex items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-900 mr-3 hidden sm:flex">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
              </svg>
            </div>
            <span className="gradient-text">Agentica AI</span>
          </h1>
          
          <div className="flex-1 flex justify-end space-x-2">
            <div className="relative group">
              <button 
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-150 flex items-center"
                onClick={() => openSettings("personality")}
                title="AI Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l.962.962a1 1 0 01.125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 01.804.98v1.361a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-.962.962a1 1 0 01-1.262.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125l-.962-.962a1 1 0 01-.125-1.262l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.294A1 1 0 011 10.68V9.32a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262l.962-.962A1 1 0 015.38 3.03l1.25.834a6.957 6.957 0 011.416-.587l.294-1.473zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                <span className="ml-1 text-sm hidden md:inline">Settings</span>
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 shadow-md rounded-md py-1 hidden group-hover:block z-10">
                <button onClick={() => openSettings("personality")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  AI Personality
                </button>
                <button onClick={() => openSettings("background")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Background Knowledge
                </button>
                <button onClick={() => openSettings("tools")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Available Tools
                </button>
              </div>
            </div>
          </div>
        </header>
        
        {/* Chat messages area */}
        <div className="flex-1 overflow-y-auto">
          {/* Show welcome screen only when there are no messages */}
          {(messages.length === 0) ? (
            <div className="flex h-full items-center justify-center px-4">
              <div className="text-center max-w-3xl">
                <div className="flex items-center justify-center w-16 h-16 rounded-md bg-gray-900 mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold mb-4 text-gray-900">
                  Welcome to Agentica AI
                </h2>
                <p className="text-base text-gray-600 mb-6 max-w-lg mx-auto">
                  Your intelligent assistant with advanced capabilities. Ask anything or start with one of these examples.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                  {[
                    {
                      text: "Explain quantum computing in simple terms",
                      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                    },
                    {
                      text: "What are the best practices for React?",
                      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                    },
                    {
                      text: "Write a poem about artificial intelligence",
                      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                    },
                    {
                      text: "How do I improve my website's SEO?",
                      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 1 0 0-16 9 9 0 0 0 0 16ZM9 5a1 1 0 0 1 2 0v1.16a5.99 5.99 0 0 1 2.952 1.566l.723-.723a1 1 0 0 1 1.414 1.414l-.723.723A6 6 0 0 1 16.16 11H17a1 1 0 1 1 0 2h-1.16a5.99 5.99 0 0 1-1.566 2.952l.723.723a1 1 0 0 1-1.414 1.414l-.723-.723A6 6 0 0 1 11 16.16V17a1 1 0 1 1-2 0v-1.16a5.99 5.99 0 0 1-2.952-1.566l-.723.723a1 1 0 0 1-1.414-1.414l.723-.723A6 6 0 0 1 3.84 11H3a1 1 0 0 1 0-2h.84a5.995 5.995 0 0 1 1.566-2.952l-.723-.723a1 1 0 0 1 1.414-1.414l.723.723A6 6 0 0 1 9 3.84V3Z" clipRule="evenodd" />
                        </svg>
                    },
                  ].map(({ text, icon }, i) => (
                    <button
                      key={i}
                      className="p-4 border border-gray-100 rounded-md hover:bg-gray-50 text-gray-700 text-sm transition-all duration-150 flex items-start"
                      onClick={() => {
                        setInput(text);
                        if (inputRef.current) {
                          inputRef.current.style.height = 'auto';
                          inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
                        }
                      }}
                    >
                      <span className="text-gray-700 mr-3 mt-0.5">{icon}</span>
                      <span className="text-left">{text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Show messages from local state (which is synced with AgentContext) */}
              {messages.map((message, index) => {
                console.log(`Rendering message ${index}:`, message);
                return (
                  <ChatMessage 
                    key={`${sessionId}-${index}`} 
                    role={message.role} 
                    content={message.content} 
                  />
                );
              })}
              {(isLoading || agentLoading) && (
                <div className="py-6 chat-message-ai border-b border-gray-100">
                  <div className="max-w-3xl mx-auto px-6 flex items-start">
                    <div className="mr-5 flex-shrink-0">
                      <div className="bg-gradient-to-r from-primary to-secondary h-10 w-10 rounded-lg flex items-center justify-center text-white font-medium shadow-sm animate-pulse-slow">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                    </div>
                    <div className="prose prose-slate max-w-none flex-1">
                      <div className="flex items-center mb-1">
                        <span className="font-medium text-sm text-gray-500">
                          Agentica AI
                        </span>
                        <span className="ml-2 text-xs text-gray-400">{new Date().toLocaleTimeString()}</span>
                      </div>
                      <div className="flex space-x-2 items-center h-6">
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "600ms" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        {/* Input area - minimalist */}
        <div className="border-t border-gray-100 py-4 px-4 md:px-6 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Message Agentica AI..."
                className="w-full rounded-md border border-gray-200 px-4 py-3 pr-12 resize-none overflow-hidden focus:border-gray-400 focus:ring-0 focus:outline-none min-h-[54px] input-modern"
                style={{ height: 54 }}
                disabled={isLoading}
              />
              <button
                onClick={(e) => {
                  console.log("Send button clicked");
                  handleSubmit(e);
                }}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 bottom-3 bg-gray-900 text-white p-1 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed w-8 h-8 flex items-center justify-center transition-all duration-150"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M3.478 2.404A1 1 0 0 0 2 3.404l-2.432 7.905H13.5a1 1 0 0 1 0 2H4.984l-2.432 7.905a1 1 0 0 0 .926 1.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </div>
            
            {/* Tool buttons */}
            <div className="flex justify-center space-x-2 mt-3 mb-2">
              {[
                {
                  name: 'Research',
                  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path d="M6.5 9a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM9 5a1 1 0 0 1 2 0v1.16a5.99 5.99 0 0 1 2.952 1.566l.723-.723a1 1 0 0 1 1.414 1.414l-.723.723A6 6 0 0 1 16.16 11H17a1 1 0 1 1 0 2h-1.16a5.99 5.99 0 0 1-1.566 2.952l.723.723a1 1 0 0 1-1.414 1.414l-.723-.723A6 6 0 0 1 11 16.16V17a1 1 0 1 1-2 0v-1.16a5.99 5.99 0 0 1-2.952-1.566l-.723.723a1 1 0 0 1-1.414-1.414l.723-.723A6 6 0 0 1 3.84 11H3a1 1 0 0 1 0-2h.84a5.995 5.995 0 0 1 1.566-2.952l-.723-.723a1 1 0 0 1 1.414-1.414l.723.723A6 6 0 0 1 9 3.84V3Z" clipRule="evenodd" />
                        </svg>
                },
                {
                  name: 'Image',
                  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909.47.47a.75.75 0 1 1-1.06 1.06L6.53 8.091a.75.75 0 0 0-1.06 0l-2.97 2.97ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
                        </svg>
                }
              ].map((tool) => (
                <button 
                  key={tool.name} 
                  className="flex items-center space-x-1 px-3 py-2 hover:bg-gray-50 border border-gray-100 rounded-md text-sm transition-all duration-150 text-gray-600"
                >
                  <span className="mr-1">{tool.icon}</span>
                  <span>{tool.name}</span>
                </button>
              ))}
            </div>
            
            <p className="text-xs text-center text-gray-400 mt-2">
              Agentica AI may produce inaccurate information about people, places, or facts.
              <a href="#" className="text-gray-600 hover:text-gray-900 ml-1 transition-colors">Learn more</a>
            </p>
          </div>
        </div>
      </div>
      
      {/* Settings modal */}
      {showSettings && (
        <Settings 
          initialTab={settingsInitialTab}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
