/*
 * レッスンページ制御ロジック
 * Canvas 描画、採点、フィードバック、文字切り替え、進捗保存を管理
 * 実装: フロントエンドエンジニア 匠(Takumi)
 */

(function () {
  // グローバル変数
  const canvas = document.getElementById("drawingCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const clearBtn = document.getElementById("clearBtn");
  const submitBtn = document.getElementById("submitBtn");
  const nextBtn = document.getElementById("nextBtn");
  const feedbackPanel = document.getElementById("feedbackPanel");

  let gradeData = [];
  let currentCharIndex = 0;
  let userStrokes = [];
  let currentStroke = [];
  let isDrawing = false;

  /**
   * 初期化
   */
  function init() {
    // グレードデータを取得（lesson-01.html では GRADE_DATA、lesson-02.html では GRADE_DATA_02）
    gradeData = window.GRADE_DATA || [];

    if (gradeData.length === 0) {
      console.error("グレードデータが見つかりません");
      return;
    }

    // localStorage から最後の文字を復元
    const currentGrade = detectGrade();
    const saved = Progress.getGrade(currentGrade);
    if (saved && Object.keys(saved.solved).length > 0) {
      // 最後に解いた文字を探す
      const lastCharId = Object.keys(saved.solved)[Object.keys(saved.solved).length - 1];
      const foundIndex = gradeData.findIndex(c => c.id === lastCharId);
      if (foundIndex >= 0) {
        currentCharIndex = (foundIndex + 1) % gradeData.length;
      }
    }

    attachEventListeners();
    renderCharacter(currentCharIndex);
    drawReference();
    renderCharList();
  }

  /**
   * 現在のページから学年を推定
   */
  function detectGrade() {
    const href = window.location.href;
    if (href.includes("lesson-02")) return 2;
    if (href.includes("lesson-01")) return 1;
    return 1;  // デフォルト
  }

  /**
   * イベントリスナーをアタッチ
   */
  function attachEventListeners() {
    if (!canvas) return;

    // Canvas イベント
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseout", stopDrawing);

    // タッチイベント
    canvas.addEventListener("touchstart", handleTouch("start"));
    canvas.addEventListener("touchmove", handleTouch("move"));
    canvas.addEventListener("touchend", handleTouch("end"));

    // ボタンイベント
    if (clearBtn) clearBtn.addEventListener("click", clearCanvas);
    if (submitBtn) submitBtn.addEventListener("click", submitForScoring);
    if (nextBtn) nextBtn.addEventListener("click", nextCharacter);
  }

  /**
   * 参考字を背景に描画
   */
  function drawReference() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const char = gradeData[currentCharIndex];
    if (!char || !char.strokes) return;

    // 薄いグレーで参考字を描画
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    char.strokes.forEach(stroke => {
      if (stroke.start && stroke.end) {
        ctx.beginPath();
        ctx.moveTo(stroke.start.x, stroke.start.y);
        ctx.lineTo(stroke.end.x, stroke.end.y);
        ctx.stroke();
      }
    });

    ctx.globalAlpha = 1.0;

    // ユーザーが描いた線を再描画
    redrawUserStrokes();
  }

  /**
   * ユーザーが描いた線を再描画
   */
  function redrawUserStrokes() {
    if (!ctx) return;

    ctx.strokeStyle = "#c41e3a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    userStrokes.forEach(stroke => {
      if (stroke.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);

      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }

      ctx.stroke();
    });
  }

  /**
   * マウス・タッチイベント処理
   */
  function startDrawing(e) {
    if (!canvas) return;

    isDrawing = true;
    const { x, y } = getCanvasCoords(e, canvas);
    currentStroke = [{ x, y }];
  }

  function draw(e) {
    if (!isDrawing || !canvas) return;

    const { x, y } = getCanvasCoords(e, canvas);
    currentStroke.push({ x, y });

    // リアルタイム描画
    drawReference();
  }

  function stopDrawing() {
    if (!isDrawing) return;

    if (currentStroke.length > 5) {
      userStrokes.push(currentStroke);
    }

    isDrawing = false;
    currentStroke = [];
  }

  function handleTouch(phase) {
    return (e) => {
      e.preventDefault();

      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return;

      const fakeEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY
      };

      if (phase === "start") startDrawing(fakeEvent);
      else if (phase === "move") draw(fakeEvent);
      else stopDrawing();
    };
  }

  /**
   * Canvas 座標を取得
   */
  function getCanvasCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * Canvas をクリア
   */
  function clearCanvas() {
    userStrokes = [];
    currentStroke = [];
    drawReference();
  }

  /**
   * 採点実行
   */
  function submitForScoring() {
    const char = gradeData[currentCharIndex];

    if (!char) return;

    // Canvas ImageData を取得
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 採点エンジンを実行
    const scorer = new CalligraphyScorer(char, window.STROKE_ORDER_DB?.[char.char]);
    scorer.recordUserStrokes(imageData.data, canvas.width, canvas.height);

    const score = scorer.score();

    // フィードバック表示
    displayFeedback(score);

    // 進捗を保存
    const currentGrade = detectGrade();
    Progress.setSolved(currentGrade, char.id, score);

    // 文字リストを更新
    renderCharList();
  }

  /**
   * フィードバック表示
   */
  function displayFeedback(score) {
    const scoreNumEl = document.getElementById("scoreNum");
    const feedbackTextEl = document.getElementById("feedback");
    const scoreCircleEl = document.getElementById("scoreCircle");

    if (Feedback && Feedback.display) {
      Feedback.display(score, feedbackPanel, scoreNumEl, feedbackTextEl, scoreCircleEl);
    } else {
      // フォールバック
      scoreNumEl.textContent = score;
      const msg = score >= 80 ? "素晴らしい！" : score >= 60 ? "よくできました！" : "もう一度トライしましょう";
      feedbackTextEl.textContent = msg;
      feedbackPanel.style.display = "block";
    }
  }

  /**
   * 次の文字へ
   */
  function nextCharacter() {
    currentCharIndex = (currentCharIndex + 1) % gradeData.length;
    userStrokes = [];
    currentStroke = [];
    renderCharacter(currentCharIndex);
    drawReference();
    feedbackPanel.style.display = "none";
  }

  /**
   * 文字を表示
   */
  function renderCharacter(index) {
    const char = gradeData[index];

    if (!char) return;

    document.getElementById("charName").textContent = char.char;

    const readingText = char.type === "hiragana"
      ? `${char.reading}（ひらがな）`
      : `${char.reading}（漢字）`;

    document.getElementById("charReading").textContent = readingText;

    const exampleEl = document.getElementById("charExample");
    if (exampleEl && char.word_example) {
      exampleEl.textContent = `例: ${char.word_example}`;
    }
  }

  /**
   * 文字一覧をレンダリング
   */
  function renderCharList() {
    const charListEl = document.getElementById("charList");

    if (!charListEl) return;

    charListEl.innerHTML = "";

    const currentGrade = detectGrade();
    const stats = Progress.getGrade(currentGrade);

    gradeData.forEach(char => {
      const btn = document.createElement("button");
      btn.className = "char-button";
      btn.textContent = char.char;

      // 合格済みなら solved クラスを追加
      if (stats.mastered && stats.mastered.includes(char.id)) {
        btn.classList.add("solved");
      }

      btn.addEventListener("click", () => {
        const index = gradeData.findIndex(c => c.id === char.id);
        if (index >= 0) {
          currentCharIndex = index;
          userStrokes = [];
          currentStroke = [];
          renderCharacter(currentCharIndex);
          drawReference();
          feedbackPanel.style.display = "none";
        }
      });

      charListEl.appendChild(btn);
    });
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
