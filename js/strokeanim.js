/*
 * 書き順アニメーション（教示用・採点には使わない）
 * 実装: フロントエンドエンジニア 匠(Takumi)
 *
 * 写真からは「どの順で書いたか」は分からないため、書き順は採点せず
 * 「お手本の動き」として見せることに専念する。
 *
 * 画面に出る字の形は毛筆フォント（BrushFont）が描く。
 * 教材データ（data/gradeNN.js）の path は、その字形を1画ずつ現していくための
 * 道筋として使う。折れ線をそのまま見せると毛筆の手本にならないため、
 * 「どこを通るか」だけを path に任せ、「どんな形か」はフォントに任せる。
 *
 * 座標系は 0〜VIEW（400）の正方形を前提とする。
 */

window.StrokeAnim = (function () {
  const VIEW = 400;

  const INK = "#1f1b16";       // 描き終わった画（墨色）
  const ACTIVE = "#c41e3a";    // いま描いている画
  const GHOST = "rgba(31,27,22,0.12)"; // まだ描いていない画（うすい手本）
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
    const side = Math.min(canvas.width, canvas.height);

    const scratch = makeScratch(side);

    // 手本の字形。毛筆フォントが届くまでは退避先のフォントで描き、届いたら描き直す。
    let glyph = null;
    let paths = fitPaths(strokes, null, side);
    let layers = [];
    let bands = [];   // 画ごとの線の太さの半分（筆先までを出すときの消し幅に使う）

    useGlyph(BrushFont.glyph(charData.char, side));
    BrushFont.load().then(() => {
      useGlyph(BrushFont.glyph(charData.char, side));
      render();
    });

    function useGlyph(g) {
      glyph = g;
      paths = fitPaths(strokes, g, side);
      const built = g ? buildLayers(g, paths, side) : { layers: [], bands: [] };
      layers = built.layers;
      bands = built.bands;
    }

    let rafId = null;
    let startedAt = 0;
    let progress = 0;        // 0〜strokes.length
    let playing = false;
    let lastNotified = -1;

    /* ---------- 描画 ---------- */

    function render() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#fffdfa";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawGuide(ctx, side);

      const whole = Math.floor(progress);
      const partial = progress - whole;

      if (glyph) {
        // まだ書いていないところも、うすい手本として見えるようにする
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.drawImage(glyph.canvas, 0, 0);
        ctx.restore();

        if (whole > 0) {
          ctx.drawImage(tinted(layers.slice(0, whole), INK), 0, 0);
        }

        if (whole < layers.length && partial > 0) {
          ctx.drawImage(partialLayer(whole, easeOut(partial)), 0, 0);
        }
      } else {
        // フォントが届くまでの間に合わせ
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        paths.forEach((pts, i) => {
          drawStroke(ctx, pts, 1, GHOST, 10);
          const done = progress - i;
          if (done > 0) drawStroke(ctx, pts, Math.min(1, done), INK, 14);
        });
      }

      if (whole < paths.length && partial > 0) {
        drawTip(ctx, paths[whole], easeOut(partial));
      }

      drawNumbers(ctx, paths, progress);
    }

    /**
     * 指定した画の層を重ねて色を付ける
     * @private
     */
    function tinted(list, color) {
      const g = scratch.getContext("2d");

      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, side, side);
      list.forEach(layer => g.drawImage(layer, 0, 0));

      g.globalCompositeOperation = "source-in";
      g.fillStyle = color;
      g.fillRect(0, 0, side, side);

      g.globalCompositeOperation = "source-over";
      return scratch;
    }

    /**
     * いま書いている画を、筆先の位置まで出した層
     *
     * その画が受け持つ部分だけを並べた層から、まだ書いていない側を消す。
     *
     * 消す帯はその画の線の太さに合わせる。太くしすぎると、帯の丸い先が
     * 書き終わった側まで食い込み、墨が筆先から大きく遅れて出てしまう。
     *
     * @private
     */
    function partialLayer(i, ratio) {
      const g = scratch.getContext("2d");

      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, side, side);
      g.drawImage(layers[i], 0, 0);

      const rest = subPath(paths[i], ratio);
      if (rest.length >= 2) {
        g.globalCompositeOperation = "destination-out";
        drawStroke(g, rest, 1, "#000", (bands[i] || side * 0.03) * 3);
      }

      g.globalCompositeOperation = "source-in";
      g.fillStyle = ACTIVE;
      g.fillRect(0, 0, side, side);

      g.globalCompositeOperation = "source-over";
      return scratch;
    }

    /* ---------- 再生制御 ---------- */

    function tick(now) {
      if (!playing) return;

      const elapsed = now - startedAt;
      progress = Math.min(strokes.length, elapsed / MS_PER_STROKE);

      notify(Math.floor(progress));
      render();

      if (progress >= strokes.length) {
        playing = false;
        rafId = null;
        return;
      }

      rafId = requestAnimationFrame(tick);
    }

    function notify(index) {
      const idx = Math.max(0, Math.min(strokes.length - 1, index));
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
      notify(progress - 1); // いま書き終えた画を伝える
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

  /** @private 字形を切り出すための作業用キャンバス */
  function makeScratch(side) {
    const cv = document.createElement("canvas");
    cv.width = side;
    cv.height = side;
    return cv;
  }

  /**
   * 教材データの道筋（0〜VIEW）を、手本の字形が占める範囲にそろえてキャンバス座標にする。
   *
   * 道筋は手描きなので、字形とぴたりとは一致しない。字形の方を動かすと手本が
   * ゆがむので、道筋の側を字形の外接矩形に合わせる。道筋は字形を1画ずつ
   * 現すための帯でしかないため、多少伸び縮みしても見た目に影響しない。
   *
   * @private
   * @returns {Array<Array<{x:number,y:number}>>} 画ごとのキャンバス座標の点列
   */
  function fitPaths(strokes, glyph, side) {
    const pts = [];
    strokes.forEach(s => pts.push(...s.points));

    if (!glyph || pts.length < 2) {
      const k = side / VIEW;
      return strokes.map(s => s.points.map(p => ({ x: p.x * k, y: p.y * k })));
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const b = glyph.box;
    const sx = b.w / Math.max(1, maxX - minX);
    const sy = b.h / Math.max(1, maxY - minY);

    return strokes.map(s =>
      s.points.map(p => ({
        x: b.x + (p.x - minX) * sx,
        y: b.y + (p.y - minY) * sy
      }))
    );
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

  /**
   * 手本の墨を、画ごとの層に分ける。
   *
   * 画素を「いちばん近い道筋」の画だけに振り分けると、画が交わるところで
   * 両側から切り込みが入り、1画ずつ見たときに楔形に欠けた線になってしまう。
   * 毛筆は交点でも一本の線として運ぶので、それでは手本にならない。
   *
   * そこで各画は、
   *   ・いちばん近い道筋が自分である画素（画のふくらみや払いの先まで拾える）
   *   ・自分の道筋から、その画の線の太さの半分以内にある画素
   * の両方を受け持つ。後者があるおかげで、交わるところでも線が切れずにつながる。
   * 重なった分は前後の画が重ねて持つが、墨の色は同じなので見た目は変わらない。
   *
   * 受け持つ幅は画ごとに違う（太い横画と細い払いでは倍ちがう）ので、
   * 手本の墨そのものから画ごとに測る。一律に広く取ると、交点で隣の画の墨まで
   * 抱き込んでこぶのようにふくらんでしまう。
   *
   * @private
   * @returns {{layers:Array<HTMLCanvasElement>, bands:Array<number>}}
   *          画ごとの層（黒・背景は透明）と、画ごとの線の太さの半分
   */
  function buildLayers(glyph, paths, side) {
    const src = glyph.canvas.getContext("2d").getImageData(0, 0, side, side).data;
    const buffers = paths.map(() => new Uint8ClampedArray(side * side * 4));
    const thickness = inkThickness(src, side);
    const bands = paths.map(pts => halfWidthAlong(pts, thickness, side) * 1.15);
    const dists = new Array(paths.length);

    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const i = (y * side + x) * 4;
        const alpha = src[i + 3];
        if (alpha === 0) continue;

        let best = 0;
        let bestD = Infinity;
        for (let k = 0; k < paths.length; k++) {
          const d = distToPath(x, y, paths[k]);
          dists[k] = d;
          if (d < bestD) {
            bestD = d;
            best = k;
          }
        }

        // 色は後から付けるので黒（0,0,0）のまま、濃さだけ入れる
        for (let k = 0; k < paths.length; k++) {
          if (k === best || dists[k] <= bands[k]) buffers[k][i + 3] = alpha;
        }
      }
    }

    const layers = buffers.map(buf => {
      const cv = makeScratch(side);
      cv.getContext("2d").putImageData(new ImageData(buf, side, side), 0, 0);
      return cv;
    });

    return { layers, bands };
  }

  /**
   * 墨の各点から紙（余白）までの距離を測る。
   *
   * 線の真ん中がいちばん大きく、ふちで 0 になる。線の芯での値が
   * そのまま「そこでの線の太さの半分」になる。
   *
   * @private
   * @returns {Float32Array} side*side の距離
   */
  function inkThickness(src, side) {
    const INF = side * 2;
    const d = new Float32Array(side * side);

    for (let i = 0, p = 0; p < d.length; i += 4, p++) {
      d[p] = src[i + 3] >= 128 ? INF : 0;
    }

    const at = (x, y) => (x < 0 || y < 0 || x >= side || y >= side ? 0 : d[y * side + x]);

    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const p = y * side + x;
        if (d[p] === 0) continue;
        d[p] = Math.min(
          d[p],
          at(x - 1, y) + 1, at(x, y - 1) + 1,
          at(x - 1, y - 1) + 1.4142, at(x + 1, y - 1) + 1.4142
        );
      }
    }
    for (let y = side - 1; y >= 0; y--) {
      for (let x = side - 1; x >= 0; x--) {
        const p = y * side + x;
        if (d[p] === 0) continue;
        d[p] = Math.min(
          d[p],
          at(x + 1, y) + 1, at(x, y + 1) + 1,
          at(x + 1, y + 1) + 1.4142, at(x - 1, y + 1) + 1.4142
        );
      }
    }

    return d;
  }

  /**
   * ある画の線の太さの半分を求める。
   *
   * 道筋をたどりながら、その真下の墨の厚みを拾って中央値を取る。
   * 平均ではなく中央値にするのは、払いの先や起筆のふくらみに引きずられないため。
   *
   * @private
   */
  function halfWidthAlong(pts, thickness, side) {
    const samples = [];
    const total = pathLength(pts);
    const steps = Math.max(8, Math.round(total / 3));

    for (let i = 0; i <= steps; i++) {
      const p = pointAt(pts, i / steps);
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (x < 0 || y < 0 || x >= side || y >= side) continue;
      const v = thickness[y * side + x];
      if (v > 0) samples.push(v);
    }

    if (samples.length === 0) return side * 0.03;

    samples.sort((a, b) => a - b);
    const mid = samples[samples.length >> 1];

    return Math.max(side * 0.012, Math.min(side * 0.06, mid));
  }

  /** @private 点から折れ線までの距離 */
  function distToPath(x, y, pts) {
    let best = Infinity;

    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;

      let t = len2 === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;

      const ex = x - (a.x + dx * t);
      const ey = y - (a.y + dy * t);
      const d = ex * ex + ey * ey;
      if (d < best) best = d;
    }

    return Math.sqrt(best);
  }

  /* ============================================================
   * 描画ヘルパー
   * ========================================================== */

  /** @private 十字の補助線（字の中心を取る練習のため） */
  function drawGuide(ctx, side) {
    ctx.save();
    ctx.strokeStyle = GUIDE;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(side / 2, 0);
    ctx.lineTo(side / 2, side);
    ctx.moveTo(0, side / 2);
    ctx.lineTo(side, side / 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 画を ratio（0〜1）の分だけ描く
   * @private
   * @param {Array<{x:number,y:number}>} pts キャンバス座標の点列
   */
  function drawStroke(ctx, pts, ratio, color, width) {
    const total = pathLength(pts);
    const target = total * ratio;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
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
  function drawTip(ctx, pts, ratio) {
    const p = pointAt(pts, ratio);
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
  function drawNumbers(ctx, paths, progress) {
    ctx.save();
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    paths.forEach((pts, i) => {
      const p = pts[0];
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

  /**
   * 経路のうち ratio から終点までの部分
   * @private
   */
  function subPath(pts, ratio) {
    const start = pointAt(pts, ratio);
    if (!start) return [];

    const total = pathLength(pts);
    const target = total * ratio;
    const out = [start];

    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += dist(pts[i - 1], pts[i]);
      if (acc > target) out.push(pts[i]);
    }

    return out;
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
