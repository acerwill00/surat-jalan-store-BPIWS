const API_URL = '/api';
let masterBarang = [];
let currentProjectId = null;   // tracks which project folder is open
let currentProjectName = null;

// --- AUTHENTICATION & HEADERS ---
function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function getAuthHeaders() {
    const user = getUser();
    if (!user) return {};
    return {
        'Content-Type': 'application/json',
        'x-user-id': user.id.toString(),
        'x-role': user.role
    };
}

function requireAuth() {
    const user = getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    const navUsername = document.getElementById('navUsername');
    if (navUsername) {
        navUsername.innerText = `${user.username} (${user.role})`;
    }

    // Hide admin-only elements if staff
    if (user.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
}

function requireRole(requiredRole) {
    const user = getUser();
    if (user && user.role !== requiredRole) {
        alert('Anda tidak memiliki izin mengakses halaman ini.');
        window.location.href = 'list_sj.html';
    }
}

function handleLogin(e) {
    e.preventDefault();
    const payload = {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
    };

    fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if(data.error) {
            alert(data.error);
        } else {
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = 'list_sj.html';
        }
    })
    .catch(err => alert('Terdapat kesalahan koneksi.'));
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}


// --- Master Barang Logic (index.html) ---

function loadBarang() {
    fetch(`${API_URL}/barang`, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
            masterBarang = data;
            const tbody = document.getElementById('barangTableBody');
            if (!tbody) return; 
            
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Belum ada data barang.</td></tr>';
                return;
            }

            data.forEach((item) => {
                const tr = document.createElement('tr');
                let aksi = '';
                const user = getUser();
                if(user && user.role === 'admin') {
                    aksi = `
                    <button class="btn btn-sm btn-outline-primary shadow-sm rounded-pill px-3 me-2" onclick="editBarang(${item.id})">
                        <i class="bi bi-pencil-square"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger shadow-sm rounded-pill px-3" onclick="deleteBarang(${item.id})">
                        <i class="bi bi-trash"></i> Hapus
                    </button>`;
                }
                
                tr.innerHTML = `
                    <td class="fw-bold">${item.id}</td>
                    <td><span class="badge bg-secondary">${item.sku}</span></td>
                    <td class="fw-medium text-dark">${item.nama_barang}</td>
                    <td>${item.satuan}</td>
                    <td class="text-end">${aksi}</td>
                `;
                tbody.appendChild(tr);
            });

            // Re-apply any active search after reload
            const searchEl = document.getElementById('searchBarang');
            if (searchEl && searchEl.value.trim() !== '') {
                filterBarang(searchEl.value);
            }
        })
        .catch(err => console.error('Error fetching barang:', err));
}

function filterBarang(query) {
    const clearBtn = document.getElementById('clearSearchBtn');
    const infoEl = document.getElementById('searchResultInfo');
    const tbody = document.getElementById('barangTableBody');
    if (!tbody) return;

    const q = query.trim().toLowerCase();

    // Toggle clear button visibility
    if (clearBtn) clearBtn.style.display = q ? 'inline-block' : 'none';

    if (!q) {
        // Show all rows
        Array.from(tbody.querySelectorAll('tr')).forEach(tr => tr.style.display = '');
        if (infoEl) infoEl.style.display = 'none';
        return;
    }

    const rows = Array.from(tbody.querySelectorAll('tr'));
    let matchCount = 0;
    rows.forEach(tr => {
        const sku = (tr.cells[1]?.textContent || '').toLowerCase();
        const nama = (tr.cells[2]?.textContent || '').toLowerCase();
        const matches = sku.includes(q) || nama.includes(q);
        tr.style.display = matches ? '' : 'none';
        if (matches) matchCount++;
    });

    if (infoEl) {
        infoEl.style.display = 'block';
        if (matchCount === 0) {
            infoEl.innerHTML = `<i class="bi bi-exclamation-circle me-1"></i>Tidak ada hasil untuk <strong>"${query}"</strong>.`;
        } else {
            infoEl.innerHTML = `<i class="bi bi-check-circle me-1 text-success"></i>Ditemukan <strong>${matchCount}</strong> barang dari <strong>${masterBarang.length}</strong> total data.`;
        }
    }
}

