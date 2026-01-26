// data-sync.js - Синхронизация данных между страницами
console.log('data-sync.js загружается...');

class DataSync {
    constructor() {
        this.STORAGE_KEY = 'petochania_sync_data';
        this.BREED_PAGES_KEY = 'breedPages';
        this.CATS_KEY = 'cats';
        this.SETTINGS_KEY = 'settings';
        console.log('DataSync конструктор вызван');
        this.init();
    }

    async init() {
        console.log('DataSync инициализируется');
        await this.loadInitialData();
        this.setupStorageListener();
        console.log('DataSync готов к работе');
    }

    async loadInitialData() {
        console.log('Загрузка начальных данных...');
        
        // Пытаемся загрузить данные из GitHub Gist, если настроен
        // Проверяем наличие Gist ID (для публичного Gist токен не нужен)
        const gistId = localStorage.getItem('petochania_gist_id');
        if (window.githubSyncBackend && gistId) {
            try {
                console.log('Попытка загрузки данных из GitHub Gist...');
                const gistData = await window.githubSyncBackend.loadData();
                if (gistData && Object.keys(gistData).length > 0) {
                    console.log('✅ Данные загружены из GitHub Gist');
                    // Синхронизируем данные из Gist в localStorage
                    if (gistData.cats) {
                        localStorage.setItem(this.CATS_KEY, JSON.stringify(gistData.cats));
                    }
                    if (gistData.breedPages) {
                        localStorage.setItem(this.BREED_PAGES_KEY, JSON.stringify(gistData.breedPages));
                    }
                    if (gistData.settings) {
                        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(gistData.settings));
                    }
                    if (gistData.faq) {
                        localStorage.setItem('petochania_faq', JSON.stringify(gistData.faq));
                    }
                    if (gistData.reviews) {
                        localStorage.setItem('petochania_reviews', JSON.stringify(gistData.reviews));
                    }
                    if (gistData.videos) {
                        localStorage.setItem('petochania_videos', JSON.stringify(gistData.videos));
                    }
                    // Обновляем время последней синхронизации
                    localStorage.setItem('petochania_last_sync', new Date().toISOString());
                    return;
                }
            } catch (error) {
                console.warn('Не удалось загрузить данные из GitHub Gist:', error);
            }
        }
        
        // Проверяем основные данные
        let allData = this.getAllData();
        
        if (Object.keys(allData).length === 0 || !allData.breedPages) {
            console.log('Нет данных или нет пород, создаем начальные...');
            allData = {
                breedPages: this.getDefaultBreedPages(),
                cats: [],
                settings: this.getDefaultSettings(),
                lastSync: new Date().toISOString()
            };
            this.saveAllData(allData);
        }
        
        // Проверяем отдельные хранилища
        if (!localStorage.getItem(this.BREED_PAGES_KEY)) {
            localStorage.setItem(this.BREED_PAGES_KEY, JSON.stringify(allData.breedPages));
        }
        
        if (!localStorage.getItem(this.CATS_KEY)) {
            localStorage.setItem(this.CATS_KEY, JSON.stringify(allData.cats));
        }
    }

    // В классе DataSync добавьте:
