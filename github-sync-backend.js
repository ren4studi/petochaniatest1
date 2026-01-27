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

    async init() {
        // Получаем токен из localStorage (нужен только для записи)
        this.githubToken = localStorage.getItem('petochania_github_token');
        
        // Получаем Gist ID из конфигурации или localStorage
        // Сначала пробуем загрузить из конфигурационного файла (для всех пользователей)
        if (window.syncConfigLoader) {
            // Ждем загрузки конфигурации
            await window.syncConfigLoader.loadConfig();
            this.gistId = window.syncConfigLoader.getGistId();
        }
        
        // Fallback: из localStorage
        if (!this.gistId) {
            this.gistId = localStorage.getItem('petochania_gist_id');
        }
        
        // Для чтения данных Gist ID достаточно (Gist публичный)
        // Токен нужен только для записи
        if (this.gistId) {
            this.initialized = true;
            console.log('✅ GitHub Sync Backend инициализирован (Gist ID:', this.gistId + ')');
            console.log('📡 Данные будут синхронизироваться с GitHub Gist для всех пользователей');
            if (this.githubToken) {
                console.log('✅ GitHub токен найден, запись в Gist доступна');
            } else {
                console.warn('⚠️ GitHub токен не найден, запись в Gist будет недоступна');
            }
        } else {
            console.warn('⚠️ GitHub Gist ID не настроен. Используется localStorage fallback.');
            console.warn('💡 Настройте синхронизацию в админ-панели для работы на GitHub Pages');
        }
    }

    // Настройка GitHub токена и Gist ID
    async setup(token, gistId = null) {
        this.githubToken = token;
        localStorage.setItem('petochania_github_token', token);
        console.log('✅ GitHub токен сохранен');
        
        if (gistId && gistId.trim()) {
            this.gistId = gistId.trim();
            localStorage.setItem('petochania_gist_id', this.gistId);
            console.log('✅ Gist ID сохранен:', this.gistId);
        } else {
            // Создаем новый Gist
            console.log('Создание нового Gist...');
            this.gistId = await this.createGist();
            localStorage.setItem('petochania_gist_id', this.gistId);
            console.log('✅ Новый Gist создан:', this.gistId);
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
                    public: true, // Публичный Gist для чтения без токена
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
        // Для чтения публичного Gist токен не нужен
        // Токен нужен только для записи
        if (!this.gistId) {
            // Пробуем загрузить Gist ID из localStorage
            this.gistId = localStorage.getItem('petochania_gist_id');
            if (!this.gistId) {
                return this.loadFromLocal();
            }
        }

        try {
            // Загружаем публичный Gist без токена (для чтения)
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn('Gist не найден, используем локальные данные');
                    return this.loadFromLocal();
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
            
            console.log('✅ Данные загружены из публичного Gist');
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

        // Проверяем наличие Gist ID и токена
        if (!this.gistId) {
            // Пробуем загрузить из localStorage или конфига
            if (window.syncConfigLoader) {
                await window.syncConfigLoader.loadConfig();
                this.gistId = window.syncConfigLoader.getGistId();
            }
            if (!this.gistId) {
                this.gistId = localStorage.getItem('petochania_gist_id');
            }
        }
        
        if (!this.githubToken) {
            this.githubToken = localStorage.getItem('petochania_github_token');
        }

        // Для записи нужен токен
        if (!this.gistId || !this.githubToken) {
            console.warn('⚠️ GitHub токен или Gist ID не настроен, данные сохранены только локально');
            console.warn('Gist ID:', this.gistId ? 'есть' : 'отсутствует');
            console.warn('GitHub Token:', this.githubToken ? 'есть' : 'отсутствует');
            return { success: true, localOnly: true };
        }

        try {
            console.log('💾 Сохранение данных в GitHub Gist...', { gistId: this.gistId });
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
                console.error('❌ Ошибка ответа от GitHub API:', response.status, error);
                throw new Error(error.message || `HTTP ${response.status}: Ошибка сохранения в Gist`);
            }

            const result = await response.json();
            console.log('✅ Данные успешно сохранены в GitHub Gist');
            console.log('📡 Gist обновлен:', result.html_url || this.gistId);
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка сохранения данных в Gist:', error);
            console.error('Детали ошибки:', {
                gistId: this.gistId,
                hasToken: !!this.githubToken,
                errorMessage: error.message
            });
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

    // ========== АВТОРИЗАЦИЯ ==========
    async login(username, password) {
        // Простая проверка логина и пароля
        // В продакшене это должно быть более безопасно
        if (username === 'admin' && password === 'admin123') {
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
}

// Создаем глобальный экземпляр
window.githubSyncBackend = new GitHubSyncBackend();