function clearSearch() {
    const searchEl = document.getElementById('searchBarang');
    if (searchEl) { searchEl.value = ''; searchEl.focus(); }
    filterBarang('');
}

function resetForm() {
    const hiddenId = document.getElementById('barangId');
    const form = document.getElementById('barangForm');
    if (form) form.reset();
    if (hiddenId) hiddenId.value = '';
    const title = document.getElementById('modalTitle');
    if (title) title.innerText = 'Tambah Barang';
}

function editBarang(id) {
    const barang = masterBarang.find(b => b.id === id);
    if (!barang) return;

    document.getElementById('barangId').value = barang.id;
    document.getElementById('sku').value = barang.sku;
    document.getElementById('nama_barang').value = barang.nama_barang;
    document.getElementById('satuan').value = barang.satuan;
    document.getElementById('modalTitle').innerText = 'Edit Barang';

    const modal = new bootstrap.Modal(document.getElementById('barangModal'));
    modal.show();
}

function saveBarang() {
    const id = document.getElementById('barangId').value;
    const data = {
        sku: document.getElementById('sku').value,
        nama_barang: document.getElementById('nama_barang').value,
        satuan: document.getElementById('satuan').value
    };

    if(!data.sku || !data.nama_barang || !data.satuan) {
         alert("Data tidak boleh kosong!");
         return;
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/barang/${id}` : `${API_URL}/barang`;

    fetch(url, {
        method: method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
        if(result.error) {
            alert("Error: " + result.error);
        } else {
            const modalEl = document.getElementById('barangModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            loadBarang();
        }
    })
    .catch(err => console.error('Error saving:', err));
}

function deleteBarang(id) {
    if (confirm('Yakin ingin menghapus barang ini?')) {
        fetch(`${API_URL}/barang/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        })
        .then(() => loadBarang())
        .catch(err => console.error('Error deleting:', err));
    }
}


// --- SURAT JALAN RECORD LOGIC (list_sj.html) ---

function loadRecordSuratJalan() {
    const user = getUser();
    fetch(`${API_URL}/surat-jalan`, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('sjTableBody');
            if(!tbody) return;
            
            tbody.innerHTML = '';
            if(data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Belum ada riwayat surat jalan.</td></tr>';
                return;
            }

            data.forEach((sj) => {
                const tr = document.createElement('tr');
                
                let statusBadge = '';
                if(sj.status === 'PENDING') statusBadge = '<span class="badge bg-warning text-dark">PENDING</span>';
                else if(sj.status === 'APPROVED') statusBadge = '<span class="badge bg-success">APPROVED</span>';
                else statusBadge = `<span class="badge bg-danger">${sj.status}</span>`;

                let aksi = `
                    <a href="print_sj.html?id=${sj.id}" class="btn btn-sm btn-outline-info shadow-sm rounded-pill px-3 me-2 mb-1">
                        <i class="bi bi-eye"></i> Detail
                    </a>
                `;

                if(sj.status === 'APPROVED') {
                    aksi += `
                        <a href="print_sj.html?id=${sj.id}&print=1" class="btn btn-sm btn-outline-dark shadow-sm rounded-pill px-3 mb-1">
                            <i class="bi bi-printer"></i> Cetak
                        </a>
                    `;
                } else if(sj.status === 'PENDING' && user.role === 'admin') {
                    aksi += `
                        <button class="btn btn-sm btn-success shadow-sm rounded-pill px-3 me-2 mb-1" onclick="approveSuratJalan(${sj.id})">
                            <i class="bi bi-check-circle"></i> Approve
                        </button>
                        <button class="btn btn-sm btn-danger shadow-sm rounded-pill px-3 mb-1" onclick="rejectSuratJalan(${sj.id})">
                            <i class="bi bi-x-circle"></i> Deny
                        </button>
                    `;
                }

                tr.innerHTML = `
                    <td class="fw-bold text-primary">${sj.no_surat_jalan}</td>
                    <td>${sj.tanggal}</td>
                    <td>${sj.tujuan}</td>
                    <td><i class="bi bi-person me-1 text-muted"></i>${sj.creator || '-'}</td>
                    <td>${statusBadge}</td>
                    <td class="text-end">${aksi}</td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => console.error('Failed to load SJ Record', err));
}

function approveSuratJalan(id) {
    if(confirm('Terima (Approve) Surat Jalan ini?')) {
        fetch(`${API_URL}/surat-jalan/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: 'APPROVED' })
        })
        .then(res => res.json())
        .then(data => {
            if(data.error) alert(data.error);
            else { alert('Surat Jalan telah di Approve!'); refreshCurrentSJList(); }
        });
    }
}

