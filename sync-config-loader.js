// Загрузка конфигурации синхронизации (owner/repo/branch) для всех страниц сайта

class SyncConfigLoader {
    constructor() {
        this.configUrl = 'sync-config.json';
        this.owner = null;
        this.repo = null;
        this.branch = 'main';
        this.dataFile = 'site-data.json';
        this.lastUpdated = null;
        this.loadPromise = null;
    }

    async loadConfig(force) {
        if (this.loadPromise && !force) {
            return this.loadPromise;
        }
        this.loadPromise = this._loadConfigInternal();
        return this.loadPromise;
    }

    async _loadConfigInternal() {
        try {
            const response = await fetch(this.configUrl + '?t=' + Date.now());
            if (response.ok) {
                const fileConfig = await response.json();
                this.owner = fileConfig.githubOwner || fileConfig.owner || null;
                this.repo = fileConfig.githubRepo || fileConfig.repo || null;
                this.branch = fileConfig.githubBranch || fileConfig.branch || 'main';
                this.dataFile = fileConfig.dataFile || 'site-data.json';
                this.lastUpdated = fileConfig.lastUpdated || null;

                if (this.owner) localStorage.setItem('petochania_github_owner', this.owner);
                if (this.repo) localStorage.setItem('petochania_github_repo', this.repo);
                if (this.branch) localStorage.setItem('petochania_github_branch', this.branch);
                if (this.dataFile) localStorage.setItem('petochania_data_file', this.dataFile);

                console.log('✅ sync-config.json: ' + (this.owner || '?') + '/' + (this.repo || '?'));
            }
        } catch (error) {
            console.warn('Не удалось загрузить sync-config.json:', error);
        }

        this.owner = this.owner || localStorage.getItem('petochania_github_owner');
        this.repo = this.repo || localStorage.getItem('petochania_github_repo');
        this.branch = localStorage.getItem('petochania_github_branch') || this.branch || 'main';
        this.dataFile = localStorage.getItem('petochania_data_file') || this.dataFile || 'site-data.json';

        if (!this.owner || !this.repo) {
            console.warn('⚠️ Репозиторий не настроен. Настройте синхронизацию в админ-панели.');
        }

        return this.getRepoConfig();
    }

    getRepoConfig() {
        return {
            owner: this.owner || localStorage.getItem('petochania_github_owner'),
            repo: this.repo || localStorage.getItem('petochania_github_repo'),
            branch: this.branch || localStorage.getItem('petochania_github_branch') || 'main',
            dataFile: this.dataFile || localStorage.getItem('petochania_data_file') || 'site-data.json'
        };
    }

    // Совместимость со старым кодом (Gist больше не используется)
    getGistId() {
        return null;
    }

    getConfigGistId() {
        return null;
    }
}

window.syncConfigLoader = new SyncConfigLoader();
