"""
Agent backend using LangGraph for Agentica AI.
This module provides a LangGraph-based agent system that incorporates personality
and background information for organizations to create more complete content.
"""

import os
import datetime
from typing import Dict, List, Tuple, Any, Optional, TypedDict, Annotated
import json
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urlparse, urljoin

from langgraph.graph import StateGraph, END, START
from langgraph.prebuilt import ToolNode
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import Tool
from langchain_openai import ChatOpenAI

# Define state schema
class AgentState(TypedDict):
    # Messages that are shared between all nodes
    messages: Annotated[List, "Messages shared between all nodes"]
    # Agent's current personality/tone settings
    personality: Annotated[Dict, "Personality and tone settings for the agent"]
    # Background information/context for the organization
    background: Annotated[List[str], "Organization's background information"]
    # Current context and working memory
    context: Annotated[Dict, "Additional context and working memory"]
    # Memory for tracking important information across conversations
    memory: Annotated[List[Dict], "Persistent memory for important information"]

# Personality presets for agent
PERSONALITY_PRESETS = {
    "Balanced": {
        "description": "A well-rounded AI that balances helpfulness with conciseness",
        "tone": "balanced, professional, helpful",
        "style": "provide comprehensive yet concise responses that balance detail with clarity"
    },
    "Creative": {
        "description": "An imaginative AI that excels at generating unique ideas",
        "tone": "creative, inspiring, imaginative",
        "style": "use colorful language, metaphors, and think outside the box with novel approaches"
    },
    "Precise": {
        "description": "A detailed AI that provides thorough, fact-based responses",
        "tone": "precise, analytical, detailed",
        "style": "emphasize accuracy, provide specifics, include relevant data points, and organize information logically"
    },
    "Friendly": {
        "description": "A warm, conversational AI with an approachable style",
        "tone": "warm, conversational, approachable",
        "style": "use friendly language, relate to the user, simplify complex topics, and maintain a positive outlook"
    },
    "Concise": {
        "description": "A direct AI that gives brief, to-the-point answers",
        "tone": "direct, brief, efficient",
        "style": "prioritize brevity, eliminate unnecessary details, use bullet points when appropriate"
    }
}

# Tools for the agent
def search_background(query: str, background_info: List[str]) -> str:
    """
    Search through the organization's background information for relevant content.
    
    Args:
        query: The search query
        background_info: The list of background information snippets
        
    Returns:
        Relevant background information or a message indicating no relevant info was found
    """
    query = query.lower()
    relevant_info = []
    
    # Split query into keywords for more flexible matching
    keywords = [k.strip() for k in query.split() if len(k.strip()) > 3]
    
    # First try exact matching
    for info in background_info:
        if query in info.lower():
            relevant_info.append(info)
    
    # If no exact matches, try keyword matching
    if not relevant_info and keywords:
        for info in background_info:
            info_lower = info.lower()
            for keyword in keywords:
                if keyword in info_lower and info not in relevant_info:
                    relevant_info.append(info)
    
    if relevant_info:
        # Format the response with Markdown for better readability
        formatted_info = [f"- **{info.split(':', 1)[0]}**:{info.split(':', 1)[1]}" if ':' in info else f"- {info}" for info in relevant_info]
        return "\n\n".join(formatted_info)
    else:
        return "No specific background information found for this query."

def save_to_memory(info: str, importance: int = 1) -> str:
    """
    Save important information to agent's long-term memory.
    
    Args:
        info: The information to remember
        importance: Importance level (1-5), with 5 being highest
        
    Returns:
        Confirmation message
    """
    if not 1 <= importance <= 5:
        importance = 1
        
    memory_entry = {
        "content": info,
        "importance": importance,
        "timestamp": str(datetime.datetime.now())
    }
    
    return f"Saved to memory with importance level {importance}"

