const paymentBlock = document.getElementById('payment-block');
const generateForm = document.getElementById('generate-form');
const chatHistoryDiv = document.getElementById('chat-history');
const loader = document.getElementById('loader');
const btn = document.getElementById('generate-btn');
const payBtn = document.getElementById('pay-btn');
const dialogButtons = document.getElementById('dialog-buttons');
const yesBtn = document.getElementById('yes-btn');
const noBtn = document.getElementById('no-btn');
const downloadBtn = document.getElementById('download-btn');
const modalBg = document.getElementById('modal-bg');
const modal = document.querySelector('.modal');
const dialogInput = document.getElementById('dialog-input');
const dialogLabel = document.getElementById('dialog-label');
const dialogSendBtn = document.getElementById('dialog-send-btn');
const dialogCancelBtn = document.getElementById('dialog-cancel-btn');

const PPLX_API_KEY = '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';
const MODEL = 'sonar-pro';

const API_HISTORY_URL = '/api/history';
const API_STATUS_URL = '/api/status';

let messages = [
    {
        role: "system",
        content: "Ты - помощник, который пишет научные работы для студентов и исследователей. Соблюдай академический стиль, структуру и достоверность."
    }
];
let firstPromptIndex = 1;
let paymentPassed = false;
let dialogCallback = null;

// --- Проверка статуса оплаты ---
async function checkPaymentStatus() {
    const res = await fetch(API_STATUS_URL);
    const data = await res.json();
    paymentPassed = !!data.paid;
    if (paymentPassed) {
        paymentBlock.style.display = 'none';
        generateForm.style.display = 'block';
    } else {
        paymentBlock.style.display = 'block';
        generateForm.style.display = 'none';
    }
}

// --- Оплата через YooKassa ---
payBtn.addEventListener('click', function (e) {
    e.preventDefault();
    // successURL должен вести на /api/set-paid, который выставит статус оплаты и редиректнет на /
    window.location.href = 'https://yookassa.ru/my/i/aBC60S-KnGtx/l?successURL=' + encodeURIComponent(window.location.origin + '/api/set-paid');
});

// --- Загрузка истории с сервера ---
async function loadHistoryFromServer() {
    try {
        const res = await fetch(API_HISTORY_URL);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                messages = data;
                renderChatHistory();
                if (messages.length > 2) showDialogButtons();
            }
        }
    } catch (e) { /* ignore */ }
}

// --- Сохранение истории на сервер ---
async function saveHistoryToServer() {
    try {
        await fetch(API_HISTORY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messages)
        });
    } catch (e) { /* ignore */ }
}

// --- Рендер истории чата ---
function renderChatHistory() {
    chatHistoryDiv.innerHTML = '';
    for (let i = firstPromptIndex + 1; i < messages.length; ++i) {
        const msg = messages[i];
        const div = document.createElement('div');
        div.className = 'chat-message ' + (msg.role === 'user' ? 'user' : 'assistant');
        const role = msg.role === 'user' ? 'Вы' : 'Textify';
        div.innerHTML = `<span class="role">${role}:</span>${markdownToHtml(msg.content)}`;
        chatHistoryDiv.appendChild(div);
    }
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
    saveHistoryToServer();
}

// --- Markdown -> HTML ---
function markdownToHtml(md) {
    let html = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    html = html.replace(/((?:\|[^\n]+\|(?:\n|$))+)/g, function(tableBlock) {
        const rows = tableBlock.trim().split('\n').filter(r => r.trim().startsWith('|'));
        if (rows.length < 2) return tableBlock;
        let thead = '', tbody = '';
        const headers = rows[0].split('|').slice(1, -1).map(s => s.trim());
        thead = '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
        for (let i = 2; i < rows.length; ++i) {
            const cols = rows[i].split('|').slice(1, -1).map(s => s.trim());
            tbody += '<tr>' + cols.map(c => `<td>${c}</td>`).join('') + '</tr>';
        }
        return `<table>${thead}<tbody>${tbody}</tbody></table>`;
    });
    html = html.replace(/(^|\n)[\*\-]\s([^\n]+)/g, '$1<ul><li>$2</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = '<p>' + html.replace(/\n/g, '<br>') + '</p>';
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*([^\*]+)\*/g, '<i>$1</i>');
    return html;
}

// --- Кнопки диалога ---
function showDialogButtons() {
    dialogButtons.style.display = 'flex';
    downloadBtn.style.display = 'inline-flex';
}
function hideDialogButtons() {
    dialogButtons.style.display = 'none';
    downloadBtn.style.display = 'none';
}

