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
    function getDesignConversationSystemPrompt() {
        const refContext = buildReferenceContext();
        const settings = get();

        return `You are an expert learning program designer for hands-on technology labs. Your job is to have a conversation with a program manager to understand their training needs and design a lab program.

You can design labs for ANY technology — cloud platforms (Azure, AWS, GCP), AI/ML, DevOps, programming languages, security, data engineering, Kubernetes, databases, networking, or any other technical domain. You are NOT limited to a predefined list of skills.

CONVERSATION GUIDELINES:
1. Start by acknowledging their initial description and asking 2-3 targeted clarifying questions.
2. Ask about: specific technologies/services/tools, audience current skill level, certification alignment, time constraints, specific scenarios or use cases they want covered, whether they need assessment/scoring, desired outcomes.
3. Keep responses concise (3-5 sentences max per message, plus questions).
4. After 2-3 exchanges (when you have enough detail), present a DESIGN SUMMARY.
5. Do NOT ask more than 3 questions at once.
6. Be specific in your questions — don't ask vague open-ended questions.

WHEN YOU HAVE ENOUGH INFORMATION, output a design summary in this exact format (the system parses this):

===DESIGN_SUMMARY===
{
  "programName": "Short program name",
  "description": "One paragraph summary of the program",
  "platform": "azure|aws|gcp|multi|other",
  "audienceSize": 100,
  "audienceLevel": "beginner|intermediate|advanced|mixed",
  "skills": ["Specific Skill 1", "Specific Skill 2", "Specific Skill 3"],
  "topics": [],
  "notes": "Any special considerations"
}
===END_SUMMARY===

SKILL NAMING RULES:
- Generate skill names that are specific and descriptive to the program (e.g., "Azure AI Foundry Agent Development", "Prompt Engineering", "RAG Pipeline Design" — NOT generic names like "Cloud Computing" or "AI").
- Each skill should map to a distinct hands-on lab topic.
- Include 4-8 skills that cover the program comprehensively.
- Put ALL recommended skills in the "skills" array. The "topics" array should only be used for supplementary context that doesn't warrant its own lab.

${refContext ? `\nThe user has attached reference materials that should inform your recommendations:\n${refContext}` : ''}

Target lab duration: ${settings.targetLabDuration || 45} minutes per lab.
Lab density preference: ${settings.labDensity || 'moderate'} (light = fewer longer labs, moderate = balanced, heavy = many shorter labs).

Remember: Be conversational and helpful. Guide the user to a clear, specific program design. Do NOT output the design summary until you have enough information.`;
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

        let densityInstruction;
        if (density === 'light') {
            densityInstruction = 'Generate FEWER labs — combine related skills into single comprehensive labs where possible. Target about 1 lab per 2 skills.';
        } else if (density === 'heavy') {
            densityInstruction = 'Generate MORE labs — split each skill into multiple focused labs covering different aspects. Target about 2 labs per skill.';
        } else {
            densityInstruction = 'Generate about 1 lab per skill.';
        }

        // Build design context block if available
        let designBlock = '';
        if (designContext) {
            designBlock = `
PROGRAM DESIGN CONTEXT (from the conversation with the user):
- Program: ${designContext.programName || 'N/A'}
- Description: ${designContext.description || 'N/A'}
- Audience: ${designContext.audienceSize || '?'} learners, ${designContext.audienceLevel || 'beginner'} level
- Platform: ${designContext.platform || platform}
- Notes: ${designContext.notes || 'None'}

The labs you generate MUST be directly relevant to this program description. Create labs that specifically teach the skills and topics described above — do NOT generate generic cloud labs. The lab titles, descriptions, tasks, and activities should all be tailored to this specific program.`;
        }

        const systemPrompt = `You are an expert hands-on lab designer. Generate detailed, practical lab outlines for the given skills and program context.

CRITICAL: Generate labs that are SPECIFIC to the skills requested. If the skills are about AI agents, generate labs about building AI agents. If about Kubernetes, generate Kubernetes labs. Do NOT substitute generic cloud infrastructure labs.

${densityInstruction}
Target duration per lab: approximately ${targetDuration} minutes.
Audience level: ${audienceLevel}.
Platform: ${platform}.
${designBlock}

You MUST respond with a valid JSON array only — no markdown fences, no explanation text. Each lab object must follow this exact structure:
{
  "enabled": true,
  "skillName": "The Skill Name This Lab Teaches",
  "title": "Specific, Descriptive Lab Title",
  "description": "One paragraph describing what the learner will accomplish",
  "duration": ${targetDuration},
  "difficulty": "${audienceLevel === 'mixed' ? 'intermediate' : audienceLevel}",
  "platform": "${platform}",
  "scoring": [
    { "id": "task-completion", "name": "Task Completion", "description": "Learner marks each task as complete." }
  ],
  "environment": {
    "vms": [{ "name": "VMName", "os": "windows-server|windows-11|ubuntu|centos" }],
    "cloudResources": [{ "type": "Resource Type", "name": "resource-name" }],
    "credentials": "Credential description",
    "notes": "Environment setup notes"
  },
  "tasks": [
    {
      "name": "Task Name",
      "activities": [
        { "title": "Activity title", "instructions": "Detailed step-by-step instructions for this activity." }
      ]
    }
  ]
}

RULES:
- The "skillName" field MUST exactly match one of the requested skills.
- Lab titles must be specific to the skill (e.g., "Build a Customer Service Agent with Azure AI Foundry" NOT "Deploy a Virtual Machine").
- Each lab must have 2-4 tasks with 2-3 activities each.
- Activities must have real, actionable instructions (not placeholders).
- Environment should list the actual cloud resources needed for this specific lab.
- Valid scoring IDs: resource-validation, task-completion, script-check, screenshot, quiz.
- Valid OS values: windows-server, windows-11, ubuntu, centos.
- If a lab doesn't need VMs, use an empty array for vms.`;

        const userPrompt = `Generate lab outlines for these skills: ${skills.join(', ')}
${refContext}

Return ONLY the JSON array.`;

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

        const systemPrompt = `You are a cloud infrastructure automation expert. Generate a PowerShell script that provisions the lab environment described below.

The script will run as a Skillable LifeCycleAction at lab start (Event=10). It must:
1. Authenticate to the cloud platform using lab credentials
2. Create all required cloud resources
3. Output status messages with Write-Host using -ForegroundColor
4. Use proper error handling ($ErrorActionPreference = "Stop")
5. Accept parameters: $LabInstanceId and $ResourceGroupName

For Azure: use Az PowerShell module commands (New-AzResourceGroup, New-AzStorageAccount, etc.)
For AWS: use AWS PowerShell module commands
For GCP: use gcloud CLI or GCP PowerShell module

Use Skillable replacement tokens for credentials:
- @lab.CloudPortalCredential(User1).Username
- @lab.CloudPortalCredential(User1).Password
- @lab.CloudSubscription.TenantId

Generate REAL, working PowerShell commands for each resource — not placeholders or TODOs.
If a resource type doesn't have a direct PowerShell cmdlet, use az CLI commands wrapped in Invoke-Expression or REST API calls.

Return ONLY the PowerShell script — no markdown fences, no explanation.`;

        let designBlock = '';
        if (designContext) {
            designBlock = `\nProgram: ${designContext.programName || 'Lab Program'}\nDescription: ${designContext.description || 'N/A'}`;
        }

        const userPrompt = `Generate a PowerShell build script for this environment:

Platform: ${platform}
${designBlock}

Virtual Machines:
${vmList || '(none)'}

Cloud Resources:
${resList || '(none)'}

Credentials: ${unifiedEnv.credentials || 'Standard lab credentials'}

Return ONLY the PowerShell script.`;

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
    };
})();
