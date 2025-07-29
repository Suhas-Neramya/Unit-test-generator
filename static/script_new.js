document.addEventListener('DOMContentLoaded', () => {
    const plsqlCodeTextarea = document.getElementById('plsql-code');
    const generateButton = document.getElementById('generate-btn');
    const resultDiv = document.getElementById('result');
    const copyButton = document.getElementById('copy-btn');
    const saveButton = document.getElementById('save-btn');
    const downloadButton = document.getElementById('download-btn');
    const clearButton = document.getElementById('clear-btn');
    const formatButton = document.getElementById('format-btn');
    const historyButton = document.getElementById('history-btn');
    const historyModal = document.getElementById('history-modal');
    const modalOverlay = document.getElementById('modal-overlay');
    const closeHistoryButton = document.getElementById('close-history');
    const historyList = document.getElementById('history-list');
    const historySearch = document.getElementById('history-search');
    const clearHistoryButton = document.getElementById('clear-history');
    const resultActions = document.getElementById('result-actions');
    const charCount = document.getElementById('char-count');
    const lineCount = document.getElementById('line-count');
    
    let isGenerating = false;
    let currentResult = null;

    // Configure marked to use highlight.js
    marked.setOptions({
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        }
    });

    // History Management using Cookies
    class HistoryManager {
        constructor() {
            this.storageKey = 'plsql_test_history';
            this.maxHistoryItems = 50;
        }

        saveToHistory(originalCode, generatedTest) {
            const historyItem = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                originalCode: originalCode.substring(0, 500), // Limit size
                generatedTest: generatedTest,
                preview: this.generatePreview(originalCode)
            };

            let history = this.getHistory();
            history.unshift(historyItem);
            
            // Keep only the most recent items
            if (history.length > this.maxHistoryItems) {
                history = history.slice(0, this.maxHistoryItems);
            }

            this.setCookie(this.storageKey, JSON.stringify(history), 30); // 30 days
            this.updateHistoryButton();
        }

        getHistory() {
            const cookieValue = this.getCookie(this.storageKey);
            return cookieValue ? JSON.parse(cookieValue) : [];
        }

        deleteHistoryItem(id) {
            let history = this.getHistory();
            history = history.filter(item => item.id !== id);
            this.setCookie(this.storageKey, JSON.stringify(history), 30);
            this.updateHistoryButton();
        }

        clearHistory() {
            this.setCookie(this.storageKey, '', -1);
            this.updateHistoryButton();
        }

        generatePreview(code) {
            const lines = code.split('\\n');
            const preview = lines.slice(0, 3).join('\\n');
            return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
        }

        setCookie(name, value, days) {
            const expires = new Date();
            expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
        }

        getCookie(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) {
                    return decodeURIComponent(c.substring(nameEQ.length, c.length));
                }
            }
            return null;
        }

        updateHistoryButton() {
            const history = this.getHistory();
            const count = history.length;
            if (count > 0) {
                historyButton.innerHTML = `<i class="fas fa-history"></i> History (${count})`;
                historyButton.classList.add('has-items');
            } else {
                historyButton.innerHTML = `<i class="fas fa-history"></i> History`;
                historyButton.classList.remove('has-items');
            }
        }
    }

    const historyManager = new HistoryManager();

    // Initialize
    historyManager.updateHistoryButton();
    updateStats();

    // Auto-resize textarea and update stats
    plsqlCodeTextarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.max(300, this.scrollHeight) + 'px';
        updateStats();
    });

    function updateStats() {
        const text = plsqlCodeTextarea.value;
        const chars = text.length;
        const lines = text.split('\\n').length;
        
        charCount.textContent = `${chars.toLocaleString()} characters`;
        lineCount.textContent = `${lines} ${lines === 1 ? 'line' : 'lines'}`;
        
        // Update character count color based on limit
        if (chars > 45000) {
            charCount.style.color = 'var(--ifs-error)';
        } else if (chars > 40000) {
            charCount.style.color = 'var(--ifs-warning)';
        } else {
            charCount.style.color = 'var(--color-gray-500)';
        }
    }

    // Keyboard shortcuts
    plsqlCodeTextarea.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!isGenerating) {
                generateTest();
            }
        }
        
        // Tab key handling for better code editing
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            e.target.value = e.target.value.substring(0, start) + '\\t' + e.target.value.substring(end);
            e.target.selectionStart = e.target.selectionEnd = start + 1;
        }
    });

    // Button Event Listeners
    generateButton.addEventListener('click', generateTest);
    clearButton.addEventListener('click', clearInput);
    formatButton.addEventListener('click', formatCode);
    copyButton.addEventListener('click', copyResult);
    saveButton.addEventListener('click', saveToHistory);
    downloadButton.addEventListener('click', downloadResult);
    historyButton.addEventListener('click', showHistory);
    closeHistoryButton.addEventListener('click', hideHistory);
    modalOverlay.addEventListener('click', hideHistory);
    historySearch.addEventListener('input', filterHistory);
    clearHistoryButton.addEventListener('click', clearAllHistory);

    async function generateTest() {
        const plsqlCode = plsqlCodeTextarea.value.trim();

        if (!plsqlCode) {
            showError('Please enter some PLSQL code.');
            plsqlCodeTextarea.focus();
            return;
        }

        if (plsqlCode.length > 50000) {
            showError('Code is too long. Please limit to 50,000 characters.');
            return;
        }

        if (isGenerating) {
            return;
        }

        setLoadingState(true);

        try {
            const response = await fetchWithTimeout('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code: plsqlCode }),
            }, 60000); // 60 second timeout

            const data = await response.json();

            if (response.ok) {
                currentResult = {
                    originalCode: plsqlCode,
                    generatedTest: data.test,
                    timestamp: new Date()
                };
                showSuccess(data.test);
            } else {
                showError(data.error || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Error:', error);
            if (error.name === 'AbortError') {
                showError('Request timed out. Please try again.');
            } else if (!navigator.onLine) {
                showError('No internet connection. Please check your connection and try again.');
            } else {
                showError('An error occurred while connecting to the server. Please try again.');
            }
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(loading) {
        isGenerating = loading;
        generateButton.disabled = loading;
        
        if (loading) {
            generateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span class="btn-text">Generating...</span>';
            generateButton.classList.add('loading');
            resultDiv.innerHTML = '<div class="loading-dots">Generating comprehensive unit tests</div>';
            resultActions.style.display = 'none';
        } else {
            generateButton.innerHTML = '<i class="fas fa-magic"></i><span class="btn-text">Generate Unit Tests</span>';
            generateButton.classList.remove('loading');
        }
    }

    function showError(message) {
        resultDiv.innerHTML = `<div class="error-message" role="alert"><i class="fas fa-exclamation-triangle"></i>${escapeHTML(message)}</div>`;
        resultActions.style.display = 'none';
        currentResult = null;
    }

    function showSuccess(testContent) {
        try {
            // Use marked to convert Markdown to HTML
            resultDiv.innerHTML = marked.parse(testContent);
            // Highlight the code blocks after they are added to the DOM
            resultDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
            resultActions.style.display = 'flex';
            
            // Announce success to screen readers
            announceToScreenReader('Unit test generated successfully');
        } catch (error) {
            console.error('Error parsing response:', error);
            showError('Error displaying the generated test. Please try again.');
        }
    }

    function clearInput() {
        if (confirm('Are you sure you want to clear the input?')) {
            plsqlCodeTextarea.value = '';
            plsqlCodeTextarea.style.height = '300px';
            updateStats();
            plsqlCodeTextarea.focus();
        }
    }

    function formatCode() {
        const code = plsqlCodeTextarea.value;
        if (!code.trim()) return;
        
        // Basic SQL formatting
        let formatted = code
            .replace(/\\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/;\\s*/g, ';\\n') // New line after semicolons
            .replace(/\\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\\b/gi, '\\n$1')
            .replace(/\\b(AND|OR)\\b/gi, '\\n  $1')
            .trim();
        
        plsqlCodeTextarea.value = formatted;
        updateStats();
    }

    async function copyResult() {
        if (!currentResult) return;
        
        try {
            const textToCopy = resultDiv.textContent;
            await navigator.clipboard.writeText(textToCopy);
            
            showButtonFeedback(copyButton, 'Copied!', 'fas fa-check');
        } catch (err) {
            console.error('Failed to copy text:', err);
            // Fallback for older browsers
            fallbackCopy(resultDiv.textContent);
        }
    }

    function saveToHistory() {
        if (!currentResult) return;
        
        historyManager.saveToHistory(currentResult.originalCode, currentResult.generatedTest);
        showButtonFeedback(saveButton, 'Saved!', 'fas fa-check');
        announceToScreenReader('Test saved to history');
    }

    function downloadResult() {
        if (!currentResult) return;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `plsql-unit-test-${timestamp}.sql`;
        const content = `-- PLSQL Unit Test Generated on ${new Date().toLocaleString()}\\n-- Original Code:\\n/*\\n${currentResult.originalCode}\\n*/\\n\\n-- Generated Unit Tests:\\n${currentResult.generatedTest}`;
        
        downloadFile(filename, content, 'text/plain');
        showButtonFeedback(downloadButton, 'Downloaded!', 'fas fa-check');
    }

    function showHistory() {
        const history = historyManager.getHistory();
        renderHistory(history);
        historyModal.classList.add('active');
        modalOverlay.classList.add('active');
        historySearch.focus();
    }

    function hideHistory() {
        historyModal.classList.remove('active');
        modalOverlay.classList.remove('active');
        historySearch.value = '';
    }

    function renderHistory(history) {
        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No History Yet</h3>
                    <p>Generate some unit tests to see them appear here.</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = history.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-header">
                    <div class="history-item-date">${formatDate(item.timestamp)}</div>
                    <div class="history-item-actions">
                        <button title="Load this code" onclick="loadHistoryItem(${item.id})">
                            <i class="fas fa-upload"></i>
                        </button>
                        <button title="Copy test" onclick="copyHistoryItem(${item.id})">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button title="Delete" onclick="deleteHistoryItem(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="history-item-preview">${escapeHTML(item.preview)}</div>
            </div>
        `).join('');
    }

    function filterHistory() {
        const searchTerm = historySearch.value.toLowerCase();
        const history = historyManager.getHistory();
        const filtered = history.filter(item => 
            item.preview.toLowerCase().includes(searchTerm) ||
            item.originalCode.toLowerCase().includes(searchTerm)
        );
        renderHistory(filtered);
    }

    function clearAllHistory() {
        if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
            historyManager.clearHistory();
            renderHistory([]);
            announceToScreenReader('History cleared');
        }
    }

    // Global functions for history item actions
    window.loadHistoryItem = function(id) {
        const history = historyManager.getHistory();
        const item = history.find(h => h.id === id);
        if (item) {
            plsqlCodeTextarea.value = item.originalCode;
            updateStats();
            hideHistory();
            announceToScreenReader('Code loaded from history');
        }
    };

    window.copyHistoryItem = function(id) {
        const history = historyManager.getHistory();
        const item = history.find(h => h.id === id);
        if (item) {
            navigator.clipboard.writeText(item.generatedTest).then(() => {
                announceToScreenReader('Test copied to clipboard');
            });
        }
    };

    window.deleteHistoryItem = function(id) {
        if (confirm('Delete this history item?')) {
            historyManager.deleteHistoryItem(id);
            const history = historyManager.getHistory();
            renderHistory(history);
            announceToScreenReader('History item deleted');
        }
    };

    // Utility Functions
    function showButtonFeedback(button, text, icon) {
        const originalHTML = button.innerHTML;
        button.innerHTML = `<i class="${icon}"></i> ${text}`;
        button.disabled = true;
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.disabled = false;
        }, 2000);
    }

    function downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showButtonFeedback(copyButton, 'Copied!', 'fas fa-check');
        } catch (err) {
            showButtonFeedback(copyButton, 'Copy Failed!', 'fas fa-times');
        }
        document.body.removeChild(textArea);
    }

    function announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.textContent = message;
        announcement.className = 'sr-only';
        announcement.setAttribute('aria-live', 'polite');
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
    }

    function formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    async function fetchWithTimeout(url, options, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // Network status monitoring
    window.addEventListener('online', () => {
        if (document.querySelector('.error-message')) {
            const errorMsg = document.querySelector('.error-message');
            if (errorMsg.textContent.includes('internet connection')) {
                showSuccess('Connection restored. You can try again.');
            }
        }
    });

    // Keyboard shortcuts for modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && historyModal.classList.contains('active')) {
            hideHistory();
        }
    });
});
