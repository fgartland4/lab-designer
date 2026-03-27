/**
 * phase4.js — Phase 4 "Package & Export" UI controller for Lab Program Designer v3.
 * Tabs: Environment Templates, Scoring Methods, Bill of Materials, Lifecycle Scripts, Export.
 *
 * Depends on: Store, Chat, Exporter (all global IIFEs).
 */

const Phase4 = (() => {

    let _activeTab = 'environment';

    const TAB_IDS = ['environment', 'scoring', 'bom', 'scripts', 'export'];

    const PLATFORM_BADGES = {
        azure: '<span class="badge badge-azure">Azure</span>',
        aws: '<span class="badge badge-aws">AWS</span>',
        gcp: '<span class="badge badge-gcp">GCP</span>',
        multi: '<span class="badge badge-multi">Multi-Cloud</span>',
    };

    const BOM_CATEGORIES = [
        'Cloud Subscriptions',
        'Virtual Machines',
        'Operating Systems',
        'Applications',
        'Data Files',
        'Licenses',
        'Permissions',
    ];

    // ── Init ─────────────────────────────────────────────────────

    function init() {
        console.log('[Phase4] Initialized');
    }

    // ── Main render ──────────────────────────────────────────────

    function render(project) {
        const container = document.querySelector('#phase4-context');
        if (!container) return;

        container.innerHTML = _buildTabBar() + '<div id="phase4-tab-content"></div>';
        _bindTabBar(container, project);
        _renderActiveTab(project);
    }

    function _buildTabBar() {
        const tabs = [
            { id: 'environment', label: 'Environment' },
            { id: 'scoring', label: 'Scoring' },
            { id: 'bom', label: 'Bill of Materials' },
            { id: 'scripts', label: 'Lifecycle Scripts' },
            { id: 'export', label: 'Export' },
        ];

        return `<div class="phase4-tabs">
            ${tabs.map(t => `<button class="phase4-tab ${_activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
        </div>`;
    }

    function _bindTabBar(container, project) {
        container.querySelectorAll('.phase4-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                _activeTab = btn.dataset.tab;
                container.querySelectorAll('.phase4-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                _renderActiveTab(project);
            });
        });
    }

    function _renderActiveTab(project) {
        switch (_activeTab) {
            case 'environment': renderEnvironmentTab(project); break;
            case 'scoring':     renderScoringTab(project); break;
            case 'bom':         renderBOMTab(project); break;
            case 'scripts':     renderScriptsTab(project); break;
            case 'export':      renderExportTab(project); break;
        }
    }

    // ── Tab 1: Environment Templates ────────────────────────────

    function renderEnvironmentTab(project) {
        const content = document.querySelector('#phase4-tab-content');
        if (!content) return;

        const templates = project.environmentTemplates || [];

        if (templates.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <p>No environment templates yet. Use the chat to generate environment configurations, or add one manually.</p>
                    <button class="btn btn-primary" id="btn-add-template">+ Add Template</button>
                </div>`;
            _bindAddTemplate(project);
            return;
        }

        const cards = templates.map(tpl => _renderTemplateCard(tpl)).join('');
        content.innerHTML = `
            <div class="template-cards">${cards}</div>
            <button class="btn btn-primary" id="btn-add-template">+ Add Template</button>`;
        _bindAddTemplate(project);
        _bindTemplateActions(project);
    }

    function _renderTemplateCard(tpl) {
        const platformBadge = PLATFORM_BADGES[tpl.platform] || `<span class="badge">${tpl.platform || 'N/A'}</span>`;

        const vmRows = (tpl.vms || []).map(vm =>
            `<tr><td>${_esc(vm.name || 'Unnamed')}</td><td>${_esc(vm.os || '')}</td><td>${vm.ram ? vm.ram + ' MB' : ''}</td><td>${_esc((vm.software || []).join(', '))}</td></tr>`
        ).join('');

        const cloudRows = (tpl.cloudResources || []).map(cr =>
            `<li><strong>${_esc(cr.name || cr.type || 'Resource')}</strong>: ${_esc(cr.details || cr.description || '')}</li>`
        ).join('');

        const credRows = (tpl.credentials || []).map(c => `<li>${_esc(c.name || c.type || c)}</li>`).join('');
        const dataRows = (tpl.dummyData || []).map(d => `<li>${_esc(typeof d === 'string' ? d : (d.name || d.filename || ''))}</li>`).join('');
        const licenseRows = (tpl.licenses || []).map(l => `<li>${_esc(typeof l === 'string' ? l : (l.name || ''))}</li>`).join('');

        return `
        <div class="template-card" data-template-id="${tpl.id}">
            <div class="template-card-header">
                <h4>${_esc(tpl.name || 'Unnamed Template')}</h4>
                ${platformBadge}
            </div>
            ${vmRows ? `<div class="template-section"><h5>Virtual Machines</h5><table class="mini-table"><thead><tr><th>Name</th><th>OS</th><th>RAM</th><th>Software</th></tr></thead><tbody>${vmRows}</tbody></table></div>` : ''}
            ${cloudRows ? `<div class="template-section"><h5>Cloud Resources</h5><ul class="compact-list">${cloudRows}</ul></div>` : ''}
            ${credRows ? `<div class="template-section"><h5>Credentials</h5><ul class="compact-list">${credRows}</ul></div>` : ''}
            ${dataRows ? `<div class="template-section"><h5>Dummy/Practice Data</h5><ul class="compact-list">${dataRows}</ul></div>` : ''}
            ${licenseRows ? `<div class="template-section"><h5>Licenses & Permissions</h5><ul class="compact-list">${licenseRows}</ul></div>` : ''}
            <div class="template-card-actions">
                <button class="btn btn-sm btn-danger" data-action="delete-template" data-id="${tpl.id}">Remove</button>
            </div>
        </div>`;
    }

    function _bindAddTemplate(project) {
        const btn = document.querySelector('#btn-add-template');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const name = prompt('Template name:');
            if (!name) return;
            const platform = prompt('Platform (azure, aws, gcp, multi):') || '';
            Store.addEnvironmentTemplate(project.id, {
                name,
                platform: platform.toLowerCase(),
                vms: [], cloudResources: [], credentials: [], dummyData: [], licenses: [],
            });
            render(Store.getProject(project.id));
        });
    }

    function _bindTemplateActions(project) {
        document.querySelectorAll('[data-action="delete-template"]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Remove this template?')) return;
                const p = Store.getProject(project.id);
                p.environmentTemplates = (p.environmentTemplates || []).filter(t => t.id !== btn.dataset.id);
                Store.updateProject(p);
                render(p);
            });
        });
    }

    // ── Tab 2: Scoring Methods ──────────────────────────────────

    function renderScoringTab(project) {
        const content = document.querySelector('#phase4-tab-content');
        if (!content) return;

        const methods = project.scoringMethods || [];

        if (methods.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <p>No scoring methods defined yet.</p>
                    <p class="hint">Use the chat to generate AI-based or script-based scoring methods for your labs.</p>
                    <p class="hint" style="margin-top:8px;font-style:italic;">Note: Only AI-based and script-based scoring are supported. Manual scoring is not recommended.</p>
                </div>`;
            return;
        }

        const cards = methods.map((m, idx) => `
            <div class="scoring-card" data-idx="${idx}">
                <div class="scoring-card-header">
                    <span class="badge ${m.type === 'ai' ? 'badge-azure' : 'badge-ps'}">${m.type === 'ai' ? 'AI-Based' : 'Script-Based'}</span>
                    ${m.labId ? `<span class="scoring-lab-ref">Lab: ${_esc(m.labId)}</span>` : ''}
                </div>
                <div class="scoring-description">${_esc(m.description || 'No description')}</div>
                ${m.type === 'script' && m.script ? `
                    <div class="scoring-script">
                        <span class="badge">${_esc(m.scriptLanguage || 'powershell')}</span>
                        <pre class="code-block"><code>${_esc(m.script)}</code></pre>
                    </div>
                ` : ''}
                <div class="scoring-card-actions">
                    <button class="btn btn-sm btn-danger" data-action="delete-scoring" data-idx="${idx}">Remove</button>
                </div>
            </div>
        `).join('');

        content.innerHTML = `<div class="scoring-cards">${cards}</div>`;

        // Bind delete
        content.querySelectorAll('[data-action="delete-scoring"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const p = Store.getProject(project.id);
                if (p.scoringMethods) {
                    p.scoringMethods.splice(idx, 1);
                    Store.updateProject(p);
                    render(p);
                }
            });
        });
    }

    // ── Tab 3: Bill of Materials ─────────────────────────────────

    function renderBOMTab(project) {
        const content = document.querySelector('#phase4-tab-content');
        if (!content) return;

        const bom = project.billOfMaterials || [];
        const rows = bom.map((item, idx) => `
            <tr data-bom-idx="${idx}">
                <td><select class="bom-cell" data-field="category" data-idx="${idx}">${BOM_CATEGORIES.map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
                <td><input class="bom-cell" type="text" data-field="item" data-idx="${idx}" value="${_esc(item.item || '')}" /></td>
                <td><input class="bom-cell" type="text" data-field="details" data-idx="${idx}" value="${_esc(item.details || '')}" /></td>
                <td><select class="bom-cell" data-field="required" data-idx="${idx}"><option value="yes" ${item.required ? 'selected' : ''}>Yes</option><option value="no" ${!item.required ? 'selected' : ''}>No</option></select></td>
                <td><button class="btn btn-sm btn-danger bom-delete" data-idx="${idx}">x</button></td>
            </tr>`).join('');

        content.innerHTML = `
            <div class="bom-toolbar">
                <button class="btn btn-sm btn-primary" id="btn-add-bom-row">+ Add Row</button>
                <button class="btn btn-sm btn-secondary" id="btn-export-bom-csv">Export CSV</button>
            </div>
            <div class="table-wrap">
                <table class="bom-table">
                    <thead><tr><th>Category</th><th>Item</th><th>Details</th><th>Required</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="5" class="empty-state">No items yet.</td></tr>'}</tbody>
                </table>
            </div>`;

        _bindBOMEditing(project);
    }

    function _bindBOMEditing(project) {
        document.querySelectorAll('.bom-cell').forEach(cell => {
            const handler = () => {
                const idx = parseInt(cell.dataset.idx, 10);
                const field = cell.dataset.field;
                const bom = [...(project.billOfMaterials || [])];
                if (!bom[idx]) return;
                if (field === 'required') {
                    bom[idx].required = cell.value === 'yes';
                } else {
                    bom[idx][field] = cell.value;
                }
                Store.setBOM(project.id, bom);
                project.billOfMaterials = bom;
            };
            cell.addEventListener('change', handler);
            if (cell.tagName === 'INPUT') cell.addEventListener('blur', handler);
        });

        document.querySelectorAll('.bom-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const bom = [...(project.billOfMaterials || [])];
                bom.splice(idx, 1);
                Store.setBOM(project.id, bom);
                project.billOfMaterials = bom;
                renderBOMTab(project);
            });
        });

        const addBtn = document.querySelector('#btn-add-bom-row');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const bom = [...(project.billOfMaterials || [])];
                bom.push({ id: Store.generateId(), category: BOM_CATEGORIES[0], item: '', details: '', required: true });
                Store.setBOM(project.id, bom);
                project.billOfMaterials = bom;
                renderBOMTab(project);
            });
        }

        const csvBtn = document.querySelector('#btn-export-bom-csv');
        if (csvBtn) {
            csvBtn.addEventListener('click', () => handleExportBOMCSV(project));
        }
    }

    // ── Tab 4: Lifecycle Scripts ─────────────────────────────────

    function renderScriptsTab(project) {
        const content = document.querySelector('#phase4-tab-content');
        if (!content) return;

        const templates = project.environmentTemplates || [];
        const scripts = project.lifecycleScripts || {};

        if (templates.length === 0) {
            content.innerHTML = '<div class="empty-state"><p>Add environment templates first to manage lifecycle scripts.</p></div>';
            return;
        }

        const panels = templates.map(tpl => {
            const scriptData = scripts[tpl.id] || { platform: 'powershell', buildScript: '', teardownScript: '' };
            return _renderScriptPanel(tpl, scriptData);
        }).join('');

        content.innerHTML = `<div class="script-panels">${panels}</div>`;
        _bindScriptActions(project);
    }

    function _renderScriptPanel(tpl, scriptData) {
        const platform = scriptData.platform || 'powershell';

        return `
        <div class="script-panel" data-template-id="${tpl.id}">
            <div class="script-panel-header">
                <h4>${_esc(tpl.name)}</h4>
                <span class="badge">${_esc(platform)}</span>
            </div>
            <div class="script-toggles">
                <button class="btn btn-sm script-toggle active" data-template-id="${tpl.id}" data-mode="build">Build Script</button>
                <button class="btn btn-sm script-toggle" data-template-id="${tpl.id}" data-mode="teardown">Teardown Script</button>
            </div>
            <div class="script-viewer" data-template-id="${tpl.id}" data-mode="build">
                <pre class="code-block"><code>${_esc(scriptData.buildScript) || '<span class="text-muted">No build script yet.</span>'}</code></pre>
            </div>
            <div class="script-viewer" data-template-id="${tpl.id}" data-mode="teardown" style="display:none;">
                <pre class="code-block"><code>${_esc(scriptData.teardownScript) || '<span class="text-muted">No teardown script yet.</span>'}</code></pre>
            </div>
            <div class="script-actions">
                <button class="btn btn-sm btn-secondary" data-action="copy-script" data-template-id="${tpl.id}">Copy</button>
                <button class="btn btn-sm btn-primary" data-action="regenerate-script" data-template-id="${tpl.id}">Regenerate</button>
            </div>
        </div>`;
    }

    function _bindScriptActions(project) {
        document.querySelectorAll('.script-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const templateId = btn.dataset.templateId;
                const mode = btn.dataset.mode;
                document.querySelectorAll(`.script-toggle[data-template-id="${templateId}"]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll(`.script-viewer[data-template-id="${templateId}"]`).forEach(v => {
                    v.style.display = v.dataset.mode === mode ? '' : 'none';
                });
            });
        });

        document.querySelectorAll('[data-action="copy-script"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const templateId = btn.dataset.templateId;
                const scripts = project.lifecycleScripts || {};
                const scriptData = scripts[templateId] || {};
                const activeToggle = document.querySelector(`.script-toggle[data-template-id="${templateId}"].active`);
                const mode = activeToggle ? activeToggle.dataset.mode : 'build';
                const text = mode === 'teardown' ? (scriptData.teardownScript || '') : (scriptData.buildScript || '');
                if (!text) { alert('No script content to copy.'); return; }
                navigator.clipboard.writeText(text).then(() => {
                    const original = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = original; }, 1500);
                });
            });
        });

        document.querySelectorAll('[data-action="regenerate-script"]').forEach(btn => {
            btn.addEventListener('click', () => {
                handleRegenerateScript(btn.dataset.templateId, project.id);
            });
        });
    }

    // ── Tab 5: Export ────────────────────────────────────────────

    function renderExportTab(project) {
        const content = document.querySelector('#phase4-tab-content');
        if (!content) return;

        const blueprints = project.labBlueprints || [];
        const structure = project.programStructure;
        const history = project.exportHistory || [];

        // Build lab list from program structure if available
        let labList = [];
        if (structure && structure.labSeries) {
            for (const ls of structure.labSeries) {
                for (const lab of (ls.labs || [])) {
                    labList.push({ id: lab.id, title: lab.title, seriesTitle: ls.title });
                }
            }
        }
        // Fall back to blueprints
        if (labList.length === 0) {
            labList = blueprints.map(bp => ({ id: bp.id, title: bp.title, seriesTitle: '' }));
        }

        const checkboxes = labList.map(lab => `
            <label class="export-lab-checkbox">
                <input type="checkbox" value="${lab.id}" checked />
                ${_esc(lab.title || lab.id)}
                ${lab.seriesTitle ? `<span class="export-series-tag">${_esc(lab.seriesTitle)}</span>` : ''}
            </label>`).join('');

        const historyRows = history.slice().reverse().map(h => `
            <tr><td>${new Date(h.exportedAt).toLocaleString()}</td><td>${_esc(h.format || 'ZIP')}</td><td>${h.labCount}</td></tr>`).join('');

        content.innerHTML = `
            <div class="export-section">
                <h4>Export to Skillable Studio</h4>
                ${labList.length > 0 ? `
                <div class="export-options">
                    <h5>Labs to include:</h5>
                    <div class="export-checkboxes">${checkboxes}</div>
                </div>` : '<p class="text-muted">No labs to export. Complete Phases 2-3 first.</p>'}
                <div class="export-actions">
                    <button class="btn btn-primary" id="btn-export-skillable" ${labList.length === 0 ? 'disabled' : ''}>Export to Skillable Studio</button>
                    <button class="btn btn-secondary" id="btn-export-json" ${labList.length === 0 ? 'disabled' : ''}>Export as JSON</button>
                </div>
            </div>
            ${historyRows ? `
            <div class="export-history">
                <h5>Export History</h5>
                <table class="mini-table"><thead><tr><th>Date</th><th>Format</th><th>Labs</th></tr></thead><tbody>${historyRows}</tbody></table>
            </div>` : ''}`;

        _bindExportActions(project);
    }

    function _bindExportActions(project) {
        const skillableBtn = document.querySelector('#btn-export-skillable');
        if (skillableBtn) {
            skillableBtn.addEventListener('click', () => handleExport(project.id));
        }
        const jsonBtn = document.querySelector('#btn-export-json');
        if (jsonBtn) {
            jsonBtn.addEventListener('click', () => {
                const json = typeof Exporter !== 'undefined' ? Exporter.exportLabsAsJSON(project) : JSON.stringify(project, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${_sanitizeFilename(project.name)}-labs.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }
    }

    // ── Action handlers ──────────────────────────────────────────

    function applyAIResults(structured, projectId) {
        if (!structured) return;
        const project = Store.getProject(projectId);
        if (!project) return;

        if (Array.isArray(structured.templates)) {
            for (const tpl of structured.templates) {
                Store.addEnvironmentTemplate(projectId, {
                    id: tpl.id || Store.generateId(),
                    name: tpl.name || 'Unnamed Template',
                    platform: tpl.platform || '',
                    vms: tpl.vms || [], cloudResources: tpl.cloudResources || [],
                    credentials: tpl.credentials || [], dummyData: tpl.dummyData || [],
                    licenses: tpl.licenses || [],
                });
            }
        }

        if (Array.isArray(structured.billOfMaterials)) {
            const bom = structured.billOfMaterials.map(item => ({
                id: item.id || Store.generateId(),
                category: item.category || 'Applications',
                item: item.item || '', details: item.details || '',
                required: item.required !== false,
            }));
            Store.setBOM(projectId, bom);
        }

        if (structured.lifecycleScripts && typeof structured.lifecycleScripts === 'object') {
            for (const [templateId, script] of Object.entries(structured.lifecycleScripts)) {
                Store.setLifecycleScript(projectId, templateId, {
                    platform: script.platform || 'powershell',
                    buildScript: script.buildScript || '',
                    teardownScript: script.teardownScript || '',
                });
            }
        }

        if (Array.isArray(structured.scoringMethods)) {
            for (const sm of structured.scoringMethods) {
                Store.addScoringMethod(projectId, {
                    labId: sm.labId || '',
                    type: sm.type || 'script',
                    scriptLanguage: sm.scriptLanguage || 'powershell',
                    script: sm.script || '',
                    description: sm.description || '',
                });
            }
        }

        render(Store.getProject(projectId));
    }

    async function handleExport(projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;

        const checkboxes = document.querySelectorAll('.export-lab-checkbox input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.value);
        if (selectedIds.length === 0) { alert('Select at least one lab.'); return; }

        try {
            if (typeof Exporter !== 'undefined') {
                await Exporter.exportToSkillable(project, { labIds: selectedIds });
            }
            Store.addExportRecord(projectId, { format: 'Skillable ZIP', labCount: selectedIds.length });
            renderExportTab(Store.getProject(projectId));
        } catch (err) {
            console.error('[Phase4] Export failed:', err);
            alert('Export failed: ' + err.message);
        }
    }

    async function handleRegenerateScript(templateId, projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;
        const template = (project.environmentTemplates || []).find(t => t.id === templateId);
        if (!template) return;

        const btn = document.querySelector(`[data-action="regenerate-script"][data-template-id="${templateId}"]`);
        if (btn) { btn.disabled = true; btn.textContent = 'Regenerating...'; }

        try {
            const promptMsg = `Regenerate lifecycle scripts for "${template.name}" (${template.platform || 'azure'}). VMs: ${JSON.stringify(template.vms || [])}. Cloud Resources: ${JSON.stringify(template.cloudResources || [])}. Output inside ===ENVIRONMENT=== markers.`;
            const result = await Chat.sendMessage(4, projectId, promptMsg);
            if (result.structured) applyAIResults(result.structured, projectId);
        } catch (err) {
            console.error('[Phase4] Regenerate failed:', err);
            alert('Failed: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Regenerate'; }
        }
    }

    function handleExportBOMCSV(project) {
        const bom = project.billOfMaterials || [];
        if (bom.length === 0) { alert('No BOM data.'); return; }
        const csv = typeof Exporter !== 'undefined' ? Exporter.exportBOMAsCSV(bom) : _fallbackBOMCSV(bom);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${_sanitizeFilename(project.name)}-bom.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function _fallbackBOMCSV(bom) {
        const header = 'Category,Item,Details,Required\n';
        return header + bom.map(r => `"${r.category}","${r.item}","${r.details}","${r.required ? 'Yes' : 'No'}"`).join('\n');
    }

    // ── Utilities ────────────────────────────────────────────────

    function _esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function _sanitizeFilename(name) {
        return (name || 'export').replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '-').trim().slice(0, 80);
    }

    return {
        init,
        render,
        renderEnvironmentTab,
        renderScoringTab,
        renderBOMTab,
        renderScriptsTab,
        renderExportTab,
        applyAIResults,
        handleExport,
        handleRegenerateScript,
        handleExportBOMCSV,
    };
})();