getBreedCats(breedName) {
    try {
        console.log('Поиск котят для породы:', breedName);
        const cats = this.getAllCats();
        console.log('Всего кошек в системе:', cats.length);
        
        const filteredCats = cats.filter(cat => {
            if (!cat.breed) {
                console.log('Коша без породы:', cat.name);
                return false;
            }
            
            const catBreedLower = cat.breed.toLowerCase();
            const searchNameLower = breedName.toLowerCase();
            
            const matches = catBreedLower.includes(searchNameLower) || 
                           searchNameLower.includes(catBreedLower);
            
            if (matches) {
                console.log('Найден котенок:', cat.name, 'порода:', cat.breed);
            }
            
            return matches;
        });
        
        console.log('Найдено котят для породы', breedName + ':', filteredCats.length);
        return filteredCats;
    } catch (error) {
        console.error('Error getting breed cats:', error);
        return [];
    }
}

    getDefaultBreedPages() {
        return {
            'chinchilla': {
                id: 'chinchilla',
                title: 'Золотая Шиншилла',
                heroDescription: 'Аристократичные британцы с роскошной золотистой шерстью и королевским характером',
                description: 'Золотые шиншиллы — одна из самых красивых и редких пород кошек. Их шерсть имеет уникальный золотистый оттенок с затемнениями на кончиках, создавая эффект сияния. Эти аристократичные кошки обладают спокойным и уравновешенным характером, идеально подходят для жизни в семье.',
                origin: 'Великобритания',
                weight: '4-6 кг',
                lifespan: '12-15 лет',
                temperament: 'Спокойный, нежный',
                characteristics: ['Любопытный', 'Дружелюбный', 'Элегантный', 'Спокойный', 'Независимый'],
                mainImage: 'img/goldshinshina.JPG',
                lastUpdated: new Date().toISOString()
            },
            'devon': {
                id: 'devon',
                title: 'Девон-рекс',
                heroDescription: 'Энергичные и любвеобильные кошки с инопланетной внешностью и собачьим характером',
                description: 'Девон-рекс — порода домашних кошек, появившаяся в Великобритании в 1960-х годах. Эти кошки отличаются уникальной волнистой шерстью, большими ушами и выразительными глазами. Девон-рексы очень социальные и преданные кошки, которые любят быть в центре внимания.',
                origin: 'Великобритания',
                weight: '3-4.5 кг',
                lifespan: '9-15 лет',
                temperament: 'Активный, игривый',
                characteristics: ['Ласковый', 'Игривый', 'Умный', 'Общительный', 'Энергичный'],
                mainImage: 'img/devon-reks.JPG',
                lastUpdated: new Date().toISOString()
            },
            'munchkin': {
                id: 'munchkin',
                title: 'Манчкин',
                heroDescription: 'Очаровательные коротколапые кошки с уникальной внешностью и дружелюбным нравом',
                description: 'Манчкины — уникальная порода кошек с короткими лапками, появившаяся в результате естественной генетической мутации. Несмотря на короткие конечности, эти кошки очень подвижны и активны. Манчкины известны своим дружелюбным и общительным характером.',
                origin: 'США',
                weight: '3-4 кг',
                lifespan: '12-15 лет',
                temperament: 'Дружелюбный, любопытный',
                characteristics: ['Величественная', 'Умная', 'Любопытная', 'Дружелюбная', 'Общительная'],
                mainImage: 'img/machkin.JPG',
                lastUpdated: new Date().toISOString()
            }
        };
    }

    getDefaultSettings() {
        return {
            siteTitle: "Petochania",
            siteDescription: "Питомник элитных кошек",
            contactPhone: "8 926 150 2870",
            contactEmail: "",
            socialLinks: [
                { name: "Telegram", url: "https://t.me/tata_procats" },
                { name: "WhatsApp", url: "https://wa.me/message/Y4ZYRHELPNHUE1" },
                { name: "VK", url: "https://vk.com/petochania" },
                { name: "Facebook", url: "https://www.facebook.com/share/1A33qj8Nbm/?mibextid=wwXIfr" },
                { name: "TikTok", url: "https://www.tiktok.com/@tata.vygodnaya?_t=ZS-90PLbDoj2kE&_r=1" },
                { name: "Instagram", url: "https://www.instagram.com/petochania?igsh=MWR3bHhpNjhnd3g3dw%3D%3D&utm_source=qr" }
            ]
        };
    }

    setupStorageListener() {
        window.addEventListener('storage', (event) => {
            if (event.key === this.STORAGE_KEY || 
                event.key === this.BREED_PAGES_KEY || 
                event.key === this.CATS_KEY) {
                console.log('Данные обновлены, триггерим событие...');
                this.triggerUpdateEvent();
            }
        });
    }

    triggerUpdateEvent() {
        try {
            const updateEvent = new CustomEvent('dataSyncUpdate', {
                detail: { 
                    timestamp: new Date().toISOString(),
                    source: 'DataSync'
                }
            });
            window.dispatchEvent(updateEvent);
        } catch (error) {
            console.error('Ошибка при триггере события:', error);
        }
    }

    // ========== ОСНОВНЫЕ МЕТОДЫ ==========
    
    getAllData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Error getting all data:', error);
            return {};
        }
    }

    saveAllData(data) {
        try {
            const dataToSave = {
                ...data,
                lastSync: new Date().toISOString()
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
            
            // Также сохраняем в отдельных ключах для быстрого доступа
            if (data.breedPages) {
                localStorage.setItem(this.BREED_PAGES_KEY, JSON.stringify(data.breedPages));
            }
            if (data.cats) {
                localStorage.setItem(this.CATS_KEY, JSON.stringify(data.cats));
            }
            if (data.settings) {
                localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(data.settings));
            }
            
            // Триггерим обновление
            this.triggerUpdateEvent();
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            return false;
        }
    }

    // ========== МЕТОДЫ ДЛЯ ПОРОД ==========
    
    getAllBreeds() {
        try {
            const breedPages = JSON.parse(localStorage.getItem(this.BREED_PAGES_KEY) || '{}');
            return breedPages;
        } catch (error) {
            console.error('Error getting all breeds:', error);
            return this.getDefaultBreedPages();
        }
    }

    getBreedData(breedId) {
        try {
            // Пробуем из быстрого хранилища
            const breedPages = JSON.parse(localStorage.getItem(this.BREED_PAGES_KEY) || '{}');
            if (breedPages[breedId]) {
                return breedPages[breedId];
            }
            
            // Пробуем из основного хранилища
            const allData = this.getAllData();
            if (allData.breedPages && allData.breedPages[breedId]) {
                return allData.breedPages[breedId];
            }
            
            // Возвращаем данные по умолчанию
            return this.getDefaultBreedPages()[breedId];
            
        } catch (error) {
            console.error('Error getting breed data:', error);
            return this.getDefaultBreedPages()[breedId];
        }
    }

    updateBreedData(breedId, breedData) {
        try {
            const allData = this.getAllData();
            if (!allData.breedPages) allData.breedPages = {};
            
            allData.breedPages[breedId] = {
                ...breedData,
                id: breedId,
                lastUpdated: new Date().toISOString()
            };
            
            return this.saveAllData(allData);
        } catch (error) {
            console.error('Error updating breed data:', error);
            return false;
        }
    }

    // ========== МЕТОДЫ ДЛЯ КОШЕК ==========
    
    getAllCats() {
        try {
            // Пробуем из быстрого хранилища
            const cats = JSON.parse(localStorage.getItem(this.CATS_KEY) || '[]');
            if (cats.length > 0) {
                return cats;
            }
            
            // Пробуем из основного хранилища
            const allData = this.getAllData();
            return allData.cats || [];
        } catch (error) {
            console.error('Error getting cats:', error);
            return [];
        }
    }

    getBreedCats(breedName) {
        try {
            const cats = this.getAllCats();
            return cats.filter(cat => {
                if (!cat.breed) return false;
                return cat.breed.toLowerCase().includes(breedName.toLowerCase());
            });
        } catch (error) {
            console.error('Error getting breed cats:', error);
            return [];
        }
    }

    updateCat(catData) {
        try {
            const cats = this.getAllCats();
            const index = cats.findIndex(c => c.id == catData.id);
            
            if (index !== -1) {
                // Обновляем существующую кошку
                cats[index] = { 
                    ...cats[index], 
                    ...catData, 
                    updatedAt: new Date().toISOString() 
                };
            } else {
                // Добавляем новую кошку
                const newCat = {
                    id: Date.now().toString(),
                    ...catData,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                cats.push(newCat);
            }
            
            const allData = this.getAllData();
            allData.cats = cats;
            return this.saveAllData(allData);
            
        } catch (error) {
            console.error('Error updating cat:', error);
            return false;
        }
    }

    deleteCat(catId) {
        try {
            const cats = this.getAllCats();
            const filteredCats = cats.filter(c => c.id != catId);
            
            const allData = this.getAllData();
            allData.cats = filteredCats;
            return this.saveAllData(allData);
            
        } catch (error) {
            console.error('Error deleting cat:', error);
            return false;
        }
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========
    
    clearAllData() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem(this.BREED_PAGES_KEY);
            localStorage.removeItem(this.CATS_KEY);
            localStorage.removeItem(this.SETTINGS_KEY);
            this.loadInitialData();
            this.triggerUpdateEvent();
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }

    checkForUpdates() {
        try {
            const lastUpdate = localStorage.getItem('petochania_last_update') || '0';
            const currentTime = Date.now();
            const lastUpdateTime = parseInt(lastUpdate);
            
            return (currentTime - lastUpdateTime) < 30000;
        } catch (error) {
            return false;
        }
    }

    markAsUpdated() {
        localStorage.setItem('petochania_last_update', Date.now().toString());
    }

    // Для отладки
    debug() {
        console.log('=== DataSync Debug ===');
        console.log('Все данные:', this.getAllData());
        console.log('Все породы:', this.getAllBreeds());
        console.log('Все кошки:', this.getAllCats());
        console.log('Storage Key:', this.STORAGE_KEY);
        console.log('=====================');
        return {
            allData: this.getAllData(),
            breeds: this.getAllBreeds(),
            cats: this.getAllCats()
        };
    }
}