function rejectSuratJalan(id) {
    if(confirm('Tolak (Deny) Surat Jalan ini?')) {
        fetch(`${API_URL}/surat-jalan/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: 'REJECTED' })
        })
        .then(res => res.json())
        .then(data => {
            if(data.error) alert(data.error);
            else { alert('Surat Jalan telah ditolak!'); refreshCurrentSJList(); }
        });
    }
}

function refreshCurrentSJList() {
    if (currentProjectId !== null) {
        loadSJByProject(currentProjectId, currentProjectName);
    } else {
        loadRecordSuratJalan();
    }
}


// --- PROJECT MANAGEMENT (list_sj.html) ---

function loadProjects() {
    fetch(`${API_URL}/projects`, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(projects => renderProjectGrid(projects))
        .catch(err => {
            const grid = document.getElementById('projectGrid');
            if (grid) grid.innerHTML = '<p class="text-danger">Gagal memuat project.</p>';
        });
}

function renderProjectGrid(projects) {
    const grid = document.getElementById('projectGrid');
    if (!grid) return;
    const user = getUser();
    const isAdmin = user && user.role === 'admin';

    grid.innerHTML = '';

    // Render each project card
    projects.forEach(p => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <i class="bi bi-folder-fill folder-icon"></i>
            <div class="folder-info">
                <div class="folder-name">${p.name}</div>
                <div class="folder-count">${p.sj_count} Surat Jalan</div>
            </div>
            ${isAdmin ? `
            <div class="folder-actions">
                <button class="btn btn-sm btn-outline-warning py-0 px-2" title="Rename"
                    onclick="event.stopPropagation(); openRenameProjectModal(${p.id}, '${p.name.replace(/'/g, "\\'")}')"
                ><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger py-0 px-2" title="Hapus"
                    onclick="event.stopPropagation(); deleteProject(${p.id}, '${p.name.replace(/'/g, "\\'")}')"
                ><i class="bi bi-trash"></i></button>
            </div>` : ''}
        `;
        card.addEventListener('click', () => loadSJByProject(p.id, p.name));
        grid.appendChild(card);
    });

    // Always append a "Tanpa Project" card at the end
    const noProjectCard = document.createElement('div');
    noProjectCard.className = 'project-card no-project';
    noProjectCard.innerHTML = `
        <i class="bi bi-folder2 folder-icon"></i>
        <div class="folder-info">
            <div class="folder-name">Tanpa Project</div>
            <div class="folder-count">SJ tanpa folder</div>
        </div>
    `;
    noProjectCard.addEventListener('click', () => loadSJByProject('none', 'Tanpa Project'));
    grid.appendChild(noProjectCard);

    // Show empty state if no projects
    if (projects.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'text-center text-muted py-4 col-span-3';
        emptyMsg.style.gridColumn = '1 / -1';
        emptyMsg.innerHTML = '<i class="bi bi-folder-x fs-2 d-block mb-2"></i>Belum ada folder project. Klik "Tambah Folder" untuk membuat.';
        grid.insertBefore(emptyMsg, noProjectCard);
    }
}

