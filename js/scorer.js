/*
 * 採点エンジン
 * 実装: フロントエンドエンジニア 匠(Takumi)
 * Canvas から取得した字形と標準筆画順序を比較して 100 点満点で採点
 *
 * 採点式:
 *   総得点 = 100
 *     - (100 - shapeScore) × 0.7  (字形: 70%)
 *     - (100 - strokeOrderScore) × 0.2  (筆画順序: 20%)
 *     - (100 - fluidnessScore) × 0.1  (流暢性: 10%)
 */

window.CalligraphyScorer = (function () {
  class Scorer {
    constructor(charData, strokeOrderDB) {
      this.charData = charData;           // 文字データ { char, strokes, boundingBox, ... }
      this.strokeOrderDB = strokeOrderDB; // 標準筆画情報
      this.userStrokes = [];              // ユーザーが描いたストロークの配列
      this.score = 0;
    }

    /**
     * ユーザーの描画ストロークを記録
     * @param {Uint8ClampedArray} canvasImageData - Canvas の ImageData ピクセルデータ
     * @param {number} width - Canvas 幅
     * @param {number} height - Canvas 高さ
     */
    recordUserStrokes(canvasImageData, width, height) {
      // Canvas ImageData からストローク（黒ピクセルの連続）を抽出
      this.userStrokes = this.extractStrokesFromImageData(canvasImageData, width, height);
    }

    /**
     * Canvas ImageData からストロークを抽出
     * @private
     */
    extractStrokesFromImageData(imageData, width, height) {
      const strokes = [];
      const pixels = new Uint8Array(imageData);
      const visited = new Set();

      // 各ピクセルをスキャン
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const alpha = pixels[idx + 3];

          // 描画されたピクセル（アルファ > 128）
          if (alpha > 128 && !visited.has(`${x},${y}`)) {
            // 新しいストロークの開始
            const stroke = this.traceStroke(pixels, width, height, x, y, visited);
            if (stroke.length > 3) {
              strokes.push(stroke);
            }
          }
        }
      }

      return strokes;
    }

    /**
     * 連続したピクセルをトレース（ストロークを取得）
     * @private
     */
    traceStroke(pixels, width, height, startX, startY, visited) {
      const stroke = [];
      const queue = [[startX, startY]];

      while (queue.length > 0) {
        const [x, y] = queue.shift();
        const key = `${x},${y}`;

        if (visited.has(key)) continue;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x) * 4;
        const alpha = pixels[idx + 3];

        if (alpha <= 128) continue;

        visited.add(key);
        stroke.push({ x, y });

        // 8 近傍のピクセルをキューに追加（接続性確保）
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            queue.push([x + dx, y + dy]);
          }
        }
      }

      return stroke;
    }

    /**
     * 総合採点を実行
     * @returns {number} スコア（0-100）
     */
    score() {
      if (this.userStrokes.length === 0) {
        return 0;  // 何も描いていない
      }

      const shapeScore = this.scoreShape();
      const strokeOrderScore = this.scoreStrokeOrder();
      const fluidnessScore = this.scoreFluidness();

      // 加重スコア（70%, 20%, 10%）
      const totalScore = 100 -
        ((100 - shapeScore) * 0.7 +
         (100 - strokeOrderScore) * 0.2 +
         (100 - fluidnessScore) * 0.1);

      this.score = Math.round(Math.max(0, Math.min(100, totalScore)));
      return this.score;
    }

    /**
     * 字形スコア（70%）
     * @private
     */
    scoreShape() {
      // 参照字とユーザー描画のピクセル重複度を計算

      if (!this.charData || !this.charData.boundingBox) {
        return 50;  // デフォルト値
      }

      // ユーザーの Bounding Box を計算
      const userBB = this.calculateBoundingBox(this.userStrokes);
      if (!userBB) return 0;

      // 参考字の Bounding Box
      const refBB = this.charData.boundingBox;

      // ユーザーの描画を参照枠に正規化
      const scale = Math.min(
        (refBB.maxX - refBB.minX) / (userBB.maxX - userBB.minX),
        (refBB.maxY - refBB.minY) / (userBB.maxY - userBB.minY)
      ) * 0.95;

      const normalizedStrokes = this.userStrokes.map(stroke =>
        stroke.map(p => ({
          x: refBB.minX + (p.x - userBB.minX) * scale,
          y: refBB.minY + (p.y - userBB.minY) * scale
        }))
      );

      // Jaccard Index で重複度を計算
      const userPixels = this.strokestoPixelSet(normalizedStrokes);
      const refPixels = new Set(
        (this.charData.reference_pixels || []).map(p => `${p.x},${p.y}`)
      );

      const intersection = [...userPixels].filter(p => refPixels.has(p)).length;
      const union = new Set([...userPixels, ...refPixels]).size;

      const overlapRatio = union > 0 ? intersection / union : 0;
      let shapeScore = overlapRatio * 100;

      // 枠外描画の減点
      const extraPixels = userPixels.size - intersection;
      const extraPenalty = (extraPixels / Math.max(1, userPixels.size)) * 20;

      return Math.max(0, shapeScore - extraPenalty);
    }

    /**
     * 筆画順序スコア（20%）
     * @private
     */
    scoreStrokeOrder() {
      const refStrokes = (this.charData.strokes || []);

      if (refStrokes.length === 0) {
        return 100;
      }

      // ストローク数の一致度
      const strokeCountMatch = Math.min(
        1,
        this.userStrokes.length / refStrokes.length
      );

      if (this.userStrokes.length === 0) {
        return 0;
      }

      // 完全一致: 100%, 1本多い/少ない: 85%, 2本以上: 60%
      let strokeScore = 100;
      const diff = Math.abs(this.userStrokes.length - refStrokes.length);

      if (diff === 0) strokeScore = 100;
      else if (diff === 1) strokeScore = 85;
      else if (diff <= 2) strokeScore = 70;
      else strokeScore = 50;

      return strokeScore;
    }

    /**
     * 流暢性スコア（10%）
     * @private
     */
    scoreFluidness() {
      let fluidityScore = 100;

      // ストロークの本数（多すぎるのは不自然）
      const strokeCount = this.userStrokes.length;
      if (strokeCount > 15) {
        fluidityScore -= Math.min(30, (strokeCount - 15) * 2);
      }

      // 各ストロークの長さを確認（短すぎるのは不自然）
      let shortStrokes = 0;
      this.userStrokes.forEach(stroke => {
        if (stroke.length < 5) {
          shortStrokes++;
        }
      });

      if (shortStrokes > strokeCount * 0.5) {
        fluidityScore -= 20;
      }

      return Math.max(0, fluidityScore);
    }

    /**
     * Bounding Box を計算
     * @private
     */
    calculateBoundingBox(strokes) {
      if (strokes.length === 0) return null;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      strokes.forEach(stroke => {
        stroke.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      });

      if (minX === Infinity) return null;

      return { minX, minY, maxX, maxY };
    }

    /**
     * ストロークをピクセルセットに変換
     * @private
     */
    strokestoPixelSet(strokes) {
      const pixels = new Set();

      strokes.forEach(stroke => {
        stroke.forEach(p => {
          const key = `${Math.round(p.x)},${Math.round(p.y)}`;
          pixels.add(key);
        });
      });

      return pixels;
    }
  }

  return Scorer;
})();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalligraphyScorer;
}