// Экспортируем класс
window.DataSync = DataSync;

// Создаем глобальный экземпляр
try {
    window.dataSync = new DataSync();
    console.log('Глобальный экземпляр dataSync создан');
} catch (error) {
    console.error('Ошибка при создании глобального экземпляра:', error);
}

// Для обратной совместимости
window.PetochaniaData = {
    getData: () => {
        const ds = window.dataSync || new DataSync();
        return ds.getAllData();
    },
    saveData: (data) => {
        const ds = window.dataSync || new DataSync();
        return ds.saveAllData(data);
    },
    getBreedData: (breedId) => {
        const ds = window.dataSync || new DataSync();
        return ds.getBreedData(breedId);
    },
    getCatsByBreed: (breedName) => {
        const ds = window.dataSync || new DataSync();
        return ds.getBreedCats(breedName);
    }
};

console.log('✅ data-sync.js загружен успешно');

// Автоматическая отладка при загрузке
setTimeout(() => {
    if (window.dataSync) {
        console.log('Авто-отладка DataSync:');
        window.dataSync.debug();
    }
}, 500);

// ========== ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ ДЛЯ НОВЫХ РАЗДЕЛОВ ==========

// FAQ методы
DataSync.prototype.getFAQ = function() {
    try {
        const faqs = JSON.parse(localStorage.getItem('petochania_faq') || '[]');
        return Array.isArray(faqs) ? faqs : [];
    } catch (error) {
        console.error('Error getting FAQ:', error);
        return [];
    }
};

