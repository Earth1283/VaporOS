class FileSystem {
    constructor() {
        this.baseUrl = '/api/fs';
    }

    async list(path) {
        const response = await fetch(`${this.baseUrl}/list?path=${encodeURIComponent(path)}`);
        return response.json();
    }

    async read(path) {
        const response = await fetch(`${this.baseUrl}/read?path=${encodeURIComponent(path)}`);
        return response.json();
    }

    async write(path, content) {
        const response = await fetch(`${this.baseUrl}/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content })
        });
        return response.json();
    }

    async delete(path) {
        const response = await fetch(`${this.baseUrl}/delete?path=${encodeURIComponent(path)}`, {
            method: 'DELETE'
        });
        return response.json();
    }

    async mkdir(path) {
        const response = await fetch(`${this.baseUrl}/mkdir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        return response.json();
    }
}

window.fs = new FileSystem();
