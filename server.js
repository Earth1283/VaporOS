const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4567;
const VIRTUAL_DRIVE_ROOT = path.join(__dirname, 'virtual_drive');

app.use(express.static('public'));
app.use(bodyParser.json());

// Helper to resolve and validate path
const resolvePath = (userPath) => {
    const safePath = path.normalize(userPath).replace(/^(\.\.[/\\])+/, '');
    const fullPath = path.join(VIRTUAL_DRIVE_ROOT, safePath);
    if (!fullPath.startsWith(VIRTUAL_DRIVE_ROOT)) {
        throw new Error('Access denied');
    }
    return fullPath;
};

// List directory
app.get('/api/fs/list', (req, res) => {
    try {
        const dirPath = resolvePath(req.query.path || '/');
        if (!fs.existsSync(dirPath)) {
             return res.status(404).json({ error: 'Directory not found' });
        }
        const files = fs.readdirSync(dirPath, { withFileTypes: true }).map(dirent => ({
            name: dirent.name,
            isDirectory: dirent.isDirectory(),
            size: dirent.isDirectory() ? 0 : fs.statSync(path.join(dirPath, dirent.name)).size
        }));
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Read file
app.get('/api/fs/read', (req, res) => {
    try {
        const filePath = resolvePath(req.query.path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Write file
app.post('/api/fs/write', (req, res) => {
    try {
        const filePath = resolvePath(req.body.path);
        fs.writeFileSync(filePath, req.body.content);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete file/directory
app.delete('/api/fs/delete', (req, res) => {
    try {
        const targetPath = resolvePath(req.query.path);
        if (fs.statSync(targetPath).isDirectory()) {
            fs.rmdirSync(targetPath, { recursive: true });
        } else {
            fs.unlinkSync(targetPath);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create directory
app.post('/api/fs/mkdir', (req, res) => {
    console.log('MKDIR request for:', req.body.path);
    try {
        const dirPath = resolvePath(req.body.path);
        console.log('Resolved path:', dirPath);
        if (!fs.existsSync(dirPath)) {
            console.log('Creating directory...');
            fs.mkdirSync(dirPath, { recursive: true });
        } else {
            console.log('Directory already exists');
        }
        res.json({ success: true });
    } catch (err) {
        console.error('MKDIR Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Virtual OS running at http://localhost:${PORT}`);
});