function showProjectGrid() {
    currentProjectId = null;
    currentProjectName = null;
    document.getElementById('view-projects').style.display = '';
    document.getElementById('view-sj-table').style.display = 'none';
    document.getElementById('view-deleted').style.display = 'none';
    loadProjects();
}

function loadSJByProject(projectId, projectName) {
    currentProjectId = projectId;
    currentProjectName = projectName;

    document.getElementById('view-projects').style.display = 'none';
    document.getElementById('view-sj-table').style.display = '';
    document.getElementById('view-deleted').style.display = 'none';

    document.getElementById('breadcrumbProjectName').textContent = projectName;

    // Update "Buat Baru" link to pre-select this project
    const btnBuat = document.getElementById('btnBuatBaruProject');
    if (btnBuat) {
        btnBuat.href = projectId === 'none' ? 'form_sj.html' : `form_sj.html?project_id=${projectId}`;
    }

    // Show/hide rename+delete buttons (hide for "Tanpa Project")
    const user = getUser();
    const isAdmin = user && user.role === 'admin';
    const btnRename = document.getElementById('btnRenameProject');
    const btnDelete = document.getElementById('btnDeleteProject');
    if (btnRename) btnRename.style.display = (isAdmin && projectId !== 'none') ? '' : 'none';
    if (btnDelete) btnDelete.style.display = (isAdmin && projectId !== 'none') ? '' : 'none';

    // Build the API URL with filter
    let url = `${API_URL}/surat-jalan`;
    if (projectId === 'none') {
        url += '?unassigned=true';
    } else {
        url += `?project_id=${projectId}`;
    }

    const tbody = document.getElementById('sjTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Memuat...</td></tr>';

    fetch(url, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
            if (!tbody) return;
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>Belum ada Surat Jalan di folder ini.</td></tr>`;
                return;
            }
            data.forEach(sj => {
                const tr = document.createElement('tr');
                let statusBadge = '';
                if (sj.status === 'PENDING') statusBadge = '<span class="badge bg-warning text-dark">PENDING</span>';
                else if (sj.status === 'APPROVED') statusBadge = '<span class="badge bg-success">APPROVED</span>';
                else statusBadge = `<span class="badge bg-danger">${sj.status}</span>`;

                let aksi = `<a href="print_sj.html?id=${sj.id}" class="btn btn-sm btn-outline-info shadow-sm rounded-pill px-3 me-1 mb-1"><i class="bi bi-eye"></i> Detail</a>`;
                if (sj.status === 'APPROVED') {
                    aksi += `<a href="print_sj.html?id=${sj.id}&print=1" class="btn btn-sm btn-outline-dark shadow-sm rounded-pill px-3 mb-1"><i class="bi bi-printer"></i> Cetak</a>`;
                } else if (sj.status === 'PENDING' && isAdmin) {
                    aksi += `
                        <button class="btn btn-sm btn-success shadow-sm rounded-pill px-3 me-1 mb-1" onclick="approveSuratJalan(${sj.id})"><i class="bi bi-check-circle"></i> Approve</button>
                        <button class="btn btn-sm btn-danger shadow-sm rounded-pill px-3 mb-1" onclick="rejectSuratJalan(${sj.id})"><i class="bi bi-x-circle"></i> Deny</button>
                    `;
                }
                if (isAdmin) {
                    aksi += `<button class="btn btn-sm btn-outline-danger shadow-sm rounded-pill px-3 mb-1 ms-1" onclick="deleteSuratJalan(${sj.id})"><i class="bi bi-trash"></i></button>`;
                }

                tr.innerHTML = `
                    <td class="fw-bold text-primary">${sj.no_surat_jalan}</td>
                    <td>${sj.tanggal}</td>
                    <td>${sj.tujuan}</td>
                    <td><i class="bi bi-person me-1 text-muted"></i>${sj.creator || '-'}</td>
                    <td>${statusBadge}</td>
                    <td class="text-end">${aksi}</td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Gagal memuat data.</td></tr>';
        });
}

