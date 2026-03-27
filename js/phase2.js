/**
 * phase2.js — Phase 2 "Design & Organize" UI controller for Lab Program Designer v3.
 * Manages the split-panel layout: chat on the left, context panel on the right.
 * Context panel shows a collapsible outline: Lab Series → Labs → Activities.
 * Tabs: Program Outline, Framework Mapping, Lab Settings.
 */

const Phase2 = (() => {

    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

    // ── Initialisation ───────────────────────────────────────────

    function init() {
        const container = $('#phase2-context');
        if (!container) return;

        _bindTabButtons(container);
        _bindExpandCollapseButtons(container);
        _bindFrameworkUploadInput(container);
    }

    function _bindTabButtons(container) {
        container.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('[data-phase2-tab]');
            if (!tabBtn) return;

            const tabName = tabBtn.dataset.phase2Tab;
            $$('[data-phase2-tab]', container).forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');
            $$('.phase2-tab-panel', container).forEach(p => p.classList.remove('active'));
            const panel = $(`#phase2-tab-${tabName}`, container);
            if (panel) panel.classList.add('active');
        });
    }

    function _bindExpandCollapseButtons(container) {
        container.addEventListener('click', (e) => {
            if (e.target.closest('#phase2-expand-all')) expandAll();
            else if (e.target.closest('#phase2-collapse-all')) collapseAll();
        });
    }

    function _bindFrameworkUploadInput(container) {
        container.addEventListener('change', (e) => {
            if (e.target.id === 'phase2-framework-upload') {
                const file = e.target.files[0];
                if (file) handleFrameworkUpload(file);
                e.target.value = '';
            }
        });
    }

    // ── Full render ──────────────────────────────────────────────

    function render(project) {
        const container = $('#phase2-context');
        if (!container) return;

        container.innerHTML = _buildTabsShell();
        renderOutline(project.programStructure);
        renderFrameworkTab(project);
        renderLabSettings(project);

        const firstBtn = $('[data-phase2-tab]', container);
        if (firstBtn) firstBtn.click();

        _bindTabButtons(container);
        _bindExpandCollapseButtons(container);
        _bindFrameworkUploadInput(container);
    }

    function _buildTabsShell() {
        return `
            <div class="phase2-tabs">
                <button class="context-tab active" data-phase2-tab="outline">Program Outline</button>
                <button class="context-tab" data-phase2-tab="framework">Framework Mapping</button>
                <button class="context-tab" data-phase2-tab="settings">Lab Settings</button>
            </div>

            <div id="phase2-tab-outline" class="phase2-tab-panel active">
                <div class="phase2-outline-toolbar">
                    <button id="phase2-expand-all" class="btn-sm" title="Expand All">Expand All</button>
                    <button id="phase2-collapse-all" class="btn-sm" title="Collapse All">Collapse All</button>
                </div>
                <div id="phase2-outline-tree"></div>
            </div>

            <div id="phase2-tab-framework" class="phase2-tab-panel">
                <div id="phase2-framework-content"></div>
            </div>

            <div id="phase2-tab-settings" class="phase2-tab-panel">
                <div id="phase2-settings-content"></div>
            </div>
        `;
    }

    // ── Tab 1: Program Outline (Lab Series → Labs → Activities) ──

    function renderOutline(programStructure) {
        const treeContainer = $('#phase2-outline-tree');
        if (!treeContainer) return;

        if (!programStructure || !programStructure.labSeries || programStructure.labSeries.length === 0) {
            treeContainer.innerHTML =
                '<div class="empty-state">' +
                '<p>No program structure yet.</p>' +
                '<p class="hint">Use the chat to generate a Lab Series and Labs structure from your objectives.</p>' +
                '</div>';
            return;
        }

        treeContainer.innerHTML = _renderLabSeriesList(programStructure.labSeries);
        _bindOutlineEvents(treeContainer);
    }

    function _renderLabSeriesList(labSeriesList) {
        return labSeriesList.map(ls => {
            const labs = ls.labs || [];
            const hasLabs = labs.length > 0;

            const labsHtml = hasLabs
                ? `<div class="outline-children">${labs.map(lab => _renderLab(lab)).join('')}</div>`
                : '';

            return `
                <div class="outline-node" data-depth="0" data-type="lab-series" data-id="${ls.id || ''}">
                    <span class="outline-toggle">${hasLabs ? '\u25B6' : ''}</span>
                    <span class="outline-icon">\u{1F4DA}</span>
                    <span class="outline-title" contenteditable="true" data-node-type="labSeries" data-node-id="${ls.id || ''}">${_escHtml(ls.title || 'Untitled Series')}</span>
                    <span class="outline-count">${labs.length} lab${labs.length !== 1 ? 's' : ''}</span>
                </div>
                ${labsHtml}
            `;
        }).join('');
    }

    function _renderLab(lab) {
        const activities = lab.activities || [];
        const hasActivities = activities.length > 0;
        const duration = lab.estimatedDuration ? ` (${lab.estimatedDuration} min)` : '';

        const activitiesHtml = hasActivities
            ? `<div class="outline-children collapsed">${activities.map(act => _renderActivity(act)).join('')}</div>`
            : '';

        return `
            <div class="outline-node" data-depth="1" data-type="lab" data-id="${lab.id || ''}">
                <span class="outline-toggle">${hasActivities ? '\u25B6' : ''}</span>
                <span class="outline-icon">\u{1F9EA}</span>
                <span class="outline-title" contenteditable="true" data-node-type="lab" data-node-id="${lab.id || ''}">${_escHtml(lab.title || 'Untitled Lab')}</span>
                <span class="outline-duration">${duration}</span>
            </div>
            ${activitiesHtml}
        `;
    }

    function _renderActivity(activity) {
        return `
            <div class="outline-node" data-depth="2" data-type="activity" data-id="${activity.id || ''}">
                <span class="outline-toggle"></span>
                <span class="outline-icon">\u{1F4CB}</span>
                <span class="outline-title" contenteditable="true" data-node-type="activity" data-node-id="${activity.id || ''}">${_escHtml(activity.title || 'Untitled Activity')}</span>
            </div>
        `;
    }

    function _bindOutlineEvents(container) {
        // Toggle expand/collapse
        container.addEventListener('click', (e) => {
            const toggle = e.target.closest('.outline-toggle');
            if (toggle) {
                const nodeEl = toggle.closest('.outline-node');
                if (nodeEl) toggleNode(nodeEl);
                return;
            }
            const icon = e.target.closest('.outline-icon');
            if (icon) {
                const nodeEl = icon.closest('.outline-node');
                if (nodeEl) toggleNode(nodeEl);
                return;
            }
        });

        // Inline editing
        container.addEventListener('blur', (e) => {
            if (e.target.classList.contains('outline-title')) {
                _handleTitleEdit(e.target);
            }
        }, true);

        container.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('outline-title')) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                } else if (e.key === 'Escape') {
                    if (e.target.dataset.original) {
                        e.target.textContent = e.target.dataset.original;
                    }
                    e.target.blur();
                }
            }
        });

        container.addEventListener('focus', (e) => {
            if (e.target.classList.contains('outline-title')) {
                e.target.dataset.original = e.target.textContent;
            }
        }, true);
    }

    function _handleTitleEdit(titleEl) {
        const newTitle = titleEl.textContent.trim();
        const oldTitle = titleEl.dataset.original || '';
        if (!newTitle || newTitle === oldTitle) {
            delete titleEl.dataset.original;
            return;
        }

        const project = Store.getActiveProject();
        if (!project || !project.programStructure) {
            delete titleEl.dataset.original;
            return;
        }

        const nodeType = titleEl.dataset.nodeType;
        const nodeId = titleEl.dataset.nodeId;

        if (nodeId) {
            _renameNodeById(project.programStructure, nodeType, nodeId, newTitle);
        } else {
            _renameNodeByTitle(project.programStructure, oldTitle, newTitle);
        }

        Store.updateProgramStructure(project.id, project.programStructure);
        delete titleEl.dataset.original;
    }

    function _renameNodeById(structure, nodeType, nodeId, newTitle) {
        if (!structure || !structure.labSeries) return;
        for (const ls of structure.labSeries) {
            if (nodeType === 'labSeries' && ls.id === nodeId) { ls.title = newTitle; return; }
            for (const lab of (ls.labs || [])) {
                if (nodeType === 'lab' && lab.id === nodeId) { lab.title = newTitle; return; }
                for (const act of (lab.activities || [])) {
                    if (nodeType === 'activity' && act.id === nodeId) { act.title = newTitle; return; }
                }
            }
        }
    }

    function _renameNodeByTitle(structure, oldTitle, newTitle) {
        if (!structure || !structure.labSeries) return;
        for (const ls of structure.labSeries) {
            if (ls.title === oldTitle) { ls.title = newTitle; return; }
            for (const lab of (ls.labs || [])) {
                if (lab.title === oldTitle) { lab.title = newTitle; return; }
                for (const act of (lab.activities || [])) {
                    if (act.title === oldTitle) { act.title = newTitle; return; }
                }
            }
        }
    }

    // ── Tree toggle operations ───────────────────────────────────

    function toggleNode(element) {
        const sibling = element.nextElementSibling;
        if (sibling && sibling.classList.contains('outline-children')) {
            sibling.classList.toggle('collapsed');
            const toggle = element.querySelector('.outline-toggle');
            if (toggle) {
                toggle.textContent = sibling.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
            }
        }
    }

    function expandAll() {
        const container = $('#phase2-outline-tree');
        if (!container) return;
        $$('.outline-children', container).forEach(el => el.classList.remove('collapsed'));
        $$('.outline-toggle', container).forEach(el => {
            if (el.textContent.trim()) el.textContent = '\u25BC';
        });
    }

    function collapseAll() {
        const container = $('#phase2-outline-tree');
        if (!container) return;
        $$('.outline-children', container).forEach(el => el.classList.add('collapsed'));
        $$('.outline-toggle', container).forEach(el => {
            if (el.textContent.trim()) el.textContent = '\u25B6';
        });
    }

    // ── Tab 2: Framework Mapping ─────────────────────────────────

    function renderFrameworkTab(project) {
        const content = $('#phase2-framework-content');
        if (!content) return;

        const frameworks = typeof Frameworks !== 'undefined' ? Frameworks.getAll() : [];
        const domains = typeof Frameworks !== 'undefined' ? Frameworks.getDomains() : {};
        const selectedId = project.framework || '';

        let optionsHtml = '<option value="">None (Skip)</option>';
        for (const [domain, fws] of Object.entries(domains)) {
            optionsHtml += `<optgroup label="${_escHtml(domain)}">`;
            fws.forEach(fw => {
                const sel = fw.id === selectedId ? ' selected' : '';
                optionsHtml += `<option value="${fw.id}"${sel}>${_escHtml(fw.name)}</option>`;
            });
            optionsHtml += '</optgroup>';
        }

        let mappingHtml = '';
        if (selectedId && selectedId !== 'custom') {
            const fw = typeof Frameworks !== 'undefined' ? Frameworks.getById(selectedId) : null;
            if (fw) {
                mappingHtml = `
                    <div class="framework-info" style="margin-top:12px;">
                        <div class="goal-item"><strong>${_escHtml(fw.name)}</strong> (${_escHtml(fw.publisher)})</div>
                        <p style="font-size:12px;color:#6b7280;margin-top:4px;">${_escHtml(fw.description)}</p>
                        ${fw.competencies && fw.competencies.length > 0
                            ? '<div style="margin-top:8px;"><strong style="font-size:12px;">Competency Areas:</strong><ul style="font-size:12px;margin:4px 0 0 16px;">'
                              + fw.competencies.map(c => `<li>${_escHtml(typeof c === 'string' ? c : c.name || c)}</li>`).join('')
                              + '</ul></div>'
                            : ''
                        }
                    </div>
                `;
                if (project.frameworkData && project.frameworkData.mappings) {
                    mappingHtml += _renderMappings(project.frameworkData.mappings);
                }
            }
        } else if (selectedId === 'custom' && project.frameworkData) {
            mappingHtml = `
                <div class="goal-item" style="margin-top:12px;">Custom framework: ${_escHtml(project.frameworkData.name || 'Uploaded')}</div>
                <p style="font-size:12px;color:#6b7280;margin-top:4px;">Ask in chat to map your program structure to this framework.</p>
            `;
        }

        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Framework</label>
                <select id="phase2-framework-select" class="form-select">${optionsHtml}</select>
            </div>
            <div class="form-group" style="margin-top:8px;">
                <label class="form-label">Or upload a custom framework</label>
                <input type="file" id="phase2-framework-upload" accept=".json,.csv,.txt" class="form-input" />
            </div>
            <div id="phase2-framework-mapping">${mappingHtml}</div>
        `;

        const select = $('#phase2-framework-select', content);
        if (select) {
            select.addEventListener('change', () => {
                handleFrameworkSelect(select.value, project.id);
            });
        }
    }

    function _renderMappings(mappings) {
        if (!Array.isArray(mappings) || mappings.length === 0) return '';
        let html = '<div style="margin-top:12px;"><strong style="font-size:12px;">Program Mappings:</strong>';
        html += '<div style="margin-top:6px;">';
        mappings.forEach(m => {
            html += `
                <div style="font-size:12px;padding:4px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="color:#1e40af;font-weight:500;">${_escHtml(m.competency || m.area || '')}</span>
                    <span style="color:#6b7280;"> \u2192 </span>
                    <span>${_escHtml(m.curriculumItem || m.lab || m.activity || '')}</span>
                </div>
            `;
        });
        html += '</div></div>';
        return html;
    }

    function handleFrameworkSelect(frameworkId, projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;
        project.framework = frameworkId || null;
        if (!frameworkId) project.frameworkData = null;
        Store.updateProject(project);
        renderFrameworkTab(project);
    }

    function handleFrameworkUpload(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const ext = file.name.split('.').pop().toLowerCase();
                const parsed = Frameworks.parseUploadedFramework(ev.target.result, ext);
                const customId = 'custom-' + Date.now();
                const registered = Frameworks.registerCustom({
                    id: customId,
                    name: parsed.name || file.name,
                    organization: 'Custom Upload',
                    domain: 'Custom',
                    description: `Uploaded from ${file.name}`,
                    competencies: parsed.competencies || [],
                });

                const project = Store.getActiveProject();
                if (project) {
                    project.framework = registered.id;
                    project.frameworkData = {
                        name: parsed.name || file.name,
                        competencies: parsed.competencies || [],
                        source: 'upload',
                    };
                    Store.updateProject(project);
                    renderFrameworkTab(project);
                }
            } catch (err) {
                console.error('[Phase2] Framework upload parse error:', err);
                alert('Could not parse framework file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    // ── Tab 3: Lab Settings ──────────────────────────────────────

    function renderLabSettings(project) {
        const content = $('#phase2-settings-content');
        if (!content) return;

        const defaultSeatTime = (typeof Settings !== 'undefined' && Settings.get('defaultSeatTime')) || 45;
        const defaultActivities = (typeof Settings !== 'undefined' && Settings.get('activitiesPerLab')) || 5;

        const seatTime = project.seatTime || { min: defaultSeatTime, max: 90 };
        const instructionStyle = project.instructionStyle || '';

        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Seat Time (minutes)</label>
                <div style="display:flex;gap:8px;align-items:center;">
                    <div style="flex:1;">
                        <label style="font-size:11px;color:#6b7280;">Min</label>
                        <input type="number" id="phase2-seat-min" class="form-input" value="${seatTime.min}" min="5" max="480" />
                    </div>
                    <span style="margin-top:16px;color:#9ca3af;">\u2013</span>
                    <div style="flex:1;">
                        <label style="font-size:11px;color:#6b7280;">Max</label>
                        <input type="number" id="phase2-seat-max" class="form-input" value="${seatTime.max}" min="5" max="480" />
                    </div>
                </div>
            </div>

            <div class="form-group" style="margin-top:12px;">
                <label class="form-label">Instruction Style</label>
                <select id="phase2-instruction-style" class="form-select">
                    <option value=""${!instructionStyle ? ' selected' : ''}>Not yet decided</option>
                    <option value="step-by-step"${instructionStyle === 'step-by-step' ? ' selected' : ''}>Step-by-step</option>
                    <option value="challenge"${instructionStyle === 'challenge' ? ' selected' : ''}>Challenge-based</option>
                    <option value="mixed"${instructionStyle === 'mixed' ? ' selected' : ''}>Mixed</option>
                </select>
                <span class="form-hint">The AI will ask about this during the conversation if not set here.</span>
            </div>

            <button id="phase2-save-settings" class="btn btn-primary" style="margin-top:12px;">Save Settings</button>
            <span id="phase2-settings-saved" style="font-size:12px;color:#10b981;margin-left:8px;display:none;">Saved!</span>
        `;

        const saveBtn = $('#phase2-save-settings', content);
        if (saveBtn) {
            saveBtn.addEventListener('click', () => _saveLabSettings(project.id));
        }
    }

    function _saveLabSettings(projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;

        const minVal = parseInt($('#phase2-seat-min').value) || 45;
        const maxVal = parseInt($('#phase2-seat-max').value) || 90;
        project.seatTime = { min: Math.min(minVal, maxVal), max: Math.max(minVal, maxVal) };

        const style = $('#phase2-instruction-style').value;
        if (style) {
            project.instructionStyle = style;
            Store.setInstructionStyle(projectId, style);
        }

        Store.updateProject(project);

        const indicator = $('#phase2-settings-saved');
        if (indicator) {
            indicator.style.display = 'inline';
            setTimeout(() => { indicator.style.display = 'none'; }, 2000);
        }
    }

    // ── AI Results Integration ───────────────────────────────────

    function applyAIResults(structured, projectId) {
        if (!structured || !projectId) return;

        // Update program structure in Store
        Store.updateProgramStructure(projectId, structured);

        // Save instruction style if provided
        if (structured.instructionStyle) {
            Store.setInstructionStyle(projectId, structured.instructionStyle);
        }

        renderOutline(structured);
    }

    // ── Context Summary ──────────────────────────────────────────

    function getContextSummary(projectId) {
        const project = Store.getProject(projectId);
        if (!project) return 'No project data available.';

        const lines = [];
        lines.push('## Phase 2: Design & Organize Summary');
        lines.push('');

        if (project.programStructure && project.programStructure.labSeries) {
            lines.push('### Program Outline');
            for (const ls of project.programStructure.labSeries) {
                lines.push(`- [Lab Series] ${ls.title || 'Untitled'}`);
                for (const lab of (ls.labs || [])) {
                    const dur = lab.estimatedDuration ? ` (${lab.estimatedDuration} min)` : '';
                    lines.push(`  - [Lab] ${lab.title || 'Untitled'}${dur}`);
                    for (const act of (lab.activities || [])) {
                        lines.push(`    - [Activity] ${act.title || 'Untitled'}`);
                    }
                }
            }
            lines.push('');
        } else {
            lines.push('### Program Structure: Not yet defined');
            lines.push('');
        }

        if (project.framework) {
            const fw = typeof Frameworks !== 'undefined' ? Frameworks.getById(project.framework) : null;
            if (fw) {
                lines.push(`### Framework: ${fw.name} (${fw.publisher})`);
            } else {
                lines.push(`### Framework: ${project.framework}`);
            }
            lines.push('');
        }

        const seatTime = project.seatTime || { min: 45, max: 90 };
        lines.push('### Lab Settings');
        lines.push(`- Seat time: ${seatTime.min}\u2013${seatTime.max} minutes`);
        if (project.instructionStyle) {
            lines.push(`- Instruction style: ${project.instructionStyle}`);
        }
        lines.push('');

        return lines.join('\n');
    }

    // ── Utilities ────────────────────────────────────────────────

    function _escHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Public API ───────────────────────────────────────────────

    return {
        init,
        render,
        renderOutline,
        renderFrameworkTab,
        renderLabSettings,
        toggleNode,
        expandAll,
        collapseAll,
        applyAIResults,
        handleFrameworkSelect,
        handleFrameworkUpload,
        getContextSummary,
    };
})();
