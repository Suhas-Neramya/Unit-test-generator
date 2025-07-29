document.addEventListener('DOMContentLoaded', () => {
    const plsqlCodeTextarea = document.getElementById('plsql-code');
    const generateButton = document.getElementById('generate-btn');
    const resultDiv = document.getElementById('result');
    const copyButton = document.getElementById('copy-btn');
    
    let isGenerating = false;

    // Configure marked to use highlight.js
    marked.setOptions({
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        }
    });

    // Auto-resize textarea
    plsqlCodeTextarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.max(150, this.scrollHeight) + 'px';
    });

    // Keyboard shortcuts
    plsqlCodeTextarea.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!isGenerating) {
                generateTest();
            }
        }
    });

    generateButton.addEventListener('click', generateTest);

    async function generateTest() {
        const plsqlCode = plsqlCodeTextarea.value.trim();

        if (!plsqlCode) {
            showError('Please enter some PLSQL code.');
            plsqlCodeTextarea.focus();
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
            generateButton.textContent = 'Generating';
            generateButton.classList.add('loading');
            resultDiv.innerHTML = '<p class="loading-dots">Generating test</p>';
            copyButton.style.display = 'none';
        } else {
            generateButton.textContent = 'Generate Test';
            generateButton.classList.remove('loading');
        }
    }

    function showError(message) {
        resultDiv.innerHTML = `<div class="error-message" role="alert">${escapeHTML(message)}</div>`;
        copyButton.style.display = 'none';
    }

    function showSuccess(testContent) {
        try {
            // Use marked to convert Markdown to HTML
            resultDiv.innerHTML = marked.parse(testContent);
            // Highlight the code blocks after they are added to the DOM
            resultDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
            copyButton.style.display = 'block';
            
            // Announce success to screen readers
            const announcement = document.createElement('div');
            announcement.textContent = 'Unit test generated successfully';
            announcement.className = 'sr-only';
            announcement.setAttribute('aria-live', 'polite');
            document.body.appendChild(announcement);
            setTimeout(() => document.body.removeChild(announcement), 1000);
        } catch (error) {
            console.error('Error parsing response:', error);
            showError('Error displaying the generated test. Please try again.');
        }
    }

    // Fetch with timeout utility
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

    // Add functionality to the copy button
    copyButton.addEventListener('click', async () => {
        try {
            const textToCopy = resultDiv.textContent;
            await navigator.clipboard.writeText(textToCopy);
            
            // Provide user feedback
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copied!';
            copyButton.classList.add('success-state');
            
            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.classList.remove('success-state');
            }, 2000);
            
        } catch (err) {
            console.error('Failed to copy text:', err);
            
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = resultDiv.textContent;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = 'Copy Code';
                }, 2000);
            } catch (fallbackErr) {
                copyButton.textContent = 'Copy Failed!';
                setTimeout(() => {
                    copyButton.textContent = 'Copy Code';
                }, 2000);
            }
        }
    });

    // Helper function to escape HTML entities
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
    
    // Network status monitoring
    window.addEventListener('online', () => {
        if (document.querySelector('.error-message')) {
            const errorMsg = document.querySelector('.error-message');
            if (errorMsg.textContent.includes('internet connection')) {
                errorMsg.innerHTML = '<div class="success-message">Connection restored. You can try again.</div>';
            }
        }
    });
}); 