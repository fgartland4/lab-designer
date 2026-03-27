/**
 * phase1.js — Phase 1 "Audiences & Objectives" UI controller.
 * Manages the split-panel layout: chat (left) + context panel (right).
 *
 * Context panel sections:
 *   - Uploaded Materials
 *   - Target Audiences
 *   - Business & Learning Objectives
 *   - Success Criteria
 *   - Technology & Platform
 *   - Documentation & References
 *   - Scenario Seeds
 *   - Competencies
 *
 * Depends on: Store (global IIFE).
 */

const Phase1 = (() => {

    // ── Utilities ───────────────────────────────────────────────

    function escHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(isoStr) {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return '';
        }
    }

    function $(sel, ctx) {
        return (ctx || document).querySelector(sel);
    }

    function $$(sel, ctx) {
        return [...(ctx || document).querySelectorAll(sel)];
    }

    // ── Initialization ──────────────────────────────────────────

    function init() {
        _bindUploadButton();
        _bindAddUrlButton();
        _bindFileInput();
    }

    function _bindUploadButton() {
        const container = $('#phase1-context');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const uploadBtn = e.target.closest('[data-action="trigger-upload"]');
            if (uploadBtn) {
                const fileInput = $('#phase1-file-input');
                if (fileInput) fileInput.click();
            }
        });
    }

    function _bindAddUrlButton() {
        const container = $('#phase1-context');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const addUrlBtn = e.target.closest('[data-action="add-url"]');
            if (addUrlBtn) {
                _showUrlInput(addUrlBtn);
            }
        });
    }

    function _bindFileInput() {
        const fileInput = $('#phase1-file-input');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const project = Store.getActiveProject();
            if (!project) return;

            Array.from(e.target.files).forEach(file => {
                handleUpload(file, project.id);
            });
            e.target.value = '';
        });
    }

    function _showUrlInput(triggerBtn) {
        const existing = $('#phase1-url-input-row');
        if (existing) {
            existing.remove();
            return;
        }

        const row = document.createElement('div');
        row.id = 'phase1-url-input-row';
        row.className = 'url-input-row';
        row.innerHTML = `
            <input type="url" class="url-input-field" placeholder="https://example.com/document" />
            <button class="url-input-submit" title="Add URL">Add</button>
            <button class="url-input-cancel" title="Cancel">&times;</button>
        `;

        triggerBtn.parentElement.insertAdjacentElement('afterend', row);

        const input = row.querySelector('.url-input-field');
        const submitBtn = row.querySelector('.url-input-submit');
        const cancelBtn = row.querySelector('.url-input-cancel');

        input.focus();

        const submit = () => {
            const url = input.value.trim();
            if (!url) return;
            const project = Store.getActiveProject();
            if (!project) return;
            handleAddUrl(url, project.id);
            row.remove();
        };

        submitBtn.addEventListener('click', submit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') row.remove();
        });
        cancelBtn.addEventListener('click', () => row.remove());
    }

    // ── Render: full context panel ──────────────────────────────

    function render(project) {
        const container = $('#phase1-context');
        if (!container) return;

        container.innerHTML = '';

        renderUploads(project, container);
        renderTechnologyPlatform(project, container);
        renderAudiences(project, container);
        renderObjectives(project, container);
        renderSuccessCriteria(project, container);
        renderDocumentationRefs(project, container);
        renderScenarioSeeds(project, container);
        renderCompetencies(project, container);
    }

    // ── Render: Uploads section ─────────────────────────────────

    function renderUploads(project, container) {
        const ctx = container || $('#phase1-context');
        if (!ctx) return;

        let section = ctx.querySelector('[data-section="uploads"]');
        if (!section) {
            section = document.createElement('div');
            section.className = 'context-section';
            section.dataset.section = 'uploads';
            ctx.appendChild(section);
        }

        const uploads = project.uploads || [];
        const urls = project.urls || [];
        const hasItems = uploads.length > 0 || urls.length > 0;

        let itemsHtml = '';
        if (!hasItems) {
            itemsHtml = '<div class="empty-state"><p>No materials uploaded yet.</p><p class="hint">Upload JTAs, job descriptions, or learning objectives to get started.</p></div>';
        } else {
            itemsHtml = uploads.map(u => `
                <div class="upload-item" data-id="${u.id}" data-type="file">
                    <div class="upload-item-icon" title="File">&#128196;</div>
                    <div class="upload-item-info">
                        <div class="upload-item-name">${escHtml(u.name)}</div>
                        <div class="upload-item-meta">${formatDate(u.addedAt)}</div>
                    </div>
                    <button class="upload-item-remove" data-action="remove-upload" data-id="${u.id}" title="Remove">&times;</button>
                </div>
            `).join('');

            itemsHtml += urls.map(u => `
                <div class="upload-item" data-id="${u.id}" data-type="url">
                    <div class="upload-item-icon" title="URL">&#128279;</div>
                    <div class="upload-item-info">
                        <div class="upload-item-name">${escHtml(u.title || u.url)}</div>
                        <div class="upload-item-meta">${formatDate(u.addedAt)}</div>
                    </div>
                    <button class="upload-item-remove" data-action="remove-url" data-id="${u.id}" title="Remove">&times;</button>
                </div>
            `).join('');
        }

        section.innerHTML = `
            <div class="context-section-header">
                <h3 class="context-section-title">Uploaded Materials</h3>
                <div class="context-section-actions">
                    <button class="context-action-btn" data-action="trigger-upload" title="Upload file">&#128206;</button>
                    <button class="context-action-btn" data-action="add-url" title="Add URL">+ URL</button>
                </div>
            </div>
            <div class="uploads-list">
                ${itemsHtml}
            </div>
        `;

        section.querySelectorAll('[data-action="remove-upload"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                _removeUpload(project.id, btn.dataset.id);
                render(Store.getProject(project.id));
            });
        });

        section.querySelectorAll('[data-action="remove-url"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                _removeUrl(project.id, btn.dataset.id);
                render(Store.getProject(project.id));
            });
        });
    }

    function _removeUpload(projectId, uploadId) {
        const project = Store.getProject(projectId);
        if (!project) return;
        project.uploads = (project.uploads || []).filter(u => u.id !== uploadId);
        Store.updateProject(project);
    }

    function _removeUrl(projectId, urlId) {
        const project = Store.getProject(projectId);
        if (!project) return;
        project.urls = (project.urls || []).filter(u => u.id !== urlId);
        Store.updateProject(project);
    }

    // ── Render: Technology & Platform ────────────────────────────

    function renderTechnologyPlatform(project, container) {
        const ctx = container || $('#phase1-context');
        if (!ctx) return;

        const platform = project.technologyPlatform || '';
        if (!platform) return; // Don't show empty section

        let section = ctx.querySelector('[data-section="technology"]');
        if (!section) {
            section = document.createElement('div');
            section.className = 'context-section';
            section.dataset.section = 'technology';
            ctx.appendChild(section);
        }

        section.innerHTML = `
            <div class="context-section-header">
                <h3 class="context-section-title">Technology & Platform</h3>
            </div>
            <div class="technology-badge">${escHtml(platform)}</div>
        `;
    }

    // ── Render: Audiences section ───────────────────────────────

    function renderAudiences(project, container) {
        const ctx = container || $('#phase1-context');
        if (!ctx) return;

        let section = ctx.querySelector('[data-section="audiences"]');
        if (!section) {
            section = document.createElement('div');
            section.className = 'context-section';
            section.dataset.section = 'audiences';
            ctx.appendChild(section);
        }

        const audiences = project.audiences || [];

        let cardsHtml = '';
        if (audiences.length === 0) {
            cardsHtml = '<div class="empty-state"><p>No target audiences defined yet.</p><p class="hint">Tell the AI about your learners, or upload a job description.</p></div>';
        } else {
            cardsHtml = audiences.map(a => `
                <div class="audience-card" data-id="${a.id}">
                    <div class="audience-card-header">
                        <span class="audience-role" contenteditable="true" data-field="role" data-id="${a.id}">${escHtml(a.role)}</span>
                    </div>
                    <div class="audience-card-body">
                        <div class="audience-field">
                            <label class="audience-field-label">Responsibilities</label>
                            <div class="audience-field-value" contenteditable="true" data-field="responsibilities" data-id="${a.id}">${escHtml(a.responsibilities)}</div>
                        </div>
                        <div class="audience-field">
                            <label class="audience-field-label">Prerequisites</label>
                            <div class="audience-field-value" contenteditable="true" data-field="prerequisites" data-id="${a.id}">${escHtml(a.prerequisites)}</div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        section.innerHTML = `
            <div class="context-section-header">
                <h3 class="context-section-title">Target Audiences</h3>
            </div>
            <div class="audiences-list">
                ${cardsHtml}
            </div>
        `;

        section.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.addEventListener('blur', () => {
                const id = el.dataset.id;
                const field = el.dataset.field;
                const value = el.textContent.trim();
                _updateAudienceField(project.id, id, field, value);
            });
        });
    }

    function _updateAudienceField(projectId, audienceId, field, value) {
        const project = Store.getProject(projectId);
        if (!project) return;
        const audience = (project.audiences || []).find(a => a.id === audienceId);
        if (!audience) return;
        audience[field] = value;
        Store.updateProject(project);
    }

    // ── Render: Business + Learning Objectives ──────────────────

    function renderObjectives(project, container) {
        const ctx = container || $('#phase1-context');
        if (!ctx) return;

        let section = ctx.querySelector('[data-section="objectives"]');
        if (!section) {
            section = document.createElement('div');
            section.className = 'context-section';
            section.dataset.section = 'objectives';
            ctx.appendChild(section);
        }

        const bizObj = project.businessObjectives || [];
        const learnObj = project.learningObjectives || [];

        let bizHtml = '';
        if (bizObj.length === 0) {
            bizHtml = '<div class="empty-state"><p>No business objectives yet.</p></div>';
        } else {
            bizHtml = '<ul class="objective-list">' +
                bizObj.map((obj, i) => `
                    <li class="objective-item" data-type="business" data-index="${i}">
                        <span class="objective-text" contenteditable="true" data-type="business" data-index="${i}">${escHtml(obj)}</span>
                        <button class="objective-remove" data-action="remove-objective" data-type="business" data-index="${i}" title="Remove">&times;</button>
                    </li>
                `).join('') +
                '</ul>';
        }

        let learnHtml = '';
        if (learnObj.length === 0) {
            learnHtml = '<div class="empty-state"><p>No learning objectives yet.</p></div>';
        } else {
            learnHtml = '<ul class="objective-list">' +
                learnObj.map((obj, i) => `
                    <li class="objective-item" data-type="learning" data-index="${i}">
                        <span class="objective-text" contenteditable="true" data-type="learning" data-index="${i}">${escHtml(obj)}</span>
                        <button class="objective-remove" data-action="remove-objective" data-type="learning" data-index="${i}" title="Remove">&times;</button>
                    </li>
                `).join('') +
                '</ul>';
        }

        section.innerHTML = `
            <div class="context-section-header">
                <h3 class="context-section-title">Business Objectives</h3>
            </div>
            <div class="objectives-group">
                ${bizHtml}
            </div>
            <div class="context-section-header" style="margin-top: 16px;">
                <h3 class="context-section-title">Learning Objectives</h3>
            </div>
            <div class="objectives-group">
                ${learnHtml}
            </div>
        `;

        section.querySelectorAll('.objective-text[contenteditable="true"]').forEach(el => {
            el.addEventListener('blur', () => {
                const type = el.dataset.type;
                const index = parseInt(el.dataset.index, 10);
                const value = el.textContent.trim();
                _updateObjective(project.id, type, index, value);
            });
        });

        section.querySelectorAll('[data-action="remove-objective"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = btn.dataset.type;
                const index = parseInt(btn.dataset.index, 10);
                _removeObjective(project.id, type, index);
                render(Store.getProject(project.id));
            });
        });
    }

    function _updateObjective(projectId, type, index, value) {
        const project = Store.getProject(projectId);
        if (!project) return;
        const key = type === 'business' ? 'businessObjectives' : 'learningObjectives';
        if (!Array.isArray(project[key]) || index >= project[key].length) return;
        project[key][index] = value;
        Store.updateProject(project);
    }

    function _removeObjective(projectId, type, index) {
        const project = Store.getProject(projectId);
        if (!project) return;
        const key = type === 'business' ? 'businessObjectives' : 'learningObjectives';
        if (!Array.isArray(project[key]) || index >= project[key].length) return;
        project[key].splice(index, 1);
        Store.updateProject(project);
    }

    // ── Render: Success Criteria ─────────────────────────────────

    function renderSuccessCriteria(project, container) {
        const ctx = container || $('#phase1-context');
        if (!ctx) return;

        const criteria = project.successCriteria || [];
        if (criteria.length === 0) return; // Don't show empty section

        let section = ctx.querySelector('[data-section="success-criteria"]');
        if (!section) {
            section = document.createElement('div');
            section.className = 'context-section';
            section.dataset.section = 'success-criteria';
            ctx.appendChild(section);
        }

        const listHtml = '<ul class="objective-list">' +
            criteria.map((c, i) => `
                <li class="objective-item">
                    <span class="objective-text" contenteditable="true" data-type="success" data-index="${i}">${escHtml(c)}</span>
                    <button class="objective-remove" data-action="remove-criteria" data-index="${i}" title="Remove">&times;</button>
                </li>
            `).join('') +
            '</ul>';

        section.innerHTML = `
            <div class="context-section-header">
                <h3 class="context-section-title">Success Criteria</h3>
            </div>
            ${listHtml}
        `;

        section.querySelectorAll('.objective-text[contenteditable="true"]').forEach(el => {
            el.addEventListener('blur', () => {
                const index = parseInt(el.dataset.index, 10);
                const p = Store.getProject(project.id);
                if (p && Array.isArray(p.successCriteria) && index < p.successCriteria.length) {
                    p.successCriteria[index] = el.textContent.trim();
                    Store.updateProject(p);
                }
            });
        });

        section.querySelectorAll('[data-action="remove-criteria"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index, 10);
                const p = Store.getProject(project.id);
                if (p && Array.isArray(p.successCriteria)) {
                    p.successCriteria.splice(index, 1);
                    Store.updateProject(p);
                    render(p);
                }
            });
        });
    }

    // ── Render: Documentation & References ──────────────────────

    function renderDocumentationRefs(project, container) {
        const ctx = container || $('#phase1-context');
        if (!ctx) return;

        const refs = project.documentationRefs || [];
        if (refs.length === 0) return;

        let section = ctx.querySelector('[data-section="documentation"]');
        if (!section) {
            section = document.createElement('div');
            section.className = 'context-section';
            section.dataset.section = 'documentation';
            ctx.appendChild(section);
        }

        const refsHtml = refs.map(r => `
            <div class="upload-item" data-id="${r.id}">
                <div class="upload-item-icon" title="Documentation">&#128218;</div>
                <div class="upload-item-info">
                    <div class="upload-item-name">${escHtml(r.title || r.url)}</div>
                    ${r.notes ? `<div class="upload-item-meta">${escHtml(r.notes)}</div>` : ''}
                </div>
                <button class="upload-item-remove" data-action="remove-doc-ref" data-id="${r.id}" title="Remove">&times;</button>
            </div>
        `).join('');

        section.innerHTML = `
            <div class="context-section-header">
                <h3 class="context-section-title">Documentation & References</h3>
            </div>
            <div class="uploads-list">${refsHtml}</div>
        `;

        section.querySelectorAll('[data-action="remove-doc-ref"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const p = Store.getProject(project.id);
                if (p) {
                    p.documentationRefs = (p.documentationRefs || []).filter(r => r.id !== btn.dataset.id);
                    Store.updateProject(p);
                    render(p);
                }
            });
        });
    }

    // ── Render: Scenario Seeds ───────────────────────────────────

    function renderScenarioSeeds(project, container) {
        const ctx = container || $('#phase1-context');
        if (!ctx) return;

        const seeds = project.scenarioSeeds || [];
        if (seeds.length === 0) return;

        let section = ctx.querySelector('[data-section="scenarios"]');
        if (!section) {
            section = document.createElement('div');
            section.className = 'context-section';
            section.dataset.section = 'scenarios';
            ctx.appendChild(section);
        }

        const seedsHtml = seeds.map(s => `
            <div class="scenario-card" data-id="${s.id}">
                <div class="scenario-title">${escHtml(s.title)}</div>
                ${s.description ? `<div class="scenario-description">${escHtml(s.description)}</div>` : ''}
                <button class="upload-item-remove" data-action="remove-scenario" data-id="${s.id}" title="Remove">&times;</button>
            </div>
        `).join('');

        section.innerHTML = `
            <div class="context-section-header">
                <h3 class="context-section-title">Scenario Seeds</h3>
            </div>
            ${seedsHtml}
        `;

        section.querySelectorAll('[data-action="remove-scenario"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const p = Store.getProject(project.id);
                if (p) {
                    p.scenarioSeeds = (p.scenarioSeeds || []).filter(s => s.id !== btn.dataset.id);
                    Store.updateProject(p);
                    render(p);
                }
            });
        });
    }

    // ── Render: Competencies section ────────────────────────────

    function renderCompetencies(project, container) {
        const ctx = container || $('#phase1-context');
        if (!ctx) return;

        let section = ctx.querySelector('[data-section="competencies"]');
        if (!section) {
            section = document.createElement('div');
            section.className = 'context-section';
            section.dataset.section = 'competencies';
            ctx.appendChild(section);
        }

        const competencies = project.competencies || [];

        let tagsHtml = '';
        if (competencies.length === 0) {
            tagsHtml = '<div class="empty-state"><p>No competencies extracted yet.</p><p class="hint">Upload a JTA or describe your learners\' tasks to extract competencies.</p></div>';
        } else {
            tagsHtml = '<div class="competency-cloud">' +
                competencies.map(c => `
                    <div class="competency-tag" data-id="${c.id}" title="${escHtml(c.description || '')}">
                        <span class="competency-name">${escHtml(c.name)}</span>
                        ${c.source ? `<span class="competency-source-badge">${escHtml(c.source)}</span>` : ''}
                        <button class="competency-remove" data-action="remove-competency" data-id="${c.id}" title="Remove">&times;</button>
                    </div>
                `).join('') +
                '</div>';
        }

        section.innerHTML = `
            <div class="context-section-header">
                <h3 class="context-section-title">Competencies</h3>
            </div>
            ${tagsHtml}
        `;

        section.querySelectorAll('[data-action="remove-competency"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                _removeCompetency(project.id, btn.dataset.id);
                render(Store.getProject(project.id));
            });
        });
    }

    function _removeCompetency(projectId, competencyId) {
        const project = Store.getProject(projectId);
        if (!project) return;
        project.competencies = (project.competencies || []).filter(c => c.id !== competencyId);
        Store.updateProject(project);
    }

    // ── File upload handler ─────────────────────────────────────

    function handleUpload(file, projectId) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            Store.addUpload(projectId, {
                name: file.name,
                type: file.type || 'unknown',
                content: ev.target.result,
            });
            const project = Store.getProject(projectId);
            if (project) render(project);
        };
        reader.onerror = () => {
            console.warn('[Phase1] Failed to read file:', file.name);
        };
        reader.readAsText(file);
    }

    // ── URL add handler ─────────────────────────────────────────

    function handleAddUrl(url, projectId) {
        const title = _extractTitleFromUrl(url);

        fetch(url, { mode: 'cors' })
            .then(resp => {
                if (!resp.ok) throw new Error('Fetch failed');
                return resp.text();
            })
            .then(text => {
                const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                const truncated = plainText.length > 50000 ? plainText.substring(0, 50000) + '...' : plainText;

                Store.addUrl(projectId, { url, title, content: truncated });
                const project = Store.getProject(projectId);
                if (project) render(project);
            })
            .catch(() => {
                Store.addUrl(projectId, { url, title, content: '' });
                const project = Store.getProject(projectId);
                if (project) render(project);
            });
    }

    function _extractTitleFromUrl(url) {
        try {
            const u = new URL(url);
            const segments = u.pathname.split('/').filter(Boolean);
            if (segments.length > 0) {
                return decodeURIComponent(segments[segments.length - 1]).replace(/[-_]/g, ' ');
            }
            return u.hostname;
        } catch {
            return url;
        }
    }

    // ── Apply AI results ────────────────────────────────────────

    function applyAIResults(structured, projectId) {
        if (!structured) return;

        const project = Store.getProject(projectId);
        if (!project) return;

        // Program name
        if (structured.programName && structured.programName !== 'Untitled Program') {
            project.name = structured.programName;
            if (typeof window._appSetProgramName === 'function') {
                window._appSetProgramName(structured.programName);
            }
        }

        // Technology/Platform
        if (structured.technologyPlatform) {
            project.technologyPlatform = structured.technologyPlatform;
        }

        // Merge audiences
        if (Array.isArray(structured.audiences)) {
            const existingRoles = new Set((project.audiences || []).map(a => a.role.toLowerCase()));
            for (const a of structured.audiences) {
                const role = a.role || a.name || '';
                if (!role || existingRoles.has(role.toLowerCase())) continue;
                project.audiences.push({
                    id: Store.generateId(),
                    role,
                    responsibilities: a.responsibilities || '',
                    prerequisites: a.prerequisites || '',
                });
                existingRoles.add(role.toLowerCase());
            }
        }

        // Merge business objectives
        if (Array.isArray(structured.businessObjectives)) {
            const existing = new Set((project.businessObjectives || []).map(o => o.toLowerCase()));
            for (const obj of structured.businessObjectives) {
                if (!obj || existing.has(obj.toLowerCase())) continue;
                project.businessObjectives.push(obj);
                existing.add(obj.toLowerCase());
            }
        }

        // Merge learning objectives
        if (Array.isArray(structured.learningObjectives)) {
            const existing = new Set((project.learningObjectives || []).map(o => o.toLowerCase()));
            for (const obj of structured.learningObjectives) {
                if (!obj || existing.has(obj.toLowerCase())) continue;
                project.learningObjectives.push(obj);
                existing.add(obj.toLowerCase());
            }
        }

        // Merge competencies
        if (Array.isArray(structured.competencies)) {
            const existingNames = new Set((project.competencies || []).map(c => c.name.toLowerCase()));
            for (const c of structured.competencies) {
                const name = c.name || c;
                if (!name || existingNames.has(name.toLowerCase())) continue;
                project.competencies.push({
                    id: Store.generateId(),
                    name,
                    description: c.description || '',
                    source: c.source || 'AI-extracted',
                });
                existingNames.add(name.toLowerCase());
            }
        }

        // Merge success criteria
        if (Array.isArray(structured.successCriteria)) {
            if (!Array.isArray(project.successCriteria)) project.successCriteria = [];
            const existing = new Set(project.successCriteria.map(s => s.toLowerCase()));
            for (const sc of structured.successCriteria) {
                if (!sc || existing.has(sc.toLowerCase())) continue;
                project.successCriteria.push(sc);
                existing.add(sc.toLowerCase());
            }
        }

        // Merge documentation refs
        if (Array.isArray(structured.documentationRefs)) {
            if (!Array.isArray(project.documentationRefs)) project.documentationRefs = [];
            const existingUrls = new Set(project.documentationRefs.map(d => d.url));
            for (const ref of structured.documentationRefs) {
                if (!ref.url || existingUrls.has(ref.url)) continue;
                project.documentationRefs.push({
                    id: Store.generateId(),
                    url: ref.url,
                    title: ref.title || ref.url,
                    notes: ref.notes || '',
                });
                existingUrls.add(ref.url);
            }
        }

        // Merge scenario seeds
        if (Array.isArray(structured.scenarioSeeds)) {
            if (!Array.isArray(project.scenarioSeeds)) project.scenarioSeeds = [];
            const existingTitles = new Set(project.scenarioSeeds.map(s => s.title.toLowerCase()));
            for (const seed of structured.scenarioSeeds) {
                if (!seed.title || existingTitles.has(seed.title.toLowerCase())) continue;
                project.scenarioSeeds.push({
                    id: Store.generateId(),
                    title: seed.title,
                    description: seed.description || '',
                });
                existingTitles.add(seed.title.toLowerCase());
            }
        }

        Store.updateProject(project);
        render(project);
    }

    // ── Context summary for later phases ────────────────────────

    function getContextSummary(projectId) {
        const project = Store.getProject(projectId);
        if (!project) return '';

        const parts = [];

        if (project.technologyPlatform) {
            parts.push('Technology/Platform: ' + project.technologyPlatform);
        }

        const audiences = project.audiences || [];
        if (audiences.length > 0) {
            parts.push('Target Audiences:');
            audiences.forEach(a => {
                let line = `  - ${a.role}`;
                if (a.responsibilities) line += ` (responsibilities: ${a.responsibilities})`;
                if (a.prerequisites) line += ` (prerequisites: ${a.prerequisites})`;
                parts.push(line);
            });
        }

        const bizObj = project.businessObjectives || [];
        if (bizObj.length > 0) {
            parts.push('Business Objectives:');
            bizObj.forEach(o => parts.push(`  - ${o}`));
        }

        const learnObj = project.learningObjectives || [];
        if (learnObj.length > 0) {
            parts.push('Learning Objectives:');
            learnObj.forEach(o => parts.push(`  - ${o}`));
        }

        const criteria = project.successCriteria || [];
        if (criteria.length > 0) {
            parts.push('Success Criteria:');
            criteria.forEach(c => parts.push(`  - ${c}`));
        }

        const competencies = project.competencies || [];
        if (competencies.length > 0) {
            parts.push('Competencies:');
            competencies.forEach(c => {
                let line = `  - ${c.name}`;
                if (c.source) line += ` [${c.source}]`;
                parts.push(line);
            });
        }

        const docRefs = project.documentationRefs || [];
        if (docRefs.length > 0) {
            parts.push('Documentation References:');
            docRefs.forEach(r => parts.push(`  - ${r.title || r.url}`));
        }

        const seeds = project.scenarioSeeds || [];
        if (seeds.length > 0) {
            parts.push('Scenario Seeds:');
            seeds.forEach(s => parts.push(`  - ${s.title}: ${s.description}`));
        }

        const uploads = project.uploads || [];
        const urls = project.urls || [];
        if (uploads.length > 0 || urls.length > 0) {
            parts.push('Source Materials:');
            uploads.forEach(u => parts.push(`  - File: ${u.name}`));
            urls.forEach(u => parts.push(`  - URL: ${u.title || u.url}`));
        }

        return parts.join('\n');
    }

    // ── Public API ──────────────────────────────────────────────

    return {
        init,
        render,
        renderUploads,
        renderAudiences,
        renderObjectives,
        renderCompetencies,
        handleUpload,
        handleAddUrl,
        applyAIResults,
        getContextSummary,
    };
})();
