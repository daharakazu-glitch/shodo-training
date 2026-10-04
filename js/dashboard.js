/*
 * ダッシュボード制御ロジック
 * index.html の学年グリッド、進捗バー、ナビゲーション管理
 */

(function () {
  function init() {
    renderGradeGrid();
    updateProgressBar();
  }

  /**
   * 学年グリッドをレンダリング
   */
  function renderGradeGrid() {
    const gradeGrid = document.getElementById("gradeGrid");

    if (!gradeGrid || !window.GRADES_META) return;

    gradeGrid.innerHTML = "";

    window.GRADES_META.forEach(meta => {
      const btn = document.createElement("a");
      btn.className = "grade-btn";
      btn.href = meta.href;

      if (meta.disabled) {
        btn.style.pointerEvents = "none";
        btn.style.opacity = "0.6";
      }

      // 進捗を確認して completed クラスを追加
      const stats = Progress.getGrade(meta.grade);
      const masteredCount = (stats.mastered || []).length;

      if (masteredCount > 0 && masteredCount === meta.total) {
        btn.classList.add("completed");
      }

      // 内容
      btn.innerHTML = `
        <div style="font-size: 1.8rem; margin-bottom: 0.3rem;">
          ${meta.grade}年
        </div>
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.3rem;">
          ${meta.subtitle}
        </div>
        <div style="font-size: 0.8rem; color: #999;">
          ${masteredCount || 0} / ${meta.total}
        </div>
      `;

      gradeGrid.appendChild(btn);
    });
  }

  /**
   * 全体進捗バーを更新
   */
  function updateProgressBar() {
    const statNum = document.getElementById("statNum");
    const barFill = document.getElementById("barFill");

    if (!statNum || !barFill || !window.GRADES_META) return;

    let totalMastered = 0;
    let totalChars = 0;

    window.GRADES_META.forEach(meta => {
      if (meta.disabled) return;

      const stats = Progress.getGrade(meta.grade);
      totalMastered += (stats.mastered || []).length;
      totalChars += meta.total;
    });

    const percentage = totalChars > 0 ? (totalMastered / totalChars) * 100 : 0;

    statNum.textContent = `${totalMastered} / ${totalChars}`;
    barFill.style.width = percentage + "%";
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
