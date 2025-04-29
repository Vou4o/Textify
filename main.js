// --- Переменные DOM ---
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

let messages = [
    {
        role: "system",
        content: "Ты - помощник, который пишет научные работы для студентов и исследователей. Соблюдай академический стиль, структуру и достоверность."
    }
];
let firstPromptIndex = 1;
let paymentPassed = false;
let dialogCallback = null;

// --- Проверка статуса оплаты через localStorage + query ---
function checkPaymentStatus() {
    // Если есть ?paid=1 в URL, считаем что оплата прошла и сохраняем в localStorage
    if (window.location.search.includes('paid=1')) {
        localStorage.setItem('textify_paid', '1');
        // Очищаем параметр из адреса
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    paymentPassed = localStorage.getItem('textify_paid') === '1';
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
    // successURL должен вести на ваш сайт с ?paid=1
    window.location.href = 'https://yookassa.ru/my/i/aBC5xHIu-LPD/l?successURL=' + encodeURIComponent(window.location.origin + window.location.pathname + '?paid=1');
});

// --- Загрузка истории из localStorage ---
function loadHistory() {
    const saved = localStorage.getItem('textify_history');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (Array.isArray(data) && data.length > 0) {
                messages = data;
                renderChatHistory();
                if (messages.length > 2) showDialogButtons();
            }
        } catch (e) {}
    }
}

// --- Сохранение истории в localStorage ---
function saveHistory() {
    localStorage.setItem('textify_history', JSON.stringify(messages));
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
    saveHistory();
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
    prompt += ` Оформи работу в научном стиле, структурируй по разделам, используй актуальные данные и сделай выводы.`;
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

// --- Скачивание истории чата в формате RTF ---
downloadBtn.addEventListener('click', function() {
    let plainText = '';
    for (let i = firstPromptIndex + 1; i < messages.length; ++i) {
        const msg = messages[i];
        const role = msg.role === 'user' ? 'Вы' : 'Textify';
        plainText += `${role}:\n${msg.content}\n\n`;
    }
    // Times New Roman, 14pt, межстрочный 1.25, отступы: слева 1,25см, справа 1,5см, сверху/снизу 2см
    const rtfHeader = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Times New Roman;}}
\\fs28
\\margl708\\margr850\\margt1134\\margb1134
\\sl360\\slmult1
`;
    function escapeRtf(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/{/g, '\\{')
            .replace(/}/g, '\\}')
            .replace(/\n/g, '\\par\n');
    }
    const rtfBody = escapeRtf(plainText);
    const rtfFooter = '}';
    const rtfContent = rtfHeader + rtfBody + rtfFooter;
    const blob = new Blob([rtfContent], {type: "application/rtf"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "textify_chat.rtf";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
});

// --- Инициализация ---
checkPaymentStatus();
loadHistory();
