/**
 * chat.js — Chat engine for Lab Designer v3.
 * Handles AI conversations across 4 phases with phase-specific system prompts,
 * context injection from prior phases, and structured output parsing.
 *
 * Depends on: Store, Settings, Catalog, Frameworks (all global IIFEs).
 */

const Chat = (() => {

    // ── Phase key mapping ───────────────────────────────────────

    const PHASE_KEYS = {
        1: 'phase1',
        2: 'phase2',
        3: 'phase3',
        4: 'phase4',
    };

    function getPhaseKey(phase) {
        return PHASE_KEYS[phase] || `phase${phase}`;
    }

    // ── Structured output markers ───────────────────────────────

    const MARKERS = {
        1: { start: '===GOALS_SUMMARY===',      end: '===END_GOALS_SUMMARY===' },
        2: { start: '===CURRICULUM===',          end: '===END_CURRICULUM===' },
        3: [
            { start: '===LAB_BLUEPRINTS===',      end: '===END_LAB_BLUEPRINTS===' },
            { start: '===DRAFT_INSTRUCTIONS===',   end: '===END_DRAFT_INSTRUCTIONS===' },
        ],
        4: { start: '===ENVIRONMENT===',          end: '===END_ENVIRONMENT===' },
    };

    // ── System prompt builders ──────────────────────────────────

    function buildSystemPrompt(phase, context) {
        const seatTime = context.seatTime || Settings.get('defaultSeatTime') || 45;
        let prompt = '';

        switch (phase) {
            case 1:
                prompt = _phase1Prompt();
                break;
            case 2:
                prompt = _phase2Prompt(seatTime, context);
                break;
            case 3:
                prompt = _phase3Prompt(seatTime, context);
                break;
            case 4:
                prompt = _phase4Prompt(context);
                break;
            default:
                throw new Error(`Unknown phase: ${phase}`);
        }

        return prompt;
    }

    function _phase1Prompt() {
        return `You are an expert instructional designer. Help the user define their target audiences, business objectives, and learning objectives. When they upload documents (JTAs, job descriptions, task lists), extract competencies and organize them. Ask clarifying questions about who the learners are, what they need to do on the job, and what success looks like. When you have enough info, output a structured block:
\`\`\`
===GOALS_SUMMARY===
{ "audiences": [...], "businessObjectives": [...], "learningObjectives": [...], "competencies": [...] }
===END_GOALS_SUMMARY===
\`\`\`

Only include this block when you feel confident you have enough information. Continue the conversation naturally otherwise.`;
    }

    function _phase2Prompt(seatTime, context) {
        let prompt = `You are an expert curriculum architect. Based on the objectives and competencies from Phase 1, design a curriculum hierarchy (Courses > Modules > Lessons > Topics). Recommend where hands-on labs should be placed. Each lab should target ${seatTime} minutes of seat time.`;

        if (context.frameworkId) {
            prompt += ` When a skill framework is selected, map curriculum items to framework competencies.`;
        }

        prompt += ` Consider the built-in knowledge base for lab templates and environment presets. Output:
\`\`\`
===CURRICULUM===
{ "courses": [{ "title": "...", "modules": [{ "title": "...", "lessons": [{ "title": "...", "topics": [...], "lab": { "name": "...", "rationale": "...", "estimatedDuration": 0 } | null }] }] }] }
===END_CURRICULUM===
\`\`\`

Not every lesson needs a lab. Labs should be placed where hands-on practice is most valuable. Be helpful when the designer wants to consolidate, rename, or reorganize items.`;

        return prompt;
    }

    function _phase3Prompt(seatTime, context) {
        let prompt = `You are an expert lab designer for Skillable. Help finalize lab blueprints. For each lab, confirm the title, write a short description (2-3 sentences), and outline activities (each activity has a title, tasks list, and estimated duration). Activities should have clear action-oriented titles. When asked, generate DRAFT instructions in markdown format with step-by-step guidance. Default lab duration is ${seatTime} minutes. Output:
\`\`\`
===LAB_BLUEPRINTS===
[{ "id": "...", "title": "...", "shortDescription": "...", "estimatedDuration": 0, "activities": [{ "title": "...", "tasks": [...], "duration": 0 }] }]
===END_LAB_BLUEPRINTS===
\`\`\`

And for draft instructions:
\`\`\`
===DRAFT_INSTRUCTIONS===
{ "labId": "...", "markdown": "..." }
===END_DRAFT_INSTRUCTIONS===
\`\`\``;

        // Inject branding context for instruction generation
        const branding = _getBrandingContext();
        if (branding) {
            prompt += `\n\nBranding guidelines for generated instructions:\n${branding}`;
        }

        return prompt;
    }

    function _phase4Prompt(context) {
        return `You are an expert cloud/lab environment architect for Skillable. Design environment templates, generate bills of materials, and write lifecycle scripts. For each lab or group of labs, specify: VMs needed (OS, RAM, software), cloud resources (subscriptions, resource groups), credentials, dummy/practice data files to generate, required licenses. Write platform-specific PowerShell or Bash lifecycle scripts for provisioning. Output:
\`\`\`
===ENVIRONMENT===
{ "templates": [...], "billOfMaterials": [...], "lifecycleScripts": { "templateId": { "platform": "...", "buildScript": "...", "teardownScript": "..." } } }
===END_ENVIRONMENT===
\`\`\`

Focus on environment reusability. Multiple labs should share the same environment template whenever possible — the environment is the hardest part, so reusability is critical.`;
    }

    // ── Context helpers ─────────────────────────────────────────

    function _getBrandingContext() {
        const parts = [];
        const logoUrl = Settings.get('logoUrl');
        const colors = Settings.get('brandColors');
        const fonts = Settings.get('brandFonts');

        if (logoUrl) parts.push(`Logo URL: ${logoUrl}`);
        if (colors) {
            const entries = Object.entries(colors).filter(([, v]) => v);
            if (entries.length) {
                parts.push('Brand colors: ' + entries.map(([k, v]) => `${k}: ${v}`).join(', '));
            }
        }
        if (fonts) {
            const entries = Object.entries(fonts).filter(([, v]) => v);
            if (entries.length) {
                parts.push('Brand fonts: ' + entries.map(([k, v]) => `${k}: ${v}`).join(', '));
            }
        }

        return parts.length ? parts.join('\n') : null;
    }

    function _getGoalsSummaryContext(project) {
        const parts = [];

        if (project.audiences && project.audiences.length) {
            parts.push('Target audiences: ' + project.audiences.map(a => a.role).join(', '));
        }
        if (project.businessObjectives && project.businessObjectives.length) {
            parts.push('Business objectives: ' + project.businessObjectives.join('; '));
        }
        if (project.learningObjectives && project.learningObjectives.length) {
            parts.push('Learning objectives: ' + project.learningObjectives.join('; '));
        }
        if (project.competencies && project.competencies.length) {
            parts.push('Competencies: ' + project.competencies.map(c => c.name).join(', '));
        }

        return parts.length ? parts.join('\n') : null;
    }

    function _getFrameworkContext(project) {
        if (!project.framework) return null;

        try {
            const fw = Frameworks.getById(project.framework);
            if (!fw) return null;
            const lines = [`Skill framework: ${fw.name}`];
            if (fw.domains && fw.domains.length) {
                lines.push('Domains: ' + fw.domains.map(d => d.name).join(', '));
            }
            if (project.frameworkData) {
                lines.push('Framework mapping data: ' + JSON.stringify(project.frameworkData));
            }
            return lines.join('\n');
        } catch {
            return null;
        }
    }

    function _getCatalogContext() {
        try {
            if (typeof Catalog !== 'undefined' && typeof Catalog.toPromptContext === 'function') {
                return Catalog.toPromptContext();
            }
            // Fallback: build a lightweight summary from Catalog.getDomains()
            if (typeof Catalog !== 'undefined' && typeof Catalog.getDomains === 'function') {
                const domains = Catalog.getDomains();
                if (domains && domains.length) {
                    const summary = domains.map(d => {
                        const skills = d.skills ? d.skills.map(s => s.name).join(', ') : '';
                        return `${d.name}: ${skills}`;
                    }).join('\n');
                    return `Available skill domains and lab templates:\n${summary}`;
                }
            }
        } catch {
            // Catalog not available, no context to inject
        }
        return null;
    }

    // ── Message assembly ────────────────────────────────────────

    function buildMessages(phase, projectId) {
        const project = Store.getProject(projectId);
        if (!project) throw new Error(`Project not found: ${projectId}`);

        const context = {
            seatTime: project.seatTime
                ? `${project.seatTime.min}-${project.seatTime.max}`
                : Settings.get('defaultSeatTime') || 45,
            frameworkId: project.framework,
        };

        const messages = [];

        // System prompt
        messages.push({ role: 'system', content: buildSystemPrompt(phase, context) });

        // Context from prior phases
        _injectPhaseContext(messages, phase, project);

        // Chat history
        const phaseKey = getPhaseKey(phase);
        const history = Store.getChatHistory(projectId, phaseKey);
        for (const msg of history) {
            messages.push({ role: msg.role, content: msg.content });
        }

        return messages;
    }

    function _injectPhaseContext(messages, phase, project) {
        // Phase 1 uploads context (always available in phase 1 itself)
        if (phase === 1 && project.uploads && project.uploads.length) {
            const uploadContent = project.uploads
                .filter(u => u.content)
                .map(u => `--- ${u.name} ---\n${u.content}`)
                .join('\n\n');
            if (uploadContent) {
                messages.push({
                    role: 'system',
                    content: `The user has uploaded these documents:\n\n${uploadContent}`,
                });
            }
        }

        // Phase 2 gets: Phase 1 goals, framework, catalog
        if (phase >= 2) {
            const goals = _getGoalsSummaryContext(project);
            if (goals) {
                messages.push({
                    role: 'system',
                    content: `Context from Phase 1 (Audiences & Objectives):\n${goals}`,
                });
            }
        }

        // Framework context for phases 2+
        if (phase >= 2) {
            const fw = _getFrameworkContext(project);
            if (fw) {
                messages.push({ role: 'system', content: fw });
            }
        }

        // Catalog knowledge base for phases 2 and 4
        if (phase === 2 || phase === 4) {
            const catalog = _getCatalogContext();
            if (catalog) {
                messages.push({ role: 'system', content: catalog });
            }
        }

        // Phase 3 gets: Phase 2 curriculum
        if (phase >= 3 && project.curriculum) {
            messages.push({
                role: 'system',
                content: `Curriculum structure from Phase 2 (Design & Configure):\n${JSON.stringify(project.curriculum, null, 2)}`,
            });
        }

        // Phase 4 gets: Phase 3 blueprints
        if (phase >= 4 && project.labBlueprints && project.labBlueprints.length) {
            messages.push({
                role: 'system',
                content: `Lab blueprints from Phase 3 (Organize & Finalize):\n${JSON.stringify(project.labBlueprints, null, 2)}`,
            });
        }
    }

    // ── Send message ────────────────────────────────────────────

    async function sendMessage(phase, projectId, userMessage) {
        const messages = buildMessages(phase, projectId);

        // Append the new user message
        messages.push({ role: 'user', content: userMessage });

        // Persist the user message
        const phaseKey = getPhaseKey(phase);
        Store.addChatMessage(projectId, phaseKey, 'user', userMessage);

        // Call the AI
        const response = await Settings.callAI(messages, { maxTokens: 4096 });

        // Persist the assistant response
        Store.addChatMessage(projectId, phaseKey, 'assistant', response);

        // Parse structured data if present
        const structured = parseStructuredData(response, phase);

        return {
            raw: response,
            display: cleanResponse(response),
            structured,
        };
    }

    // ── Structured data parsing ─────────────────────────────────

    function parseStructuredData(text, phase) {
        switch (phase) {
            case 1:
                return _extractBlock(text, MARKERS[1].start, MARKERS[1].end);
            case 2:
                return _extractBlock(text, MARKERS[2].start, MARKERS[2].end);
            case 3: {
                const blueprints = _extractBlock(text, MARKERS[3][0].start, MARKERS[3][0].end);
                const draft = _extractBlock(text, MARKERS[3][1].start, MARKERS[3][1].end);
                if (!blueprints && !draft) return null;
                return { blueprints, draftInstructions: draft };
            }
            case 4:
                return _extractBlock(text, MARKERS[4].start, MARKERS[4].end);
            default:
                return null;
        }
    }

    function _extractBlock(text, startMarker, endMarker) {
        const pattern = new RegExp(
            _escapeRegex(startMarker) + '([\\s\\S]*?)' + _escapeRegex(endMarker)
        );
        const match = text.match(pattern);
        if (!match) return null;

        try {
            return JSON.parse(match[1].trim());
        } catch {
            console.warn('[Chat] Failed to parse structured block between', startMarker, 'and', endMarker);
            return null;
        }
    }

    function _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ── Clean response for display ──────────────────────────────

    function cleanResponse(text) {
        let cleaned = text;

        // Remove all known marker blocks
        const allMarkers = [
            MARKERS[1],
            MARKERS[2],
            ...MARKERS[3],
            MARKERS[4],
        ];

        for (const m of allMarkers) {
            const pattern = new RegExp(
                _escapeRegex(m.start) + '[\\s\\S]*?' + _escapeRegex(m.end),
                'g'
            );
            cleaned = cleaned.replace(pattern, '');
        }

        return cleaned.trim();
    }

    // ── Public API ──────────────────────────────────────────────

    return {
        buildSystemPrompt,
        buildMessages,
        sendMessage,
        parseStructuredData,
        cleanResponse,
        getPhaseKey,
    };
})();
