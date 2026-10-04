/*
 * 点数の色づけ
 * 実装: UX/UIデザイナー 彩(Aya)
 *
 * 講評の文章は採点エンジン(js/scorer.js)が組み立てる。
 * ここは「点数を見てすぐ分かる色」だけを受け持つ。
 */

window.Feedback = (function () {
  /**
   * 点数に対応する色
   * @param {number} score 0〜100
   * @returns {string} CSS の色
   */
  function colorFor(score) {
    if (score >= 95) return "#c9a227";  // 金
    if (score >= 85) return "#2d7d3a";  // 緑
    if (score >= 70) return "#4d9b4a";  // 明るい緑
    if (score >= 55) return "#d9a62c";  // 山吹
    return "#d97d2c";                   // だいだい
  }

  /**
   * その色の上に重ねる文字色
   */
  function textColorFor(score) {
    return score >= 95 || (score >= 55 && score < 70) ? "#2b2b2b" : "#ffffff";
  }

  return { colorFor, textColorFor };
})();
