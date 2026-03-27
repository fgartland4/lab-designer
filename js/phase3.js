/**
 * phase3.js — Phase 3 "Draft & Finalize" UI controller for Lab Program Designer v3.
 * Shows the program outline in the right panel with per-activity draft instructions
 * expanding under each activity. Inline editing for quick fixes, chat for structural changes.
 *
 * Depends on: Store, Chat, Markdown (all global IIFEs).
 */

const Phase3 = (() => {

    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

    function escHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDuration(minutes) {
        if (!minutes) return '';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    }

    // ── Init ─────────────────────────────────────────────────────

    // Track which lab is expanded and which activity page is shown
    let _expandedLabId = null;
    let _currentPageIndex = 0; // index into the lab's activities array

    function init() {
        const container = $('#phase3-context');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const target = e.target;

            // Click a lab row to expand/collapse its instructions view
            const labRow = target.closest('.phase3-lab-row');
            if (labRow) {
                const labId = labRow.dataset.labId;
                const projectId = labRow.dataset.projectId;
                if (_expandedLabId === labId) {
                    _expandedLabId = null; // collapse
                } else {
                    _expandedLabId = labId;
                    _currentPageIndex = 0;
                }
                render(Store.getProject(projectId));
                return;
            }

            // Pagination: prev/next activity page
            const pageBtn = target.closest('[data-page-dir]');
            if (pageBtn) {
                const dir = parseInt(pageBtn.dataset.pageDir, 10);
                const total = parseInt(pageBtn.dataset.pageTotal, 10);
                _currentPageIndex = Math.max(0, Math.min(_currentPageIndex + dir, total - 1));
                render(Store.getProject(pageBtn.dataset.projectId));
                return;
            }

            // Page dot click — jump to specific page
            const pageDot = target.closest('[data-page-jump]');
            if (pageDot) {
                _currentPageIndex = parseInt(pageDot.dataset.pageJump, 10);
                render(Store.getProject(pageDot.dataset.projectId));
                return;
            }

            // Toggle instructions preview/raw
            const toggleView = target.closest('[data-toggle-instructions]');
            if (toggleView) {
                const labId = toggleView.dataset.labId;
                const actId = toggleView.dataset.activityId;
                const key = `${labId}-${actId}`;
                const previewEl = $(`#instructions-preview-${key}`, container);
                const rawEl = $(`#instructions-raw-${key}`, container);
                if (previewEl && rawEl) {
                    const showingPreview = previewEl.style.display !== 'none';
                    previewEl.style.display = showingPreview ? 'none' : 'block';
                    rawEl.style.display = showingPreview ? 'block' : 'none';
                    toggleView.textContent = showingPreview ? 'Preview' : 'Raw';
                }
                return;
            }

            // Copy instructions
            const copyBtn = target.closest('[data-copy-instructions]');
            if (copyBtn) {
                const labId = copyBtn.dataset.labId;
                const actId = copyBtn.dataset.activityId;
                const projectId = copyBtn.dataset.projectId;
                const project = Store.getProject(projectId);
                if (project && project.draftInstructions && project.draftInstructions[labId]) {
                    const md = project.draftInstructions[labId][actId];
                    if (md) {
                        navigator.clipboard.writeText(md).then(() => {
                            copyBtn.textContent = 'Copied!';
                            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
                        });
                    }
                }
                return;
            }

            // Edit instructions
            const editBtn = target.closest('[data-edit-instructions]');
            if (editBtn) {
                const labId = editBtn.dataset.labId;
                const actId = editBtn.dataset.activityId;
                const key = `${labId}-${actId}`;
                const previewEl = $(`#instructions-preview-${key}`, container);
                const rawEl = $(`#instructions-raw-${key}`, container);
                const editArea = $(`#instructions-edit-${key}`, container);
                const project = Store.getProject(editBtn.dataset.projectId);

                if (previewEl && editArea && project) {
                    previewEl.style.display = 'none';
                    if (rawEl) rawEl.style.display = 'none';
                    editArea.style.display = 'block';
                    const textarea = editArea.querySelector('textarea');
                    if (textarea) {
                        const md = (project.draftInstructions && project.draftInstructions[labId] && project.draftInstructions[labId][actId]) || '';
                        textarea.value = md;
                        textarea.focus();
                    }
                }
                return;
            }

            // Save edited instructions
            const saveEditBtn = target.closest('[data-save-instructions]');
            if (saveEditBtn) {
                const labId = saveEditBtn.dataset.labId;
                const actId = saveEditBtn.dataset.activityId;
                const projectId = saveEditBtn.dataset.projectId;
                const key = `${labId}-${actId}`;
                const editArea = $(`#instructions-edit-${key}`, container);
                if (editArea) {
                    const textarea = editArea.querySelector('textarea');
                    if (textarea) {
                        _saveDraftInstructions(projectId, labId, actId, textarea.value);
                        render(Store.getProject(projectId));
                    }
                }
                return;
            }

            // Cancel edit
            const cancelEditBtn = target.closest('[data-cancel-edit]');
            if (cancelEditBtn) {
                const projectId = cancelEditBtn.dataset.projectId;
                render(Store.getProject(projectId));
                return;
            }

            // Regenerate single activity instructions
            const regenBtn = target.closest('[data-regenerate-activity]');
            if (regenBtn) {
                handleGenerateActivityInstructions(
                    regenBtn.dataset.labId,
                    regenBtn.dataset.activityId,
                    regenBtn.dataset.projectId
                );
                return;
            }
        });
    }

    // ── Render ────────────────────────────────────────────────────

    function render(project) {
        const container = $('#phase3-context');
        if (!container || !project) return;

        const programName = (project.name && project.name !== 'Untitled Program') ? project.name : '';
        const instructionStyle = project.instructionStyle || 'challenge';
        const styleGuide = (typeof Settings !== 'undefined' && Settings.get('instructionStyleGuide')) || 'microsoft';

        const styleGuideLabels = {
            'microsoft': 'Microsoft Style Guide',
            'apple': 'Apple Style Guide',
            'redhat': 'Red Hat Documentation Guide',
            'digitalocean': 'DigitalOcean Technical Writing Guidelines',
            'ibm': 'IBM Style Guide',
            'custom': 'Custom',
        };

        // Build compact outline for Outline tab
        const structure = project.programStructure;
        let outlineHtml = '';
        if (!structure || !structure.labSeries || structure.labSeries.length === 0) {
            outlineHtml = `
                <div class="phase3-empty-state">
                    <p>No program structure yet.</p>
                    <p class="hint">Complete Phase 2 to define your Lab Series, Labs, and Activities.</p>
                </div>
            `;
        } else {
            for (const ls of structure.labSeries) {
                outlineHtml += `<div class="phase3-series-header">${escHtml(ls.title)}</div>`;
                for (const lab of (ls.labs || [])) {
                    outlineHtml += _renderLabRow(lab, project);
                }
            }
        }

        // Build Draft Instructions tab content (for selected lab)
        let draftsHtml = '';
        const selectedLab = _expandedLabId ? _findLab(structure, _expandedLabId) : null;
        if (selectedLab) {
            draftsHtml = _renderPaginatedInstructions(selectedLab, project);
        } else {
            draftsHtml = `
                <div class="phase3-empty-state">
                    <p>Select a lab from the Outline tab to review its instructions.</p>
                </div>
            `;
        }

        // Determine active tab
        const activeTab = _expandedLabId ? 'drafts' : 'outline';

        // Blueprint header + 3 tabs
        const html = `
            <div class="bp-header">
                <h3 class="bp-title">Lab Blueprint</h3>
                ${programName ? `<div class="bp-program-name">${escHtml(programName)}</div>` : ''}
            </div>

            <div class="phase2-tabs">
                <button class="context-tab${activeTab === 'outline' ? ' active' : ''}" data-phase3-tab="outline">Outline</button>
                <button class="context-tab${activeTab === 'drafts' ? ' active' : ''}" data-phase3-tab="drafts">Draft Instructions</button>
                <button class="context-tab" data-phase3-tab="styling">Styling</button>
            </div>

            <div id="phase3-tab-outline" class="phase3-tab-panel${activeTab === 'outline' ? ' active' : ''}"${activeTab !== 'outline' ? ' style="display:none;"' : ''}>
                ${outlineHtml}
            </div>

            <div id="phase3-tab-drafts" class="phase3-tab-panel${activeTab === 'drafts' ? ' active' : ''}"${activeTab !== 'drafts' ? ' style="display:none;"' : ''}>
                ${draftsHtml}
            </div>

            <div id="phase3-tab-styling" class="phase3-tab-panel" style="display:none;padding:12px 16px;">
                <div class="style-radio-group">
                    <label class="form-label">Instruction Style</label>
                    ${_radioOption('instruction-style', 'challenge', 'Challenge-based', 'Present goals and context; include progressive hints that nudge without giving answers.', instructionStyle)}
                    ${_radioOption('instruction-style', 'mixed', 'Mixed', 'AI picks the best style per activity — challenge for simple tasks, guided for complex ones.', instructionStyle)}
                    ${_radioOption('instruction-style', 'performance-test', 'Performance Test', 'Task objective only, no hints or guidance. For high-stakes certification exams.', instructionStyle)}
                    ${_radioOption('instruction-style', 'step-by-step', 'Step-by-step', 'Detailed walkthrough with every action spelled out. Best for beginners or complex UIs.', instructionStyle)}
                </div>
                <div class="style-radio-group" style="margin-top:14px;">
                    <label class="form-label">Writing Style Guide</label>
                    ${_radioOption('style-guide', 'microsoft', 'Microsoft Style Guide', 'Warm, relaxed tone. Second person. Short sentences. Action-oriented.', styleGuide)}
                    ${_radioOption('style-guide', 'apple', 'Apple Style Guide', 'Friendly, straightforward. Avoid technical terms when possible.', styleGuide)}
                    ${_radioOption('style-guide', 'redhat', 'Red Hat Documentation Guide', 'Precise, consistent terminology. Modular, task-based structure.', styleGuide)}
                    ${_radioOption('style-guide', 'digitalocean', 'DigitalOcean Technical Writing Guidelines', 'Tutorial-focused. Clear structure, practical examples, action-oriented steps.', styleGuide)}
                    ${_radioOption('style-guide', 'ibm', 'IBM Style Guide', 'Enterprise-grade clarity. Consistent terminology, structured for technical depth.', styleGuide)}
                    ${_radioOption('style-guide', 'custom', 'Add a Custom Style Guide in Settings', '', styleGuide)}
                </div>
            </div>
        `;

        container.innerHTML = html;
        _bindPhase3Tabs(container);
        _bindStylePicker(container, project.id);
    }

    function _radioOption(groupName, value, label, description, currentValue) {
        const checked = value === currentValue ? ' checked' : '';
        return `
            <label class="style-radio-card${checked ? ' selected' : ''}">
                <input type="radio" name="phase3-${groupName}" value="${value}"${checked}>
                <div class="style-radio-content">
                    <strong>${label}</strong>
                    <span class="style-radio-desc">${description}</span>
                </div>
            </label>
        `;
    }

    function _bindPhase3Tabs(container) {
        container.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('[data-phase3-tab]');
            if (!tabBtn) return;

            const tabName = tabBtn.dataset.phase3Tab;
            $$('[data-phase3-tab]', container).forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');
            $$('.phase3-tab-panel', container).forEach(p => {
                p.style.display = 'none';
                p.classList.remove('active');
            });
            const panel = $(`#phase3-tab-${tabName}`, container);
            if (panel) {
                panel.style.display = '';
                panel.classList.add('active');
            }
        });
    }

    function _bindStylePicker(container, projectId) {
        // Instruction style radios
        container.querySelectorAll('input[name="phase3-instruction-style"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const project = Store.getProject(projectId);
                if (project) {
                    project.instructionStyle = radio.value;
                    Store.updateProject(project);
                }
                // Update selected visual
                container.querySelectorAll('input[name="phase3-instruction-style"]').forEach(r => {
                    r.closest('.style-radio-card').classList.toggle('selected', r.checked);
                });
            });
        });

        // Style guide radios
        container.querySelectorAll('input[name="phase3-style-guide"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (typeof Settings !== 'undefined') {
                    Settings.set('instructionStyleGuide', radio.value);
                    Settings.save();
                }
                container.querySelectorAll('input[name="phase3-style-guide"]').forEach(r => {
                    r.closest('.style-radio-card').classList.toggle('selected', r.checked);
                });
            });
        });
    }

    function _findLab(structure, labId) {
        if (!structure || !structure.labSeries) return null;
        for (const ls of structure.labSeries) {
            for (const lab of (ls.labs || [])) {
                if (lab.id === labId) return lab;
            }
        }
        return null;
    }

    function _renderLabRow(lab, project) {
        const activities = lab.activities || [];
        const duration = lab.estimatedDuration ? formatDuration(lab.estimatedDuration) : '';
        const draftedCount = activities.filter(a => _hasInstructions(lab.id, a.id, project)).length;
        const totalCount = activities.length;
        const isSelected = _expandedLabId === lab.id;

        return `
            <div class="phase3-lab-row${isSelected ? ' selected' : ''}" data-lab-id="${lab.id}" data-project-id="${project.id}">
                <span class="phase3-lab-title">${escHtml(lab.title)}</span>
                ${duration ? `<span class="phase3-lab-duration">${duration}</span>` : ''}
                <span class="phase3-draft-count ${draftedCount === totalCount ? 'complete' : ''}">${draftedCount}/${totalCount}</span>
            </div>
        `;
    }

    function _renderPaginatedInstructions(lab, project) {
        const activities = lab.activities || [];
        if (activities.length === 0) {
            return '<div class="phase3-no-draft"><p>No activities defined for this lab.</p></div>';
        }

        const pageIndex = Math.min(_currentPageIndex, activities.length - 1);
        const activity = activities[pageIndex];
        const key = `${lab.id}-${activity.id}`;
        const hasInstructions = _hasInstructions(lab.id, activity.id, project);

        // Page dots
        const dots = activities.map((act, i) => {
            const hasDraft = _hasInstructions(lab.id, act.id, project);
            const activeClass = i === pageIndex ? ' active' : '';
            const draftClass = hasDraft ? ' drafted' : '';
            return `<span class="phase3-page-dot${activeClass}${draftClass}" data-page-jump="${i}" data-project-id="${project.id}" title="${escHtml(act.title)}">${i + 1}</span>`;
        }).join('');

        // Instructions content
        let contentHtml = '';
        if (hasInstructions) {
            const md = project.draftInstructions[lab.id][activity.id];
            const renderedHtml = typeof Markdown !== 'undefined' ? Markdown.render(md) : `<pre>${escHtml(md)}</pre>`;

            contentHtml = `
                <div class="phase3-instructions-actions">
                    <button data-toggle-instructions data-lab-id="${lab.id}" data-activity-id="${activity.id}">Raw</button>
                    <button data-copy-instructions data-lab-id="${lab.id}" data-activity-id="${activity.id}" data-project-id="${project.id}">Copy</button>
                    <button data-edit-instructions data-lab-id="${lab.id}" data-activity-id="${activity.id}" data-project-id="${project.id}">Edit</button>
                    <button data-regenerate-activity data-lab-id="${lab.id}" data-activity-id="${activity.id}" data-project-id="${project.id}">Regenerate</button>
                </div>
                <div class="phase3-instructions-content">
                    <div id="instructions-preview-${key}" class="phase3-instructions-preview">${renderedHtml}</div>
                    <div id="instructions-raw-${key}" class="phase3-instructions-raw" style="display:none;"><pre>${escHtml(md)}</pre></div>
                    <div id="instructions-edit-${key}" class="phase3-instructions-edit" style="display:none;">
                        <textarea class="phase3-instructions-textarea" rows="15">${escHtml(md)}</textarea>
                        <div class="phase3-instructions-edit-actions">
                            <button data-save-instructions data-lab-id="${lab.id}" data-activity-id="${activity.id}" data-project-id="${project.id}">Save</button>
                            <button data-cancel-edit data-project-id="${project.id}">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            contentHtml = `
                <div class="phase3-no-draft">
                    <p>No draft yet for this activity.</p>
                    <p class="hint">Ask in chat to generate instructions, or the AI will draft all when entering Phase 3.</p>
                </div>
            `;
        }

        const prevDisabled = pageIndex === 0 ? ' disabled' : '';
        const nextDisabled = pageIndex === activities.length - 1 ? ' disabled' : '';

        return `
            <div class="phase3-lab-instructions">
                <div class="phase3-page-header">
                    <span class="phase3-page-activity-title">${escHtml(activity.title)}</span>
                    <span class="phase3-page-label">Page ${pageIndex + 1} of ${activities.length}</span>
                </div>
                <div class="phase3-page-nav">
                    <button class="phase3-page-btn"${prevDisabled} data-page-dir="-1" data-page-total="${activities.length}" data-project-id="${project.id}">\u2190 Prev</button>
                    <div class="phase3-page-dots">${dots}</div>
                    <button class="phase3-page-btn"${nextDisabled} data-page-dir="1" data-page-total="${activities.length}" data-project-id="${project.id}">Next \u2192</button>
                </div>
                <div class="phase3-instructions">
                    ${contentHtml}
                </div>
            </div>
        `;
    }

    // ── Helpers ───────────────────────────────────────────────────

    function _hasInstructions(labId, activityId, project) {
        return project.draftInstructions &&
            project.draftInstructions[labId] &&
            project.draftInstructions[labId][activityId];
    }

    function _labHasAnyInstructions(labId, project) {
        return project.draftInstructions && project.draftInstructions[labId] &&
            Object.keys(project.draftInstructions[labId]).length > 0;
    }

    function _saveDraftInstructions(projectId, labId, activityId, markdown) {
        const project = Store.getProject(projectId);
        if (!project) return;
        if (!project.draftInstructions) project.draftInstructions = {};
        if (!project.draftInstructions[labId]) project.draftInstructions[labId] = {};
        project.draftInstructions[labId][activityId] = markdown;
        Store.updateProject(project);
    }

    // ── Handlers ─────────────────────────────────────────────────

    async function handleGenerateActivityInstructions(labId, activityId, projectId) {
        const project = Store.getProject(projectId);
        if (!project || !project.programStructure) return;

        // Find the activity
        let labTitle = '', actTitle = '', actDescription = '';
        for (const ls of (project.programStructure.labSeries || [])) {
            for (const lab of (ls.labs || [])) {
                if (lab.id === labId) {
                    labTitle = lab.title;
                    for (const act of (lab.activities || [])) {
                        if (act.id === activityId) {
                            actTitle = act.title;
                            actDescription = act.description || '';
                            break;
                        }
                    }
                    break;
                }
            }
        }

        const prompt = `Generate detailed draft instructions for this activity:\n\n` +
            `Lab: ${labTitle}\nActivity: ${actTitle}\n` +
            (actDescription ? `Description: ${actDescription}\n` : '') +
            `\nPlease provide complete step-by-step instructions in markdown format. ` +
            `Wrap the instructions in ===DRAFT_INSTRUCTIONS=== markers with labId "${labId}" and activityId "${activityId}".`;

        const container = $('#phase3-context');
        const btn = container ? container.querySelector(`[data-generate-activity-instructions][data-activity-id="${activityId}"]`) : null;
        if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

        try {
            const result = await Chat.sendMessage(3, projectId, prompt);
            if (result.structured && result.structured.draftInstructions) {
                const draft = result.structured.draftInstructions;
                _saveDraftInstructions(projectId, draft.labId || labId, draft.activityId || activityId, draft.markdown || '');
            }
            render(Store.getProject(projectId));
        } catch (err) {
            console.error('[Phase3] Failed to generate instructions:', err);
            if (btn) { btn.disabled = false; btn.textContent = 'Draft'; }
        }
    }

    async function handleGenerateLabInstructions(labId, projectId) {
        const project = Store.getProject(projectId);
        if (!project || !project.programStructure) return;

        let lab = null;
        for (const ls of (project.programStructure.labSeries || [])) {
            lab = (ls.labs || []).find(l => l.id === labId);
            if (lab) break;
        }
        if (!lab) return;

        // Generate instructions for each activity sequentially
        for (const act of (lab.activities || [])) {
            await handleGenerateActivityInstructions(labId, act.id, projectId);
        }
    }

    // ── AI results integration ───────────────────────────────────

    function applyAIResults(structured, projectId) {
        if (!structured) return;

        // Handle LAB_BLUEPRINTS — merge into labBlueprints for backward compatibility
        if (structured.blueprints && Array.isArray(structured.blueprints)) {
            const project = Store.getProject(projectId);
            if (project) {
                const existing = project.labBlueprints || [];
                for (const bp of structured.blueprints) {
                    const normalized = {
                        id: bp.id || Store.generateId(),
                        title: bp.title || '',
                        shortDescription: bp.shortDescription || bp.description || '',
                        estimatedDuration: bp.estimatedDuration || 0,
                        activities: (bp.activities || []).map(a => ({
                            title: a.title || '',
                            tasks: a.tasks || [],
                            duration: a.duration || 0,
                        })),
                        approved: { title: null, description: null, outline: null },
                    };
                    const existingIdx = existing.findIndex(e => e.id === bp.id);
                    if (existingIdx >= 0) {
                        existing[existingIdx] = normalized;
                    } else {
                        existing.push(normalized);
                    }
                }
                project.labBlueprints = existing;
                Store.updateProject(project);
            }
        }

        // Handle DRAFT_INSTRUCTIONS
        if (structured.draftInstructions) {
            const draft = structured.draftInstructions;
            if (draft.labId && draft.activityId && draft.markdown) {
                _saveDraftInstructions(projectId, draft.labId, draft.activityId, draft.markdown);
            } else if (draft.labId && draft.markdown) {
                // Legacy: store as lab-level instruction
                Store.setDraftInstructions(projectId, draft.labId, draft.markdown);
            }
        }

        render(Store.getProject(projectId));
    }

    // ── Context Summary ──────────────────────────────────────────

    function getContextSummary(projectId) {
        const project = Store.getProject(projectId);
        if (!project) return '';

        const lines = ['Phase 3 — Draft & Finalize'];
        const instructions = project.draftInstructions || {};
        const labCount = Object.keys(instructions).length;
        let activityCount = 0;
        for (const labInstructions of Object.values(instructions)) {
            if (typeof labInstructions === 'object') {
                activityCount += Object.keys(labInstructions).length;
            }
        }

        lines.push(`Draft instructions: ${activityCount} activities across ${labCount} labs`);
        return lines.join('\n');
    }

    // ── Public API ───────────────────────────────────────────────

    return {
        init,
        render,
        applyAIResults,
        getContextSummary,
    };
})();