function deleteSuratJalan(id) {
    if (!confirm('Yakin ingin menghapus Surat Jalan ini? Data akan tersimpan di Arsip Terhapus.')) return;
    fetch(`${API_URL}/surat-jalan/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) alert('Gagal: ' + data.error);
        else refreshCurrentSJList();
    })
    .catch(err => alert('Kesalahan koneksi.'));
}

function showDeletedView() {
    document.getElementById('view-projects').style.display = 'none';
    document.getElementById('view-sj-table').style.display = 'none';
    document.getElementById('view-deleted').style.display = '';

    const tbody = document.getElementById('deletedSjTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Memuat...</td></tr>';

    fetch(`${API_URL}/surat-jalan/deleted`, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
            if (!tbody) return;
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted"><i class="bi bi-check-circle fs-3 d-block mb-2"></i>Belum ada Surat Jalan yang terhapus.</td></tr>';
                return;
            }
            data.forEach(sj => {
                const deletedDate = sj.deleted_at ? new Date(sj.deleted_at).toLocaleString('id-ID') : '-';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="fw-bold text-secondary">${sj.no_surat_jalan}</td>
                    <td>${sj.tanggal}</td>
                    <td>${sj.tujuan}</td>
                    <td>${sj.project_name || '<em class="text-muted">Tanpa Project</em>'}</td>
                    <td>${sj.deleted_by_name || '-'}</td>
                    <td><small>${deletedDate}</small></td>
                    <td class="text-end">
                        <a href="print_sj.html?id=${sj.id}" class="btn btn-sm btn-outline-secondary shadow-sm rounded-pill px-3">
                            <i class="bi bi-eye"></i> Preview
                        </a>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(() => {
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-danger text-center py-4">Gagal memuat arsip.</td></tr>';
        });
}

// Project modal state
let _editingProjectId = null;

function openAddProjectModal() {
    _editingProjectId = null;
    document.getElementById('projectModalTitle').textContent = 'Tambah Folder Project';
    document.getElementById('projectNameInput').value = '';
    document.getElementById('projectModalError').style.display = 'none';
    new bootstrap.Modal(document.getElementById('projectModal')).show();
}

function openRenameProjectModal(id, name) {
    _editingProjectId = id;
    document.getElementById('projectModalTitle').textContent = 'Rename Folder';
    document.getElementById('projectNameInput').value = name;
    document.getElementById('projectModalError').style.display = 'none';
    new bootstrap.Modal(document.getElementById('projectModal')).show();
}

function saveProject() {
    const name = document.getElementById('projectNameInput').value.trim();
    const errEl = document.getElementById('projectModalError');
    if (!name) { errEl.textContent = 'Nama project tidak boleh kosong.'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';

    const isEdit = !!_editingProjectId;
    const url = isEdit ? `${API_URL}/projects/${_editingProjectId}` : `${API_URL}/projects`;
    const method = isEdit ? 'PUT' : 'POST';

    const btn = document.getElementById('projectModalSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify({ name }) })
        .then(res => res.json())
        .then(data => {
            btn.disabled = false;
            btn.innerHTML = 'Simpan';
            if (data.error) {
                errEl.textContent = data.error;
                errEl.style.display = 'block';
            } else {
                bootstrap.Modal.getInstance(document.getElementById('projectModal')).hide();
                // Update current breadcrumb if renaming
                if (isEdit && currentProjectId == _editingProjectId) {
                    currentProjectName = name;
                    document.getElementById('breadcrumbProjectName').textContent = name;
                }
                loadProjects();
                if (document.getElementById('view-sj-table').style.display !== 'none') {
                    loadSJByProject(currentProjectId, currentProjectName);
                }
            }
        })
        .catch(() => { btn.disabled = false; btn.innerHTML = 'Simpan'; errEl.textContent = 'Kesalahan koneksi.'; errEl.style.display = 'block'; });
}

function deleteProject(id, name) {
    if (!confirm(`Hapus folder "${name}"?\n\nFolder hanya dapat dihapus jika tidak ada Surat Jalan aktif di dalamnya.`)) return;
    fetch(`${API_URL}/projects/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
            if (data.error) alert(data.error);
            else loadProjects();
        })
        .catch(() => alert('Kesalahan koneksi.'));
}

