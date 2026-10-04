/*
 * 進捗ストレージ（localStorage）
 * 実装: フロントエンドエンジニア 匠(Takumi)
 * ログイン不要のブラウザ内保存で進捗を管理する
 *
 * 保存キー: shodo_app_progress
 * 構造:
 *   {
 *     "grade1": { solved: { "001": 85, "002": 92, ... }, mastered: ["001", "002", ...] },
 *     "grade2": { ... }
 *   }
 */

window.Progress = (function () {
  const KEY = "shodo_app_progress";

  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      console.warn("localStorage 読み込みエラー:", e);
      return {};
    }
  }

  function writeAll(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("localStorage 書き込みエラー（プライベートモード等）:", e);
      /* 保存不可でもアプリは動作継続 */
    }
  }

  /**
   * 指定学年の進捗情報を取得
   * @param {number} grade - 学年（1-6）
   * @returns {Object} { solved: {charId: score, ...}, mastered: [charId, ...] }
   */
  function getGrade(grade) {
    const all = readAll();
    const key = `grade${grade}`;
    const g = all[key] || {};
    return {
      solved: g.solved || {},
      mastered: g.mastered || []
    };
  }

  /**
   * 指定学年の指定文字の採点結果を保存
   * @param {number} grade - 学年
   * @param {string} charId - 文字ID（例："001"）
   * @param {number} score - スコア（0-100）
   */
  function setSolved(grade, charId, score) {
    const all = readAll();
    const key = `grade${grade}`;

    if (!all[key]) {
      all[key] = { solved: {}, mastered: [] };
    }

    all[key].solved[charId] = Math.round(score);

    // 80点以上で mastered に追加
    if (score >= 80 && !all[key].mastered.includes(charId)) {
      all[key].mastered.push(charId);
    } else if (score < 80 && all[key].mastered.includes(charId)) {
      // 80点未満に下がった場合は削除
      all[key].mastered = all[key].mastered.filter(id => id !== charId);
    }

    writeAll(all);
  }

  /**
   * 指定学年の合格数（80点以上）を返す
   * @param {number} grade - 学年
   * @returns {number} 合格文字数
   */
  function masteredCount(grade) {
    const g = getGrade(grade);
    return (g.mastered || []).length;
  }

  /**
   * 全学年の全体統計を取得
   * @returns {Object} { totalSolved: number, totalMastered: number }
   */
  function getOverallStats() {
    const all = readAll();
    let totalSolved = 0;
    let totalMastered = 0;

    window.GRADES_META.forEach(meta => {
      const g = all[`grade${meta.grade}`] || {};
      totalSolved += Object.keys(g.solved || {}).length;
      totalMastered += (g.mastered || []).length;
    });

    return { totalSolved, totalMastered };
  }

  /**
   * すべての進捗をクリア（デバッグ用）
   */
  function clearAll() {
    if (confirm("すべての進捗を削除しますか？")) {
      localStorage.removeItem(KEY);
      console.log("進捗をクリアしました");
    }
  }

  return {
    getGrade,
    setSolved,
    masteredCount,
    getOverallStats,
    clearAll,
    readAll  // デバッグ用
  };
})();
