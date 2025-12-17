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

const proxy = require('express-http-proxy');

// ... existing code ...

// Proxy Endpoint using express-http-proxy
app.use('/api/proxy', (req, res, next) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('URL parameter is required');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (err) {
        return res.status(400).send('Invalid URL: ' + err.message);
    }

    proxy(parsedUrl.origin, {
        proxyReqPathResolver: (req) => {
            // Reconstruct the target path + query
            // Start with the path provided in the 'url' param
            let targetPath = parsedUrl.pathname + parsedUrl.search;

            // Handle extra query params (e.g. from search forms)
            const extraParams = new URLSearchParams();
            Object.keys(req.query).forEach(key => {
                if (key !== 'url') {
                    extraParams.append(key, req.query[key]);
                }
            });

            if (extraParams.toString()) {
                const separator = targetPath.includes('?') ? '&' : '?';
                targetPath += separator + extraParams.toString();
            }
            
            return targetPath;
        },
        userResHeaderDecorator(headers, userReq, userRes, proxyReq, proxyRes) {
            // Handle Redirects: Rewrite location header to point back to proxy
            if (headers['location']) {
                try {
                    const absoluteRedirect = new URL(headers['location'], targetUrl).href;
                    headers['location'] = '/api/proxy?url=' + encodeURIComponent(absoluteRedirect);
                } catch(e) {}
            }
            // Remove CSP and framing options to allow embedding
            delete headers['content-security-policy'];
            delete headers['x-frame-options'];
            return headers;
        },
        userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
            const contentType = userRes.get('Content-Type') || '';
            
            if (contentType.includes('text/html')) {
                let html = proxyResData.toString('utf8');
                
                // 1. Basic Regex Replacement
                html = html.replace(/(href|src|action)\s*=\s*(['"])(.*?)\2/gi, (match, attr, quote, url) => {
                    try {
                        if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:')) {
                            return match;
                        }
                        const absoluteUrl = new URL(url, targetUrl).href;
                        const proxyUrl = '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                        return `${attr}=${quote}${proxyUrl}${quote}`;
                    } catch (e) {
                        return match;
                    }
                });

                // 2. Inject Proxy Helper Script
                const scriptTag = '<script src="/js/proxy-helper.js"></script>';
                if (html.includes('</body>')) {
                    html = html.replace('</body>', scriptTag + '</body>');
                } else {
                    html += scriptTag;
                }
                
                return html;
            }
            
            return proxyResData;
        },
        // handle errors
        proxyErrorHandler: (err, res, next) => {
             res.status(500).send('Proxy Error: ' + err.message);
        }
    })(req, res, next);
});

app.listen(PORT, () => {
    console.log(`Virtual OS running at http://localhost:${PORT}`);
});
