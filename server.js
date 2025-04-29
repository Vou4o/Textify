const express = require('express');
const fs = require('fs').promises;
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = 3000;

// Для простоты: хранение в файлах по sessionId
const SESSION_DIR = './sessions';

app.use(express.json());
app.use(cookieParser());
app.use(express.static('.')); // раздаёт index.html, style.css, main.js

// Генерируем sessionId и выдаём куку, если её нет
app.use(async (req, res, next) => {
    if (!req.cookies.sessionId) {
        const sessionId = uuidv4();
        res.cookie('sessionId', sessionId, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7 });
        req.sessionId = sessionId;
    } else {
        req.sessionId = req.cookies.sessionId;
    }
    // Убедимся, что папка есть
    await fs.mkdir(SESSION_DIR, { recursive: true });
    next();
});

// Получить историю чата
app.get('/api/history', async (req, res) => {
    try {
        const file = `${SESSION_DIR}/${req.sessionId}.json`;
        const data = await fs.readFile(file, 'utf8');
        res.json(JSON.parse(data));
    } catch {
        res.json([]);
    }
});

// Сохранить историю чата
app.post('/api/history', async (req, res) => {
    try {
        const file = `${SESSION_DIR}/${req.sessionId}.json`;
        await fs.writeFile(file, JSON.stringify(req.body), 'utf8');
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.toString() });
    }
});

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
