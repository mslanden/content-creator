# Integration Guide for Agentica AI

This guide explains how to fully integrate the frontend with the LangGraph backend.

## Current Frontend Status

The frontend is currently operating in "demo mode," which means it simulates AI responses locally without connecting to the backend. This allows for easy testing of the UI without needing to set up the backend or an OpenAI API key.

## Enabling Full Backend Integration

To connect the frontend to the LangGraph backend:

1. **Update the main page component**:

In `src/app/page.tsx`, find this section in the `handleSubmit` function:

```typescript
// Use mock response for now (until API integration is complete)
// In a real app, this would call the API client
// ...mock response generation code...

// NOTE: To use the real API, replace the above code with:
/*
import { useAgent } from "@/contexts/AgentContext";

// In the component:
const { sendMessage, isLoading, messages } = useAgent();

// In handleSubmit:
sendMessage(input);
*/
```

Replace all the mock code with the commented API integration code.

2. **Initialize agent session on page load**:

Add the following code near the top of your page component, after other hooks:

```typescript
import { useAgent } from "@/contexts/AgentContext";

// In the component:
const {
  initializeSession,
  messages: agentMessages,
  isLoading: agentLoading,
  sendMessage
} = useAgent();

// Initialize on mount
useEffect(() => {
  const orgSettings = {
    name: "Agentica AI",
    personality: { type: "Balanced" },
    background: { items: [] }
  };
  
  initializeSession(orgSettings);
}, []);
```

3. **Use agent state instead of local state**:

Update your component to use values from the agent context instead of local state:

```typescript
// Use agent context values for messages and loading state
const displayMessages = agentMessages.length > 0 ? agentMessages : messages;
const isProcessing = isLoading || agentLoading;
```

## Making Settings Changes Update the Agent

To make the agent respond to settings changes:

1. **Update the Settings component**:

In `src/components/Settings.tsx`, modify the `saveSettings` function:

```typescript
import { useAgent } from "@/contexts/AgentContext";

// In the component:
const { updatePersonality, updateBackground, updateOrganizationName } = useAgent();

// Update save settings function
const saveSettings = () => {
  // Local storage updates (existing code)
  localStorage.setItem("aiPersonality", selectedPersonality);
  localStorage.setItem("customPrompt", customPrompt);
  localStorage.setItem("backgroundTexts", JSON.stringify(backgroundTexts));
  
  // Update agent context
  updatePersonality({
    type: selectedPersonality,
    custom: selectedPersonality === "Custom" ? { 
      description: customPrompt,
      tone: "custom",
      style: "custom"
    } : undefined
  });
  
  updateBackground({ items: backgroundTexts });
  
  onClose();
};
```

## Testing the Integration

1. Start the backend:
   ```bash
   export OPENAI_API_KEY=your_api_key_here
   ./run_backend.sh
   ```

2. In another terminal, start the frontend:
   ```bash
   cd agent-chat
   npm run dev
   ```

3. Visit http://localhost:3000 and test the chat functionality

4. If you open your browser's developer tools, you'll see API requests being made to the backend when you send messages.

## Troubleshooting

- If you see CORS errors, ensure the backend allows your frontend origin
- If you see 404 errors, make sure the backend server is running
- If you see authentication errors, check your OpenAI API key
