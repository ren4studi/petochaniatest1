// GitHub Repository Sync — данные сайта в файле site-data.json в репозитории
// Чтение: raw.githubusercontent.com (без токена)
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
        this.fileSha = null;
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
            console.log('✅ GitHub Repo Sync: ' + this.owner + '/' + this.repo + ' → ' + this.dataFile);
            if (this.githubToken) {
                console.log('✅ Токен найден — запись в репозиторий доступна');
            } else {
                console.log('ℹ️ Токен не задан — только чтение site-data.json');
            }
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
            if (response.status !== 404) {
                console.warn('site-data.json недоступен:', response.status);
            }
        } catch (error) {
            console.warn('Ошибка загрузки site-data.json:', error);
        }
        return null;
    }

    async getFileSha() {
        const apiUrl = 'https://api.github.com/repos/' + this.owner + '/' + this.repo +
            '/contents/' + encodeURIComponent(this.dataFile) + '?ref=' + encodeURIComponent(this.branch);

        const response = await fetch(apiUrl, {
            headers: GitHubRepoSync.getAuthHeaders(this.githubToken)
        });

        if (response.ok) {
            const fileData = await response.json();
            this.fileSha = fileData.sha;
            return fileData.sha;
        }
        if (response.status === 404) return null;

        const error = await response.json().catch(function() { return {}; });
        throw new Error(error.message || 'Ошибка чтения файла (HTTP ' + response.status + ')');
    }

    isShaConflictError(message) {
        if (!message) return false;
        const text = String(message).toLowerCase();
        return text.includes('does not match') ||
            text.includes('sha') && text.includes('match') ||
            text.includes('409');
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
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
        const apiUrl = 'https://api.github.com/repos/' + this.owner + '/' + this.repo + '/contents/' +
            encodeURIComponent(this.dataFile);

        const body = {
            message: 'Update site data from Petochania admin panel',
            content: content,
            branch: this.branch
        };
        if (sha) body.sha = sha;

        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: Object.assign(
                { 'Content-Type': 'application/json' },
                GitHubRepoSync.getAuthHeaders(this.githubToken)
            ),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json().catch(function() { return {}; });
            const err = new Error(error.message || 'Ошибка сохранения в репозиторий (HTTP ' + response.status + ')');
            err.status = response.status;
            throw err;
        }

        const result = await response.json();
        if (result.content && result.content.sha) {
            this.fileSha = result.content.sha;
        }
        return result;
    }

    async saveDataOnce(data) {
        const remote = await this.loadData();
        const merged = this.mergeWithRemote(remote, data);
        const payload = Object.assign({}, merged, { lastSync: new Date().toISOString() });

        const maxAttempts = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const sha = await this.getFileSha();
            try {
                await this.putSiteDataFile(payload, sha);
                localStorage.setItem('petochania_last_sync', payload.lastSync);
                return { success: true };
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts && (error.status === 409 || this.isShaConflictError(error.message))) {
                    console.warn('Конфликт версии site-data.json, повтор ' + (attempt + 1) + '/' + maxAttempts);
                    await new Promise(function(resolve) { setTimeout(resolve, 400 * attempt); });
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
        this._saveQueue = this._saveQueue.then(function() {
            return self.saveDataOnce(data);
        }).catch(function(error) {
            console.error('Ошибка очереди сохранения:', error);
            throw error;
        });

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

        const testUrl = 'https://api.github.com/repos/' + owner + '/' + repo;
        const testResponse = await fetch(testUrl, {
            headers: GitHubRepoSync.getAuthHeaders(token)
        });

        if (!testResponse.ok) {
            const err = await testResponse.json().catch(function() { return {}; });
            throw new Error(err.message || 'Репозиторий недоступен. Нужен classic token с правом repo');
        }

        this.owner = owner;
        this.repo = repo;
        this.branch = branch;
        localStorage.setItem('petochania_github_owner', owner);
        localStorage.setItem('petochania_github_repo', repo);
        localStorage.setItem('petochania_github_branch', branch);
        this.initialized = true;

        await this.syncFromLocalStorage();

        return { success: true, owner: owner, repo: repo, branch: branch };
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
