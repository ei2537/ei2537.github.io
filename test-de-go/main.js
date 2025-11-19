// --- DOM要素の取得 ---
const startContainer = document.getElementById('start-container');
const subjectSelectionContainer = document.getElementById('subject-selection-container');
const quizContainer = document.getElementById('quiz-container');

const fileInput = document.getElementById('file-input');
const fileStatusEl = document.getElementById('file-status');
const startButton = document.getElementById('start-button');
const fileListContainer = document.getElementById('file-list-container');
const fileListEl = document.getElementById('file-list');

const subjectListEl = document.getElementById('subject-list');
const selectAllSubjectsCheckbox = document.getElementById('select-all-subjects');
const startQuizButton = document.getElementById('start-quiz-button');

const questionNumberEl = document.getElementById('question-number');
const questionTextEl = document.getElementById('question-text');
const choicesAreaEl = document.getElementById('choices-area');
const feedbackAreaEl = document.getElementById('feedback-area');
const submitButton = document.getElementById('submit-button');
const nextButton = document.getElementById('next-button');

// --- グローバル変数 ---
let loadedFiles = {};
let allQuestionsBySubject = {};
let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswer = '';

// ★★★ ここから追加 ★★★
// --- 更新履歴データ ---
// 新しい履歴は、この配列の先頭に追加してください
const updateHistory = [
    { date: '2025/11/19', content: '記述・穴埋め問題で複数の正解を許容するようにしました。ダウンロード機能と更新履歴表示を追加しました。' },
    { date: '2025/11/18', content: '選択問題の解答表示を改善し、複数箇所の穴埋め問題に対応しました。' },
    { date: '2025/11/17', content: '選択肢のシャッフル機能を追加しました。' },
    { date: '2025/11/16', content: 'ファイル読み込み機能、教科選択機能、問題シャッフル機能などを追加しました。' },
    { date: '2025/11/15', content: '基本的な問題システムを構築しました。' },
];

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    renderUpdateHistory();
});

/**
 * 更新履歴をHTMLに描画する関数
 */
