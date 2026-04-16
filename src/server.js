const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer — store excel in memory, max 100 MB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/octet-stream'
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file Excel (.xlsx / .xls) yang diperbolehkan.'));
        }
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Middleware simple role check (mocking JWT for local app)
const requireAdmin = (req, res, next) => {
    const role = req.headers['x-role'];
    if (role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak. Membutuhkan Role Admin.' });
    }
    next();
};

// --- AUTH ROUTES ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT id, username, role FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Username atau password salah!' });
        res.json({ message: 'Login sukses', user: row });
    });
});

// --- MASTER BARANG ROUTES ---

// Import Master Barang from Excel
app.post('/api/barang/import', requireAdmin, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
    }

    let workbook;
    try {
        workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch (e) {
        return res.status(400).json({ error: 'File Excel tidak valid atau rusak.' });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
        return res.status(400).json({ error: 'Sheet pertama kosong atau tidak memiliki data.' });
    }

    // Normalise header names (case-insensitive)
    const normalise = (obj) => {
        const out = {};
        Object.keys(obj).forEach(k => { out[k.toLowerCase().trim()] = String(obj[k]).trim(); });
        return out;
    };

    const items = rows.map(normalise).filter(r => r.sku && r.nama_barang && r.satuan);

    if (items.length === 0) {
        return res.status(400).json({
            error: 'Tidak ada baris valid. Pastikan header kolom adalah: sku, nama_barang, satuan'
        });
    }

    let inserted = 0;
    let skipped = 0;
    let errors = [];
    let processed = 0;

    const stmt = db.prepare(
        'INSERT OR IGNORE INTO master_barang (sku, nama_barang, satuan) VALUES (?, ?, ?)'
    );

    items.forEach((item, idx) => {
        stmt.run(item.sku, item.nama_barang, item.satuan, function (err) {
            if (err) {
                errors.push({ row: idx + 2, sku: item.sku, reason: err.message });
            } else if (this.changes === 0) {
                skipped++;
            } else {
                inserted++;
            }
            processed++;
            if (processed === items.length) {
                stmt.finalize();
                res.json({
                    message: `Import selesai. ${inserted} data berhasil ditambahkan, ${skipped} data dilewati (SKU duplikat).`,
                    inserted,
                    skipped,
                    errors
                });
            }
        });
    });
});


app.get('/api/barang', (req, res) => {
    db.all('SELECT * FROM master_barang', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/barang', requireAdmin, (req, res) => {
    const { sku, nama_barang, satuan } = req.body;
    db.run(
        'INSERT INTO master_barang (sku, nama_barang, satuan) VALUES (?, ?, ?)',
        [sku, nama_barang, satuan],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, sku, nama_barang, satuan });
        }
    );
});

app.put('/api/barang/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { sku, nama_barang, satuan } = req.body;
    db.run(
        'UPDATE master_barang SET sku = ?, nama_barang = ?, satuan = ? WHERE id = ?',
        [sku, nama_barang, satuan, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Barang updated', changes: this.changes });
        }
    );
});

app.delete('/api/barang/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM master_barang WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Barang deleted', changes: this.changes });
    });
});

// --- PROJECT ROUTES ---

