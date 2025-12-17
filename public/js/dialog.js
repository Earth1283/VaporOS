class Dialog {
    constructor() {
        this.overlay = document.getElementById('dialog-overlay');
        this.titleEl = document.getElementById('dialog-title');
        this.msgEl = document.getElementById('dialog-message');
        this.inputContainer = document.getElementById('dialog-input-container');
        this.inputEl = document.getElementById('dialog-input');
        this.confirmBtn = document.getElementById('dialog-confirm-btn');
        this.cancelBtn = document.getElementById('dialog-cancel-btn');
        
        this.resolve = null;
        
        this.confirmBtn.onclick = () => this.handleClose(true);
        this.cancelBtn.onclick = () => this.handleClose(false);
        this.inputEl.onkeydown = (e) => {
            if(e.key === 'Enter') this.handleClose(true);
            if(e.key === 'Escape') this.handleClose(false);
        };
    }

    reset() {
        this.inputContainer.classList.add('hidden');
        this.cancelBtn.style.display = 'block';
        this.inputEl.value = '';
    }

    show(title, message, isPrompt = false, defaultValue = '') {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.titleEl.textContent = title;
            this.msgEl.textContent = message;
            
            this.reset();
            
            if (isPrompt) {
                this.inputContainer.classList.remove('hidden');
                this.inputEl.value = defaultValue;
                setTimeout(() => this.inputEl.focus(), 100);
            } else {
                // Alert mode - maybe hide cancel?
                // For now, let's keep "OK" as single option for alert
                if (!isPrompt && arguments.length < 3) { 
                   // If purely called as alert(title, msg)
                   this.cancelBtn.style.display = 'none';
                }
            }
            
            this.overlay.classList.remove('hidden');
            this.overlay.style.display = 'flex';
        });
    }

    alert(title, message) {
        this.cancelBtn.style.display = 'none';
        return this.show(title, message);
    }

    confirm(title, message) {
        return this.show(title, message).then(res => !!res);
    }

    prompt(title, message, defaultValue = '') {
        return this.show(title, message, true, defaultValue).then(res => {
            return res ? this.inputEl.value : null;
        });
    }

    handleClose(isConfirmed) {
        this.overlay.classList.add('hidden');
        // waiting for transition
        setTimeout(() => {
             this.overlay.style.display = 'none';
        }, 200);
        
        if (this.resolve) {
            this.resolve(isConfirmed);
            this.resolve = null;
        }
    }
}

window.dialog = new Dialog();

// Override native
window.alert = (msg) => window.dialog.alert('System', msg);
window.confirm = (msg) => window.dialog.confirm('Confirm', msg);
// window.prompt is async, so we can't fully override it syntactically 1:1 without breaking code that expects sync return.
// We will use window.dialog.prompt() in our apps.
