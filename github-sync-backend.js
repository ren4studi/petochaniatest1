// GitHub Gist Backend Service
// Синхронизация данных между устройствами через GitHub Gist API

const PETOCHANIA_CONFIG_GIST_DESCRIPTION = 'Petochania Sync Config';
const PETOCHANIA_CONFIG_FILENAME = 'petochania-sync-config.json';
const PETOCHANIA_DATA_FILENAME = 'petochania-data.json';

class GitHubSyncBackend {
    constructor() {
        this.gistId = null;
        this.configGistId = null;
        this.githubToken = null;
        this.initialized = false;
        this.GIST_FILENAME = PETOCHANIA_DATA_FILENAME;
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
            this.gistId = window.syncConfigLoader.getGistId();
            this.configGistId = window.syncConfigLoader.getConfigGistId();
        }

        if (!this.gistId) {
            this.gistId = localStorage.getItem('petochania_gist_id');
        }

        if (!this.configGistId) {
            this.configGistId = localStorage.getItem('petochania_config_gist_id');
        }

        if (this.gistId) {
            this.initialized = true;
            console.log('✅ GitHub Sync Backend инициализирован (Gist ID:', this.gistId + ')');
            if (this.configGistId) {
                console.log('✅ Config Gist ID:', this.configGistId);
            }
            if (this.githubToken) {
                console.log('✅ GitHub токен найден, запись в Gist доступна');
            } else {
                console.warn('⚠️ GitHub токен не найден — сайт только читает данные из Gist');
            }
        } else {
            console.warn('⚠️ GitHub Gist ID не настроен. Используется localStorage fallback.');
        }
    }

    hasWriteAccess() {
        return !!(this.gistId && this.githubToken);
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

    async setup(token, gistId = null) {
        this.saveToken(token);

        if (window.syncConfigLoader) {
            await window.syncConfigLoader.loadConfig(true);
        }

        const resolvedGistId = (gistId && gistId.trim()) ||
            window.syncConfigLoader?.getGistId() ||
            localStorage.getItem('petochania_gist_id');

        if (resolvedGistId) {
            this.gistId = resolvedGistId.trim();
            localStorage.setItem('petochania_gist_id', this.gistId);
            console.log('✅ Используется Gist ID:', this.gistId);
        } else {
            console.log('Создание нового Gist для данных...');
            this.gistId = await this.createGist();
            localStorage.setItem('petochania_gist_id', this.gistId);
            console.log('✅ Новый Gist создан:', this.gistId);
        }

        localStorage.setItem('petochania_gist_id_updated', new Date().toISOString());

        await this.syncFromLocalStorage();

        this.configGistId = await this.ensureConfigGist(this.gistId);
        localStorage.setItem('petochania_config_gist_id', this.configGistId);

        if (window.syncConfigLoader) {
            window.syncConfigLoader.configGistId = this.configGistId;
            window.syncConfigLoader.gistId = this.gistId;
        }

        this.initialized = true;
        return {
            success: true,
            gistId: this.gistId,
            configGistId: this.configGistId
        };
    }

    async createGist(initialData = null) {
        if (!this.githubToken) {
            throw new Error('GitHub токен не настроен');
        }

        const data = initialData || this.collectLocalData();

        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                ...GitHubSyncBackend.getAuthHeaders(this.githubToken),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'Petochania Data Sync',
                public: true,
                files: {
                    [this.GIST_FILENAME]: {
                        content: JSON.stringify({
                            ...data,
                            lastSync: new Date().toISOString()
                        }, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Ошибка создания Gist');
        }

        const result = await response.json();
        return result.id;
    }

    async ensureConfigGist(dataGistId) {
        if (!this.githubToken) {
            throw new Error('GitHub токен не настроен');
        }

        const configPayload = {
            gistId: dataGistId,
            lastUpdated: new Date().toISOString()
        };
        const configContent = JSON.stringify(configPayload, null, 2);

        let configGistId = localStorage.getItem('petochania_config_gist_id');

        if (!configGistId) {
            configGistId = await this.findConfigGistId();
        }

        if (configGistId) {
            const updated = await this.updateConfigGist(configGistId, configContent);
            if (updated) {
                return configGistId;
            }
        }

        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                ...GitHubSyncBackend.getAuthHeaders(this.githubToken),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: PETOCHANIA_CONFIG_GIST_DESCRIPTION,
                public: true,
                files: {
                    [PETOCHANIA_CONFIG_FILENAME]: {
                        content: configContent
                    }
                }
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Ошибка создания Config Gist');
        }

        const result = await response.json();
        console.log('✅ Config Gist создан:', result.id);
        return result.id;
    }

    async findConfigGistId() {
        try {
            const response = await fetch('https://api.github.com/gists', {
                headers: GitHubSyncBackend.getAuthHeaders(this.githubToken)
            });

            if (!response.ok) return null;

            const gists = await response.json();
            const found = gists.find(g => g.description === PETOCHANIA_CONFIG_GIST_DESCRIPTION);
            return found ? found.id : null;
        } catch (error) {
            console.warn('Не удалось найти Config Gist:', error);
            return null;
        }
    }

    async updateConfigGist(configGistId, configContent) {
        try {
            const response = await fetch(`https://api.github.com/gists/${configGistId}`, {
                method: 'PATCH',
                headers: {
                    ...GitHubSyncBackend.getAuthHeaders(this.githubToken),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: PETOCHANIA_CONFIG_GIST_DESCRIPTION,
                    files: {
                        [PETOCHANIA_CONFIG_FILENAME]: {
                            content: configContent
                        }
                    }
                })
            });

            if (!response.ok) {
                console.warn('Не удалось обновить Config Gist:', response.status);
                return false;
            }

            console.log('✅ Config Gist обновлён:', configGistId);
            return true;
        } catch (error) {
            console.warn('Ошибка обновления Config Gist:', error);
            return false;
        }
    }

    collectLocalData() {
        try {
            const breedPages = {
                ...JSON.parse(localStorage.getItem('breedPages') || '{}'),
                ...JSON.parse(localStorage.getItem('petochania_breedPages') || '{}')
            };

            return {
                cats: JSON.parse(localStorage.getItem('petochania_cats') || '[]'),
                breedPages,
                faq: JSON.parse(localStorage.getItem('petochania_faq') || '[]'),
                reviews: JSON.parse(localStorage.getItem('petochania_reviews') || '[]'),
                videos: JSON.parse(localStorage.getItem('petochania_videos') || '[]'),
                settings: {
                    ...JSON.parse(localStorage.getItem('petochania_site_settings') || '{}'),
                    social: JSON.parse(localStorage.getItem('petochania_social_settings') || '[]'),
                    seo: JSON.parse(localStorage.getItem('petochania_seo_settings') || '{}')
                }
            };
        } catch (error) {
            console.error('Ошибка сбора локальных данных:', error);
            return {
                cats: [],
                breedPages: {},
                faq: [],
                reviews: [],
                videos: [],
                settings: {}
            };
        }
    }

    async syncFromLocalStorage() {
        const data = this.collectLocalData();
        return this.saveData(data);
    }

    async loadData() {
        if (!this.gistId) {
            this.gistId = localStorage.getItem('petochania_gist_id');
            if (!this.gistId) {
                return this.loadFromLocal();
            }
        }

        try {
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn('Gist не найден, используем локальные данные');
                    return this.loadFromLocal();
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const gist = await response.json();
            const file = gist.files[this.GIST_FILENAME] ||
                gist.files[Object.keys(gist.files)[0]];

            if (!file || !file.content) {
                throw new Error('Файл данных не найден в Gist');
            }

            const data = JSON.parse(file.content);
            this.saveToLocal(data);
            console.log('✅ Данные загружены из Gist');
            return data;
        } catch (error) {
            console.error('Ошибка загрузки данных из Gist:', error);
            return this.loadFromLocal();
        }
    }

    async saveData(data) {
        this.saveToLocal(data);

        if (!this.gistId) {
            if (window.syncConfigLoader) {
                await window.syncConfigLoader.loadConfig(true);
                this.gistId = window.syncConfigLoader.getGistId();
            }
            if (!this.gistId) {
                this.gistId = localStorage.getItem('petochania_gist_id');
            }
        }

        if (!this.githubToken) {
            this.githubToken = localStorage.getItem('petochania_github_token');
        }

        if (!this.gistId || !this.githubToken) {
            console.warn('⚠️ Gist ID или токен не настроены — данные только локально');
            return { success: true, localOnly: true };
        }

        try {
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                method: 'PATCH',
                headers: {
                    ...GitHubSyncBackend.getAuthHeaders(this.githubToken),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        [this.GIST_FILENAME]: {
                            content: JSON.stringify({
                                ...data,
                                lastSync: new Date().toISOString()
                            }, null, 2)
                        }
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}: Ошибка сохранения в Gist`);
            }

            localStorage.setItem('petochania_last_sync', new Date().toISOString());
            localStorage.setItem('petochania_gist_id_updated', new Date().toISOString());

            if (this.configGistId) {
                await this.updateConfigGist(
                    this.configGistId,
                    JSON.stringify({
                        gistId: this.gistId,
                        lastUpdated: new Date().toISOString()
                    }, null, 2)
                );
            }

            console.log('✅ Данные сохранены в GitHub Gist');
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка сохранения в Gist:', error);
            return { success: true, localOnly: true, error: error.message };
        }
    }

    loadFromLocal() {
        return this.collectLocalData();
    }

    saveToLocal(data) {
        try {
            if (data.cats) localStorage.setItem('petochania_cats', JSON.stringify(data.cats));
            if (data.breedPages) {
                localStorage.setItem('breedPages', JSON.stringify(data.breedPages));
                localStorage.setItem('petochania_breedPages', JSON.stringify(data.breedPages));
            }
            if (data.faq) localStorage.setItem('petochania_faq', JSON.stringify(data.faq));
            if (data.reviews) localStorage.setItem('petochania_reviews', JSON.stringify(data.reviews));
            if (data.videos) localStorage.setItem('petochania_videos', JSON.stringify(data.videos));
            if (data.settings) {
                localStorage.setItem('petochania_site_settings', JSON.stringify(data.settings));
                if (data.settings.social) {
                    localStorage.setItem('petochania_social_settings', JSON.stringify(data.settings.social));
                }
                if (data.settings.seo) {
                    localStorage.setItem('petochania_seo_settings', JSON.stringify(data.settings.seo));
                }
            }
        } catch (error) {
            console.error('Ошибка сохранения в localStorage:', error);
        }
    }

    async getCats() {
        const data = await this.loadData();
        return data.cats || [];
    }

    async createCat(catData) {
        const data = await this.loadData();
        const catId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const cat = {
            ...catData,
            id: catId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.cats = data.cats || [];
        data.cats.push(cat);
        await this.saveData(data);
        return { success: true, data: cat };
    }

    async updateCat(id, catData) {
        const data = await this.loadData();
        const index = (data.cats || []).findIndex(c => c.id === id);
        if (index !== -1) {
            data.cats[index] = { ...data.cats[index], ...catData, updated_at: new Date().toISOString() };
            await this.saveData(data);
            return { success: true, data: data.cats[index] };
        }
        return { success: false, error: 'Кошка не найдена' };
    }

    async deleteCat(id) {
        const data = await this.loadData();
        data.cats = (data.cats || []).filter(c => c.id !== id);
        await this.saveData(data);
        return { success: true };
    }

    async getBreedPages() {
        const data = await this.loadData();
        return data.breedPages || {};
    }

    async updateBreedPage(id, breedData) {
        const data = await this.loadData();
        if (!data.breedPages) data.breedPages = {};
        data.breedPages[id] = { ...breedData, id, lastUpdated: new Date().toISOString() };
        await this.saveData(data);
        return { success: true, data: data.breedPages[id] };
    }

    async getFAQ() {
        const data = await this.loadData();
        return (data.faq || []).filter(f => f.active !== false);
    }

    async saveFAQ(faqData) {
        const data = await this.loadData();
        if (!data.faq) data.faq = [];
        const index = data.faq.findIndex(f => f.id === faqData.id);
        if (index !== -1) {
            data.faq[index] = faqData;
        } else {
            data.faq.push(faqData);
        }
        await this.saveData(data);
        return { success: true, data: faqData };
    }

    async deleteFAQ(id) {
        const data = await this.loadData();
        data.faq = (data.faq || []).filter(f => f.id !== id);
        await this.saveData(data);
        return { success: true };
    }

    async getReviews() {
        const data = await this.loadData();
        return (data.reviews || []).filter(r => r.active !== false);
    }

    async saveReview(reviewData) {
        const data = await this.loadData();
        if (!data.reviews) data.reviews = [];
        const index = data.reviews.findIndex(r => r.id === reviewData.id);
        if (index !== -1) {
            data.reviews[index] = reviewData;
        } else {
            data.reviews.push(reviewData);
        }
        await this.saveData(data);
        return { success: true, data: reviewData };
    }

    async getSettings() {
        const data = await this.loadData();
        return data.settings || {};
    }

    async saveSettings(settings) {
        const data = await this.loadData();
        data.settings = { ...data.settings, ...settings };
        await this.saveData(data);
        return { success: true };
    }

    async uploadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const filename = Date.now() + '-' + file.name;
                const data = await this.loadData();
                if (!data.files) data.files = {};
                data.files[filename] = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: e.target.result,
                    uploaded: new Date().toISOString()
                };
                await this.saveData(data);
                resolve({
                    success: true,
                    filename,
                    originalname: file.name,
                    url: e.target.result
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async login(username, password) {
        if (username === 'admin' && (password === 'admin123' || password === 'admin')) {
            const token = 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('petochania_authToken', token);
            return {
                success: true,
                token,
                user: { username, role: 'admin' }
            };
        }
        throw new Error('Неверный логин или пароль');
    }

    getSyncConfigSnippet(configGistId, gistId) {
        return JSON.stringify({
            gistId: gistId || this.gistId,
            configGistId: configGistId || this.configGistId,
            lastUpdated: new Date().toISOString()
        }, null, 2);
    }
}

window.githubSyncBackend = new GitHubSyncBackend();
window.GitHubSyncBackend = GitHubSyncBackend;

window.pushToGistIfConfigured = async function pushToGistIfConfigured() {
    if (!window.githubSyncBackend) return { skipped: true };

    await window.githubSyncBackend.init();

    if (!window.githubSyncBackend.hasWriteAccess()) {
        return { skipped: true, reason: 'no_write_access' };
    }

    const result = await window.githubSyncBackend.syncFromLocalStorage();

    if (result.success && !result.localOnly) {
        localStorage.setItem('petochania_last_sync', new Date().toISOString());
        window.dispatchEvent(new CustomEvent('dataSyncUpdate', {
            detail: { source: 'gist-push', timestamp: new Date().toISOString() }
        }));
    }

    return result;
};
