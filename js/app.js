/**
 * app.js — Thin orchestrator for Lab Program Designer v3.
 * Handles navigation, project management, chat dispatch, settings binding,
 * and import/export. Delegates rendering to Phase1-4 controllers.
 *
 * Program selection is handled conversationally in Phase 1 — no sidebar widget.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ── State ──
    let currentProject = null;
    let currentSection = 'phase1';
    let pendingFiles = []; // files waiting to be sent with next message (phase 1)

    // ── DOM helpers ──
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

    // ── Phase number mapping ──
    const PHASE_NUMBERS = { phase1: 1, phase2: 2, phase3: 3, phase4: 4 };

    // ── Phase controllers ──
    const PHASE_CONTROLLERS = {
        1: typeof Phase1 !== 'undefined' ? Phase1 : null,
        2: typeof Phase2 !== 'undefined' ? Phase2 : null,
        3: typeof Phase3 !== 'undefined' ? Phase3 : null,
        4: typeof Phase4 !== 'undefined' ? Phase4 : null,
    };

    // ── Initialize ──
    init();

    function init() {
        // Init all phase controllers
        for (const ctrl of Object.values(PHASE_CONTROLLERS)) {
            if (ctrl && typeof ctrl.init === 'function') ctrl.init();
        }

        Settings.load();

        bindNavigation();
        bindChat('phase1');
        bindChat('phase2');
        bindChat('phase3');
        bindChat('phase4');
        bindFileUpload();
        bindSettings();
        bindProgramName();

        // Load active project (don't auto-create — Phase 1 conversation handles that)
        loadActiveProject();
        renderAll();
        renderChatHistory('phase1');
        showWelcomeIfNeeded();
    }

    // ══════════════════════════════════════════════════════════════
    //  Navigation
    // ══════════════════════════════════════════════════════════════

    function bindNavigation() {
        $$('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                if (section) navigateTo(section);
            });
        });
    }

    function navigateTo(section) {
        currentSection = section;

        // Update nav active states
        $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === section));

        // Show/hide sections
        $$('.phase-section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));

        // Render the appropriate phase or settings
        const phaseNum = PHASE_NUMBERS[section];
        if (phaseNum && currentProject) {
            const ctrl = PHASE_CONTROLLERS[phaseNum];
            if (ctrl && typeof ctrl.render === 'function') {
                ctrl.render(currentProject);
            }
            renderChatHistory(section);
            showPhaseWelcomeIfNeeded(section);
        } else if (section === 'settings') {
            renderSettings();
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  Project Management
    // ══════════════════════════════════════════════════════════════

    function loadActiveProject() {
        currentProject = Store.getActiveProject();
        if (!currentProject) {
            // Create a default project — Phase 1 conversation will name it
            currentProject = Store.createProject('Untitled Program');
        }
        updateProgramNameDisplay();
    }

    function updateProgramNameDisplay() {
        // Program name is handled conversationally — no sidebar field
    }

    function bindProgramName() {
        const nameInput = $('#program-name-input');
        if (!nameInput) return;

        const saveName = () => {
            if (!currentProject) return;
            const newName = nameInput.value.trim() || 'Untitled Program';
            nameInput.value = newName;
            currentProject.name = newName;
            Store.updateProject(currentProject);
        };

        nameInput.addEventListener('blur', saveName);
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameInput.blur();
            }
        });
    }

    /**
     * Called by Phase 1 AI results when the program is named conversationally.
     */
    function setProgramName(name) {
        if (!currentProject) return;
        currentProject.name = name;
        Store.updateProject(currentProject);
    }

    // Expose for Phase1 to call
    window._appSetProgramName = setProgramName;

    // ══════════════════════════════════════════════════════════════
    //  Chat Handling (shared across phases)
    // ══════════════════════════════════════════════════════════════

    function bindChat(phaseKey) {
        const input = $(`#${phaseKey}-chat-input`);
        const sendBtn = $(`#${phaseKey}-chat-send`);
        if (!input || !sendBtn) return;

        const doSend = () => {
            const text = input.value.trim();
            if (!text && (phaseKey !== 'phase1' || pendingFiles.length === 0)) return;
            sendMessage(phaseKey, text);
            input.value = '';
            input.style.height = 'auto';
        };

        sendBtn.addEventListener('click', doSend);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                doSend();
            }
        });

        // Auto-resize textarea
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
    }

    async function sendMessage(phaseKey, text) {
        const phaseNum = PHASE_NUMBERS[phaseKey];
        if (!phaseNum) return;

        if (!Settings.isConfigured()) {
            renderChatMessage(phaseKey, 'assistant', 'Please configure your AI provider in Settings first.');
            navigateTo('settings');
            return;
        }

        // Handle file attachments for phase 1
        let messageText = text;
        if (phaseKey === 'phase1' && pendingFiles.length > 0) {
            const fileNames = pendingFiles.map(f => f.name).join(', ');
            messageText = text
                ? `${text}\n\n[Attached files: ${fileNames}]`
                : `I've uploaded these documents: ${fileNames}. Please analyze them.`;

            // Save uploads to project
            pendingFiles.forEach(f => {
                Store.addUpload(currentProject.id, {
                    name: f.name,
                    type: f.type,
                    content: f.content,
                });
            });
            currentProject = Store.getProject(currentProject.id);
            Phase1.render(currentProject);
            pendingFiles = [];
            renderAttachments();
        }

        // Show user message
        renderChatMessage(phaseKey, 'user', messageText);

        // Show typing indicator
        showTypingIndicator(phaseKey);

        try {
            // Refresh project from store
            currentProject = Store.getProject(currentProject.id);

            const result = await Chat.sendMessage(phaseNum, currentProject.id, messageText);

            hideTypingIndicator(phaseKey);

            // Apply structured results to the appropriate phase controller
            if (result.structured) {
                const ctrl = PHASE_CONTROLLERS[phaseNum];
                if (ctrl && typeof ctrl.applyAIResults === 'function') {
                    ctrl.applyAIResults(result.structured, currentProject.id);
                }
            }

            // Refresh project after AI results applied
            currentProject = Store.getProject(currentProject.id);

            // Show cleaned response
            const displayText = result.display;
            if (displayText) {
                renderChatMessage(phaseKey, 'assistant', displayText);
            }

            // Update progress indicators
            updateProgressIndicators();
            updateProgramNameDisplay();
        } catch (err) {
            hideTypingIndicator(phaseKey);
            renderChatMessage(phaseKey, 'assistant', `Error: ${err.message}`);
        }
    }

    function renderChatMessage(phaseKey, role, content) {
        const container = $(`#${phaseKey}-chat-messages`);
        if (!container) return;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role}`;
        bubble.innerHTML = formatMessage(content);
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    }

    function renderChatHistory(phaseKey) {
        if (!currentProject) return;
        const container = $(`#${phaseKey}-chat-messages`);
        if (!container) return;
        container.innerHTML = '';
        const history = Store.getChatHistory(currentProject.id, phaseKey);
        history.forEach(msg => renderChatMessage(phaseKey, msg.role, msg.content));
    }

    // ── Skillable-flavored typing phrases ──
    const SKILLABLE_VERBS = {
        phase1: [
            'Skill-scanning your uploads...',
            'Absorbing your learning goals...',
            'Labifying your objectives...',
            'Mapping out the learning journey...',
            'Decoding your audience DNA...',
            'Competency-mining your docs...',
            'Blueprinting the possibilities...',
            'Calibrating the learning path...',
            'Distilling your requirements...',
        ],
        phase2: [
            'Labcrafting your outline...',
            'Structuring the learning adventure...',
            'Forging the activity blueprint...',
            'Architecting your lab series...',
            'Scaffolding the skill journey...',
            'Assembling the lab framework...',
            'Charting the lab landscape...',
            'Skill-weaving your structure...',
            'Sequencing the learning arc...',
        ],
        phase3: [
            'Drafting your guidance...',
            'Instructifying the activities...',
            'Wordsmithing the walkthrough...',
            'Authoring the learning path...',
            'Polishing the lab steps...',
            'Confidence-building the instructions...',
            'Fine-tuning the challenge...',
            'Crafting the discovery moments...',
            'Detailing the skill-builders...',
        ],
        phase4: [
            'Bundling the lab package...',
            'Finalizing the deliverables...',
            'Wiring up the environment...',
            'Scoring the success criteria...',
            'Packaging the experience...',
            'Launch-prepping your labs...',
            'Quality-checking the output...',
            'Export-readying your program...',
        ],
    };

    function _pickSkillableVerb(phaseKey) {
        const verbs = SKILLABLE_VERBS[phaseKey] || SKILLABLE_VERBS.phase1;
        return verbs[Math.floor(Math.random() * verbs.length)];
    }

    function showTypingIndicator(phaseKey) {
        const el = $(`#${phaseKey}-chat-typing`);
        if (!el) return;

        // Update the typing bubble with a Skillable verb
        const verb = _pickSkillableVerb(phaseKey);
        const bubble = el.querySelector('.chat-bubble');
        if (bubble) {
            bubble.innerHTML = `
                <div class="typing-indicator"><span></span><span></span><span></span></div>
                <div class="typing-verb">${verb}</div>
            `;
        }

        el.style.display = 'block';
        const container = $(`#${phaseKey}-chat-messages`);
        if (container) container.scrollTop = container.scrollHeight;
    }

    function hideTypingIndicator(phaseKey) {
        const el = $(`#${phaseKey}-chat-typing`);
        if (el) el.style.display = 'none';
    }

    function formatMessage(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/\n- /g, '\n&bull; ')
            .replace(/\n\d+\.\s/g, (m) => '\n' + m.trim() + ' ')
            .replace(/\n/g, '<br>');
    }

    function showWelcomeIfNeeded() {
        if (!currentProject) return;
        const history = Store.getChatHistory(currentProject.id, 'phase1');
        if (history.length === 0) {
            const existingProjects = Store.listProjects();
            const namedProjects = existingProjects.filter(p => p.id !== currentProject.id && p.name !== 'Untitled Program');

            if (namedProjects.length > 0) {
                const programNames = namedProjects.map(p => `- **${p.name}**`).join('\n');
                renderChatMessage('phase1', 'assistant',
                    `Welcome back! You have existing programs:\n${programNames}\n\n` +
                    `Would you like to **continue working on one of these**, or **start a new program**?`
                );
            } else {
                renderChatMessage('phase1', 'assistant',
                    `Tell me about the program you're building.\n\n` +
                    `If you have any documents — like learning objectives, job task analyses, job descriptions, or even a task list — click the paperclip below to upload them and we'll get started.`
                );
            }
        }
    }

    function showPhaseWelcomeIfNeeded(phaseKey) {
        if (!currentProject) return;
        const history = Store.getChatHistory(currentProject.id, phaseKey);
        if (history.length > 0) return; // already has conversation

        if (phaseKey === 'phase2') {
            const hasObjectives = (currentProject.businessObjectives && currentProject.businessObjectives.length > 0) ||
                (currentProject.learningObjectives && currentProject.learningObjectives.length > 0);
            const hasAudiences = currentProject.audiences && currentProject.audiences.length > 0;

            if (!hasObjectives || !hasAudiences) {
                renderChatMessage('phase2', 'assistant',
                    `Looking forward to generating an outline with you, but I need some context first.\n\n` +
                    `If you could answer a few more questions in **Phase 1**, that would help a ton. Or you can upload or paste a starter outline here if you have one.`
                );
            } else {
                renderChatMessage('phase2', 'assistant',
                    `Great — you've got a solid foundation from Phase 1. I'm ready to stub out a suggested lab outline based on your objectives and audiences.\n\n` +
                    `Say **"generate outline"** and I'll create a draft structure with Lab Series, Labs, and Activities. Or paste your own outline here if you already have one.`
                );
            }
        } else if (phaseKey === 'phase3') {
            const hasStructure = currentProject.programStructure &&
                currentProject.programStructure.labSeries &&
                currentProject.programStructure.labSeries.length > 0;

            if (!hasStructure) {
                renderChatMessage('phase3', 'assistant',
                    `Before we draft instructions, we need a lab outline to work from.\n\n` +
                    `Head over to **Phase 2** to generate or define your lab structure first.`
                );
            } else {
                renderChatMessage('phase3', 'assistant',
                    `Your lab outline is ready. Let's start drafting instructions for each activity.\n\n` +
                    `The instruction style defaults to **challenge-based** — you can change it in the Styling tab. Say **"start drafting"** and I'll generate instructions for all your labs.\n\n` +
                    `**Keep in mind:** These are draft instructions — scaffolding to give your lab authors a strong head start. Final editing, polish, and QA will happen in Skillable Studio.`
                );
            }
        }
    }

    function clearAllChats() {
        ['phase1', 'phase2', 'phase3', 'phase4'].forEach(phaseKey => {
            const container = $(`#${phaseKey}-chat-messages`);
            if (container) container.innerHTML = '';
        });
    }

    function restoreAllChats() {
        ['phase1', 'phase2', 'phase3', 'phase4'].forEach(phaseKey => {
            renderChatHistory(phaseKey);
        });
    }

    // ══════════════════════════════════════════════════════════════
    //  File Upload (Phase 1 paperclip)
    // ══════════════════════════════════════════════════════════════

    function bindFileUpload() {
        const uploadBtn = $('#phase1-upload-btn');
        const fileInput = $('#phase1-file-input');

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                Array.from(e.target.files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        pendingFiles.push({
                            name: file.name,
                            type: file.type,
                            size: file.size,
                            content: ev.target.result,
                        });
                        renderAttachments();
                    };
                    reader.readAsText(file);
                });
                e.target.value = '';
            });
        }
    }

    function renderAttachments() {
        const container = $('#phase1-attachments');
        if (!container) return;
        container.innerHTML = pendingFiles.map((f, i) =>
            `<span class="chat-attachment-chip">${escHtml(f.name)} <span class="remove" data-idx="${i}">&times;</span></span>`
        ).join('');
        container.querySelectorAll('.remove').forEach(btn => {
            btn.addEventListener('click', () => {
                pendingFiles.splice(parseInt(btn.dataset.idx), 1);
                renderAttachments();
            });
        });
    }

    // ══════════════════════════════════════════════════════════════
    //  Render All Phases
    // ══════════════════════════════════════════════════════════════

    function renderAll() {
        if (!currentProject) return;

        for (const [num, ctrl] of Object.entries(PHASE_CONTROLLERS)) {
            if (ctrl && typeof ctrl.render === 'function') {
                ctrl.render(currentProject);
            }
        }

        updateProgressIndicators();
    }

    function updateProgressIndicators() {
        if (!currentProject) return;

        // Phase 1: has audiences or objectives
        const p1HasData = (currentProject.audiences && currentProject.audiences.length > 0) ||
            (currentProject.businessObjectives && currentProject.businessObjectives.length > 0) ||
            (currentProject.learningObjectives && currentProject.learningObjectives.length > 0);
        const p1Complete = p1HasData && currentProject.competencies && currentProject.competencies.length > 0;
        setProgressIcon('phase1', p1Complete ? 'check' : (p1HasData ? 'half' : 'empty'));

        // Phase 2: has program structure
        const p2HasData = currentProject.programStructure &&
            currentProject.programStructure.labSeries &&
            currentProject.programStructure.labSeries.length > 0;
        const p2Complete = p2HasData && currentProject.instructionStyle;
        setProgressIcon('phase2', p2Complete ? 'check' : (p2HasData ? 'half' : 'empty'));

        // Phase 3: has lab blueprints with instructions
        const p3HasData = currentProject.labBlueprints && currentProject.labBlueprints.length > 0;
        const p3Complete = p3HasData && currentProject.draftInstructions &&
            Object.keys(currentProject.draftInstructions).length > 0;
        setProgressIcon('phase3', p3Complete ? 'check' : (p3HasData ? 'half' : 'empty'));

        // Phase 4: has environment templates or export
        const p4HasData = (currentProject.environmentTemplates && currentProject.environmentTemplates.length > 0) ||
            (currentProject.scoringMethods && currentProject.scoringMethods.length > 0);
        const p4Complete = p4HasData && currentProject.exportHistory && currentProject.exportHistory.length > 0;
        setProgressIcon('phase4', p4Complete ? 'check' : (p4HasData ? 'half' : 'empty'));
    }

    function setProgressIcon(phaseKey, state) {
        const el = $(`#nav-progress-${phaseKey}`);
        if (!el) return;
        switch (state) {
            case 'check':
                el.innerHTML = '&#9989;'; // checkmark
                el.title = 'Complete';
                break;
            case 'half':
                el.innerHTML = '&#9680;'; // half circle
                el.title = 'In progress';
                break;
            default:
                el.innerHTML = '&#9675;'; // empty circle
                el.title = 'Not started';
                break;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  Settings Panel
    // ══════════════════════════════════════════════════════════════

    function renderSettings() {
        const s = Settings.getAll();

        $('#settings-ai-provider').value = s.aiProvider || 'claude';
        $('#settings-api-key').value = s.apiKey || '';
        $('#settings-model').value = s.model || '';
        $('#settings-endpoint').value = s.customEndpoint || '';
        $('#settings-default-seat-time').value = s.defaultSeatTime || 45;
        $('#settings-activities-per-lab').value = s.activitiesPerLab || 5;
        $('#settings-default-difficulty').value = s.defaultDifficulty || 'intermediate';

        // Naming formula
        const namingInput = $('#settings-naming-formula');
        if (namingInput) namingInput.value = s.labNamingFormula || '{Verb} {Specific Action} {Product Name}';

        // Style guide
        const styleSelect = $('#settings-style-guide');
        if (styleSelect) styleSelect.value = s.instructionStyleGuide || 'microsoft';
        const customUrlInput = $('#settings-custom-style-url');
        if (customUrlInput) customUrlInput.value = s.customStyleGuideUrl || '';
        toggleCustomStyleField(s.instructionStyleGuide);

        // Branding
        $('#settings-branding-source-url').value = s.brandingSourceUrl || '';
        $('#settings-font-heading').value = (s.brandFonts && s.brandFonts.heading) || '';
        $('#settings-font-body').value = (s.brandFonts && s.brandFonts.body) || '';

        // Brand colors
        const colors = s.brandColors || {};
        if (colors.primary) $('#settings-color-primary').value = colors.primary;
        if (colors.secondary) $('#settings-color-secondary').value = colors.secondary;
        if (colors.accent) $('#settings-color-accent').value = colors.accent;
        if (colors.text) $('#settings-color-text').value = colors.text;
        if (colors.background) $('#settings-color-background').value = colors.background;

        // Logo preview
        const logoPreview = $('#settings-logo-preview');
        if (s.logoUrl) {
            logoPreview.innerHTML = `<img src="${escHtml(s.logoUrl)}" alt="Logo preview" style="max-height:60px;">`;
        } else {
            logoPreview.innerHTML = '';
        }

        // Endpoint field visibility
        toggleEndpointField(s.aiProvider);

        // References
        renderReferences(s.defaultReferences || []);
    }

    function bindSettings() {
        // Provider change
        $('#settings-ai-provider').addEventListener('change', (e) => {
            toggleEndpointField(e.target.value);
        });

        // Style guide change
        const styleSelect = $('#settings-style-guide');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                toggleCustomStyleField(e.target.value);
            });
        }

        // Toggle key visibility
        $('#settings-toggle-key').addEventListener('click', () => {
            const input = $('#settings-api-key');
            const btn = $('#settings-toggle-key');
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Hide';
            } else {
                input.type = 'password';
                btn.textContent = 'Show';
            }
        });

        // Test connection
        $('#settings-test-connection').addEventListener('click', async () => {
            const resultEl = $('#settings-test-result');
            resultEl.textContent = 'Testing...';
            resultEl.style.color = '#6b7280';
            saveSettings();
            const result = await Settings.testConnection();
            resultEl.textContent = result.ok ? 'Connected!' : `Failed: ${result.message}`;
            resultEl.style.color = result.ok ? '#10b981' : '#ef4444';
        });

        // Save
        $('#settings-save').addEventListener('click', () => {
            saveSettings();
            const resultEl = $('#settings-test-result');
            resultEl.textContent = 'Settings saved!';
            resultEl.style.color = '#10b981';
            setTimeout(() => { resultEl.textContent = ''; }, 2000);
        });

        // Logo upload
        $('#settings-logo-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                Settings.set('logoUrl', ev.target.result);
                const preview = $('#settings-logo-preview');
                preview.innerHTML = `<img src="${escHtml(ev.target.result)}" alt="Logo preview" style="max-height:60px;">`;
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        });

        // Add reference URL
        $('#settings-add-ref-url').addEventListener('click', () => {
            const url = prompt('Reference URL:');
            if (!url) return;
            Settings.addDefaultReference({
                id: Store.generateId(),
                type: 'url',
                url: url,
                title: url,
            });
            renderReferences(Settings.get('defaultReferences') || []);
        });

        // Add reference file
        $('#settings-add-ref-file').addEventListener('click', () => {
            $('#settings-ref-file-input').click();
        });
        $('#settings-ref-file-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                Settings.addDefaultReference({
                    id: Store.generateId(),
                    type: 'file',
                    title: file.name,
                    content: ev.target.result,
                });
                renderReferences(Settings.get('defaultReferences') || []);
            };
            reader.readAsText(file);
            e.target.value = '';
        });

        // Settings import/export buttons
        const settingsImportBtn = $('#settings-import-project');
        if (settingsImportBtn) {
            settingsImportBtn.addEventListener('click', () => {
                $('#settings-import-file').click();
            });
        }
        const settingsImportFile = $('#settings-import-file');
        if (settingsImportFile) {
            settingsImportFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                importProjectFromFile(file);
                e.target.value = '';
            });
        }
        const settingsExportBtn = $('#settings-export-project');
        if (settingsExportBtn) {
            settingsExportBtn.addEventListener('click', () => exportProject());
        }
    }

    function saveSettings() {
        Settings.set('aiProvider', $('#settings-ai-provider').value);
        Settings.set('apiKey', $('#settings-api-key').value);
        Settings.set('model', $('#settings-model').value);
        Settings.set('customEndpoint', $('#settings-endpoint').value);
        Settings.set('defaultSeatTime', parseInt($('#settings-default-seat-time').value) || 45);
        Settings.set('activitiesPerLab', parseInt($('#settings-activities-per-lab').value) || 5);
        Settings.set('defaultDifficulty', $('#settings-default-difficulty').value);

        // Naming formula
        const namingInput = $('#settings-naming-formula');
        if (namingInput) Settings.set('labNamingFormula', namingInput.value);

        // Style guide
        const styleSelect = $('#settings-style-guide');
        if (styleSelect) Settings.set('instructionStyleGuide', styleSelect.value);
        const customUrlInput = $('#settings-custom-style-url');
        if (customUrlInput) Settings.set('customStyleGuideUrl', customUrlInput.value);

        Settings.set('brandingSourceUrl', $('#settings-branding-source-url').value);
        Settings.set('brandColors', {
            primary: $('#settings-color-primary').value,
            secondary: $('#settings-color-secondary').value,
            accent: $('#settings-color-accent').value,
            text: $('#settings-color-text').value,
            background: $('#settings-color-background').value,
        });
        Settings.set('brandFonts', {
            heading: $('#settings-font-heading').value,
            body: $('#settings-font-body').value,
        });
        Settings.save();
    }

    function toggleEndpointField(provider) {
        const group = $('#settings-endpoint-group');
        if (group) group.style.display = provider === 'custom' ? 'block' : 'none';
    }

    function toggleCustomStyleField(styleGuide) {
        const group = $('#settings-custom-style-group');
        if (group) group.style.display = styleGuide === 'custom' ? 'block' : 'none';
    }

    function renderReferences(refs) {
        const container = $('#settings-references-list');
        if (!container) return;
        if (!refs || refs.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No default references added.</p></div>';
            return;
        }
        container.innerHTML = refs.map(ref => `
            <div class="reference-item" data-id="${ref.id}">
                <span class="reference-icon">${ref.type === 'url' ? '&#128279;' : '&#128196;'}</span>
                <span class="reference-title">${escHtml(ref.title || ref.url || ref.name || 'Untitled')}</span>
                <button class="reference-remove" data-ref-id="${ref.id}" title="Remove">&times;</button>
            </div>
        `).join('');
        container.querySelectorAll('.reference-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                Settings.removeDefaultReference(btn.dataset.refId);
                renderReferences(Settings.get('defaultReferences') || []);
            });
        });
    }

    // ══════════════════════════════════════════════════════════════
    //  Import / Export
    // ══════════════════════════════════════════════════════════════

    function exportProject() {
        if (!currentProject) return;
        const json = Store.exportProject(currentProject.id);
        if (json) {
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${currentProject.name.replace(/\s+/g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        }
    }

    function importProjectFromFile(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                currentProject = Store.importProject(ev.target.result);
                clearAllChats();
                restoreAllChats();
                renderAll();
                updateProgramNameDisplay();
            } catch (err) {
                alert('Import failed: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    // ══════════════════════════════════════════════════════════════
    //  Pane Resizer
    // ══════════════════════════════════════════════════════════════

    function bindPaneResizers() {
        $$('.pane-resizer').forEach(resizer => {
            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const layout = resizer.closest('.phase-layout');
                if (!layout) return;

                const chatPanel = layout.querySelector('.chat-panel');
                const contextPanel = layout.querySelector('.context-panel');
                if (!chatPanel || !contextPanel) return;

                resizer.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                const layoutRect = layout.getBoundingClientRect();
                const resizerWidth = resizer.offsetWidth;

                const onMouseMove = (ev) => {
                    const offsetX = ev.clientX - layoutRect.left;
                    const totalWidth = layoutRect.width - resizerWidth;
                    // Context panel can take at most 50% of available space
                    const minChat = totalWidth * 0.5;
                    const minContext = 280;

                    let chatWidth = Math.max(minChat, Math.min(offsetX, totalWidth - minContext));
                    let contextWidth = totalWidth - chatWidth;

                    chatPanel.style.flex = 'none';
                    chatPanel.style.width = chatWidth + 'px';
                    contextPanel.style.flex = 'none';
                    contextPanel.style.width = contextWidth + 'px';
                    contextPanel.style.minWidth = '0';
                    contextPanel.style.maxWidth = 'none';
                };

                const onMouseUp = () => {
                    resizer.classList.remove('dragging');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }

    // Initialize resizers
    bindPaneResizers();

    // ══════════════════════════════════════════════════════════════
    //  Utilities
    // ══════════════════════════════════════════════════════════════

    function escHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
