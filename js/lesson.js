/*
 * レッスンページ制御
 * 実装: フロントエンドエンジニア 匠(Takumi)
 *
 * 流れ:
 *   文字を選ぶ → 書き順アニメーションで筆の運びを見る
 *   → 毛筆で半紙に書く → カメラで撮影 → 文字を切り出す → 採点 → 講評
 */

(function () {
  const el = id => document.getElementById(id);

  const dom = {
    charName: el("charName"),
    charReading: el("charReading"),
    charExample: el("charExample"),
    charExplain: el("charExplain"),
    charPoint: el("charPoint"),

    animCanvas: el("animCanvas"),
    animPlayBtn: el("animPlayBtn"),
    animStepBtn: el("animStepBtn"),
    animAllBtn: el("animAllBtn"),
    animCaption: el("animCaption"),
    endingList: el("endingList"),

    cameraStage: el("cameraStage"),
    cameraVideo: el("cameraVideo"),
    shotImage: el("shotImage"),
    cameraGuide: el("cameraGuide"),
    cameraPlaceholder: el("cameraPlaceholder"),
    cameraStatus: el("cameraStatus"),
    charCountSelect: el("charCountSelect"),
    deviceField: el("deviceField"),
    deviceSelect: el("deviceSelect"),
    cameraStartBtn: el("cameraStartBtn"),
    shootBtn: el("shootBtn"),
    retakeBtn: el("retakeBtn"),
    fileInput: el("fileInput"),
    splitPreview: el("splitPreview"),
    splitRow: el("splitRow"),
    scoreRow: el("scoreRow"),
    scoreBtn: el("scoreBtn"),

    feedbackPanel: el("feedbackPanel"),
    scoreCircle: el("scoreCircle"),
    scoreNum: el("scoreNum"),
    scoreSource: el("scoreSource"),
    axisList: el("axisList"),
    feedback: el("feedback"),
    charResults: el("charResults"),
    retryBtn: el("retryBtn"),
    nextBtn: el("nextBtn"),

    teacherState: el("teacherState"),
    saveRefBtn: el("saveRefBtn"),
    deleteRefBtn: el("deleteRefBtn"),

    charList: el("charList")
  };

  let gradeData = [];
  let grade = 1;
  let index = 0;
  let anim = null;

  // 直近の撮影結果
  let shot = null;      // { imageData, dataUrl, width, height }
  let analysis = null;  // ImageProc.processPhoto の結果

  /* ============================================================
   * 初期化
   * ========================================================== */

  function init() {
    gradeData = window.GRADE_DATA || [];
    if (gradeData.length === 0) {
      console.error("文字データが読み込まれていません");
      return;
    }

    grade = detectGrade();
    index = resumeIndex();

    bindEvents();
    renderCharacter();
    renderCharList();
  }

  function detectGrade() {
    const m = window.location.href.match(/lesson-0(\d)/);
    return m ? Number(m[1]) : 1;
  }

  /** 前回の続きの文字から始める */
  function resumeIndex() {
    const saved = Progress.getGrade(grade);
    const solved = Object.keys(saved.solved || {});
    if (solved.length === 0) return 0;

    const last = gradeData.findIndex(c => c.id === solved[solved.length - 1]);
    return last >= 0 ? (last + 1) % gradeData.length : 0;
  }

  function bindEvents() {
    dom.animPlayBtn.addEventListener("click", () => {
      anim.reset();
      anim.play();
    });
    dom.animStepBtn.addEventListener("click", () => anim.step());
    dom.animAllBtn.addEventListener("click", () => {
      anim.showAll();
      dom.animCaption.textContent = "すべての画を書き終えた形です。";
    });

    dom.cameraStartBtn.addEventListener("click", startCamera);
    dom.shootBtn.addEventListener("click", shoot);
    dom.retakeBtn.addEventListener("click", retake);
    dom.fileInput.addEventListener("change", onFilePicked);
    dom.deviceSelect.addEventListener("change", () => startCamera(dom.deviceSelect.value));
    dom.charCountSelect.addEventListener("change", () => {
      if (shot) analyzeShot();
    });

    dom.scoreBtn.addEventListener("click", runScoring);
    dom.retryBtn.addEventListener("click", retake);
    dom.nextBtn.addEventListener("click", nextCharacter);

    dom.saveRefBtn.addEventListener("click", saveTeacherReference);
    dom.deleteRefBtn.addEventListener("click", deleteTeacherReference);

    window.addEventListener("beforeunload", () => Camera.stop());
  }

  /* ============================================================
   * 文字の表示
   * ========================================================== */

  function current() {
    return gradeData[index];
  }

  function renderCharacter() {
    const c = current();

    dom.charName.textContent = c.char;
    dom.charReading.textContent = `${c.reading}（${c.type === "hiragana" ? "ひらがな" : "漢字"}）`;
    dom.charExample.textContent = c.word_example ? `例：${c.word_example}` : "";
    dom.charExplain.textContent = c.explanation || "";
    dom.charPoint.textContent = c.point ? `ポイント：${c.point}` : "";

    renderEndingList(c);
    buildAnim(c);
    renderTeacherState();
    resetShot();
    hide(dom.feedbackPanel);
  }

  function renderEndingList(c) {
    dom.endingList.innerHTML = "";

    (c.strokes || []).forEach(s => {
      if (!s.ending || s.ending === "none") return;

      const li = document.createElement("li");
      li.className = `ending-item kind-${s.ending}`;

      const tag = document.createElement("span");
      tag.className = "ending-tag";
      tag.textContent = Scorer.KIND_LABEL[s.ending] || s.ending;

      const body = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = `第${s.order}画 ${s.name}`;
      const hint = document.createElement("p");
      hint.textContent = s.hint || Scorer.KIND_ADVICE[s.ending] || "";

      body.appendChild(name);
      body.appendChild(hint);
      li.appendChild(tag);
      li.appendChild(body);
      dom.endingList.appendChild(li);
    });
  }

  function buildAnim(c) {
    anim = StrokeAnim.create(dom.animCanvas, c, {
      onStroke(i, stroke) {
        const kind = Scorer.KIND_LABEL[stroke.ending];
        dom.animCaption.textContent = kind
          ? `第${i + 1}画 ${stroke.name}（${kind}）　${stroke.hint || ""}`
          : `第${i + 1}画 ${stroke.name}`;
      }
    });
    dom.animCaption.textContent = `全${anim.strokeCount()}画です。「さいしょから見る」を押してください。`;
  }

  /* ============================================================
   * カメラ
   * ========================================================== */

  async function startCamera(deviceId) {
    setStatus("カメラを起動しています…");

    const res = await Camera.start(dom.cameraVideo, typeof deviceId === "string" ? deviceId : null);

    if (!res.ok) {
      setStatus(res.error, "error");
      dom.shootBtn.disabled = true;
      return;
    }

    dom.cameraStage.classList.add("live");
    hide(dom.cameraPlaceholder);
    dom.shotImage.hidden = true;
    dom.cameraVideo.hidden = false;
    dom.shootBtn.disabled = false;
    dom.cameraStartBtn.textContent = "カメラをつけ直す";
    setStatus("半紙が枠いっぱいに入るようにして「撮影する」を押してください。");

    await fillDeviceList();
  }

  async function fillDeviceList() {
    const devices = await Camera.listDevices();
    if (devices.length < 2) {
      dom.deviceField.hidden = true;
      return;
    }

    dom.deviceField.hidden = false;
    dom.deviceSelect.innerHTML = "";

    const currentId = Camera.currentDeviceId();
    devices.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label;
      if (d.deviceId === currentId) opt.selected = true;
      dom.deviceSelect.appendChild(opt);
    });
  }

  function shoot() {
    const captured = Camera.capture();
    if (!captured) {
      setStatus("撮影できませんでした。もう一度お試しください。", "error");
      return;
    }

    shot = captured;
    Camera.stop();
    showShot();
    analyzeShot();
  }

  async function onFilePicked(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      shot = await Camera.loadFromFile(file);
      Camera.stop();
      showShot();
      analyzeShot();
    } catch (err) {
      setStatus(err.message, "error");
    }

    e.target.value = "";
  }

  function showShot() {
    dom.cameraVideo.hidden = true;
    dom.shotImage.src = shot.dataUrl;
    dom.shotImage.hidden = false;
    hide(dom.cameraPlaceholder);
    dom.cameraStage.classList.add("live");
    dom.retakeBtn.hidden = false;
    dom.shootBtn.disabled = true;
  }

  function retake() {
    resetShot();
    hide(dom.feedbackPanel);
    startCamera();
  }

  function resetShot() {
    shot = null;
    analysis = null;

    Camera.stop();
    dom.cameraStage.classList.remove("live");
    dom.cameraVideo.hidden = false;
    dom.shotImage.hidden = true;
    dom.shotImage.removeAttribute("src");
    dom.cameraPlaceholder.hidden = false;
    dom.retakeBtn.hidden = true;
    dom.shootBtn.disabled = true;
    dom.cameraStartBtn.textContent = "カメラをつける";
    hide(dom.splitPreview);
    hide(dom.scoreRow);
    dom.saveRefBtn.disabled = true;
    setStatus("");
  }

  /* ============================================================
   * 文字の切り出し
   * ========================================================== */

  function analyzeShot() {
    const expected = Number(dom.charCountSelect.value) || 1;
    analysis = ImageProc.processPhoto(shot.imageData, expected);

    if (!analysis.chars.length) {
      setStatus("字が見つかりませんでした。明るいところで、半紙全体を写して撮り直してください。", "error");
      hide(dom.splitPreview);
      hide(dom.scoreRow);
      return;
    }

    renderSplitPreview();

    if (analysis.chars.length !== expected) {
      setStatus(
        `${expected}字のつもりでしたが、${analysis.chars.length}字として読み取りました。` +
        "文字の数を選び直すか、字の間をもう少し空けて撮り直してください。",
        "warn"
      );
    } else {
      setStatus(`${analysis.chars.length}字を読み取りました。「採点する」を押してください。`);
    }

    show(dom.scoreRow);
    dom.saveRefBtn.disabled = analysis.chars.length !== 1;
  }

  function renderSplitPreview() {
    dom.splitRow.innerHTML = "";

    analysis.chars.forEach((ch, i) => {
      const wrap = document.createElement("div");
      wrap.className = "split-item";

      const cv = document.createElement("canvas");
      cv.width = 110;
      cv.height = 110;
      ImageProc.drawBitmap(cv.getContext("2d"), ch.norm, ch.size, "#1a1a1a", 110);

      const label = document.createElement("span");
      label.textContent = labelFor(i);

      wrap.appendChild(cv);
      wrap.appendChild(label);
      dom.splitRow.appendChild(wrap);
    });

    show(dom.splitPreview);
  }

  /**
   * 切り出した字に対応するレッスン上の文字名。
   * 1字なら今日の文字。複数字なら今日の文字から順に並んでいるものとみなす。
   */
  function labelFor(i) {
    const count = analysis.chars.length;
    if (count === 1) return current().char;

    const c = gradeData[(index + i) % gradeData.length];
    return c ? c.char : `${i + 1}字目`;
  }

  /** 切り出した i 番目に対応する文字データ */
  function charDataFor(i) {
    const count = analysis.chars.length;
    if (count === 1) return current();
    return gradeData[(index + i) % gradeData.length] || current();
  }

  /* ============================================================
   * 採点
   * ========================================================== */

  function runScoring() {
    if (!analysis || !analysis.chars.length) return;

    const boxes = analysis.chars.map(c => c.box);

    const results = analysis.chars.map((ch, i) => {
      const cd = charDataFor(i);
      const ref = Reference.getReference(cd.char, cd);

      const result = Scorer.scoreCharacter(ch.norm, ch.size, ref, cd, {
        photoW: analysis.width,
        photoH: analysis.height,
        box: ch.box,
        charCount: analysis.chars.length,
        index: i,
        boxes
      });

      result.char = cd.char;
      result.charId = cd.id;
      return result;
    });

    const work = Scorer.scoreWork(results);
    renderFeedback(work, results);
    saveProgress(results);
    renderCharList();

    dom.feedbackPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveProgress(results) {
    results.forEach(r => {
      if (!r.blank) Progress.setSolved(grade, r.charId, r.total);
    });
  }

  function renderFeedback(work, results) {
    show(dom.feedbackPanel);

    dom.scoreNum.textContent = work.total;
    dom.scoreCircle.textContent = work.total;
    dom.scoreCircle.style.background = Feedback.colorFor(work.total);
    dom.scoreCircle.style.color = Feedback.textColorFor(work.total);

    const source = results[0] && results[0].referenceSource === "teacher"
      ? "先生のお手本と比べて採点しました。"
      : "毛筆楷書のお手本と比べて採点しました（先生のお手本を登録すると、そちらと比べます）。";
    dom.scoreSource.textContent = source;

    renderAxes(results);
    renderComments(work, results);
    renderCharResults(results);
  }

  /** 3つの観点を平均してバーで見せる */
  function renderAxes(results) {
    const valid = results.filter(r => !r.blank);
    dom.axisList.innerHTML = "";

    if (valid.length === 0) return;

    const avg = key => Math.round(
      valid.reduce((s, r) => s + r[key].score, 0) / valid.length
    );

    [
      { label: "とめ・はね・はらい", value: avg("ending"), weight: "40%" },
      { label: "字形・骨格", value: avg("shape"), weight: "40%" },
      { label: "配置・余白", value: avg("layout"), weight: "20%" }
    ].forEach(axis => {
      const li = document.createElement("li");
      li.className = "axis-item";

      const head = document.createElement("div");
      head.className = "axis-head";
      head.innerHTML =
        `<span>${axis.label}<small>（${axis.weight}）</small></span><strong>${axis.value}</strong>`;

      const bar = document.createElement("div");
      bar.className = "axis-bar";
      const fill = document.createElement("div");
      fill.className = "axis-fill";
      fill.style.width = `${axis.value}%`;
      fill.style.background = Feedback.colorFor(axis.value);
      bar.appendChild(fill);

      li.appendChild(head);
      li.appendChild(bar);
      dom.axisList.appendChild(li);
    });
  }

  function renderComments(work, results) {
    dom.feedback.innerHTML = "";

    const lines = [];
    if (work.comment) lines.push(work.comment);
    results.forEach(r => (r.comments || []).forEach(c => lines.push(c)));

    // 同じ助言が並ばないようにする
    const seen = new Set();
    lines.forEach(line => {
      if (seen.has(line)) return;
      seen.add(line);

      const p = document.createElement("p");
      p.textContent = line;
      dom.feedback.appendChild(p);
    });
  }

  /** 文字ごとの「とめ・はね・はらい」の○× */
  function renderCharResults(results) {
    dom.charResults.innerHTML = "";

    results.forEach(r => {
      const box = document.createElement("div");
      box.className = "char-result";

      const head = document.createElement("div");
      head.className = "char-result-head";
      head.innerHTML = `<span class="crc">${r.char}</span><strong>${r.total}点</strong>`;
      box.appendChild(head);

      if (r.blank) {
        const p = document.createElement("p");
        p.textContent = "この字は読み取れませんでした。";
        box.appendChild(p);
        dom.charResults.appendChild(box);
        return;
      }

      const ul = document.createElement("ul");
      ul.className = "check-list";

      (r.ending.items || []).forEach(it => {
        const li = document.createElement("li");
        li.className = it.ok ? "ok" : "ng";
        li.innerHTML =
          `<span class="mark">${it.ok ? "○" : "△"}</span>` +
          `<span>${it.name}（${Scorer.KIND_LABEL[it.expect] || it.expect}）</span>`;
        ul.appendChild(li);
      });

      if (ul.children.length) box.appendChild(ul);
      dom.charResults.appendChild(box);
    });
  }

  /* ============================================================
   * 先生用：お手本の登録
   * ========================================================== */

  function renderTeacherState() {
    const char = current().char;
    const has = Reference.hasTeacherReference(char);

    dom.teacherState.innerHTML = "";
    dom.deleteRefBtn.hidden = !has;

    const p = document.createElement("p");
    p.className = has ? "state-on" : "state-off";
    p.textContent = has
      ? `「${char}」のお手本は登録済みです。`
      : `「${char}」のお手本はまだ登録されていません。`;
    dom.teacherState.appendChild(p);

    if (!has) return;

    const ref = Reference.loadTeacherReference(char);
    if (ref && ref.thumb) {
      const img = document.createElement("img");
      img.className = "ref-thumb";
      img.src = ref.thumb;
      img.alt = `${char}のお手本`;
      dom.teacherState.appendChild(img);
    }
  }

  async function saveTeacherReference() {
    if (!analysis || analysis.chars.length !== 1) return;

    const char = current().char;
    const ch = analysis.chars[0];
    const thumb = await Camera.cropThumb(shot.dataUrl, ch.box, 120);

    const res = Reference.saveTeacherReference(char, ch.norm, thumb);

    if (!res.ok) {
      setStatus(res.error, "error");
      return;
    }

    setStatus(res.error || `「${char}」のお手本を登録しました。`, res.error ? "warn" : "ok");
    renderTeacherState();
  }

  function deleteTeacherReference() {
    const char = current().char;
    Reference.deleteTeacherReference(char);
    setStatus(`「${char}」のお手本を消しました。`);
    renderTeacherState();
  }

  /* ============================================================
   * 文字の切り替え
   * ========================================================== */

  function nextCharacter() {
    index = (index + 1) % gradeData.length;
    renderCharacter();
    renderCharList();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCharList() {
    dom.charList.innerHTML = "";
    const stats = Progress.getGrade(grade);

    gradeData.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.className = "char-button";
      btn.textContent = c.char;

      if (i === index) btn.classList.add("active");
      if (stats.mastered && stats.mastered.includes(c.id)) btn.classList.add("solved");
      if (Reference.hasTeacherReference(c.char)) btn.classList.add("has-ref");

      btn.addEventListener("click", () => {
        index = i;
        renderCharacter();
        renderCharList();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      dom.charList.appendChild(btn);
    });
  }

  /* ============================================================
   * 小さなヘルパー
   * ========================================================== */

  function setStatus(text, kind) {
    dom.cameraStatus.textContent = text || "";
    dom.cameraStatus.className = `camera-status${kind ? " " + kind : ""}`;
  }

  function show(node) {
    node.hidden = false;
  }

  function hide(node) {
    node.hidden = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
