/**
 * settings.js — Settings management, AI provider integration, and reference materials.
 * Stored separately from lab data so API keys are never exported.
 */

const Settings = (() => {
    const STORAGE_KEY = 'labdesigner_settings';

    const defaults = () => ({
        aiProvider: 'builtin',       // builtin | claude | openai | custom
        apiKey: '',
        model: '',
        endpointUrl: '',
        references: [],              // { id, title, type:'url'|'file', url?, content? }
        targetLabDuration: 45,       // minutes
        labDensity: 'moderate',      // light | moderate | heavy
        defaultDifficulty: 'beginner',
    });

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...defaults(), ...parsed };
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
        return defaults();
    }

    function save(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    let _settings = load();

    function get() { return { ..._settings }; }

    // ---- Prompt loader ----
    let _promptsCache = null;

    /**
     * Load and parse prompts.md into a map of { SECTION_ID: promptText }.
     * Sections are delimited by ## SECTION_ID headers and ``` code fences.
     */
    async function loadPrompts() {
        if (_promptsCache) return _promptsCache;
        try {
            const resp = await fetch('prompts.md');
            if (!resp.ok) throw new Error('Failed to load prompts.md');
            const md = await resp.text();
            _promptsCache = parsePromptsMd(md);
        } catch (e) {
            console.warn('Could not load prompts.md, using inline fallbacks:', e);
            _promptsCache = {};
        }
        return _promptsCache;
    }

    function parsePromptsMd(md) {
        const prompts = {};
        // Match sections: ## SECTION_ID — Description\n```\n...content...\n```
        const regex = /^## (\S+)\s.*?\n```[^\n]*\n([\s\S]*?)```/gm;
        let match;
        while ((match = regex.exec(md)) !== null) {
            prompts[match[1]] = match[2].trim();
        }
        return prompts;
    }

    /**
     * Get a prompt by section ID, with template variable substitution.
     * vars is an object like { TARGET_DURATION: '45', PLATFORM: 'azure' }.
     * Falls back to fallbackText if prompts.md didn't contain this section.
     */
    async function getPrompt(sectionId, vars, fallbackText) {
        const prompts = await loadPrompts();
        let text = prompts[sectionId] || fallbackText || '';
        if (vars) {
            for (const [key, value] of Object.entries(vars)) {
                text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
            }
        }
        return text;
    }

    function update(partial) {
        _settings = { ..._settings, ...partial };
        save(_settings);
        return _settings;
    }

    // ---- References ----
    function getReferences() { return _settings.references || []; }

    function addReference(ref) {
        ref.id = ref.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        _settings.references.push(ref);
        save(_settings);
        return ref;
    }

    function removeReference(id) {
        _settings.references = _settings.references.filter(r => r.id !== id);
        save(_settings);
    }

    // ---- AI Provider ----
    function isAIConfigured() {
        return _settings.aiProvider !== 'builtin' && _settings.apiKey.trim().length > 0;
    }

    function getProviderConfig() {
        const p = _settings.aiProvider;
        let url, headers, model;

        if (p === 'claude') {
            url = 'https://api.anthropic.com/v1/messages';
            model = _settings.model || 'claude-sonnet-4-20250514';
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': _settings.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            };
        } else if (p === 'openai') {
            url = 'https://api.openai.com/v1/chat/completions';
            model = _settings.model || 'gpt-4o';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${_settings.apiKey}`,
            };
        } else if (p === 'custom') {
            url = _settings.endpointUrl;
            model = _settings.model || 'default';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${_settings.apiKey}`,
            };
        } else {
            return null;
        }

        return { provider: p, url, model, headers };
    }

    /**
     * Send a prompt to the configured AI provider and return the text response.
     * Returns null on error.
     */
    async function callAI(systemPrompt, userPrompt) {
        const config = getProviderConfig();
        if (!config) return null;

        try {
            let body, extractText;

            if (config.provider === 'claude') {
                body = JSON.stringify({
                    model: config.model,
                    max_tokens: 8192,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: userPrompt }],
                });
                extractText = (data) => data.content?.[0]?.text || null;

            } else {
                // OpenAI-compatible (openai + custom)
                body = JSON.stringify({
                    model: config.model,
                    max_tokens: 8192,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                });
                extractText = (data) => data.choices?.[0]?.message?.content || null;
            }

            const resp = await fetch(config.url, {
                method: 'POST',
                headers: config.headers,
                body,
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.error('AI API error:', resp.status, errText);
                return null;
            }

            const data = await resp.json();
            return extractText(data);

        } catch (e) {
            console.error('AI API call failed:', e);
            return null;
        }
    }

    /**
     * Send a multi-turn conversation to the AI.
     * messages: array of { role: 'user'|'assistant', content: string }
     * Returns the assistant's response text, or null on error.
     */
    async function callAIConversation(systemPrompt, messages) {
        const config = getProviderConfig();
        if (!config) return null;

        try {
            let body, extractText;

            if (config.provider === 'claude') {
                body = JSON.stringify({
                    model: config.model,
                    max_tokens: 8192,
                    system: systemPrompt,
                    messages: messages,
                });
                extractText = (data) => data.content?.[0]?.text || null;
            } else {
                body = JSON.stringify({
                    model: config.model,
                    max_tokens: 8192,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages,
                    ],
                });
                extractText = (data) => data.choices?.[0]?.message?.content || null;
            }

            const resp = await fetch(config.url, {
                method: 'POST',
                headers: config.headers,
                body,
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.error('AI API error:', resp.status, errText);
                return null;
            }

            const data = await resp.json();
            return extractText(data);

        } catch (e) {
            console.error('AI conversation call failed:', e);
            return null;
        }
    }

    // ---- Conversation system prompt ----
    async function getDesignConversationSystemPrompt() {
        const refContext = buildReferenceContext();
        const settings = get();

        const prompt = await getPrompt('STEP1_SYSTEM', {
            REFERENCE_CONTEXT: refContext ? `\nThe user has attached reference materials that should inform your recommendations:\n${refContext}` : '',
            TARGET_DURATION: String(settings.targetLabDuration || 45),
            LAB_DENSITY: settings.labDensity || 'moderate',
        });

        return prompt;
    }

    /**
     * Get the initial welcome message for the chat from prompts.md.
     */
    async function getWelcomeMessage() {
        return await getPrompt('STEP1_WELCOME', {},
            'Welcome to the Lab Program Builder! Tell me about the training program you want to create.\n\nWhat program would you like to build?'
        );
    }

    /**
     * Test the AI connection with a simple prompt.
     * Returns { success: true, message } or { success: false, message }.
     */
    async function testConnection() {
        const config = getProviderConfig();
        if (!config) return { success: false, message: 'No AI provider configured.' };

        const result = await callAI(
            'You are a test assistant. Respond with exactly: CONNECTION_OK',
            'Test connection. Reply with CONNECTION_OK.'
        );

        if (result && result.includes('CONNECTION_OK')) {
            return { success: true, message: `Connected to ${config.provider} (${config.model})` };
        } else if (result) {
            return { success: true, message: `Connected — got response from ${config.provider}` };
        }
        return { success: false, message: 'Connection failed. Check your API key and endpoint.' };
    }

    // ---- Reference context for AI prompts ----
    function buildReferenceContext() {
        const refs = getReferences();
        if (refs.length === 0) return '';

        let ctx = '\n\n--- REFERENCE MATERIALS ---\n';
        refs.forEach((ref, i) => {
            ctx += `\n[Reference ${i + 1}: ${ref.title}]\n`;
            if (ref.type === 'url') {
                ctx += `Source URL: ${ref.url}\n`;
            }
            if (ref.content) {
                // Truncate long content to ~3000 chars per reference
                const text = ref.content.length > 3000 ? ref.content.slice(0, 3000) + '...(truncated)' : ref.content;
                ctx += text + '\n';
            }
        });
        return ctx;
    }

    // ---- AI Prompts ----

    /**
     * Use AI to analyze a program description and extract skills.
     * Returns the same format as Catalog.analyzeProgram() or null on failure.
     */
    async function aiAnalyzeProgram(description, platform) {
        const refContext = buildReferenceContext();
        const domains = Catalog.getDomains();
        const domainList = domains.map(d =>
            `- ${d.name}: ${d.skills.map(s => s.name).join(', ')}`
        ).join('\n');

        const systemPrompt = `You are a learning program designer for cloud hands-on labs. Given a program description, extract the relevant skills and topics needed, and detect the target cloud platform.

Available skill domains and skills:
${domainList}

You MUST respond with valid JSON only — no markdown, no explanation. Use this exact format:
{
  "platform": "azure|aws|gcp|multi",
  "skillsByDomain": {
    "domainId": {
      "domainName": "Domain Name",
      "skills": ["Skill Name 1", "Skill Name 2"]
    }
  }
}

Only include domains that have matched skills. Use the exact skill names from the list above.`;

        const userPrompt = `Program description: "${description}"
${platform !== 'auto' ? `Preferred platform: ${platform}` : 'Auto-detect platform.'}
${refContext}

Analyze this program and return the JSON with matched skills.`;

        const response = await callAI(systemPrompt, userPrompt);
        if (!response) return null;

        try {
            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.platform && parsed.skillsByDomain) return parsed;
        } catch (e) {
            console.error('Failed to parse AI skills response:', e);
        }
        return null;
    }

    /**
     * Use AI to generate lab outlines for a set of skills.
     * designContext: optional object from the conversation design summary for richer context.
     * Returns array in the same format as Catalog.generateLabOutlines() or null on failure.
     */
    async function aiGenerateOutlines(skills, platform, audienceLevel, designContext) {
        const settings = get();
        const refContext = buildReferenceContext();
        const targetDuration = settings.targetLabDuration || 45;
        const density = settings.labDensity || 'moderate';

        const densityInstruction = await getPrompt(
            density === 'light' ? 'DENSITY_LIGHT' : density === 'heavy' ? 'DENSITY_HEAVY' : 'DENSITY_MODERATE',
            {},
            'Generate about 1 lab per skill.'
        );

        // Build design context block if available
        let designBlock = '';
        if (designContext) {
            designBlock = `
PROGRAM DESIGN CONTEXT (from the conversation with the user):
- Program: ${designContext.programName || 'N/A'}
- Description: ${designContext.description || 'N/A'}
- Audience Level: ${designContext.audienceLevel || 'beginner'}
- Platform: ${designContext.platform || platform}
- Delivery Type: ${designContext.deliveryType || 'self-paced'}
- Lab Intent: ${designContext.labIntent || 'learn'}
- Desired Outcome: ${designContext.desiredOutcome || 'general-learning'}
- Audience Assumptions: ${designContext.audienceAssumptions || 'No assumptions specified'}
- Notes: ${designContext.notes || 'None'}

IMPORTANT DESIGN RULES:
- The labs you generate MUST be directly relevant to this program description.
- Tailor lab style to the LAB INTENT:
  * "learn" labs: guided exploration with detailed step-by-step instructions
  * "practice" labs: provide scenario and goals with moderate guidance
  * "validate" labs: challenge-based with minimal instructions, focus on assessment/scoring
- Tailor to DELIVERY TYPE:
  * "instructor-led": include instructor demo notes, discussion prompts
  * "self-paced": ensure all context is self-contained in instructions
- Tailor to DESIRED OUTCOME:
  * "certification-prep": align tasks with exam objectives
  * "job-readiness": use realistic workplace scenarios
- Do NOT generate generic cloud labs. Lab titles, descriptions, tasks, and activities should all be tailored to this specific program.`;
        }

        const difficulty = audienceLevel === 'mixed' ? 'intermediate' : audienceLevel;

        const systemPrompt = await getPrompt('STEP3_SYSTEM', {
            DENSITY_INSTRUCTION: densityInstruction,
            TARGET_DURATION: String(targetDuration),
            AUDIENCE_LEVEL: audienceLevel,
            PLATFORM: platform,
            DESIGN_CONTEXT: designBlock,
            DIFFICULTY: difficulty,
        });

        const userPrompt = await getPrompt('STEP3_USER', {
            SKILLS_LIST: skills.join(', '),
            REFERENCE_CONTEXT: refContext,
        }, `Generate lab outlines for these skills: ${skills.join(', ')}\n${refContext}\n\nReturn ONLY the JSON array.`);

        const response = await callAI(systemPrompt, userPrompt);
        if (!response) return null;

        try {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) return null;
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) return parsed;
        } catch (e) {
            console.error('Failed to parse AI outlines response:', e);
        }
        return null;
    }

    /**
     * Use AI to generate a PowerShell environment build script based on the
     * unified environment (VMs + cloud resources) from the lab outlines.
     * Returns a PowerShell script string, or null on failure.
     */
    async function aiGenerateBuildScript(unifiedEnv, designContext) {
        const platform = unifiedEnv.platform || 'azure';
        const vms = unifiedEnv.vms || [];
        const resources = unifiedEnv.cloudResources || [];

        const vmList = vms.map(vm => `- ${vm.name} (${vm.os})`).join('\n');
        const resList = resources.map(r => `- ${r.type}: ${r.name}`).join('\n');

        let designBlock = '';
        if (designContext) {
            designBlock = `\nProgram: ${designContext.programName || 'Lab Program'}\nDescription: ${designContext.description || 'N/A'}`;
        }

        const systemPrompt = await getPrompt('STEP4_BUILD_SCRIPT_SYSTEM', {}, '');
        const userPrompt = await getPrompt('STEP4_BUILD_SCRIPT_USER', {
            PLATFORM: platform,
            DESIGN_CONTEXT: designBlock,
            VM_LIST: vmList || '(none)',
            RESOURCE_LIST: resList || '(none)',
            CREDENTIALS: unifiedEnv.credentials || 'Standard lab credentials',
        });

        const response = await callAI(systemPrompt, userPrompt);
        if (!response) return null;

        // Strip markdown fences if present
        let script = response.trim();
        script = script.replace(/^```(?:powershell|ps1)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        return script;
    }

    return {
        get,
        update,
        isAIConfigured,
        testConnection,
        callAI,
        callAIConversation,
        getDesignConversationSystemPrompt,
        getReferences,
        addReference,
        removeReference,
        aiAnalyzeProgram,
        aiGenerateOutlines,
        aiGenerateBuildScript,
        loadPrompts,
        getPrompt,
        getWelcomeMessage,
    };
})();
