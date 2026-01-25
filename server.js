const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/uploads', express.static('uploads'));

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'video/mp4': 'mp4',
            'video/webm': 'webm'
        };
        
        if (allowedTypes[file.mimetype]) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый тип файла'), false);
        }
    }
});

// Инициализация базы данных
let db;
async function initDatabase() {
    db = await open({
        filename: 'petochania.db',
        driver: sqlite3.Database
    });

    // Создание таблиц
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cats (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            breed TEXT NOT NULL,
            gender TEXT NOT NULL,
            status TEXT NOT NULL,
            color TEXT,
            age INTEGER,
            price INTEGER,
            litter TEXT,
            parents TEXT,
            description TEXT,
            characteristics TEXT,
            images TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS breed_pages (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            hero_description TEXT NOT NULL,
            origin TEXT,
            weight TEXT,
            lifespan TEXT,
            temperament TEXT,
            characteristics TEXT,
            main_image TEXT,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS faq (
            id TEXT PRIMARY KEY,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            category TEXT DEFAULT 'Общие',
            "order" INTEGER DEFAULT 1,
            tags TEXT,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            author TEXT NOT NULL,
            text TEXT NOT NULL,
            rating INTEGER DEFAULT 5,
            city TEXT,
            date DATE,
            image TEXT,
            featured BOOLEAN DEFAULT 0,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            type TEXT DEFAULT 'youtube',
            description TEXT,
            thumbnail TEXT,
            video_file TEXT,
            video_type TEXT,
            video_name TEXT,
            youtube_id TEXT,
            embed_url TEXT,
            "order" INTEGER DEFAULT 1,
            category TEXT DEFAULT 'main',
            active BOOLEAN DEFAULT 1,
            autoplay BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Создаем администратора по умолчанию
    const adminExists = await db.get("SELECT * FROM users WHERE username = 'admin'");
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.run(
            "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
            ['admin', hashedPassword, 'Администратор', 'admin']
        );
        console.log('Создан администратор по умолчанию: admin / admin123');
    }

    // Добавляем настройки по умолчанию
    const defaultSettings = [
        ['site_title', 'Petochania'],
        ['site_tagline', 'Питомник элитных кошек'],
        ['contact_phone', '8 926 150 2870'],
        ['contact_email', ''],
        ['contact_address', 'Москва, Россия'],
        ['working_hours', 'Ежедневно 10:00 - 20:00'],
        ['site_description', ''],
        ['meta_title', ''],
        ['meta_description', ''],
        ['meta_keywords', ''],
        ['google_analytics', '']
    ];

    for (const [key, value] of defaultSettings) {
        await db.run(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            [key, value]
        );
    }

    console.log('База данных инициализирована');
}

// Middleware для проверки JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
}

// Логирование активности
async function logActivity(userId, action, description) {
    try {
        await db.run(
            "INSERT INTO activity_log (user_id, action, description) VALUES (?, ?, ?)",
            [userId, action, description]
        );
    } catch (error) {
        console.error('Ошибка логирования активности:', error);
    }
}

// API роуты

// Аутентификация
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
        if (!user) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        await logActivity(user.id, 'login', 'Вход в систему');

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const user = await db.get("SELECT id, username, name, role FROM users WHERE id = ?", [req.user.id]);
        if (!user) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }
        
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Загрузка файлов
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        await logActivity(req.user.id, 'upload', `Загрузка файла: ${req.file.filename}`);

        res.json({
            success: true,
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Ошибка загрузки файла' });
    }
});