DataSync.prototype.getActiveFAQ = function() {
    try {
        const faqs = this.getFAQ();
        return faqs.filter(faq => faq.active !== false)
                   .sort((a, b) => (a.order || 999) - (b.order || 999));
    } catch (error) {
        console.error('Error getting active FAQ:', error);
        return [];
    }
};

// Reviews методы
DataSync.prototype.getReviews = function() {
    try {
        const reviews = JSON.parse(localStorage.getItem('petochania_reviews') || '[]');
        return Array.isArray(reviews) ? reviews : [];
    } catch (error) {
        console.error('Error getting reviews:', error);
        return [];
    }
};

DataSync.prototype.getActiveReviews = function() {
    try {
        const reviews = this.getReviews();
        return reviews.filter(review => review.active !== false)
                      .sort((a, b) => {
                          const dateA = new Date(a.date || a.createdAt);
                          const dateB = new Date(b.date || b.createdAt);
                          return dateB - dateA;
                      });
    } catch (error) {
        console.error('Error getting active reviews:', error);
        return [];
    }
};

// Videos методы
DataSync.prototype.getVideos = function() {
    try {
        const videos = JSON.parse(localStorage.getItem('petochania_videos') || '[]');
        return Array.isArray(videos) ? videos : [];
    } catch (error) {
        console.error('Error getting videos:', error);
        return [];
    }
};

DataSync.prototype.getMainVideos = function() {
    try {
        const videos = this.getVideos();
        return videos.filter(video => 
            video.active !== false && 
            video.category === 'main'
        ).sort((a, b) => (a.order || 999) - (b.order || 999));
    } catch (error) {
        console.error('Error getting main videos:', error);
        return [];
    }
};

// Settings методы
DataSync.prototype.getSiteSettings = function() {
    try {
        return JSON.parse(localStorage.getItem('petochania_site_settings') || '{}');
    } catch (error) {
        console.error('Error getting site settings:', error);
        return {};
    }
};

DataSync.prototype.getSocialSettings = function() {
    try {
        const settings = JSON.parse(localStorage.getItem('petochania_social_settings') || '[]');
        return Array.isArray(settings) ? settings : [];
    } catch (error) {
        console.error('Error getting social settings:', error);
        return [];
    }
};

// Для обратной совместимости обновите PetochaniaData
window.PetochaniaData = {
    getData: () => {
        const ds = window.dataSync || new DataSync();
        return ds.getAllData();
    },
    saveData: (data) => {
        const ds = window.dataSync || new DataSync();
        return ds.saveAllData(data);
    },
    getBreedData: (breedId) => {
        const ds = window.dataSync || new DataSync();
        return ds.getBreedData(breedId);
    },
    getCatsByBreed: (breedName) => {
        const ds = window.dataSync || new DataSync();
        return ds.getBreedCats(breedName);
    },
    getFAQ: () => {
        const ds = window.dataSync || new DataSync();
        return ds.getFAQ();
    },
    getReviews: () => {
        const ds = window.dataSync || new DataSync();
        return ds.getReviews();
    },
    getVideos: () => {
        const ds = window.dataSync || new DataSync();
        return ds.getVideos();
    }
};

console.log('✅ data-sync.js обновлен с поддержкой новых разделов');
