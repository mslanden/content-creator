import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const [formattedContent, setFormattedContent] = useState<string>(content);
  
  // Process content when it changes
  useEffect(() => {
    setFormattedContent(content);
  }, [content]);

  return (
    <div className={`py-5 ${role === "user" ? "chat-message-user" : "chat-message-ai"} border-b border-gray-50`}>
      <div className="max-w-3xl mx-auto px-6 flex items-start">
        <div className="mr-4 flex-shrink-0">
          {role === "user" ? (
            <div className="bg-gray-200 h-8 w-8 rounded-md flex items-center justify-center text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          ) : (
            <div className="bg-gray-900 h-8 w-8 rounded-md flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          )}
        </div>
        <div className="prose prose-slate max-w-none flex-1">
          <div className="flex items-center mb-1">
            <span className="font-medium text-xs text-gray-500">
              {role === "user" ? "You" : "Agentica AI"}
            </span>
            <span className="ml-2 text-xs text-gray-400">{new Date().toLocaleTimeString()}</span>
          </div>
          
          {role === "user" ? (
            <p className="text-gray-800 leading-relaxed text-sm">
              {formattedContent}
            </p>
          ) : (
            <div className="markdown-content text-gray-700 text-sm">
              {/* Use a version with no custom components to avoid typing issues */}
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                >
                  {formattedContent}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}