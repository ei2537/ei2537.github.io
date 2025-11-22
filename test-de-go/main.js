// --- DOM要素の取得 ---
const startContainer = document.getElementById('start-container');
const subjectSelectionContainer = document.getElementById('subject-selection-container');
const quizContainer = document.getElementById('quiz-container');
const resultContainer = document.getElementById('result-container');

const fileInput = document.getElementById('file-input');
const fileStatusEl = document.getElementById('file-status');
const startButton = document.getElementById('start-button');
const weaknessButton = document.getElementById('weakness-button');
const fileListContainer = document.getElementById('file-list-container');
const fileListEl = document.getElementById('file-list');
const subjectListEl = document.getElementById('subject-list');
const selectAllSubjectsCheckbox = document.getElementById('select-all-subjects');
const startQuizButton = document.getElementById('start-quiz-button');
const backToStartButton = document.getElementById('back-to-start-button');

const questionNumberEl = document.getElementById('question-number');
const modeIndicatorEl = document.getElementById('mode-indicator');
const questionAreaEl = document.getElementById('question-area');
const choicesAreaEl = document.getElementById('choices-area');
const feedbackAreaEl = document.getElementById('feedback-area');
const submitButton = document.getElementById('submit-button');
const nextButton = document.getElementById('next-button');

// 結果画面用
const scoreCountEl = document.getElementById('score-count');
const totalCountEl = document.getElementById('total-count');
const percentageValEl = document.getElementById('percentage-val');
const reviewSectionEl = document.getElementById('review-section');
const wrongAnswerListEl = document.getElementById('wrong-answer-list');
const retryButton = document.getElementById('retry-button');
const backToTopButton = document.getElementById('back-to-top-button');

// --- グローバル変数 ---
let loadedFiles = {};
let allQuestionsBySubject = {};
let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswer = '';
let correctCount = 0;
let wrongQuestionsInSession = []; // その回のクイズで間違えた問題
let isWeaknessMode = false;

const STORAGE_KEY_WEAKNESS = 'testDeGo_weaknesses';

// --- 更新履歴 ---
const updateHistory = [
    { date: '2025/11/22', content: '「ニガテ克服モード」と「結果発表（正答率・復習リスト）」を追加しました。' },
    { date: '2025/11/21', content: '順不同の複数穴埋め問題（タイプ4）に対応し、解答表示を修正しました。' },
    { date: '2025/11/20', content: '重複した問題を自動的に除外する機能を追加しました。' },
    { date: '2025/11/19', content: '記述・穴埋め問題で複数の正解を許容するようにしました。' },
    { date: '2025/11/15', content: '基本的な問題システムを構築しました。' },
];

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    renderUpdateHistory();
    updateWeaknessButtonState();
});

