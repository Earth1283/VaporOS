document.addEventListener('DOMContentLoaded', () => {
    // Load Wallpaper
    const savedWallpaper = localStorage.getItem('wallpaper');
    if (savedWallpaper) {
        document.body.style.backgroundImage = `url('${savedWallpaper}')`;
    }

    // Clock
    setInterval(() => {
        const now = new Date();
        const clockEl = document.getElementById('clock');
        if (clockEl) {
            clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }, 1000);

    // Start Menu Toggle
    const startBtn = document.getElementById('start-btn');
    const startMenu = document.getElementById('start-menu');
    
    const toggleStartMenu = (e) => {
        if (e) e.stopPropagation();
        startMenu.classList.toggle('hidden');
    };
    
    startBtn.addEventListener('click', toggleStartMenu);

    // Close start menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!startMenu.contains(e.target) && e.target !== startBtn) {
            startMenu.classList.add('hidden');
        }
    });
    
    // Populate Start Menu & Desktop Icons from App Registry
    const apps = window.appManager.apps;
    const iconsContainer = document.getElementById('desktop-icons');
    const startMenuList = startMenu.querySelector('ul');
    
    startMenuList.innerHTML = ''; // Clear hardcoded
    iconsContainer.innerHTML = '';

    Object.keys(apps).forEach(appId => {
        const app = apps[appId];
        
        // 1. Desktop Icon
        const el = document.createElement('div');
        el.className = 'desktop-icon';
        el.innerHTML = `
            <div style="font-size: 32px;">${app.icon}</div>
            <span>${app.title}</span>
        `;
        el.onclick = () => window.appManager.open(appId);
        
        el.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.contextMenu.show(e.clientX, e.clientY, [
                { label: 'Open', action: () => window.appManager.open(appId) }
            ]);
        };
        iconsContainer.appendChild(el);

        // 2. Start Menu Item
        const li = document.createElement('li');
        li.innerHTML = `<span style="margin-right: 10px; font-size: 18px;">${app.icon}</span> ${app.title}`;
        li.onclick = () => {
            window.appManager.open(appId);
            startMenu.classList.add('hidden'); // Auto close
        };
        startMenuList.appendChild(li);
    });

    // Global Context Menu for Desktop Background
    document.getElementById('desktop').addEventListener('contextmenu', (e) => {
        if (e.target.id === 'desktop' || e.target.classList.contains('desktop-icons')) {
            e.preventDefault();
            window.contextMenu.show(e.clientX, e.clientY, [
                { 
                    label: 'New Text Document', 
                    action: async () => {
                        const name = await window.dialog.prompt('New File', 'File Name:', 'untitled.txt');
                        if (name) {
                            await window.fs.write('/' + name, '');
                            // If explorer is open at root, refresh it? 
                            // Complex to find open explorer instances, but user will see it next time they open.
                            window.dialog.alert('System', 'File created on Virtual Drive Root.');
                        }
                    } 
                },
                { separator: true },
                { 
                    label: 'Personalize', 
                    action: () => appManager.open('settings') 
                }
            ]);
        }
    });
});