// Кошки
app.get('/api/cats', async (req, res) => {
    try {
        const cats = await db.all("SELECT * FROM cats ORDER BY created_at DESC");
        res.json({ success: true, data: cats });
    } catch (error) {
        console.error('Get cats error:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

app.post('/api/cats', authenticateToken, async (req, res) => {
    try {
        const catData = req.body;
        const catId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        await db.run(
            `INSERT INTO cats (
                id, name, breed, gender, status, color, age, price, litter, parents,
                description, characteristics, images
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                catId,
                catData.name,
                catData.breed,
                catData.gender,
                catData.status,
                catData.color || '',
                catData.age || null,
                catData.price || null,
                catData.litter || '',
                catData.parents || '',
                catData.description || '',
                catData.characteristics || '',
                JSON.stringify(catData.images || [])
            ]
        );

        await logActivity(req.user.id, 'create', `Добавлена кошка: ${catData.name}`);

        res.json({ success: true, data: { id: catId, ...catData } });
    } catch (error) {
        console.error('Create cat error:', error);
        res.status(500).json({ error: 'Ошибка создания кошки' });
    }
});

app.put('/api/cats/:id', authenticateToken, async (req, res) => {
    try {
        const catId = req.params.id;
        const catData = req.body;
        
        await db.run(
            `UPDATE cats SET
                name = ?, breed = ?, gender = ?, status = ?, color = ?, age = ?,
                price = ?, litter = ?, parents = ?, description = ?,
                characteristics = ?, images = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [
                catData.name,
                catData.breed,
                catData.gender,
                catData.status,
                catData.color || '',
                catData.age || null,
                catData.price || null,
                catData.litter || '',
                catData.parents || '',
                catData.description || '',
                catData.characteristics || '',
                JSON.stringify(catData.images || []),
                catId
            ]
        );

        await logActivity(req.user.id, 'update', `Обновлена кошка: ${catData.name}`);

        res.json({ success: true, data: catData });
    } catch (error) {
        console.error('Update cat error:', error);
        res.status(500).json({ error: 'Ошибка обновления кошки' });
    }
});

app.delete('/api/cats/:id', authenticateToken, async (req, res) => {
    try {
        const catId = req.params.id;
        const cat = await db.get("SELECT name FROM cats WHERE id = ?", [catId]);
        
        if (!cat) {
            return res.status(404).json({ error: 'Кошка не найдена' });
        }

        await db.run("DELETE FROM cats WHERE id = ?", [catId]);
        await logActivity(req.user.id, 'delete', `Удалена кошка: ${cat.name}`);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete cat error:', error);
        res.status(500).json({ error: 'Ошибка удаления кошки' });
    }
});

// Страницы пород
app.get('/api/breed-pages', async (req, res) => {
    try {
        const pages = await db.all("SELECT * FROM breed_pages");
        res.json({ success: true, data: pages });
    } catch (error) {
        console.error('Get breed pages error:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

app.post('/api/breed-pages/:id', authenticateToken, async (req, res) => {
    try {
        const pageId = req.params.id;
        const pageData = req.body;
        
        const existing = await db.get("SELECT id FROM breed_pages WHERE id = ?", [pageId]);
        
        if (existing) {
            await db.run(
                `UPDATE breed_pages SET
                    title = ?, description = ?, hero_description = ?, origin = ?,
                    weight = ?, lifespan = ?, temperament = ?, characteristics = ?,
                    main_image = ?, last_updated = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [
                    pageData.title,
                    pageData.description,
                    pageData.heroDescription,
                    pageData.origin || '',
                    pageData.weight || '',
                    pageData.lifespan || '',
                    pageData.temperament || '',
                    JSON.stringify(pageData.characteristics || []),
                    pageData.mainImage || '',
                    pageId
                ]
            );
        } else {
            await db.run(
                `INSERT INTO breed_pages (
                    id, title, description, hero_description, origin, weight,
                    lifespan, temperament, characteristics, main_image
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    pageId,
                    pageData.title,
                    pageData.description,
                    pageData.heroDescription,
                    pageData.origin || '',
                    pageData.weight || '',
                    pageData.lifespan || '',
                    pageData.temperament || '',
                    JSON.stringify(pageData.characteristics || []),
                    pageData.mainImage || ''
                ]
            );
        }

        await logActivity(req.user.id, 'update', `Обновлена страница породы: ${pageData.title}`);

        res.json({ success: true, data: pageData });
    } catch (error) {
        console.error('Update breed page error:', error);
        res.status(500).json({ error: 'Ошибка обновления страницы породы' });
    }
});

// FAQ
app.get('/api/faq', async (req, res) => {
    try {
        const faq = await db.all("SELECT * FROM faq WHERE active = 1 ORDER BY \"order\" ASC, created_at DESC");
        res.json({ success: true, data: faq });
    } catch (error) {
        console.error('Get FAQ error:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

app.post('/api/faq', authenticateToken, async (req, res) => {
    try {
        const faqData = req.body;
        const faqId = faqData.id || 'faq_' + Date.now();
        
        if (faqData.id) {
            await db.run(
                `UPDATE faq SET
                    question = ?, answer = ?, category = ?, "order" = ?,
                    tags = ?, active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [
                    faqData.question,
                    faqData.answer,
                    faqData.category || 'Общие',
                    faqData.order || 1,
                    JSON.stringify(faqData.tags || []),
                    faqData.active ? 1 : 0,
                    faqData.id
                ]
            );
        } else {
            await db.run(
                `INSERT INTO faq (id, question, answer, category, "order", tags, active)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    faqId,
                    faqData.question,
                    faqData.answer,
                    faqData.category || 'Общие',
                    faqData.order || 1,
                    JSON.stringify(faqData.tags || []),
                    faqData.active ? 1 : 0
                ]
            );
        }

        await logActivity(req.user.id, faqData.id ? 'update' : 'create', 
            `${faqData.id ? 'Обновлен' : 'Добавлен'} вопрос: ${faqData.question}`);

        res.json({ success: true, data: { ...faqData, id: faqId } });
    } catch (error) {
        console.error('Save FAQ error:', error);
        res.status(500).json({ error: 'Ошибка сохранения вопроса' });
    }
});

app.delete('/api/faq/:id', authenticateToken, async (req, res) => {
    try {
        const faqId = req.params.id;
        await db.run("DELETE FROM faq WHERE id = ?", [faqId]);
        await logActivity(req.user.id, 'delete', `Удален вопрос FAQ`);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete FAQ error:', error);
        res.status(500).json({ error: 'Ошибка удаления вопроса' });
    }
});

// Отзывы
app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await db.all("SELECT * FROM reviews WHERE active = 1 ORDER BY date DESC, created_at DESC");
        res.json({ success: true, data: reviews });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

app.post('/api/reviews', authenticateToken, async (req, res) => {
    try {
        const reviewData = req.body;
        const reviewId = reviewData.id || 'review_' + Date.now();
        
        if (reviewData.id) {
            await db.run(
                `UPDATE reviews SET
                    author = ?, text = ?, rating = ?, city = ?, date = ?,
                    image = ?, featured = ?, active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [
                    reviewData.author,
                    reviewData.text,
                    reviewData.rating || 5,
                    reviewData.city || '',
                    reviewData.date || new Date().toISOString().split('T')[0],
                    reviewData.image || '',
                    reviewData.featured ? 1 : 0,
                    reviewData.active ? 1 : 0,
                    reviewData.id
                ]
            );
        } else {
            await db.run(
                `INSERT INTO reviews (id, author, text, rating, city, date, image, featured, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    reviewId,
                    reviewData.author,
                    reviewData.text,
                    reviewData.rating || 5,
                    reviewData.city || '',
                    reviewData.date || new Date().toISOString().split('T')[0],
                    reviewData.image || '',
                    reviewData.featured ? 1 : 0,
                    reviewData.active ? 1 : 0
                ]
            );
        }

        await logActivity(req.user.id, reviewData.id ? 'update' : 'create', 
            `${reviewData.id ? 'Обновлен' : 'Добавлен'} отзыв от: ${reviewData.author}`);

        res.json({ success: true, data: { ...reviewData, id: reviewId } });
    } catch (error) {
        console.error('Save review error:', error);
        res.status(500).json({ error: 'Ошибка сохранения отзыва' });
    }
});

// Видео
app.get('/api/videos', async (req, res) => {
    try {
        const videos = await db.all("SELECT * FROM videos WHERE active = 1 ORDER BY category, \"order\" ASC");
        res.json({ success: true, data: videos });
    } catch (error) {
        console.error('Get videos error:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

// Настройки
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await db.all("SELECT key, value FROM settings");
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = setting.value;
        });
        
        res.json({ success: true, data: settingsObj });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Ошибка получения настроек' });
    }
});

app.post('/api/settings', authenticateToken, async (req, res) => {
    try {
        const settings = req.body;
        
        for (const [key, value] of Object.entries(settings)) {
            await db.run(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                [key, value]
            );
        }

        await logActivity(req.user.id, 'update', 'Обновлены настройки сайта');
        res.json({ success: true });
    } catch (error) {
        console.error('Save settings error:', error);
        res.status(500).json({ error: 'Ошибка сохранения настроек' });
    }
});

// Статистика
app.get('/api/stats', async (req, res) => {
    try {
        const totalCats = await db.get("SELECT COUNT(*) as count FROM cats");
        const availableCats = await db.get("SELECT COUNT(*) as count FROM cats WHERE status = 'ДОСТУПЕН'");
        const totalQuestions = await db.get("SELECT COUNT(*) as count FROM faq WHERE active = 1");
        const totalReviews = await db.get("SELECT COUNT(*) as count FROM reviews WHERE active = 1");
        
        res.json({
            success: true,
            data: {
                totalCats: totalCats.count,
                availableCats: availableCats.count,
                totalQuestions: totalQuestions.count,
                totalReviews: totalReviews.count
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Ошибка получения статистики' });
    }
});

// Активность
app.get('/api/activity', authenticateToken, async (req, res) => {
    try {
        const activity = await db.all(`
            SELECT a.*, u.name as user_name 
            FROM activity_log a 
            LEFT JOIN users u ON a.user_id = u.id 
            ORDER BY a.created_at DESC 
            LIMIT 10
        `);
        
        res.json({ success: true, data: activity });
    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({ error: 'Ошибка получения активности' });
    }
});

// Статические файлы
app.use(express.static('.'));

// Запуск сервера
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, () => {
        console.log(`Сервер запущен на порту ${PORT}`);
        console.log(`Админ-панель: http://localhost:${PORT}/admin-panel-backend.html`);
        console.log(`API: http://localhost:${PORT}/api/`);
    });
}

startServer().catch(console.error);