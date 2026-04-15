const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        db.serialize(() => {
            // users
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL
            )`, (err) => {
                if (err) console.error("Error creating users:", err);
                else {
                    // Seed initial users
                    db.get("SELECT count(*) as count FROM users", (err, row) => {
                        if(row.count === 0) {
                            db.run("INSERT INTO users (username, password, role) VALUES ('admin', '123', 'admin')");
                            db.run("INSERT INTO users (username, password, role) VALUES ('staff', '123', 'staff')");
                        }
                    });
                }
            });

            // master_barang
            db.run(`CREATE TABLE IF NOT EXISTS master_barang (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT UNIQUE NOT NULL,
                nama_barang TEXT NOT NULL,
                satuan TEXT NOT NULL
            )`, (err) => {
                if (err) console.error("Error creating master_barang:", err);
            });

            // surat_jalan
            db.run(`CREATE TABLE IF NOT EXISTS surat_jalan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                no_surat_jalan TEXT UNIQUE NOT NULL,
                tanggal TEXT NOT NULL,
                tujuan TEXT NOT NULL,
                attn TEXT,
                phone_header TEXT,
                note TEXT,
                taken_by TEXT,
                vehicle_no TEXT,
                phone_footer TEXT,
                eta TEXT,
                foreman TEXT,
                woc TEXT,
                status TEXT DEFAULT 'PENDING',
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`, (err) => {
                if (err) console.error("Error creating surat_jalan:", err);
            });

            // detail_surat_jalan (Supports row grouping and ordering)
            db.run(`CREATE TABLE IF NOT EXISTS detail_surat_jalan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                surat_jalan_id INTEGER NOT NULL,
                type TEXT NOT NULL,           -- 'item' or 'group_title'
                group_title_text TEXT,        -- Used if type is 'group_title'
                barang_id INTEGER,            -- Used if type is 'item'
                qty INTEGER,                  -- Used if type is 'item'
                remark TEXT,                  -- Used if type is 'item'
                order_index INTEGER NOT NULL, -- To keep sequence intact
                FOREIGN KEY (surat_jalan_id) REFERENCES surat_jalan (id) ON DELETE CASCADE,
                FOREIGN KEY (barang_id) REFERENCES master_barang (id)
            )`, (err) => {
                if (err) console.error("Error creating detail_surat_jalan:", err);
            });
        });
    }
});

module.exports = db;