function deleteCurrentProject() {
    if (currentProjectId && currentProjectId !== 'none') {
        deleteProject(currentProjectId, currentProjectName);
        if (document.getElementById('view-sj-table').style.display !== 'none') {
            showProjectGrid();
        }
    }
}

function populateProjectDropdown() {
    const sel = document.getElementById('sjProjectId');
    if (!sel) return;
    fetch(`${API_URL}/projects`, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(projects => {
            sel.innerHTML = '<option value="">— Tanpa Project —</option>';
            projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                sel.appendChild(opt);
            });
        })
        .catch(() => {});
}


// --- Buat Surat Jalan Logic Form (form_sj.html) ---

function initSuratJalanForm() {
    fetch(`${API_URL}/barang`, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
            masterBarang = data;
            addBarangRow();
        });
}

function getBarangOptionsHTML() {
    // kept for backwards compat but no longer used by addBarangRow
    let options = '<option value="" disabled selected>-- Pilih Barang --</option>';
    masterBarang.forEach(b => {
        options += `<option value="${b.id}">${b.sku} - ${b.nama_barang}</option>`;
    });
    return options;
}

function addBarangRow() {
    const tbody = document.getElementById('sjItemList');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = 'fade-in row-item';
    tr.dataset.type = 'item';

    // Build a unique id for each select so TomSelect can target it
    const uid = 'ts-barang-' + Date.now() + '-' + Math.random().toString(36).slice(2);

    tr.innerHTML = `
        <td class="pb-3 ps-4 align-top">
            <select id="${uid}" class="sj-barang" required>
                <option value="">-- Pilih Barang --</option>
                ${masterBarang.map(b => `<option value="${b.id}">${b.sku} — ${b.nama_barang}</option>`).join('')}
            </select>
        </td>
        <td class="pb-3 align-top">
            <input type="number" class="form-control sj-qty" min="1" value="1" required>
        </td>
        <td class="pb-3 align-top">
            <input type="text" class="form-control sj-remark" placeholder="Remark">
        </td>
        <td class="text-center pb-3 align-top">
            <button type="button" class="btn btn-outline-danger shadow-sm rounded px-3" onclick="this.closest('tr').remove()"><i class="bi bi-x-lg"></i></button>
        </td>
    `;
    tbody.appendChild(tr);

    // Init Tom Select on the newly appended select
    new TomSelect(`#${uid}`, {
        maxOptions: 100,
        placeholder: 'Cari SKU atau nama barang...',
        dropdownParent: 'body',
        render: {
            option: (data, escape) => {
                const parts = data.text.split(' — ');
                const sku  = parts[0] || '';
                const nama = parts.slice(1).join(' — ') || data.text;
                return `<div class="d-flex align-items-center gap-2">
                    <span class="badge bg-secondary" style="font-size:0.7rem;white-space:nowrap">${escape(sku)}</span>
                    <span>${escape(nama)}</span>
                </div>`;
            },
            item: (data, escape) => `<div>${escape(data.text)}</div>`
        }
    });
}

