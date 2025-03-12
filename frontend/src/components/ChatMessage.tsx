import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { nord } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const [formattedContent, setFormattedContent] = useState<string>(content);
  const [isHtmlPreview, setIsHtmlPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Process content when it changes
  useEffect(() => {
    // Format the content into Markdown if it contains special formatting
    let processed = content;
    
    // Check if content has title format (# Title:) and convert if needed
    if (role === 'assistant' && !content.startsWith('#') && content.includes('Title:')) {
      processed = content.replace(/^(\s*Title:\s*)(.*?)($|\n)/m, '# $2\n');
    }
    
    // Convert section markers (##) if they exist
    if (role === 'assistant' && !content.includes('##') && content.includes('##')) {
      processed = processed.replace(/^(\s*##\s*)(.*?)($|\n)/gm, '## $2\n');
    }
    
    // Special handling for numbered lists with ** markers around the numbers
    if (role === 'assistant') {
      // Format numbered points with **N.** format to proper markdown
      processed = processed.replace(/\*\*(\d+)\.(\*\*|\s+)(.*?)($|\n)/gm, '$1. $3\n');
      
      // Format section headers with ## markers
      processed = processed.replace(/^(\s*)(##\s+)(.*?)($|\n)/gm, '$1## $3\n');
    }
    
    setFormattedContent(processed);
    // Reset copy state when content changes
    setCopied(false);
  }, [content, role]);

  // Handle copy to clipboard
  const handleCopy = () => {
    if (contentRef.current) {
      // Get the text content from the rendered markdown
      const textToCopy = isHtmlPreview
        ? contentRef.current.outerHTML  // For HTML, copy the actual HTML
        : content;  // For normal view, copy the raw content
      
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setCopied(true);
          // Reset the copied state after 2 seconds
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
        });
    }
  };

  // Toggle HTML preview
  const toggleHtmlPreview = () => {
    setIsHtmlPreview(!isHtmlPreview);
  };

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
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <span className="font-medium text-xs text-gray-500">
                {role === "user" ? "You" : "Agentica AI"}
              </span>
              <span className="ml-2 text-xs text-gray-400">{new Date().toLocaleTimeString()}</span>
            </div>

            {role === "assistant" && (
              <div className="flex items-center space-x-2">
                <button 
                  onClick={toggleHtmlPreview}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded transition-colors"
                >
                  {isHtmlPreview ? "View Normal" : "HTML Preview"}
                </button>
                <button 
                  onClick={handleCopy}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded transition-colors flex items-center"
                >
                  {copied ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          
          {role === "user" ? (
            <p className="text-gray-800 leading-relaxed text-sm">
              {formattedContent}
            </p>
          ) : isHtmlPreview ? (
            <div 
              ref={contentRef}
              className="html-preview p-3 bg-white border rounded-md shadow-sm text-sm overflow-auto max-h-[500px]"
              dangerouslySetInnerHTML={{ __html: formattedContent }}
            />
          ) : (
            <div className="markdown-content text-gray-700 text-sm" ref={contentRef}>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={{
                    h1: ({node, ...props}: any) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                    h2: ({node, ...props}: any) => <h2 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                    h3: ({node, ...props}: any) => <h3 className="text-md font-semibold mt-2 mb-1" {...props} />,
                    p: ({node, ...props}: any) => <p className="my-2" {...props} />,
                    ul: ({node, ...props}: any) => <ul className="list-disc pl-5 my-2" {...props} />,
                    ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 my-2" {...props} />,
                    li: ({node, ...props}: any) => <li className="ml-2 my-1" {...props} />,
                    code: ({node, inline, className, children, ...props}: any) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={nord as any}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={`bg-gray-100 rounded px-1 py-0.5 ${className}`} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
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