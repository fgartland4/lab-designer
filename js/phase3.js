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

    function init() {
        const container = $('#phase3-context');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const target = e.target;

            // Toggle lab expand/collapse
            const labToggle = target.closest('.phase3-lab-toggle');
            if (labToggle) {
                const labCard = labToggle.closest('.phase3-lab-card');
                if (labCard) {
                    const body = labCard.querySelector('.phase3-lab-body');
                    if (body) {
                        const isOpen = body.style.display !== 'none';
                        body.style.display = isOpen ? 'none' : '';
                        labToggle.classList.toggle('expanded', !isOpen);
                    }
                }
                return;
            }

            // Generate instructions for an activity
            const genBtn = target.closest('[data-generate-activity-instructions]');
            if (genBtn) {
                handleGenerateActivityInstructions(
                    genBtn.dataset.labId,
                    genBtn.dataset.activityId,
                    genBtn.dataset.projectId
                );
                return;
            }

            // Generate all instructions for a lab
            const genAllBtn = target.closest('[data-generate-lab-instructions]');
            if (genAllBtn) {
                handleGenerateLabInstructions(genAllBtn.dataset.labId, genAllBtn.dataset.projectId);
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
                        const project = Store.getProject(projectId);
                        render(project);
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
        });
    }

    // ── Render ────────────────────────────────────────────────────

    function render(project) {
        const container = $('#phase3-context');
        if (!container || !project) return;

        const programName = (project.name && project.name !== 'Untitled Program') ? project.name : '';
        const instructionStyle = project.instructionStyle || 'challenge';

        // Blueprint header + instruction style picker
        let html = `
            <div class="bp-header">
                <h3 class="bp-title">Lab Blueprint</h3>
                ${programName ? `<div class="bp-program-name">${escHtml(programName)}</div>` : ''}
            </div>
            <div class="phase3-style-picker">
                <label class="form-label">Instruction Style</label>
                <select id="phase3-instruction-style" class="form-select">
                    <option value="challenge"${instructionStyle === 'challenge' ? ' selected' : ''}>Challenge-based</option>
                    <option value="mixed"${instructionStyle === 'mixed' ? ' selected' : ''}>Mixed</option>
                    <option value="performance-test"${instructionStyle === 'performance-test' ? ' selected' : ''}>Performance Test</option>
                    <option value="step-by-step"${instructionStyle === 'step-by-step' ? ' selected' : ''}>Step-by-step</option>
                </select>
                <span class="form-hint">How should the AI draft instructions for activities?</span>
            </div>
        `;

        const structure = project.programStructure;
        if (!structure || !structure.labSeries || structure.labSeries.length === 0) {
            html += `
                <div class="phase3-empty-state">
                    <p>No program structure yet.</p>
                    <p class="hint">Complete Phase 2 to define your Lab Series, Labs, and Activities.</p>
                </div>
            `;
            container.innerHTML = html;
            _bindStylePicker(container, project.id);
            return;
        }

        // Render the outline with instructions expanding under activities
        for (const ls of structure.labSeries) {
            html += `<div class="phase3-series-header">${escHtml(ls.title)}</div>`;
            for (const lab of (ls.labs || [])) {
                html += _renderLabCard(lab, project);
            }
        }

        container.innerHTML = html;
        _bindStylePicker(container, project.id);
    }

    function _bindStylePicker(container, projectId) {
        const select = $('#phase3-instruction-style', container);
        if (!select) return;
        select.addEventListener('change', () => {
            const project = Store.getProject(projectId);
            if (project) {
                project.instructionStyle = select.value;
                Store.updateProject(project);
            }
        });
    }

    function _renderLabCard(lab, project) {
        const activities = lab.activities || [];
        const duration = lab.estimatedDuration ? formatDuration(lab.estimatedDuration) : '';
        const hasAnyInstructions = _labHasAnyInstructions(lab.id, project);

        let activitiesHtml = activities.map(act =>
            _renderActivityRow(act, lab.id, project)
        ).join('');

        return `
            <div class="phase3-lab-card" data-lab-id="${lab.id}">
                <div class="phase3-lab-header">
                    <button class="phase3-lab-toggle expanded">
                        <span class="toggle-icon">\u25BC</span>
                    </button>
                    <span class="phase3-lab-title">${escHtml(lab.title)}</span>
                    ${duration ? `<span class="phase3-lab-duration">${duration}</span>` : ''}
                    <button class="btn-sm btn-generate-all" data-generate-lab-instructions data-lab-id="${lab.id}" data-project-id="${project.id}">
                        ${hasAnyInstructions ? 'Regenerate All' : 'Generate All Instructions'}
                    </button>
                </div>
                <div class="phase3-lab-body">
                    ${activitiesHtml || '<div class="empty-state"><p>No activities defined.</p></div>'}
                </div>
            </div>
        `;
    }

    function _renderActivityRow(activity, labId, project) {
        const key = `${labId}-${activity.id}`;
        const hasInstructions = _hasInstructions(labId, activity.id, project);

        let instructionsHtml = '';
        if (hasInstructions) {
            const md = project.draftInstructions[labId][activity.id];
            const renderedHtml = typeof Markdown !== 'undefined' ? Markdown.render(md) : `<pre>${escHtml(md)}</pre>`;

            instructionsHtml = `
                <div class="phase3-instructions">
                    <div class="phase3-instructions-actions">
                        <button data-toggle-instructions data-lab-id="${labId}" data-activity-id="${activity.id}">Raw</button>
                        <button data-copy-instructions data-lab-id="${labId}" data-activity-id="${activity.id}" data-project-id="${project.id}">Copy</button>
                        <button data-edit-instructions data-lab-id="${labId}" data-activity-id="${activity.id}" data-project-id="${project.id}">Edit</button>
                    </div>
                    <div id="instructions-preview-${key}" class="phase3-instructions-preview">${renderedHtml}</div>
                    <div id="instructions-raw-${key}" class="phase3-instructions-raw" style="display:none;"><pre>${escHtml(md)}</pre></div>
                    <div id="instructions-edit-${key}" class="phase3-instructions-edit" style="display:none;">
                        <textarea class="phase3-instructions-textarea" rows="15">${escHtml(md)}</textarea>
                        <div class="phase3-instructions-edit-actions">
                            <button data-save-instructions data-lab-id="${labId}" data-activity-id="${activity.id}" data-project-id="${project.id}">Save</button>
                            <button data-cancel-edit data-project-id="${project.id}">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="phase3-activity-row" data-activity-id="${activity.id}">
                <div class="phase3-activity-header">
                    <span class="phase3-activity-icon">\u{1F4CB}</span>
                    <span class="phase3-activity-title">${escHtml(activity.title)}</span>
                    <span class="phase3-activity-status ${hasInstructions ? 'has-instructions' : 'no-instructions'}">
                        ${hasInstructions ? '\u2705' : '\u26AA'}
                    </span>
                    <button class="btn-sm" data-generate-activity-instructions data-lab-id="${labId}" data-activity-id="${activity.id}" data-project-id="${project.id}">
                        ${hasInstructions ? 'Regenerate' : 'Draft'}
                    </button>
                </div>
                ${instructionsHtml}
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
