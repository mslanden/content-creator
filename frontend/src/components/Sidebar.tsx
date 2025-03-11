'use client';

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Menu, Plus, User, Trash2 } from 'lucide-react';
import { useAgent } from "../contexts/AgentContext";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  onOpenSettings?: () => void;
}

// Using ChatSession from agent-api instead of local interface

export default function Sidebar({ isOpen, toggleSidebar, onOpenSettings }: SidebarProps) {
  const { 
    sessions, 
    sessionId: currentSessionId, 
    loadSession, 
    createNewSession, 
    deleteSession,
    isLoading
  } = useAgent();

  const [expanded, setExpanded] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarExpanded');
    if (savedState !== null) {
      setExpanded(savedState === 'true');
    }
  }, []);
  
  // Handler for selecting a chat history
  const handleSelectChat = async (sessionId: string) => {
    if (isLoading || isDeleting) return; // Prevent action during loading or deleting
    
    // Skip if already on this session
    if (sessionId === currentSessionId) {
      console.log('Already on this session, just closing sidebar on mobile');
      // Just close sidebar on mobile
      if (window.innerWidth < 768) {
        toggleSidebar();
      }
      return;
    }
    
    console.log(`Switching to session: ${sessionId} from ${currentSessionId}`);
    try {
      await loadSession(sessionId);
      // On mobile, close sidebar after selection
      if (window.innerWidth < 768) {
        toggleSidebar();
      }
    } catch (error) {
      console.error('Failed to load chat session:', error);
      alert('Failed to load chat session. Please try again.');
    }
  };
  
  // Handler for creating a new chat
  const handleNewChat = async () => {
    if (isLoading) return; // Prevent action during loading
    
    console.log('Creating new chat session');
    try {
      // Force a refresh of the page state by creating a new session
      await createNewSession();
      console.log('New session created successfully');
      
      // On mobile, close sidebar after creation
      if (window.innerWidth < 768) {
        toggleSidebar();
      }
    } catch (error) {
      console.error('Failed to create new chat:', error);
      alert('Failed to create new chat. Please try again.');
    }
  };
  
  // Handler for deleting a chat
  const handleDeleteChat = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent triggering the parent click handler
    if (isLoading || isDeleting) return; // Prevent action during loading or deleting
    
    setIsDeleting(sessionId);
    try {
      await deleteSession(sessionId);
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      alert('Failed to delete chat session. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };
  
  useEffect(() => {
    // Debug log to track sidebar open state changes
    console.log('Sidebar isOpen prop changed:', isOpen);
  }, [isOpen]);
  
  // Handle close button click
  const handleCloseClick = () => {
    console.log('Close sidebar X button clicked');
    toggleSidebar();
  };

  // Simplified return statement to avoid syntax errors
  return (
    <div className="sidebar-wrapper">
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 transition-opacity duration-300 ease-in-out lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <div 
        className={`fixed top-0 left-0 h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-xl transition-all duration-300 ease-in-out flex flex-col transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-72 z-30`}
      >
        {/* Header */}
        <div className="p-4 flex justify-between items-center">
          <h2 className="font-semibold text-xl tracking-tight">
            Agentica AI
          </h2>
          <button
            onClick={handleCloseClick}
            className="p-2 rounded-md hover:bg-gray-700/70 transition-all duration-200"
            aria-label="Close sidebar"
            id="close-sidebar-button"
          >
            <X size={20} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-3">
          <button
            onClick={handleNewChat}
            disabled={isLoading}
            className={`
              w-full flex items-center gap-2
              bg-blue-600 hover:bg-blue-700 
              rounded-lg 
              transition-all duration-200
              text-sm font-medium
              px-4 py-3 justify-start
              ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}
            `}
          >
            <Plus size={18} />
            <span className="block">
              New Chat
            </span>
          </button>
        </div>

        {/* Chat Histories */}
        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-1 px-3 py-4">
            {sessions.map((session) => {
              // Get last message text for preview
              const lastMessage = session.messages && session.messages.length > 0 
                ? session.messages[session.messages.length - 1].content
                : "No messages";
              
              // Format date for display
              const lastActive = session.lastMessageAt 
                ? new Date(session.lastMessageAt).toLocaleDateString()
                : "";
                
              return (
                <li 
                  key={session.session_id}
                  onClick={() => handleSelectChat(session.session_id)}
                  className={`
                    flex flex-col 
                    rounded-lg 
                    transition-all duration-200
                    hover:bg-gray-700/70 
                    cursor-pointer
                    px-4 py-3
                    relative
                    ${currentSessionId === session.session_id ? 'bg-gray-700/70' : ''}
                    ${isLoading && currentSessionId === session.session_id ? 'opacity-70' : ''}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium">
                      {session.title || `Chat ${session.session_id}`}
                    </span>
                    <button 
                      onClick={(e) => handleDeleteChat(e, session.session_id)}
                      className="text-gray-400 hover:text-red-400 p-1 rounded-full"
                      disabled={isDeleting === session.session_id}
                    >
                      {isDeleting === session.session_id ? 
                        <span className="animate-pulse">...</span> : 
                        <Trash2 size={14} />}
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 truncate mt-1 pr-6">
                    {lastMessage.length > 40 ? lastMessage.substring(0, 40) + '...' : lastMessage}
                  </span>
                  {lastActive && (
                    <span className="text-xs text-gray-500 mt-1">
                      {lastActive}
                    </span>
                  )}
                </li>
              );
            })}
            {sessions.length === 0 && (
              <li className="text-center py-6 text-gray-400 text-sm">
                No chat history yet.<br />
                Start a new conversation!  
              </li>
            )}
          </ul>
        </nav>

        {/* User Profile */}
        <div className="shrink-0 border-t border-gray-700/50">
          <div 
            onClick={onOpenSettings}
            className={`
              mx-3 my-2 p-3
              flex items-center gap-3
              rounded-lg 
              transition-all duration-200
              hover:bg-gray-700/70 
              cursor-pointer
            `}
          >
            <User size={20} />
            <div className="flex flex-col">
              <span className="text-sm font-medium">John Doe</span>
              <span className="text-xs text-gray-400">john@agentica.ai</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}