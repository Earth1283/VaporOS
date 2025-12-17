class WindowManager {
    constructor() {
        this.container = document.getElementById('windows-container');
        this.taskbar = document.getElementById('taskbar-apps');
        this.windows = [];
        this.zIndexCounter = 100;
        this.isMobile = window.innerWidth <= 768;
        
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
            this.reflowWindows();
        });
    }

    open(appId, title, contentRenderer, options = {}) {
        const id = 'win-' + Date.now();
        const win = {
            id,
            appId,
            title,
            isMinimized: false,
            isMaximized: this.isMobile, // Auto maximize on mobile
            element: null,
            taskbarElement: null
        };

        this.createWindowDOM(win, contentRenderer, options);
        this.createTaskbarDOM(win);
        this.windows.push(win);
        this.focus(win.id);
        return win;
    }

    createWindowDOM(win, contentRenderer, options) {
        const template = document.getElementById('window-template');
        const clone = template.content.cloneNode(true);
        const winEl = clone.querySelector('.window');
        
        winEl.id = win.id;
        winEl.querySelector('.window-title').textContent = win.title;
        
        // Content
        const contentContainer = winEl.querySelector('.window-content');
        contentRenderer(contentContainer, win);

        // Position & Size (Desktop only default)
        if (!this.isMobile) {
            winEl.style.width = (options.width || 400) + 'px';
            winEl.style.height = (options.height || 300) + 'px';
            winEl.style.top = (options.top || 50) + 'px';
            winEl.style.left = (options.left || 50) + 'px';
        }

        // Event Listeners
        winEl.addEventListener('mousedown', () => this.focus(win.id));
        winEl.querySelector('.close-btn').addEventListener('click', () => this.close(win.id));
        winEl.querySelector('.minimize-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.minimize(win.id);
        });
        winEl.querySelector('.maximize-btn').addEventListener('click', () => this.toggleMaximize(win.id));

        // Dragging (Desktop only)
        if (!this.isMobile) {
            this.makeDraggable(winEl);
            this.makeResizable(winEl);
        }

        this.container.appendChild(winEl);
        win.element = winEl;
    }

    createTaskbarDOM(win) {
        const item = document.createElement('div');
        item.className = 'taskbar-item';
        
        // Use Icon if available (using global appManager if accessible, or passed in options? better to lookup)
        // We need access to Apps config. We can check window.appManager.apps
        const appIcon = window.appManager?.apps[win.appId]?.icon;
        
        if (appIcon) {
            item.innerHTML = `<span style="font-size: 20px;">${appIcon}</span>`;
            item.title = win.title; // Tooltip
        } else {
            item.textContent = win.title;
        }

        item.onclick = () => {
            if (win.isMinimized || !item.classList.contains('active')) {
                this.restore(win.id);
            } else {
                this.minimize(win.id);
            }
        };
        this.taskbar.appendChild(item);
        win.taskbarElement = item;
    }

    close(id) {
        const win = this.windows.find(w => w.id === id);
        if (win) {
            win.element.remove();
            win.taskbarElement.remove();
            this.windows = this.windows.filter(w => w.id !== id);
        }
    }

    focus(id) {
        const win = this.windows.find(w => w.id === id);
        if (win) {
            this.zIndexCounter++;
            win.element.style.zIndex = this.zIndexCounter;
            
            // Update active state in taskbar
            this.windows.forEach(w => w.taskbarElement.classList.remove('active'));
            win.taskbarElement.classList.add('active');

            // Update Top Bar Name
            const topBarName = document.getElementById('active-app-name');
            if (topBarName) {
                // Use just the app title (remove file paths if appended like "Notepad - file.txt")
                // Or just use the window title as is. Let's use the App Title from the registry if possible, 
                // but we only have win.title here. 
                // A better way is to look up the app definition again or store app title separately from window title.
                // For now, let's just use win.title but truncate if too long?
                // Actually, let's just use win.title.
                topBarName.textContent = win.title.split(' - ')[0]; 
            }
        }
    }

    minimize(id) {
        const win = this.windows.find(w => w.id === id);
        if (win) {
            win.isMinimized = true;
            win.element.style.display = 'none';
            win.taskbarElement.classList.remove('active');
        }
    }

    restore(id) {
        const win = this.windows.find(w => w.id === id);
        if (win) {
            win.isMinimized = false;
            win.element.style.display = 'flex';
            this.focus(id);
        }
    }

    toggleMaximize(id) {
        if (this.isMobile) return;
        
        const win = this.windows.find(w => w.id === id);
        if (win) {
            win.isMaximized = !win.isMaximized;
            if (win.isMaximized) {
                win.dataset_restore = {
                    top: win.element.style.top,
                    left: win.element.style.left,
                    width: win.element.style.width,
                    height: win.element.style.height
                };
                win.element.style.top = '0';
                win.element.style.left = '0';
                win.element.style.width = '100%';
                win.element.style.height = 'calc(100% - 40px)'; // Minus taskbar
            } else {
                const r = win.dataset_restore;
                if (r) {
                    win.element.style.top = r.top;
                    win.element.style.left = r.left;
                    win.element.style.width = r.width;
                    win.element.style.height = r.height;
                }
            }
        }
    }

    makeDraggable(element) {
        const titleBar = element.querySelector('.title-bar');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        titleBar.addEventListener('mousedown', (e) => {
            // Check if maximized, if so deny drag
            if (this.windows.find(w => w.element === element)?.isMaximized) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = element.offsetLeft;
            initialTop = element.offsetTop;
            
            // Prevent text selection
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                element.style.left = `${initialLeft + dx}px`;
                element.style.top = `${initialTop + dy}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    makeResizable(element) {
        const handle = element.querySelector('.resize-handle');
        if (!handle) return;
        
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // prevent window drag or focus issues
            e.preventDefault();
            
             // Check if maximized, if so deny resize
            if (this.windows.find(w => w.element === element)?.isMaximized) return;
            
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(element).height, 10);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const width = startWidth + (e.clientX - startX);
            const height = startHeight + (e.clientY - startY);
            
            // Minimal limits
            if (width > 200) element.style.width = width + 'px';
            if (height > 150) element.style.height = height + 'px';
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    reflowWindows() {
        // Simple logic to ensure windows aren't lost on resize
        this.windows.forEach(win => {
            if (this.isMobile) {
                win.element.style.top = '0';
                win.element.style.left = '0';
                win.element.style.width = '100%';
                win.element.style.height = 'calc(100% - 40px)';
            } else {
                // If it was maximized, keep it, otherwise maybe reset if out of bounds (simplified)
                if (win.isMaximized) {
                    win.element.style.top = '0';
                    win.element.style.left = '0';
                    win.element.style.width = '100%';
                    win.element.style.height = 'calc(100% - 40px)';
                } else if (!win.dataset_restore) {
                   // Default size if switching from mobile to desktop
                    win.element.style.width = '400px';
                    win.element.style.height = '300px';
                }
            }
        });
    }
}

window.wm = new WindowManager();
