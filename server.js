const express = require('express');
const fs = require('fs').promises;
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const app = express();
const PORT = 3000;

const SESSION_DIR = './sessions';

app.use(express.json());
app.use(cookieParser());
app.use(express.static('.'));

app.use(async (req, res, next) => {
    if (!req.cookies.sessionId) {
        const sessionId = uuidv4();
        res.cookie('sessionId', sessionId, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7 });
        req.sessionId = sessionId;
    } else {
        req.sessionId = req.cookies.sessionId;
    }
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

// Получить статус оплаты
app.get('/api/status', async (req, res) => {
    try {
        const file = `${SESSION_DIR}/${req.sessionId}-status.json`;
        const data = await fs.readFile(file, 'utf8');
        res.json(JSON.parse(data));
    } catch {
        res.json({ paid: false });
    }
});

// Установить статус оплаты (вызывается с successURL после оплаты)
app.get('/api/set-paid', async (req, res) => {
    try {
        const file = `${SESSION_DIR}/${req.sessionId}-status.json`;
        await fs.writeFile(file, JSON.stringify({ paid: true }), 'utf8');
        // После установки оплаты редиректим на главную страницу
        res.redirect('/');
    } catch (e) {
        res.status(500).send('Ошибка сервера');
    }
});

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