function addGroupRow() {
    const tbody = document.getElementById('sjItemList');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = 'fade-in row-item';
    tr.dataset.type = 'group_title';
    
    tr.innerHTML = `
        <td colspan="3" class="pb-3 pt-3">
            <div class="input-group">
                <span class="input-group-text bg-light text-dark fw-bold">Judul Grup Barang</span>
                <input type="text" class="form-control sj-group-text" placeholder="Contoh: 23 x Plastic Box consist of:" required>
            </div>
        </td>
        <td class="text-center pb-3 pt-3">
            <button type="button" class="btn btn-outline-danger shadow-sm rounded px-3" onclick="this.closest('tr').remove()"><i class="bi bi-x-lg"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
}

function submitSuratJalan(e) {
    e.preventDefault();
    
    const payload = {
        manual_no: document.getElementById('sjNo') ? document.getElementById('sjNo').value : '',
        tanggal: document.getElementById('sjTanggal') ? document.getElementById('sjTanggal').value : '',
        tujuan: document.getElementById('sjTujuan') ? document.getElementById('sjTujuan').value : '',
        attn: document.getElementById('sjAttn') ? document.getElementById('sjAttn').value : '',
        phone_header: document.getElementById('sjPhoneHeader') ? document.getElementById('sjPhoneHeader').value : '',
        note: document.getElementById('sjNote') ? document.getElementById('sjNote').value : '',
        taken_by: document.getElementById('sjTakenBy') ? document.getElementById('sjTakenBy').value : '',
        vehicle_no: document.getElementById('sjVehicleNo') ? document.getElementById('sjVehicleNo').value : '',
        phone_footer: document.getElementById('sjPhoneFooter') ? document.getElementById('sjPhoneFooter').value : '',
        eta: document.getElementById('sjEta') ? document.getElementById('sjEta').value : '',
        foreman: document.getElementById('sjForeman') ? document.getElementById('sjForeman').value : '',
        woc: document.getElementById('sjWoc') ? document.getElementById('sjWoc').value : '',
        project_id: document.getElementById('sjProjectId') ? (document.getElementById('sjProjectId').value || null) : null,
        items: []
    };

    const rowElements = document.querySelectorAll('#sjItemList .row-item');
    rowElements.forEach(row => {
        const type = row.dataset.type;
        if (type === 'group_title') {
            const text = row.querySelector('.sj-group-text').value;
            if(text) payload.items.push({ type: 'group_title', text });
        } else if (type === 'item') {
            const barang_id = row.querySelector('.sj-barang').value;
            const qty = row.querySelector('.sj-qty').value;
            const remark = row.querySelector('.sj-remark').value;
            if (barang_id && qty) {
                payload.items.push({ type: 'item', id: parseInt(barang_id), qty: parseInt(qty), remark });
            }
        }
    });

    if (payload.items.length === 0) {
        alert("Silakan tambah minimal 1 item atau grup barang.");
        return;
    }

    fetch(`${API_URL}/surat-jalan`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(result => {
        if(result.error) {
            alert('Gagal buat Surat Jalan: ' + result.error);
        } else {
            const user = getUser();
            if (user && user.role === 'admin') {
                alert("Sukses. Surat Jalan diajukan: " + result.no_surat_jalan + ".");
            } else {
                alert("Sukses. Surat Jalan diajukan: " + result.no_surat_jalan + ". Menunggu Approval Admin.");
            }
            window.location.href = 'list_sj.html';
        }
    })
    .catch(err => {
        console.error('Submit error:', err);
        alert('Terjadi kesalahan koneksi.');
    });
}


// --- Excel Import Logic (index.html) ---

let _importFile = null;

function resetImport() {
    _importFile = null;
    const fileInput = document.getElementById('excelFileInput');
    if (fileInput) fileInput.value = '';
    document.getElementById('importFilePreview')?.classList.add('d-none');
    document.getElementById('importProgress')?.classList.add('d-none');
    const resultEl = document.getElementById('importResult');
    if (resultEl) { resultEl.classList.add('d-none'); resultEl.innerHTML = ''; }
    const btn = document.getElementById('importSubmitBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-upload me-2"></i>Mulai Import'; }
    const dz = document.getElementById('importDropZone');
    if (dz) { dz.style.borderColor = '#ced4da'; dz.style.background = '#f8f9fa'; }
}

function handleFileSelect(file) {
    if (!file) return;
    const validExts = /\.(xlsx|xls)$/i;
    if (!validExts.test(file.name)) {
        alert('Hanya file Excel (.xlsx atau .xls) yang diperbolehkan.');
        return;
    }
    if (file.size > 100 * 1024 * 1024) {
        alert('Ukuran file melebihi batas 100 MB.');
        return;
    }
    _importFile = file;
    document.getElementById('importFileName').textContent = file.name;
    document.getElementById('importFileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';
    document.getElementById('importFilePreview').classList.remove('d-none');
    document.getElementById('importResult').classList.add('d-none');
    document.getElementById('importResult').innerHTML = '';
    document.getElementById('importProgress').classList.add('d-none');
    const btn = document.getElementById('importSubmitBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-upload me-2"></i>Mulai Import'; }
}

function clearImportFile() {
    resetImport();
}

function downloadTemplate() {
    const rows = [
        ['sku', 'nama_barang', 'satuan'],
        ['BRG-001', 'Contoh Barang 1', 'Pcs'],
        ['BRG-002', 'Contoh Barang 2', 'Box'],
    ];
    if (window.XLSX) {
        const ws = window.XLSX.utils.aoa_to_sheet(rows);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, 'Master Barang');
        window.XLSX.writeFile(wb, 'template_master_barang.xlsx');
    } else {
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'template_master_barang.csv';
        a.click();
    }
}

function submitImport() {
    if (!_importFile) { alert('Pilih file terlebih dahulu.'); return; }

    const btn = document.getElementById('importSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Memproses...';
    document.getElementById('importProgress').classList.remove('d-none');
    document.getElementById('importResult').classList.add('d-none');

    const user = getUser();
    const formData = new FormData();
    formData.append('file', _importFile);

    fetch(`${API_URL}/barang/import`, {
        method: 'POST',
        headers: { 'x-role': user.role, 'x-user-id': user.id.toString() },
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('importProgress').classList.add('d-none');
        const resultEl = document.getElementById('importResult');
        resultEl.classList.remove('d-none');

        if (data.error) {
            resultEl.innerHTML = `
                <div class="alert alert-danger d-flex gap-2 align-items-start">
                    <i class="bi bi-x-circle-fill mt-1"></i>
                    <div><strong>Gagal:</strong> ${data.error}</div>
                </div>`;
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-upload me-2"></i>Coba Lagi';
        } else {
            let errorRows = '';
            if (data.errors && data.errors.length > 0) {
                const errList = data.errors.map(e => `<li>Baris ${e.row} (${e.sku}): ${e.reason}</li>`).join('');
                errorRows = `<div class="mt-2 small text-danger"><strong>Detail error:</strong><ul class="mb-0">${errList}</ul></div>`;
            }
            resultEl.innerHTML = `
                <div class="alert alert-success d-flex gap-2 align-items-start mb-0">
                    <i class="bi bi-check-circle-fill mt-1 flex-shrink-0"></i>
                    <div>
                        <strong>Import Selesai!</strong><br>
                        <span class="text-success fw-semibold">${data.inserted} data berhasil ditambahkan</span> &bull;
                        <span class="text-muted">${data.skipped} data dilewati (SKU duplikat)</span>
                        ${errorRows}
                    </div>
                </div>`;
            btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Selesai';
            loadBarang();
        }
    })
    .catch(err => {
        document.getElementById('importProgress').classList.add('d-none');
        const resultEl = document.getElementById('importResult');
        resultEl.classList.remove('d-none');
        resultEl.innerHTML = `<div class="alert alert-danger"><i class="bi bi-x-circle-fill me-2"></i>Kesalahan koneksi: ${err.message}</div>`;
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-upload me-2"></i>Coba Lagi';
    });
}
