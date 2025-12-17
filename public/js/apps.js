const Apps = {
    explorer: {
        title: 'File Explorer',
        icon: '💻',
        render: async (container, win) => {
            container.innerHTML = '<div class="loading">Loading...</div>';
            const currentPath = win.data?.path || '/';
            
            // Toolbar
            const toolbar = document.createElement('div');
            toolbar.className = 'app-toolbar';
            
            const upBtn = document.createElement('button');
            upBtn.textContent = '↑';
            upBtn.title = 'Up';
            upBtn.onclick = () => {
                const newPath = currentPath.split('/').slice(0, -1).join('/') || '/';
                Apps.explorer.navigate(win, newPath);
            };
            
            const pathDisplay = document.createElement('span');
            pathDisplay.textContent = currentPath;
            pathDisplay.style.flex = '1';
            pathDisplay.style.alignSelf = 'center';
            pathDisplay.style.marginLeft = '10px';
            pathDisplay.style.fontSize = '12px';
            pathDisplay.style.color = '#666';

            const newDirBtn = document.createElement('button');
            newDirBtn.textContent = '+ 📁';
            newDirBtn.title = 'New Folder';
            newDirBtn.onclick = async () => {
                const name = await window.dialog.prompt('New Folder', 'Enter folder name:');
                if (name) {
                    await window.fs.mkdir(currentPath === '/' ? `/${name}` : `${currentPath}/${name}`);
                    Apps.explorer.navigate(win, currentPath);
                }
            };
            
            const newFileBtn = document.createElement('button');
            newFileBtn.textContent = '+ 📄';
            newFileBtn.title = 'New File';
            newFileBtn.onclick = async () => {
                const name = await window.dialog.prompt('New File', 'Enter file name (e.g. note.txt):');
                if (name) {
                    await window.fs.write(currentPath === '/' ? `/${name}` : `${currentPath}/${name}`, '');
                    Apps.explorer.navigate(win, currentPath);
                }
            };

            toolbar.append(upBtn, pathDisplay, newDirBtn, newFileBtn);
            
            // File List
            const listContainer = document.createElement('div');
            listContainer.className = 'file-list';
            // Ensure list takes remaining height
            listContainer.style.flex = '1'; 
            
            try {
                const files = await window.fs.list(currentPath);
                container.innerHTML = '';
                // Explorer needs flex column layout for the new CSS to work well
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                
                container.appendChild(toolbar);
                container.appendChild(listContainer);

                files.forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'file-item';
                    
                    const icon = document.createElement('span');
                    icon.className = 'file-icon';
                    icon.textContent = file.isDirectory ? '📁' : '📄';
                    
                    const name = document.createElement('div');
                    name.textContent = file.name;
                    name.style.wordBreak = 'break-all';
                    name.style.fontSize = '12px';
                    
                    item.append(icon, name);
                    
                    item.onclick = () => {
                        const fullPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
                        if (file.isDirectory) {
                            Apps.explorer.navigate(win, fullPath);
                        } else {
                            appManager.open('editor', { path: fullPath });
                        }
                    };

                    // Context Menu for Files
                    item.oncontextmenu = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const fullPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
                        
                        window.contextMenu.show(e.clientX, e.clientY, [
                            { 
                                label: 'Open', 
                                action: () => {
                                    if (file.isDirectory) {
                                        Apps.explorer.navigate(win, fullPath);
                                    } else {
                                        appManager.open('editor', { path: fullPath });
                                    }
                                } 
                            },
                            { separator: true },
                            {
                                label: 'Delete',
                                action: async () => {
                                    if (await window.dialog.confirm('Delete', `Are you sure you want to delete ${file.name}?`)) {
                                        await window.fs.delete(fullPath);
                                        Apps.explorer.navigate(win, currentPath);
                                    }
                                }
                            },
                            {
                                label: 'Rename',
                                action: async () => {
                                    const newName = await window.dialog.prompt('Rename', 'New name:', file.name);
                                    if (newName && newName !== file.name) {
                                        // Simple rename via read/write/delete (since we don't have atomic rename in fs api yet, this is risky but works for prototype)
                                        // Actually, let's just alert unsupported or do the risky move
                                        // Implementing a safe "move" is better backend side, but for now:
                                        // Let's just create a new file and delete old if it's a file. Folders are hard.
                                        if (file.isDirectory) {
                                             window.dialog.alert('Error', 'Renaming folders not yet supported.');
                                        } else {
                                            try {
                                                const content = (await window.fs.read(fullPath)).content;
                                                const newPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;
                                                await window.fs.write(newPath, content);
                                                await window.fs.delete(fullPath);
                                                Apps.explorer.navigate(win, currentPath);
                                            } catch(err) {
                                                window.dialog.alert('Error', 'Rename failed: ' + err.message);
                                            }
                                        }
                                    }
                                }
                            }
                        ]);
                    };
                    
                    listContainer.appendChild(item);
                });
            } catch (err) {
                container.innerHTML = `<div style="color:red; padding:20px;">Error: ${err.message}</div>`;
                container.insertBefore(toolbar, container.firstChild);
            }
        },
        navigate: (win, path) => {
            win.data = { path };
            Apps.explorer.render(win.element.querySelector('.window-content'), win);
        }
    },

    settings: {
        title: 'Settings',
        icon: '⚙️',
        render: (container, win) => {
            container.innerHTML = `
                <div style="padding: 20px;">
                    <div class="settings-group">
                        <label>Desktop Wallpaper</label>
                        <input type="text" id="wp-input" placeholder="Image URL">
                        <div class="wallpaper-preview" id="wp-preview">
                            <!-- Presets -->
                        </div>
                    </div>
                    <div class="settings-group">
                         <button id="save-settings-btn" class="primary-btn">Save Changes</button>
                         <button id="reset-settings-btn">Reset Default</button>
                    </div>
                </div>
            `;
            
            const presets = [
                'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80',
                'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80',
                'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80',
                'https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80'
            ];
            
            const input = container.querySelector('#wp-input');
            const previewContainer = container.querySelector('#wp-preview');
            const saveBtn = container.querySelector('#save-settings-btn');
            const resetBtn = container.querySelector('#reset-settings-btn');
            
            const currentWp = localStorage.getItem('wallpaper') || presets[0];
            input.value = currentWp;
            
            presets.forEach(url => {
                const thumb = document.createElement('div');
                thumb.className = 'wallpaper-thumb';
                thumb.style.backgroundImage = `url(${url})`;
                if (url === currentWp) thumb.classList.add('selected');
                
                thumb.onclick = () => {
                    input.value = url;
                    container.querySelectorAll('.wallpaper-thumb').forEach(t => t.classList.remove('selected'));
                    thumb.classList.add('selected');
                };
                
                previewContainer.appendChild(thumb);
            });
            
            saveBtn.onclick = () => {
                const newUrl = input.value;
                if (newUrl) {
                    localStorage.setItem('wallpaper', newUrl);
                    document.body.style.backgroundImage = `url('${newUrl}')`;
                    window.dialog.alert('Settings', 'Wallpaper updated!');
                }
            };
            
            resetBtn.onclick = () => {
                localStorage.removeItem('wallpaper');
                document.body.style.backgroundImage = `url('${presets[0]}')`;
                input.value = presets[0];
                window.dialog.alert('Settings', 'Settings reset.');
            };
        }
    },

    editor: {
        title: 'Notepad',
        icon: '📝',
        render: async (container, win) => {
            container.innerHTML = 'Loading...';
            // Editor needs flex column for full height
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            
            const filePath = win.data?.path;
            
            const toolbar = document.createElement('div');
            toolbar.className = 'app-toolbar';
            
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save';
            
            toolbar.appendChild(saveBtn);
            
            const textarea = document.createElement('textarea');
            textarea.className = 'editor-textarea';
            // textarea should grow
            textarea.style.flex = '1';
            textarea.style.border = 'none'; // remove border inside window
            textarea.style.borderRadius = '0';
            textarea.style.background = 'transparent'; 
            
            container.innerHTML = '';
            container.appendChild(toolbar);
            container.appendChild(textarea);
            
            if (filePath) {
                try {
                    const data = await window.fs.read(filePath);
                    textarea.value = data.content;
                    win.title = `Notepad - ${filePath}`;
                    win.element.querySelector('.window-title').textContent = win.title;
                    // Update taskbar text if exists (might be just icon in future)
                    if(win.taskbarElement) win.taskbarElement.title = win.title;
                } catch (err) {
                    window.dialog.alert('Error', 'Error reading file');
                }
            }
            
            saveBtn.onclick = async () => {
                let targetPath = filePath;
                if (!targetPath) {
                    targetPath = await window.dialog.prompt('Save File', 'Save as (path):', '/untitled.txt');
                }
                if (targetPath) {
                    await window.fs.write(targetPath, textarea.value);
                    win.data = { path: targetPath };
                    win.title = `Notepad - ${targetPath}`;
                    win.element.querySelector('.window-title').textContent = win.title;
                    window.dialog.alert('Success', 'File Saved!');
                }
            };
        }
    },

    terminal: {
        title: 'Terminal',
        icon: '⌨️',
        render: (container, win) => {
            container.style.backgroundColor = 'black';
            container.style.padding = '0';
            
            const output = document.createElement('div');
            output.className = 'terminal-output';
            
            const inputLine = document.createElement('div');
            inputLine.style.display = 'flex';
            inputLine.style.padding = '5px';
            
            const promptStr = document.createElement('span');
            promptStr.textContent = '$ ';
            promptStr.style.color = '#0f0';
            promptStr.style.marginRight = '5px';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.style.flex = '1';
            input.style.background = 'transparent';
            input.style.border = 'none';
            input.style.color = '#0f0';
            input.style.fontFamily = 'monospace';
            input.style.outline = 'none';
            
            inputLine.append(promptStr, input);
            
            container.innerHTML = '';
            container.appendChild(output);
            container.appendChild(inputLine);
            
            // Focus input when clicking terminal
            container.onclick = () => input.focus();
            
            let currentPath = '/';

            const print = (text) => {
                const line = document.createElement('div');
                line.textContent = text;
                output.appendChild(line);
                output.scrollTop = output.scrollHeight;
            };

            print('Welcome to WebOS Terminal v1.0');
            print('Type "help" for commands.');

            input.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    const cmdLine = input.value.trim();
                    print(`$ ${cmdLine}`);
                    input.value = '';
                    
                    const args = cmdLine.split(' ');
                    const cmd = args[0];
                    
                    try {
                        switch (cmd) {
                            case 'help':
                                print('Available commands: ls, cd, cat, mkdir, rm, echo, clear, exit');
                                break;
                            case 'clear':
                                output.innerHTML = '';
                                break;
                            case 'echo':
                                print(args.slice(1).join(' '));
                                break;
                            case 'ls':
                                const files = await window.fs.list(currentPath);
                                files.forEach(f => print(`${f.isDirectory ? '[DIR] ' : ''}${f.name}`));
                                break;
                            case 'cd':
                                const newDir = args[1];
                                if (!newDir) {
                                    currentPath = '/';
                                } else if (newDir === '..') {
                                    currentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
                                } else {
                                    // Check if valid? (Simplified: just append)
                                    // ideally we check if it exists first
                                    const testPath = currentPath === '/' ? `/${newDir}` : `${currentPath}/${newDir}`;
                                    try {
                                        await window.fs.list(testPath); // Will throw if not dir
                                        currentPath = testPath;
                                    } catch {
                                        print(`cd: ${newDir}: No such directory`);
                                    }
                                }
                                print(`Current directory: ${currentPath}`);
                                break;
                            case 'cat':
                                if (!args[1]) {
                                    print('Usage: cat <filename>');
                                    break;
                                }
                                const readPath = currentPath === '/' ? `/${args[1]}` : `${currentPath}/${args[1]}`;
                                try {
                                    const data = await window.fs.read(readPath);
                                    print(data.content);
                                } catch (err) {
                                    print(`cat: ${args[1]}: ${err.message}`);
                                }
                                break;
                            case 'mkdir':
                                if (!args[1]) break;
                                const mkPath = currentPath === '/' ? `/${args[1]}` : `${currentPath}/${args[1]}`;
                                await window.fs.mkdir(mkPath);
                                print(`Created directory ${args[1]}`);
                                break;
                            case 'rm':
                                if (!args[1]) break;
                                const rmPath = currentPath === '/' ? `/${args[1]}` : `${currentPath}/${args[1]}`;
                                await window.fs.delete(rmPath);
                                print(`Deleted ${args[1]}`);
                                break;
                            case 'exit':
                                window.wm.close(win.id);
                                break;
                            case '':
                                break;
                            default:
                                print(`Command not found: ${cmd}`);
                        }
                    } catch (err) {
                        print(`Error: ${err.message}`);
                    }
                }
            });
            
            // Auto focus
            setTimeout(() => input.focus(), 100);
        }
    },
    
    browser: {
        title: 'Browser',
        icon: '🌐',
        render: (container, win) => {
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            
            // Toolbar
            const toolbar = document.createElement('div');
            toolbar.className = 'app-toolbar';
            toolbar.style.display = 'flex';
            toolbar.style.gap = '5px';
            toolbar.style.padding = '5px';
            toolbar.style.backgroundColor = '#f0f0f0'; // Light gray for contrast
            toolbar.style.borderBottom = '1px solid #ccc';

            const backBtn = document.createElement('button');
            backBtn.textContent = '←';
            
            const forwardBtn = document.createElement('button');
            forwardBtn.textContent = '→';

            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.placeholder = 'http://...';
            urlInput.style.flex = '1';
            urlInput.style.padding = '4px';
            urlInput.value = win.data?.url || 'https://www.google.com';

            const goBtn = document.createElement('button');
            goBtn.textContent = 'Go';

            toolbar.append(backBtn, forwardBtn, urlInput, goBtn);

            // Iframe
            const iframe = document.createElement('iframe');
            iframe.style.flex = '1';
            iframe.style.border = 'none';
            iframe.style.backgroundColor = 'white';
            iframe.sandbox = 'allow-forms allow-scripts allow-same-origin allow-popups'; // Safety first, but allow normal web stuff
            
            container.innerHTML = '';
            container.append(toolbar, iframe);

            const navigate = (url) => {
                if(!url.startsWith('http')) url = 'https://' + url;
                urlInput.value = url;
                // Use the proxy
                iframe.src = '/api/proxy?url=' + encodeURIComponent(url);
                win.data = { url };
            };

            goBtn.onclick = () => navigate(urlInput.value);
            urlInput.onkeydown = (e) => { if(e.key === 'Enter') navigate(urlInput.value); };
            
            // History navigation (might work since it is same-origin proxy)
            backBtn.onclick = () => {
                try { iframe.contentWindow.history.back(); } catch(e) { console.log('Back failed', e); }
            };
             forwardBtn.onclick = () => {
                try { iframe.contentWindow.history.forward(); } catch(e) { console.log('Fwd failed', e); }
            };

            // Initial load
            if (urlInput.value) {
                navigate(urlInput.value);
            }
        }
    },
    
    calculator: {
        title: 'Calculator',
        icon: '🧮',
        render: (container, win) => {
            // Simple calculator implementation
             container.innerHTML = `
                <div style="display: flex; flex-direction: column; height: 100%; padding: 10px;">
                    <input type="text" class="calc-display" id="calc-display-${win.id}" readonly>
                    <div class="calc-grid">
                        <button onclick="window.calcAppend('${win.id}', '7')">7</button><button onclick="window.calcAppend('${win.id}', '8')">8</button><button onclick="window.calcAppend('${win.id}', '9')">9</button><button onclick="window.calcOp('${win.id}', '/')">/</button>
                        <button onclick="window.calcAppend('${win.id}', '4')">4</button><button onclick="window.calcAppend('${win.id}', '5')">5</button><button onclick="window.calcAppend('${win.id}', '6')">6</button><button onclick="window.calcOp('${win.id}', '*')">*</button>
                        <button onclick="window.calcAppend('${win.id}', '1')">1</button><button onclick="window.calcAppend('${win.id}', '2')">2</button><button onclick="window.calcAppend('${win.id}', '3')">3</button><button onclick="window.calcOp('${win.id}', '-')">-</button>
                        <button onclick="window.calcAppend('${win.id}', '0')">0</button><button onclick="window.calcClear('${win.id}')">C</button><button onclick="window.calcSolve('${win.id}')">=</button><button onclick="window.calcOp('${win.id}', '+')">+</button>
                    </div>
                </div>
            `;
            
            // Scope helpers to window but keyed by ID to support multiple calc instances (conceptually)
            // For now, simple global helpers that take ID
            window.calcAppend = (id, val) => {
                const el = document.getElementById(`calc-display-${id}`);
                if(el) el.value += val;
            };
            window.calcClear = (id) => {
                const el = document.getElementById(`calc-display-${id}`);
                if(el) el.value = '';
            };
            window.calcOp = (id, op) => {
                const el = document.getElementById(`calc-display-${id}`);
                if(el) el.value += ' ' + op + ' ';
            };
            window.calcSolve = (id) => {
                const el = document.getElementById(`calc-display-${id}`);
                if(el) {
                    try {
                        el.value = eval(el.value);
                    } catch {
                        el.value = 'Error';
                    }
                }
            };
        }
    },

    tictactoe: {
        title: 'Tic-Tac-Toe',
        icon: '❌',
        render: (container, win) => {
            container.innerHTML = `
                <div class="game-container">
                    <div class="score-display" id="ttt-status-${win.id}">Player X's Turn</div>
                    <div class="tictactoe-board" id="ttt-board-${win.id}">
                        <!-- Cells generated by JS -->
                    </div>
                    <button class="game-btn primary-btn" onclick="window.resetTTT('${win.id}')">Restart Game</button>
                </div>
            `;
            
            let board = ['', '', '', '', '', '', '', '', ''];
            let currentPlayer = 'X';
            let gameActive = true;
            
            // Use container.querySelector to find elements in the detached DOM
            const statusDisplay = container.querySelector(`#ttt-status-${win.id}`);
            const boardContainer = container.querySelector(`#ttt-board-${win.id}`);
            
            const checkWin = () => {
                const winConditions = [
                    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
                    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
                    [0, 4, 8], [2, 4, 6]             // Diagonals
                ];
                
                for (let i = 0; i < winConditions.length; i++) {
                    const [a, b, c] = winConditions[i];
                    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                        return board[a];
                    }
                }
                return board.includes('') ? null : 'Draw';
            };
            
            const handleCellClick = (index) => {
                if (!gameActive || board[index] !== '') return;
                
                board[index] = currentPlayer;
                renderBoard();
                
                const winner = checkWin();
                if (winner) {
                    gameActive = false;
                    statusDisplay.textContent = winner === 'Draw' ? "It's a Draw!" : `Player ${winner} Wins!`;
                    if(winner !== 'Draw') statusDisplay.style.color = '#007aff';
                } else {
                    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
                    statusDisplay.textContent = `Player ${currentPlayer}'s Turn`;
                }
            };
            
            const renderBoard = () => {
                boardContainer.innerHTML = '';
                board.forEach((cell, index) => {
                    const cellEl = document.createElement('div');
                    cellEl.className = `tictactoe-cell ${cell ? 'taken' : ''}`;
                    cellEl.textContent = cell;
                    cellEl.onclick = () => handleCellClick(index);
                    if (cell === 'X') cellEl.style.color = '#ff5f56';
                    if (cell === 'O') cellEl.style.color = '#007aff';
                    boardContainer.appendChild(cellEl);
                });
            };
            
            // Expose reset for the button
            window.resetTTT = (id) => {
                if (id !== win.id) return; // safety check
                board = ['', '', '', '', '', '', '', '', ''];
                currentPlayer = 'X';
                gameActive = true;
                statusDisplay.textContent = "Player X's Turn";
                statusDisplay.style.color = 'inherit';
                renderBoard();
            };
            
            renderBoard();
        },
        options: { width: 250, height: 350 }
    },

    snake: {
        title: 'Snake',
        icon: '🐍',
        render: (container, win) => {
             container.innerHTML = `
                <div class="game-container" tabindex="0" style="outline:none;">
                    <div class="score-display">Score: <span id="snake-score-${win.id}">0</span></div>
                    <canvas id="snake-canvas-${win.id}" width="300" height="300" class="snake-canvas"></canvas>
                    <div style="font-size:12px; margin-top:5px; color:#666;">Use Arrow Keys to Move</div>
                    <button class="game-btn primary-btn" id="snake-start-${win.id}">Start Game</button>
                </div>
            `;
            
            const canvas = container.querySelector(`#snake-canvas-${win.id}`);
            const ctx = canvas.getContext('2d');
            const scoreEl = container.querySelector(`#snake-score-${win.id}`);
            const startBtn = container.querySelector(`#snake-start-${win.id}`);
            const gameContainer = container.querySelector('.game-container');
            
            const gridSize = 15;
            const tileCount = 20; // 300 / 15
            let speed = 7;
            
            let xv = 0, yv = 0;
            let px = 10, py = 10;
            let trail = [];
            let tail = 5;
            let appleX = 15, appleY = 15;
            let score = 0;
            let gameInterval;
            let isRunning = false;
            
            const gameLoop = () => {
                px += xv;
                py += yv;
                
                // Wrap around
                if (px < 0) px = tileCount - 1;
                if (px > tileCount - 1) px = 0;
                if (py < 0) py = tileCount - 1;
                if (py > tileCount - 1) py = 0;
                
                // Background
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Snake
                ctx.fillStyle = '#0f0';
                for (let i = 0; i < trail.length; i++) {
                    ctx.fillRect(trail[i].x * gridSize, trail[i].y * gridSize, gridSize - 2, gridSize - 2);
                    
                    if (trail[i].x === px && trail[i].y === py && tail > 5) {
                        // Game Over
                        gameOver();
                        return;
                    }
                }
                
                trail.push({ x: px, y: py });
                while (trail.length > tail) {
                    trail.shift();
                }
                
                // Apple
                if (appleX === px && appleY === py) {
                    tail++;
                    score++;
                    scoreEl.textContent = score;
                    appleX = Math.floor(Math.random() * tileCount);
                    appleY = Math.floor(Math.random() * tileCount);
                }
                
                ctx.fillStyle = 'red';
                ctx.fillRect(appleX * gridSize, appleY * gridSize, gridSize - 2, gridSize - 2);
            };
            
            const gameOver = () => {
                clearInterval(gameInterval);
                isRunning = false;
                ctx.fillStyle = 'white';
                ctx.font = '30px Arial';
                ctx.fillText("Game Over", 75, 150);
                startBtn.textContent = "Play Again";
                startBtn.style.display = 'block';
            };
            
            const startGame = () => {
                if (isRunning) return;
                isRunning = true;
                startBtn.style.display = 'none';
                
                // Reset stats
                xv = 1; yv = 0; // Start moving right
                px = 10; py = 10;
                trail = [];
                tail = 5;
                score = 0;
                scoreEl.textContent = 0;
                
                // Focus container to capture keys
                gameContainer.focus();
                
                gameInterval = setInterval(gameLoop, 1000 / 10);
            };
            
            startBtn.onclick = startGame;
            
            // Key handlers
            // We attach to the specific container element, relying on tabindex focus
            gameContainer.addEventListener('keydown', (e) => {
                if (!isRunning) return;
                switch (e.key) {
                    case 'ArrowLeft': if(xv!==1) { xv = -1; yv = 0; } break;
                    case 'ArrowUp': if(yv!==1) { xv = 0; yv = -1; } break;
                    case 'ArrowRight': if(xv!==-1) { xv = 1; yv = 0; } break;
                    case 'ArrowDown': if(yv!==-1) { xv = 0; yv = 1; } break;
                }
            });
            
            // Initial draw
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.font = '20px Arial';
            ctx.fillText("Press Start", 100, 150);
        },
        options: { width: 350, height: 400 }
    }
};

class AppManager {
    constructor() {
        this.apps = Apps;
    }

    open(appId, data = {}) {
        const app = this.apps[appId];
        if (app) {
            window.wm.open(appId, app.title, (container, win) => {
                win.data = { ...win.data, ...data }; // Merge data
                app.render(container, win);
            }, app.options || {}); // Pass app-specific options, or empty object if none
        } else {
            console.error('App not found:', appId);
        }
    }
}

window.appManager = new AppManager();
