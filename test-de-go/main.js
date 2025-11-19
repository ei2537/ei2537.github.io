// --- DOM要素の取得 ---
const startContainer = document.getElementById('start-container');
const subjectSelectionContainer = document.getElementById('subject-selection-container');
const quizContainer = document.getElementById('quiz-container');

const fileInput = document.getElementById('file-input');
const fileStatusEl = document.getElementById('file-status');
const startButton = document.getElementById('start-button');
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
let allQuestionsBySubject = {}; // {教科名: [問題オブジェクト], ...}
let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswer = '';

// --- イベントリスナー ---

// ファイル読み込み
fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length === 0) return;

    allQuestionsBySubject = {}; // 読み込むたびにリセット
    const filePromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                parseMondaiText(e.target.result);
                resolve();
            };
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    });

    Promise.all(filePromises).then(() => {
        fileStatusEl.textContent = `${files.length}個のファイルから${Object.keys(allQuestionsBySubject).length}教科分の問題を読み込みました。`;
        startButton.disabled = false;
    }).catch(error => {
        console.error("ファイルの読み込みに失敗しました:", error);
        fileStatusEl.textContent = "ファイルの読み込みに失敗しました。";
    });
});

// スタートボタン
startButton.addEventListener('click', () => {
    displaySubjectSelection();
    showScreen('subject-selection');
});

// 全選択チェックボックス
selectAllSubjectsCheckbox.addEventListener('change', (event) => {
    const checkboxes = document.querySelectorAll('#subject-list input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = event.target.checked;
    });
});

// 問題開始ボタン
startQuizButton.addEventListener('click', () => {
    const selectedSubjects = Array.from(document.querySelectorAll('#subject-list input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    if (selectedSubjects.length === 0) {
        alert('少なくとも1つの教科を選択してください。');
        return;
    }

    // 問題を準備
    quizQuestions = [];
    selectedSubjects.forEach(subject => {
        quizQuestions.push(...allQuestionsBySubject[subject]);
    });

    // 問題をシャッフル
    shuffleArray(quizQuestions);

    // クイズ開始
    currentQuestionIndex = 0;
    showScreen('quiz');
    displayQuestion();
});

// 判定ボタン
submitButton.addEventListener('click', checkAnswer);

// 次の問題へボタン
nextButton.addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < quizQuestions.length) {
        displayQuestion();
    } else {
        showEndOfQuiz();
    }
});


// --- 関数 ---

/**
 * mondai.txt の内容を解析して allQuestionsBySubject に格納する
 * @param {string} text - ファイルから読み込んだテキスト
 */
function parseMondaiText(text) {
    const lines = text.trim().split(/\r?\n/);
    let currentSubject = '未分類';

    lines.forEach(line => {
        line = line.trim();
        if (!line) return; // 空行はスキップ

        if (line.startsWith('#')) {
            currentSubject = line.substring(1).trim();
            if (!allQuestionsBySubject[currentSubject]) {
                allQuestionsBySubject[currentSubject] = [];
            }
        } else {
            const parts = line.split('|');
            if (parts.length < 4) return; // 不正な形式の行はスキップ

            const [type, question, choices, answer] = parts;
            const questionObj = {
                type: parseInt(type, 10),
                question: question.trim(),
                choices: choices ? choices.split(';').map(c => c.trim()) : [],
                answer: answer.trim()
            };

            if (!allQuestionsBySubject[currentSubject]) {
                allQuestionsBySubject[currentSubject] = [];
            }
            allQuestionsBySubject[currentSubject].push(questionObj);
        }
    });
}

/** 教科選択画面を生成・表示する */
function displaySubjectSelection() {
    subjectListEl.innerHTML = '';
    const subjects = Object.keys(allQuestionsBySubject).sort();
    
    subjects.forEach(subject => {
        const itemCount = allQuestionsBySubject[subject].length;
        const div = document.createElement('div');
        div.className = 'subject-item';
        div.innerHTML = `
            <label>
                <input type="checkbox" value="${subject}" checked>
                ${subject} (${itemCount}問)
            </label>
        `;
        subjectListEl.appendChild(div);
    });
}

/** 問題を表示する */
function displayQuestion() {
    feedbackAreaEl.innerHTML = '';
    feedbackAreaEl.className = '';
    choicesAreaEl.innerHTML = '';
    userAnswer = '';

    const q = quizQuestions[currentQuestionIndex];
    questionNumberEl.textContent = `第 ${currentQuestionIndex + 1} 問 / 全 ${quizQuestions.length} 問`;

    switch (q.type) {
        case 1: // 選択問題
            questionTextEl.textContent = q.question;
            q.choices.forEach(choice => {
                const button = document.createElement('button');
                button.textContent = choice;
                button.onclick = () => {
                    Array.from(choicesAreaEl.children).forEach(btn => btn.classList.remove('selected'));
                    button.classList.add('selected');
                    userAnswer = choice;
                };
                choicesAreaEl.appendChild(button);
            });
            break;
        case 2: // 記述問題
            questionTextEl.textContent = q.question;
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '答えを入力してください';
            choicesAreaEl.appendChild(input);
            break;
        case 3: // 穴埋め問題
            questionTextEl.innerHTML = q.question.replace('____', '<input type="text" id="fill-in-blank" placeholder="ここに入力">');
            break;
    }
    
    submitButton.classList.remove('hidden');
    nextButton.classList.add('hidden');
}

/** 解答をチェックする */
function checkAnswer() {
    const q = quizQuestions[currentQuestionIndex];

    if (q.type === 1) {
        // userAnswer はボタンクリック時に設定済み
    } else if (q.type === 2) {
        userAnswer = choicesAreaEl.querySelector('input').value;
    } else if (q.type === 3) {
        userAnswer = document.getElementById('fill-in-blank').value;
    }

    if (userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase()) {
        feedbackAreaEl.textContent = `正解！ 答えは「${q.answer}」です。`;
        feedbackAreaEl.className = 'correct';
    } else {
        feedbackAreaEl.textContent = `不正解... 正しい答えは「${q.answer}」です。`;
        feedbackAreaEl.className = 'incorrect';
    }

    submitButton.classList.add('hidden');
    nextButton.classList.remove('hidden');
}

/** クイズ終了時の画面を表示 */
function showEndOfQuiz() {
    questionNumberEl.textContent = 'お疲れ様でした！';
    questionTextEl.textContent = '全ての問題が終了しました。';
    choicesAreaEl.innerHTML = '';
    feedbackAreaEl.innerHTML = '';
    feedbackAreaEl.className = '';
    submitButton.classList.add('hidden');
    // nextButtonをリトライボタンなどに変更することも可能
    nextButton.textContent = '最初に戻る';
    nextButton.onclick = () => window.location.reload(); // ページをリロードして最初から
}

/**
 * 配列の要素をシャッフルする (Fisher-Yatesアルゴリズム)
 * @param {Array} array - シャッフルしたい配列
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * 指定されたIDの画面コンテナのみ表示する
 * @param {'start' | 'subject-selection' | 'quiz'} screenId 
 */
function showScreen(screenId) {
    startContainer.classList.add('hidden');
    subjectSelectionContainer.classList.add('hidden');
    quizContainer.classList.add('hidden');

    document.getElementById(`${screenId}-container`).classList.remove('hidden');
}