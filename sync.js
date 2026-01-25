// sync.js - Скрипт для синхронизации данных с сервером

class DataSync {
    constructor() {
        this.API_BASE = `${window.location.origin}/api`;
        this.SYNC_INTERVAL = 30 * 1000; // 30 секунд
        this.data = {
            breedPages: {},
            cats: [],
            lastSync: null
        };
        this.isSyncing = false;
    }

    // Загрузить данные с сервера
    async loadFromServer() {
        if (this.isSyncing) return this.data;
        
        this.isSyncing = true;
        try {
            console.log('Загрузка данных с сервера...');
            const response = await fetch(`${this.API_BASE}/sync-data`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const serverData = await response.json();
            
            // Обновляем только если данные новее
            if (!this.data.lastSync || new Date(serverData.lastSync) > new Date(this.data.lastSync)) {
                this.data = serverData;
                console.log('Данные обновлены с сервера');
            } else {
                console.log('Локальные данные актуальны');
            }
            
            return this.data;
        } catch (error) {
            console.error('Ошибка загрузки данных с сервера:', error);
            
            // Пробуем загрузить из localStorage как запасной вариант
            const localData = this.loadFromStorage();
            if (localData) {
                this.data = localData;
                console.log('Используем данные из localStorage');
            }
            
            return this.data;
        } finally {
            this.isSyncing = false;
        }
    }

    // Сохранить данные в localStorage (кеш)
    saveToStorage(data) {
        try {
            localStorage.setItem('petochania_cache', JSON.stringify(data));
            console.log('Данные сохранены в кеш');
        } catch (error) {
            console.error('Ошибка сохранения в localStorage:', error);
        }
    }

    // Загрузить данные из localStorage (кеш)
    loadFromStorage() {
        try {
            const cached = localStorage.getItem('petochania_cache');
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (error) {
            console.error('Ошибка загрузки из localStorage:', error);
        }
        return null;
    }

    // Начать периодическую синхронизацию
    startAutoSync() {
        // Синхронизация сразу при загрузке
        this.loadFromServer();
        
        // Периодическая синхронизация
        setInterval(() => {
            this.loadFromServer();
        }, this.SYNC_INTERVAL);
        
        console.log('Автосинхронизация запущена');
    }

    // Получить данные для конкретной породы
    getBreedData(breedId) {
        return this.data.breedPages?.[breedId] || null;
    }

    // Получить кошек по породе
    getBreedCats(breedName) {
        const cats = this.data.cats || [];
        
        return cats.filter(cat => {
            if (!cat.breed) return false;
            
            const catBreedLower = cat.breed.toLowerCase();
            const searchNameLower = breedName.toLowerCase();
            
            return catBreedLower.includes(searchNameLower) || 
                   searchNameLower.includes(catBreedLower);
        });
    }

    // Получить все данные
    getAllData() {
        return this.data;
    }

    // Сохранить данные на сервер (админ панель)
    async saveToServer(data, type = 'all') {
        try {
            const token = localStorage.getItem('petochania_authToken');
            
            const response = await fetch(`${this.API_BASE}/sync-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error('Ошибка сохранения на сервере');
            }
            
            const result = await response.json();
            console.log('Данные сохранены на сервер:', result);
            
            // Обновляем локальные данные
            if (data.breedPages) {
                this.data.breedPages = data.breedPages;
            }
            if (data.cats) {
                this.data.cats = data.cats;
            }
            this.data.lastSync = new Date().toISOString();
            
            // Сохраняем в кеш
            this.saveToStorage(this.data);
            
            return result;
        } catch (error) {
            console.error('Ошибка сохранения на сервер:', error);
            throw error;
        }
    }
}

// Экспорт для использования в других скриптах
window.DataSync = DataSync;

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.petochaniaDataSync === 'undefined') {
        window.petochaniaDataSync = new DataSync();
        window.petochaniaDataSync.startAutoSync();
    }
});