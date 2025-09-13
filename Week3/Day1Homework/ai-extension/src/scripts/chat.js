import { getPrompt } from '../scripts/prompts.js';

// Constants
const INITIAL_SYSTEM_MESSAGE = ``;

class ChatUI {
    constructor() {
        // Grab references
        this.messagesContainer     = document.getElementById('chatMessages');
        this.inputField            = document.getElementById('chatInput');
        this.sendButton            = document.getElementById('sendMessage');
        this.inspectorButton       = document.getElementById('inspectorButton');
    this.tdInspectorButton     = document.getElementById('td-inspectorButton');
    this.generateTestDataButton = document.getElementById('generateTestData');
    this.tdSendButton = document.getElementById('td-sendMessage');
    this.testDataMessages = document.getElementById('testDataMessages');
    this.testDataInput = document.getElementById('testDataInput');
    this.testDataCountInput = document.getElementById('td-count');
        this.resetButton           = document.getElementById('resetChat');
        this.runTestButton         = document.getElementById('runTestButton');
        this.pushAndRunButton      = document.getElementById('pushAndRunButton');

        // Language / Browser dropdown

        // Language / Browser dropdown
        this.languageBindingSelect = document.getElementById('languageBinding');
        this.browserEngineSelect   = document.getElementById('browserEngine');

        // Additional states
        this.selectedDomContent    = null;
        this.isInspecting          = false;
        this.markdownReady         = false;
        this.codeGeneratorType     = 'SELENIUM_JAVA_PAGE_ONLY'; // default 
        this.tokenWarningThreshold = 10000;
        this.selectedModel         = '';
        this.selectedProvider      = '';
        this.generatedCode         = '';

        // Clear existing messages + add initial system message
        this.messagesContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
            </div>
        `;
        this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');

        // Initialize everything
        this.initialize();
        this.initializeMarkdown();
        this.initializeTokenThreshold();
        this.initializeCodeGeneratorType();
    }

    initialize() {
        // Reset chat
        if (this.resetButton) {
            this.resetButton.addEventListener('click', () => {
                this.messagesContainer.innerHTML = '';
                this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');
                this.selectedDomContent = null;
                this.generatedCode = '';
                this.inspectorButton.classList.remove('has-content','active');
                this.inspectorButton.innerHTML = `
                    <i class="fas fa-mouse-pointer"></i>
                    <span>Inspect</span>
                `;
                if (this.tdInspectorButton) {
                    this.tdInspectorButton.classList.remove('has-content','active');
                    this.tdInspectorButton.innerHTML = `
                        <i class="fas fa-mouse-pointer"></i>
                        <span>Inspect</span>
                    `;
                }
                this.isInspecting = false;
                
                // Hide all action buttons
                if (this.runTestButton) this.runTestButton.style.display = 'none';
            });
        }

        // Load stored keys
        chrome.storage.sync.get(
          ['groqApiKey','openaiApiKey','testleafApiKey','selectedModel','selectedProvider'],
          (result) => {
            if (result.groqApiKey)   this.groqAPI   = new GroqAPI(result.groqApiKey);
            if (result.openaiApiKey) this.openaiAPI = new OpenAIAPI(result.openaiApiKey);
            if (result.testleafApiKey) this.testleafAPI = new TestleafAPI(result.testleafApiKey);

            this.selectedModel    = result.selectedModel    || '';
            this.selectedProvider = result.selectedProvider || '';
        });

        // Listen for changes
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.groqApiKey)       this.groqAPI   = new GroqAPI(changes.groqApiKey.newValue);
            if (changes.openaiApiKey)     this.openaiAPI = new OpenAIAPI(changes.openaiApiKey.newValue);
            if (changes.testleafApiKey)   this.testleafAPI = new TestleafAPI(changes.testleafApiKey.newValue);
            if (changes.selectedModel)    this.selectedModel = changes.selectedModel.newValue;
            if (changes.selectedProvider) this.selectedProvider = changes.selectedProvider.newValue;
        });

        // Listen for SELECTED_DOM_CONTENT from content.js
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === 'SELECTED_DOM_CONTENT') {
                this.selectedDomContent = msg.content;
                if (this.inspectorButton) this.inspectorButton.classList.add('has-content');
                if (this.tdInspectorButton) this.tdInspectorButton.classList.add('has-content');
            }
        });

        // Send button
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Inspector button (shared between code generator and testdata tabs)
        const attachInspectorHandler = (btn) => {
            if (!btn) return;
            btn.addEventListener('click', async () => this.toggleInspector());
        };
        attachInspectorHandler(this.inspectorButton);
        attachInspectorHandler(this.tdInspectorButton);

        // Run Test button
        if (this.runTestButton) {
            this.runTestButton.addEventListener('click', () => this.runCucumberTest());
        }

        // Test Data generate buttons
        if (this.generateTestDataButton) {
            this.generateTestDataButton.addEventListener('click', () => this.generateTestData());
        }
        if (this.tdSendButton) {
            this.tdSendButton.addEventListener('click', () => this.generateTestData());
        }

        // Push & Run button
        if (this.pushAndRunButton) {
            this.pushAndRunButton.addEventListener('click', () => this.pushToGitHubAndRun());
        }

    }

    /**
     * Toggle the page inspector by injecting content script and sending a toggle message.
     * Shared by both the main inspector button and the testdata inspector button.
     */
    async toggleInspector() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                console.log('Cannot use inspector on this page');
                return;
            }
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/content/content.js']
                });
            } catch (error) {
                if (!error.message.includes('already been injected')) {
                    throw error;
                }
            }
            const port = chrome.tabs.connect(tab.id);
            port.postMessage({ type: 'TOGGLE_INSPECTOR', reset: true });
            this.isInspecting = !this.isInspecting;
            this.updateInspectorButtonState();
        } catch (error) {
            console.error('Inspector error:', error);
            this.addMessage('Failed to activate inspector. Please refresh and try again.', 'system');
            this.isInspecting = false;
            this.updateInspectorButtonState();
        }
    }

    // ===================
    // Markdown / Parsing
    // ===================
    initializeMarkdown() {
        const checkLibraries = setInterval(() => {
            if (window.marked && window.Prism) {
                
                window.marked.setOptions({
                    highlight: (code, lang) => {
                        // Normalize language name
                        let normalizedLang = lang?.toLowerCase().trim();
                        
                        // Map common language aliases
                        const languageMap = {
                            'feature': 'gherkin',
                            'cucumber': 'gherkin',
                            'bdd': 'gherkin'
                        };
                        
                        if (languageMap[normalizedLang]) {
                            normalizedLang = languageMap[normalizedLang];
                        }
                        
                        if (normalizedLang && Prism.languages[normalizedLang]) {
                            try {
                                return Prism.highlight(code, Prism.languages[normalizedLang], normalizedLang);
                            } catch (e) {
                                console.error('Prism highlight error:', e);
                                return code;
                            }
                        }
                        return code;
                    },
                    langPrefix: 'language-',
                    breaks: true,
                    gfm: true
                });
                const renderer = new marked.Renderer();
            renderer.code = (code, language) => {
                console.log('🎨 Rendering code block:', { language, codeLength: code?.length });
                
                if (typeof code === 'object') {
                    if (code.text) {
                        code = code.text;
                    } else if (code.raw) {
                        code = code.raw.replace(/^```[\\w]*\\n/, '').replace(/\\n```$/, '');
                    } else {
                        code = JSON.stringify(code, null, 2);
                    }
                }
                
                // Normalize language name
                let validLanguage = language?.toLowerCase().trim() || 'typescript';
                console.log('Original language:', language, '-> Normalized:', validLanguage);
                
                // Map common language aliases
                const languageMap = {
                    'feature': 'gherkin',
                    'cucumber': 'gherkin',
                    'bdd': 'gherkin',
                    'js': 'javascript',
                    'ts': 'typescript',
                    'py': 'python',
                    'cs': 'csharp'
                };
                
                if (languageMap[validLanguage]) {
                    console.log('Language mapped:', validLanguage, '->', languageMap[validLanguage]);
                    validLanguage = languageMap[validLanguage];
                }
                
                let highlighted = code;
                
                // Check if Prism language is available
                if (validLanguage && Prism.languages[validLanguage]) {
                    try {
                        console.log('Highlighting with Prism for language:', validLanguage);
                        highlighted = Prism.highlight(code, Prism.languages[validLanguage], validLanguage);
                        console.log('✅ Highlighting successful');
                    } catch (e) {
                        console.error('❌ Highlighting failed for', validLanguage, ':', e);
                        highlighted = code;
                    }
                } else {
                    console.warn('⚠️ Language not supported by Prism:', validLanguage);
                }
                
                const result = `<pre class=\"language-${validLanguage}\"><code class=\"language-${validLanguage}\">${highlighted}</code></pre>`;
                console.log('Final HTML classes:', `language-${validLanguage}`);
                return result;
            };
                window.marked.setOptions({ renderer });
                this.markdownReady = true;
                clearInterval(checkLibraries);
            }
        }, 100);
    }



    parseMarkdown(content) {
        if (!this.markdownReady) {
            return `<pre>${content}</pre>`;
        }
        let textContent;
        if (typeof content === 'string') {
            const match = content.match(/^```(\w+)/);
            textContent = content.replace(/^```\w+/, '```');
        } else if (typeof content === 'object') {
            textContent = content.content || 
                         content.message?.content ||
                         content.choices?.[0]?.message?.content ||
                         JSON.stringify(content, null, 2);
        } else {
            textContent = String(content);
        }
        let processedContent = textContent
            .replace(/&#x60;/g, '`')
            .replace(/&grave;/g, '`')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/```(\w*)/g, '\n```$1\n')
            .replace(/```\s*$/g, '\n```\n')
            .replace(/\n{3,}/g, '\n\n');
        try {
            const renderer = new marked.Renderer();
            renderer.code = (code, language) => {
                if (typeof code === 'object') {
                    if (code.text) {
                        code = code.text;
                    } else if (code.raw) {
                        code = code.raw.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
                    } else {
                        code = JSON.stringify(code, null, 2);
                    }
                }
                const validLanguage = language?.toLowerCase().trim() || 'typescript';
                let highlighted = code;
                if (validLanguage && Prism.languages[validLanguage]) {
                    try {
                        highlighted = Prism.highlight(code, Prism.languages[validLanguage], validLanguage);
                    } catch (e) {
                        console.error('Highlighting failed:', e);
                    }
                }
                return `<pre class="language-${validLanguage}"><code class="language-${validLanguage}">${highlighted}</code></pre>`;
            };
            window.marked.setOptions({ renderer });
            const parsed = window.marked.parse(processedContent);
            
            // Apply syntax highlighting after DOM is updated
            setTimeout(() => {
                const codeBlocks = document.querySelectorAll('pre code[class*="language-"]');
                console.log('📝 Post-parse highlighting for', codeBlocks.length, 'code blocks');
                
                codeBlocks.forEach((block, index) => {
                    // Standard Prism highlighting for all languages
                    try {
                        Prism.highlightElement(block);
                    } catch (e) {
                        console.error('Prism highlighting error:', e);
                    }
                });
            }, 100);
            
            return parsed;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return `<pre>${textContent}</pre>`;
        }
    }



    // =============
    // Send Message
    // =============
    async sendMessage() {
        const userMsg = this.inputField.value.trim();
        let apiRef = null;
        this.isInspecting = false;
        this.updateInspectorButtonState();
      
        if (this.selectedProvider === 'groq') apiRef = this.groqAPI;
        else if (this.selectedProvider === 'openai') apiRef = this.openaiAPI;
        else apiRef = this.testleafAPI;
        if (!apiRef) {
          this.addMessage(`Please set your ${this.selectedProvider} API key in the Settings tab.`, 'system');
          return;
        }

        if (!this.selectedDomContent) {
            this.addMessage('Please select some DOM on the page first.', 'system');
            return;
        }

        // --- Retain only 3 <option> elements in <select> tags to simulate real data ---
        function stripExtraOptions(selectElement) {
            const options = selectElement.querySelectorAll('option');
            if (options.length > 3) {
                for (let i = 3; i < options.length; i++) {
                    options[i].remove();
                }
            }
        }

        let domContentProcessed = this.selectedDomContent;
        if (typeof domContentProcessed === 'string') {
            // Parse string to DOM
            const parser = new DOMParser();
            const doc = parser.parseFromString(domContentProcessed, 'text/html');
            const selects = doc.querySelectorAll('select');
            selects.forEach(stripExtraOptions);
            // Serialize back to string
            domContentProcessed = doc.body.innerHTML;
        } else if (domContentProcessed instanceof HTMLElement) {
            // Directly process if it's an HTMLElement
            const selects = domContentProcessed.querySelectorAll('select');
            selects.forEach(stripExtraOptions);
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const pageUrl = tab?.url || 'unknown';
            const lang = this.languageBindingSelect.value;
            const eng = this.browserEngineSelect.value;
            const promptKeys = this.getPromptKeys(lang, eng);

            const finalSnippet = typeof domContentProcessed === 'string'
                ? domContentProcessed
                : JSON.stringify(domContentProcessed, null, 2);

            this.sendButton.disabled = true;
            this.inputField.disabled = true;
            this.sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            this.addMessage(userMsg, 'user');
            this.inputField.value = '';

            let combinedContent = '';
            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            for (const key of promptKeys) {
                const builtPrompt = getPrompt(key, {
                    domContent: finalSnippet,
                    pageUrl: pageUrl,
                    userAction: '',
                });

                const finalPrompt = builtPrompt + " Additional Instructions: " + userMsg;
                const resp = await apiRef.sendMessage(finalPrompt, this.selectedModel);
                const returned = resp?.content || resp;
                combinedContent += returned.trim() + '\n\n';

                totalInputTokens += resp.usage?.input_tokens || 0;
                totalOutputTokens += resp.usage?.output_tokens || 0;
            }

            const loader = this.messagesContainer.querySelector('.loading-indicator.active');
            if (loader) loader.remove();

            this.addMessageWithMetadata(combinedContent.trim(), 'assistant', {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens
            });

            this.selectedDomContent = null;
            this.inspectorButton.classList.remove('has-content','active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;
            this.isInspecting = false;
            if (tab) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_SELECTION' });
                } catch (err) {
                    const port = chrome.tabs.connect(tab.id);
                    port.postMessage({ type: 'CLEAR_SELECTION' });
                    port.disconnect();
                }
            }
            this.generatedCode = combinedContent.trim();
        } catch (err) {
            const loader = this.messagesContainer.querySelector('.loading-indicator.active');
            if (loader) loader.remove();
            this.addMessage(`Error: ${err.message}`, 'system');
        } finally {
            this.sendButton.disabled = false;
            this.inputField.disabled = false;
            this.sendButton.innerHTML = 'Generate';
        }
    }

    /**
     * Generate test data (CSV) using TEST_DATA_RANDOM prompt
     */
    async generateTestData() {
        // Basic validation
        if (!this.selectedProvider) {
            this.addMessage('Please set an LLM provider in Settings before generating test data.', 'system');
            return;
        }

        if (!this.selectedDomContent) {
            // show message in testDataMessages area
            if (this.testDataMessages) {
                this.testDataMessages.innerHTML = '<div class="system-message">Please select some DOM on the page first.</div>';
            }
            return;
        }

        // Determine API reference
        let apiRef = null;
        if (this.selectedProvider === 'groq') apiRef = this.groqAPI;
        else if (this.selectedProvider === 'openai') apiRef = this.openaiAPI;
        else apiRef = this.testleafAPI;
        if (!apiRef) {
            if (this.testDataMessages) this.testDataMessages.innerHTML = '<div class="system-message">No API configured. Set API key in Settings.</div>';
            return;
        }

        // Gather options
    const positive = document.getElementById('td-positive')?.checked || false;
    const negative = document.getElementById('td-negative')?.checked || false;
    const optionalInstr = (this.testDataInput?.value || '').trim();
    let count = parseInt(this.testDataCountInput?.value || '5', 10) || 5;
    // clamp count
    if (count < 1) count = 1;
    if (count > 200) count = 200;

        // Prepare DOM snippet
        let domContentProcessed = this.selectedDomContent;
        if (typeof domContentProcessed === 'string') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(domContentProcessed, 'text/html');
            domContentProcessed = doc.body.innerHTML;
        } else if (domContentProcessed instanceof HTMLElement) {
            domContentProcessed = domContentProcessed.outerHTML;
        } else {
            domContentProcessed = String(domContentProcessed);
        }

        try {
            // Show loading state
            if (this.testDataMessages) {
                this.testDataMessages.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><div class="loading-text">Generating test data...</div></div>';
            }

            // Ensure model always includes a 'type' column (values: positive/negative)
            // If neither positive nor negative is explicitly requested, still include the 'type' column
            // and populate with appropriate values (default to positive examples when unspecified).
            const builtPrompt = getPrompt('TEST_DATA_RANDOM', { domContent: domContentProcessed });
            let extraFlags = `\ncount:${count}`;
            extraFlags += `\npositive:${positive}`;
            extraFlags += `\nnegative:${negative}`;

            // If neither checkbox selected, require exact split: floor(count/2) positive, rest negative
            let desiredPositive = null;
            let desiredNegative = null;
            let defaultTypeNote = '';
            if (!positive && !negative) {
                desiredPositive = Math.floor(count / 2);
                desiredNegative = count - desiredPositive;
                defaultTypeNote = `\nNote: Neither positive nor negative was selected. Generate exactly ${desiredPositive} positive and ${desiredNegative} negative records and include a column named "type" with values "positive" or "negative". Return CSV only with a header row.`;
            } else {
                defaultTypeNote = '\nNote: Include a column named "type" with values "positive" or "negative" matching each record.';
            }

            // Provide a short CSV example to make format explicit
            const exampleCsv = '\nExample CSV:\n```csv\nname,email,age,type\nJohn Doe,john@example.com,30,positive\nJane Doe,jane@example.com,25,negative\n```\n';

            const finalPrompt = builtPrompt + " Additional Instructions: " + optionalInstr + extraFlags + defaultTypeNote + exampleCsv;

            const resp = await apiRef.sendMessage(finalPrompt, this.selectedModel);
            let returned = resp?.content || resp;

            // Normalize returned string: strip code fences if present
            if (typeof returned === 'object') returned = JSON.stringify(returned);
            returned = String(returned).trim();
            returned = returned.replace(/^```(?:csv|text)?\s*/i, '').replace(/\s*```$/i, '').trim();

            // Helper: parse CSV into array of objects (naive, handles simple CSV)
            function parseCsv(csv) {
                const lines = csv.split(/\r?\n/).filter(l => l.trim() !== '');
                if (lines.length === 0) return { headers: [], rows: [] };
                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const rows = lines.slice(1).map(line => {
                    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    const obj = {};
                    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
                    return obj;
                });
                return { headers, rows };
            }

            function rowsToCsv(headers, rows) {
                const hdr = headers.join(',');
                const lines = rows.map(r => headers.map(h => {
                    const v = String(r[h] ?? '');
                    return v.includes(',') || v.includes('"') ? '"' + v.replace(/"/g, '""') + '"' : v;
                }).join(','));
                return [hdr, ...lines].join('\n');
            }

            let csvText = returned;
            const parsed = parseCsv(csvText);

            // If we requested exact counts, verify and request missing rows if necessary
            if (desiredPositive !== null && parsed.headers.length > 0) {
                const typeCol = parsed.headers.find(h => h.toLowerCase() === 'type') || 'type';
                const counts = { positive: 0, negative: 0 };
                parsed.rows.forEach(r => {
                    const t = (r[typeCol] || '').toLowerCase();
                    if (t === 'negative') counts.negative++; else counts.positive++;
                });

                const needPositive = Math.max(0, desiredPositive - counts.positive);
                const needNegative = Math.max(0, desiredNegative - counts.negative);

                if (needPositive > 0 || needNegative > 0) {
                    // Request only the missing rows from the model and merge
                    let missingPrompt = `Provide only the missing ${needPositive + needNegative} rows as CSV with the same header: ` + parsed.headers.join(',') + `. `;
                    missingPrompt += `Return ${needPositive} positive and ${needNegative} negative rows (type column should be "positive"/"negative"). Do not include any explanation or markdown.`;
                    const resp2 = await apiRef.sendMessage(builtPrompt + ' Additional Instructions: ' + missingPrompt, this.selectedModel);
                    let returned2 = resp2?.content || resp2;
                    if (typeof returned2 === 'object') returned2 = JSON.stringify(returned2);
                    returned2 = String(returned2).trim().replace(/^```(?:csv|text)?\s*/i, '').replace(/\s*```$/i, '').trim();
                    const parsed2 = parseCsv(returned2);
                    // Merge rows
                    const mergedRows = parsed.rows.concat(parsed2.rows);
                    csvText = rowsToCsv(parsed.headers, mergedRows);
                }
            }

            // Display CSV in testDataMessages
            if (this.testDataMessages) {
                const csvBlock = '```csv\n' + csvText + '\n```';
                this.testDataMessages.innerHTML = this.parseMarkdown(csvBlock);
            }

        } catch (err) {
            console.error('Test data generation error:', err);
            if (this.testDataMessages) this.testDataMessages.innerHTML = `<div class="system-message">Error: ${err.message}</div>`;
        }
    }
      

    // ==============
    // addMessage UI
    // ==============
    addMessage(content, type) {
        if (!content) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${type}-message`;
        if (type === 'system') {
            msgDiv.innerHTML = content;
        } else {
            const markdownDiv = document.createElement('div');
            markdownDiv.className = 'markdown-content';
            markdownDiv.innerHTML = this.parseMarkdown(content);
            msgDiv.appendChild(markdownDiv);
        }
        this.messagesContainer.appendChild(msgDiv);
        if (type === 'user') {
            const loader = document.createElement('div');
            loader.className = 'loading-indicator';
            const genType = this.codeGeneratorType.includes('PLAYWRIGHT') ? 'Playwright' : 'Selenium';
            loader.innerHTML = `
              <div class="loading-spinner"></div>
              <span class="loading-text">Generating ${genType} Code</span>
            `;
            this.messagesContainer.appendChild(loader);
            setTimeout(() => loader.classList.add('active'), 0);
        }
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        const msgCount = this.messagesContainer.querySelectorAll('.chat-message').length;
        if (msgCount > 1 && this.resetButton) {
            this.resetButton.classList.add('visible');
        }
    }

    addMessageWithMetadata(content, type, metadata) {
        if (type !== 'assistant') {
            this.addMessage(content, type);
            return;
        }
        const container = document.createElement('div');
        container.className = 'assistant-message';
        const mdDiv = document.createElement('div');
        mdDiv.className = 'markdown-content';
        mdDiv.innerHTML = this.parseMarkdown(content);
        container.appendChild(mdDiv);
        const metaContainer = document.createElement('div');
        metaContainer.className = 'message-metadata collapsed';
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'metadata-toggle';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'metadata-toggle';
        copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy`;
        copyBtn.onclick = () => {
            const codeBlocks = mdDiv.querySelectorAll('pre code');
            if (codeBlocks.length === 0) {
                copyBtn.innerHTML = `<i class="fas fa-times"></i> No content found`;
                setTimeout(() => { copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy`; }, 2000);
                return;
            }
            let combinedCode = Array.from(codeBlocks).map(block => block.textContent.trim()).join('\n\n');
            combinedCode = combinedCode.replace(/^```[\w-]*\n/, '').replace(/\n```$/, '');
            navigator.clipboard.writeText(combinedCode)
                .then(() => {
                    copyBtn.innerHTML = `<i class="fas fa-check"></i> Copied!`;
                    setTimeout(() => { copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy code`; }, 2000);
                })
                .catch(err => {
                    console.error('Copy failed:', err);
                    copyBtn.innerHTML = `<i class="fas fa-times"></i> Failed to copy`;
                    setTimeout(() => { copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy code`; }, 2000);
                });
        };
        actions.appendChild(toggleBtn);
        actions.appendChild(copyBtn);
        metaContainer.appendChild(actions);
        const details = document.createElement('div');
        details.className = 'metadata-content';
        details.innerHTML = `
          <div class="metadata-row"><span>Input Tokens:</span><span>${metadata.inputTokens}</span></div>
          <div class="metadata-row"><span>Output Tokens:</span><span>${metadata.outputTokens}</span></div>
        `;
        metaContainer.appendChild(details);
        container.appendChild(metaContainer);
        this.messagesContainer.appendChild(container);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        if (this.resetButton) {
            this.resetButton.classList.add('visible');
        }
    }
    
    updateInspectorButtonState() {
        const setState = (btn) => {
            if (!btn) return;
            if (this.isInspecting) {
                btn.classList.add('active');
                btn.innerHTML = `
                    <i class="fas fa-mouse-pointer"></i>
                    <span>Stop</span>
                `;
            } else {
                btn.classList.remove('active');
                if (!this.selectedDomContent) {
                    btn.classList.remove('has-content');
                }
                btn.innerHTML = `
                    <i class="fas fa-mouse-pointer"></i>
                    <span>Inspect</span>
                `;
            }
        };
        setState(this.inspectorButton);
        setState(this.tdInspectorButton);
    }

    getPromptKeys(language, engine) {
        const checkboxes = Array.from(document.querySelectorAll('input[name="javaGenerationMode"]:checked'));
        const promptKeys = [];
        const lang = language?.toLowerCase() || '';
        const eng = engine?.toLowerCase() || '';

        // Extract selected generation modes
        const isFeatureChecked = checkboxes.some(box => box.value === 'FEATURE');
        const isPageChecked = checkboxes.some(box => box.value === 'PAGE');

        // Validate that at least one option is selected
        if (!isFeatureChecked && !isPageChecked) {
            console.warn('No generation mode selected. Defaulting to Page Object generation.');
            // Default fallback to page object generation
            if (this.isJavaSelenium(lang, eng)) {
                promptKeys.push('SELENIUM_JAVA_PAGE_ONLY');
            }
            return promptKeys;
        }

        // Generate appropriate prompt keys based on selections and language/engine combination
        if (isFeatureChecked && isPageChecked) {
            // Both feature and page selected - generate combined output
            if (this.isJavaSelenium(lang, eng)) {
                promptKeys.push('CUCUMBER_WITH_SELENIUM_JAVA_STEPS');
            } 
            
            else {
                // For non-Java/Selenium combinations, generate separately
                promptKeys.push('CUCUMBER_ONLY');
                this.addUnsupportedLanguageMessage(lang, eng);
            }
        } else if (isFeatureChecked) {
            // Feature file only
            promptKeys.push('CUCUMBER_ONLY');
        } else if (isPageChecked) {
            // Page object only
            if (this.isJavaSelenium(lang, eng)) {
                promptKeys.push('SELENIUM_JAVA_PAGE_ONLY');
            }
             else if (this.isplaywrighttypescript(lang, eng)) {
                promptKeys.push('PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY');
            } else {
                this.addUnsupportedLanguageMessage(lang, eng);
            }
        }

        return promptKeys;
    }

    /**
     * Helper method to check if the combination is Java + Selenium
     */
    isJavaSelenium(language, engine) {
        return language === 'java' && engine === 'selenium';
    }
    isplaywrighttypescript(language, engine) {
        return language === 'ts' && engine === 'playwright';
    }

    isCSharpSelenium(language, engine) {
        return language === 'csharp' && engine === 'selenium';
    }

    isPythonSelenium(language, engine) {
        return language === 'python' && engine === 'selenium';
    }

    // typescript/selenium not supported by the selenium webdriver



    /**
     * Helper method to show unsupported language/engine combination message
     */
    addUnsupportedLanguageMessage(language, engine) {
        const message = `⚠️ ${language}/${engine} combination is not yet supported. Only Java/Selenium is currently available.`;
        this.addMessage(message, 'system');
    }

    async initializeCodeGeneratorType() {
        const { codeGeneratorType } = await chrome.storage.sync.get(['codeGeneratorType']);
        if (codeGeneratorType) {
            this.codeGeneratorType = codeGeneratorType;
            const codeGenDrop = document.getElementById('codeGeneratorType');
            if (codeGenDrop) codeGenDrop.value = this.codeGeneratorType;
        }
    }

    async initializeTokenThreshold() {
        const { tokenWarningThreshold } = await chrome.storage.sync.get(['tokenWarningThreshold']);
        if (tokenWarningThreshold) {
            this.tokenWarningThreshold = tokenWarningThreshold;
        }
        const threshInput = document.getElementById('tokenThreshold');
        if (threshInput) {
            threshInput.value = this.tokenWarningThreshold;
            threshInput.addEventListener('change', async (e) => {
                const val = parseInt(e.target.value,10);
                if (val >= 100) {
                    this.tokenWarningThreshold = val;
                    await chrome.storage.sync.set({ tokenWarningThreshold: val });
                } else {
                    e.target.value = this.tokenWarningThreshold;
                }
            });
        }
    }







    async resetChat() {
        try {
            this.messagesContainer.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                </div>
            `;
            this.selectedDomContent = null;
            this.isInspecting       = false;
            this.markdownReady      = false;
            this.inspectorButton.classList.remove('has-content','active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;
            this.inputField.value = '';
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Generate';
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && !tab.url.startsWith('chrome://')) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { type: 'CLEANUP' });
                } catch (err) {
                    console.log('Cleanup error:', err);
                }
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['src/content/content.js']
                    });
                } catch (err) {
                    if (!err.message.includes('already been injected')) {
                        console.error('Re-inject error:', err);
                    }
                }
            }
            if (this.resetButton) {
                this.resetButton.classList.remove('visible');
            }
            if (this.runTestButton) {
                this.runTestButton.style.display = 'none';
            }
            this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');
        } catch (err) {
            console.error('Error resetting chat:', err);
            this.addMessage('Error resetting chat. Please close and reopen.', 'system');
        }
    }
}


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new ChatUI();
});
