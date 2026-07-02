// Загрузка конфигурации синхронизации для всех пользователей сайта

const PETOCHANIA_CONFIG_FILENAME = 'petochania-sync-config.json';

class SyncConfigLoader {
    constructor() {
        this.configUrl = 'sync-config.json';
        this.gistId = null;
        this.configGistId = null;
        this.lastUpdated = null;
        this.loadPromise = null;
    }

    async loadConfig(force = false) {
        if (this.loadPromise && !force) {
            return this.loadPromise;
        }
        this.loadPromise = this._loadConfigInternal();
        return this.loadPromise;
    }

    async _loadConfigInternal() {
        let fileConfig = {};

        try {
            const response = await fetch(`${this.configUrl}?t=${Date.now()}`);
            if (response.ok) {
                fileConfig = await response.json();
            }
        } catch (error) {
            console.warn('Не удалось загрузить sync-config.json:', error);
        }

        if (fileConfig.configGistId) {
            this.configGistId = fileConfig.configGistId;
            localStorage.setItem('petochania_config_gist_id', fileConfig.configGistId);
        } else {
            this.configGistId = localStorage.getItem('petochania_config_gist_id');
        }

        let resolvedGistId = null;
        let resolvedUpdated = null;

        // 1. Config Gist — актуальный ID для всех устройств (обновляется через gist-токен)
        if (this.configGistId) {
            const liveConfig = await this.fetchConfigFromGist(this.configGistId);
            if (liveConfig?.gistId) {
                resolvedGistId = liveConfig.gistId;
                resolvedUpdated = liveConfig.lastUpdated || null;
                console.log('✅ Gist ID загружен из Config Gist:', resolvedGistId);
            }
        }

        // 2. sync-config.json в репозитории
        if (fileConfig.gistId) {
            const fileUpdated = fileConfig.lastUpdated ? new Date(fileConfig.lastUpdated).getTime() : 0;
            const liveUpdated = resolvedUpdated ? new Date(resolvedUpdated).getTime() : 0;

            if (!resolvedGistId || fileUpdated > liveUpdated) {
                resolvedGistId = fileConfig.gistId;
                resolvedUpdated = fileConfig.lastUpdated || null;
                console.log('✅ Gist ID загружен из sync-config.json:', resolvedGistId);
            }
        }

        // 3. localStorage (устройство администратора)
        const localGistId = localStorage.getItem('petochania_gist_id');
        const localUpdated = localStorage.getItem('petochania_gist_id_updated');
        if (localGistId && localStorage.getItem('petochania_github_token')) {
            const localTime = localUpdated ? new Date(localUpdated).getTime() : 0;
            const resolvedTime = resolvedUpdated ? new Date(resolvedUpdated).getTime() : 0;
            if (!resolvedGistId || localTime > resolvedTime) {
                resolvedGistId = localGistId;
                resolvedUpdated = localUpdated;
            }
        }

        if (resolvedGistId) {
            this.gistId = resolvedGistId;
            this.lastUpdated = resolvedUpdated;
            localStorage.setItem('petochania_gist_id', resolvedGistId);
        }

        if (!this.gistId) {
            console.warn('⚠️ Gist ID не найден. Настройте синхронизацию в админ-панели.');
        }

        return this.gistId;
    }

    async fetchConfigFromGist(configGistId) {
        try {
            const response = await fetch(`https://api.github.com/gists/${configGistId}`, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });

            if (!response.ok) {
                console.warn('Config Gist недоступен:', response.status);
                return null;
            }

            const gist = await response.json();
            const file = gist.files[PETOCHANIA_CONFIG_FILENAME] ||
                gist.files[Object.keys(gist.files)[0]];

            if (!file?.content) return null;
            return JSON.parse(file.content);
        } catch (error) {
            console.warn('Ошибка чтения Config Gist:', error);
            return null;
        }
    }

    getGistId() {
        return this.gistId || localStorage.getItem('petochania_gist_id');
    }

    getConfigGistId() {
        return this.configGistId || localStorage.getItem('petochania_config_gist_id');
    }
}

window.syncConfigLoader = new SyncConfigLoader();
