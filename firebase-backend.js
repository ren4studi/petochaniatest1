// Firebase Backend Service
// Заменяет Express API для работы на GitHub Pages

class FirebaseBackend {
    constructor() {
        this.initialized = false;
        this.useFirebase = false;
        this.init();
    }

    async init() {
        // Проверяем, доступен ли Firebase
        if (typeof firebase !== 'undefined') {
            try {
                await window.initFirebase();
                this.useFirebase = true;
                this.initialized = true;
                console.log('✅ Firebase Backend инициализирован');
            } catch (error) {
                console.warn('Firebase недоступен, используется localStorage:', error);
                this.useFirebase = false;
            }
        } else {
            console.warn('Firebase не загружен, используется localStorage fallback');
            this.useFirebase = false;
        }
    }

    // ========== КОШКИ ==========
    async getCats() {
        if (this.useFirebase && firestore) {
            try {
                const snapshot = await firestore.collection('cats').orderBy('created_at', 'desc').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Ошибка получения кошек из Firebase:', error);
                return this.getCatsFromLocal();
            }
        }
        return this.getCatsFromLocal();
    }

    getCatsFromLocal() {
        try {
            const cats = JSON.parse(localStorage.getItem('petochania_cats') || '[]');
            return cats;
        } catch (error) {
            console.error('Ошибка получения кошек из localStorage:', error);
            return [];
        }
    }