def retrieve_from_memory(query: str, memory_items: List[Dict]) -> str:
    """
    Retrieve relevant information from agent's memory.
    
    Args:
        query: The search query
        memory_items: List of memory items
        
    Returns:
        Relevant memories or a message indicating no relevant memories found
    """
    query = query.lower()
    relevant_memories = []
    
    for item in memory_items:
        if query in item["content"].lower():
            relevant_memories.append(f"[Importance: {item['importance']}] {item['content']}")
    
    if relevant_memories:
        return "\n\n".join(relevant_memories)
    else:
        return "No relevant memories found."

# System message template that incorporates personality and background
SYSTEM_TEMPLATE = """You are an AI assistant for {organization_name}.

## YOUR PERSONALITY:
- Tone: {personality_tone}
- Style: {personality_style}
- Description: {personality_description}

## ORGANIZATION BACKGROUND:
{background_summary}

## MEMORY CAPABILITIES:
You have access to a memory system where you can:
- Save important information for future reference
- Retrieve previously saved information
These memories persist across conversations and help you build context over time.

{memory_summary}

## AVAILABLE TOOLS:
- search_background: Search through organization's background information
- save_to_memory: Save important information to memory with an importance level (1-5)
- retrieve_from_memory: Search for information in your memory

## FORMATTING CAPABILITIES:
You can use Markdown and HTML formatting in your responses. This includes:
- **Bold text** for emphasis
- *Italic text* for subtle emphasis
- # Headings of different levels
- [Links](https://example.com)
- Lists (ordered and unordered)
- `Code snippets` and ```code blocks```
- Tables for structured data
- > Blockquotes for citations or highlighting important information

## RESPONSE GUIDELINES:
1. Answer questions accurately and helpfully.
2. Maintain the specified tone and style in all communications.
3. ALWAYS incorporate organization background when relevant - this is critical.
4. PROACTIVELY use the search_background tool for ANY query that might benefit from organization-specific information.
5. Use your memory to remember important details about users and conversations.
6. When you learn something important that might be useful later, save it to your memory using the save_to_memory tool.
7. Use the retrieve_from_memory tool when you need to recall previously stored information.
8. Be honest about limitations and uncertainties.
9. If organization-specific information is requested but not available in the background, 
   acknowledge this limitation while still providing a helpful general response.
10. Use appropriate Markdown formatting to enhance readability and structure in your responses.
11. For complex information, use tables, lists, or other formatting to improve clarity.

IMPORTANT: You MUST search the background knowledge for ANY query that might be related to the organization, its products, services, or industry. This is ESSENTIAL to providing accurate responses.

Always aim to represent {organization_name} accurately and positively in all interactions.
"""

