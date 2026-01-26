// Автоматическая загрузка конфигурации синхронизации
// Этот файл загружает Gist ID из публичного файла sync-config.json

class SyncConfigLoader {
    constructor() {
        this.configUrl = 'sync-config.json';
        this.gistId = null;
        this.loadConfig();
    }

    async loadConfig() {
        try {
            // Пытаемся загрузить конфигурацию из файла
            const response = await fetch(this.configUrl + '?t=' + Date.now());
            
            if (response.ok) {
                const config = await response.json();
                if (config.gistId) {
                    this.gistId = config.gistId;
                    // Сохраняем в localStorage для быстрого доступа
                    localStorage.setItem('petochania_gist_id', config.gistId);
                    console.log('✅ Gist ID загружен из конфигурации:', config.gistId);
                    return config.gistId;
                }
            }
        } catch (error) {
            console.warn('Не удалось загрузить конфигурацию из файла:', error);
        }

        // Fallback: проверяем localStorage
        const savedGistId = localStorage.getItem('petochania_gist_id');
        if (savedGistId) {
            this.gistId = savedGistId;
            console.log('✅ Gist ID загружен из localStorage:', savedGistId);
            return savedGistId;
        }

        console.warn('⚠️ Gist ID не найден. Синхронизация не будет работать.');
        return null;
    }

    getGistId() {
        return this.gistId || localStorage.getItem('petochania_gist_id');
    }
}

// Создаем глобальный экземпляр
window.syncConfigLoader = new SyncConfigLoader();