    async createCat(catData) {
        const catId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const cat = {
            ...catData,
            id: catId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (this.useFirebase && firestore) {
            try {
                await firestore.collection('cats').doc(catId).set(cat);
                this.saveCatToLocal(cat);
                return { success: true, data: cat };
            } catch (error) {
                console.error('Ошибка создания кошки в Firebase:', error);
                this.saveCatToLocal(cat);
                return { success: true, data: cat };
            }
        }

        this.saveCatToLocal(cat);
        return { success: true, data: cat };
    }

    async updateCat(id, catData) {
        const cat = {
            ...catData,
            id: id,
            updated_at: new Date().toISOString()
        };

        if (this.useFirebase && firestore) {
            try {
                await firestore.collection('cats').doc(id).update(cat);
                this.updateCatInLocal(id, cat);
                return { success: true, data: cat };
            } catch (error) {
                console.error('Ошибка обновления кошки в Firebase:', error);
                this.updateCatInLocal(id, cat);
                return { success: true, data: cat };
            }
        }

        this.updateCatInLocal(id, cat);
        return { success: true, data: cat };
    }

    async deleteCat(id) {
        if (this.useFirebase && firestore) {
            try {
                await firestore.collection('cats').doc(id).delete();
                this.deleteCatFromLocal(id);
                return { success: true };
            } catch (error) {
                console.error('Ошибка удаления кошки из Firebase:', error);
                this.deleteCatFromLocal(id);
                return { success: true };
            }
        }

        this.deleteCatFromLocal(id);
        return { success: true };
    }

    saveCatToLocal(cat) {
        const cats = this.getCatsFromLocal();
        cats.push(cat);
        localStorage.setItem('petochania_cats', JSON.stringify(cats));
    }

    updateCatInLocal(id, catData) {
        const cats = this.getCatsFromLocal();
        const index = cats.findIndex(c => c.id === id);
        if (index !== -1) {
            cats[index] = { ...cats[index], ...catData };
            localStorage.setItem('petochania_cats', JSON.stringify(cats));
        }
    }

    deleteCatFromLocal(id) {
        const cats = this.getCatsFromLocal();
        const filtered = cats.filter(c => c.id !== id);
        localStorage.setItem('petochania_cats', JSON.stringify(filtered));
    }

    // ========== СТРАНИЦЫ ПОРОД ==========
    async getBreedPages() {
        if (this.useFirebase && firestore) {
            try {
                const snapshot = await firestore.collection('breed_pages').get();
                const pages = {};
                snapshot.docs.forEach(doc => {
                    pages[doc.id] = { id: doc.id, ...doc.data() };
                });
                return pages;
            } catch (error) {
                console.error('Ошибка получения страниц пород из Firebase:', error);
                return this.getBreedPagesFromLocal();
            }
        }
        return this.getBreedPagesFromLocal();
    }

    getBreedPagesFromLocal() {
        try {
            return JSON.parse(localStorage.getItem('breedPages') || '{}');
        } catch (error) {
            console.error('Ошибка получения страниц пород из localStorage:', error);
            return {};
        }
    }

    async updateBreedPage(id, breedData) {
        if (this.useFirebase && firestore) {
            try {
                await firestore.collection('breed_pages').doc(id).set({
                    ...breedData,
                    last_updated: new Date().toISOString()
                }, { merge: true });
                this.updateBreedPageInLocal(id, breedData);
                return { success: true, data: breedData };
            } catch (error) {
                console.error('Ошибка обновления страницы породы в Firebase:', error);
                this.updateBreedPageInLocal(id, breedData);
                return { success: true, data: breedData };
            }
        }

        this.updateBreedPageInLocal(id, breedData);
        return { success: true, data: breedData };
    }

    updateBreedPageInLocal(id, breedData) {
        const pages = this.getBreedPagesFromLocal();
        pages[id] = { ...breedData, id, lastUpdated: new Date().toISOString() };
        localStorage.setItem('breedPages', JSON.stringify(pages));
    }

    // ========== FAQ ==========
    async getFAQ() {
        if (this.useFirebase && firestore) {
            try {
                const snapshot = await firestore.collection('faq')
                    .where('active', '==', true)
                    .orderBy('order')
                    .get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Ошибка получения FAQ из Firebase:', error);
                return this.getFAQFromLocal();
            }
        }
        return this.getFAQFromLocal();
    }

    getFAQFromLocal() {
        try {
            return JSON.parse(localStorage.getItem('petochania_faq') || '[]');
        } catch (error) {
            return [];
        }
    }

    async saveFAQ(faqData) {
        const faqId = faqData.id || 'faq_' + Date.now();
        const faq = {
            ...faqData,
            id: faqId,
            updated_at: new Date().toISOString()
        };

        if (this.useFirebase && firestore) {
            try {
                await firestore.collection('faq').doc(faqId).set(faq, { merge: true });
                this.saveFAQToLocal(faq);
                return { success: true, data: faq };
            } catch (error) {
                console.error('Ошибка сохранения FAQ в Firebase:', error);
                this.saveFAQToLocal(faq);
                return { success: true, data: faq };
            }
        }

        this.saveFAQToLocal(faq);
        return { success: true, data: faq };
    }

    saveFAQToLocal(faq) {
        const faqs = this.getFAQFromLocal();
        const index = faqs.findIndex(f => f.id === faq.id);
        if (index !== -1) {
            faqs[index] = faq;
        } else {
            faqs.push(faq);
        }
        localStorage.setItem('petochania_faq', JSON.stringify(faqs));
    }

    async deleteFAQ(id) {
        if (this.useFirebase && firestore) {
            try {
                await firestore.collection('faq').doc(id).delete();
                this.deleteFAQFromLocal(id);
                return { success: true };
            } catch (error) {
                console.error('Ошибка удаления FAQ из Firebase:', error);
                this.deleteFAQFromLocal(id);
                return { success: true };
            }
        }

        this.deleteFAQFromLocal(id);
        return { success: true };
    }

    deleteFAQFromLocal(id) {
        const faqs = this.getFAQFromLocal();
        const filtered = faqs.filter(f => f.id !== id);
        localStorage.setItem('petochania_faq', JSON.stringify(filtered));
    }

    // ========== ОТЗЫВЫ ==========
    async getReviews() {
        if (this.useFirebase && firestore) {
            try {
                const snapshot = await firestore.collection('reviews')
                    .where('active', '==', true)
                    .orderBy('date', 'desc')
                    .get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Ошибка получения отзывов из Firebase:', error);
                return this.getReviewsFromLocal();
            }
        }
        return this.getReviewsFromLocal();
    }

    getReviewsFromLocal() {
        try {
            return JSON.parse(localStorage.getItem('petochania_reviews') || '[]');
        } catch (error) {
            return [];
        }
    }

    async saveReview(reviewData) {
        const reviewId = reviewData.id || 'review_' + Date.now();
        const review = {
            ...reviewData,
            id: reviewId,
            updated_at: new Date().toISOString()
        };

        if (this.useFirebase && firestore) {
            try {
                await firestore.collection('reviews').doc(reviewId).set(review, { merge: true });
                this.saveReviewToLocal(review);
                return { success: true, data: review };
            } catch (error) {
                console.error('Ошибка сохранения отзыва в Firebase:', error);
                this.saveReviewToLocal(review);
                return { success: true, data: review };
            }
        }

        this.saveReviewToLocal(review);
        return { success: true, data: review };
    }

    saveReviewToLocal(review) {
        const reviews = this.getReviewsFromLocal();
        const index = reviews.findIndex(r => r.id === review.id);
        if (index !== -1) {
            reviews[index] = review;
        } else {
            reviews.push(review);
        }
        localStorage.setItem('petochania_reviews', JSON.stringify(reviews));
    }

    // ========== ВИДЕО ==========
    async getVideos() {
        if (this.useFirebase && firestore) {
            try {
                const snapshot = await firestore.collection('videos')
                    .where('active', '==', true)
                    .orderBy('order')
                    .get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Ошибка получения видео из Firebase:', error);
                return this.getVideosFromLocal();
            }
        }
        return this.getVideosFromLocal();
    }

    getVideosFromLocal() {
        try {
            return JSON.parse(localStorage.getItem('petochania_videos') || '[]');
        } catch (error) {
            return [];
        }
    }

    // ========== НАСТРОЙКИ ==========
    async getSettings() {
        if (this.useFirebase && firestore) {
            try {
                const snapshot = await firestore.collection('settings').get();
                const settings = {};
                snapshot.docs.forEach(doc => {
                    settings[doc.id] = doc.data().value;
                });
                return settings;
            } catch (error) {
                console.error('Ошибка получения настроек из Firebase:', error);
                return this.getSettingsFromLocal();
            }
        }
        return this.getSettingsFromLocal();
    }

    getSettingsFromLocal() {
        try {
            return JSON.parse(localStorage.getItem('petochania_site_settings') || '{}');
        } catch (error) {
            return {};
        }
    }

    async saveSettings(settings) {
        if (this.useFirebase && firestore) {
            try {
                const batch = firestore.batch();
                for (const [key, value] of Object.entries(settings)) {
                    const ref = firestore.collection('settings').doc(key);
                    batch.set(ref, { value, updated_at: new Date().toISOString() }, { merge: true });
                }
                await batch.commit();
                this.saveSettingsToLocal(settings);
                return { success: true };
            } catch (error) {
                console.error('Ошибка сохранения настроек в Firebase:', error);
                this.saveSettingsToLocal(settings);
                return { success: true };
            }
        }

        this.saveSettingsToLocal(settings);
        return { success: true };
    }

    saveSettingsToLocal(settings) {
        localStorage.setItem('petochania_site_settings', JSON.stringify(settings));
    }

    // ========== АВТОРИЗАЦИЯ ==========
    async login(username, password) {
        // Простая авторизация через localStorage (для демо)
        // В продакшене используйте Firebase Authentication
        const users = JSON.parse(localStorage.getItem('petochania_users') || '[]');
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user || (username === 'admin' && password === 'admin123')) {
            const token = 'token_' + Date.now();
            localStorage.setItem('petochania_authToken', token);
            localStorage.setItem('petochania_currentUser', JSON.stringify({
                id: user?.id || 1,
                username: username,
                name: user?.name || 'Администратор',
                role: 'admin'
            }));
            return {
                success: true,
                token: token,
                user: {
                    id: user?.id || 1,
                    username: username,
                    name: user?.name || 'Администратор',
                    role: 'admin'
                }
            };
        }
        
        throw new Error('Неверный логин или пароль');
    }

    async verifyToken(token) {
        if (localStorage.getItem('petochania_authToken') === token) {
            const user = JSON.parse(localStorage.getItem('petochania_currentUser') || '{}');
            return { success: true, user };
        }
        return { success: false };
    }

    // ========== ЗАГРУЗКА ФАЙЛОВ ==========
    async uploadFile(file) {
        // Для GitHub Pages используем base64 или внешний сервис
        // Можно использовать Firebase Storage или другой сервис
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                const filename = Date.now() + '-' + file.name;
                localStorage.setItem(`petochania_file_${filename}`, base64);
                resolve({
                    success: true,
                    filename: filename,
                    originalname: file.name,
                    mimetype: file.type,
                    size: file.size,
                    url: base64 // Для изображений можно использовать data URL
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// Создаем глобальный экземпляр
window.firebaseBackend = new FirebaseBackend();