app.get('/api/projects', (req, res) => {
    db.all(`
        SELECT p.*, COUNT(CASE WHEN s.deleted_at IS NULL THEN 1 END) as sj_count
        FROM projects p
        LEFT JOIN surat_jalan s ON s.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at ASC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/projects', requireAdmin, (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nama project tidak boleh kosong.' });
    db.run('INSERT INTO projects (name) VALUES (?)', [name.trim()], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: `Project "${name.trim()}" sudah ada.` });
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, name: name.trim(), sj_count: 0 });
    });
});

app.put('/api/projects/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nama project tidak boleh kosong.' });
    db.run('UPDATE projects SET name = ? WHERE id = ?', [name.trim(), id], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: `Project "${name.trim()}" sudah ada.` });
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Project berhasil diubah', changes: this.changes });
    });
});

app.delete('/api/projects/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    db.get('SELECT COUNT(*) as count FROM surat_jalan WHERE project_id = ? AND deleted_at IS NULL', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count > 0) {
            return res.status(400).json({ error: `Folder tidak dapat dihapus karena masih memiliki ${row.count} Surat Jalan aktif.` });
        }
        db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Project berhasil dihapus', changes: this.changes });
        });
    });
});

// --- SURAT JALAN ROUTES ---

app.post('/api/surat-jalan', (req, res) => {
    const { 
        manual_no, tanggal, tujuan, attn, phone_header, note, 
        taken_by, vehicle_no, phone_footer, eta, foreman, woc, 
        items, project_id
    } = req.body;
    
    const userId = req.headers['x-user-id'] || null;
    const role = req.headers['x-role'];
    const initialStatus = role === 'admin' ? 'APPROVED' : 'PENDING';

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    
    // Suffix format for BAUER
    const suffix = `/${mm}/BPI/${yyyy}`;

    db.get('SELECT no_surat_jalan FROM surat_jalan WHERE no_surat_jalan LIKE ? ORDER BY CAST(no_surat_jalan AS INTEGER) DESC LIMIT 1', [`%${suffix}`], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        let no_surat_jalan = manual_no;
        if (!no_surat_jalan || no_surat_jalan.trim() === '') {
            let nextNum = 1;
            if (row && row.no_surat_jalan) {
                const parts = row.no_surat_jalan.split(' ');
                if (parts.length > 0) {
                    const lastNum = parseInt(parts[0], 10);
                    if (!isNaN(lastNum)) {
                        nextNum = lastNum + 1;
                    }
                }
            }
            no_surat_jalan = `${String(nextNum).padStart(3, '0')} ${suffix}`;
        } else {
            // Manual number entered — check if it already exists using callback
            no_surat_jalan = no_surat_jalan.trim();
            db.get('SELECT id FROM surat_jalan WHERE no_surat_jalan = ?', [no_surat_jalan], (err, existing) => {
                if (err) return res.status(500).json({ error: err.message });
                if (existing) {
                    return res.status(400).json({ error: `No. Surat Jalan "${no_surat_jalan}" sudah ada di database. Gunakan nomor yang berbeda.` });
                }
                insertSuratJalan(no_surat_jalan);
            });
            return; // wait for callback
        }

        insertSuratJalan(no_surat_jalan);
    });

    function insertSuratJalan(no_surat_jalan) {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.run(
                `INSERT INTO surat_jalan (no_surat_jalan, tanggal, tujuan, attn, phone_header, note, taken_by, vehicle_no, phone_footer, eta, foreman, woc, user_id, status, project_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [no_surat_jalan, tanggal, tujuan, attn, phone_header, note, taken_by, vehicle_no, phone_footer, eta, foreman, woc, userId, initialStatus, project_id || null],
                function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    const surat_jalan_id = this.lastID;
                    const stmt = db.prepare(`INSERT INTO detail_surat_jalan (surat_jalan_id, type, group_title_text, barang_id, qty, remark, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                    
                    items.forEach((item, index) => {
                        let type = item.type || 'item';
                        let group_text = type === 'group_title' ? item.text : null;
                        let b_id = type === 'item' ? item.id : null;
                        let qty = type === 'item' ? item.qty : null;
                        let remark = type === 'item' ? item.remark : null;
                        
                        stmt.run(surat_jalan_id, type, group_text, b_id, qty, remark, index);
                    });
                    
                    stmt.finalize((err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }
                        db.run('COMMIT', (err) => {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({ message: 'Surat Jalan created success', surat_jalan_id, no_surat_jalan });
                        });
                    });
                }
            );
        });
    }
});

// Approval / Reject Status
app.put('/api/surat-jalan/:id/status', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ error: 'Status tidak valid' });
    }
    db.run('UPDATE surat_jalan SET status = ? WHERE id = ? AND deleted_at IS NULL', [status, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Status surat jalan berhasil diubah', changes: this.changes });
    });
});

// Get deleted SJ (admin only — must be before /:id route)
app.get('/api/surat-jalan/deleted', requireAdmin, (req, res) => {
    db.all(`
        SELECT s.*, u.username as creator, d.username as deleted_by_name, p.name as project_name
        FROM surat_jalan s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN users d ON s.deleted_by = d.id
        LEFT JOIN projects p ON s.project_id = p.id
        WHERE s.deleted_at IS NOT NULL
        ORDER BY s.deleted_at DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/surat-jalan/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM surat_jalan WHERE id = ?', [id], (err, suratJalan) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!suratJalan) return res.status(404).json({ error: 'Surat Jalan not found' });
        db.all(
            `SELECT d.*, m.sku, m.nama_barang, m.satuan 
             FROM detail_surat_jalan d
             LEFT JOIN master_barang m ON d.barang_id = m.id
             WHERE d.surat_jalan_id = ?
             ORDER BY d.order_index ASC`,
            [id],
            (err, items) => {
                if (err) return res.status(500).json({ error: err.message });
                suratJalan.items = items;
                res.json(suratJalan);
            }
        );
    });
});

app.get('/api/surat-jalan', (req, res) => {
    const role = req.headers['x-role'];
    const userId = req.headers['x-user-id'];
    const projectId = req.query.project_id; // optional filter
    const unassigned = req.query.unassigned; // 'true' for SJ without project

    let query = `
        SELECT s.*, u.username as creator, p.name as project_name
        FROM surat_jalan s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN projects p ON s.project_id = p.id
        WHERE s.deleted_at IS NULL
    `;
    let params = [];

    if (projectId) {
        query += ' AND s.project_id = ?';
        params.push(projectId);
    } else if (unassigned === 'true') {
        query += ' AND s.project_id IS NULL';
    }

    if (role !== 'admin') {
        query += ' AND s.user_id = ?';
        params.push(userId);
    }

    query += ' ORDER BY s.id DESC';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Soft delete SJ (admin only)
app.delete('/api/surat-jalan/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    const now = new Date().toISOString();
    db.run(
        'UPDATE surat_jalan SET deleted_at = ?, deleted_by = ? WHERE id = ? AND deleted_at IS NULL',
        [now, userId, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Surat Jalan tidak ditemukan atau sudah dihapus.' });
            res.json({ message: 'Surat Jalan berhasil dihapus (soft delete)', changes: this.changes });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
