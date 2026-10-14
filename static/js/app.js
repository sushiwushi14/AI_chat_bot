/**
 * SuperBot — Frontend Application Logic
 * Modern, clean, and stateful LangGraph chat client.
 */

(function () {
  'use strict';

  // ==========================================
  // App State & Configuration
  // ==========================================
  const state = {
    currentThreadId: null,
    conversations: [],
    isStreaming: false,
    abortController: null,
    activeModel: 'qwen/qwen3.8-27b',
    temperature: 0.7,
    systemPrompt: '',
    speechRecognition: null,
    isListening: false,
    activeSpeechUtterance: null,
    theme: localStorage.getItem('superbot_theme') || 'dark'
  };

  // Persona Presets
  const PERSONA_PRESETS = {
    default: 'You are SuperBot, an intelligent, helpful, and friendly AI assistant powered by LangGraph. You provide clear, accurate, and insightful responses.',
    coder: 'You are an elite Principal Software Engineer and Python Architect. You write clean, PEP-8 compliant, production-grade code with error handling, type annotations, and clear explanations.',
    cricket: 'You are a legendary Cricket Strategist and Historian. You possess deep knowledge of cricket rules, batting/bowling mechanics, stats, pitch conditions, and legendary matches.',
    concise: 'You are a highly efficient, direct assistant. Provide the most direct, accurate answer possible without fluff, preambles, or unnecessary pleasantries.',
    custom: ''
  };

  // ==========================================
  // DOM Elements Selection
  // ==========================================
  const elements = {
    // Layout
    appContainer: document.getElementById('app-container'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
    sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
    sidebarBackdrop: document.getElementById('sidebar-backdrop'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    themeMoonIcon: document.getElementById('theme-moon-icon'),
    themeSunIcon: document.getElementById('theme-sun-icon'),

    // Conversations
    newChatBtn: document.getElementById('new-chat-btn'),
    conversationsList: document.getElementById('conversations-list'),
    searchChatsInput: document.getElementById('search-chats-input'),
    chatTitleHeading: document.getElementById('chat-title-heading'),
    currentModelTag: document.getElementById('current-model-tag'),
    sidebarModelBadge: document.getElementById('sidebar-model-badge'),
    modelSelect: document.getElementById('model-select'),

    // Chat Viewport
    messagesViewport: document.getElementById('messages-viewport'),
    messagesContainer: document.getElementById('messages-container'),
    welcomeHero: document.getElementById('welcome-hero'),
    scrollBottomBtn: document.getElementById('scroll-bottom-btn'),

    // Input Area
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    stopStreamBtn: document.getElementById('stop-stream-btn'),
    micBtn: document.getElementById('mic-btn'),
    voiceBanner: document.getElementById('voice-banner'),
    cancelVoiceBtn: document.getElementById('cancel-voice-btn'),
    footerTokenCounter: document.getElementById('footer-token-counter'),

    // Actions & Export
    clearChatBtn: document.getElementById('clear-chat-btn'),
    exportBtn: document.getElementById('export-btn'),
    exportMenu: document.getElementById('export-menu'),
    exportMdBtn: document.getElementById('export-md-btn'),
    exportJsonBtn: document.getElementById('export-json-btn'),

    // Settings Modal
    settingsOpenBtn: document.getElementById('settings-open-btn'),
    settingsModal: document.getElementById('settings-modal'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalSaveBtn: document.getElementById('modal-save-btn'),
    modalResetBtn: document.getElementById('modal-reset-btn'),
    personaPresetSelect: document.getElementById('persona-preset-select'),
    customSystemPrompt: document.getElementById('custom-system-prompt'),
    temperatureSlider: document.getElementById('temperature-slider'),
    tempValue: document.getElementById('temp-value'),
    statusText: document.getElementById('status-text'),
    toastContainer: document.getElementById('toast-container')
  };

  // ==========================================
  // Markdown & Syntax Highlighting Setup
  // ==========================================
  if (window.marked) {
    marked.setOptions({
      renderer: new marked.Renderer(),
      highlight: function (code, lang) {
        if (window.hljs) {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        }
        return code;
      },
      pedantic: false,
      gfm: true,
      breaks: true,
      sanitize: false,
      smartypants: false,
      xhtml: false
    });
  }

  function renderMarkdownSafe(markdownText) {
    if (!window.marked) return escapeHtml(markdownText);
    const rawHtml = marked.parse(markdownText);
    if (window.DOMPurify) {
      return DOMPurify.sanitize(rawHtml, {
        ADD_ATTR: ['target', 'rel'],
        FORBID_TAGS: ['style']
      });
    }
    return rawHtml;
  }

  function escapeHtml(string) {
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================
  // Toast Notifications
  // ==========================================
  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';
    if (type === 'voice') icon = '🎙️';

    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ==========================================
  // Theme Management
  // ==========================================
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('superbot_theme', theme);

    if (theme === 'light') {
      elements.themeMoonIcon.classList.add('hidden');
      elements.themeSunIcon.classList.remove('hidden');
    } else {
      elements.themeMoonIcon.classList.remove('hidden');
      elements.themeSunIcon.classList.add('hidden');
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  // ==========================================
  // Storage & Session Management
  // ==========================================
  function loadConversationsFromStorage() {
    try {
      const data = localStorage.getItem('superbot_conversations');
      state.conversations = data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to parse conversations from localStorage', e);
      state.conversations = [];
    }

    if (state.conversations.length === 0) {
      createNewChat(false);
    } else {
      const lastActiveId = localStorage.getItem('superbot_active_thread');
      const found = state.conversations.find(c => c.id === lastActiveId);
      switchConversation(found ? found.id : state.conversations[0].id);
    }
    renderConversationsList();
  }

  function saveConversationsToStorage() {
    try {
      localStorage.setItem('superbot_conversations', JSON.stringify(state.conversations));
      localStorage.setItem('superbot_active_thread', state.currentThreadId);
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }

  function getCurrentConversation() {
    return state.conversations.find(c => c.id === state.currentThreadId);
  }

  function createNewChat(switchToIt = true) {
    const newThreadId = 'thread_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newChat = {
      id: newThreadId,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      model: state.activeModel,
      messages: []
    };

    state.conversations.unshift(newChat);
    saveConversationsToStorage();
    renderConversationsList();

    if (switchToIt) {
      switchConversation(newThreadId);
      showToast('Created new chat session', 'info', 1800);
    }
    return newChat;
  }

  function switchConversation(threadId) {
    if (state.isStreaming) {
      stopStreaming();
    }

    state.currentThreadId = threadId;
    saveConversationsToStorage();

    const conversation = getCurrentConversation();
    if (!conversation) return;

    // Update Header
    elements.chatTitleHeading.textContent = conversation.title || 'SuperBot Assistant';
    if (conversation.model) {
      state.activeModel = conversation.model;
      elements.modelSelect.value = conversation.model;
      updateModelDisplay(conversation.model);
    }

    // Render Messages
    renderMessages(conversation.messages || []);
    renderConversationsList();

    // Close mobile sidebar if open
    closeMobileSidebar();
  }

  function deleteConversation(threadId, e) {
    if (e) e.stopPropagation();
    
    if (confirm('Are you sure you want to delete this conversation?')) {
      state.conversations = state.conversations.filter(c => c.id !== threadId);
      
      // Also request server to clear checkpointer
      fetch(`/api/threads/${threadId}/clear`, { method: 'POST' }).catch(() => {});

      if (state.currentThreadId === threadId) {
        if (state.conversations.length > 0) {
          switchConversation(state.conversations[0].id);
        } else {
          createNewChat(true);
        }
      } else {
        saveConversationsToStorage();
        renderConversationsList();
      }
      showToast('Conversation deleted', 'info');
    }
  }

  function renameConversation(threadId, e) {
    if (e) e.stopPropagation();
    const conv = state.conversations.find(c => c.id === threadId);
    if (!conv) return;

    const newTitle = prompt('Rename conversation:', conv.title);
    if (newTitle && newTitle.trim()) {
      conv.title = newTitle.trim();
      saveConversationsToStorage();
      renderConversationsList();
      if (state.currentThreadId === threadId) {
        elements.chatTitleHeading.textContent = conv.title;
      }
      showToast('Renamed conversation', 'success');
    }
  }

  function renderConversationsList() {
    const filter = (elements.searchChatsInput.value || '').toLowerCase().trim();
    elements.conversationsList.innerHTML = '';

    const filtered = state.conversations.filter(c => 
      !filter || (c.title || '').toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
      elements.conversationsList.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
          No conversations found
        </div>`;
      return;
    }

    filtered.forEach(conv => {
      const item = document.createElement('div');
      item.className = `conversation-item ${conv.id === state.currentThreadId ? 'active' : ''}`;
      item.onclick = () => switchConversation(conv.id);

      item.innerHTML = `
        <div class="conv-title-wrap">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span class="conv-title">${escapeHtml(conv.title || 'Untitled')}</span>
        </div>
        <div class="conv-actions">
          <button class="conv-action-btn edit" title="Rename conversation" aria-label="Rename">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
          <button class="conv-action-btn delete" title="Delete conversation" aria-label="Delete">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      `;

      item.querySelector('.edit').onclick = (e) => renameConversation(conv.id, e);
      item.querySelector('.delete').onclick = (e) => deleteConversation(conv.id, e);

      elements.conversationsList.appendChild(item);
    });
  }

  // ==========================================
  // Chat Rendering
  // ==========================================
  function renderMessages(messages) {
    elements.messagesContainer.innerHTML = '';

    if (!messages || messages.length === 0) {
      elements.welcomeHero.classList.remove('hidden');
      return;
    }

    elements.welcomeHero.classList.add('hidden');
    messages.forEach(msg => appendMessageBubble(msg.role, msg.content, msg.metadata, false));
    scrollToBottom(false);
  }

  function appendMessageBubble(role, content, metadata = {}, animate = true) {
    elements.welcomeHero.classList.add('hidden');

    const row = document.createElement('div');
    row.className = `message-row ${role === 'user' ? 'user' : 'bot'}`;
    if (!animate) row.style.animation = 'none';

    if (role === 'user') {
      row.innerHTML = `
        <div class="message-bubble-wrap">
          <div class="message-bubble">
            <p>${escapeHtml(content)}</p>
          </div>
        </div>
        <div class="message-avatar user" title="You">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      `;
    } else {
      const modelName = metadata.model || state.activeModel;
      const elapsed = metadata.elapsed_ms ? `${metadata.elapsed_ms}ms` : '';
      const tokens = metadata.approx_tokens ? `~${metadata.approx_tokens} tokens` : '';

      row.innerHTML = `
        <div class="message-avatar bot" title="SuperBot">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div class="message-bubble-wrap">
          <div class="message-bubble">
            <div class="message-meta">
              <span class="message-sender-name">SuperBot</span>
              <span class="message-model-badge">${escapeHtml(modelName)}</span>
              ${elapsed ? `<span>• ${elapsed}</span>` : ''}
              ${tokens ? `<span>• ${tokens}</span>` : ''}
            </div>
            <div class="markdown-body">${renderMarkdownSafe(content)}</div>
            <div class="message-footer-actions">
              <button class="msg-action-btn copy-msg-btn" title="Copy response">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
              <button class="msg-action-btn speak-msg-btn" title="Read message aloud">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                <span>Read</span>
              </button>
              <button class="msg-action-btn regen-msg-btn" title="Regenerate reply">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </div>
      `;

      // Attach button handlers
      attachMessageActions(row, content);
      enhanceCodeBlocks(row);
    }

    elements.messagesContainer.appendChild(row);
    return row;
  }

  function attachMessageActions(rowElement, textContent) {
    const copyBtn = rowElement.querySelector('.copy-msg-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(textContent).then(() => {
          showToast('Response copied to clipboard', 'success');
          copyBtn.querySelector('span').textContent = 'Copied!';
          setTimeout(() => { copyBtn.querySelector('span').textContent = 'Copy'; }, 2000);
        });
      };
    }

    const speakBtn = rowElement.querySelector('.speak-msg-btn');
    if (speakBtn) {
      speakBtn.onclick = () => toggleSpeechSynthesis(textContent, speakBtn);
    }

    const regenBtn = rowElement.querySelector('.regen-msg-btn');
    if (regenBtn) {
      regenBtn.onclick = () => regenerateLastMessage();
    }
  }

  function enhanceCodeBlocks(container) {
    const pres = container.querySelectorAll('pre');
    pres.forEach(pre => {
      // Check if already enhanced
      if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) {
        return;
      }

      const code = pre.querySelector('code');
      const langClass = code ? Array.from(code.classList).find(c => c.startsWith('language-')) : null;
      const lang = langClass ? langClass.replace('language-', '') : 'code';

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const header = document.createElement('div');
      header.className = 'code-block-header';
      header.innerHTML = `
        <span>${lang.toUpperCase()}</span>
        <button class="code-copy-btn" title="Copy code">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Copy</span>
        </button>
      `;

      const copyBtn = header.querySelector('.code-copy-btn');
      copyBtn.onclick = () => {
        const textToCopy = code ? code.innerText : pre.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
          copyBtn.querySelector('span').textContent = 'Copied!';
          setTimeout(() => { copyBtn.querySelector('span').textContent = 'Copy'; }, 2000);
        });
      };

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });
  }

  // ==========================================
  // Streaming Message Execution
  // ==========================================
  async function sendMessage(textToSend) {
    const text = (textToSend !== undefined ? textToSend : elements.userInput.value).trim();
    if (!text || state.isStreaming) return;

    // Reset input
    elements.userInput.value = '';
    elements.userInput.style.height = 'auto';
    updateTokenCounter();
    elements.sendBtn.disabled = true;

    // Append user message
    const conv = getCurrentConversation();
    if (!conv) return;

    // Auto title if first message
    if (conv.messages.length === 0) {
      conv.title = text.slice(0, 32) + (text.length > 32 ? '...' : '');
      elements.chatTitleHeading.textContent = conv.title;
    }

    conv.messages.push({ role: 'user', content: text, timestamp: new Date().toISOString() });
    saveConversationsToStorage();
    renderConversationsList();

    appendMessageBubble('user', text);
    scrollToBottom(true);

    // Create Assistant Bubble with Typing / Streaming Cursor
    const botRow = document.createElement('div');
    botRow.className = 'message-row bot';
    botRow.innerHTML = `
      <div class="message-avatar bot" title="SuperBot">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div class="message-bubble-wrap">
        <div class="message-bubble">
          <div class="message-meta">
            <span class="message-sender-name">SuperBot</span>
            <span class="message-model-badge">${escapeHtml(state.activeModel)}</span>
            <span class="streaming-tag">• Streaming</span>
          </div>
          <div class="markdown-body" id="current-streaming-body">
            <div class="typing-indicator">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        </div>
      </div>
    `;
    elements.messagesContainer.appendChild(botRow);
    scrollToBottom(true);

    const markdownBody = botRow.querySelector('#current-streaming-body');

    // UI Streaming State
    state.isStreaming = true;
    state.abortController = new AbortController();
    elements.sendBtn.classList.add('hidden');
    elements.stopStreamBtn.classList.remove('hidden');

    let accumulatedText = '';
    let streamStats = null;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: state.abortController.signal,
        body: JSON.stringify({
          thread_id: state.currentThreadId,
          message: text,
          model: state.activeModel,
          temperature: state.temperature,
          system_prompt: state.systemPrompt || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep unfinished chunk in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.error) {
              throw new Error(data.error);
            }

            if (data.token) {
              accumulatedText += data.token;
              // Render partial markdown with streaming cursor
              markdownBody.innerHTML = renderMarkdownSafe(accumulatedText) + '<span class="streaming-cursor"></span>';
              scrollToBottomIfNear();
            }

            if (data.done && data.stats) {
              streamStats = data.stats;
            }
          } catch (jsonErr) {
            console.error('Error parsing SSE JSON chunk:', jsonErr);
          }
        }
      }

      // Finish streaming render
      markdownBody.innerHTML = renderMarkdownSafe(accumulatedText || 'Response completed.');
      enhanceCodeBlocks(botRow);

      // Finalize Message Bubble Metadata & Actions
      const meta = botRow.querySelector('.message-meta');
      const streamingTag = meta.querySelector('.streaming-tag');
      if (streamingTag) streamingTag.remove();

      if (streamStats) {
        const statsSpan = document.createElement('span');
        statsSpan.textContent = `• ${streamStats.elapsed_ms}ms • ~${streamStats.approx_tokens} tokens`;
        meta.appendChild(statsSpan);
      }

      const footerActions = document.createElement('div');
      footerActions.className = 'message-footer-actions';
      footerActions.innerHTML = `
        <button class="msg-action-btn copy-msg-btn" title="Copy response">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Copy</span>
        </button>
        <button class="msg-action-btn speak-msg-btn" title="Read message aloud">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          <span>Read</span>
        </button>
        <button class="msg-action-btn regen-msg-btn" title="Regenerate reply">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
          <span>Regenerate</span>
        </button>
      `;
      botRow.querySelector('.message-bubble').appendChild(footerActions);
      attachMessageActions(botRow, accumulatedText);

      // Save to Conversation History
      conv.messages.push({
        role: 'assistant',
        content: accumulatedText,
        metadata: streamStats || {},
        timestamp: new Date().toISOString()
      });
      saveConversationsToStorage();

    } catch (err) {
      if (err.name === 'AbortError') {
        markdownBody.innerHTML = renderMarkdownSafe(accumulatedText + '\n\n*(Generation stopped by user)*');
        conv.messages.push({
          role: 'assistant',
          content: accumulatedText + ' (Generation stopped)',
          metadata: {},
          timestamp: new Date().toISOString()
        });
        saveConversationsToStorage();
        showToast('Generation stopped', 'info');
      } else {
        markdownBody.innerHTML = `
          <div style="color: var(--accent-red); padding: 8px; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; background: rgba(239, 68, 68, 0.1);">
            <strong>Error:</strong> ${escapeHtml(err.message || 'Failed to complete streaming response.')}
          </div>
        `;
        showToast('Error during generation: ' + err.message, 'error', 4000);
      }
    } finally {
      state.isStreaming = false;
      state.abortController = null;
      elements.stopStreamBtn.classList.add('hidden');
      elements.sendBtn.classList.remove('hidden');
      elements.sendBtn.disabled = !elements.userInput.value.trim();
      scrollToBottom(true);
    }
  }

  function stopStreaming() {
    if (state.abortController) {
      state.abortController.abort();
    }
  }

  function regenerateLastMessage() {
    const conv = getCurrentConversation();
    if (!conv || conv.messages.length === 0 || state.isStreaming) return;

    // Find last user message
    let lastUserIndex = -1;
    for (let i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return;

    const userText = conv.messages[lastUserIndex].content;

    // Remove any trailing assistant message
    if (conv.messages.length > lastUserIndex + 1) {
      conv.messages.splice(lastUserIndex + 1);
    }
    // Remove the user message as well because sendMessage will re-add it
    conv.messages.splice(lastUserIndex, 1);
    saveConversationsToStorage();

    // Re-render chat and send
    renderMessages(conv.messages);
    sendMessage(userText);
  }

  // ==========================================
  // Scrolling Logic
  // ==========================================
  function scrollToBottom(smooth = true) {
    elements.messagesViewport.scrollTo({
      top: elements.messagesViewport.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  function scrollToBottomIfNear() {
    const vp = elements.messagesViewport;
    const distanceToBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
    if (distanceToBottom < 220) {
      vp.scrollTop = vp.scrollHeight;
    }
  }

  function updateScrollBottomBtn() {
    const vp = elements.messagesViewport;
    const distanceToBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
    if (distanceToBottom > 160) {
      elements.scrollBottomBtn.classList.remove('hidden');
    } else {
      elements.scrollBottomBtn.classList.add('hidden');
    }
  }

  // ==========================================
  // Speech-to-Text (Voice Dictation)
  // ==========================================
  function initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      elements.micBtn.title = 'Voice input not supported in this browser';
      elements.micBtn.style.opacity = '0.5';
      return;
    }

    state.speechRecognition = new SpeechRec();
    state.speechRecognition.continuous = true;
    state.speechRecognition.interimResults = true;
    state.speechRecognition.lang = 'en-US';

    state.speechRecognition.onstart = () => {
      state.isListening = true;
      elements.micBtn.classList.add('active');
      elements.voiceBanner.classList.remove('hidden');
      showToast('Voice listening active... Speak now', 'voice');
    };

    state.speechRecognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        const curr = elements.userInput.value;
        elements.userInput.value = curr ? `${curr} ${finalTranscript}` : finalTranscript;
        updateTokenCounter();
        autoResizeTextarea();
        elements.sendBtn.disabled = false;
      }
    };

    state.speechRecognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      stopVoiceRecognition();
      if (event.error !== 'no-speech') {
        showToast('Voice recognition error: ' + event.error, 'error');
      }
    };

    state.speechRecognition.onend = () => {
      stopVoiceRecognition();
    };
  }

  function toggleVoiceRecognition() {
    if (!state.speechRecognition) {
      showToast('Speech recognition is not supported in this browser', 'error');
      return;
    }

    if (state.isListening) {
      stopVoiceRecognition();
    } else {
      try {
        state.speechRecognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition', err);
      }
    }
  }

  function stopVoiceRecognition() {
    state.isListening = false;
    elements.micBtn.classList.remove('active');
    elements.voiceBanner.classList.add('hidden');
    if (state.speechRecognition) {
      try { state.speechRecognition.stop(); } catch (e) {}
    }
  }

  // ==========================================
  // Text-to-Speech (Read Aloud)
  // ==========================================
  function toggleSpeechSynthesis(text, btnElement) {
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech not supported in this browser', 'error');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (state.activeSpeechUtterance) {
        state.activeSpeechUtterance = null;
        if (btnElement) btnElement.classList.remove('active');
        return;
      }
    }

    // Strip Markdown symbols for clean speech audio
    const cleanText = text
      .replace(/[#*`_~\[\]]/g, '')
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      state.activeSpeechUtterance = utterance;
      if (btnElement) btnElement.classList.add('active');
    };

    utterance.onend = () => {
      state.activeSpeechUtterance = null;
      if (btnElement) btnElement.classList.remove('active');
    };

    utterance.onerror = () => {
      state.activeSpeechUtterance = null;
      if (btnElement) btnElement.classList.remove('active');
    };

    window.speechSynthesis.speak(utterance);
  }

  // ==========================================
  // Export Chat
  // ==========================================
  function exportChatAsMarkdown() {
    const conv = getCurrentConversation();
    if (!conv || conv.messages.length === 0) {
      showToast('No messages to export', 'info');
      return;
    }

    let md = `# ${conv.title || 'SuperBot Conversation'}\n\n`;
    md += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

    conv.messages.forEach(msg => {
      const sender = msg.role === 'user' ? '### 👤 User' : '### 🤖 SuperBot';
      md += `${sender}\n\n${msg.content}\n\n---\n\n`;
    });

    downloadFile(md, `${(conv.title || 'chat').replace(/[^a-z0-9_-]/gi, '_')}.md`, 'text/markdown');
    showToast('Exported as Markdown (.md)', 'success');
  }

  function exportChatAsJson() {
    const conv = getCurrentConversation();
    if (!conv) return;

    const json = JSON.stringify(conv, null, 2);
    downloadFile(json, `${(conv.title || 'chat').replace(/[^a-z0-9_-]/gi, '_')}.json`, 'application/json');
    showToast('Exported as JSON (.json)', 'success');
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // UI Helpers & Resizing
  // ==========================================
  function autoResizeTextarea() {
    const ta = elements.userInput;
    ta.style.height = 'auto';
    const newHeight = Math.min(ta.scrollHeight, 160);
    ta.style.height = newHeight + 'px';
  }

  function updateTokenCounter() {
    const chars = elements.userInput.value.length;
    elements.footerTokenCounter.textContent = `${chars} chars`;
  }

  function updateModelDisplay(modelId) {
    elements.currentModelTag.textContent = modelId.split('/').pop();
    if (modelId.includes('qwen') || modelId.includes('oss')) {
      elements.sidebarModelBadge.textContent = '⚡ Ultra Fast';
    } else {
      elements.sidebarModelBadge.textContent = '🧠 OpenAI';
    }
  }

  function toggleMobileSidebar() {
    elements.sidebar.classList.toggle('open');
    elements.sidebarBackdrop.classList.toggle('active');
  }

  function closeMobileSidebar() {
    elements.sidebar.classList.remove('open');
    elements.sidebarBackdrop.classList.remove('active');
  }

  // ==========================================
  // Initialization & Health Check
  // ==========================================
  async function checkBackendHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        elements.statusText.textContent = 'Online';
        elements.statusText.style.color = 'var(--accent-green)';
      }
    } catch (e) {
      elements.statusText.textContent = 'Disconnected';
      elements.statusText.style.color = 'var(--accent-red)';
    }
  }

  function setupEventListeners() {
    // Input & Sending
    elements.userInput.addEventListener('input', () => {
      autoResizeTextarea();
      updateTokenCounter();
      elements.sendBtn.disabled = !elements.userInput.value.trim() || state.isStreaming;
    });

    elements.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    elements.sendBtn.addEventListener('click', () => sendMessage());
    elements.stopStreamBtn.addEventListener('click', () => stopStreaming());

    // Navigation & Layout
    elements.newChatBtn.addEventListener('click', () => createNewChat(true));
    elements.sidebarToggleBtn.addEventListener('click', () => {
      if (window.innerWidth <= 860) {
        toggleMobileSidebar();
      } else {
        elements.sidebar.classList.toggle('collapsed');
      }
    });
    elements.sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
    elements.sidebarBackdrop.addEventListener('click', closeMobileSidebar);
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Search Filter
    elements.searchChatsInput.addEventListener('input', () => renderConversationsList());

    // Model Selector
    elements.modelSelect.addEventListener('change', (e) => {
      state.activeModel = e.target.value;
      updateModelDisplay(state.activeModel);
      const conv = getCurrentConversation();
      if (conv) {
        conv.model = state.activeModel;
        saveConversationsToStorage();
      }
      showToast(`Model switched to ${state.activeModel}`, 'info');
    });

    // Clear Current Chat
    elements.clearChatBtn.addEventListener('click', () => {
      if (confirm('Clear all messages in the current conversation?')) {
        const conv = getCurrentConversation();
        if (conv) {
          conv.messages = [];
          saveConversationsToStorage();
          renderMessages([]);
          fetch(`/api/threads/${conv.id}/clear`, { method: 'POST' }).catch(() => {});
          showToast('Conversation cleared', 'info');
        }
      }
    });

    // Export Dropdown
    elements.exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.exportMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => elements.exportMenu.classList.add('hidden'));
    elements.exportMdBtn.addEventListener('click', () => exportChatAsMarkdown());
    elements.exportJsonBtn.addEventListener('click', () => exportChatAsJson());

    // Scroll to Bottom
    elements.scrollBottomBtn.addEventListener('click', () => scrollToBottom(true));
    elements.messagesViewport.addEventListener('scroll', updateScrollBottomBtn);

    // Starter Prompt Cards
    document.querySelectorAll('.starter-card').forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        if (prompt) sendMessage(prompt);
      });
    });

    // Voice Dictation
    elements.micBtn.addEventListener('click', toggleVoiceRecognition);
    elements.cancelVoiceBtn.addEventListener('click', stopVoiceRecognition);

    // Settings Modal
    elements.settingsOpenBtn.addEventListener('click', () => {
      elements.settingsModal.classList.remove('hidden');
      elements.temperatureSlider.value = state.temperature;
      elements.tempValue.textContent = state.temperature;
      elements.customSystemPrompt.value = state.systemPrompt;
    });

    elements.modalCloseBtn.addEventListener('click', () => {
      elements.settingsModal.classList.add('hidden');
    });

    elements.settingsModal.addEventListener('click', (e) => {
      if (e.target === elements.settingsModal) {
        elements.settingsModal.classList.add('hidden');
      }
    });

    elements.temperatureSlider.addEventListener('input', (e) => {
      elements.tempValue.textContent = e.target.value;
    });

    elements.personaPresetSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (PERSONA_PRESETS[selected] !== undefined) {
        elements.customSystemPrompt.value = PERSONA_PRESETS[selected];
      }
    });

    elements.modalSaveBtn.addEventListener('click', () => {
      state.temperature = parseFloat(elements.temperatureSlider.value);
      state.systemPrompt = elements.customSystemPrompt.value.trim();
      elements.settingsModal.classList.add('hidden');
      showToast('Settings & Persona saved', 'success');
    });

    elements.modalResetBtn.addEventListener('click', () => {
      state.temperature = 0.7;
      state.systemPrompt = '';
      elements.temperatureSlider.value = 0.7;
      elements.tempValue.textContent = '0.7';
      elements.personaPresetSelect.value = 'default';
      elements.customSystemPrompt.value = PERSONA_PRESETS.default;
      showToast('Settings reset to defaults', 'info');
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl + K or Cmd + K: New Chat
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        createNewChat(true);
      }
      // Escape: close modals & export menu
      if (e.key === 'Escape') {
        elements.settingsModal.classList.add('hidden');
        elements.exportMenu.classList.add('hidden');
        closeMobileSidebar();
      }
    });
  }

  // ==========================================
  // App Bootstrapping
  // ==========================================
  function init() {
    applyTheme(state.theme);
    loadConversationsFromStorage();
    initSpeechRecognition();
    setupEventListeners();
    checkBackendHealth();
    updateModelDisplay(state.activeModel);
  }

  // Start app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
