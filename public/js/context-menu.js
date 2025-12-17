class ContextMenu {
    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'context-menu hidden';
        document.body.appendChild(this.element);

        // Hide on any click (left or right) elsewhere
        document.addEventListener('click', () => this.hide());
        // We handle the specific context menu events elsewhere, but if one bubbles up, we might want to hide existing or prevent default
    }

    show(x, y, items) {
        // Clear previous
        this.element.innerHTML = '';
        const list = document.createElement('ul');
        
        items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.label;
            if (item.className) li.className = item.className;
            
            li.onclick = (e) => {
                // e.stopPropagation(); // Let it bubble to document to close menu? No, we close explicitly.
                this.hide();
                if (item.action) item.action();
            };
            
            if (item.separator) {
                li.className = 'separator';
                li.textContent = '';
                li.onclick = null;
            }

            list.appendChild(li);
        });

        this.element.appendChild(list);
        this.element.classList.remove('hidden');

        // Positioning logic to prevent overflow
        const rect = this.element.getBoundingClientRect();
        let posX = x;
        let posY = y;

        if (posX + rect.width > window.innerWidth) {
            posX = window.innerWidth - rect.width - 10;
        }
        if (posY + rect.height > window.innerHeight) {
            posY = window.innerHeight - rect.height - 10;
        }

        this.element.style.left = posX + 'px';
        this.element.style.top = posY + 'px';
    }

    hide() {
        this.element.classList.add('hidden');
    }
}

window.contextMenu = new ContextMenu();