function renderUpdateHistory() {
    const historyListEl = document.getElementById('history-list');
    if (!historyListEl) return;
    
    updateHistory.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="history-date">${item.date}</span>
            <span class="history-content">${item.content}</span>
        `;
        historyListEl.appendChild(li);
    });
}
// ★★★ ここまで追加 ★★★


// --- イベントリスナー (変更なし) ---
fileInput.addEventListener('change', (event) => {
    const files = event.target.files; if (files.length === 0) return;
    const filePromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                loadedFiles[file.name] = parseMondaiText(e.target.result);
                resolve();
            };
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    });
    Promise.all(filePromises).then(() => {
        rebuildAndRefreshUI();
    }).catch(error => { console.error("ファイルの読み込みに失敗しました:", error); fileStatusEl.textContent = "ファイルの読み込みに失敗しました。"; });
    fileInput.value = '';
});
startButton.addEventListener('click', () => { displaySubjectSelection(); showScreen('subject-selection'); });
selectAllSubjectsCheckbox.addEventListener('change', (event) => {
    const checkboxes = document.querySelectorAll('#subject-list input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = event.target.checked);
});
startQuizButton.addEventListener('click', () => {
    const selectedSubjects = Array.from(document.querySelectorAll('#subject-list input[type="checkbox"]:checked')).map(cb => cb.value);
    if (selectedSubjects.length === 0) { alert('少なくとも1つの教科を選択してください。'); return; }
    quizQuestions = [];
    selectedSubjects.forEach(subject => { quizQuestions.push(...allQuestionsBySubject[subject]); });
    shuffleArray(quizQuestions);
    currentQuestionIndex = 0;
    showScreen('quiz');
    displayQuestion();
});
submitButton.addEventListener('click', checkAnswer);
nextButton.addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < quizQuestions.length) { displayQuestion(); } else { showEndOfQuiz(); }
});

// --- 関数 (変更なし) ---
function rebuildAndRefreshUI() { rebuildAllQuestions(); updateFileListUI(); updateFileStatus(); }
function rebuildAllQuestions() {
    allQuestionsBySubject = {};
    for (const filename in loadedFiles) {
        const subjectsInFile = loadedFiles[filename];
        for (const subject in subjectsInFile) {
            if (!allQuestionsBySubject[subject]) { allQuestionsBySubject[subject] = []; }
            allQuestionsBySubject[subject].push(...subjectsInFile[subject]);
        }
    }
}
function updateFileListUI() {
    fileListEl.innerHTML = '';
    const filenames = Object.keys(loadedFiles);
    if (filenames.length > 0) {
        fileListContainer.classList.remove('hidden');
        filenames.forEach(filename => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${filename}</span><button class="delete-file-btn" title="このファイルを削除">&times;</button>`;
            li.querySelector('.delete-file-btn').onclick = () => handleDeleteFile(filename);
            fileListEl.appendChild(li);
        });
    } else { fileListContainer.classList.add('hidden'); }
}
function updateFileStatus() {
    const totalSubjects = Object.keys(allQuestionsBySubject).length;
    const totalQuestions = Object.values(allQuestionsBySubject).flat().length;
    if (totalQuestions > 0) {
        fileStatusEl.textContent = `${Object.keys(loadedFiles).length}個のファイルから ${totalSubjects}教科 / ${totalQuestions}問 を読み込みました。`;
        startButton.disabled = false;
    } else {
        fileStatusEl.textContent = '問題ファイルが読み込まれていません。';
        startButton.disabled = true;
    }
}
function handleDeleteFile(filename) { delete loadedFiles[filename]; rebuildAndRefreshUI(); }
function parseMondaiText(text) {
    const questionsBySubject = {};
    const lines = text.trim().split(/\r?\n/);
    let currentSubject = '未分類';
    lines.forEach(line => {
        line = line.trim(); if (!line) return;
        if (line.startsWith('#')) {
            currentSubject = line.substring(1).trim();
        } else {
            const parts = line.split('|'); if (parts.length < 4) return;
            const [type, question, choices, answer] = parts;
            if (!questionsBySubject[currentSubject]) { questionsBySubject[currentSubject] = []; }
            questionsBySubject[currentSubject].push({
                type: parseInt(type, 10), question: question.trim(),
                choices: choices ? choices.split(';').map(c => c.trim()) : [],
                answer: answer.trim()
            });
        }
    });
    return questionsBySubject;
}
function displaySubjectSelection() {
    subjectListEl.innerHTML = '';
    const subjects = Object.keys(allQuestionsBySubject).sort();
    subjects.forEach(subject => {
        const itemCount = allQuestionsBySubject[subject].length;
        const div = document.createElement('div'); div.className = 'subject-item';
        div.innerHTML = `<label><input type="checkbox" value="${subject}" checked> ${subject} (${itemCount}問)</label>`;
        subjectListEl.appendChild(div);
    });
    selectAllSubjectsCheckbox.checked = true;
}
function displayQuestion() {
    feedbackAreaEl.innerHTML = ''; feedbackAreaEl.className = ''; choicesAreaEl.innerHTML = ''; userAnswer = '';
    const q = quizQuestions[currentQuestionIndex];
    questionNumberEl.textContent = `第 ${currentQuestionIndex + 1} 問 / 全 ${quizQuestions.length} 問`;
    questionTextEl.textContent = q.question;
    switch (q.type) {
        case 1:
            const shuffledChoices = [...q.choices]; shuffleArray(shuffledChoices);
            shuffledChoices.forEach(choice => {
                const button = document.createElement('button'); button.textContent = choice;
                button.onclick = () => {
                    Array.from(choicesAreaEl.children).forEach(btn => btn.classList.remove('selected'));
                    button.classList.add('selected'); userAnswer = choice;
                };
                choicesAreaEl.appendChild(button);
            });
            break;
        case 2:
            const input = document.createElement('input'); input.type = 'text'; input.placeholder = '答えを入力してください';
            choicesAreaEl.appendChild(input);
            break;
        case 3:
            questionTextEl.innerHTML = ''; choicesAreaEl.innerHTML = '';
            const parts = q.question.split('____');
            parts.forEach((part, index) => {
                questionTextEl.appendChild(document.createTextNode(part));
                if (index < parts.length - 1) {
                    const input = document.createElement('input'); input.type = 'text'; input.className = 'fill-in-blank';
                    questionTextEl.appendChild(input);
                }
            });
            break;
    }
    submitButton.classList.remove('hidden'); nextButton.classList.add('hidden');
}
function checkAnswer() {
    const q = quizQuestions[currentQuestionIndex];
    let isCorrect = false;
    const readableAnswer = q.answer.replace(/;/g, ', ').replace(/,/g, ' または ');
    if (q.type === 1) {
        isCorrect = userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
    } else if (q.type === 2) {
        userAnswer = choicesAreaEl.querySelector('input').value.trim().toLowerCase();
        const correctAnswers = q.answer.split(',').map(ans => ans.trim().toLowerCase());
        isCorrect = correctAnswers.includes(userAnswer);
    } else if (q.type === 3) {
        const userAnswers = Array.from(questionTextEl.querySelectorAll('input.fill-in-blank')).map(input => input.value.trim().toLowerCase());
        const correctAnswersByBlank = q.answer.split(';').map(ans => ans.trim().toLowerCase());
        isCorrect = userAnswers.every((userAns, index) => {
            if (correctAnswersByBlank[index] === undefined) return false;
            const correctAlternatives = correctAnswersByBlank[index].split(',').map(alt => alt.trim().toLowerCase());
            return correctAlternatives.includes(userAns);
        });
    }
    if (isCorrect) {
        feedbackAreaEl.textContent = `正解！ 答えは「${readableAnswer}」です。`;
        feedbackAreaEl.className = 'correct';
    } else {
        feedbackAreaEl.textContent = `不正解... 正しい答えは「${readableAnswer}」です。`;
        feedbackAreaEl.className = 'incorrect';
    }
    if (q.type === 1) {
        const choiceButtons = choicesAreaEl.querySelectorAll('button');
        const selectedButton = choicesAreaEl.querySelector('button.selected');
        choiceButtons.forEach(btn => btn.disabled = true);
        if (isCorrect) {
            if (selectedButton) selectedButton.classList.add('correct-choice');
        } else {
            if (selectedButton) selectedButton.classList.add('incorrect-choice');
            choiceButtons.forEach(button => {
                if (button.textContent.trim().toLowerCase() === q.answer.trim().toLowerCase()) {
                    button.classList.add('correct-choice');
                }
            });
        }
    } else if (q.type === 2) {
        choicesAreaEl.querySelector('input').disabled = true;
    } else if (q.type === 3) {
        questionTextEl.querySelectorAll('input.fill-in-blank').forEach(input => input.disabled = true);
    }
    submitButton.classList.add('hidden'); nextButton.classList.remove('hidden');
}
function showEndOfQuiz() {
    questionNumberEl.textContent = 'お疲れ様でした！';
    questionTextEl.textContent = '全ての問題が終了しました。';
    choicesAreaEl.innerHTML = ''; feedbackAreaEl.innerHTML = ''; feedbackAreaEl.className = '';
    submitButton.classList.add('hidden');
    nextButton.textContent = '最初に戻る';
    nextButton.onclick = () => window.location.reload();
}
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
function showScreen(screenId) {
    startContainer.classList.add('hidden');
    subjectSelectionContainer.classList.add('hidden');
    quizContainer.classList.add('hidden');
    document.getElementById(`${screenId}-container`).classList.remove('hidden');
}