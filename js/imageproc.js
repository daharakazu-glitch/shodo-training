/*
 * 画像処理エンジン
 * 実装: フロントエンドエンジニア 匠(Takumi)
 *
 * 撮影した毛筆作品の写真を解析するための基礎処理をまとめる。
 *   写真 → グレースケール → 大津の二値化 → 墨領域の抽出
 *        → 文字ごとの切り出し → 正規化 → 細線化(骨格)
 *        → 端点検出 → 線幅プロファイル → とめ/はね/はらい の推定
 *
 * データ表現の約束:
 *   bin : Uint8Array(w*h)。index = y*w + x。1 = 墨(黒)、0 = 紙(白)
 *   norm: 正規化後の正方形ビットマップ。一辺 NORM_SIZE。
 */

window.ImageProc = (function () {
  const NORM_SIZE = 128; // 正規化後の一辺（採点はこの解像度で行う）

  /* ============================================================
   * 1. グレースケール化
   * ========================================================== */

  /**
   * ImageData → グレースケール(0..255)
   * @param {ImageData} imageData
   * @returns {Uint8Array}
   */
  function toGray(imageData) {
    const { data, width, height } = imageData;
    const gray = new Uint8Array(width * height);

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      // ITU-R BT.601 の輝度係数
      gray[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    }

    return gray;
  }

  /* ============================================================
   * 2. 二値化（大津の方法で閾値を自動決定）
   * ========================================================== */

  /**
   * 大津の二値化の閾値を求める
   * @param {Uint8Array} gray
   * @returns {number} 0..255 の閾値
   */
  function otsuThreshold(gray) {
    const hist = new Float64Array(256);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

    const total = gray.length;
    let sumAll = 0;
    for (let t = 0; t < 256; t++) sumAll += t * hist[t];

    let wB = 0;        // 背景クラスの重み
    let sumB = 0;      // 背景クラスの輝度和
    let best = 0;
    let bestVar = -1;

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;

      const wF = total - wB;
      if (wF === 0) break;

      sumB += t * hist[t];

      const meanB = sumB / wB;
      const meanF = (sumAll - sumB) / wF;
      const between = wB * wF * (meanB - meanF) * (meanB - meanF);

      if (between > bestVar) {
        bestVar = between;
        best = t;
      }
    }

    return best;
  }

  /**
   * 二値化する。紙が明るく墨が暗い前提で、暗い側を 1(墨) とする。
   * @param {Uint8Array} gray
   * @param {number} threshold 省略時は大津の閾値
   * @returns {Uint8Array} 1 = 墨
   */
  function binarize(gray, threshold) {
    const th = (threshold === undefined) ? otsuThreshold(gray) : threshold;
    const bin = new Uint8Array(gray.length);

    for (let i = 0; i < gray.length; i++) {
      bin[i] = gray[i] < th ? 1 : 0;
    }

    return bin;
  }

  /**
   * 孤立したノイズ点を除去する（3x3 の多数決による収縮・膨張）
   * 影や紙の繊維が墨として拾われるのを抑える。
   */
  function denoise(bin, w, h) {
    const out = new Uint8Array(bin.length);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            n += bin[(y + dy) * w + (x + dx)];
          }
        }
        // 自分を含む9画素のうち4つ以上が墨なら墨として残す
        out[y * w + x] = n >= 4 ? 1 : 0;
      }
    }

    return out;
  }

  /* ============================================================
   * 3. 墨領域の検出
   * ========================================================== */

  /**
   * 墨画素全体を囲う矩形を求める
   * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null}
   */
  function boundingBox(bin, w, h) {
    let minX = w, minY = h, maxX = -1, maxY = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bin[y * w + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0) return null; // 墨が1画素も無い
    return { minX, minY, maxX, maxY };
  }

  /**
   * 墨画素の数
   */
  function inkCount(bin) {
    let n = 0;
    for (let i = 0; i < bin.length; i++) n += bin[i];
    return n;
  }

  /* ============================================================
   * 4. 複数文字の切り出し（投影プロファイル法）
   * ========================================================== */

  /**
   * 半紙に複数文字が書かれている写真から、文字ごとの矩形を求める。
   * 縦書き・横書きの両方に対応する（墨の広がり方で軸を自動判定）。
   *
   * @param {Uint8Array} bin
   * @param {number} w
   * @param {number} h
   * @param {number} expected 期待する文字数（0 なら自動）
   * @returns {Array<{minX,minY,maxX,maxY}>} 読む順（縦書きは上から、横書きは左から）
   */
  function splitCharacters(bin, w, h, expected) {
    const bb = boundingBox(bin, w, h);
    if (!bb) return [];

    // 1文字と分かっている場合は分割しない。
    // 「二」「川」のように画が離れた字を割ってしまうのを防ぐ。
    if (expected === 1) return [bb];

    const bw = bb.maxX - bb.minX + 1;
    const bh = bb.maxY - bb.minY + 1;

    // 縦に長ければ縦書き（行方向 = y）、横に長ければ横書き（行方向 = x）
    const vertical = bh >= bw;

    const segments = vertical
      ? projectionSegments(bin, w, h, bb, "y")
      : projectionSegments(bin, w, h, bb, "x");

    // 分割できなかった、または期待数と大きく違う場合は全体を1文字として返す
    if (segments.length <= 1) {
      return [bb];
    }

    // 期待文字数が指定されていて、分割が多すぎる場合は小さい塊を隣に統合する
    let result = segments;
    if (expected > 0 && result.length > expected) {
      result = mergeSmallest(result, expected, vertical);
    }

    return result.map(seg => tightenBox(bin, w, h, seg));
  }

  /**
   * 指定軸の投影プロファイルから、墨が途切れる位置で区間を切る
   * @private
   */
  function projectionSegments(bin, w, h, bb, axis) {
    const isY = axis === "y";
    const start = isY ? bb.minY : bb.minX;
    const end = isY ? bb.maxY : bb.maxX;
    const len = end - start + 1;

    // 軸に沿った墨の量
    const profile = new Int32Array(len);
    for (let y = bb.minY; y <= bb.maxY; y++) {
      for (let x = bb.minX; x <= bb.maxX; x++) {
        if (bin[y * w + x]) {
          profile[(isY ? y : x) - start]++;
        }
      }
    }

    // 文字間の空白とみなす最小幅
    const crossLen = isY ? (bb.maxX - bb.minX + 1) : (bb.maxY - bb.minY + 1);
    const gapMin = Math.max(4, Math.round(Math.min(crossLen, len) * 0.1));

    const segments = [];
    let runStart = -1;
    let gap = 0;

    for (let i = 0; i < len; i++) {
      if (profile[i] > 0) {
        if (runStart < 0) runStart = i;
        gap = 0;
      } else if (runStart >= 0) {
        gap++;
        if (gap >= gapMin) {
          segments.push([runStart, i - gap]);
          runStart = -1;
          gap = 0;
        }
      }
    }
    if (runStart >= 0) segments.push([runStart, len - 1]);

    // 墨のごく少ない区間（紙の汚れ・影）は捨てる。
    // 「一」のように行方向に薄い字もあるので、幅ではなく墨の量で判断する。
    let totalInk = 0;
    for (let i = 0; i < len; i++) totalInk += profile[i];
    const minInk = Math.max(12, totalInk * 0.03);

    const inkOf = ([a, b]) => {
      let s = 0;
      for (let i = a; i <= b; i++) s += profile[i];
      return s;
    };

    return segments
      .filter(seg => inkOf(seg) >= minInk)
      .map(([a, b]) => isY
        ? { minX: bb.minX, maxX: bb.maxX, minY: start + a, maxY: start + b }
        : { minY: bb.minY, maxY: bb.maxY, minX: start + a, maxX: start + b }
      );
  }

  /**
   * 区間数が期待より多いとき、小さい区間を隣へ統合して数を合わせる
   * @private
   */
  function mergeSmallest(segments, expected, vertical) {
    const segs = segments.slice();

    while (segs.length > expected) {
      // 最も薄い（行方向に短い）区間を探す
      let idx = 0;
      let minSize = Infinity;

      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const size = vertical ? (s.maxY - s.minY) : (s.maxX - s.minX);
        if (size < minSize) {
          minSize = size;
          idx = i;
        }
      }

      // 前後のうち近い方に統合する
      const prev = segs[idx - 1];
      const next = segs[idx + 1];
      let target;

      if (!prev) target = idx + 1;
      else if (!next) target = idx - 1;
      else {
        const s = segs[idx];
        const dPrev = vertical ? (s.minY - prev.maxY) : (s.minX - prev.maxX);
        const dNext = vertical ? (next.minY - s.maxY) : (next.minX - s.maxX);
        target = dPrev <= dNext ? idx - 1 : idx + 1;
      }

      const a = segs[idx];
      const b = segs[target];
      segs[Math.min(idx, target)] = {
        minX: Math.min(a.minX, b.minX),
        minY: Math.min(a.minY, b.minY),
        maxX: Math.max(a.maxX, b.maxX),
        maxY: Math.max(a.maxY, b.maxY)
      };
      segs.splice(Math.max(idx, target), 1);
    }

    return segs;
  }

  /**
   * 区間内の墨だけを囲うように矩形を詰める
   * @private
   */
  function tightenBox(bin, w, h, box) {
    let minX = box.maxX, minY = box.maxY, maxX = box.minX, maxY = box.minY;
    let found = false;

    for (let y = box.minY; y <= box.maxY; y++) {
      for (let x = box.minX; x <= box.maxX; x++) {
        if (bin[y * w + x]) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    return found ? { minX, minY, maxX, maxY } : box;
  }

  /* ============================================================
   * 5. 正規化
   * ========================================================== */

  /**
   * 指定矩形を切り出し、縦横比を保ったまま NORM_SIZE の正方形中央に収める。
   * 採点は手本・生徒ともこの形式に揃えてから行う。
   *
   * @returns {{data:Uint8Array,size:number}}
   */
  function normalize(bin, w, h, box, size) {
    const S = size || NORM_SIZE;
    const out = new Uint8Array(S * S);

    const bw = box.maxX - box.minX + 1;
    const bh = box.maxY - box.minY + 1;

    // 余白 8% を残して内接させる
    const inner = S * 0.84;
    const scale = Math.min(inner / bw, inner / bh);

    const dw = Math.max(1, Math.round(bw * scale));
    const dh = Math.max(1, Math.round(bh * scale));
    const offX = Math.round((S - dw) / 2);
    const offY = Math.round((S - dh) / 2);

    // 面積平均でダウンサンプル（細い線が消えないよう、1画素でも墨があれば墨とする）
    for (let dy = 0; dy < dh; dy++) {
      const sy0 = box.minY + Math.floor(dy * bh / dh);
      const sy1 = box.minY + Math.max(Math.floor((dy + 1) * bh / dh), Math.floor(dy * bh / dh) + 1);

      for (let dx = 0; dx < dw; dx++) {
        const sx0 = box.minX + Math.floor(dx * bw / dw);
        const sx1 = box.minX + Math.max(Math.floor((dx + 1) * bw / dw), Math.floor(dx * bw / dw) + 1);

        let ink = 0;
        let total = 0;

        for (let sy = sy0; sy < sy1 && sy <= box.maxY; sy++) {
          for (let sx = sx0; sx < sx1 && sx <= box.maxX; sx++) {
            total++;
            ink += bin[sy * w + sx];
          }
        }

        // 縮小時は 30% 以上墨があれば墨、拡大時は中心の値をそのまま使う
        if (total > 0 && ink / total >= 0.3) {
          out[(offY + dy) * S + (offX + dx)] = 1;
        }
      }
    }

    return { data: out, size: S };
  }

  /* ============================================================
   * 6. 距離変換（線幅の推定に使う）
   * ========================================================== */

  /**
   * チャンファー距離変換。各墨画素について最も近い紙までの距離を返す。
   * 距離 × 2 がおおよその線幅になる。
   *
   * @returns {Float32Array}
   */
  function distanceTransform(bin, w, h) {
    const INF = 1e9;
    const dist = new Float32Array(w * h);

    for (let i = 0; i < bin.length; i++) {
      dist[i] = bin[i] ? INF : 0;
    }

    const D1 = 1.0;    // 4近傍
    const D2 = 1.4142; // 斜め

    // 前方走査
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (dist[i] === 0) continue;

        let d = dist[i];
        if (y > 0) {
          if (x > 0)     d = Math.min(d, dist[i - w - 1] + D2);
                         d = Math.min(d, dist[i - w] + D1);
          if (x < w - 1) d = Math.min(d, dist[i - w + 1] + D2);
        }
        if (x > 0)       d = Math.min(d, dist[i - 1] + D1);

        dist[i] = d;
      }
    }

    // 後方走査
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x;
        if (dist[i] === 0) continue;

        let d = dist[i];
        if (y < h - 1) {
          if (x < w - 1) d = Math.min(d, dist[i + w + 1] + D2);
                         d = Math.min(d, dist[i + w] + D1);
          if (x > 0)     d = Math.min(d, dist[i + w - 1] + D2);
        }
        if (x < w - 1)   d = Math.min(d, dist[i + 1] + D1);

        dist[i] = d;
      }
    }

    return dist;
  }

  /* ============================================================
   * 7. 細線化（Zhang-Suen）
   * ========================================================== */

  /**
   * 筆画を1画素幅の骨格に細める。端点や分岐の検出に使う。
   * @returns {Uint8Array} 1 = 骨格
   */
  function thin(bin, w, h) {
    const img = Uint8Array.from(bin);

    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : img[y * w + x];

    let changed = true;
    let guard = 0;

    while (changed && guard++ < 60) {
      changed = false;

      for (let step = 0; step < 2; step++) {
        const remove = [];

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            if (!img[y * w + x]) continue;

            // 8近傍を時計回りに P2..P9
            const p2 = at(x,     y - 1);
            const p3 = at(x + 1, y - 1);
            const p4 = at(x + 1, y);
            const p5 = at(x + 1, y + 1);
            const p6 = at(x,     y + 1);
            const p7 = at(x - 1, y + 1);
            const p8 = at(x - 1, y);
            const p9 = at(x - 1, y - 1);

            const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            if (b < 2 || b > 6) continue;

            // 0→1 の遷移回数
            const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
            let a = 0;
            for (let k = 0; k < 8; k++) {
              if (seq[k] === 0 && seq[k + 1] === 1) a++;
            }
            if (a !== 1) continue;

            if (step === 0) {
              if (p2 * p4 * p6 !== 0) continue;
              if (p4 * p6 * p8 !== 0) continue;
            } else {
              if (p2 * p4 * p8 !== 0) continue;
              if (p2 * p6 * p8 !== 0) continue;
            }

            remove.push(y * w + x);
          }
        }

        if (remove.length) {
          for (const i of remove) img[i] = 0;
          changed = true;
        }
      }
    }

    return img;
  }

  /* ============================================================
   * 8. 端点検出と線幅プロファイル
   * ========================================================== */

  /**
   * 骨格上の端点（8近傍の骨格が1つだけの画素）を列挙する
   * @returns {Array<{x:number,y:number}>}
   */
  function findEndpoints(skel, w, h) {
    const pts = [];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (!skel[y * w + x]) continue;

        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            n += skel[(y + dy) * w + (x + dx)];
          }
        }

        if (n === 1) pts.push({ x, y });
      }
    }

    return pts;
  }

  /**
   * 端点から骨格を内側へ辿って、通過した点の列を返す
   * @private
   */
  function walkFromEndpoint(skel, w, h, ep, steps) {
    const path = [{ x: ep.x, y: ep.y }];
    const visited = new Set([ep.y * w + ep.x]);

    let cur = ep;

    for (let s = 0; s < steps; s++) {
      let next = null;

      for (let dy = -1; dy <= 1 && !next; dy++) {
        for (let dx = -1; dx <= 1 && !next; dx++) {
          if (dx === 0 && dy === 0) continue;

          const nx = cur.x + dx;
          const ny = cur.y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

          const ni = ny * w + nx;
          if (!skel[ni] || visited.has(ni)) continue;

          next = { x: nx, y: ny };
          visited.add(ni);
        }
      }

      if (!next) break;
      path.push(next);
      cur = next;
    }

    return path;
  }

  /**
   * 端点の性質を調べ、とめ / はね / はらい を推定する。
   *
   * 判定の考え方:
   *   - 末端に向かって太さが保たれている   → とめ（筆を止めて押さえた）
   *   - 末端に向かって細く尖り、方向が転じる → はね（筆を跳ね上げた）
   *   - 末端に向かって長く細くなっていく     → はらい（筆を払った）
   *
   * 太さの基準には、その字全体の筆の太さ（骨格上の半幅の中央値）を使う。
   * 端点のまわりだけを見ると、払いの途中から根元を測ってしまい
   * 「もともと細い線」と区別できなくなるため。
   *
   * @param {Uint8Array} bin   正規化済みの二値画像
   * @param {Float32Array} dist 距離変換
   * @param {Uint8Array} skel  骨格
   * @param {number} bodyW     その字の筆の太さ（半幅）
   * @returns {{x,y,kind:string,tipRatio:number,turn:number,sharpRatio:number,length:number,confidence:number}}
   */
  function analyzeEndpoint(bin, dist, skel, w, h, ep, bodyW) {
    const STEPS = Math.max(10, Math.round(w * 0.22)); // 端点から遡る距離
    const path = walkFromEndpoint(skel, w, h, ep, STEPS);

    // 経路上の半幅（距離変換値）。index 0 が筆の終わり側。
    const widths = path.map(p => dist[p.y * w + p.x]);
    const n = widths.length;

    const body = bodyW > 0.001 ? bodyW : Math.max(1, Math.max.apply(null, widths));

    // 先端の太さ（筆の太さに対する比）。1 に近い=太いまま止めた、小さい=尖っている
    const tipW = avg(widths.slice(0, Math.min(3, n)));
    const tipRatio = tipW / body;

    // 尖っている長さ（筆の太さの 55% を下回り続ける区間の割合）
    let sharpLen = 0;
    for (let i = 0; i < n; i++) {
      if (widths[i] < body * 0.55) sharpLen++;
      else break;
    }
    const sharpRatio = n > 0 ? sharpLen / n : 0;

    // 末端の方向変化。はねは向きが大きく変わる。
    const turn = directionTurn(path);

    // --- 種別の判定 ---
    let kind;
    let confidence;

    if (tipRatio >= 0.78) {
      // 太さを保ったまま終わっている → とめ
      kind = "tome";
      confidence = Math.min(1, 0.6 + (tipRatio - 0.78));
    } else if (turn >= 0.10) {
      // 細くなりながら向きが変わる → はね
      kind = "hane";
      confidence = Math.min(1, 0.45 + turn * 2);
    } else if (sharpRatio >= 0.3) {
      // まっすぐ長く細くなっていく → はらい
      kind = "harai";
      confidence = Math.min(1, 0.4 + sharpRatio);
    } else {
      // 中間。先端が太めならとめ寄り、細ければ払い寄りに倒す
      kind = tipRatio >= 0.68 ? "tome" : "harai";
      confidence = 0.4;
    }

    return {
      x: ep.x,
      y: ep.y,
      kind,
      tipRatio: round3(tipRatio),
      turn: round3(turn),
      sharpRatio: round3(sharpRatio),
      length: n,
      confidence: round3(confidence)
    };
  }

  /**
   * 経路の末端における方向変化量（0..1、1 に近いほど急に曲がる）
   *
   * 端点から遡れる長さは交点の位置によって変わる（はねは短くなりがち）ため、
   * 固定の基線長ではなく、取れた経路を半分に割って先端側と根元側を比べる。
   *
   * @private
   */
  function directionTurn(path) {
    const n = path.length;
    if (n < 6) return 0;

    const m = Math.floor(n / 2);

    const v1 = { x: path[0].x - path[m].x, y: path[0].y - path[m].y };       // 先端側
    const v2 = { x: path[m].x - path[n - 1].x, y: path[m].y - path[n - 1].y }; // 根元側

    const n1 = Math.hypot(v1.x, v1.y);
    const n2 = Math.hypot(v2.x, v2.y);
    if (n1 < 0.001 || n2 < 0.001) return 0;

    const cos = (v1.x * v2.x + v1.y * v2.y) / (n1 * n2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cos))); // 0..π

    return angle / Math.PI;
  }

  /**
   * その字の筆の太さ（骨格上の半幅の中央値）
   * @private
   */
  function bodyWidth(dist, skel) {
    const vals = [];
    for (let i = 0; i < skel.length; i++) {
      if (skel[i]) vals.push(dist[i]);
    }

    if (vals.length === 0) return 1;

    vals.sort((a, b) => a - b);
    return Math.max(1, vals[Math.floor(vals.length / 2)]);
  }

  /**
   * 画像全体の端点を解析して一覧にする
   * @returns {Array} analyzeEndpoint の結果の配列
   */
  function analyzeStrokeEndings(bin, w, h) {
    const dist = distanceTransform(bin, w, h);
    const skel = thin(bin, w, h);
    const eps = findEndpoints(skel, w, h);
    const body = bodyWidth(dist, skel);

    return eps
      .map(ep => analyzeEndpoint(bin, dist, skel, w, h, ep, body))
      // ごく短いひげ（細線化で生じるノイズ）は除外
      .filter(r => r.length >= 5);
  }

  /* ============================================================
   * 9. 形の比較
   * ========================================================== */

  /**
   * 2つの正規化ビットマップの IoU（重なり率）
   */
  function iou(a, b) {
    let inter = 0;
    let union = 0;

    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i];
      if (x && y) inter++;
      if (x || y) union++;
    }

    return union > 0 ? inter / union : 0;
  }

  /**
   * 片方を少しずつずらして最良の IoU を探す。
   * 撮影位置のわずかなずれで不当に減点されるのを防ぐ。
   */
  function bestIou(a, b, size, maxShift) {
    const m = maxShift === undefined ? Math.round(size * 0.05) : maxShift;
    let best = iou(a, b);

    for (let dy = -m; dy <= m; dy += 2) {
      for (let dx = -m; dx <= m; dx += 2) {
        if (dx === 0 && dy === 0) continue;

        let inter = 0, union = 0;

        for (let y = 0; y < size; y++) {
          const sy = y + dy;
          for (let x = 0; x < size; x++) {
            const sx = x + dx;
            const av = a[y * size + x];
            const bv = (sx < 0 || sy < 0 || sx >= size || sy >= size) ? 0 : b[sy * size + sx];
            if (av && bv) inter++;
            if (av || bv) union++;
          }
        }

        const v = union > 0 ? inter / union : 0;
        if (v > best) best = v;
      }
    }

    return best;
  }

  /**
   * 重心・慣性主軸の傾き・墨量を求める
   * @returns {{cx:number,cy:number,angle:number,ink:number}} angle は度（-90..90）
   */
  function moments(bin, w, h) {
    let m00 = 0, m10 = 0, m01 = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bin[y * w + x]) {
          m00++;
          m10 += x;
          m01 += y;
        }
      }
    }

    if (m00 === 0) return { cx: w / 2, cy: h / 2, angle: 0, ink: 0 };

    const cx = m10 / m00;
    const cy = m01 / m00;

    let u20 = 0, u02 = 0, u11 = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bin[y * w + x]) {
          const dx = x - cx;
          const dy = y - cy;
          u20 += dx * dx;
          u02 += dy * dy;
          u11 += dx * dy;
        }
      }
    }

    const angle = 0.5 * Math.atan2(2 * u11, u20 - u02) * 180 / Math.PI;

    return { cx, cy, angle, ink: m00 };
  }

  /* ============================================================
   * 10. 可視化（デバッグ・生徒へのフィードバック用）
   * ========================================================== */

  /**
   * 正規化ビットマップを Canvas に描く
   * @param {CanvasRenderingContext2D} ctx
   * @param {Uint8Array} bin
   * @param {number} size
   * @param {string} color
   */
  function drawBitmap(ctx, bin, size, color, destSize) {
    const S = destSize || size;
    const cell = S / size;

    ctx.fillStyle = color || "#111";

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (bin[y * size + x]) {
          ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
        }
      }
    }
  }

  /* ============================================================
   * 補助
   * ========================================================== */

  function avg(arr) {
    if (!arr.length) return 0;
    let s = 0;
    for (const v of arr) s += v;
    return s / arr.length;
  }

  function round3(v) {
    return Math.round(v * 1000) / 1000;
  }

  /**
   * 写真の ImageData から、文字ごとの正規化ビットマップまでを一括で行う。
   *
   * @param {ImageData} imageData
   * @param {number} expectedChars 期待文字数（0 で自動）
   * @returns {{
   *   width:number, height:number,
   *   bin:Uint8Array, threshold:number,
   *   paper:{minX,minY,maxX,maxY}|null,
   *   chars:Array<{box:Object, norm:Uint8Array, size:number}>
   * }}
   */
  function processPhoto(imageData, expectedChars) {
    const w = imageData.width;
    const h = imageData.height;

    const gray = toGray(imageData);
    const threshold = otsuThreshold(gray);
    let bin = binarize(gray, threshold);
    bin = denoise(bin, w, h);

    const paper = boundingBox(bin, w, h);
    const boxes = splitCharacters(bin, w, h, expectedChars || 0);

    const chars = boxes.map(box => {
      const { data, size } = normalize(bin, w, h, box, NORM_SIZE);
      return { box, norm: data, size };
    });

    return { width: w, height: h, bin, threshold, paper, chars };
  }

  return {
    NORM_SIZE,
    toGray,
    otsuThreshold,
    binarize,
    denoise,
    boundingBox,
    inkCount,
    splitCharacters,
    normalize,
    distanceTransform,
    thin,
    findEndpoints,
    analyzeEndpoint,
    analyzeStrokeEndings,
    iou,
    bestIou,
    moments,
    drawBitmap,
    processPhoto
  };
})();
