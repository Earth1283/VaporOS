
// This script is injected by the proxy to handle navigation within the virtual browser
(function() {
    console.log('Proxy Helper Loaded');

    function getProxyUrl(targetUrl) {
        if (!targetUrl) return '';
        // If already proxied, leave it (simple check)
        if (targetUrl.includes('/api/proxy?url=')) return targetUrl;
        
        // Handle absolute vs relative
        let fullUrl;
        try {
            fullUrl = new URL(targetUrl, window.location.href).href;
        } catch (e) {
            return targetUrl;
        }

        // We need to extract the "real" current URL to resolve relative paths correctly
        // The window.location is .../api/proxy?url=REAL_URL
        const currentUrlParams = new URLSearchParams(window.location.search);
        const realCurrentUrl = currentUrlParams.get('url');
        
        if (realCurrentUrl) {
            try {
                // Resolve target relative to the REAL current URL
                fullUrl = new URL(targetUrl, realCurrentUrl).href;
            } catch (e) {
                console.warn('Failed to resolve URL:', targetUrl, e);
            }
        }

        return '/api/proxy?url=' + encodeURIComponent(fullUrl);
    }

    // Intercept Link Clicks
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (link && link.href) {
            // Check if it's already pointing to proxy
            if (link.href.includes('/api/proxy')) return;

            // Stop default and manually navigate via proxy
            e.preventDefault();
            const originalHref = link.getAttribute('href'); // Get raw attribute to avoid browser resolving to localhost
            
            // Special handling: anchors, javascript:, mailto:
            if (originalHref.startsWith('#') || originalHref.startsWith('javascript:') || originalHref.startsWith('mailto:')) {
                // Let these function normally (though javascript: might fail due to CSP/sandbox)
                return;
            }

            const newUrl = getProxyUrl(originalHref);
            window.location.href = newUrl;
        }
    }, true);

    // Intercept Form Submissions
    document.addEventListener('submit', function(e) {
        const form = e.target;
        const action = form.getAttribute('action') || '';
        
        e.preventDefault();

        const formData = new FormData(form);
        const params = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
            params.append(key, value);
        }

        // Determine target URL
        let targetAction = action;
        // If empty action, it submits to self
        if (!targetAction) {
             const currentUrlParams = new URLSearchParams(window.location.search);
             targetAction = currentUrlParams.get('url');
        }

        const proxyLink = getProxyUrl(targetAction);
        
        // If GET, append params to the proxied URL's target URL?
        // No, the proxy endpoint needs to handle this.
        // Easiest way: Construct the full "real" URL with params, then proxy THAT.
        
        if (form.method.toLowerCase() === 'get') {
            // We need to resolve the action to a real URL, append params, then proxy it
            let realBaseUrl = targetAction;
            
            // If we are currently on a proxy page, we need to resolve relative actions against the REAL url
            const currentUrlParams = new URLSearchParams(window.location.search);
            const realCurrentUrl = currentUrlParams.get('url');
            
            if (realCurrentUrl) {
                realBaseUrl = new URL(targetAction, realCurrentUrl).href;
            }

            const finalUrlObj = new URL(realBaseUrl);
            // Append form params
            for (const [key, value] of params.entries()) {
                finalUrlObj.searchParams.append(key, value);
            }
            
            window.location.href = '/api/proxy?url=' + encodeURIComponent(finalUrlObj.toString());
        } else {
            // POST support is harder because we need to send POST to proxy, which sends POST to target.
            // For now, let's alert limitation or try to implement generic POST proxying.
            // The current server.js implementation converts everything to GET in options (method: 'GET').
            // Let's stick to GET for now (search engines usually use GET).
            console.warn('POST forms not fully supported in this version');
            alert('POST submission not supported in this prototype');
        }

    }, true);

})();
