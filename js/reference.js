/*
 * 手本（お手本の字）の管理
 * 実装: フロントエンドエンジニア 匠(Takumi)
 *
 * 手本は2系統を扱う。
 *   1. フォント手本  … 毛筆楷書フォント（BrushFont）で字を描き、その字形を基準にする。
 *                      全文字に自動で用意でき、とめ・はね・はらいの形も出る。
 *   2. 先生手本      … 先生が実際に毛筆で書いた作品を撮影して登録したもの。
 *                      登録されていればフォント手本より優先する。
 *
 * 先生手本は localStorage に保存する。
 *   shodo_reference_<文字> = { norm: <base64>, size, endings: [...], thumb: <dataURL>, savedAt }
 */

window.Reference = (function () {
  const KEY_PREFIX = "shodo_reference_";
  const SIZE = ImageProc.NORM_SIZE;

  // 手本の字形は毛筆フォントに任せる（書き順アニメーションと同じもの）
  const FONT_STACK = BrushFont.fontStack();

  /* ============================================================
   * フォント手本の生成
   * ========================================================== */

  /**
   * ブラウザのフォントで1文字を描画し、正規化ビットマップにする
   * @param {string} char
   * @returns {{norm:Uint8Array,size:number,endings:Array}}
   */
  function renderFontReference(char) {
    const R = 512; // 描画解像度（高めに取ってから縮小する）
    const cv = document.createElement("canvas");
    cv.width = R;
    cv.height = R;

    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, R, R);

    ctx.fillStyle = "#000";
    ctx.font = `${Math.round(R * 0.78)}px ${FONT_STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, R / 2, R / 2);

    const imageData = ctx.getImageData(0, 0, R, R);
    const gray = ImageProc.toGray(imageData);
    const bin = ImageProc.binarize(gray, 128);

    const box = ImageProc.boundingBox(bin, R, R);
    if (!box) {
      return { norm: new Uint8Array(SIZE * SIZE), size: SIZE, endings: [] };
    }

    const { data } = ImageProc.normalize(bin, R, R, box, SIZE);
    const endings = ImageProc.analyzeStrokeEndings(data, SIZE, SIZE);

    return { norm: data, size: SIZE, endings };
  }

  /* ============================================================
   * 重なり率の上限（文字ごとの「満点ライン」）
   * ========================================================== */

  /**
   * 教材データの筆跡を毛筆に近い太さの線で描き、正規化ビットマップにする。
   * 「その字をお手本どおりに書いたらこうなる」という理想形。
   *
   * @private
   * @returns {Uint8Array|null}
   */
  function renderPathBitmap(charData) {
    if (!charData || !Array.isArray(charData.strokes)) return null;

    const paths = charData.strokes.filter(
      s => Array.isArray(s.path) && s.path.length >= 2
    );
    if (paths.length === 0) return null;

    const R = 512;
    const SRC = 400; // 教材データの座標系
    const cv = document.createElement("canvas");
    cv.width = R;
    cv.height = R;

    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, R, R);

    const k = R / SRC;
    ctx.strokeStyle = "#000";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = SRC * 0.055 * k; // 毛筆の標準的な太さ

    paths.forEach(s => {
      ctx.beginPath();
      s.path.forEach((p, i) => {
        if (i) ctx.lineTo(p.x * k, p.y * k);
        else ctx.moveTo(p.x * k, p.y * k);
      });
      ctx.stroke();
    });

    const bin = ImageProc.binarize(ImageProc.toGray(ctx.getImageData(0, 0, R, R)), 128);
    const box = ImageProc.boundingBox(bin, R, R);
    if (!box) return null;

    return ImageProc.normalize(bin, R, R, box, SIZE).data;
  }

  /**
   * その文字で現実に届く重なり率の上限を求める。
   *
   * 重なり率は字の密度で大きく変わる。「二」のように細い画が少ない字は
   * どんなに上手に書いても 0.2 程度しか重ならない一方、「木」のような字は
   * 0.6 近くまで上がる。全文字を同じ基準で採点すると前者が不当に低くなるため、
   * 理想形と手本の重なり率を「その字の満点ライン」として使う。
   *
   * @private
   * @returns {number|null}
   */
  function iouCeiling(charData, refNorm) {
    const ideal = renderPathBitmap(charData);
    if (!ideal) return null;

    return ImageProc.bestIou(ideal, refNorm, SIZE);
  }

  /* ============================================================
   * 先生手本の保存・読み出し
   * ========================================================== */

  /**
   * ビットマップを base64 に詰める（1画素1ビット）
   * @private
   */
  function packBitmap(bin) {
    const bytes = new Uint8Array(Math.ceil(bin.length / 8));

    for (let i = 0; i < bin.length; i++) {
      if (bin[i]) {
        bytes[i >> 3] |= (1 << (i & 7));
      }
    }

    let s = "";
    for (let i = 0; i < bytes.length; i++) {
      s += String.fromCharCode(bytes[i]);
    }

    return btoa(s);
  }

  /**
   * base64 からビットマップへ戻す
   * @private
   */
  function unpackBitmap(b64, length) {
    const s = atob(b64);
    const bin = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
      const byte = s.charCodeAt(i >> 3);
      bin[i] = (byte >> (i & 7)) & 1;
    }

    return bin;
  }

  /**
   * 撮影した先生の作品を、その文字の手本として登録する
   *
   * @param {string} char 対象の文字
   * @param {Uint8Array} norm 正規化済みビットマップ
   * @param {string} thumbDataUrl サムネイル画像（省略可）
   * @returns {{ok:boolean,error?:string}}
   */
  function saveTeacherReference(char, norm, thumbDataUrl) {
    const endings = ImageProc.analyzeStrokeEndings(norm, SIZE, SIZE);

    const record = {
      norm: packBitmap(norm),
      size: SIZE,
      endings,
      thumb: thumbDataUrl || null,
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(KEY_PREFIX + char, JSON.stringify(record));
      return { ok: true };
    } catch (e) {
      // 容量超過の場合はサムネイルを捨てて再試行する
      try {
        record.thumb = null;
        localStorage.setItem(KEY_PREFIX + char, JSON.stringify(record));
        return { ok: true, error: "画像の保存容量が足りないため、見本写真は保存しませんでした。" };
      } catch (e2) {
        return { ok: false, error: "保存できませんでした（ブラウザの保存容量が不足しています）。" };
      }
    }
  }

  /**
   * 先生手本を読み出す
   * @returns {{norm:Uint8Array,size:number,endings:Array,thumb:string|null}|null}
   */
  function loadTeacherReference(char) {
    let raw;
    try {
      raw = localStorage.getItem(KEY_PREFIX + char);
    } catch (e) {
      return null;
    }

    if (!raw) return null;

    try {
      const rec = JSON.parse(raw);
      const size = rec.size || SIZE;
      return {
        norm: unpackBitmap(rec.norm, size * size),
        size,
        endings: rec.endings || [],
        thumb: rec.thumb || null,
        savedAt: rec.savedAt
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * 先生手本が登録済みか
   */
  function hasTeacherReference(char) {
    try {
      return localStorage.getItem(KEY_PREFIX + char) !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * 先生手本を削除する
   */
  function deleteTeacherReference(char) {
    try {
      localStorage.removeItem(KEY_PREFIX + char);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 登録済みの先生手本の文字一覧
   */
  function listTeacherReferences() {
    const chars = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(KEY_PREFIX)) {
          chars.push(k.slice(KEY_PREFIX.length));
        }
      }
    } catch (e) {
      /* 読めなければ空で返す */
    }

    return chars;
  }

  /* ============================================================
   * 手本の取得（先生手本 → フォント手本）
   * ========================================================== */

  const fontCache = new Map();

  /**
   * 採点に使う手本を取得する。先生手本があればそれを優先する。
   *
   * @param {string} char
   * @param {Object} charData data/gradeNN.js の文字データ（ending の定義を持つ）
   * @returns {{norm:Uint8Array,size:number,endings:Array,source:string,thumb:string|null,expectedEndings:Array}}
   */
  function getReference(char, charData) {
    const teacher = loadTeacherReference(char);

    if (teacher) {
      return {
        norm: teacher.norm,
        size: teacher.size,
        endings: teacher.endings,
        expectedEndings: expectedEndingsOf(charData, teacher.endings),
        ceiling: iouCeiling(charData, teacher.norm),
        thumb: teacher.thumb,
        source: "teacher"
      };
    }

    let font = fontCache.get(char);
    if (!font) {
      font = renderFontReference(char);
      font.ceiling = iouCeiling(charData, font.norm);

      // 毛筆フォントが届く前に描いた字は退避先のフォントなので覚えない
      if (BrushFont.isLoaded()) fontCache.set(char, font);
    }

    return {
      norm: font.norm,
      size: font.size,
      endings: font.endings,
      expectedEndings: expectedEndingsOf(charData, font.endings),
      ceiling: font.ceiling,
      thumb: null,
      source: "font"
    };
  }

  /**
   * この文字で期待される「とめ・はね・はらい」の一覧を決める。
   *
   * 教材データ（data/gradeNN.js の strokes[].ending）が最も信頼できる情報源。
   * 定義が無い場合は手本画像から自動検出した結果で代用する。
   *
   * @private
   * @returns {Array<{kind:string,name:string,x?:number,y?:number}>}
   */
  function expectedEndingsOf(charData, detected) {
    const defined = [];

    if (charData && Array.isArray(charData.strokes)) {
      charData.strokes.forEach(s => {
        if (s.ending && s.ending !== "none") {
          defined.push({
            kind: s.ending,
            name: s.name || `第${s.order}画`,
            order: s.order,
            hint: s.hint || ""
          });
        }
      });
    }

    if (defined.length > 0) return defined;

    // 教材データに定義が無ければ、手本画像から拾った端点で代用する
    return (detected || []).map((e, i) => ({
      kind: e.kind,
      name: `筆画${i + 1}`,
      x: e.x,
      y: e.y,
      hint: ""
    }));
  }

  /**
   * 手本を Canvas に描く
   */
  function drawReference(ctx, ref, destSize, color) {
    ImageProc.drawBitmap(ctx, ref.norm, ref.size, color || "#c9c9c9", destSize);
  }

  return {
    renderFontReference,
    saveTeacherReference,
    loadTeacherReference,
    hasTeacherReference,
    deleteTeacherReference,
    listTeacherReferences,
    getReference,
    drawReference
  };
})();
