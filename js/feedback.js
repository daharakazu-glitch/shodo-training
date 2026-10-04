/*
 * フィードバック表示ロジック
 * スコアに応じた励ましメッセージと色分けを管理
 */

window.Feedback = (function () {
  /**
   * スコアに応じたメッセージを取得
   * @param {number} score - 採点スコア（0-100）
   * @returns {Object} { message: string, tier: string }
   */
  function generateMessage(score) {
    if (score === 100) {
      return {
        message: "満点です！完璧な字です。😄",
        tier: "excellent"
      };
    } else if (score >= 85) {
      return {
        message: "素晴らしい！とても上手です。👏",
        tier: "great"
      };
    } else if (score >= 70) {
      return {
        message: "よくできました！もう少しきれいに書いてみましょう。👍",
        tier: "good"
      };
    } else if (score >= 50) {
      return {
        message: "もう一度トライしてみましょう。頑張って！💪",
        tier: "fair"
      };
    } else {
      return {
        message: "ゆっくり丁寧に描いてみましょう。何度でも練習できます。✏️",
        tier: "needs-work"
      };
    }
  }

  /**
   * スコアに応じた色（円形表示）を取得
   * @param {number} score - 採点スコア
   * @returns {Object} { backgroundColor: string, color: string }
   */
  function getScoreColor(score) {
    if (score === 100) {
      return { backgroundColor: "#FFD700", color: "#333" };  // 金
    } else if (score >= 85) {
      return { backgroundColor: "#2d7d3a", color: "white" };  // 緑
    } else if (score >= 70) {
      return { backgroundColor: "#4db347", color: "white" };  // 明るい緑
    } else if (score >= 50) {
      return { backgroundColor: "#ffc107", color: "#333" };  // 黄
    } else {
      return { backgroundColor: "#d97d2c", color: "white" };  // オレンジ
    }
  }

  /**
   * フィードバック要素を表示
   * @param {number} score - スコア
   * @param {HTMLElement} feedbackPanel - フィードバック要素
   * @param {HTMLElement} scoreNumEl - スコア数値要素
   * @param {HTMLElement} feedbackTextEl - メッセージ要素
   * @param {HTMLElement} scoreCircleEl - スコア円形要素
   */
  function display(score, feedbackPanel, scoreNumEl, feedbackTextEl, scoreCircleEl) {
    const msg = generateMessage(score);
    const color = getScoreColor(score);

    // スコア数値を更新
    scoreNumEl.textContent = score;

    // メッセージを更新
    feedbackTextEl.textContent = msg.message;
    feedbackTextEl.className = `feedback-text tier-${msg.tier}`;

    // スコア円形を更新
    if (scoreCircleEl) {
      scoreCircleEl.textContent = score;
      scoreCircleEl.style.backgroundColor = color.backgroundColor;
      scoreCircleEl.style.color = color.color;
    }

    // パネルを表示
    feedbackPanel.style.display = "block";

    // アニメーション効果（フェードイン）
    feedbackPanel.style.opacity = "0";
    feedbackPanel.style.transition = "opacity 0.3s ease-in";
    setTimeout(() => {
      feedbackPanel.style.opacity = "1";
    }, 10);
  }

  return {
    generateMessage,
    getScoreColor,
    display
  };
})();
