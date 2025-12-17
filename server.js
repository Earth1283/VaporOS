const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

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

// Proxy Endpoint
app.get('/api/proxy', (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('URL parameter is required');
    }

    try {
        const parsedUrl = new URL(targetUrl);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {}
        };

        // Forward headers from client to target
        const headersToForward = ['user-agent', 'cookie', 'accept', 'accept-language'];
        headersToForward.forEach(header => {
            if (req.headers[header]) {
                options.headers[header] = req.headers[header];
            }
        });
        
        // Ensure we don't ask for compression since we manipulate HTML strings
        delete options.headers['accept-encoding'];

        const proxyReq = protocol.request(options, (proxyRes) => {
            // Handle Redirects
            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                return res.redirect('/api/proxy?url=' + encodeURIComponent(new URL(proxyRes.headers.location, targetUrl).toString()));
            }

            // Copy headers from target to client
            Object.keys(proxyRes.headers).forEach(key => {
                // Remove content-encoding if we are decoding (node http does auto decoding if we don't send accept-encoding? No, it just gives raw stream. 
                // If server sends gzip anyway, we are in trouble if we try to modify HTML. 
                // But usually servers respect missing Accept-Encoding.
                if (key !== 'content-encoding' && key !== 'x-frame-options' && key !== 'content-security-policy') {
                     res.setHeader(key, proxyRes.headers[key]);
                }
            });

            // If HTML, rewrite links
            const contentType = proxyRes.headers['content-type'] || '';
            if (contentType.includes('text/html')) {
                let data = '';
                proxyRes.on('data', chunk => data += chunk);
                proxyRes.on('end', () => {
                    // Regex to find src, href, action
                    // This is a naive implementation and might break on complex scripts or escaped quotes
                    const modifiedData = data.replace(/(href|src|action)\s*=\s*(['"])(.*?)\2/gi, (match, attr, quote, url) => {
                        try {
                            // Ignore data: URLs, anchors, etc
                            if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('javascript:')) {
                                return match;
                            }
                            const absoluteUrl = new URL(url, targetUrl).href;
                            const proxyUrl = '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                            return `${attr}=${quote}${proxyUrl}${quote}`;
                        } catch (e) {
                            return match; // Keep original if resolution fails
                        }
                    });
                    
                    res.send(modifiedData);
                });
            } else {
                // Pipe other content directly
                proxyRes.pipe(res);
            }
        });

        proxyReq.on('error', (err) => {
            res.status(500).send('Proxy error: ' + err.message);
        });
        
        proxyReq.end();

    } catch (err) {
        res.status(400).send('Invalid URL: ' + err.message);
    }
});

app.listen(PORT, () => {
    console.log(`Virtual OS running at http://localhost:${PORT}`);
});
