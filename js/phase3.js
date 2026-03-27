/**
 * phase3.js — Phase 3 "Organize & Finalize" UI controller for Lab Program Designer v3.
 * Manages the split-panel layout: chat on the left, context panel on the right.
 * Renders lab blueprint cards with approval workflows, activity outlines,
 * and draft instruction previews.
 *
 * Depends on: Store, Chat, Markdown (all global IIFEs).
 */

const Phase3 = (() => {

    // ── DOM helpers ──────────────────────────────────────────────

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

    // ── Status helpers ───────────────────────────────────────────

    function getLabStatus(lab, project) {
        const hasInstructions = project.draftInstructions && project.draftInstructions[lab.id];
        if (hasInstructions) return 'instructions-generated';

        const approved = lab.approved || {};
        const allApproved = approved.title && approved.description && approved.outline;
        if (allApproved) return 'approved';

        return 'draft';
    }

    function getStatusLabel(status) {
        switch (status) {
            case 'instructions-generated': return 'Instructions Generated';
            case 'approved': return 'Approved';
            default: return 'Draft';
        }
    }

    function getStatusClass(status) {
        switch (status) {
            case 'instructions-generated': return 'status-generated';
            case 'approved': return 'status-approved';
            default: return 'status-draft';
        }
    }

    // ── Estimated duration helpers ───────────────────────────────

    function getLabDuration(lab) {
        if (lab.estimatedDuration) return lab.estimatedDuration;
        if (lab.activities && lab.activities.length) {
            return lab.activities.reduce((sum, a) => sum + (a.duration || 0), 0);
        }
        return 0;
    }

    // ── Init ─────────────────────────────────────────────────────

    function init() {
        const container = $('#phase3-context');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const target = e.target;

            // Approve field checkbox
            const approveBtn = target.closest('[data-approve-field]');
            if (approveBtn) {
                const labId = approveBtn.dataset.labId;
                const field = approveBtn.dataset.approveField;
                const projectId = approveBtn.dataset.projectId;
                handleApprove(labId, field, projectId);
                return;
            }

            // Approve all button
            if (target.closest('[data-approve-all]')) {
                const projectId = target.closest('[data-approve-all]').dataset.projectId;
                handleApproveAll(projectId);
                return;
            }

            // Generate instructions button
            const genBtn = target.closest('[data-generate-instructions]');
            if (genBtn) {
                const labId = genBtn.dataset.labId;
                const projectId = genBtn.dataset.projectId;
                handleGenerateInstructions(labId, projectId);
                return;
            }

            // Toggle activity outline
            const collapseToggle = target.closest('.blueprint-activities-toggle');
            if (collapseToggle) {
                const body = collapseToggle.closest('.blueprint-card').querySelector('.blueprint-activities-body');
                if (body) {
                    const isOpen = body.style.display !== 'none';
                    body.style.display = isOpen ? 'none' : 'block';
                    collapseToggle.classList.toggle('expanded', !isOpen);
                }
                return;
            }

            // Toggle instructions preview/raw
            const toggleView = target.closest('[data-toggle-instructions]');
            if (toggleView) {
                const labId = toggleView.dataset.labId;
                const previewEl = $(`#instructions-preview-${labId}`, container);
                const rawEl = $(`#instructions-raw-${labId}`, container);
                if (previewEl && rawEl) {
                    const showingPreview = previewEl.style.display !== 'none';
                    previewEl.style.display = showingPreview ? 'none' : 'block';
                    rawEl.style.display = showingPreview ? 'block' : 'none';
                    toggleView.textContent = showingPreview ? 'Preview' : 'Raw Markdown';
                }
                return;
            }

            // Copy instructions to clipboard
            const copyBtn = target.closest('[data-copy-instructions]');
            if (copyBtn) {
                const labId = copyBtn.dataset.labId;
                const projectId = copyBtn.dataset.projectId;
                const project = Store.getProject(projectId);
                if (project && project.draftInstructions && project.draftInstructions[labId]) {
                    navigator.clipboard.writeText(project.draftInstructions[labId]).then(() => {
                        copyBtn.textContent = 'Copied!';
                        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
                    });
                }
                return;
            }

            // Edit instructions button
            const editBtn = target.closest('[data-edit-instructions]');
            if (editBtn) {
                const labId = editBtn.dataset.labId;
                const projectId = editBtn.dataset.projectId;
                const previewEl = $(`#instructions-preview-${labId}`, container);
                const rawEl = $(`#instructions-raw-${labId}`, container);
                const editArea = $(`#instructions-edit-${labId}`, container);
                const project = Store.getProject(projectId);

                if (previewEl && editArea && project) {
                    previewEl.style.display = 'none';
                    if (rawEl) rawEl.style.display = 'none';
                    editArea.style.display = 'block';

                    const textarea = editArea.querySelector('textarea');
                    if (textarea) {
                        textarea.value = (project.draftInstructions && project.draftInstructions[labId]) || '';
                        textarea.focus();
                    }
                }
                return;
            }

            // Save edited instructions
            const saveEditBtn = target.closest('[data-save-instructions]');
            if (saveEditBtn) {
                const labId = saveEditBtn.dataset.labId;
                const projectId = saveEditBtn.dataset.projectId;
                const editArea = $(`#instructions-edit-${labId}`, container);
                if (editArea) {
                    const textarea = editArea.querySelector('textarea');
                    if (textarea) {
                        Store.setDraftInstructions(projectId, labId, textarea.value);
                        const project = Store.getProject(projectId);
                        render(project);
                    }
                }
                return;
            }

            // Cancel edit
            const cancelEditBtn = target.closest('[data-cancel-edit]');
            if (cancelEditBtn) {
                const labId = cancelEditBtn.dataset.labId;
                const projectId = cancelEditBtn.dataset.projectId;
                const project = Store.getProject(projectId);
                render(project);
                return;
            }
        });

        // Handle inline edits via blur/change on editable fields
        container.addEventListener('change', (e) => {
            const target = e.target;

            // Editable title input
            if (target.matches('[data-edit-title]')) {
                const labId = target.dataset.labId;
                const projectId = target.dataset.projectId;
                handleEditField(labId, 'title', target.value.trim(), projectId);
                return;
            }

            // Editable description textarea
            if (target.matches('[data-edit-description]')) {
                const labId = target.dataset.labId;
                const projectId = target.dataset.projectId;
                handleEditField(labId, 'shortDescription', target.value.trim(), projectId);
                return;
            }
        });
    }

    // ── Render ────────────────────────────────────────────────────

    function render(project) {
        const container = $('#phase3-context');
        if (!container || !project) return;

        const labs = project.labBlueprints || [];

        if (labs.length === 0) {
            container.innerHTML = `
                <div class="phase3-empty-state">
                    <p>No lab blueprints yet.</p>
                    <p class="hint">Complete Phase 2 to generate lab placements, or use the chat to create lab blueprints.</p>
                </div>
            `;
            return;
        }

        // Summary bar
        const summaryHtml = _renderSummaryBar(labs, project);

        // Blueprint cards
        const cardsHtml = labs.map(lab => renderBlueprintCard(lab, project)).join('');

        container.innerHTML = summaryHtml + '<div class="blueprint-cards">' + cardsHtml + '</div>';
    }

    function _renderSummaryBar(labs, project) {
        const totalLabs = labs.length;
        const approvedCount = labs.filter(lab => {
            const status = getLabStatus(lab, project);
            return status === 'approved' || status === 'instructions-generated';
        }).length;
        const totalDuration = labs.reduce((sum, lab) => sum + getLabDuration(lab), 0);

        return `
            <div class="phase3-summary-bar">
                <div class="phase3-summary-stats">
                    <span class="phase3-stat">
                        <span class="phase3-stat-value">${totalLabs}</span> lab${totalLabs !== 1 ? 's' : ''}
                    </span>
                    <span class="phase3-stat">
                        <span class="phase3-stat-value">${approvedCount}</span> approved
                    </span>
                    <span class="phase3-stat">
                        <span class="phase3-stat-value">${formatDuration(totalDuration) || '0m'}</span> total
                    </span>
                </div>
                <button class="btn-approve-all" data-approve-all data-project-id="${project.id}">
                    Approve All
                </button>
            </div>
        `;
    }

    // ── Blueprint Card ───────────────────────────────────────────

    function renderBlueprintCard(lab, project) {
        const status = getLabStatus(lab, project);
        const statusLabel = getStatusLabel(status);
        const statusClass = getStatusClass(status);
        const approved = lab.approved || {};
        const duration = getLabDuration(lab);
        const hasInstructions = project.draftInstructions && project.draftInstructions[lab.id];

        let instructionsHtml = '';
        if (hasInstructions) {
            instructionsHtml = renderDraftInstructions(lab.id, project);
        }

        return `
            <div class="blueprint-card blueprint-${statusClass}" data-lab-id="${lab.id}">
                <div class="blueprint-card-header">
                    <span class="blueprint-status-badge ${statusClass}">${escHtml(statusLabel)}</span>
                    ${duration ? `<span class="blueprint-duration-badge">${formatDuration(duration)}</span>` : ''}
                </div>

                <div class="blueprint-field">
                    <div class="blueprint-field-row">
                        <label class="blueprint-field-label">Title</label>
                        <button class="blueprint-approve-btn ${approved.title ? 'approved' : ''}"
                                data-approve-field="title"
                                data-lab-id="${lab.id}"
                                data-project-id="${project.id}"
                                title="${approved.title ? 'Approved — click to unapprove' : 'Click to approve'}">
                            ${approved.title ? '&#9989;' : '&#9744;'}
                        </button>
                    </div>
                    <input type="text"
                           class="blueprint-title-input"
                           value="${escHtml(lab.title)}"
                           data-edit-title
                           data-lab-id="${lab.id}"
                           data-project-id="${project.id}"
                           placeholder="Lab title...">
                </div>

                <div class="blueprint-field">
                    <div class="blueprint-field-row">
                        <label class="blueprint-field-label">Description</label>
                        <button class="blueprint-approve-btn ${approved.description ? 'approved' : ''}"
                                data-approve-field="description"
                                data-lab-id="${lab.id}"
                                data-project-id="${project.id}"
                                title="${approved.description ? 'Approved — click to unapprove' : 'Click to approve'}">
                            ${approved.description ? '&#9989;' : '&#9744;'}
                        </button>
                    </div>
                    <textarea class="blueprint-description-textarea"
                              data-edit-description
                              data-lab-id="${lab.id}"
                              data-project-id="${project.id}"
                              placeholder="Short description..."
                              rows="3">${escHtml(lab.shortDescription || '')}</textarea>
                </div>

                <div class="blueprint-activities-section">
                    <div class="blueprint-field-row">
                        <button class="blueprint-activities-toggle${(lab.activities && lab.activities.length) ? '' : ' empty'}">
                            <span class="toggle-icon">&#9654;</span>
                            Activities (${(lab.activities || []).length})
                        </button>
                        <button class="blueprint-approve-btn ${approved.outline ? 'approved' : ''}"
                                data-approve-field="outline"
                                data-lab-id="${lab.id}"
                                data-project-id="${project.id}"
                                title="${approved.outline ? 'Approved — click to unapprove' : 'Click to approve'}">
                            ${approved.outline ? '&#9989;' : '&#9744;'}
                        </button>
                    </div>
                    <div class="blueprint-activities-body" style="display:none;">
                        ${renderActivities(lab.activities || [])}
                    </div>
                </div>

                <div class="blueprint-card-actions">
                    <button class="btn-generate-instructions"
                            data-generate-instructions
                            data-lab-id="${lab.id}"
                            data-project-id="${project.id}">
                        ${hasInstructions ? 'Regenerate Draft Instructions' : 'Generate Draft Instructions'}
                    </button>
                </div>

                ${instructionsHtml}
            </div>
        `;
    }

    // ── Activities ───────────────────────────────────────────────

    function renderActivities(activities) {
        if (!activities || activities.length === 0) {
            return '<div class="blueprint-activities-empty">No activities defined yet.</div>';
        }

        return activities.map((activity, idx) => {
            const tasks = activity.tasks || [];
            const duration = activity.duration || 0;

            return `
                <div class="blueprint-activity">
                    <div class="blueprint-activity-header">
                        <span class="blueprint-activity-number">${idx + 1}</span>
                        <span class="blueprint-activity-title">${escHtml(activity.title || 'Untitled Activity')}</span>
                        ${duration ? `<span class="blueprint-activity-duration">${formatDuration(duration)}</span>` : ''}
                    </div>
                    ${tasks.length > 0 ? `
                        <div class="blueprint-activity-tasks">
                            ${tasks.map(task => `
                                <div class="blueprint-task-item">
                                    <span class="blueprint-task-bullet"></span>
                                    <span class="blueprint-task-text">${escHtml(typeof task === 'string' ? task : task.description || task.title || '')}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // ── Draft Instructions ───────────────────────────────────────

    function renderDraftInstructions(labId, project) {
        const markdown = project.draftInstructions[labId];
        if (!markdown) return '';

        const renderedHtml = Markdown.render(markdown);

        return `
            <div class="blueprint-instructions">
                <div class="blueprint-instructions-header">
                    <span class="blueprint-instructions-label">Draft Instructions</span>
                    <div class="blueprint-instructions-actions">
                        <button data-toggle-instructions data-lab-id="${labId}">Raw Markdown</button>
                        <button data-copy-instructions data-lab-id="${labId}" data-project-id="${project.id}">Copy</button>
                        <button data-edit-instructions data-lab-id="${labId}" data-project-id="${project.id}">Edit</button>
                    </div>
                </div>

                <div id="instructions-preview-${labId}" class="blueprint-instructions-preview">
                    ${renderedHtml}
                </div>

                <div id="instructions-raw-${labId}" class="blueprint-instructions-raw" style="display:none;">
                    <pre>${escHtml(markdown)}</pre>
                </div>

                <div id="instructions-edit-${labId}" class="blueprint-instructions-edit" style="display:none;">
                    <textarea class="blueprint-instructions-textarea" rows="20">${escHtml(markdown)}</textarea>
                    <div class="blueprint-instructions-edit-actions">
                        <button data-save-instructions data-lab-id="${labId}" data-project-id="${project.id}">Save</button>
                        <button data-cancel-edit data-lab-id="${labId}" data-project-id="${project.id}">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }

    // ── Handlers ─────────────────────────────────────────────────

    function handleApprove(labId, field, projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;

        const lab = project.labBlueprints.find(b => b.id === labId);
        if (!lab) return;

        const approved = lab.approved || {};
        const currentlyApproved = !!approved[field];

        if (currentlyApproved) {
            // Unapprove — set to null
            Store.approveLabField(projectId, labId, field, null);
        } else {
            // Approve — store the current value
            let value;
            switch (field) {
                case 'title':
                    value = lab.title;
                    break;
                case 'description':
                    value = lab.shortDescription;
                    break;
                case 'outline':
                    value = lab.activities;
                    break;
                default:
                    value = true;
            }
            Store.approveLabField(projectId, labId, field, value);
        }

        const updatedProject = Store.getProject(projectId);
        render(updatedProject);
    }

    function handleApproveAll(projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;

        for (const lab of project.labBlueprints) {
            if (!lab.approved || !lab.approved.title) {
                Store.approveLabField(projectId, lab.id, 'title', lab.title);
            }
            if (!lab.approved || !lab.approved.description) {
                Store.approveLabField(projectId, lab.id, 'description', lab.shortDescription);
            }
            if (!lab.approved || !lab.approved.outline) {
                Store.approveLabField(projectId, lab.id, 'outline', lab.activities);
            }
        }

        const updatedProject = Store.getProject(projectId);
        render(updatedProject);
    }

    function handleEditField(labId, field, value, projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;

        const lab = project.labBlueprints.find(b => b.id === labId);
        if (!lab) return;

        lab[field] = value;

        // If the field was approved, clear approval since it changed
        if (lab.approved) {
            const approveKey = field === 'shortDescription' ? 'description' : field;
            if (lab.approved[approveKey]) {
                lab.approved[approveKey] = null;
            }
        }

        Store.updateProject(project);
    }

    async function handleGenerateInstructions(labId, projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;

        const lab = project.labBlueprints.find(b => b.id === labId);
        if (!lab) return;

        // Build a prompt asking Chat to generate draft instructions
        const prompt = `Generate detailed draft lab instructions for the following lab:\n\n` +
            `Title: ${lab.title}\n` +
            `Description: ${lab.shortDescription || 'N/A'}\n` +
            `Estimated Duration: ${getLabDuration(lab) || 'N/A'} minutes\n` +
            `Activities:\n${(lab.activities || []).map((a, i) =>
                `  ${i + 1}. ${a.title}${a.tasks ? ' — Tasks: ' + a.tasks.map(t => typeof t === 'string' ? t : t.description || t.title || '').join(', ') : ''}`
            ).join('\n')}\n\n` +
            `Please provide complete step-by-step instructions in markdown format with clear headings, ` +
            `numbered steps, expected outcomes, and any relevant notes or tips. ` +
            `Wrap the instructions in ===DRAFT_INSTRUCTIONS=== markers.`;

        // Disable the generate button and show loading
        const container = $('#phase3-context');
        const btn = container ? container.querySelector(`[data-generate-instructions][data-lab-id="${labId}"]`) : null;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Generating...';
        }

        try {
            const result = await Chat.sendMessage(3, projectId, prompt);

            if (result.structured && result.structured.draftInstructions) {
                const draft = result.structured.draftInstructions;
                const markdownContent = draft.markdown || JSON.stringify(draft);
                Store.setDraftInstructions(projectId, draft.labId || labId, markdownContent);
            }

            const updatedProject = Store.getProject(projectId);
            render(updatedProject);
        } catch (err) {
            console.error('[Phase3] Failed to generate instructions:', err);
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Generate Draft Instructions';
            }
        }
    }

    // ── AI results integration ───────────────────────────────────

    function applyAIResults(structured, projectId) {
        if (!structured) return;

        const project = Store.getProject(projectId);
        if (!project) return;

        // Handle LAB_BLUEPRINTS
        if (structured.blueprints && Array.isArray(structured.blueprints)) {
            const existing = project.labBlueprints || [];

            for (const bp of structured.blueprints) {
                const existingIdx = existing.findIndex(e => e.id === bp.id);
                const normalized = {
                    id: bp.id || Store.generateId(),
                    title: bp.title || '',
                    shortDescription: bp.shortDescription || bp.description || '',
                    estimatedDuration: bp.estimatedDuration || 0,
                    activities: (bp.activities || []).map(a => ({
                        title: a.title || '',
                        tasks: a.tasks || [],
                        duration: a.duration || a.estimatedDuration || 0,
                    })),
                    approved: (existingIdx >= 0 && existing[existingIdx].approved)
                        ? existing[existingIdx].approved
                        : { title: null, description: null, outline: null },
                };

                if (existingIdx >= 0) {
                    existing[existingIdx] = normalized;
                } else {
                    existing.push(normalized);
                }
            }

            project.labBlueprints = existing;
            Store.updateProject(project);
        }

        // Handle DRAFT_INSTRUCTIONS
        if (structured.draftInstructions) {
            const draft = structured.draftInstructions;
            if (draft.labId && draft.markdown) {
                Store.setDraftInstructions(projectId, draft.labId, draft.markdown);
            }
        }

        // Re-render with updated data
        const updatedProject = Store.getProject(projectId);
        render(updatedProject);
    }

    // ── Context Summary (for Phase 4) ────────────────────────────

    function getContextSummary(projectId) {
        const project = Store.getProject(projectId);
        if (!project) return '';

        const labs = project.labBlueprints || [];
        if (labs.length === 0) return 'No lab blueprints defined.';

        const lines = [`Phase 3 — Organize & Finalize: ${labs.length} lab blueprint(s)`];

        for (const lab of labs) {
            const status = getLabStatus(lab, project);
            const duration = getLabDuration(lab);
            const activityCount = (lab.activities || []).length;

            lines.push(`  - ${lab.title || 'Untitled'} [${getStatusLabel(status)}]` +
                (duration ? ` (${formatDuration(duration)})` : '') +
                ` — ${activityCount} activit${activityCount !== 1 ? 'ies' : 'y'}`);

            if (lab.activities && lab.activities.length) {
                for (const a of lab.activities) {
                    const taskCount = (a.tasks || []).length;
                    lines.push(`      ${a.title || 'Untitled'}` +
                        (a.duration ? ` (${formatDuration(a.duration)})` : '') +
                        ` — ${taskCount} task${taskCount !== 1 ? 's' : ''}`);
                }
            }

            const hasInstructions = project.draftInstructions && project.draftInstructions[lab.id];
            if (hasInstructions) {
                lines.push('      [Draft instructions generated]');
            }
        }

        const approvedCount = labs.filter(lab => {
            const s = getLabStatus(lab, project);
            return s === 'approved' || s === 'instructions-generated';
        }).length;
        const totalDuration = labs.reduce((sum, lab) => sum + getLabDuration(lab), 0);

        lines.push('');
        lines.push(`Summary: ${approvedCount}/${labs.length} approved, ${formatDuration(totalDuration) || '0m'} total estimated duration`);

        return lines.join('\n');
    }

    // ── Public API ───────────────────────────────────────────────

    return {
        init,
        render,
        renderBlueprintCard,
        renderActivities,
        renderDraftInstructions,
        handleApprove,
        handleApproveAll,
        handleEditField,
        handleGenerateInstructions,
        applyAIResults,
        getContextSummary,
    };
})();