def create_agent(model_name: str = "gpt-3.5-turbo", timeout: int = 30):
    """Create a LangGraph agent with the specified configuration."""
    
    # Check if OpenAI API key is available
    api_key = os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        print("⚠️ WARNING: No OpenAI API key found. Using mock responses for development.")
        # Create a simple mock LLM for development without API key
        from langchain.llms.fake import FakeListLLM
        from langchain.schema import BaseMessage
        
        # Mock responses for development
        mock_responses = [
            "I'm a mock AI assistant. In production, this would use a real language model via the OpenAI API.",
            "Hello! I'm running in development mode without an API key. I can simulate basic interactions but not process complex queries.",
            "I'm a placeholder response for the development environment. To use the real AI, please add your OpenAI API key."
        ]
        
        # Create a fake LLM that cycles through mock responses
        class MockChatModel:
            def __init__(self, responses):
                self.responses = responses
                self.index = 0
            
            def invoke(self, messages):
                response = self.responses[self.index % len(self.responses)]
                self.index += 1
                return AIMessage(content=response)
            
            def bind_tools(self, tools):
                # Support the bind_tools interface but do nothing
                return self
        
        llm = MockChatModel(mock_responses)
    else:
        # Initialize the real LLM with timeout and retry settings
        llm = ChatOpenAI(
            model=model_name, 
            temperature=0.7,
            request_timeout=timeout,
            max_retries=2
        )
    
    # Create agent prompts
    def create_prompt(state: AgentState) -> ChatPromptTemplate:
        """Creates the prompt for the agent using the current state."""
        personality = state["personality"]
        background = state["background"]
        memory_items = state.get("memory", [])
        
        # Create a summary of background info
        background_summary = "No specific background information available."
        if background:
            background_summary = "\n".join([f"- {info}" for info in background[:5]])
            if len(background) > 5:
                background_summary += f"\n- Plus {len(background) - 5} more items (will search when relevant)"
        
        # Create memory summary
        memory_summary = "No memories stored yet."
        if memory_items:
            # Sort by importance, highest first
            sorted_memories = sorted(memory_items, key=lambda x: x.get("importance", 1), reverse=True)
            memory_summary = "## Current Memories:\n" + "\n".join([
                f"- {mem['content']} (Importance: {mem.get('importance', 1)})"
                for mem in sorted_memories[:3]
            ])
            if len(memory_items) > 3:
                memory_summary += f"\n- Plus {len(memory_items) - 3} more memories (use retrieve_from_memory to search)"
                
        organization_name = state["context"].get("organization_name", "the organization")
                
        system_message = SYSTEM_TEMPLATE.format(
            organization_name=organization_name,
            personality_tone=personality.get("tone", "professional, helpful"),
            personality_style=personality.get("style", "balanced and informative"), 
            personality_description=personality.get("description", "A helpful AI assistant"),
            background_summary=background_summary,
            memory_summary=memory_summary
        )
        
        return ChatPromptTemplate.from_messages([
            ("system", system_message),
            MessagesPlaceholder(variable_name="messages"),
        ])
    
    # Create tools
    def get_background_search_tool(state: AgentState) -> Tool:
        """Create a tool to search through background information."""
        return Tool.from_function(
            func=lambda query: search_background(query, state["background"]),
            name="search_background",
            description="Search for specific information in the organization's background data"
        )
    
    def get_save_memory_tool(state: AgentState) -> Tool:
        """Create a tool to save information to memory."""
        def save_info_to_memory(info: str, importance: int = 1) -> str:
            result = save_to_memory(info, importance)
            # Update the state's memory
            memory_entry = {
                "content": info,
                "importance": importance,
                "timestamp": str(datetime.datetime.now())
            }
            state["memory"].append(memory_entry)
            return result
            
        return Tool.from_function(
            func=save_info_to_memory,
            name="save_to_memory",
            description="Save important information to memory with an importance level (1-5)"
        )
    
    def get_retrieve_memory_tool(state: AgentState) -> Tool:
        """Create a tool to retrieve information from memory."""
        return Tool.from_function(
            func=lambda query: retrieve_from_memory(query, state["memory"]),
            name="retrieve_from_memory",
            description="Search for information in your memory"
        )
    
    # Node for agent thinking and responding
    def agent_node(state: AgentState) -> Dict:
        """Process input and generate a response based on personality and background."""
        # Create the prompt using current state
        prompt = create_prompt(state)
        
        # Get messages
        messages = state["messages"]
        
        # Pre-fetch relevant background information if available
        if state["background"] and len(messages) > 0 and hasattr(messages[-1], 'content'):
            last_message = messages[-1].content
            # Only do this for non-trivial messages
            if len(last_message) > 5:
                # Try to find relevant background info for the last message
                background_results = search_background(last_message, state["background"])
                if background_results and "No specific background information found" not in background_results:
                    # Add a system message with the relevant background info
                    system_note = f"\n\nRelevant background information:\n{background_results}\n\nUse this information to inform your response."
                    # We don't modify the prompt directly, but we'll add this to the tools context
                    state["context"]["prefetched_background"] = background_results
        
        # Create tools for this specific state based on enabled settings
        tools = []
        tools_config = state["context"].get("tools_config", {})
        
        # Only add tools that are enabled
        if tools_config.get("background_search", True):
            tools.append(get_background_search_tool(state))
            
        if tools_config.get("memory_storage", True):
            tools.append(get_save_memory_tool(state))
            
        if tools_config.get("memory_retrieval", True):
            tools.append(get_retrieve_memory_tool(state))
            
        # Web search is not implemented yet, but we can prepare for it
        # if tools_config.get("web_search", False):
        #     tools.append(get_web_search_tool(state))
        
        # Maximum number of retries
        max_retries = 2
        retry_count = 0
        last_error = None
        
        # First try with tools
        while retry_count < max_retries:
            try:
                # Generate response with tool support
                agent_with_tools = llm.bind_tools(tools)
                response = agent_with_tools.invoke(prompt.format(messages=messages))
                
                # Verify response has content
                if hasattr(response, 'content') and response.content and len(response.content.strip()) > 0:
                    # Debug print
                    print(f"Generated response: {response.content[:100]}...")
                    
                    # Add the response to the messages
                    return {"messages": messages + [response], "memory": state.get("memory", [])}
                else:
                    print(f"Empty response received on attempt {retry_count + 1}, retrying...")
                    retry_count += 1
            except Exception as e:
                last_error = e
                print(f"Error with tool binding on attempt {retry_count + 1}: {str(e)}")
                retry_count += 1
        
        # If we're here, tool-based approach failed. Try without tools
        print("Tool-based approach failed, trying without tools")
        try:
            # Fallback to regular response without tools
            response = llm.invoke(prompt.format(messages=messages))
            
            # Verify fallback response has content
            if hasattr(response, 'content') and response.content and len(response.content.strip()) > 0:
                print(f"Generated basic response: {response.content[:100]}...")
                return {"messages": messages + [response], "memory": state.get("memory", [])}
        except Exception as e:
            last_error = e
            print(f"Basic LLM call also failed: {str(e)}")
        
        # If we're here, both approaches failed. Create a fallback response
        print("All LLM approaches failed, using fallback response")
        fallback_content = "I apologize, but I'm having trouble connecting to my language service. Please try again in a moment."
        if last_error:
            print(f"Last error encountered: {str(last_error)}")
        fallback_response = AIMessage(content=fallback_content)
        return {"messages": messages + [fallback_response], "memory": state.get("memory", [])}
    
    # Define the graph
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("agent", agent_node)
    
    # Add edges
    workflow.set_entry_point("agent")
    workflow.add_edge("agent", END)
    
    # Compile the graph
    graph = workflow.compile()
    
    return graph

