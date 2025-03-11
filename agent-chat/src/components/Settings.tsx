import { useState, useEffect } from 'react';
import { getPersonalityPresets, scrapeWebsite, PersonalitySettings, BackgroundInfo, WebsiteScrapeRequest } from '../lib/agent-api';

interface SettingsProps {
  initialTab: 'AI Personality' | 'Background Knowledge' | 'Available Tools';
  onClose: () => void;
}

interface PersonalityOption {
  title: string;
  description: string;
  icon: string;
}

export default function Settings({ initialTab, onClose }: SettingsProps) {
  // Ensure onClose is defined
  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    } else {
      console.error('onClose is not a function');
    }
  };
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedPersonality, setSelectedPersonality] = useState('Balanced');
  const [customInstructions, setCustomInstructions] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [backgroundInfo, setBackgroundInfo] = useState('');
  const [backgroundItems, setBackgroundItems] = useState<string[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Default tool settings
  const defaultToolSettings = {
    backgroundSearch: true,
    memoryStorage: true,
    memoryRetrieval: true,
    webSearch: false
  };

  // Tool settings - initialize with default values
  const [enabledTools, setEnabledTools] = useState(defaultToolSettings);
  
  // Load tool settings from localStorage in a useEffect
  useEffect(() => {
    try {
      const savedTools = localStorage.getItem('enabledTools');
      if (savedTools) {
        // Parse saved tools and merge with defaults to ensure all properties exist
        const parsedTools = JSON.parse(savedTools);
        setEnabledTools({
          ...defaultToolSettings,
          ...parsedTools
        });
      }
    } catch (error) {
      console.error('Failed to load saved tool settings:', error);
    }
  }, []);

  // Load saved settings on initial render
  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = () => {
    try {
      // Load personality
      const savedPersonality = localStorage.getItem('aiPersonality');
      if (savedPersonality) {
        setSelectedPersonality(savedPersonality);
      }

      // Load custom instructions
      const savedCustomInstructions = localStorage.getItem('customPrompt');
      if (savedCustomInstructions) {
        setCustomInstructions(savedCustomInstructions);
      }

      // Load background items
      const savedBackgroundItems = localStorage.getItem('backgroundTexts');
      if (savedBackgroundItems) {
        const parsedItems = JSON.parse(savedBackgroundItems);
        if (Array.isArray(parsedItems)) {
          setBackgroundItems(parsedItems);
        }
      }
    } catch (error) {
      console.error('Failed to load saved settings:', error);
    }
  };

  const handleScrapeWebsite = async () => {
    if (!websiteUrl.trim()) return;
    
    try {
      setIsScraping(true);
      setScrapeError('');
      
      const request: WebsiteScrapeRequest = {
        url: websiteUrl,
        max_pages: 5,
        max_items: 10
      };
      
      const response = await scrapeWebsite(request);
      
      if (response.status === 'success' && response.background_items.length > 0) {
        setBackgroundItems(prev => [...prev, ...response.background_items]);
        setWebsiteUrl('');
      } else {
        setScrapeError(response.message || 'Failed to extract content from the website.');
      }
    } catch (error) {
      console.error('Error scraping website:', error);
      setScrapeError('Failed to scrape website. Please check the URL and try again.');
    } finally {
      setIsScraping(false);
    }
  };

  const addBackgroundItem = () => {
    if (backgroundInfo.trim()) {
      setBackgroundItems(prev => [...prev, backgroundInfo.trim()]);
      setBackgroundInfo('');
    }
  };

  const removeBackgroundItem = (index: number) => {
    setBackgroundItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveSettings = () => {
    try {
      setIsLoading(true);
      
      // Save personality settings
      localStorage.setItem('aiPersonality', selectedPersonality);
      
      // Save custom instructions if applicable
      if (selectedPersonality === 'Custom') {
        localStorage.setItem('customPrompt', customInstructions);
      } else {
        localStorage.removeItem('customPrompt');
      }
      
      // Save background items
      localStorage.setItem('backgroundTexts', JSON.stringify(backgroundItems));
      
      // Save enabled tools
      localStorage.setItem('enabledTools', JSON.stringify(enabledTools));
      
      // Log successful save
      console.log('Settings saved successfully');

      // Close the modal after successful save
      handleClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const personalityOptions: PersonalityOption[] = [
    {
      title: 'Balanced',
      description: 'A well-rounded AI that balances helpfulness with conciseness',
      icon: '⚖️'
    },
    {
      title: 'Creative',
      description: 'An imaginative AI that excels at generating unique ideas',
      icon: '✨'
    },
    {
      title: 'Precise',
      description: 'A detailed AI that provides thorough, fact-based responses',
      icon: '🎯'
    },
    {
      title: 'Friendly',
      description: 'A warm, conversational AI with an approachable style',
      icon: '😊'
    },
    {
      title: 'Concise',
      description: 'A direct AI that gives brief, to-the-point answers',
      icon: '↗️'
    },
    {
      title: 'Custom',
      description: 'Define a custom personality with your own prompt',
      icon: '✏️'
    }
  ];

  return (
    <div className="settings-modal">
      <div className="settings-content">
        <div className="settings-header">
          <h2>Settings</h2>
          <button onClick={handleClose} className="close-button">×</button>
        </div>

        <div className="settings-tabs">
          <button
            className={activeTab === 'AI Personality' ? 'active' : ''}
            onClick={() => setActiveTab('AI Personality')}
          >
            AI Personality
          </button>
          <button
            className={activeTab === 'Background Knowledge' ? 'active' : ''}
            onClick={() => setActiveTab('Background Knowledge')}
          >
            Background Knowledge
          </button>
          <button
            className={activeTab === 'Available Tools' ? 'active' : ''}
            onClick={() => setActiveTab('Available Tools')}
          >
            Available Tools
          </button>
        </div>

        <div className="settings-body">
          {activeTab === 'AI Personality' && (
            <div className="personality-settings">
              <p className="section-description">
                Choose how you want your AI assistant to respond. Each personality affects the tone, style, and
                approach of your AI.
              </p>
              <div className="personality-grid">
                {personalityOptions.map((option) => (
                  <div 
                    key={option.title} 
                    className={`personality-option ${selectedPersonality === option.title ? 'selected' : ''}`}
                    onClick={() => setSelectedPersonality(option.title)}
                  >
                    <span className="personality-icon">{option.icon}</span>
                    <h3>{option.title}</h3>
                    <p>{option.description}</p>
                  </div>
                ))}
              </div>
              {selectedPersonality === 'Custom' && (
                <div className="custom-instructions">
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Enter custom instructions for your AI..."
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'Background Knowledge' && (
            <div className="background-settings">
              <p className="section-description">
                Add background information that your AI should know about during your conversations. This helps
                provide context for more relevant responses.
              </p>
              <div className="scrape-website">
                <h3>Scrape Website for Background</h3>
                <p>Enter a website URL to automatically extract background information from the organization's website and blog posts.</p>
                <div className="url-input">
                  <input
                    type="text"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                  <button 
                    className="scrape-button" 
                    onClick={handleScrapeWebsite} 
                    disabled={isScraping || !websiteUrl.trim()}
                  >
                    {isScraping ? 'Scraping...' : 'Scrape'}
                  </button>
                </div>
              </div>
              <div className="manual-background">
                <h3>Add Background Information Manually</h3>
                <textarea
                  value={backgroundInfo}
                  onChange={(e) => setBackgroundInfo(e.target.value)}
                  placeholder="Add important information, context, or details that your AI should know..."
                />
                <p className="helper-text">
                  Examples: personal preferences, domain-specific knowledge, or contextual information that's relevant to your interactions.
                </p>
                <div className="background-list">
                  {backgroundItems.length > 0 ? (
                    <ul className="background-items">
                      {backgroundItems.map((item, index) => (
                        <li key={index} className="background-item">
                          {item}
                          <button 
                            className="remove-item" 
                            onClick={() => removeBackgroundItem(index)}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-background">No background information added yet.</p>
                  )}
                </div>
                <button 
                  className="add-background-button" 
                  onClick={addBackgroundItem}
                  disabled={!backgroundInfo.trim()}
                >
                  Add Item
                </button>
                {scrapeError && <p className="error-message">{scrapeError}</p>}
              </div>
            </div>
          )}

          {activeTab === 'Available Tools' && (
            <div className="tools-settings">
              <p className="section-description">
                Configure which tools the AI assistant can use when responding to your messages. Enabling more
                tools gives the assistant more capabilities.
              </p>
              
              <div className="tool-options">
                <div className="tool-option">
                  <div className="tool-icon-container">
                    <span className="tool-icon">📚</span>
                  </div>
                  <div className="tool-details">
                    <h3>Background Search</h3>
                    <p>Search through organization's background information</p>
                  </div>
                  <div className="toggle-switch">
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={enabledTools.backgroundSearch}
                        onChange={(e) => setEnabledTools(prev => ({
                          ...prev,
                          backgroundSearch: e.target.checked
                        }))}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>

                <div className="tool-option">
                  <div className="tool-icon-container">
                    <span className="tool-icon">💾</span>
                  </div>
                  <div className="tool-details">
                    <h3>Memory Storage</h3>
                    <p>Save important information to memory with custom importance levels</p>
                  </div>
                  <div className="toggle-switch">
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={enabledTools.memoryStorage}
                        onChange={(e) => setEnabledTools(prev => ({
                          ...prev,
                          memoryStorage: e.target.checked
                        }))}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>

                <div className="tool-option">
                  <div className="tool-icon-container">
                    <span className="tool-icon">🔍</span>
                  </div>
                  <div className="tool-details">
                    <h3>Memory Retrieval</h3>
                    <p>Search for information stored in memory</p>
                  </div>
                  <div className="toggle-switch">
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={enabledTools.memoryRetrieval}
                        onChange={(e) => setEnabledTools(prev => ({
                          ...prev,
                          memoryRetrieval: e.target.checked
                        }))}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>

                <div className="tool-option">
                  <div className="tool-icon-container">
                    <span className="tool-icon">🌐</span>
                  </div>
                  <div className="tool-details">
                    <h3>Web Search</h3>
                    <p>Search the web for information (not currently implemented)</p>
                  </div>
                  <div className="toggle-switch">
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={enabledTools.webSearch}
                        onChange={(e) => setEnabledTools(prev => ({
                          ...prev,
                          webSearch: e.target.checked
                        }))}
                        disabled={true}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button className="cancel-button" onClick={handleClose}>Cancel</button>
          <button 
            className="save-button" 
            onClick={handleSaveSettings}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}


