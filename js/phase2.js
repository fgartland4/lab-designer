/**
 * phase2.js — Phase 2 "Design & Configure" UI controller for Lab Program Designer v3.
 * Manages the split-panel layout: chat on the left, context panel on the right.
 * Context panel has three tabs: Curriculum Outline, Framework Mapping, Lab Settings.
 */

const Phase2 = (() => {

    // ── DOM helpers ──────────────────────────────────────────────

    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

    // Icons per node type
    const NODE_ICONS = {
        course:  '\u{1F4D8}', // 📘
        module:  '\u{1F4D9}', // 📙
        lesson:  '\u{1F4D7}', // 📗
        topic:   '\u{1F4C4}', // 📄
    };

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

            // Activate button
            $$('[data-phase2-tab]', container).forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');

            // Activate panel
            $$('.phase2-tab-panel', container).forEach(p => p.classList.remove('active'));
            const panel = $(`#phase2-tab-${tabName}`, container);
            if (panel) panel.classList.add('active');
        });
    }

    function _bindExpandCollapseButtons(container) {
        container.addEventListener('click', (e) => {
            if (e.target.closest('#phase2-expand-all')) {
                expandAll();
            } else if (e.target.closest('#phase2-collapse-all')) {
                collapseAll();
            }
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

        // Render each tab's content
        renderOutline(project.curriculum);
        renderFrameworkTab(project);
        renderLabSettings(project);

        // Activate first tab
        const firstBtn = $('[data-phase2-tab]', container);
        if (firstBtn) firstBtn.click();

        // Re-bind delegated listeners
        _bindTabButtons(container);
        _bindExpandCollapseButtons(container);
        _bindFrameworkUploadInput(container);
    }

    function _buildTabsShell() {
        return `
            <div class="phase2-tabs">
                <button class="context-tab active" data-phase2-tab="outline">Curriculum Outline</button>
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

    // ── Tab 1: Curriculum Outline ────────────────────────────────

    function renderOutline(curriculum) {
        const treeContainer = $('#phase2-outline-tree');
        if (!treeContainer) return;

        if (!curriculum || !curriculum.children || curriculum.children.length === 0) {
            // Also handle legacy format with .courses
            const items = curriculum && (curriculum.children || curriculum.courses);
            if (!items || items.length === 0) {
                treeContainer.innerHTML =
                    '<div class="empty-state">' +
                    '<p>No curriculum outline yet.</p>' +
                    '<p class="hint">Use the chat to generate a curriculum structure from your objectives.</p>' +
                    '</div>';
                return;
            }
        }

        const nodes = curriculum.children || curriculum.courses || [];
        treeContainer.innerHTML = _renderNodes(nodes, 0, 'course');
        _bindOutlineEvents(treeContainer);
    }

    /**
     * Recursively render tree nodes.
     * Each node: { type?, title, children?, lab? }
     * Depth determines indentation via CSS class.
     */
    function _renderNodes(nodes, depth, defaultType) {
        if (!Array.isArray(nodes) || nodes.length === 0) return '';

        const typeOrder = ['course', 'module', 'lesson', 'topic'];
        const nextType = typeOrder[typeOrder.indexOf(defaultType) + 1] || 'topic';

        return nodes.map(node => {
            const nodeType = node.type || defaultType;
            const icon = NODE_ICONS[nodeType] || NODE_ICONS.topic;
            const children = node.children || node.modules || node.lessons || node.topics || [];
            const hasChildren = children.length > 0;

            // Determine child default type
            let childDefaultType = nextType;
            if (node.modules) childDefaultType = 'module';
            else if (node.lessons) childDefaultType = 'lesson';
            else if (node.topics) childDefaultType = 'topic';

            // Lab badge
            let labBadge = '';
            if (node.lab) {
                const labName = typeof node.lab === 'string' ? node.lab : (node.lab.title || node.lab.name || 'Lab');
                const labDuration = (typeof node.lab === 'object' && node.lab.estimatedDuration)
                    ? ` (${node.lab.estimatedDuration} min)` : '';
                labBadge = `<span class="outline-lab-badge">\u{1F9EA} ${_escHtml(labName)}${labDuration}</span>`;
            }

            // Also check labPlacements for this node (matched by title)
            // labBadge handled above for inline lab references

            const toggleIcon = hasChildren ? '\u25B6' : '';  // ▶
            const childrenHtml = hasChildren
                ? `<div class="outline-children collapsed">${_renderNodes(children, depth + 1, childDefaultType)}</div>`
                : '';

            return `
                <div class="outline-node" data-depth="${depth}" data-type="${nodeType}">
                    <span class="outline-toggle">${toggleIcon}</span>
                    <span class="outline-icon">${icon}</span>
                    <span class="outline-title" contenteditable="true">${_escHtml(node.title || 'Untitled')}</span>
                    ${labBadge}
                </div>
                ${childrenHtml}
            `;
        }).join('');
    }

    function _bindOutlineEvents(container) {
        // Toggle expand/collapse on clicking the toggle arrow or the node row
        container.addEventListener('click', (e) => {
            const toggle = e.target.closest('.outline-toggle');
            if (toggle) {
                const nodeEl = toggle.closest('.outline-node');
                if (nodeEl) toggleNode(nodeEl);
                return;
            }

            // Clicking icon also toggles
            const icon = e.target.closest('.outline-icon');
            if (icon) {
                const nodeEl = icon.closest('.outline-node');
                if (nodeEl) toggleNode(nodeEl);
                return;
            }
        });

        // Inline editing: save on blur or Enter
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
                    // Revert to original — store original in dataset on focus
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
        if (newTitle && newTitle !== oldTitle) {
            // Update the curriculum in Store
            const project = Store.getActiveProject();
            if (project && project.curriculum) {
                _deepRenameTitle(project.curriculum, oldTitle, newTitle);
                Store.updateCurriculum(project.id, project.curriculum);
            }
        }
        delete titleEl.dataset.original;
    }

    function _deepRenameTitle(node, oldTitle, newTitle) {
        if (!node) return;
        if (node.title === oldTitle) node.title = newTitle;
        const childArrays = ['children', 'courses', 'modules', 'lessons', 'topics'];
        for (const key of childArrays) {
            if (Array.isArray(node[key])) {
                node[key].forEach(child => _deepRenameTitle(child, oldTitle, newTitle));
            }
        }
        if (node.lab && typeof node.lab === 'object' && node.lab.title === oldTitle) {
            node.lab.title = newTitle;
        }
    }

    // ── Tree toggle operations ───────────────────────────────────

    function toggleNode(element) {
        const sibling = element.nextElementSibling;
        if (sibling && sibling.classList.contains('outline-children')) {
            sibling.classList.toggle('collapsed');
            // Update toggle icon
            const toggle = element.querySelector('.outline-toggle');
            if (toggle) {
                toggle.textContent = sibling.classList.contains('collapsed') ? '\u25B6' : '\u25BC'; // ▶ / ▼
            }
        }
    }

    function expandAll() {
        const container = $('#phase2-outline-tree');
        if (!container) return;
        $$('.outline-children', container).forEach(el => el.classList.remove('collapsed'));
        $$('.outline-toggle', container).forEach(el => {
            if (el.textContent.trim()) el.textContent = '\u25BC'; // ▼
        });
    }

    function collapseAll() {
        const container = $('#phase2-outline-tree');
        if (!container) return;
        $$('.outline-children', container).forEach(el => el.classList.add('collapsed'));
        $$('.outline-toggle', container).forEach(el => {
            if (el.textContent.trim()) el.textContent = '\u25B6'; // ▶
        });
    }

    // ── Tab 2: Framework Mapping ─────────────────────────────────

    function renderFrameworkTab(project) {
        const content = $('#phase2-framework-content');
        if (!content) return;

        const frameworks = typeof Frameworks !== 'undefined' ? Frameworks.getAll() : [];
        const domains = typeof Frameworks !== 'undefined' ? Frameworks.getDomains() : {};
        const selectedId = project.framework || '';

        // Build framework selector options grouped by domain
        let optionsHtml = '<option value="">None (Skip)</option>';
        for (const [domain, fws] of Object.entries(domains)) {
            optionsHtml += `<optgroup label="${_escHtml(domain)}">`;
            fws.forEach(fw => {
                const sel = fw.id === selectedId ? ' selected' : '';
                optionsHtml += `<option value="${fw.id}"${sel}>${_escHtml(fw.name)}</option>`;
            });
            optionsHtml += '</optgroup>';
        }

        // Framework mapping display
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

                // Show mapping if frameworkData exists
                if (project.frameworkData && project.frameworkData.mappings) {
                    mappingHtml += _renderMappings(project.frameworkData.mappings);
                }
            }
        } else if (selectedId === 'custom' && project.frameworkData) {
            mappingHtml = `
                <div class="goal-item" style="margin-top:12px;">Custom framework: ${_escHtml(project.frameworkData.name || 'Uploaded')}</div>
                <p style="font-size:12px;color:#6b7280;margin-top:4px;">Ask in chat to map your curriculum to this framework.</p>
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

        // Bind select change
        const select = $('#phase2-framework-select', content);
        if (select) {
            select.addEventListener('change', () => {
                handleFrameworkSelect(select.value, project.id);
            });
        }
    }

    function _renderMappings(mappings) {
        if (!Array.isArray(mappings) || mappings.length === 0) return '';
        let html = '<div style="margin-top:12px;"><strong style="font-size:12px;">Curriculum Mappings:</strong>';
        html += '<div style="margin-top:6px;">';
        mappings.forEach(m => {
            html += `
                <div style="font-size:12px;padding:4px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="color:#1e40af;font-weight:500;">${_escHtml(m.competency || m.area || '')}</span>
                    <span style="color:#6b7280;"> \u2192 </span>
                    <span>${_escHtml(m.curriculumItem || m.lesson || m.topic || '')}</span>
                </div>
            `;
        });
        html += '</div></div>';
        return html;
    }

    function handleFrameworkSelect(frameworkId, projectId) {
        Store.mutateProject
            ? _saveFramework(frameworkId, projectId)
            : _saveFrameworkFallback(frameworkId, projectId);

        // Re-render the mapping area
        const project = Store.getProject(projectId);
        if (project) {
            const mappingArea = $('#phase2-framework-mapping');
            if (mappingArea) {
                if (!frameworkId) {
                    mappingArea.innerHTML = '';
                } else {
                    renderFrameworkTab(project);
                }
            }
        }
    }

    function _saveFramework(frameworkId, projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;
        project.framework = frameworkId || null;
        if (!frameworkId) project.frameworkData = null;
        Store.updateProject(project);
    }

    function _saveFrameworkFallback(frameworkId, projectId) {
        _saveFramework(frameworkId, projectId);
    }

    function handleFrameworkUpload(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const ext = file.name.split('.').pop().toLowerCase();
                const parsed = Frameworks.parseUploadedFramework(ev.target.result, ext);

                // Generate a unique id
                const customId = 'custom-' + Date.now();
                const registered = Frameworks.registerCustom({
                    id: customId,
                    name: parsed.name || file.name,
                    organization: 'Custom Upload',
                    domain: 'Custom',
                    description: `Uploaded from ${file.name}`,
                    competencies: parsed.competencies || [],
                });

                // Save to active project
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
        const navOptions = project.navOptions || {};
        const navStyle = navOptions.labNavStyle || 'sequential';
        const brandingNotes = navOptions.brandingNotes || '';
        const activitiesPerLab = navOptions.activitiesPerLab || defaultActivities;

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
                <label class="form-label">Lab Navigation Style</label>
                <select id="phase2-nav-style" class="form-select">
                    <option value="sequential"${navStyle === 'sequential' ? ' selected' : ''}>Sequential</option>
                    <option value="open"${navStyle === 'open' ? ' selected' : ''}>Open Navigation</option>
                    <option value="challenge"${navStyle === 'challenge' ? ' selected' : ''}>Challenge-based</option>
                </select>
            </div>

            <div class="form-group" style="margin-top:12px;">
                <label class="form-label">Activities per Lab</label>
                <input type="number" id="phase2-activities-per-lab" class="form-input" value="${activitiesPerLab}" min="1" max="20" />
            </div>

            <div class="form-group" style="margin-top:12px;">
                <label class="form-label">Branding Notes</label>
                <textarea id="phase2-branding-notes" class="form-textarea" rows="4" placeholder="e.g. Use Contoso brand, include corporate logo, follow brand guidelines...">${_escHtml(brandingNotes)}</textarea>
            </div>

            <button id="phase2-save-settings" class="btn btn-primary" style="margin-top:12px;">Save Settings</button>
            <span id="phase2-settings-saved" style="font-size:12px;color:#10b981;margin-left:8px;display:none;">Saved!</span>
        `;

        // Bind save
        const saveBtn = $('#phase2-save-settings', content);
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                _saveLabSettings(project.id);
            });
        }
    }

    function _saveLabSettings(projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;

        const minVal = parseInt($('#phase2-seat-min').value) || 45;
        const maxVal = parseInt($('#phase2-seat-max').value) || 90;

        project.seatTime = {
            min: Math.min(minVal, maxVal),
            max: Math.max(minVal, maxVal),
        };

        project.navOptions = {
            labNavStyle: $('#phase2-nav-style').value || 'sequential',
            brandingNotes: $('#phase2-branding-notes').value || '',
            activitiesPerLab: parseInt($('#phase2-activities-per-lab').value) || 5,
        };

        Store.updateProject(project);

        // Flash saved indicator
        const indicator = $('#phase2-settings-saved');
        if (indicator) {
            indicator.style.display = 'inline';
            setTimeout(() => { indicator.style.display = 'none'; }, 2000);
        }
    }

    // ── AI Results Integration ───────────────────────────────────

    /**
     * Called when Chat returns structured CURRICULUM data.
     * Updates the Store and re-renders the outline tree.
     */
    function applyAIResults(structured, projectId) {
        if (!structured || !projectId) return;

        // Update curriculum in Store
        Store.updateCurriculum(projectId, structured);

        // If lab placements are included, save those too
        if (structured.labPlacements) {
            Store.updateLabPlacements(projectId, structured.labPlacements);
        }

        // Re-render the outline
        renderOutline(structured);
    }

    // ── Context Summary ──────────────────────────────────────────

    /**
     * Returns a text summary of Phase 2 data for use in later phases.
     */
    function getContextSummary(projectId) {
        const project = Store.getProject(projectId);
        if (!project) return 'No project data available.';

        const lines = [];
        lines.push('## Phase 2: Design & Configure Summary');
        lines.push('');

        // Curriculum summary
        if (project.curriculum) {
            lines.push('### Curriculum Outline');
            _summarizeNodes(project.curriculum.children || project.curriculum.courses || [], 0, lines);
            lines.push('');
        } else {
            lines.push('### Curriculum: Not yet defined');
            lines.push('');
        }

        // Framework
        if (project.framework) {
            const fw = typeof Frameworks !== 'undefined' ? Frameworks.getById(project.framework) : null;
            if (fw) {
                lines.push(`### Framework: ${fw.name} (${fw.publisher})`);
            } else if (project.framework === 'custom' && project.frameworkData) {
                lines.push(`### Framework: ${project.frameworkData.name || 'Custom'}`);
            } else {
                lines.push(`### Framework: ${project.framework}`);
            }
            lines.push('');
        }

        // Lab settings
        const seatTime = project.seatTime || { min: 45, max: 90 };
        const navOptions = project.navOptions || {};
        lines.push('### Lab Settings');
        lines.push(`- Seat time: ${seatTime.min}–${seatTime.max} minutes`);
        lines.push(`- Navigation style: ${navOptions.labNavStyle || 'sequential'}`);
        lines.push(`- Activities per lab: ${navOptions.activitiesPerLab || 5}`);
        if (navOptions.brandingNotes) {
            lines.push(`- Branding notes: ${navOptions.brandingNotes}`);
        }
        lines.push('');

        // Lab placements
        if (project.labPlacements && project.labPlacements.length > 0) {
            lines.push('### Lab Placements');
            project.labPlacements.forEach(lp => {
                lines.push(`- ${lp.labName} (${lp.estimatedDuration || '?'} min): ${lp.rationale || ''}`);
            });
            lines.push('');
        }

        return lines.join('\n');
    }

    function _summarizeNodes(nodes, depth, lines) {
        if (!Array.isArray(nodes)) return;
        const indent = '  '.repeat(depth);
        nodes.forEach(node => {
            const typeLabel = node.type ? `[${node.type}] ` : '';
            let labInfo = '';
            if (node.lab) {
                const labName = typeof node.lab === 'string' ? node.lab : (node.lab.title || node.lab.name || 'Lab');
                labInfo = ` \u{1F9EA} ${labName}`;
            }
            lines.push(`${indent}- ${typeLabel}${node.title || 'Untitled'}${labInfo}`);
            const children = node.children || node.modules || node.lessons || node.topics || [];
            _summarizeNodes(children, depth + 1, lines);
        });
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
