/*
 * 毛筆の手本字形
 * 実装: フロントエンドエンジニア 匠(Takumi)
 *
 * 手本の字そのものは Yuji Syuku（佑字 肅）で描く。
 * これは書家が実際に毛筆で書いた楷書をもとにしたフォントで、
 * とめ・はね・はらいの筆づかいがそのまま形になっている。
 * 手描きの折れ線を手本に使うと毛筆の手本にならないため、字形はフォントに任せ、
 * 教材データの path は「どの画をどの順で書くか」を示す道筋としてだけ使う。
 *
 * 座標系は書き順アニメーションと同じ 0〜VIEW（400）の正方形。
 */

window.BrushFont = (function () {
  const VIEW = 400;

  // Yuji Syuku が読めない環境のための退避先。
  // Klee One は教科書体に近く、明朝より筆の形に近い。
  const STACK = [
    '"Yuji Syuku"',
    '"Klee One"',
    '"Hiragino Mincho ProN"',
    '"Yu Mincho"',
    '"Noto Serif JP"',
    "serif"
  ].join(", ");

  let loaded = false;
  let loading = null;

  /**
   * 毛筆フォントの読み込みを待つ。
   * 読めなくても退避先のフォントで動くので、失敗しても解決する。
   *
   * @returns {Promise<boolean>} 毛筆フォントが使えるか
   */
  function load() {
    if (loading) return loading;

    if (!document.fonts || !document.fonts.load) {
      loading = Promise.resolve(false);
      return loading;
    }

    loading = document.fonts
      .load('400 100px "Yuji Syuku"', "書道一二三")
      .then(faces => {
        loaded = faces.length > 0;
        return loaded;
      })
      .catch(() => false);

    return loading;
  }

  function isLoaded() {
    return loaded;
  }

  function fontStack() {
    return STACK;
  }

  /* ============================================================
   * 字形の描画
   * ========================================================== */

  /**
   * 1文字を透明な背景に黒で描き、墨の付いた範囲を測る
   *
   * @private
   * @returns {{canvas:HTMLCanvasElement, box:{x:number,y:number,w:number,h:number}}|null}
   */
  function renderGlyph(char, R) {
    const cv = document.createElement("canvas");
    cv.width = R;
    cv.height = R;

    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.font = `${Math.round(R * 0.74)}px ${STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, R / 2, R / 2);

    const box = inkBox(ctx.getImageData(0, 0, R, R), R);
    return box ? { canvas: cv, box } : null;
  }

  /**
   * 不透明な画素の外接矩形
   * @private
   */
  function inkBox(imageData, R) {
    const d = imageData.data;
    let minX = R, minY = R, maxX = -1, maxY = -1;

    for (let y = 0; y < R; y++) {
      for (let x = 0; x < R; x++) {
        if (d[(y * R + x) * 4 + 3] < 24) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  const cache = new Map();

  // 字を置く枠（手本の半紙に見立てる）。周囲に余白を残す。
  const INNER = 0.84;

  /**
   * 手本の字形を、半紙に見立てた枠の中央に描いて返す。
   * 背景は透明、墨は黒。縦横の比はフォントのまま崩さない。
   *
   * box は墨の付いた範囲。書き順アニメーションは、教材データの道筋を
   * この範囲に合わせてから字形を切り出す。
   *
   * @param {string} char
   * @param {number} size 出力キャンバスの一辺（画素）
   * @returns {{canvas:HTMLCanvasElement, box:{x:number,y:number,w:number,h:number}}|null}
   */
  function glyph(char, size) {
    const key = `${char}|${size}|${loaded}`;
    if (cache.has(key)) return cache.get(key);

    const g = renderGlyph(char, Math.max(320, size * 2));
    if (!g) return null;

    const inner = size * INNER;
    const scale = Math.min(inner / g.box.w, inner / g.box.h);
    const dw = g.box.w * scale;
    const dh = g.box.h * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    const out = document.createElement("canvas");
    out.width = size;
    out.height = size;
    out.getContext("2d").drawImage(
      g.canvas,
      g.box.x, g.box.y, g.box.w, g.box.h,
      dx, dy, dw, dh
    );

    const result = { canvas: out, box: { x: dx, y: dy, w: dw, h: dh } };
    cache.set(key, result);
    return result;
  }

  return { load, isLoaded, fontStack, glyph, VIEW };
})();