function renderUpdateHistory() {
    const historyListEl = document.getElementById('history-list');
    if (!historyListEl) return;
    updateHistory.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="history-date">${item.date}</span><span class="history-content">${item.content}</span>`;
        historyListEl.appendChild(li);
    });
}

// --- 苦手問題管理 (LocalStorage) ---
function getStoredWeaknesses() {
    const stored = localStorage.getItem(STORAGE_KEY_WEAKNESS);
    return stored ? JSON.parse(stored) : [];
}

function saveWeakness(questionObj) {
    let weaknesses = getStoredWeaknesses();
    // 重複チェック (一意なキーで判定)
    const qKey = createQuestionKey(questionObj);
    const exists = weaknesses.some(w => createQuestionKey(w) === qKey);
    
    if (!exists) {
        weaknesses.push(questionObj);
        localStorage.setItem(STORAGE_KEY_WEAKNESS, JSON.stringify(weaknesses));
        updateWeaknessButtonState();
    }
}

function removeWeakness(questionObj) {
    let weaknesses = getStoredWeaknesses();
    const qKey = createQuestionKey(questionObj);
    const filtered = weaknesses.filter(w => createQuestionKey(w) !== qKey);
    
    if (weaknesses.length !== filtered.length) {
        localStorage.setItem(STORAGE_KEY_WEAKNESS, JSON.stringify(filtered));
        updateWeaknessButtonState();
    }
}

function createQuestionKey(q) {
    const choicesKey = q.type === 1 ? [...q.choices].sort().join(';') : '';
    return `${q.type}|${q.question}|${choicesKey}|${q.answer}`;
}

function updateWeaknessButtonState() {
    const weaknesses = getStoredWeaknesses();
    weaknessButton.textContent = `ニガテ克服モード (${weaknesses.length}問)`;
    if (weaknesses.length > 0) {
        weaknessButton.disabled = false;
    } else {
        weaknessButton.disabled = true;
    }
}


// --- イベントリスナー ---
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
    }).catch(error => { console.error("エラー:", error); fileStatusEl.textContent = "読み込み失敗"; });
    fileInput.value = '';
});

startButton.addEventListener('click', () => {
    displaySubjectSelection();
    showScreen('subject-selection');
});

// ニガテ克服モード開始
weaknessButton.addEventListener('click', () => {
    const weaknesses = getStoredWeaknesses();
    if (weaknesses.length === 0) return;
    
    isWeaknessMode = true;
    quizQuestions = [...weaknesses];
    shuffleArray(quizQuestions);
    
    startQuizSequence();
});

selectAllSubjectsCheckbox.addEventListener('change', (event) => {
    const checkboxes = document.querySelectorAll('#subject-list input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = event.target.checked);
});

startQuizButton.addEventListener('click', () => {
    const selectedSubjects = Array.from(document.querySelectorAll('#subject-list input[type="checkbox"]:checked')).map(cb => cb.value);
    if (selectedSubjects.length === 0) { alert('教科を選択してください。'); return; }
    
    isWeaknessMode = false;
    quizQuestions = [];
    selectedSubjects.forEach(subject => { quizQuestions.push(...allQuestionsBySubject[subject]); });
    shuffleArray(quizQuestions);
    
    startQuizSequence();
});

backToStartButton.addEventListener('click', () => {
    showScreen('start');
});

submitButton.addEventListener('click', checkAnswer);
nextButton.addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < quizQuestions.length) { displayQuestion(); } else { showResultScreen(); }
});

// 結果画面のボタン
retryButton.addEventListener('click', () => {
    // 同じ問題セットでリトライ
    shuffleArray(quizQuestions);
    startQuizSequence();
});
backToTopButton.addEventListener('click', () => {
    window.location.reload();
});


// --- クイズ進行管理 ---
function startQuizSequence() {
    currentQuestionIndex = 0;
    correctCount = 0;
    wrongQuestionsInSession = [];
    
    // モード表示切り替え
    if (isWeaknessMode) {
        modeIndicatorEl.classList.remove('hidden');
    } else {
        modeIndicatorEl.classList.add('hidden');
    }

    showScreen('quiz');
    displayQuestion();
}

// --- 関数 ---
function rebuildAndRefreshUI() { rebuildAllQuestions(); updateFileListUI(); updateFileStatus(); }

function rebuildAllQuestions() {
    allQuestionsBySubject = {};
    const uniqueQuestionKeys = new Set();
    for (const filename in loadedFiles) {
        const subjectsInFile = loadedFiles[filename];
        for (const subject in subjectsInFile) {
            if (!allQuestionsBySubject[subject]) { allQuestionsBySubject[subject] = []; }
            subjectsInFile[subject].forEach(q => {
                const qKey = createQuestionKey(q);
                if (!uniqueQuestionKeys.has(qKey)) {
                    uniqueQuestionKeys.add(qKey);
                    allQuestionsBySubject[subject].push(q);
                }
            });
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
            li.innerHTML = `<span>${filename}</span><button class="delete-file-btn" title="削除">&times;</button>`;
            li.querySelector('.delete-file-btn').onclick = () => handleDeleteFile(filename);
            fileListEl.appendChild(li);
        });
    } else { fileListContainer.classList.add('hidden'); }
}
function updateFileStatus() {
    const totalSubjects = Object.keys(allQuestionsBySubject).length;
    const totalQuestions = Object.values(allQuestionsBySubject).flat().length;
    if (totalQuestions > 0) {
        fileStatusEl.textContent = `${Object.keys(loadedFiles).length}ファイル / ${totalSubjects}教科 / ${totalQuestions}問 読み込み完了`;
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
    questionAreaEl.innerHTML = '';
    const q = quizQuestions[currentQuestionIndex];
    questionNumberEl.textContent = `第 ${currentQuestionIndex + 1} 問 / 全 ${quizQuestions.length} 問`;
    
    switch (q.type) {
        case 1:
        case 2:
            const p = document.createElement('p');
            p.textContent = q.question;
            questionAreaEl.appendChild(p);
            
            if (q.type === 1) {
                const shuffledChoices = [...q.choices]; shuffleArray(shuffledChoices);
                shuffledChoices.forEach(choice => {
                    const button = document.createElement('button'); button.textContent = choice;
                    button.onclick = () => {
                        Array.from(choicesAreaEl.children).forEach(btn => btn.classList.remove('selected'));
                        button.classList.add('selected'); userAnswer = choice;
                    };
                    choicesAreaEl.appendChild(button);
                });
            } else {
                const input = document.createElement('input'); input.type = 'text'; input.placeholder = '答えを入力してください';
                choicesAreaEl.appendChild(input);
            }
            break;
        case 3:
        case 4:
            const parts = q.question.split('____');
            parts.forEach((part, index) => {
                questionAreaEl.appendChild(document.createTextNode(part));
                if (index < parts.length - 1) {
                    const input = document.createElement('input'); input.type = 'text'; input.className = 'fill-in-blank';
                    questionAreaEl.appendChild(input);
                }
            });
            break;
    }
    submitButton.classList.remove('hidden'); nextButton.classList.add('hidden');
}

function checkAnswer() {
    const q = quizQuestions[currentQuestionIndex];
    let isCorrect = false;

    const readableAnswer = q.answer.split(';').map(part => part.replace(/,/g, ' または ')).join(', ');
    let userAnswers = [];

    if (q.type === 1) {
        userAnswers = [userAnswer];
    } else if (q.type === 2) {
        userAnswers = [choicesAreaEl.querySelector('input').value];
    } else if (q.type === 3 || q.type === 4) {
        userAnswers = Array.from(questionAreaEl.querySelectorAll('input.fill-in-blank')).map(input => input.value);
    }
    
    const cleanUserAnswers = userAnswers.map(ans => ans.trim().toLowerCase());
    
    if (q.type === 1 || q.type === 2) {
        const correctAnswers = q.answer.split(',').map(ans => ans.trim().toLowerCase());
        isCorrect = correctAnswers.includes(cleanUserAnswers[0]);
    } else if (q.type === 3) {
        const correctAnswersByBlank = q.answer.split(';').map(ans => ans.trim().toLowerCase());
        isCorrect = cleanUserAnswers.every((userAns, index) => {
            if (correctAnswersByBlank[index] === undefined) return false;
            const correctAlternatives = correctAnswersByBlank[index].split(',').map(alt => alt.trim().toLowerCase());
            return correctAlternatives.includes(userAns);
        });
    } else if (q.type === 4) {
        const correctAnswersSet = q.answer.split(';').map(ans => ans.trim().toLowerCase());
        isCorrect = cleanUserAnswers.length === correctAnswersSet.length &&
                    [...cleanUserAnswers].sort().join('|') === [...correctAnswersSet].sort().join('|');
    }

    // ★★★ 正誤による処理の分岐 ★★★
    if (isCorrect) {
        feedbackAreaEl.textContent = `正解！ 答えは「${readableAnswer}」です。`;
        feedbackAreaEl.className = 'correct';
        correctCount++;
        
        // ニガテ克服モードなら、正解したのでリストから削除
        if (isWeaknessMode) {
            removeWeakness(q);
        }
    } else {
        feedbackAreaEl.textContent = `不正解... 正しい答えは「${readableAnswer}」です。`;
        feedbackAreaEl.className = 'incorrect';
        
        // 間違えた問題を記録 (今回のセッション用)
        wrongQuestionsInSession.push(q);
        
        // 苦手リストに保存 (永続化)
        saveWeakness(q);
    }
    
    // UI制御
    if (q.type === 1) {
        const choiceButtons = choicesAreaEl.querySelectorAll('button');
        choiceButtons.forEach(btn => btn.disabled = true);
        const selectedButton = choicesAreaEl.querySelector('button.selected');
        if (isCorrect) {
            if (selectedButton) selectedButton.classList.add('correct-choice');
        } else {
            if (selectedButton) selectedButton.classList.add('incorrect-choice');
            choiceButtons.forEach(button => {
                const correctChoice = q.answer.split(',')[0].trim().toLowerCase();
                if (button.textContent.trim().toLowerCase() === correctChoice) {
                    button.classList.add('correct-choice');
                }
            });
        }
    } else if (q.type === 2) {
        choicesAreaEl.querySelector('input').disabled = true;
    } else if (q.type === 3 || q.type === 4) {
        questionAreaEl.querySelectorAll('input.fill-in-blank').forEach(input => input.disabled = true);
    }
    
    submitButton.classList.add('hidden');
    nextButton.classList.remove('hidden');
}

function showResultScreen() {
    showScreen('result');
    
    const total = quizQuestions.length;
    const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    
    scoreCountEl.textContent = correctCount;
    totalCountEl.textContent = total;
    percentageValEl.textContent = percentage;
    
    // 間違えた問題のリスト表示
    wrongAnswerListEl.innerHTML = '';
    if (wrongQuestionsInSession.length > 0) {
        reviewSectionEl.classList.remove('hidden');
        wrongQuestionsInSession.forEach(q => {
            const li = document.createElement('li');
            const readableAns = q.answer.split(';').map(p => p.replace(/,/g, ' or ')).join(', ');
            li.innerHTML = `
                <span class="wrong-q-text">Q. ${q.question.replace(/____/g, ' [　] ')}</span>
                <span class="wrong-q-ans">A. ${readableAns}</span>
            `;
            wrongAnswerListEl.appendChild(li);
        });
    } else {
        reviewSectionEl.classList.add('hidden');
    }
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
    resultContainer.classList.add('hidden');
    
    document.getElementById(`${screenId}-container`).classList.remove('hidden');
}