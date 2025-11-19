// DOM要素の取得
const questionNumberEl = document.getElementById('question-number');
const questionTextEl = document.getElementById('question-text');
const choicesAreaEl = document.getElementById('choices-area');
const feedbackAreaEl = document.getElementById('feedback-area');
const submitButton = document.getElementById('submit-button');
const nextButton = document.getElementById('next-button');

let questions = [];
let currentQuestionIndex = 0;
let userAnswer = '';

// mondai.txtを読み込む
fetch('mondai.txt')
    .then(response => {
        if (!response.ok) {
            throw new Error('ネットワークの応答が正しくありませんでした');
        }
        return response.text();
    })
    .then(text => {
        questions = parseMondaiText(text);
        if (questions.length > 0) {
            displayQuestion();
        } else {
            questionTextEl.textContent = '問題の読み込みに失敗しました。';
        }
    })
    .catch(error => {
        console.error('問題ファイルの読み込み中にエラーが発生しました:', error);
        questionTextEl.textContent = '問題ファイルの読み込みに失敗しました。';
    });

// テキストを解析して問題オブジェクトの配列に変換
function parseMondaiText(text) {
    const lines = text.trim().split('\n');
    return lines.map(line => {
        const [type, question, choices, answer] = line.split('|');
        return {
            type: parseInt(type, 10),
            question: question.trim(),
            choices: choices ? choices.split(';').map(c => c.trim()) : [],
            answer: answer.trim()
        };
    }).filter(q => q.question); // 空行を除外
}

// 問題を表示する関数
function displayQuestion() {
    // 前回のフィードバックをクリア
    feedbackAreaEl.innerHTML = '';
    feedbackAreaEl.className = 'hidden';
    choicesAreaEl.innerHTML = '';
    userAnswer = '';

    const q = questions[currentQuestionIndex];
    questionNumberEl.textContent = `第 ${currentQuestionIndex + 1} 問`;

    // 問題の種類に応じて表示を切り替える
    switch (q.type) {
        case 1: // 選択問題
            questionTextEl.textContent = q.question;
            q.choices.forEach(choice => {
                const button = document.createElement('button');
                button.textContent = choice;
                button.onclick = () => {
                    // 他の選択肢の選択状態を解除
                    Array.from(choicesAreaEl.children).forEach(btn => btn.classList.remove('selected'));
                    // クリックしたボタンを選択状態にする
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

// 判定ボタンの処理
submitButton.addEventListener('click', () => {
    const q = questions[currentQuestionIndex];

    // ユーザーの解答を取得
    if (q.type === 1) {
        // 選択問題の解答はボタンクリック時に userAnswer に設定済み
    } else if (q.type === 2) {
        userAnswer = choicesAreaEl.querySelector('input').value;
    } else if (q.type === 3) {
        userAnswer = document.getElementById('fill-in-blank').value;
    }

    // 正誤判定
    if (userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase()) {
        feedbackAreaEl.textContent = `正解！ 答えは「${q.answer}」です。`;
        feedbackAreaEl.className = 'correct';
    } else {
        feedbackAreaEl.textContent = `不正解... 正しい答えは「${q.answer}」です。`;
        feedbackAreaEl.className = 'incorrect';
    }

    submitButton.classList.add('hidden');
    nextButton.classList.remove('hidden');
});

// 次の問題へボタンの処理
nextButton.addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        displayQuestion();
    } else {
        // 全ての問題が終了
        questionNumberEl.textContent = 'お疲れ様でした！';
        questionTextEl.textContent = '全ての問題が終了しました。';
        choicesAreaEl.innerHTML = '';
        feedbackAreaEl.innerHTML = '';
        feedbackAreaEl.className = 'hidden';
        submitButton.classList.add('hidden');
        nextButton.classList.add('hidden');
    }
});