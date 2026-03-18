/**
 * app.js — UI logic for Lab Designer
 */

document.addEventListener('DOMContentLoaded', () => {
    // ---- Navigation ----
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');

    function showView(viewId) {
        views.forEach(v => v.classList.remove('active'));
        navLinks.forEach(l => l.classList.remove('active'));
        const target = document.getElementById('view-' + viewId);
        if (target) target.classList.add('active');
        const link = document.querySelector(`.nav-link[data-view="${viewId}"]`);
        if (link) link.classList.add('active');
        // Refresh the view
        if (viewId === 'dashboard') renderDashboard();
        else if (viewId === 'courses') renderCourses();
        else if (viewId === 'labs') renderLabs();
        else if (viewId === 'skills') renderSkills();
        else if (viewId === 'program-builder') setWizardStep(wizardState.currentStep);
        else if (viewId === 'settings') renderSettings();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            showView(link.dataset.view);
        });
    });

    // ---- Modal ----
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');

    function openModal(title, bodyHTML, footerHTML) {
        modalTitle.textContent = title;
        modalBody.innerHTML = bodyHTML;
        modalFooter.innerHTML = footerHTML || '';
        modalOverlay.classList.remove('hidden');
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
    }

    modalOverlay.addEventListener('click', e => {
        if (e.target === modalOverlay) closeModal();
    });
    document.querySelector('.modal-close').addEventListener('click', closeModal);

    // ---- Tab handling ----
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            btn.closest('.form-layout').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.closest('.form-layout').querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + tabId).classList.add('active');
        });
    });

    // ---- Dashboard ----
    function renderDashboard() {
        const stats = Store.getStats();
        document.getElementById('stat-courses').textContent = stats.courses;
        document.getElementById('stat-labs').textContent = stats.labs;
        document.getElementById('stat-skills').textContent = stats.skills;
        const hours = Math.floor(stats.duration / 60);
        const mins = stats.duration % 60;
        document.getElementById('stat-duration').textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        const recentLabs = Store.getLabs()
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
            .slice(0, 6);
        const container = document.getElementById('recent-labs');
        if (recentLabs.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No labs yet. Create your first lab to get started.</p></div>';
        } else {
            container.innerHTML = recentLabs.map(lab => labCard(lab)).join('');
            container.querySelectorAll('.card').forEach(card => {
                card.addEventListener('click', () => openLabEditor(card.dataset.id));
            });
        }
    }

    function labCard(lab) {
        const skills = Store.getSkills();
        const labSkills = (lab.skillIds || []).map(id => skills.find(s => s.id === id)).filter(Boolean);
        return `
            <div class="card" data-id="${lab.id}">
                <div class="card-title">${escHtml(lab.title || 'Untitled Lab')}</div>
                <div class="card-meta">
                    <span class="badge badge-${lab.status || 'draft'}">${lab.status || 'draft'}</span>
                    <span class="badge badge-${lab.difficulty || 'beginner'}">${lab.difficulty || 'beginner'}</span>
                    <span>${lab.duration || 0} min</span>
                    ${lab.platform ? `<span>${platformLabel(lab.platform)}</span>` : ''}
                </div>
                <div class="card-description">${escHtml(lab.description || '')}</div>
                <div class="card-tags">${labSkills.map(s => `<span class="tag">${escHtml(s.name)}</span>`).join('')}</div>
            </div>`;
    }

    function platformLabel(p) {
        const map = { azure: 'Azure', aws: 'AWS', gcp: 'GCP', multi: 'Multi-Cloud' };
        return map[p] || p;
    }

    // ---- Courses ----
    function renderCourses() {
        const courses = Store.getCourses();
        const container = document.getElementById('courses-list');
        if (courses.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No courses yet. Create a course to organize your labs.</p></div>';
            return;
        }
        container.innerHTML = courses.map(course => {
            const labCount = course.modules.reduce((sum, m) => sum + m.labIds.length, 0);
            return `
                <div class="card" data-id="${course.id}">
                    <div class="card-title">${escHtml(course.name || 'Untitled Course')}</div>
                    <div class="card-meta">
                        <span class="badge badge-${course.status || 'draft'}">${course.status || 'draft'}</span>
                        <span class="badge badge-${course.level || 'beginner'}">${course.level || 'beginner'}</span>
                        <span>${course.modules.length} modules</span>
                        <span>${labCount} labs</span>
                    </div>
                    <div class="card-description">${escHtml(course.description || '')}</div>
                </div>`;
        }).join('');
        container.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => openCourseEditor(card.dataset.id));
        });
    }

    document.getElementById('btn-add-course').addEventListener('click', () => openCourseEditor(null));

    function openCourseEditor(courseId) {
        const course = courseId ? Store.getCourse(courseId) : {
            id: '', name: '', description: '', level: 'beginner', status: 'draft',
            prerequisites: '', skillIds: [], modules: [],
        };
        if (!course) return;

        document.getElementById('course-id').value = course.id || '';
        document.getElementById('course-name').value = course.name || '';
        document.getElementById('course-description').value = course.description || '';
        document.getElementById('course-level').value = course.level || 'beginner';
        document.getElementById('course-status').value = course.status || 'draft';
        document.getElementById('course-prerequisites').value = course.prerequisites || '';
        document.getElementById('course-editor-title').textContent = course.id ? 'Edit Course' : 'New Course';
        document.getElementById('btn-delete-course').style.display = course.id ? '' : 'none';

        renderSkillSelector('course-skills-selector', course.skillIds || []);
        renderCourseModules(course.modules || []);

        showEditorView('course-editor');
    }

    function renderCourseModules(modules) {
        const container = document.getElementById('course-modules');
        const allLabs = Store.getLabs();
        container.innerHTML = modules.map((mod, idx) => {
            const labItems = mod.labIds.map(lid => {
                const lab = allLabs.find(l => l.id === lid);
                return lab ? `<div class="module-lab-item" data-lab-id="${lid}">
                    ${escHtml(lab.title || 'Untitled')}
                    <button type="button" class="btn-remove" onclick="this.closest('.module-lab-item').remove()">&times;</button>
                </div>` : '';
            }).join('');

            const labOptions = allLabs.map(l =>
                `<option value="${l.id}">${escHtml(l.title || 'Untitled')}</option>`
            ).join('');

            return `
                <div class="module-item" data-module-idx="${idx}">
                    <div class="module-header">
                        <span class="step-drag-handle">&#9776;</span>
                        <input type="text" class="module-name" value="${escHtml(mod.name || '')}" placeholder="Module name">
                        <button type="button" class="btn btn-danger btn-sm btn-remove-module">&times;</button>
                    </div>
                    <div class="module-labs">${labItems}</div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <select class="module-lab-select filter-select">
                            <option value="">Add a lab...</option>
                            ${labOptions}
                        </select>
                        <button type="button" class="btn btn-secondary btn-sm btn-add-module-lab">Add</button>
                    </div>
                </div>`;
        }).join('');

        // Wire up add-lab-to-module buttons
        container.querySelectorAll('.btn-add-module-lab').forEach(btn => {
            btn.addEventListener('click', () => {
                const modEl = btn.closest('.module-item');
                const select = modEl.querySelector('.module-lab-select');
                const labId = select.value;
                if (!labId) return;
                const lab = Store.getLab(labId);
                if (!lab) return;
                const labsContainer = modEl.querySelector('.module-labs');
                const div = document.createElement('div');
                div.className = 'module-lab-item';
                div.dataset.labId = labId;
                div.innerHTML = `${escHtml(lab.title || 'Untitled')}
                    <button type="button" class="btn-remove" onclick="this.closest('.module-lab-item').remove()">&times;</button>`;
                labsContainer.appendChild(div);
                select.value = '';
            });
        });

        container.querySelectorAll('.btn-remove-module').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('.module-item').remove());
        });
    }

    document.getElementById('btn-add-module').addEventListener('click', () => {
        const container = document.getElementById('course-modules');
        const idx = container.children.length;
        const allLabs = Store.getLabs();
        const labOptions = allLabs.map(l =>
            `<option value="${l.id}">${escHtml(l.title || 'Untitled')}</option>`
        ).join('');

        const div = document.createElement('div');
        div.className = 'module-item';
        div.dataset.moduleIdx = idx;
        div.innerHTML = `
            <div class="module-header">
                <span class="step-drag-handle">&#9776;</span>
                <input type="text" class="module-name" value="" placeholder="Module name">
                <button type="button" class="btn btn-danger btn-sm btn-remove-module">&times;</button>
            </div>
            <div class="module-labs"></div>
            <div style="display:flex;gap:8px;align-items:center;">
                <select class="module-lab-select filter-select">
                    <option value="">Add a lab...</option>
                    ${labOptions}
                </select>
                <button type="button" class="btn btn-secondary btn-sm btn-add-module-lab">Add</button>
            </div>`;
        container.appendChild(div);

        div.querySelector('.btn-remove-module').addEventListener('click', () => div.remove());
        div.querySelector('.btn-add-module-lab').addEventListener('click', () => {
            const select = div.querySelector('.module-lab-select');
            const labId = select.value;
            if (!labId) return;
            const lab = Store.getLab(labId);
            if (!lab) return;
            const labsContainer = div.querySelector('.module-labs');
            const item = document.createElement('div');
            item.className = 'module-lab-item';
            item.dataset.labId = labId;
            item.innerHTML = `${escHtml(lab.title || 'Untitled')}
                <button type="button" class="btn-remove" onclick="this.closest('.module-lab-item').remove()">&times;</button>`;
            labsContainer.appendChild(item);
            select.value = '';
        });
    });

    document.getElementById('course-form').addEventListener('submit', e => {
        e.preventDefault();
        const course = {
            id: document.getElementById('course-id').value || undefined,
            name: document.getElementById('course-name').value,
            description: document.getElementById('course-description').value,
            level: document.getElementById('course-level').value,
            status: document.getElementById('course-status').value,
            prerequisites: document.getElementById('course-prerequisites').value,
            skillIds: getSelectedSkills('course-skills-selector'),
            modules: gatherModules(),
        };
        Store.saveCourse(course);
        showView('courses');
    });

    function gatherModules() {
        const modules = [];
        document.querySelectorAll('#course-modules .module-item').forEach(modEl => {
            const name = modEl.querySelector('.module-name').value;
            const labIds = [];
            modEl.querySelectorAll('.module-lab-item').forEach(li => labIds.push(li.dataset.labId));
            modules.push({ name, labIds });
        });
        return modules;
    }

    document.getElementById('btn-delete-course').addEventListener('click', () => {
        if (confirm('Delete this course? This cannot be undone.')) {
            Store.deleteCourse(document.getElementById('course-id').value);
            showView('courses');
        }
    });

    document.getElementById('btn-back-courses').addEventListener('click', () => showView('courses'));

    // ---- Labs ----
    function renderLabs() {
        const labs = Store.getLabs();
        const container = document.getElementById('labs-list');

        // Populate skill filter
        const filterSelect = document.getElementById('lab-filter-skill');
        const currentFilter = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Skills</option>' +
            Store.getSkills().map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
        filterSelect.value = currentFilter;

        let filtered = labs;
        const searchTerm = document.getElementById('lab-search').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(l =>
                (l.title || '').toLowerCase().includes(searchTerm) ||
                (l.description || '').toLowerCase().includes(searchTerm)
            );
        }
        if (filterSelect.value) {
            filtered = filtered.filter(l => (l.skillIds || []).includes(filterSelect.value));
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No labs found. Create your first hands-on lab.</p></div>';
        } else {
            container.innerHTML = filtered.map(lab => labCard(lab)).join('');
            container.querySelectorAll('.card').forEach(card => {
                card.addEventListener('click', () => openLabEditor(card.dataset.id));
            });
        }
    }

    document.getElementById('lab-search').addEventListener('input', renderLabs);
    document.getElementById('lab-filter-skill').addEventListener('change', renderLabs);
    document.getElementById('btn-add-lab').addEventListener('click', () => openLabEditor(null));

    function openLabEditor(labId) {
        const lab = labId ? Store.getLab(labId) : {
            id: '', title: '', description: '', objectives: '', duration: 30,
            difficulty: 'beginner', status: 'draft', platform: '', skillIds: [],
            vms: [], cloudResources: [], credentials: '', envNotes: '', buildScript: '', steps: [],
        };
        if (!lab) return;

        document.getElementById('lab-id').value = lab.id || '';
        document.getElementById('lab-title').value = lab.title || '';
        document.getElementById('lab-description').value = lab.description || '';
        document.getElementById('lab-objectives').value = lab.objectives || '';
        document.getElementById('lab-duration').value = lab.duration || 30;
        document.getElementById('lab-difficulty').value = lab.difficulty || 'beginner';
        document.getElementById('lab-status').value = lab.status || 'draft';
        document.getElementById('lab-platform').value = lab.platform || '';
        document.getElementById('lab-credentials').value = lab.credentials || '';
        document.getElementById('lab-env-notes').value = lab.envNotes || '';
        document.getElementById('lab-build-script').value = lab.buildScript || '';
        document.getElementById('lab-editor-title').textContent = lab.id ? 'Edit Lab' : 'New Lab';
        document.getElementById('btn-delete-lab').style.display = lab.id ? '' : 'none';

        renderSkillSelector('lab-skills-selector', lab.skillIds || []);
        renderVMs(lab.vms || []);
        renderCloudResources(lab.cloudResources || []);
        renderSteps(lab.steps || []);

        // Reset to first tab
        document.querySelectorAll('#lab-form .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#lab-form .tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector('#lab-form .tab-btn[data-tab="lab-basics"]').classList.add('active');
        document.getElementById('tab-lab-basics').classList.add('active');

        showEditorView('lab-editor');
    }

    // VM management
    function renderVMs(vms) {
        const container = document.getElementById('lab-vms');
        container.innerHTML = vms.map((vm, i) => `
            <div class="resource-item" data-idx="${i}">
                <div class="form-group" style="margin:0">
                    <label>Name</label>
                    <input type="text" class="vm-name" value="${escHtml(vm.name || '')}" placeholder="e.g., DC01">
                </div>
                <div class="form-group" style="margin:0">
                    <label>OS</label>
                    <select class="vm-os">
                        <option value="windows-server" ${vm.os === 'windows-server' ? 'selected' : ''}>Windows Server</option>
                        <option value="windows-11" ${vm.os === 'windows-11' ? 'selected' : ''}>Windows 11</option>
                        <option value="ubuntu" ${vm.os === 'ubuntu' ? 'selected' : ''}>Ubuntu Linux</option>
                        <option value="centos" ${vm.os === 'centos' ? 'selected' : ''}>CentOS Linux</option>
                        <option value="custom" ${vm.os === 'custom' ? 'selected' : ''}>Custom Image</option>
                    </select>
                </div>
                <button type="button" class="btn-remove" onclick="this.closest('.resource-item').remove()">&times;</button>
            </div>`).join('');
    }

    document.getElementById('btn-add-vm').addEventListener('click', () => {
        const container = document.getElementById('lab-vms');
        const div = document.createElement('div');
        div.className = 'resource-item';
        div.innerHTML = `
            <div class="form-group" style="margin:0">
                <label>Name</label>
                <input type="text" class="vm-name" value="" placeholder="e.g., DC01">
            </div>
            <div class="form-group" style="margin:0">
                <label>OS</label>
                <select class="vm-os">
                    <option value="windows-server">Windows Server</option>
                    <option value="windows-11">Windows 11</option>
                    <option value="ubuntu">Ubuntu Linux</option>
                    <option value="centos">CentOS Linux</option>
                    <option value="custom">Custom Image</option>
                </select>
            </div>
            <button type="button" class="btn-remove" onclick="this.closest('.resource-item').remove()">&times;</button>`;
        container.appendChild(div);
    });

    // Cloud resource management
    function renderCloudResources(resources) {
        const container = document.getElementById('lab-cloud-resources');
        container.innerHTML = resources.map((res, i) => `
            <div class="resource-item" data-idx="${i}">
                <div class="form-group" style="margin:0">
                    <label>Type</label>
                    <input type="text" class="res-type" value="${escHtml(res.type || '')}" placeholder="e.g., Storage Account">
                </div>
                <div class="form-group" style="margin:0">
                    <label>Name / Details</label>
                    <input type="text" class="res-name" value="${escHtml(res.name || '')}" placeholder="e.g., labstorage01">
                </div>
                <button type="button" class="btn-remove" onclick="this.closest('.resource-item').remove()">&times;</button>
            </div>`).join('');
    }

    document.getElementById('btn-add-resource').addEventListener('click', () => {
        const container = document.getElementById('lab-cloud-resources');
        const div = document.createElement('div');
        div.className = 'resource-item';
        div.innerHTML = `
            <div class="form-group" style="margin:0">
                <label>Type</label>
                <input type="text" class="res-type" value="" placeholder="e.g., Storage Account">
            </div>
            <div class="form-group" style="margin:0">
                <label>Name / Details</label>
                <input type="text" class="res-name" value="" placeholder="e.g., labstorage01">
            </div>
            <button type="button" class="btn-remove" onclick="this.closest('.resource-item').remove()">&times;</button>`;
        container.appendChild(div);
    });

    // Steps management
    function renderSteps(steps) {
        const container = document.getElementById('lab-steps-list');
        container.innerHTML = steps.map((step, i) => stepHTML(step, i)).join('');
        renumberSteps();
        attachStepEvents();
    }

    function stepHTML(step, idx) {
        return `
            <div class="step-item" data-step-idx="${idx}" draggable="true">
                <div class="step-header">
                    <span class="step-drag-handle">&#9776;</span>
                    <span class="step-number">${idx + 1}</span>
                    <input type="text" class="step-title-input" value="${escHtml(step.title || '')}" placeholder="Step title">
                    <button type="button" class="step-remove">&times;</button>
                </div>
                <div class="step-body">
                    <textarea class="step-instructions" rows="4" placeholder="Step instructions (supports Markdown)...">${escHtml(step.instructions || '')}</textarea>
                </div>
            </div>`;
    }

    function attachStepEvents() {
        document.querySelectorAll('.step-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.step-item').remove();
                renumberSteps();
            });
        });

        // Drag and drop for steps
        const container = document.getElementById('lab-steps-list');
        let dragItem = null;

        container.querySelectorAll('.step-item').forEach(item => {
            item.addEventListener('dragstart', e => {
                dragItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                dragItem = null;
                renumberSteps();
            });
            item.addEventListener('dragover', e => {
                e.preventDefault();
                if (!dragItem || dragItem === item) return;
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    container.insertBefore(dragItem, item);
                } else {
                    container.insertBefore(dragItem, item.nextSibling);
                }
            });
        });
    }

    function renumberSteps() {
        document.querySelectorAll('#lab-steps-list .step-number').forEach((el, i) => {
            el.textContent = i + 1;
        });
    }

    document.getElementById('btn-add-step').addEventListener('click', () => {
        const container = document.getElementById('lab-steps-list');
        const idx = container.children.length;
        const div = document.createElement('div');
        div.className = 'step-item';
        div.draggable = true;
        div.dataset.stepIdx = idx;
        div.innerHTML = `
            <div class="step-header">
                <span class="step-drag-handle">&#9776;</span>
                <span class="step-number">${idx + 1}</span>
                <input type="text" class="step-title-input" value="" placeholder="Step title">
                <button type="button" class="step-remove">&times;</button>
            </div>
            <div class="step-body">
                <textarea class="step-instructions" rows="4" placeholder="Step instructions (supports Markdown)..."></textarea>
            </div>`;
        container.appendChild(div);
        renumberSteps();
        attachStepEvents();
        div.querySelector('.step-title-input').focus();
    });

    // Save lab
    document.getElementById('lab-form').addEventListener('submit', e => {
        e.preventDefault();
        const lab = {
            id: document.getElementById('lab-id').value || undefined,
            title: document.getElementById('lab-title').value,
            description: document.getElementById('lab-description').value,
            objectives: document.getElementById('lab-objectives').value,
            duration: parseInt(document.getElementById('lab-duration').value) || 30,
            difficulty: document.getElementById('lab-difficulty').value,
            status: document.getElementById('lab-status').value,
            platform: document.getElementById('lab-platform').value,
            credentials: document.getElementById('lab-credentials').value,
            envNotes: document.getElementById('lab-env-notes').value,
            buildScript: document.getElementById('lab-build-script').value,
            skillIds: getSelectedSkills('lab-skills-selector'),
            vms: gatherVMs(),
            cloudResources: gatherCloudResources(),
            steps: gatherSteps(),
        };
        Store.saveLab(lab);
        showView('labs');
    });

    function gatherVMs() {
        const vms = [];
        document.querySelectorAll('#lab-vms .resource-item').forEach(el => {
            vms.push({
                name: el.querySelector('.vm-name').value,
                os: el.querySelector('.vm-os').value,
            });
        });
        return vms;
    }

    function gatherCloudResources() {
        const resources = [];
        document.querySelectorAll('#lab-cloud-resources .resource-item').forEach(el => {
            resources.push({
                type: el.querySelector('.res-type').value,
                name: el.querySelector('.res-name').value,
            });
        });
        return resources;
    }

    function gatherSteps() {
        const steps = [];
        document.querySelectorAll('#lab-steps-list .step-item').forEach(el => {
            steps.push({
                title: el.querySelector('.step-title-input').value,
                instructions: el.querySelector('.step-instructions').value,
            });
        });
        return steps;
    }

    document.getElementById('btn-delete-lab').addEventListener('click', () => {
        if (confirm('Delete this lab? This cannot be undone.')) {
            Store.deleteLab(document.getElementById('lab-id').value);
            showView('labs');
        }
    });

    document.getElementById('btn-back-labs').addEventListener('click', () => showView('labs'));

    // ---- Skills ----
    function renderSkills() {
        const skills = Store.getSkills();
        const container = document.getElementById('skills-list');
        if (skills.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No skills defined yet. Add skills to tag your labs and courses.</p></div>';
            return;
        }
        container.innerHTML = skills.map(skill => {
            const count = Store.getSkillUsageCount(skill.id);
            return `
                <div class="skill-tag" data-id="${skill.id}">
                    ${escHtml(skill.name)}
                    <span class="skill-count">${count}</span>
                    <button class="skill-remove" data-id="${skill.id}">&times;</button>
                </div>`;
        }).join('');

        container.querySelectorAll('.skill-remove').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Remove this skill? It will be untagged from all labs and courses.')) {
                    Store.removeSkill(id);
                    renderSkills();
                }
            });
        });
    }

    document.getElementById('btn-add-skill').addEventListener('click', () => {
        openModal('Add Skill', `
            <div class="form-group">
                <label for="new-skill-name">Skill Name</label>
                <input type="text" id="new-skill-name" placeholder="e.g., Azure VMs, Kubernetes, Python scripting">
            </div>`,
            `<button class="btn btn-secondary" id="modal-cancel">Cancel</button>
             <button class="btn btn-primary" id="modal-save-skill">Add Skill</button>`
        );
        document.getElementById('new-skill-name').focus();
        document.getElementById('modal-cancel').addEventListener('click', closeModal);
        document.getElementById('modal-save-skill').addEventListener('click', () => {
            const name = document.getElementById('new-skill-name').value.trim();
            if (name) {
                const result = Store.addSkill(name);
                if (!result) {
                    alert('Skill already exists or name is empty.');
                    return;
                }
                closeModal();
                renderSkills();
            }
        });
        document.getElementById('new-skill-name').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('modal-save-skill').click();
        });
    });

    // ---- Skill Selector (shared for labs + courses) ----
    function renderSkillSelector(containerId, selectedIds) {
        const container = document.getElementById(containerId);
        const skills = Store.getSkills();
        if (skills.length === 0) {
            container.innerHTML = '<span style="color:var(--color-text-light);font-size:0.85rem;">No skills defined. Add skills first.</span>';
            return;
        }
        container.innerHTML = skills.map(s => {
            const selected = selectedIds.includes(s.id);
            return `<span class="tag ${selected ? 'selected' : ''}" data-skill-id="${s.id}">${escHtml(s.name)}</span>`;
        }).join('');
        container.querySelectorAll('.tag').forEach(tag => {
            tag.addEventListener('click', () => tag.classList.toggle('selected'));
        });
    }

    function getSelectedSkills(containerId) {
        const ids = [];
        document.querySelectorAll(`#${containerId} .tag.selected`).forEach(tag => {
            ids.push(tag.dataset.skillId);
        });
        return ids;
    }

    // ---- View helpers ----
    function showEditorView(editorViewName) {
        views.forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + editorViewName).classList.add('active');
    }

    // ---- Import / Export ----
    document.getElementById('btn-export-skillable').addEventListener('click', () => {
        SkillableExporter.exportAllLabs();
    });

    document.getElementById('btn-export').addEventListener('click', () => {
        const json = Store.exportAll();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lab-designer-data.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            if (Store.importAll(ev.target.result)) {
                alert('Data imported successfully.');
                showView('dashboard');
            } else {
                alert('Import failed. Invalid data format.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // ---- Program Builder Wizard ----
    let wizardState = {
        description: '',
        audienceSize: 20,
        audienceLevel: 'beginner',
        platform: 'azure',
        selectedSkills: [],     // array of skill name strings
        labOutlines: [],        // generated outlines from Catalog
        currentStep: 1,
    };

    function setWizardStep(step) {
        wizardState.currentStep = step;
        document.querySelectorAll('.wizard-step').forEach(el => {
            const s = parseInt(el.dataset.step);
            el.classList.remove('active', 'completed');
            if (s === step) el.classList.add('active');
            else if (s < step) el.classList.add('completed');
        });
        document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('wizard-step-' + step);
        if (panel) panel.classList.add('active');
    }

    // Step 1: Analyze
    document.getElementById('wizard-analyze').addEventListener('click', async () => {
        const desc = document.getElementById('wizard-description').value.trim();
        if (!desc) { alert('Please describe your program.'); return; }
        wizardState.description = desc;
        wizardState.audienceSize = parseInt(document.getElementById('wizard-audience-size').value) || 20;
        wizardState.audienceLevel = document.getElementById('wizard-audience-level').value;
        const platformPref = document.getElementById('wizard-platform').value;

        // Show loading if AI is configured
        const useAI = Settings.isAIConfigured();
        const grid = document.getElementById('wizard-skills-grid');

        let analysis;
        if (useAI) {
            grid.innerHTML = '<div class="wizard-loading"><div class="spinner"></div><p>AI is analyzing your program description...</p></div>';
            setWizardStep(2);

            const aiResult = await Settings.aiAnalyzeProgram(desc, platformPref);
            if (aiResult) {
                analysis = aiResult;
                wizardState.platform = (platformPref === 'auto') ? (aiResult.platform || 'azure') : platformPref;
                wizardState.usedAI = true;
            } else {
                // Fall back to built-in
                analysis = Catalog.analyzeProgram(desc);
                wizardState.platform = (platformPref === 'auto') ? analysis.platform : platformPref;
                wizardState.usedAI = false;
            }
        } else {
            analysis = Catalog.analyzeProgram(desc);
            wizardState.platform = (platformPref === 'auto') ? analysis.platform : platformPref;
            wizardState.usedAI = false;
        }

        // Build skills grid grouped by domain
        const allDomains = Catalog.getDomains();
        grid.innerHTML = '';

        // Show AI badge if used
        if (wizardState.usedAI) {
            const badge = document.createElement('div');
            badge.innerHTML = '<span class="wizard-ai-badge">AI-Enhanced</span> Skills suggested by AI provider';
            badge.style.cssText = 'margin-bottom:12px;font-size:0.8rem;color:var(--color-text-light);';
            grid.appendChild(badge);
        }

        // Show reference material chips
        const refs = Settings.getReferences();
        if (refs.length > 0) {
            const chipRow = document.createElement('div');
            chipRow.className = 'wizard-ref-chips';
            refs.forEach(ref => {
                chipRow.innerHTML += `<span class="wizard-ref-chip">${escHtml(ref.title)}</span>`;
            });
            grid.appendChild(chipRow);
        }

        allDomains.forEach(domain => {
            const matchedDomain = analysis.skillsByDomain[domain.id];
            const matchedNames = matchedDomain ? matchedDomain.skills : [];

            const group = document.createElement('div');
            group.className = 'wizard-domain-group';
            group.innerHTML = `<div class="wizard-domain-title">${escHtml(domain.name)}</div>`;

            const skillsRow = document.createElement('div');
            skillsRow.className = 'wizard-domain-skills';

            domain.skills.forEach(skill => {
                const isSelected = matchedNames.includes(skill.name);
                const tag = document.createElement('span');
                tag.className = 'wizard-skill-tag' + (isSelected ? ' selected' : '');
                tag.textContent = skill.name;
                tag.dataset.skill = skill.name;
                tag.addEventListener('click', () => tag.classList.toggle('selected'));
                skillsRow.appendChild(tag);
            });

            group.appendChild(skillsRow);
            grid.appendChild(group);
        });

        if (!useAI) setWizardStep(2);
    });

    // Step 2: Generate outlines
    document.getElementById('wizard-back-1').addEventListener('click', () => setWizardStep(1));
    document.getElementById('wizard-generate-outlines').addEventListener('click', async () => {
        // Gather selected skills
        const selected = [];
        document.querySelectorAll('#wizard-skills-grid .wizard-skill-tag.selected').forEach(tag => {
            selected.push(tag.dataset.skill);
        });
        if (selected.length === 0) { alert('Select at least one skill.'); return; }
        wizardState.selectedSkills = selected;

        const settings = Settings.get();
        const useAI = Settings.isAIConfigured();
        let outlines = null;

        if (useAI) {
            // Show loading state
            const container = document.getElementById('wizard-outlines-list');
            container.innerHTML = '<div class="wizard-loading"><div class="spinner"></div><p>AI is generating lab outlines...</p></div>';
            setWizardStep(3);

            outlines = await Settings.aiGenerateOutlines(
                selected,
                wizardState.platform,
                wizardState.audienceLevel
            );
        }

        if (!outlines) {
            // Fall back to built-in catalog
            outlines = Catalog.generateLabOutlines(selected, wizardState.platform);
        }

        // Apply density and duration adjustments
        outlines = Catalog.adjustOutlinesForDensity(
            outlines,
            settings.labDensity || 'moderate',
            settings.targetLabDuration || 45
        );

        wizardState.labOutlines = outlines;
        renderWizardOutlines();
        if (!useAI) setWizardStep(3);
    });

    function renderWizardOutlines() {
        const container = document.getElementById('wizard-outlines-list');
        container.innerHTML = wizardState.labOutlines.map((outline, idx) => {
            const scoringBadges = outline.scoring.map(s =>
                `<span class="wizard-scoring-badge">${escHtml(s.name)}</span>`
            ).join('');

            const tasksHTML = outline.tasks.map(task => {
                const activitiesHTML = task.activities.map(act =>
                    `<div class="wizard-activity">
                        <div class="wizard-activity-title">${escHtml(act.title)}</div>
                        <div class="wizard-activity-instructions">${escHtml(act.instructions)}</div>
                    </div>`
                ).join('');
                return `
                    <div class="wizard-task">
                        <div class="wizard-task-header">${escHtml(task.name)}</div>
                        ${activitiesHTML}
                    </div>`;
            }).join('');

            const vmsHTML = outline.environment.vms.map(vm =>
                `<div class="wizard-env-item"><strong>VM</strong>${escHtml(vm.name)} (${escHtml(vm.os)})</div>`
            ).join('');

            const resourcesHTML = outline.environment.cloudResources.map(r =>
                `<div class="wizard-env-item"><strong>${escHtml(r.type)}</strong>${escHtml(r.name)}</div>`
            ).join('');

            return `
                <div class="wizard-outline-card ${outline.enabled ? '' : 'disabled'}" data-idx="${idx}">
                    <div class="wizard-outline-header">
                        <button type="button" class="wizard-outline-toggle ${outline.enabled ? 'on' : ''}" data-idx="${idx}"></button>
                        <div class="wizard-outline-info">
                            <div class="wizard-outline-title">${escHtml(outline.title)}</div>
                            <div class="wizard-outline-meta">
                                <span class="badge badge-${outline.difficulty}">${outline.difficulty}</span>
                                <span>${outline.duration} min</span>
                                <span>${platformLabel(outline.platform)}</span>
                                <span>${escHtml(outline.skillName)}</span>
                            </div>
                        </div>
                        <button type="button" class="wizard-outline-expand" data-idx="${idx}">&#9660;</button>
                    </div>
                    <div class="wizard-outline-body" id="wizard-outline-body-${idx}">
                        <p style="margin:12px 0;color:var(--color-text-light);font-size:0.85rem;">${escHtml(outline.description)}</p>

                        <div class="wizard-outline-section">
                            <div class="wizard-outline-section-title">Tasks &amp; Activities</div>
                            ${tasksHTML}
                        </div>

                        <div class="wizard-outline-section">
                            <div class="wizard-outline-section-title">Starter Environment</div>
                            <div class="wizard-env-grid">
                                ${vmsHTML}${resourcesHTML}
                            </div>
                            ${outline.environment.notes ? `<p style="margin-top:8px;font-size:0.8rem;color:var(--color-text-light);">${escHtml(outline.environment.notes)}</p>` : ''}
                        </div>

                        <div class="wizard-outline-section">
                            <div class="wizard-outline-section-title">Suggested Scoring Methods</div>
                            <div class="wizard-scoring-list">${scoringBadges}</div>
                        </div>
                    </div>
                </div>`;
        }).join('');

        // Wire toggle buttons
        container.querySelectorAll('.wizard-outline-toggle').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                wizardState.labOutlines[idx].enabled = !wizardState.labOutlines[idx].enabled;
                btn.classList.toggle('on');
                btn.closest('.wizard-outline-card').classList.toggle('disabled');
            });
        });

        // Wire expand buttons
        container.querySelectorAll('.wizard-outline-expand').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const idx = btn.dataset.idx;
                const body = document.getElementById('wizard-outline-body-' + idx);
                body.classList.toggle('open');
                btn.classList.toggle('open');
            });
        });

        // Click header to expand too
        container.querySelectorAll('.wizard-outline-header').forEach(header => {
            header.addEventListener('click', e => {
                if (e.target.closest('.wizard-outline-toggle')) return;
                const card = header.closest('.wizard-outline-card');
                const idx = card.dataset.idx;
                const body = document.getElementById('wizard-outline-body-' + idx);
                const expandBtn = card.querySelector('.wizard-outline-expand');
                body.classList.toggle('open');
                expandBtn.classList.toggle('open');
            });
        });
    }

    // Step 3: Go to summary
    document.getElementById('wizard-back-2').addEventListener('click', () => setWizardStep(2));
    document.getElementById('wizard-go-generate').addEventListener('click', () => {
        const enabledLabs = wizardState.labOutlines.filter(o => o.enabled);
        if (enabledLabs.length === 0) { alert('Enable at least one lab.'); return; }
        renderWizardSummary();
        setWizardStep(4);
    });

    function renderWizardSummary() {
        const enabledLabs = wizardState.labOutlines.filter(o => o.enabled);
        const totalDuration = enabledLabs.reduce((s, l) => s + l.duration, 0);
        const uniqueSkills = [...new Set(enabledLabs.map(l => l.skillName))];
        const hours = Math.floor(totalDuration / 60);
        const mins = totalDuration % 60;
        const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        // Build unified environment
        const unifiedEnv = Catalog.buildUnifiedEnvironment(enabledLabs, wizardState.platform);
        wizardState.unifiedEnv = unifiedEnv;

        // Generate build script
        const buildScript = Catalog.generateBuildScript(unifiedEnv);
        wizardState.buildScript = buildScript;

        // Auto-generate a course name from description
        const courseName = wizardState.description.length > 60
            ? wizardState.description.slice(0, 60) + '...'
            : wizardState.description;

        const labListHTML = enabledLabs.map(l =>
            `<li><span>${escHtml(l.title)}</span><span>${l.duration} min</span></li>`
        ).join('');

        const unifiedVmsHTML = unifiedEnv.vms.map(vm =>
            `<div class="wizard-env-item"><strong>VM</strong>${escHtml(vm.name)} (${escHtml(vm.os)})</div>`
        ).join('');

        const unifiedResHTML = unifiedEnv.cloudResources.map(r =>
            `<div class="wizard-env-item"><strong>${escHtml(r.type)}</strong>${escHtml(r.name)}</div>`
        ).join('');

        const scriptPreview = buildScript.length > 2000
            ? buildScript.slice(0, 2000) + '\n\n# ... (script continues) ...'
            : buildScript;

        document.getElementById('wizard-summary').innerHTML = `
            <div class="wizard-summary-stats">
                <div class="wizard-summary-stat">
                    <div class="stat-number">${enabledLabs.length}</div>
                    <div class="stat-label">Labs</div>
                </div>
                <div class="wizard-summary-stat">
                    <div class="stat-number">${uniqueSkills.length}</div>
                    <div class="stat-label">Skills</div>
                </div>
                <div class="wizard-summary-stat">
                    <div class="stat-number">${durationStr}</div>
                    <div class="stat-label">Total Duration</div>
                </div>
                <div class="wizard-summary-stat">
                    <div class="stat-number">${wizardState.audienceSize}</div>
                    <div class="stat-label">Learners</div>
                </div>
            </div>
            <div class="wizard-summary-course-name form-group">
                <label for="wizard-course-name">Course Name</label>
                <input type="text" id="wizard-course-name" value="${escHtml(courseName)}">
            </div>

            <div class="wizard-outline-section-title">Unified Environment (shared across all labs)</div>
            <div class="wizard-env-grid" style="margin-bottom:16px;">
                ${unifiedVmsHTML}${unifiedResHTML}
            </div>

            <div class="wizard-outline-section-title">Labs to Create</div>
            <ul class="wizard-summary-lab-list">${labListHTML}</ul>

            <div class="wizard-outline-section-title" style="margin-top:20px;">
                Environment Build Script (PowerShell)
                <button type="button" class="btn btn-outline btn-sm" id="wizard-copy-script" style="margin-left:12px;">Copy Script</button>
            </div>
            <div class="build-script-preview">
                <pre><code>${escHtml(scriptPreview)}</code></pre>
            </div>`;

        // Wire copy button
        document.getElementById('wizard-copy-script').addEventListener('click', () => {
            navigator.clipboard.writeText(wizardState.buildScript).then(() => {
                const btn = document.getElementById('wizard-copy-script');
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy Script', 2000);
            });
        });
    }

    // Step 4: Save everything
    document.getElementById('wizard-back-3').addEventListener('click', () => setWizardStep(3));
    document.getElementById('wizard-save').addEventListener('click', () => {
        const enabledLabs = wizardState.labOutlines.filter(o => o.enabled);
        const courseName = document.getElementById('wizard-course-name').value.trim() || 'Generated Course';

        // Use unified environment and build script from summary
        const unifiedEnv = wizardState.unifiedEnv;
        const buildScript = wizardState.buildScript;

        // 1. Create skills (deduplicated)
        const skillIds = [];
        const uniqueSkills = [...new Set(enabledLabs.map(l => l.skillName))];
        uniqueSkills.forEach(name => {
            const skill = Store.addSkillIfNotExists(name);
            if (skill) skillIds.push(skill.id);
        });

        // 2. Create labs — all share the unified environment
        const createdLabIds = [];
        const moduleMap = {};

        enabledLabs.forEach(outline => {
            // Build steps from tasks/activities
            const steps = [];
            outline.tasks.forEach(task => {
                task.activities.forEach(act => {
                    steps.push({ title: act.title, instructions: act.instructions });
                });
            });

            const skillObj = Store.getSkills().find(s => s.name === outline.skillName);
            const labSkillIds = skillObj ? [skillObj.id] : [];

            const scoringText = outline.scoring.map(s => `${s.name}: ${s.description}`).join('\n');

            const lab = Store.saveLab({
                title: outline.title,
                description: outline.description,
                objectives: `Skills: ${outline.skillName}\n\nScoring Methods:\n${scoringText}`,
                duration: outline.duration,
                difficulty: outline.difficulty,
                status: 'draft',
                platform: unifiedEnv.platform,
                skillIds: labSkillIds,
                vms: unifiedEnv.vms,
                cloudResources: unifiedEnv.cloudResources,
                credentials: unifiedEnv.credentials,
                envNotes: unifiedEnv.notes,
                buildScript,
                steps,
            });

            createdLabIds.push(lab.id);

            // Group for modules
            const domainKey = outline.skillName;
            if (!moduleMap[domainKey]) moduleMap[domainKey] = [];
            moduleMap[domainKey].push(lab.id);
        });

        // 3. Create course with modules
        const modules = Object.entries(moduleMap).map(([name, labIds]) => ({
            name,
            labIds,
        }));

        const course = Store.saveCourse({
            name: courseName,
            description: `Generated program for ${wizardState.audienceSize} learners (${wizardState.audienceLevel} level).\n\n${wizardState.description}`,
            level: wizardState.audienceLevel === 'mixed' ? 'beginner' : wizardState.audienceLevel,
            status: 'draft',
            prerequisites: '',
            skillIds,
            modules,
        });

        // Navigate to the new course editor
        openCourseEditor(course.id);
    });

    // ---- Settings ----
    function renderSettings() {
        const s = Settings.get();
        document.getElementById('settings-ai-provider').value = s.aiProvider || 'builtin';
        document.getElementById('settings-api-key').value = s.apiKey || '';
        document.getElementById('settings-model').value = s.model || '';
        document.getElementById('settings-endpoint').value = s.endpointUrl || '';
        document.getElementById('settings-target-duration').value = s.targetLabDuration || 45;
        document.getElementById('settings-default-difficulty').value = s.defaultDifficulty || 'beginner';

        const densityMap = { light: 0, moderate: 1, heavy: 2 };
        document.getElementById('settings-lab-density').value = densityMap[s.labDensity] || 1;

        toggleAIFields();
        renderReferences();
    }

    function toggleAIFields() {
        const provider = document.getElementById('settings-ai-provider').value;
        const fields = document.getElementById('settings-ai-fields');
        const endpointGroup = document.getElementById('settings-endpoint-group');
        fields.style.display = provider === 'builtin' ? 'none' : 'block';
        endpointGroup.style.display = provider === 'custom' ? 'block' : 'none';
    }

    document.getElementById('settings-ai-provider').addEventListener('change', toggleAIFields);

    document.getElementById('settings-toggle-key').addEventListener('click', () => {
        const input = document.getElementById('settings-api-key');
        const btn = document.getElementById('settings-toggle-key');
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = 'Hide';
        } else {
            input.type = 'password';
            btn.textContent = 'Show';
        }
    });

    document.getElementById('settings-test-connection').addEventListener('click', async () => {
        const resultEl = document.getElementById('settings-test-result');
        resultEl.textContent = 'Testing...';
        resultEl.className = 'settings-test-result';

        // Save current values before testing
        saveSettingsFromForm();

        const result = await Settings.testConnection();
        resultEl.textContent = result.message;
        resultEl.className = 'settings-test-result ' + (result.success ? 'success' : 'error');
    });

    document.getElementById('settings-save').addEventListener('click', () => {
        saveSettingsFromForm();
        alert('Settings saved.');
    });

    function saveSettingsFromForm() {
        const densityValues = ['light', 'moderate', 'heavy'];
        Settings.update({
            aiProvider: document.getElementById('settings-ai-provider').value,
            apiKey: document.getElementById('settings-api-key').value,
            model: document.getElementById('settings-model').value,
            endpointUrl: document.getElementById('settings-endpoint').value,
            targetLabDuration: parseInt(document.getElementById('settings-target-duration').value) || 45,
            labDensity: densityValues[parseInt(document.getElementById('settings-lab-density').value)] || 'moderate',
            defaultDifficulty: document.getElementById('settings-default-difficulty').value,
        });
    }

    // Reference materials
    function renderReferences() {
        const refs = Settings.getReferences();
        const container = document.getElementById('settings-references-list');
        if (refs.length === 0) {
            container.innerHTML = '<div class="settings-ref-empty">No reference materials added yet.</div>';
            return;
        }
        container.innerHTML = refs.map(ref => `
            <div class="settings-ref-item" data-id="${ref.id}">
                <span class="ref-type ${ref.type}">${ref.type}</span>
                <span class="ref-title" title="${escHtml(ref.title)}">${escHtml(ref.title)}</span>
                ${ref.url ? `<a href="${escHtml(ref.url)}" target="_blank" style="font-size:0.75rem;color:var(--color-primary);">Open</a>` : ''}
                <button class="ref-remove" data-id="${ref.id}">&times;</button>
            </div>
        `).join('');

        container.querySelectorAll('.ref-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                Settings.removeReference(btn.dataset.id);
                renderReferences();
            });
        });
    }

    document.getElementById('settings-add-url').addEventListener('click', () => {
        openModal('Add Reference URL', `
            <div class="form-group">
                <label for="ref-url">Documentation URL</label>
                <input type="url" id="ref-url" placeholder="https://learn.microsoft.com/...">
            </div>
            <div class="form-group">
                <label for="ref-title">Title (optional)</label>
                <input type="text" id="ref-title" placeholder="Auto-detected from URL">
            </div>`,
            `<button class="btn btn-secondary" id="ref-cancel">Cancel</button>
             <button class="btn btn-primary" id="ref-save-url">Add Reference</button>`
        );
        document.getElementById('ref-url').focus();
        document.getElementById('ref-cancel').addEventListener('click', closeModal);
        document.getElementById('ref-save-url').addEventListener('click', () => {
            const url = document.getElementById('ref-url').value.trim();
            if (!url) { alert('Enter a URL.'); return; }
            const title = document.getElementById('ref-title').value.trim() || url.split('/').filter(Boolean).pop() || 'Reference';
            Settings.addReference({ title, type: 'url', url, content: '' });
            closeModal();
            renderReferences();
        });
    });

    document.getElementById('settings-add-file').addEventListener('click', () => {
        document.getElementById('settings-file-input').click();
    });

    document.getElementById('settings-file-input').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const content = ev.target.result;
            // Truncate very large files to 50KB
            const truncated = content.length > 50000 ? content.slice(0, 50000) + '\n...(truncated)' : content;
            Settings.addReference({
                title: file.name,
                type: 'file',
                content: truncated,
            });
            renderReferences();
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // ---- Utility ----
    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- Init ----
    showView('dashboard');
});
