// GitHub Repository Sync — данные сайта в файле site-data.json в репозитории
// Чтение: raw.githubusercontent.com (без токена) / GitHub API (с токеном)
// Запись: GitHub Contents API (нужен classic token с правом repo)

const PETOCHANIA_SITE_DATA_FILE = 'site-data.json';

class GitHubRepoSync {
    constructor() {
        this.owner = null;
        this.repo = null;
        this.branch = 'main';
        this.dataFile = PETOCHANIA_SITE_DATA_FILE;
        this.githubToken = null;
        this.initialized = false;
        this._saveQueue = Promise.resolve();
        this.init();
    }

    static getAuthHeaders(token) {
        if (!token) return { 'Accept': 'application/vnd.github.v3+json' };
        const scheme = token.startsWith('github_pat_') ? 'Bearer' : 'token';
        return {
            'Authorization': `${scheme} ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        };
    }

    getContentsApiUrl() {
        return 'https://api.github.com/repos/' + this.owner + '/' + this.repo +
            '/contents/' + encodeURIComponent(this.dataFile);
    }

    decodeGitHubFileContent(file) {
        if (!file || !file.content) return null;
        const binary = atob(file.content.replace(/\s/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const text = new TextDecoder('utf-8').decode(bytes);
        return JSON.parse(text);
    }

    encodeGitHubFileContent(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    parseGitHubError(response, body) {
        body = body || {};
        const parts = [];
        if (body.message) parts.push(body.message);
        if (Array.isArray(body.errors)) {
            body.errors.forEach(function(item) {
                if (item && item.message) parts.push(item.message);
            });
        }
        const message = parts.join(' ').trim() || ('HTTP ' + response.status);
        const err = new Error(message);
        err.status = response.status;
        err.body = body;
        return err;
    }

    isShaConflictError(error) {
        if (!error) return false;
        if (error.status === 409 || error.status === 422) return true;
        const text = String(error.message || '').toLowerCase();
        return text.includes('does not match') ||
            (text.includes('sha') && text.includes('match'));
    }

    async init() {
        this.githubToken = localStorage.getItem('petochania_github_token');

        if (window.syncConfigLoader) {
            await window.syncConfigLoader.loadConfig();
            const cfg = window.syncConfigLoader.getRepoConfig();
            this.owner = cfg.owner;
            this.repo = cfg.repo;
            this.branch = cfg.branch || 'main';
            this.dataFile = cfg.dataFile || PETOCHANIA_SITE_DATA_FILE;
        }

        this.owner = this.owner || localStorage.getItem('petochania_github_owner');
        this.repo = this.repo || localStorage.getItem('petochania_github_repo');
        this.branch = localStorage.getItem('petochania_github_branch') || this.branch || 'main';
        this.dataFile = localStorage.getItem('petochania_data_file') || this.dataFile || PETOCHANIA_SITE_DATA_FILE;

        this.initialized = !!(this.owner && this.repo);

        if (this.initialized) {
            console.log('✅ GitHub Repo Sync: ' + this.owner + '/' + this.repo + ' [' + this.branch + '] → ' + this.dataFile);
        } else {
            console.warn('⚠️ GitHub Repo Sync не настроен. Укажите owner/repo в админ-панели.');
        }
    }

    hasWriteAccess() {
        return !!(this.initialized && this.githubToken);
    }

    saveToken(token) {
        this.githubToken = token;
        localStorage.setItem('petochania_github_token', token);
        localStorage.setItem('petochania_github_token_saved', 'true');
        localStorage.setItem('petochania_github_token_saved_at', new Date().toISOString());
    }

    clearToken() {
        this.githubToken = null;
        localStorage.removeItem('petochania_github_token');
        localStorage.removeItem('petochania_github_token_saved');
        localStorage.removeItem('petochania_github_token_saved_at');
    }

    isTokenSaved() {
        return localStorage.getItem('petochania_github_token_saved') === 'true' &&
            !!localStorage.getItem('petochania_github_token');
    }

    getRawDataUrl() {
        return 'https://raw.githubusercontent.com/' + this.owner + '/' + this.repo + '/' + this.branch + '/' + this.dataFile;
    }

    collectLocalData() {
        const breedPages = Object.assign(
            {},
            JSON.parse(localStorage.getItem('breedPages') || '{}'),
            JSON.parse(localStorage.getItem('petochania_breedPages') || '{}')
        );
        return {
            cats: JSON.parse(localStorage.getItem('petochania_cats') || '[]'),
            breedPages: breedPages,
            faq: JSON.parse(localStorage.getItem('petochania_faq') || '[]'),
            reviews: JSON.parse(localStorage.getItem('petochania_reviews') || '[]'),
            videos: JSON.parse(localStorage.getItem('petochania_videos') || '[]'),
            gallery: JSON.parse(localStorage.getItem('petochania_gallery') || '[]'),
            settings: JSON.parse(localStorage.getItem('petochania_site_settings') || '{}')
        };
    }

    applyDataToLocalStorage(data) {
        if (!data || typeof data !== 'object') return;
        if (data.cats) localStorage.setItem('petochania_cats', JSON.stringify(data.cats));
        if (data.breedPages) {
            localStorage.setItem('breedPages', JSON.stringify(data.breedPages));
            localStorage.setItem('petochania_breedPages', JSON.stringify(data.breedPages));
        }
        if (data.faq) localStorage.setItem('petochania_faq', JSON.stringify(data.faq));
        if (data.reviews) localStorage.setItem('petochania_reviews', JSON.stringify(data.reviews));
        if (data.videos) localStorage.setItem('petochania_videos', JSON.stringify(data.videos));
        if (data.gallery) localStorage.setItem('petochania_gallery', JSON.stringify(data.gallery));
        if (data.settings) localStorage.setItem('petochania_site_settings', JSON.stringify(data.settings));
        localStorage.setItem('petochania_last_sync', data.lastSync || new Date().toISOString());
    }

    async loadData() {
        if (!this.initialized) await this.init();
        if (!this.owner || !this.repo) return null;

        try {
            const response = await fetch(this.getRawDataUrl() + '?t=' + Date.now());
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn('Ошибка загрузки site-data.json:', error);
        }
        return null;
    }

    async loadFileFromGitHub() {
        const apiUrl = this.getContentsApiUrl() + '?ref=' + encodeURIComponent(this.branch);
        const response = await fetch(apiUrl, {
            headers: GitHubRepoSync.getAuthHeaders(this.githubToken)
        });

        if (response.status === 404) {
            return { sha: null, data: null };
        }

        if (!response.ok) {
            const body = await response.json().catch(function() { return {}; });
            throw this.parseGitHubError(response, body);
        }

        const file = await response.json();
        let data = null;
        try {
            data = this.decodeGitHubFileContent(file);
        } catch (error) {
            console.warn('Не удалось разобрать site-data.json:', error);
        }

        return { sha: file.sha || null, data: data };
    }

    mergeWithRemote(remote, local) {
        if (!remote) return local;
        return {
            cats: Array.isArray(local.cats) ? local.cats : (remote.cats || []),
            breedPages: Object.assign({}, remote.breedPages || {}, local.breedPages || {}),
            faq: Array.isArray(local.faq) ? local.faq : (remote.faq || []),
            reviews: Array.isArray(local.reviews) ? local.reviews : (remote.reviews || []),
            videos: Array.isArray(local.videos) ? local.videos : (remote.videos || []),
            gallery: Array.isArray(local.gallery) ? local.gallery : (remote.gallery || []),
            settings: Object.assign({}, remote.settings || {}, local.settings || {})
        };
    }

    async putSiteDataFile(payload, sha) {
        const content = this.encodeGitHubFileContent(JSON.stringify(payload, null, 2));
        const body = {
            message: 'Update site data from Petochania admin panel',
            content: content,
            branch: this.branch
        };
        if (sha) body.sha = sha;

        const response = await fetch(this.getContentsApiUrl(), {
            method: 'PUT',
            headers: Object.assign(
                { 'Content-Type': 'application/json' },
                GitHubRepoSync.getAuthHeaders(this.githubToken)
            ),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(function() { return {}; });
            throw this.parseGitHubError(response, errorBody);
        }

        return response.json();
    }

    async saveDataOnce(data) {
        const maxAttempts = 5;
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const remoteState = await this.loadFileFromGitHub();
            const merged = this.mergeWithRemote(remoteState.data, data);
            const payload = Object.assign({}, merged, { lastSync: new Date().toISOString() });

            try {
                await this.putSiteDataFile(payload, remoteState.sha);
                localStorage.setItem('petochania_last_sync', payload.lastSync);
                return { success: true };
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts && this.isShaConflictError(error)) {
                    console.warn('Конфликт site-data.json, повтор ' + (attempt + 1) + '/' + maxAttempts);
                    await new Promise(function(resolve) { setTimeout(resolve, 300 * attempt); });
                    continue;
                }
                throw error;
            }
        }

        throw lastError || new Error('Не удалось сохранить site-data.json');
    }

    async saveData(data) {
        if (!this.hasWriteAccess()) {
            return { success: true, localOnly: true };
        }

        const self = this;
        const task = function() {
            return self.saveDataOnce(data);
        };

        this._saveQueue = this._saveQueue.then(task, task);
        return this._saveQueue;
    }

    async syncFromLocalStorage() {
        return this.saveData(this.collectLocalData());
    }

    async setup(token, options) {
        options = options || {};
        this.saveToken(token);

        const owner = (options.owner || '').trim() || localStorage.getItem('petochania_github_owner');
        const repo = (options.repo || '').trim() || localStorage.getItem('petochania_github_repo');
        const branch = (options.branch || '').trim() || localStorage.getItem('petochania_github_branch') || 'main';

        if (!owner || !repo) {
            throw new Error('Укажите GitHub username (owner) и имя репозитория');
        }

        const testResponse = await fetch('https://api.github.com/repos/' + owner + '/' + repo, {
            headers: GitHubRepoSync.getAuthHeaders(token)
        });

        if (!testResponse.ok) {
            const err = await testResponse.json().catch(function() { return {}; });
            throw new Error(err.message || 'Репозиторий недоступен. Нужен classic token с правом repo');
        }

        const repoInfo = await testResponse.json();
        const resolvedBranch = branch || repoInfo.default_branch || 'main';

        this.owner = owner;
        this.repo = repo;
        this.branch = resolvedBranch;
        localStorage.setItem('petochania_github_owner', owner);
        localStorage.setItem('petochania_github_repo', repo);
        localStorage.setItem('petochania_github_branch', resolvedBranch);
        this.initialized = true;

        await this.syncFromLocalStorage();
        return { success: true, owner: owner, repo: repo, branch: resolvedBranch };
    }
}

window.githubRepoSync = new GitHubRepoSync();
window.githubSyncBackend = window.githubRepoSync;
window.GitHubRepoSync = GitHubRepoSync;
window.GitHubSyncBackend = { getAuthHeaders: GitHubRepoSync.getAuthHeaders };

window.pushToGistIfConfigured = async function pushToGistIfConfigured() {
    const sync = window.githubRepoSync || window.githubSyncBackend;
    if (!sync) return { skipped: true, reason: 'no_backend' };
    await sync.init();
    if (!sync.hasWriteAccess()) return { skipped: true, reason: 'no_write_access' };
    return sync.syncFromLocalStorage();
};
