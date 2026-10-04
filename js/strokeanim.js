/*
 * 書き順アニメーション（教示用・採点には使わない）
 * 実装: フロントエンドエンジニア 匠(Takumi)
 *
 * 写真からは「どの順で書いたか」は分からないため、書き順は採点せず
 * 「お手本の動き」として見せることに専念する。
 *
 * 文字データ（data/gradeNN.js）の strokes を順に1画ずつ描く。
 *   path: [{x,y}, ...] があればそれをたどる
 *   無ければ start → end の直線でつなぐ
 * 座標系は 0〜VIEW（400）の正方形を前提とする。
 */

window.StrokeAnim = (function () {
  const VIEW = 400;

  const INK = "#1a3a52";       // 描き終わった画
  const ACTIVE = "#c41e3a";    // いま描いている画
  const GHOST = "#e3ded8";     // まだ描いていない画
  const GUIDE = "#efe9e2";     // 十字の補助線

  const MS_PER_STROKE = 900;   // 1画あたりの時間

  /**
   * アニメーションを作る
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Object} charData data/gradeNN.js の1文字分
   * @param {Object} [opts] { onStroke: (index, stroke) => void }
   * @returns {Object} コントローラ
   */
  function create(canvas, charData, opts) {
    const ctx = canvas.getContext("2d");
    const options = opts || {};
    const strokes = normalizeStrokes(charData);

    let rafId = null;
    let startedAt = 0;
    let progress = 0;        // 0〜strokes.length
    let playing = false;
    let lastNotified = -1;

    /* ---------- 描画 ---------- */

    function scale() {
      return Math.min(canvas.width, canvas.height) / VIEW;
    }

    function render() {
      const s = scale();

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#fffdfa";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.scale(s, s);
      drawGuide(ctx);

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      strokes.forEach((stroke, i) => {
        const done = progress - i;

        if (done <= 0) {
          drawStroke(ctx, stroke, 1, GHOST, 10);
        } else if (done >= 1) {
          drawStroke(ctx, stroke, 1, INK, 14);
        } else {
          drawStroke(ctx, stroke, 1, GHOST, 10);
          drawStroke(ctx, stroke, easeOut(done), ACTIVE, 16);
          drawTip(ctx, stroke, easeOut(done));
        }
      });

      drawNumbers(ctx, strokes, progress);
      ctx.restore();
    }

    /* ---------- 再生制御 ---------- */

    function tick(now) {
      if (!playing) return;

      const elapsed = now - startedAt;
      progress = Math.min(strokes.length, elapsed / MS_PER_STROKE);

      notify();
      render();

      if (progress >= strokes.length) {
        playing = false;
        rafId = null;
        return;
      }

      rafId = requestAnimationFrame(tick);
    }

    function notify() {
      const idx = Math.min(strokes.length - 1, Math.floor(progress));
      if (idx !== lastNotified && options.onStroke) {
        lastNotified = idx;
        options.onStroke(idx, strokes[idx]);
      }
    }

    function play() {
      if (strokes.length === 0) return;

      if (progress >= strokes.length) progress = 0;

      playing = true;
      lastNotified = -1;
      startedAt = performance.now() - progress * MS_PER_STROKE;

      if (rafId === null) rafId = requestAnimationFrame(tick);
    }

    function pause() {
      playing = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function reset() {
      pause();
      progress = 0;
      lastNotified = -1;
      render();
    }

    /** 1画ずつ進める（ゆっくり確認したいとき用） */
    function step() {
      pause();
      progress = Math.min(strokes.length, Math.floor(progress) + 1);
      if (progress >= strokes.length) progress = strokes.length;
      notify();
      render();
    }

    /** 全画を描いた状態にする */
    function showAll() {
      pause();
      progress = strokes.length;
      render();
    }

    render();

    return {
      play,
      pause,
      reset,
      step,
      showAll,
      render,
      strokes,
      isPlaying: () => playing,
      strokeCount: () => strokes.length
    };
  }

  /* ============================================================
   * 画の整形
   * ========================================================== */

  /**
   * strokes を {points:[{x,y}], order, name, ending, hint} の形に揃える
   * @private
   */
  function normalizeStrokes(charData) {
    if (!charData || !Array.isArray(charData.strokes)) return [];

    return charData.strokes
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(s => ({
        order: s.order,
        name: s.name || s.description || `第${s.order}画`,
        ending: s.ending || "none",
        hint: s.hint || "",
        points: pointsOf(s)
      }))
      .filter(s => s.points.length >= 2);
  }

  /** @private */
  function pointsOf(stroke) {
    if (Array.isArray(stroke.path) && stroke.path.length >= 2) {
      return stroke.path.map(p => ({ x: p.x, y: p.y }));
    }
    if (stroke.start && stroke.end) {
      return [
        { x: stroke.start.x, y: stroke.start.y },
        { x: stroke.end.x, y: stroke.end.y }
      ];
    }
    return [];
  }

  /* ============================================================
   * 描画ヘルパー
   * ========================================================== */

  /** @private 十字の補助線（字の中心を取る練習のため） */
  function drawGuide(ctx) {
    ctx.save();
    ctx.strokeStyle = GUIDE;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(VIEW / 2, 0);
    ctx.lineTo(VIEW / 2, VIEW);
    ctx.moveTo(0, VIEW / 2);
    ctx.lineTo(VIEW, VIEW / 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 画を ratio（0〜1）の分だけ描く
   * @private
   */
  function drawStroke(ctx, stroke, ratio, color, width) {
    const pts = stroke.points;
    const total = pathLength(pts);
    const target = total * ratio;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const seg = dist(pts[i - 1], pts[i]);

      if (acc + seg <= target) {
        ctx.lineTo(pts[i].x, pts[i].y);
        acc += seg;
        continue;
      }

      // 区間の途中で止める
      const t = seg > 0 ? (target - acc) / seg : 0;
      ctx.lineTo(
        pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t
      );
      break;
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * 筆先の位置に丸を置く（どこを書いているか分かりやすくする）
   * @private
   */
  function drawTip(ctx, stroke, ratio) {
    const p = pointAt(stroke.points, ratio);
    if (!p) return;

    ctx.save();
    ctx.fillStyle = ACTIVE;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 各画の始点に番号を振る
   * @private
   */
  function drawNumbers(ctx, strokes, progress) {
    ctx.save();
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    strokes.forEach((stroke, i) => {
      const p = stroke.points[0];
      const active = progress > i && progress < i + 1;

      ctx.fillStyle = active ? ACTIVE : "#9b948c";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.fillText(String(i + 1), p.x, p.y + 1);
    });

    ctx.restore();
  }

  /* ============================================================
   * 幾何ユーティリティ
   * ========================================================== */

  /** @private */
  function dist(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  /** @private */
  function pathLength(pts) {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
    return total;
  }

  /** @private 経路上の ratio の位置 */
  function pointAt(pts, ratio) {
    const total = pathLength(pts);
    if (total === 0) return pts[0];

    const target = total * ratio;
    let acc = 0;

    for (let i = 1; i < pts.length; i++) {
      const seg = dist(pts[i - 1], pts[i]);

      if (acc + seg >= target) {
        const t = seg > 0 ? (target - acc) / seg : 0;
        return {
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t
        };
      }
      acc += seg;
    }

    return pts[pts.length - 1];
  }

  /** @private 筆を置いて払う動きに近づける */
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 2);
  }

  return { create, VIEW };
})();
