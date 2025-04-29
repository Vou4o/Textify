const paymentBlock = document.getElementById('payment-block');
const generateForm = document.getElementById('generate-form');
const chatHistoryDiv = document.getElementById('chat-history');
const loader = document.getElementById('loader');
const btn = document.getElementById('generate-btn');
const payBtn = document.getElementById('pay-btn');
const confirmPayBtn = document.getElementById('confirm-payment-btn');
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

// --- Оплата через YooKassa ---
payBtn.addEventListener('click', function () {
    window.open('https://yookassa.ru/my/i/aBC60S-KnGtx/l', '_blank');
});

// --- Подтверждение оплаты ---
confirmPayBtn.addEventListener('click', function () {
    paymentBlock.style.display = 'none';
    generateForm.style.display = 'block';
    paymentPassed = true;
});

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
}

// --- Markdown -> HTML (минимальный парсер для таблиц и списков) ---
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

// --- Скачивание истории чата с нужным стилем ---
downloadBtn.addEventListener('click', function() {
    let htmlContent = '';
    for (let i = firstPromptIndex + 1; i < messages.length; ++i) {
        const msg = messages[i];
        const role = msg.role === 'user' ? 'Вы' : 'Textify';
        htmlContent += `<p><b>${role}:</b><br>${markdownToHtml(msg.content)}</p>\n`;
    }

    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 14pt;
    line-height: 1.5;
    text-indent: 1.25cm;
    margin: 2cm;
  }
  p {
    margin: 0 0 1em 0;
  }
  table {
    border-collapse: collapse;
    margin: 10px 0;
    width: 100%;
    font-size: 14pt;
    font-family: 'Times New Roman', Times, serif;
  }
  th, td {
    border: 1px solid #333;
    padding: 6px 12px;
    text-align: left;
  }
</style>
</head>
<body>
${htmlContent}
</body>
</html>
`;

    const blob = new Blob([htmlTemplate], {type: "text/html"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "textify_work.html";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
});

// --- Инициализация ---
renderChatHistory();
