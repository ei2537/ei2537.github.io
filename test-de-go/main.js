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
let loadedFiles = {}; // { "filename.txt": { "教科": [問題], ... }, ... }
let allQuestionsBySubject = {}; // { "教科": [問題], ... }
let quizQuestions = [];
let currentQuestionIndex = 0;
let userAnswer = '';

// --- イベントリスナー ---

// ファイル読み込み
fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length === 0) return;

    const filePromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const parsedData = parseMondaiText(e.target.result);
                loadedFiles[file.name] = parsedData; // ファイル名でデータを保存（上書きも可）
                resolve();
            };
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    });

    Promise.all(filePromises).then(() => {
        rebuildAndRefreshUI();
    }).catch(error => {
        console.error("ファイルの読み込みに失敗しました:", error);
        fileStatusEl.textContent = "ファイルの読み込みに失敗しました。";
    });
    fileInput.value = ''; // 同じファイルを連続で選択できるようにリセット
});

// スタートボタン
startButton.addEventListener('click', () => {
    displaySubjectSelection();
    showScreen('subject-selection');
});

// 全選択チェックボックス
selectAllSubjectsCheckbox.addEventListener('change', (event) => {
    const checkboxes = document.querySelectorAll('#subject-list input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = event.target.checked);
});

// 問題開始ボタン
startQuizButton.addEventListener('click', () => {
    const selectedSubjects = Array.from(document.querySelectorAll('#subject-list input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    if (selectedSubjects.length === 0) {
        alert('少なくとも1つの教科を選択してください。');
        return;
    }
    quizQuestions = [];
    selectedSubjects.forEach(subject => {
        quizQuestions.push(...allQuestionsBySubject[subject]);
    });
    shuffleArray(quizQuestions);
    currentQuestionIndex = 0;
    showScreen('quiz');
    displayQuestion();
});

// 判定・次の問題へボタン (変更なし)
submitButton.addEventListener('click', checkAnswer);
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
 * データとUIを再構築・再描画する
 */
function rebuildAndRefreshUI() {
    rebuildAllQuestions();
    updateFileListUI();
    updateFileStatus();
}

/**
 * 読み込まれた全ファイルから、教科別問題リスト(allQuestionsBySubject)を再構築する
 */
function rebuildAllQuestions() {
    allQuestionsBySubject = {};
    for (const filename in loadedFiles) {
        const subjectsInFile = loadedFiles[filename];
        for (const subject in subjectsInFile) {
            if (!allQuestionsBySubject[subject]) {
                allQuestionsBySubject[subject] = [];
            }
            allQuestionsBySubject[subject].push(...subjectsInFile[subject]);
        }
    }
}

/**
 * 読み込み済みファイルリストのUIを更新する
 */
function updateFileListUI() {
    fileListEl.innerHTML = '';
    const filenames = Object.keys(loadedFiles);

    if (filenames.length > 0) {
        fileListContainer.classList.remove('hidden');
        filenames.forEach(filename => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${filename}</span>
                <button class="delete-file-btn" title="このファイルを削除">&times;</button>
            `;
            li.querySelector('.delete-file-btn').onclick = () => handleDeleteFile(filename);
            fileListEl.appendChild(li);
        });
    } else {
        fileListContainer.classList.add('hidden');
    }
}

/**
 * ファイルステータスのメッセージとスタートボタンの状態を更新する
 */
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

/**
 * 指定されたファイルを読み込みリストから削除する
 * @param {string} filename - 削除するファイル名
 */
function handleDeleteFile(filename) {
    delete loadedFiles[filename];
    rebuildAndRefreshUI();
}

/**
 * mondai.txt の内容を解析して、教科ごとの問題オブジェクトを返す
 * @param {string} text - ファイルから読み込んだテキスト
 * @returns {object} { "教科名": [問題オブジェクト], ... }
 */
function parseMondaiText(text) {
    const questionsBySubject = {};
    const lines = text.trim().split(/\r?\n/);
    let currentSubject = '未分類';

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        if (line.startsWith('#')) {
            currentSubject = line.substring(1).trim();
        } else {
            const parts = line.split('|');
            if (parts.length < 4) return;
            const [type, question, choices, answer] = parts;
            if (!questionsBySubject[currentSubject]) {
                questionsBySubject[currentSubject] = [];
            }
            questionsBySubject[currentSubject].push({
                type: parseInt(type, 10),
                question: question.trim(),
                choices: choices ? choices.split(';').map(c => c.trim()) : [],
                answer: answer.trim()
            });
        }
    });
    return questionsBySubject;
}


// --- 画面表示・制御系の関数 (前回から大きな変更なし) ---

/** 教科選択画面を生成・表示する */
function displaySubjectSelection() {
    subjectListEl.innerHTML = '';
    const subjects = Object.keys(allQuestionsBySubject).sort();
    subjects.forEach(subject => {
        const itemCount = allQuestionsBySubject[subject].length;
        const div = document.createElement('div');
        div.className = 'subject-item';
        div.innerHTML = `<label><input type="checkbox" value="${subject}" checked> ${subject} (${itemCount}問)</label>`;
        subjectListEl.appendChild(div);
    });
    selectAllSubjectsCheckbox.checked = true;
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
        case 1:
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
        case 2:
            questionTextEl.textContent = q.question;
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '答えを入力してください';
            choicesAreaEl.appendChild(input);
            break;
        case 3:
            questionTextEl.innerHTML = q.question.replace('____', '<input type="text" id="fill-in-blank" placeholder="ここに入力">');
            break;
    }
    submitButton.classList.remove('hidden');
    nextButton.classList.add('hidden');
}

/** 解答をチェックする */
function checkAnswer() {
    const q = quizQuestions[currentQuestionIndex];
    if (q.type === 1) {} 
    else if (q.type === 2) { userAnswer = choicesAreaEl.querySelector('input').value; } 
    else if (q.type === 3) { userAnswer = document.getElementById('fill-in-blank').value; }
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
    nextButton.textContent = '最初に戻る';
    nextButton.onclick = () => window.location.reload();
}

/** 配列の要素をシャッフルする */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/** 指定された画面コンテナのみ表示する */
function showScreen(screenId) {
    startContainer.classList.add('hidden');
    subjectSelectionContainer.classList.add('hidden');
    quizContainer.classList.add('hidden');
    document.getElementById(`${screenId}-container`).classList.remove('hidden');
}