def initialize_state(
    personality_type: str = "Balanced",
    custom_personality: Optional[Dict] = None,
    background_info: Optional[List[str]] = None,
    organization_name: str = "Agentica AI",
    tools_config: Optional[Dict[str, bool]] = None,
) -> AgentState:
    """Initialize the agent state with personality and background information."""
    
    # Set personality
    if custom_personality:
        personality = custom_personality
    else:
        personality = PERSONALITY_PRESETS.get(personality_type, PERSONALITY_PRESETS["Balanced"])
    
    # Set background
    background = background_info or []
    
    # Set default tool settings if not provided
    if tools_config is None:
        tools_config = {
            "background_search": True,
            "memory_storage": True,
            "memory_retrieval": True,
            "web_search": False
        }
        
    # Initialize state
    state: AgentState = {
        "messages": [],
        "personality": personality,
        "background": background,
        "context": {
            "organization_name": organization_name,
            "tools_config": tools_config
        },
        "memory": []  # Initialize empty memory
    }
    
    # Debug print
    print(f"Initialized state with memory: {state['memory']}")
    
    return state

def scrape_website(url: str, max_pages: int = 5) -> List[str]:
    """
    Scrape a website's content and extract relevant information from pages and blog posts.
    
    Args:
        url: The website URL to scrape
        max_pages: Maximum number of pages to scrape
        
    Returns:
        A list of extracted text content from various pages
    """
    # Verify URL format
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    # Initialize the results list and queue of URLs to scrape
    scraped_content = []
    visited_urls = set()
    urls_to_visit = [url]
    
    # Common blog URL patterns to prioritize for scraping
    blog_patterns = [
        r'/blog/', r'/news/', r'/articles/', r'/posts/',
        r'/insights/', r'/resources/', r'/knowledge/',
    ]
    
    try:
        # Set headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        }
        
        # Process URLs until we reach the limit or run out of URLs
        pages_scraped = 0
        while urls_to_visit and pages_scraped < max_pages:
            current_url = urls_to_visit.pop(0)
            
            # Skip if already visited
            if current_url in visited_urls:
                continue
                
            print(f"Scraping: {current_url}")
            
            # Add to visited set
            visited_urls.add(current_url)
            
            # Get page content
            response = requests.get(current_url, headers=headers, timeout=10)
            
            # Skip if not successful
            if response.status_code != 200:
                continue
                
            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract text content from main content areas
            content_containers = soup.select('main, article, .content, .post, .entry, .blog-post, .page-content')
            
            # If no main content areas found, just use the body
            if not content_containers:
                content_containers = [soup.body] if soup.body else []
                
            for container in content_containers:
                # Remove script, style, nav, and footer elements
                for element in container(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                    element.decompose()
                    
                # Extract text and clean it
                text = container.get_text(separator=' ', strip=True)
                
                # Basic cleaning
                text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
                text = re.sub(r'(\n\s*)+', '\n\n', text)  # Normalize new lines
                
                if text and len(text) > 100:  # Avoid empty or very short content
                    # Get page title
                    title = soup.title.string if soup.title else "Untitled Page"
                    
                    # Add URL and title context
                    formatted_content = f"SOURCE: {current_url}\nTITLE: {title}\n\nCONTENT:\n{text[:5000]}"  # Limit length
                    scraped_content.append(formatted_content)
            
            # Find links to other pages on the same domain
            base_domain = urlparse(url).netloc
            
            # Prioritize blog links first
            blog_links = []
            other_links = []
            
            for link in soup.find_all('a', href=True):
                href = link['href']
                absolute_url = urljoin(current_url, href)
                
                # Ensure same domain and not already visited
                parsed_url = urlparse(absolute_url)
                if (parsed_url.netloc == base_domain and 
                    absolute_url not in visited_urls and 
                    absolute_url not in urls_to_visit):
                    
                    # Check if it looks like a blog post
                    is_blog = any(pattern in absolute_url.lower() for pattern in blog_patterns)
                    
                    if is_blog:
                        blog_links.append(absolute_url)
                    else:
                        other_links.append(absolute_url)
            
            # Add blog links first, then other links
            urls_to_visit.extend(blog_links)
            urls_to_visit.extend(other_links)
            
            # Increment counter
            pages_scraped += 1
            
        print(f"Scraped {pages_scraped} pages, found {len(scraped_content)} content sections")
        return scraped_content
        
    except Exception as e:
        print(f"Error scraping website: {str(e)}")
        return [f"Error scraping website: {str(e)}"]

def summarize_background_from_content(content_list: List[str], max_items: int = 10) -> List[str]:
    """
    Summarize scraped content into concise background information points.
    
    Args:
        content_list: List of text content from scraped pages
        max_items: Maximum number of background items to generate
        
    Returns:
        List of background information points
    """
    if not content_list:
        return ["No content could be scraped from the website"]
    
    # Initialize LLM
    llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.3)
    
    # Create the prompt for summarization
    summary_prompt = ChatPromptTemplate.from_template(
        """You are an AI assistant that extracts and summarizes key information about an organization from their website content.

Take the following scraped website content and extract the most important information about the organization's:
1. Mission and values
2. Products or services
3. Key features or benefits
4. Target audience or customers
5. Industry expertise or specializations
6. Company history or founding story (if available)
7. Recent news or developments
8. Leadership team (if available)

Format your response as a list of {max_items} concise but informative bullet points that would serve as background knowledge for an AI representing this organization.
Each bullet point should be self-contained, factual, and provide valuable context about the organization.

SCRAPED CONTENT:
{content}

BACKGROUND INFORMATION POINTS (create exactly {max_items} points):"""
    )
    
    # Combine the content with reasonable length limits
    combined_content = "\n\n---\n\n".join(content_list[:3])  # Start with top 3 items
    
    if len(combined_content) > 12000:  # Trim to fit context window
        combined_content = combined_content[:12000] + "...[content truncated]"
    
    # Generate the summary
    messages = summary_prompt.format_messages(content=combined_content, max_items=max_items)
    response = llm.invoke(messages)
    
    # Split the response into individual bullet points
    bullet_points = []
    for line in response.content.split('\n'):
        line = line.strip()
        if line and (line.startswith('- ') or line.startswith('• ') or re.match(r'^\d+\.', line)):
            # Clean up the bullet point format
            cleaned_line = re.sub(r'^[- •\d\.]+\s*', '', line)
            if cleaned_line:
                bullet_points.append(cleaned_line)
    
    # Ensure we have some results even if parsing failed
    if not bullet_points and response.content.strip():
        # Just use the whole response if we couldn't parse bullet points
        return [response.content.strip()]
    
    return bullet_points[:max_items]  # Limit to requested number of items