// --- Модальное окно для диалога ---
function showDialogModal({label, big, callback}) {
    dialogLabel.textContent = label;
    dialogInput.value = '';
    dialogInput.placeholder = label;
    if (big) {
        modal.classList.add('big-text');
    } else {
        modal.classList.remove('big-text');
    }
    modalBg.style.display = 'flex';
    dialogInput.focus();
    dialogCallback = callback;
}
function hideDialogModal() {
    modalBg.style.display = 'none';
    dialogCallback = null;
}
dialogSendBtn.onclick = function() {
    if (dialogCallback && dialogInput.value.trim()) {
        dialogCallback(dialogInput.value.trim());
        hideDialogModal();
    }
};
dialogCancelBtn.onclick = function() {
    hideDialogModal();
};
modalBg.onclick = function(e) {
    if (e.target === modalBg) hideDialogModal();
};
document.addEventListener('keydown', function(e) {
    if (e.key === "Escape") hideDialogModal();
});

// --- Отправка запроса к Perplexity ---
async function sendToPerplexity(userContent) {
    messages.push({ role: "user", content: userContent });
    renderChatHistory();
    loader.style.display = 'inline-block';
    hideDialogButtons();
    btn.disabled = true;
    try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'Authorization': `Bearer ${PPLX_API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: messages,
                max_tokens: 1800,
                temperature: 0.7
            })
        });
        if (!response.ok) {
            throw new Error('Ошибка при обращении к Perplexity API: ' + response.status);
        }
        const data = await response.json();
        let generated = '';
        if (data.choices && data.choices.length > 0) {
            if (data.choices[0].message && data.choices[0].message.content) {
                generated = data.choices[0].message.content;
            } else if (data.choices[0].text) {
                generated = data.choices[0].text;
            }
        } else {
            generated = 'Ответ не получен. Попробуйте изменить запрос.';
        }
        messages.push({ role: "assistant", content: generated });
        renderChatHistory();
        showDialogButtons();
    } catch (err) {
        messages.push({ role: "assistant", content: 'Ошибка: ' + err.message });
        renderChatHistory();
    } finally {
        loader.style.display = 'none';
        btn.disabled = false;
    }
}

// --- Обработка формы ---
generateForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!paymentPassed) {
        alert('Пожалуйста, оплатите генерацию работы!');
        return;
    }
    const topic = document.getElementById('topic').value.trim();
    const requirements = document.getElementById('requirements').value.trim();
    let prompt = `Напиши курсовую работу на тему "${topic}".`;
    if (requirements) prompt += ` Требования: ${requirements}.`;
    prompt += ` ЧАСТЬ ПЕРВАЯ
Запомни этот промт, и жди тему, учитывай что промт содержит 2 части: 
 Промт для пошагового создания курсовой работы
Следуйте инструкциям внимательно и ждите подтверждения после каждого этапа.
Для начала просто жди тему, а затем содержание
1.Содержание
- Уточните, есть ли уже готовое содержание. Если нет, составьте содержание из 2 глав, в каждой из которых по 3 подпункта.
- Уточните, есть ли дополнительные требования к работе. Если да, то учтите их. Если нет, дождитесь утверждения перед переходом к следующему этапу.
✅ Вас устраивает структура? (Да/Нет/Изменить пункт №...)
При ответе нет, не приступай к начинанию следующего раздела без команды, а жди правок
2.Введение
Составьте введение сплошным текстом на 700 слов, разделяя его на абзацы в соответствии с содержанием. Включите следующие элементы:
- Небольшое обозрение темы (70 слов);
- Предмет исследования;
- Объект исследования;
- Актуальность темы;
- Методы исследования;
- Цель и задачи исследования;
- Теоретическая значимость работы;
- Практическая значимость работы;
- Структура работы.
✅ Устраивает  раздел Введение? (Да/Нет/Добавить элемент из списка требований)
При ответе нет, не приступай к начинанию следующего раздела без команды, а жди правок
3.Теоретическая глава
Для таблиц по всей работе примени следующие значения:
- Делайте сквозную нумерацию по всей работе;
- Расставляйте их по смыслу;
- Сделайте подводку (например: «В таблице 1 представлено...»);
- Добавьте название к каждой таблице;
- После каждой таблицы сделайте вывод в одно предложение.
В таблице 1 представлено...
Таблица 1 –
Вид задолженности
Характеристика

Задолженность перед поставщиками и подрядчиками
Возникает при покупке товаров, работ, услуг с отсрочкой платежа

Как видно из таблицы 1...
Первая глава. Тебе необходимо составить каждый раздел курсовой работы на 700 слов, не символов.
На протяжении каждого раздела должна быть логическая связка, т.е, например, если параграф называется «Виды и функции государства», то тебе необходимсо сделать плавный переход от видов, к функциям.
Структура каждого параграфа первой главы индивидуальна своим макетами, разберем более подробно:
Макет 1.1:  ОБЪЕМ 700 слов с учетом компонентов ниже
1.Абзац на 70 слов, сплошным текстом
2.Затем идет логическая связка со следующим абзацем и маркированный список состоящий из 3-5 пунктов.
3.Затем идет логическая связка со следующим абзацем, на 80 слов, сплошным текстом
4.Затем идет логически правильно встроенная по тексту подводка к таблице 1, сама таблица и вывод после нее.
5.Затем идет логическая связка со следующим абзацем, на 80 слов, сплошным текстом
6.Затем идет логическая связка со следующим абзацем и маркированный список состоящий из 3-5 пунктов.
7.Затем идет логически правильно встроенная по тексту подводка к таблице 2, сама таблица и вывод после нее.
8.После всего делай вывод по разделу 1.1
✅ Подтвердите готовность перейти к 1.2 (Да/Нет)
При ответе нет, не приступай к начинанию следующего раздела без команды, а жди правок
Макет 1.2  ОБЪЕМ 700 слов с учетом компонентов ниже
1.Абзац на 70 слов, сплошным текстом
2.Затем идет логическая связка со следующим абзацем и маркированный список состоящий из 3-5 пунктов.
3.Затем идет логическая связка со следующим абзацем, на 80 слов, сплошным текстом
4.Затем идет логическая связка со следующим абзацем, на 80 слов, сплошным текстом
5.Затем идет логически правильно встроенная по тексту подводка к таблице 3, сама таблица и вывод после нее.
6.Затем идет логическая связка со следующим абзацем, на 80 слов, сплошным текстом
7.Затем идет логически правильно встроенная по тексту подводка к таблице 4, сама таблица и вывод после нее.
8.После всего делай вывод по разделу 1.2
✅ Подтвердите готовность перейти к 1.3 (Да/Нет)
Макет 1.3  ОБЪЕМ 700 слов с учетом компонентов ниже
1.Абзац на 70 слов, сплошным текстом
2.Затем идет логическая связка со следующим абзацем и маркированный список состоящий из 3-5 пунктов.
3.Затем идет логическая связка со следующим абзацем, на 80 слов, сплошным текстом
4.Затем идет логически правильно встроенная по тексту подводка к таблице 5, сама таблица и вывод после нее.
5.Затем идет логическая связка со следующим абзацем, на 80 слов, сплошным текстом
6.Затем идет логическая связка со следующим абзацем, на 80 слов, сплошным текстом
7.Затем идет логически правильно встроенная по тексту подводка к таблице 6, сама таблица и вывод после нее.
8.Затем идет логическая связка со следующим абзацем, на 80 слов, сплошным текстом
9.После всего делай вывод по разделу 1.3
✅ Подтвердите готовность перейти ко 2 части работы и загрузите соответсвующий промт.
ЧАСТЬ ВТОРАЯ

4.Практическая глава
Далее переходи ко второй главе тебе необходимо составить разделы курсовой работы на 800 слов, не символов.
На протяжении каждого раздела должна быть логическая связка, т.е, например, если в параграфе 2.1 было сказано о основных показателях и ты использовал их, а в следующем параграфе 2.2 заходит речь о показателях, испоьзуй те, что были в  параграфе 2.1, то же самое применяй в 2.3 Помимо того, применяй логическую связку между абзацами всего параграфа, т.е, например, если параграф называется «Виды и функции государства», то тебе необходимо сделать плавный переход от видов, к функциям.
Учитывай следующее важное примечание:делай на основе реальных данных и годах 2021-2024.
Структура каждого параграфа второй главы индивидуальна своим макетами, разберем более подробно:
2.1 ОБЪЕМ 800 слов с учетом компонентов ниже
1.Абзац на 100 слов, сплошным текстом
2.Затем идет логическая связка со следующим абзацем и маркированный список состоящий из 3-5 пунктов.
3.Затем идет логическая связка со следующим абзацем, на 150 слов, сплошным текстом
4.Затем идет логически правильно встроенная по тексту подводка к таблице 7, сама таблица и вывод после нее.
5.Затем идет логическая связка со следующим абзацем, на 150 слов, сплошным текстом
6.Затем идет логическая связка со следующим абзацем и маркированный список состоящий из 3-5 пунктов.
7.Затем идет логически правильно встроенная по тексту подводка к таблице 8, сама таблица и вывод после нее.
8.После всего делай вывод по разделу 2.1
✅ Подтвердите готовность перейти к 2.2 (Да/Нет)
Макет 2.2  ОБЪЕМ 800 слов с учетом компонентов ниже
1.Абзац на 150 слов, сплошным текстом
2.Затем идет логическая связка со следующим абзацем и маркированный список состоящий из 3-5 пунктов.
3.Затем идет логическая связка со следующим абзацем, на 150 слов, сплошным текстом
4.Затем идет логическая связка со следующим абзацем, на 100 слов, сплошным текстом
5.Затем идет логически правильно встроенная по тексту подводка к таблице 9, сама таблица и вывод после нее.
6.Затем идет логическая связка со следующим абзацем, на 100 слов, сплошным текстом
7.Затем идет логически правильно встроенная по тексту подводка к таблице 10, сама таблица и вывод после нее.
8.После всего делай вывод по разделу 2.2
✅ Подтвердите готовность перейти к 2.3 (Да/Нет)
Макет 2.3  ОБЪЕМ 800 слов с учетом компонентов ниже
1.Абзац на 100 слов, сплошным текстом
2.Затем идет логическая связка со следующим абзацем и маркированный список состоящий из 3-5 пунктов.
3.Затем идет логическая связка со следующим абзацем, на 150 слов, сплошным текстом
4.Затем идет логически правильно встроенная по тексту подводка к таблице 11, сама таблица и вывод после нее.
5.Затем идет логическая связка со следующим абзацем, на 150 слов, сплошным текстом
6.Затем идет логическая связка со следующим абзацем, на 1500 слов, сплошным текстом
7.Затем идет логически правильно встроенная по тексту подводка к таблице 12, сама таблица и вывод после нее.
8.Затем идет логическая связка со следующим абзацем, на 150 слов, сплошным текстом
9.После всего делай вывод по разделу 2.3
✅ Подтвердите готовность перейти к Заключению (Да/Нет)
5.Далее составляй заключение по следующему макету:
Заключение - Составь заключение на 700 слов,
6.Далее составляй Составь список литературы из 20 источников, настоящих авторов по следующему макету:
Список литературы не электронных источников делай по макету:
Чалых Т.И., Умаленова Н.В. Товароведение однородных групп непродовольственных товаров: Учебник для бакалавров. - М.: Дашков и К, 2020. - 760 с.
Список литературы для электронных источников делай по примеру: 
Геннадий Есаков (при наличии) // Мошенничество // [Электронный ресурс] — режим доступа: https://www.zks-law.ru/articles/article8 (Дата обращения 18.01.2025), дату обращения, заменяй на сегодняшнюю
После завершения работы уточняй, можем ли мы переходить созданию следующей работы и попроси тему и действуй по промту заново, т.е снова пнукт 1 и тд`;
    messages = [
        {
            role: "system",
            content: "Ты - помощник, который пишет научные работы для студентов и исследователей. Соблюдай академический стиль, структуру и достоверность."
        },
        {
            role: "user",
            content: prompt
        }
    ];
    loader.style.display = 'inline-block';
    chatHistoryDiv.innerHTML = '';
    hideDialogButtons();
    btn.disabled = true;
    try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'Authorization': `Bearer ${PPLX_API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: messages,
                max_tokens: 1800,
                temperature: 0.7
            })
        });
        if (!response.ok) {
            throw new Error('Ошибка при обращении к Perplexity API: ' + response.status);
        }
        const data = await response.json();
        let generated = '';
        if (data.choices && data.choices.length > 0) {
            if (data.choices[0].message && data.choices[0].message.content) {
                generated = data.choices[0].message.content;
            } else if (data.choices[0].text) {
                generated = data.choices[0].text;
            }
        } else {
            generated = 'Ответ не получен. Попробуйте изменить запрос.';
        }
        messages.push({ role: "assistant", content: generated });
        renderChatHistory();
        showDialogButtons();
    } catch (err) {
        messages.push({ role: "assistant", content: 'Ошибка: ' + err.message });
        renderChatHistory();
    } finally {
        loader.style.display = 'none';
        btn.disabled = false;
    }
});

// --- Кнопка "Да" ---
yesBtn.addEventListener('click', function() {
    showDialogModal({
        label: 'Введите ваш следующий вопрос или уточнение для продолжения диалога с ИИ:',
        big: false,
        callback: function(text) {
            sendToPerplexity(text);
        }
    });
});

// --- Кнопка "Нет" ---
noBtn.addEventListener('click', function() {
    showDialogModal({
        label: 'Введите замечание или пожелание (можно подробно):',
        big: true,
        callback: function(text) {
            sendToPerplexity("Пожалуйста, учти следующее замечание: " + text);
        }
    });
});

// --- Скачивание истории чата ---
downloadBtn.addEventListener('click', function() {
    let md = '';
    for (let i = firstPromptIndex + 1; i < messages.length; ++i) {
        const msg = messages[i];
        const role = msg.role === 'user' ? 'Вы' : 'Textify';
        md += `**${role}:**\n${msg.content}\n\n`;
    }
    const blob = new Blob([md], {type: "text/markdown"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "textify_chat.md";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
});

// --- Инициализация ---
checkPaymentStatus();
loadHistoryFromServer();
