// GitHub Gist Backend Service
// Использует GitHub Gist API для синхронизации данных между устройствами
// Работает без дополнительных сервисов, только с GitHub аккаунтом

class GitHubSyncBackend {
    constructor() {
        this.gistId = null;
        this.githubToken = null;
        this.initialized = false;
        this.GIST_FILENAME = 'petochania-data.json';
        this.init();
    }

    init() {
        // Получаем токен и ID gist из localStorage или запрашиваем у пользователя
        this.githubToken = localStorage.getItem('petochania_github_token');
        this.gistId = localStorage.getItem('petochania_gist_id');
        
        if (this.githubToken && this.gistId) {
            this.initialized = true;
            console.log('✅ GitHub Sync Backend инициализирован');
        } else {
            console.warn('GitHub токен не настроен. Используется localStorage fallback.');
        }
    }

    // Настройка GitHub токена и Gist ID
    async setup(token, gistId = null) {
        this.githubToken = token;
        localStorage.setItem('petochania_github_token', token);
        
        if (gistId) {
            this.gistId = gistId;
            localStorage.setItem('petochania_gist_id', gistId);
        } else {
            // Создаем новый Gist
            this.gistId = await this.createGist();
        }
        
        this.initialized = true;
        return { success: true, gistId: this.gistId };
    }

    // Создание нового Gist
    async createGist() {
        if (!this.githubToken) {
            throw new Error('GitHub токен не настроен');
        }

        const initialData = {
            cats: [],
            breedPages: {},
            faq: [],
            reviews: [],
            videos: [],
            settings: {},
            lastSync: new Date().toISOString()
        };

        try {
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    description: 'Petochania Data Sync',
                    public: false,
                    files: {
                        [this.GIST_FILENAME]: {
                            content: JSON.stringify(initialData, null, 2)
                        }
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Ошибка создания Gist');
            }

            const data = await response.json();
            this.gistId = data.id;
            localStorage.setItem('petochania_gist_id', this.gistId);
            console.log('✅ Создан новый Gist:', this.gistId);
            return this.gistId;
        } catch (error) {
            console.error('Ошибка создания Gist:', error);
            throw error;
        }
    }

    // Загрузка данных из Gist
    async loadData() {
        if (!this.initialized || !this.gistId || !this.githubToken) {
            return this.loadFromLocal();
        }

        try {
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Gist не найден, создаем новый
                    await this.createGist();
                    return this.loadData();
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const gist = await response.json();
            const file = gist.files[this.GIST_FILENAME];
            
            if (!file) {
                throw new Error('Файл данных не найден в Gist');
            }

            const data = JSON.parse(file.content);
            
            // Сохраняем в localStorage как кеш
            this.saveToLocal(data);
            
            return data;
        } catch (error) {
            console.error('Ошибка загрузки данных из Gist:', error);
            return this.loadFromLocal();
        }
    }

    // Сохранение данных в Gist
    async saveData(data) {
        // Сначала сохраняем локально для быстрого доступа
        this.saveToLocal(data);

        if (!this.initialized || !this.gistId || !this.githubToken) {
            console.warn('GitHub не настроен, данные сохранены только локально');
            return { success: true, localOnly: true };
        }

        try {
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
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
                const error = await response.json();
                throw new Error(error.message || 'Ошибка сохранения в Gist');
            }

            console.log('✅ Данные сохранены в GitHub Gist');
            return { success: true };
        } catch (error) {
            console.error('Ошибка сохранения данных в Gist:', error);
            // Данные уже сохранены локально, продолжаем работу
            return { success: true, localOnly: true, error: error.message };
        }
    }

    // Загрузка из localStorage
    loadFromLocal() {
        try {
            const data = {
                cats: JSON.parse(localStorage.getItem('petochania_cats') || '[]'),
                breedPages: JSON.parse(localStorage.getItem('breedPages') || '{}'),
                faq: JSON.parse(localStorage.getItem('petochania_faq') || '[]'),
                reviews: JSON.parse(localStorage.getItem('petochania_reviews') || '[]'),
                videos: JSON.parse(localStorage.getItem('petochania_videos') || '[]'),
                settings: JSON.parse(localStorage.getItem('petochania_site_settings') || '{}')
            };
            return data;
        } catch (error) {
            console.error('Ошибка загрузки из localStorage:', error);
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

    // Сохранение в localStorage
    saveToLocal(data) {
        try {
            if (data.cats) localStorage.setItem('petochania_cats', JSON.stringify(data.cats));
            if (data.breedPages) localStorage.setItem('breedPages', JSON.stringify(data.breedPages));
            if (data.faq) localStorage.setItem('petochania_faq', JSON.stringify(data.faq));
            if (data.reviews) localStorage.setItem('petochania_reviews', JSON.stringify(data.reviews));
            if (data.videos) localStorage.setItem('petochania_videos', JSON.stringify(data.videos));
            if (data.settings) localStorage.setItem('petochania_site_settings', JSON.stringify(data.settings));
        } catch (error) {
            console.error('Ошибка сохранения в localStorage:', error);
        }
    }

    // ========== МЕТОДЫ ДЛЯ КОШЕК ==========
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
        data.cats.push(cat);
        await this.saveData(data);
        return { success: true, data: cat };
    }

    async updateCat(id, catData) {
        const data = await this.loadData();
        const index = data.cats.findIndex(c => c.id === id);
        if (index !== -1) {
            data.cats[index] = { ...data.cats[index], ...catData, updated_at: new Date().toISOString() };
            await this.saveData(data);
            return { success: true, data: data.cats[index] };
        }
        return { success: false, error: 'Кошка не найдена' };
    }

    async deleteCat(id) {
        const data = await this.loadData();
        data.cats = data.cats.filter(c => c.id !== id);
        await this.saveData(data);
        return { success: true };
    }

    // ========== МЕТОДЫ ДЛЯ ПОРОД ==========
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

    // ========== МЕТОДЫ ДЛЯ FAQ ==========
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

    // ========== МЕТОДЫ ДЛЯ ОТЗЫВОВ ==========
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

    // ========== МЕТОДЫ ДЛЯ НАСТРОЕК ==========
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

    // ========== ЗАГРУЗКА ФАЙЛОВ ==========
    async uploadFile(file) {
        // Для файлов используем base64 и сохраняем в данных
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
                    data: e.target.result, // base64
                    uploaded: new Date().toISOString()
                };
                await this.saveData(data);
                resolve({
                    success: true,
                    filename: filename,
                    originalname: file.name,
                    url: e.target.result
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// Создаем глобальный экземпляр
window.githubSyncBackend = new GitHubSyncBackend();

