/*
 * 採点エンジン（毛筆作品の写真を採点する）
 * 実装: フロントエンドエンジニア 匠(Takumi)
 *
 * 3つの観点で採点し、重み付けして 100 点満点にまとめる。
 *   1. とめ・はね・はらい (40%) … 筆画の終わり方。先生が最も教えたい部分。
 *   2. 字形・骨格        (40%) … 手本との形の一致度。
 *   3. 配置・余白        (20%) … 半紙の中での大きさ・位置・傾き。
 *
 * 採点は ImageProc.NORM_SIZE の正規化ビットマップ上で行う。
 */

window.Scorer = (function () {
  const W_ENDING = 0.40;
  const W_SHAPE  = 0.40;
  const W_LAYOUT = 0.20;

  const KIND_LABEL = {
    tome:  "とめ",
    hane:  "はね",
    harai: "はらい"
  };

  const KIND_ADVICE = {
    tome:  "筆を紙につけたまま、最後にぐっと止めましょう。",
    hane:  "最後に筆先を上へ跳ね上げましょう。",
    harai: "だんだん力をぬきながら、筆を払って細くしていきましょう。"
  };

  /* ============================================================
   * 本体
   * ========================================================== */

  /**
   * 1文字を採点する
   *
   * @param {Uint8Array} studentNorm 生徒の正規化ビットマップ
   * @param {number} size 一辺
   * @param {Object} reference Reference.getReference() の戻り値
   * @param {Object} charData data/gradeNN.js の文字データ
   * @param {Object} layout  配置評価用の情報
   *        { photoW, photoH, box, charCount, index, boxes }
   * @returns {Object} 採点結果
   */
  function scoreCharacter(studentNorm, size, reference, charData, layout) {
    const ink = ImageProc.inkCount(studentNorm);

    // 墨がほとんど無い＝未提出とみなす
    if (ink < size * 2) {
      return {
        total: 0,
        blank: true,
        ending: { score: 0, acc: 0, items: [] },
        shape:  { score: 0, acc: 0, iou: 0, tilt: 0 },
        layout: { score: 0, acc: 0, notes: [] },
        comments: ["字が写っていないようです。半紙が画面いっぱいに入るように撮り直してみましょう。"],
        referenceSource: reference.source
      };
    }

    const ending = scoreEndings(studentNorm, size, reference, charData);
    const shape  = scoreShape(studentNorm, size, reference);
    const lay    = scoreLayout(studentNorm, size, layout);

    let total = ending.score * W_ENDING + shape.score * W_SHAPE + lay.score * W_LAYOUT;

    // 満点はすべての観点がほぼ完璧なときだけ
    const allPerfect = ending.acc >= 0.97 && shape.acc >= 0.97 && lay.acc >= 0.97;
    total = allPerfect ? 100 : Math.min(99, Math.round(total));

    return {
      total,
      blank: false,
      ending,
      shape,
      layout: lay,
      comments: buildComments(total, ending, shape, lay),
      referenceSource: reference.source
    };
  }

  /* ============================================================
   * 1. とめ・はね・はらい
   * ========================================================== */

  /**
   * 筆画の終わり方を手本と比べる。
   *
   * 「とめ・はね・はらい」を絶対的なしきい値で判定することはしない。
   * 楷書の右払いは筆先が画の胴より太く広がり、左払いは終わりで向きが変わる。
   * つまり同じ種別でも形の特徴はまるで違うので、ひとつの数値の大小では分けられない。
   *
   * そこで、手本の同じ位置の筆画の終わり方と「どれだけ似ているか」で見る。
   * 手本に合わせて書けていれば似た形になり、抜けていたり止まっていたりすれば離れる。
   * 子どもに見せる呼び名（とめ/はね/はらい）は教材データの ending をそのまま使う。
   */
  function scoreEndings(studentNorm, size, reference, charData) {
    const stuEndings = ImageProc.analyzeStrokeEndings(studentNorm, size, size);

    // 評価の基準。教材データに画の終わり（とめ・はね・はらい）が定義されていれば
    // それを使う。無ければ手本の写真から取れた端点で代用する。
    const targets = expectedEndings(charData, size, reference);
    const refEndings = sortReadingOrder(reference.endings || [], size);
    const basis = targets.length ? targets : refEndings;

    if (basis.length === 0) {
      // 手本から筆画の終わりが取れなかった場合は評価対象外（満点扱い）
      return { score: 100, acc: 1, items: [], skipped: true };
    }

    // 教材データの筆跡は手描きなので、手本の墨の位置とは少しずれる。
    // 手本側を探すときはそのぶん広く取り、生徒の作品を探すときは
    // 手本の端点の位置から狭く取る（こちらは本当にずれていれば減点したい）。
    const refDist = size * 0.34;
    const stuDist = size * 0.22;

    // 手本側の対応する端点。これが「この画はこう終わる」という基準になる。
    const models = assignNearest(basis, refEndings, refDist);

    // 生徒側は、手本の端点の位置から探す（手本が見つからない画は道筋の終点から）
    const anchors = basis.map((t, i) => (models[i] ? models[i].ending : t));
    const stus = assignNearest(anchors, stuEndings, stuDist);

    const items = [];

    basis.forEach((target, i) => {
      const expectKind = target.kind;
      const name = target.name || positionName(target.x, target.y, size);
      const model = models[i];
      const stu = stus[i];

      if (!stu) {
        items.push({
          name,
          expect: expectKind,
          ok: false,
          credit: 0,
          advice: `${name}が見つかりませんでした。${KIND_LABEL[expectKind] || ""}をはっきり書いてみましょう。`
        });
        return;
      }

      const sim = model
        ? endingSimilarity(stu.ending, model.ending)
        : (stu.ending.kind === expectKind ? 1 : 0.35);

      const ok = sim >= 0.62;

      items.push({
        name,
        expect: expectKind,
        ok,
        credit: sim,
        similarity: sim,
        advice: ok
          ? `${name}の${KIND_LABEL[expectKind]}がよく書けています。`
          : `${name}の「${KIND_LABEL[expectKind]}」が手本と違います。` +
            (model ? endingDiffNote(stu.ending, model.ending, expectKind)
                   : (KIND_ADVICE[expectKind] || ""))
      });
    });

    // 手本より多く端点がある＝余分な線やはみ出しがある。
    // 筆画の始まりも端点として出るため、手本の端点数を基準にする。
    const allowed = refEndings.length || basis.length * 2;
    const extra = Math.max(0, stuEndings.length - allowed);

    let acc = items.length
      ? items.reduce((s, it) => s + it.credit, 0) / items.length
      : 0;

    // 余分な筆画はわずかに減点（最大 0.12）
    acc = Math.max(0, acc - Math.min(0.12, extra * 0.04));

    return {
      score: toScore(acc),
      acc,
      items,
      extra
    };
  }

  /**
   * 探す位置の列に、端点を1対1で割り当てる。
   *
   * 近い組から順に確定させる。1つの端点を複数の画で使い回すと、
   * 位置のずれた画が隣の画の端点を取ってしまい、取られた側が
   * 見当違いの端点と比べられてしまう。
   *
   * @private
   * @param {Array<{x:number,y:number}>} spots 探す位置（画ごと）
   * @param {Array} list 端点の一覧
   * @param {number} maxDist これより離れていれば対応なしとする
   * @returns {Array<{ending:Object,index:number,dist:number}|null>} spots と同じ長さ
   */
  function assignNearest(spots, list, maxDist) {
    const pairs = [];

    spots.forEach((at, i) => {
      list.forEach((e, j) => {
        const d = Math.hypot(e.x - at.x, e.y - at.y);
        if (d <= maxDist) pairs.push({ i, j, d });
      });
    });

    pairs.sort((a, b) => a.d - b.d);

    const result = spots.map(() => null);
    const taken = new Set();

    pairs.forEach(p => {
      if (result[p.i] || taken.has(p.j)) return;
      result[p.i] = { ending: list[p.j], index: p.j, dist: p.d };
      taken.add(p.j);
    });

    return result;
  }

  // 形の特徴ごとの「これくらい違えば別の終わり方」という幅
  const TIP_TOL = 0.50;   // 筆先の太さ（画の胴に対する比）
  const TURN_TOL = 0.20;  // 終わりで向きが変わる量
  const SHARP_TOL = 0.40; // 筆先のとがり

  /**
   * 生徒の筆の終わり方が、手本の同じ位置の終わり方とどれだけ似ているか（0〜1）
   * @private
   */
  function endingSimilarity(stu, model) {
    const tip   = Math.abs((stu.tipRatio || 0)   - (model.tipRatio || 0))   / TIP_TOL;
    const turn  = Math.abs((stu.turn || 0)       - (model.turn || 0))       / TURN_TOL;
    const sharp = Math.abs((stu.sharpRatio || 0) - (model.sharpRatio || 0)) / SHARP_TOL;

    // 筆先の太さがいちばん効く（止めたか抜いたかがここに出る）
    const diff = tip * 0.5 + turn * 0.25 + sharp * 0.25;

    return Math.max(0, 1 - diff);
  }

  /**
   * 手本との違いを、直し方のことばにする
   * @private
   */
  function endingDiffNote(stu, model, expectKind) {
    const dTip = (stu.tipRatio || 0) - (model.tipRatio || 0);
    const dTurn = (stu.turn || 0) - (model.turn || 0);

    if (dTip < -TIP_TOL * 0.5) {
      return expectKind === "tome"
        ? "最後で筆を止めずに抜けています。穂先をそろえて、ぐっと止めましょう。"
        : "筆先が細くなりすぎています。最後まで筆を紙につけたまま運びましょう。";
    }

    if (dTip > TIP_TOL * 0.5) {
      return expectKind === "harai"
        ? "最後が止まっています。筆をだんだん上げながら、すっと抜きましょう。"
        : "終わりが太くふくらんでいます。筆を押しつけすぎないようにしましょう。";
    }

    if (dTurn < -TURN_TOL * 0.5 && expectKind === "hane") {
      return "はねの向きの変わりが足りません。いちど止めてから、上へはね上げましょう。";
    }

    return KIND_ADVICE[expectKind] || "手本の筆の終わり方をもう一度見てみましょう。";
  }

  /**
   * 教材データの各画の「書き終わり」を、正規化ビットマップ上の座標に直して返す。
   *
   * 画の筆跡は start→end の向きで定義してあるので、path の最後の点が
   * とめ・はね・はらいの出る位置になる。
   *
   * 座標は手本の墨が占める範囲に合わせる。教材データの筆跡は手描きなので、
   * 外接矩形の縦横比が手本の字形と一致しない。余白8%で中央に収めるだけだと
   * 「つ」のような字で位置が大きくずれ、対応する画を見つけられなくなる。
   *
   * @private
   * @returns {Array<{x:number,y:number,kind:string,name:string}>}
   */
  function expectedEndings(charData, size, reference) {
    if (!charData || !Array.isArray(charData.strokes)) return [];

    const withPath = charData.strokes.filter(
      s => Array.isArray(s.path) && s.path.length >= 2
    );
    if (withPath.length === 0) return [];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    withPath.forEach(s => s.path.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }));

    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);

    // 手本の墨の範囲。取れなければ余白8%の枠で代用する。
    const inner = size * 0.84;
    const bb = ImageProc.boundingBox(reference.norm, size, size);
    const box = bb
      ? { x: bb.minX, y: bb.minY, w: Math.max(1, bb.maxX - bb.minX), h: Math.max(1, bb.maxY - bb.minY) }
      : { x: (size - inner) / 2, y: (size - inner) / 2, w: inner, h: inner };

    const sx = box.w / bw;
    const sy = box.h / bh;

    return withPath
      .filter(s => s.ending && s.ending !== "none")
      // 他の画の上で終わる画（「工」の中のたて画など）は、写真では交点に
      // なってしまい筆の終わり方が見えない。採点対象から外す。
      .filter(s => !endsOnAnotherStroke(s, withPath))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(s => {
        const last = s.path[s.path.length - 1];
        return {
          x: box.x + (last.x - minX) * sx,
          y: box.y + (last.y - minY) * sy,
          kind: s.ending,
          name: s.name || `第${s.order}画`
        };
      });
  }

  /**
   * 画の終わりの点が、他の画の線上にあるかどうか
   * @private
   */
  function endsOnAnotherStroke(stroke, all) {
    const last = stroke.path[stroke.path.length - 1];
    const near = 14; // 教材データの座標系(0〜400)での許容距離

    return all.some(other => {
      if (other === stroke) return false;

      for (let i = 1; i < other.path.length; i++) {
        if (pointToSegment(last, other.path[i - 1], other.path[i]) <= near) return true;
      }
      return false;
    });
  }

  /**
   * 点と線分の距離
   * @private
   */
  function pointToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;

    let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
  }

  /**
   * 端点を読む順（上から下、同じ高さなら左から右）に並べる
   * @private
   */
  function sortReadingOrder(endings, size) {
    const band = size * 0.18; // この範囲内の高さは「同じ高さ」とみなす

    return endings.slice().sort((a, b) => {
      const ra = Math.floor(a.y / band);
      const rb = Math.floor(b.y / band);
      if (ra !== rb) return ra - rb;
      return a.x - b.x;
    });
  }

  /**
   * 位置から呼び名を作る（教材データに名前が無いとき用）
   * @private
   */
  function positionName(x, y, size) {
    const v = y < size * 0.34 ? "上" : (y > size * 0.66 ? "下" : "中ほど");
    const hz = x < size * 0.34 ? "左" : (x > size * 0.66 ? "右" : "");
    return `${v}${hz}のあたりの画`;
  }

  /* ============================================================
   * 2. 字形・骨格
   * ========================================================== */

  /**
   * 手本との形の一致度を見る。
   * 撮影のわずかなずれは許容し、重なり率が最大になる位置で評価する。
   */
  function scoreShape(studentNorm, size, reference) {
    const iou = ImageProc.bestIou(studentNorm, reference.norm, size);

    // 満点ラインは文字ごとに違う（画の少ない字は重なり率が上がりにくい）。
    // 手本側で計算した上限があればそれを使い、無ければ手本の種類で決める。
    const range = shapeRange(reference);

    let acc = (iou - range.lo) / (range.hi - range.lo);
    acc = Math.max(0, Math.min(1, acc));

    // 傾きの差
    const mStu = ImageProc.moments(studentNorm, size, size);
    const mRef = ImageProc.moments(reference.norm, size, size);
    const tilt = Math.abs(normalizeAngle(mStu.angle - mRef.angle));

    // 8度を超えたぶんを減点（最大 0.15）
    const tiltPenalty = Math.min(0.15, Math.max(0, (tilt - 8) / 100));
    acc = Math.max(0, acc - tiltPenalty);

    // 墨の量の差（太すぎ・細すぎ）
    const inkStu = mStu.ink;
    const inkRef = Math.max(1, mRef.ink);
    const inkRatio = inkStu / inkRef;

    let inkNote = null;
    if (inkRatio > 1.55) inkNote = "線が太すぎるようです。筆の墨を少し落としてみましょう。";
    else if (inkRatio < 0.55) inkNote = "線が細すぎるようです。筆にしっかり墨をつけて、太く書いてみましょう。";

    return {
      score: toScore(acc),
      acc,
      iou: round3(iou),
      tilt: Math.round(tilt),
      inkRatio: round3(inkRatio),
      inkNote
    };
  }

  /**
   * 重なり率を精度(0..1)に直すときの下限・上限
   * @private
   */
  function shapeRange(reference) {
    const c = reference.ceiling;

    if (typeof c === "number" && isFinite(c) && c > 0) {
      // 極端な値は丸める（教材データの不備で上限が壊れても採点が崩れないように）
      const hi = Math.max(0.18, Math.min(0.80, c));
      return { lo: hi * 0.35, hi };
    }

    return reference.source === "teacher"
      ? { lo: 0.30, hi: 0.76 }
      : { lo: 0.22, hi: 0.62 };
  }

  function normalizeAngle(a) {
    while (a > 90) a -= 180;
    while (a < -90) a += 180;
    return a;
  }

  /* ============================================================
   * 3. 配置・余白
   * ========================================================== */

  /**
   * 半紙の中での大きさ・位置・傾きを見る。
   * 「半紙が画面いっぱいに写っている」ことを前提に、写真の枠を半紙の枠として扱う。
   */
  function scoreLayout(studentNorm, size, layout) {
    const notes = [];

    if (!layout || !layout.box || !layout.photoW) {
      return { score: 100, acc: 1, notes: [], skipped: true };
    }

    const { photoW, photoH, box } = layout;
    const shortSide = Math.min(photoW, photoH);

    const bw = box.maxX - box.minX + 1;
    const bh = box.maxY - box.minY + 1;

    // --- 大きさ ---
    // 1文字なら半紙の短辺の 55〜85% が目安。複数文字なら1文字分に割って考える。
    const count = Math.max(1, layout.charCount || 1);
    const expected = count > 1 ? 0.9 / count : 0.70;
    const sizeRatio = Math.max(bw, bh) / shortSide;

    let sizeAcc = 1 - Math.abs(sizeRatio - expected) / (expected * 0.75);
    sizeAcc = Math.max(0, Math.min(1, sizeAcc));

    if (sizeRatio < expected * 0.65) notes.push("字が小さいようです。半紙いっぱいに大きく書いてみましょう。");
    else if (sizeRatio > expected * 1.35) notes.push("字が大きすぎて余白が少ないようです。少し小さめに書いてみましょう。");

    // --- 位置（中心のずれ） ---
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;

    // 複数文字のときは自分の持ち場の中心と比べる
    const target = cellCenter(layout, photoW, photoH);

    const offX = (cx - target.x) / photoW;
    const offY = (cy - target.y) / photoH;
    const off = Math.hypot(offX, offY);

    let posAcc = 1 - off / 0.18;
    posAcc = Math.max(0, Math.min(1, posAcc));

    if (off > 0.09) {
      const dir = [];
      if (offX < -0.05) dir.push("左");
      if (offX > 0.05) dir.push("右");
      if (offY < -0.05) dir.push("上");
      if (offY > 0.05) dir.push("下");
      if (dir.length) notes.push(`字が${dir.join("")}によっています。中央に書いてみましょう。`);
    }

    // --- 傾き ---
    const m = ImageProc.moments(studentNorm, size, size);
    const tilt = Math.abs(normalizeAngle(m.angle));
    let tiltAcc = 1 - Math.max(0, tilt - 6) / 24;
    tiltAcc = Math.max(0, Math.min(1, tiltAcc));

    if (tilt > 10) notes.push("字が傾いています。半紙をまっすぐ置いて書いてみましょう。");

    const acc = sizeAcc * 0.45 + posAcc * 0.35 + tiltAcc * 0.20;

    return {
      score: toScore(acc),
      acc,
      sizeRatio: round3(sizeRatio),
      offset: round3(off),
      tilt: Math.round(tilt),
      notes
    };
  }

  /**
   * 複数文字のとき、その文字が収まるべき区画の中心を返す
   * @private
   */
  function cellCenter(layout, photoW, photoH) {
    const count = Math.max(1, layout.charCount || 1);
    const index = layout.index || 0;

    if (count === 1) {
      return { x: photoW / 2, y: photoH / 2 };
    }

    // 縦書きか横書きかは、文字の並び方から判断する
    const boxes = layout.boxes || [];
    const vertical = isVertical(boxes);

    if (vertical) {
      const cell = photoH / count;
      return { x: photoW / 2, y: cell * (index + 0.5) };
    }

    const cell = photoW / count;
    return { x: cell * (index + 0.5), y: photoH / 2 };
  }

  /**
   * 文字の並びが縦方向かどうか
   * @private
   */
  function isVertical(boxes) {
    if (boxes.length < 2) return true;

    let spreadX = 0;
    let spreadY = 0;

    for (let i = 1; i < boxes.length; i++) {
      spreadX += Math.abs(
        (boxes[i].minX + boxes[i].maxX) / 2 - (boxes[i - 1].minX + boxes[i - 1].maxX) / 2
      );
      spreadY += Math.abs(
        (boxes[i].minY + boxes[i].maxY) / 2 - (boxes[i - 1].minY + boxes[i - 1].maxY) / 2
      );
    }

    return spreadY >= spreadX;
  }

  /* ============================================================
   * 講評の組み立て
   * ========================================================== */

  /**
   * 生徒に見せる言葉を作る。
   * ほめる点を先に、直す点はひとつに絞って具体的に伝える。
   */
  function buildComments(total, ending, shape, layout) {
    const out = [];

    // 総評
    if (total >= 95) out.push("たいへんよく書けています。手本に近い、いきいきとした字です。");
    else if (total >= 85) out.push("よく書けています。筆の運びがしっかりしています。");
    else if (total >= 70) out.push("なかなかよい字です。あと少しで手本に近づきます。");
    else if (total >= 55) out.push("よくがんばりました。直すところを1つ意識して、もう一枚書いてみましょう。");
    else out.push("まずは手本をよく見て、ゆっくり書いてみましょう。");

    // ほめる点
    const okItems = (ending.items || []).filter(it => it.ok);
    if (okItems.length > 0) {
      out.push(okItems[0].advice);
    }

    // 直す点（とめはねを最優先）
    const ngItems = (ending.items || []).filter(it => !it.ok);
    if (ngItems.length > 0) {
      out.push(ngItems[0].advice);
      if (ngItems.length > 1) {
        out.push(`ほかに ${ngItems.length - 1} か所、筆の終わり方を直すところがあります。`);
      }
    }

    // 線の太さ
    if (shape.inkNote) out.push(shape.inkNote);

    // 配置
    if (layout.notes && layout.notes.length) out.push(layout.notes[0]);

    return out;
  }

  /* ============================================================
   * 補助
   * ========================================================== */

  /**
   * 精度(0..1) を点数に変換する。
   * 小学生向けに、努力が点に表れやすい甘めの曲線にする。
   *   acc 0.0 → 45点 / 0.5 → 76点 / 0.8 → 90点 / 1.0 → 100点
   */
  function toScore(acc) {
    const a = Math.max(0, Math.min(1, acc));
    return 45 + 55 * Math.pow(a, 0.8);
  }

  function round3(v) {
    return Math.round(v * 1000) / 1000;
  }

  /**
   * 作品全体（複数文字）の採点をまとめる
   *
   * @param {Array} results scoreCharacter の結果の配列
   * @returns {{total:number, balance:number, comment:string}}
   */
  function scoreWork(results) {
    const valid = results.filter(r => !r.blank);

    if (valid.length === 0) {
      return { total: 0, balance: 0, comment: "字が読み取れませんでした。" };
    }

    const avg = valid.reduce((s, r) => s + r.total, 0) / valid.length;

    // 文字どうしの出来のばらつき（複数文字のときだけ見る）
    let balance = 100;
    let comment = "";

    if (valid.length > 1) {
      const scores = valid.map(r => r.total);
      const max = Math.max(...scores);
      const min = Math.min(...scores);
      const spread = max - min;

      balance = Math.max(0, 100 - spread * 1.5);

      if (spread > 20) {
        comment = "字によって出来にちがいがあります。どの字も同じ気持ちで書けるとさらによくなります。";
      } else {
        comment = "どの字もそろって書けています。";
      }
    }

    // 全体点は平均を主とし、ばらつきをわずかに反映する
    const total = valid.length > 1
      ? Math.round(avg * 0.88 + balance * 0.12)
      : Math.round(avg);

    return { total: Math.min(100, total), balance: Math.round(balance), comment };
  }

  return {
    scoreCharacter,
    scoreWork,
    KIND_LABEL,
    KIND_ADVICE
  };
})();
