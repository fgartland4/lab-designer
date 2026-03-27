/**
 * phase4.js — Phase 4 "Architect & Build" UI controller for Lab Program Designer v3.
 * Renders environment templates, bill of materials, lifecycle scripts, and export controls.
 *
 * Depends on: Store, Chat, Exporter (all global IIFEs).
 */

const Phase4 = (() => {

    // ── State ────────────────────────────────────────────────────
    let _activeTab = 'environment';

    const TAB_IDS = ['environment', 'bom', 'scripts', 'export'];

    // ── Platform badges ─────────────────────────────────────────
    const PLATFORM_BADGES = {
        azure: '<span class="badge badge-azure">Azure</span>',
        aws: '<span class="badge badge-aws">AWS</span>',
        gcp: '<span class="badge badge-gcp">GCP</span>',
        multi: '<span class="badge badge-multi">Multi-Cloud</span>',
    };

    const SCRIPT_PLATFORM_BADGES = {
        powershell: '<span class="badge badge-ps">PowerShell</span>',
        bash: '<span class="badge badge-bash">Bash</span>',
    };

    // ── Keywords for basic syntax highlighting ───────────────────
    const PS_KEYWORDS = [
        'param', 'function', 'if', 'else', 'elseif', 'foreach', 'for', 'while',
        'do', 'switch', 'try', 'catch', 'finally', 'return', 'throw', 'begin',
        'process', 'end', 'Import-Module', 'New-AzResourceGroup', 'Set-AzContext',
        'Get-AzSubscription', 'Write-Host', 'Write-Output', 'Write-Error',
    ];

    const BASH_KEYWORDS = [
        'if', 'then', 'else', 'elif', 'fi', 'for', 'do', 'done', 'while',
        'until', 'case', 'esac', 'function', 'return', 'echo', 'export',
        'source', 'az', 'aws', 'gcloud', 'sudo', 'apt-get', 'yum',
    ];

    // ── BOM categories ──────────────────────────────────────────
    const BOM_CATEGORIES = [
        'Cloud Subscriptions',
        'Virtual Machines',
        'Operating Systems',
        'Applications',
        'Data Files',
        'Licenses',
        'Permissions',
    ];

    // ── Initialization ──────────────────────────────────────────

    function init() {
        console.log('[Phase4] Initialized');
    }

    // ── Main render ─────────────────────────────────────────────

    function render(project) {
        const container = document.querySelector('#phase4-context');
        if (!container) return;

        container.innerHTML = _buildTabBar() + '<div id="phase4-tab-content"></div>';
        _bindTabBar(container, project);
        _renderActiveTab(project);
    }

    function _buildTabBar() {
        const tabs = [
            { id: 'environment', label: 'Environment Templates' },
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
            `<tr>
                <td>${_esc(vm.name || 'Unnamed')}</td>
                <td>${_esc(vm.os || '')}</td>
                <td>${vm.ram ? vm.ram + ' MB' : ''}</td>
                <td>${_esc((vm.software || []).join(', '))}</td>
            </tr>`
        ).join('');

        const cloudRows = (tpl.cloudResources || []).map(cr =>
            `<li><strong>${_esc(cr.name || cr.type || 'Resource')}</strong>: ${_esc(cr.details || cr.description || '')}</li>`
        ).join('');

        const credRows = (tpl.credentials || []).map(c =>
            `<li>${_esc(c.name || c.type || c)}</li>`
        ).join('');

        const dataRows = (tpl.dummyData || []).map(d =>
            `<li>${_esc(typeof d === 'string' ? d : (d.name || d.filename || ''))}</li>`
        ).join('');

        const licenseRows = (tpl.licenses || []).map(l =>
            `<li>${_esc(typeof l === 'string' ? l : (l.name || ''))}</li>`
        ).join('');

        return `
        <div class="template-card" data-template-id="${tpl.id}">
            <div class="template-card-header">
                <h4>${_esc(tpl.name || 'Unnamed Template')}</h4>
                ${platformBadge}
            </div>

            ${vmRows ? `
            <div class="template-section">
                <h5>Virtual Machines</h5>
                <table class="mini-table">
                    <thead><tr><th>Name</th><th>OS</th><th>RAM</th><th>Software</th></tr></thead>
                    <tbody>${vmRows}</tbody>
                </table>
            </div>` : ''}

            ${cloudRows ? `
            <div class="template-section">
                <h5>Cloud Resources</h5>
                <ul class="compact-list">${cloudRows}</ul>
            </div>` : ''}

            ${credRows ? `
            <div class="template-section">
                <h5>Credentials</h5>
                <ul class="compact-list">${credRows}</ul>
            </div>` : ''}

            ${dataRows ? `
            <div class="template-section">
                <h5>Dummy/Practice Data</h5>
                <ul class="compact-list">${dataRows}</ul>
            </div>` : ''}

            ${licenseRows ? `
            <div class="template-section">
                <h5>Licenses & Permissions</h5>
                <ul class="compact-list">${licenseRows}</ul>
            </div>` : ''}

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
                vms: [],
                cloudResources: [],
                credentials: [],
                dummyData: [],
                licenses: [],
            });
            const updated = Store.getProject(project.id);
            render(updated);
        });
    }

    function _bindTemplateActions(project) {
        document.querySelectorAll('[data-action="delete-template"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (!confirm('Remove this template?')) return;
                const p = Store.getProject(project.id);
                p.environmentTemplates = (p.environmentTemplates || []).filter(t => t.id !== id);
                Store.updateProject(p);
                render(p);
            });
        });
    }

    // ── Tab 2: Bill of Materials ─────────────────────────────────

    function renderBOMTab(project) {
        const content = document.querySelector('#phase4-tab-content');
        if (!content) return;

        const bom = project.billOfMaterials || [];

        const rows = bom.map((item, idx) => `
            <tr data-bom-idx="${idx}">
                <td>
                    <select class="bom-cell" data-field="category" data-idx="${idx}">
                        ${BOM_CATEGORIES.map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </td>
                <td><input class="bom-cell" type="text" data-field="item" data-idx="${idx}" value="${_esc(item.item || '')}" /></td>
                <td><input class="bom-cell" type="text" data-field="details" data-idx="${idx}" value="${_esc(item.details || '')}" /></td>
                <td>
                    <select class="bom-cell" data-field="required" data-idx="${idx}">
                        <option value="yes" ${item.required ? 'selected' : ''}>Yes</option>
                        <option value="no" ${!item.required ? 'selected' : ''}>No</option>
                    </select>
                </td>
                <td><button class="btn btn-sm btn-danger bom-delete" data-idx="${idx}">x</button></td>
            </tr>`).join('');

        content.innerHTML = `
            <div class="bom-toolbar">
                <button class="btn btn-sm btn-primary" id="btn-add-bom-row">+ Add Row</button>
                <button class="btn btn-sm btn-secondary" id="btn-export-bom-csv">Export CSV</button>
            </div>
            <div class="table-wrap">
                <table class="bom-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Item</th>
                            <th>Details</th>
                            <th>Required</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="5" class="empty-state">No items yet. Add rows or use the chat to generate a BOM.</td></tr>'}</tbody>
                </table>
            </div>`;

        _bindBOMEditing(project);
    }

    function _bindBOMEditing(project) {
        // Cell editing
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

        // Delete row
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

        // Add row
        const addBtn = document.querySelector('#btn-add-bom-row');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const bom = [...(project.billOfMaterials || [])];
                bom.push({
                    id: Store.generateId(),
                    category: BOM_CATEGORIES[0],
                    item: '',
                    details: '',
                    required: true,
                });
                Store.setBOM(project.id, bom);
                project.billOfMaterials = bom;
                renderBOMTab(project);
            });
        }

        // Export CSV
        const csvBtn = document.querySelector('#btn-export-bom-csv');
        if (csvBtn) {
            csvBtn.addEventListener('click', () => handleExportBOMCSV(project));
        }
    }

    // ── Tab 3: Lifecycle Scripts ─────────────────────────────────

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
        const platBadge = SCRIPT_PLATFORM_BADGES[platform] || `<span class="badge">${platform}</span>`;
        const keywords = platform === 'bash' ? BASH_KEYWORDS : PS_KEYWORDS;

        const buildHighlighted = _highlightSyntax(scriptData.buildScript || '', keywords);
        const teardownHighlighted = _highlightSyntax(scriptData.teardownScript || '', keywords);

        return `
        <div class="script-panel" data-template-id="${tpl.id}">
            <div class="script-panel-header">
                <h4>${_esc(tpl.name)}</h4>
                ${platBadge}
            </div>

            <div class="script-toggles">
                <button class="btn btn-sm script-toggle active" data-template-id="${tpl.id}" data-mode="build">Build Script</button>
                <button class="btn btn-sm script-toggle" data-template-id="${tpl.id}" data-mode="teardown">Teardown Script</button>
            </div>

            <div class="script-viewer" data-template-id="${tpl.id}" data-mode="build">
                <pre class="code-block"><code>${buildHighlighted || '<span class="text-muted">No build script generated yet.</span>'}</code></pre>
            </div>
            <div class="script-viewer" data-template-id="${tpl.id}" data-mode="teardown" style="display:none;">
                <pre class="code-block"><code>${teardownHighlighted || '<span class="text-muted">No teardown script generated yet.</span>'}</code></pre>
            </div>

            <div class="script-actions">
                <button class="btn btn-sm btn-secondary" data-action="copy-script" data-template-id="${tpl.id}">Copy to Clipboard</button>
                <button class="btn btn-sm btn-primary" data-action="regenerate-script" data-template-id="${tpl.id}">Regenerate Script</button>
            </div>
        </div>`;
    }

    function _highlightSyntax(code, keywords) {
        if (!code) return '';
        let escaped = _esc(code);

        // Highlight comments
        escaped = escaped.replace(/(#[^\n]*)/g, '<span class="syntax-comment">$1</span>');

        // Highlight strings
        escaped = escaped.replace(/(&quot;[^&]*?&quot;)/g, '<span class="syntax-string">$1</span>');
        escaped = escaped.replace(/(&#x27;[^&]*?&#x27;)/g, '<span class="syntax-string">$1</span>');

        // Highlight keywords
        for (const kw of keywords) {
            const pattern = new RegExp(`\\b(${_escapeRegex(kw)})\\b`, 'g');
            escaped = escaped.replace(pattern, '<span class="syntax-keyword">$1</span>');
        }

        return escaped;
    }

    function _bindScriptActions(project) {
        // Toggle build/teardown
        document.querySelectorAll('.script-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const templateId = btn.dataset.templateId;
                const mode = btn.dataset.mode;

                // Toggle active button
                document.querySelectorAll(`.script-toggle[data-template-id="${templateId}"]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Toggle viewer
                document.querySelectorAll(`.script-viewer[data-template-id="${templateId}"]`).forEach(v => {
                    v.style.display = v.dataset.mode === mode ? '' : 'none';
                });
            });
        });

        // Copy to clipboard
        document.querySelectorAll('[data-action="copy-script"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const templateId = btn.dataset.templateId;
                const scripts = project.lifecycleScripts || {};
                const scriptData = scripts[templateId] || {};

                // Determine which mode is active
                const activeToggle = document.querySelector(`.script-toggle[data-template-id="${templateId}"].active`);
                const mode = activeToggle ? activeToggle.dataset.mode : 'build';
                const text = mode === 'teardown' ? (scriptData.teardownScript || '') : (scriptData.buildScript || '');

                if (!text) {
                    alert('No script content to copy.');
                    return;
                }

                navigator.clipboard.writeText(text).then(() => {
                    const original = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = original; }, 1500);
                }).catch(() => {
                    alert('Failed to copy to clipboard.');
                });
            });
        });

        // Regenerate script
        document.querySelectorAll('[data-action="regenerate-script"]').forEach(btn => {
            btn.addEventListener('click', () => {
                handleRegenerateScript(btn.dataset.templateId, project.id);
            });
        });
    }

    // ── Tab 4: Export ────────────────────────────────────────────

    function renderExportTab(project) {
        const content = document.querySelector('#phase4-tab-content');
        if (!content) return;

        const blueprints = project.labBlueprints || [];
        const history = project.exportHistory || [];

        const checkboxes = blueprints.map(bp => `
            <label class="export-lab-checkbox">
                <input type="checkbox" value="${bp.id}" checked />
                ${_esc(bp.title || bp.id)}
            </label>`).join('');

        const historyRows = history.slice().reverse().map(h => `
            <tr>
                <td>${new Date(h.exportedAt).toLocaleString()}</td>
                <td>${_esc(h.format || 'ZIP')}</td>
                <td>${h.labCount}</td>
            </tr>`).join('');

        content.innerHTML = `
            <div class="export-section">
                <h4>Export to Skillable Studio</h4>

                ${blueprints.length > 0 ? `
                <div class="export-options">
                    <h5>Labs to include:</h5>
                    <div class="export-checkboxes">${checkboxes}</div>
                </div>` : '<p class="text-muted">No lab blueprints to export. Complete Phase 3 first.</p>'}

                <div class="export-actions">
                    <button class="btn btn-primary" id="btn-export-skillable" ${blueprints.length === 0 ? 'disabled' : ''}>Export to Skillable Studio</button>
                    <button class="btn btn-secondary" id="btn-export-json" ${blueprints.length === 0 ? 'disabled' : ''}>Export Labs as JSON</button>
                </div>
            </div>

            ${historyRows ? `
            <div class="export-history">
                <h5>Export History</h5>
                <table class="mini-table">
                    <thead><tr><th>Date</th><th>Format</th><th>Labs</th></tr></thead>
                    <tbody>${historyRows}</tbody>
                </table>
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
                const json = Exporter.exportLabsAsJSON(project);
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

    // ── Action handlers ─────────────────────────────────────────

    /**
     * Apply structured ENVIRONMENT data from AI response.
     */
    function applyAIResults(structured, projectId) {
        if (!structured) return;

        const project = Store.getProject(projectId);
        if (!project) return;

        // Templates
        if (Array.isArray(structured.templates)) {
            for (const tpl of structured.templates) {
                Store.addEnvironmentTemplate(projectId, {
                    id: tpl.id || Store.generateId(),
                    name: tpl.name || 'Unnamed Template',
                    platform: tpl.platform || '',
                    vms: tpl.vms || [],
                    cloudResources: tpl.cloudResources || [],
                    credentials: tpl.credentials || [],
                    dummyData: tpl.dummyData || [],
                    licenses: tpl.licenses || [],
                });
            }
        }

        // Bill of Materials
        if (Array.isArray(structured.billOfMaterials)) {
            const bom = structured.billOfMaterials.map(item => ({
                id: item.id || Store.generateId(),
                category: item.category || 'Applications',
                item: item.item || '',
                details: item.details || '',
                required: item.required !== false,
            }));
            Store.setBOM(projectId, bom);
        }

        // Lifecycle Scripts
        if (structured.lifecycleScripts && typeof structured.lifecycleScripts === 'object') {
            for (const [templateId, script] of Object.entries(structured.lifecycleScripts)) {
                Store.setLifecycleScript(projectId, templateId, {
                    platform: script.platform || 'powershell',
                    buildScript: script.buildScript || '',
                    teardownScript: script.teardownScript || '',
                });
            }
        }

        // Re-render
        const updated = Store.getProject(projectId);
        render(updated);
    }

    /**
     * Trigger Skillable export for selected labs.
     */
    async function handleExport(projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;

        // Gather selected lab IDs from checkboxes
        const checkboxes = document.querySelectorAll('.export-lab-checkbox input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.value);

        if (selectedIds.length === 0) {
            alert('Please select at least one lab to export.');
            return;
        }

        const options = { labIds: selectedIds };

        try {
            await Exporter.exportToSkillable(project, options);

            // Record export in history
            Store.addExportRecord(projectId, {
                format: 'Skillable ZIP',
                labCount: selectedIds.length,
            });

            const updated = Store.getProject(projectId);
            renderExportTab(updated);
        } catch (err) {
            console.error('[Phase4] Export failed:', err);
            alert('Export failed: ' + err.message);
        }
    }

    /**
     * Ask AI to regenerate a lifecycle script for a template.
     */
    async function handleRegenerateScript(templateId, projectId) {
        const project = Store.getProject(projectId);
        if (!project) return;

        const template = (project.environmentTemplates || []).find(t => t.id === templateId);
        if (!template) {
            alert('Template not found.');
            return;
        }

        const btn = document.querySelector(`[data-action="regenerate-script"][data-template-id="${templateId}"]`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Regenerating...';
        }

        try {
            const promptMsg = `Regenerate the lifecycle scripts (build and teardown) for the environment template "${template.name}" (platform: ${template.platform || 'azure'}). The template has:\n` +
                `VMs: ${JSON.stringify(template.vms || [])}\n` +
                `Cloud Resources: ${JSON.stringify(template.cloudResources || [])}\n` +
                `Credentials: ${JSON.stringify(template.credentials || [])}\n` +
                `Please output the scripts inside the ===ENVIRONMENT=== markers.`;

            const result = await Chat.sendMessage(4, projectId, promptMsg);

            if (result.structured) {
                applyAIResults(result.structured, projectId);
            }
        } catch (err) {
            console.error('[Phase4] Regenerate script failed:', err);
            alert('Failed to regenerate script: ' + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Regenerate Script';
            }
        }
    }

    /**
     * Export BOM as CSV and download.
     */
    function handleExportBOMCSV(project) {
        const bom = project.billOfMaterials || [];
        if (bom.length === 0) {
            alert('No BOM data to export.');
            return;
        }

        const csv = Exporter.exportBOMAsCSV(bom);
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

    // ── Utilities ───────────────────────────────────────────────

    function _esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function _sanitizeFilename(name) {
        return (name || 'export')
            .replace(/[^a-zA-Z0-9\s\-_]/g, '')
            .replace(/\s+/g, '-')
            .trim()
            .slice(0, 80);
    }

    // ── Public API ──────────────────────────────────────────────

    return {
        init,
        render,
        renderEnvironmentTab,
        renderBOMTab,
        renderScriptsTab,
        renderExportTab,
        applyAIResults,
        handleExport,
        handleRegenerateScript,
        handleExportBOMCSV,
    };
})();