def enhance_formatting(response: str, user_message: str) -> str:
    """
    Enhance the formatting of the agent's response to ensure proper Markdown and HTML rendering.
    
    Args:
        response: The original response from the agent
        user_message: The user's message that prompted this response
        
    Returns:
        Enhanced response with proper formatting
    """
    # If response already contains Markdown elements, return as is
    markdown_indicators = [
        "**",          # Bold text
        "*",           # Italic text
        "#",           # Headings
        "- ",          # Unordered list
        "1. ",         # Ordered list
        "```",         # Code blocks
        "`",          # Inline code
        "|",           # Tables
        "[]()",        # Links
        "> ",         # Blockquotes
    ]
    
    # Check if response already has Markdown formatting
    has_markdown = any(indicator in response for indicator in markdown_indicators)
    
    # If response already has Markdown formatting, return as is
    if has_markdown:
        return response
    
    # Check if response contains elements that would benefit from formatting
    needs_formatting = False
    
    # Check for lists (numbered or bullet points)
    list_pattern = re.compile(r'^\d+\.\s|^-\s', re.MULTILINE)
    if list_pattern.search(response):
        needs_formatting = True
    
    # Check for potential headers (short lines followed by longer content)
    lines = response.split('\n')
    for i in range(len(lines) - 1):
        if 1 < len(lines[i]) < 50 and len(lines[i+1]) > 50:
            needs_formatting = True
            break
    
    # Check for potential code snippets
    if "code" in user_message.lower() or "example" in user_message.lower():
        code_indicators = ["{", "}", "(", ")", ";", "=", "function", "def ", "class ", "import ", "from "]
        if any(indicator in response for indicator in code_indicators):
            needs_formatting = True
    
    # Apply basic formatting if needed
    if needs_formatting:
        # Format potential headers
        formatted_lines = []
        for i, line in enumerate(lines):
            if i < len(lines) - 1 and 1 < len(line) < 50 and len(lines[i+1]) > 50 and not line.startswith("#"):
                formatted_lines.append(f"## {line}")
            else:
                formatted_lines.append(line)
        
        # Format potential code blocks
        response = '\n'.join(formatted_lines)
        code_block_pattern = re.compile(r'(```[\w]*\n[\s\S]*?\n```)', re.MULTILINE)
        if not code_block_pattern.search(response) and ("code" in user_message.lower() or "example" in user_message.lower()):
            # Look for potential code blocks (indented lines or lines with code indicators)
            in_code_block = False
            code_block_lines = []
            formatted_response_lines = []
            
            for line in response.split('\n'):
                code_indicators = ["{", "}", "(", ")", ";", "=", "function", "def ", "class ", "import ", "from "]
                is_code_line = any(indicator in line for indicator in code_indicators) or line.startswith("    ")
                
                if is_code_line and not in_code_block:
                    # Start a new code block
                    in_code_block = True
                    code_block_lines = [line]
                elif is_code_line and in_code_block:
                    # Continue the code block
                    code_block_lines.append(line)
                elif not is_code_line and in_code_block:
                    # End the code block
                    in_code_block = False
                    if code_block_lines:
                        # Determine language based on content
                        language = ""
                        if any("def " in line for line in code_block_lines):
                            language = "python"
                        elif any("function" in line for line in code_block_lines):
                            language = "javascript"
                        
                        formatted_response_lines.append(f"```{language}")
                        formatted_response_lines.extend(code_block_lines)
                        formatted_response_lines.append("```")
                        code_block_lines = []
                    formatted_response_lines.append(line)
                else:
                    formatted_response_lines.append(line)
            
            # Handle case where code block is at the end of the response
            if in_code_block and code_block_lines:
                language = ""
                if any("def " in line for line in code_block_lines):
                    language = "python"
                elif any("function" in line for line in code_block_lines):
                    language = "javascript"
                
                formatted_response_lines.append(f"```{language}")
                formatted_response_lines.extend(code_block_lines)
                formatted_response_lines.append("```")
            
            response = '\n'.join(formatted_response_lines)
    
    return response

def process_message(
    state: AgentState,
    message: str,
) -> Tuple[AgentState, str]:
    """Process a user message and return the updated state and response."""
    
    # Ensure memory is initialized
    if "memory" not in state:
        state["memory"] = []
        
    # Add the user message to the state
    human_message = HumanMessage(content=message)
    state["messages"].append(human_message)
    
    # Create agent with configurable model
    # Try to get model from environment variable or use default
    model_name = os.environ.get("LLM_MODEL", "gpt-3.5-turbo")
    agent = create_agent(model_name=model_name)
    
    # Run the agent
    try:
        result = agent.invoke(state)
        
        # Extract the response
        if result["messages"] and len(result["messages"]) > len(state["messages"]):
            # Get the last message (which should be the AI's response)
            ai_message = result["messages"][-1]
            # Extract content based on message type
            if isinstance(ai_message, AIMessage):
                response = ai_message.content
            elif hasattr(ai_message, 'content'):
                response = ai_message.content
            elif isinstance(ai_message, dict) and 'content' in ai_message:
                response = ai_message['content']
            else:
                print(f"Unexpected message format: {type(ai_message)}")
                print(f"Message content: {ai_message}")
                response = "I apologize, but I wasn't able to generate a proper response due to a message format issue."
                
            # Verify response is not empty
            if not response or len(response.strip()) == 0:
                print("Empty response detected in process_message")
                response = "I apologize, but I'm having trouble generating a response right now. Please try again or rephrase your question."
            
            # Ensure response has proper formatting when appropriate
            response = enhance_formatting(response, message)
        else:
            response = "I apologize, but I wasn't able to generate a proper response."
        
        # Update state with any memory changes
        if "memory" in result:
            state["memory"] = result["memory"]
            
        # Debug print to see memory state
        print(f"Memory state: {state['memory']}")
        print(f"Final response: {response[:100]}...")
        
        # Make sure we're returning the updated state from the result
        # Update the state with any changes from the result
        for key in result:
            state[key] = result[key]
            
        return state, response
    except Exception as e:
        import traceback
        print(f"Error in agent execution: {str(e)}")
        print(traceback.format_exc())
        return state, f"I apologize, but I encountered a technical issue while processing your message. Please try again in a moment."