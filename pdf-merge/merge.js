/*
 * PDF・画像まとめツール
 * 複数の JPEG / PNG / PDF をブラウザ内で 1 つの PDF に統合してダウンロードする。
 * ファイルは外部に送信しない（pdf-lib でクライアント側処理）。
 */
(function () {
  'use strict';

  const { PDFDocument } = PDFLib;

  const A4 = { w: 595.28, h: 841.89 }; // pt

  const els = {
    drop: document.getElementById('drop'),
    input: document.getElementById('fileInput'),
    listCard: document.getElementById('listCard'),
    optionsCard: document.getElementById('optionsCard'),
    list: document.getElementById('fileList'),
    summary: document.getElementById('summary'),
    sortName: document.getElementById('sortName'),
    clearAll: document.getElementById('clearAll'),
    margin: document.getElementById('margin'),
    fileName: document.getElementById('fileName'),
    mergeBtn: document.getElementById('mergeBtn'),
    status: document.getElementById('status'),
  };

  // { id, file, kind: 'jpeg'|'png'|'pdf', bytes, pages, url, pdfDoc, error }
  let items = [];
  let nextId = 1;
  let dragId = null;

  // ---------- ファイルの読み込み ----------

  function detectKind(bytes) {
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
    // %PDF は先頭 1KB 以内にあればよい（仕様上の許容）
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
    if (head.includes('%PDF-')) return 'pdf';
    return null;
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setStatus('読み込み中…');
    for (const file of files) {
      const item = { id: nextId++, file, kind: null, bytes: null, pages: 0, url: null, pdfDoc: null, error: null };
      try {
        item.bytes = new Uint8Array(await file.arrayBuffer());
        item.kind = detectKind(item.bytes);
        if (!item.kind) {
          item.error = '対応していない形式です（JPEG・PNG・PDF のみ）';
        } else if (item.kind === 'pdf') {
          try {
            item.pdfDoc = await PDFDocument.load(item.bytes);
            item.pages = item.pdfDoc.getPageCount();
          } catch (e) {
            item.error = /encrypt/i.test(String(e && e.message))
              ? 'パスワード保護された PDF は読み込めません'
              : 'PDF を読み込めませんでした（壊れている可能性があります）';
          }
        } else {
          item.pages = 1;
          item.url = URL.createObjectURL(file);
        }
      } catch (e) {
        item.error = 'ファイルを読み込めませんでした';
      }
      items.push(item);
    }
    setStatus('');
    render();
  }

  // ---------- 一覧の表示 ----------

  function formatSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function render() {
    const has = items.length > 0;
    els.listCard.hidden = !has;
    els.optionsCard.hidden = !has;

    const valid = items.filter(i => !i.error);
    const totalPages = valid.reduce((s, i) => s + i.pages, 0);
    els.summary.textContent = `${items.length} ファイル / 合計 ${totalPages} ページ`;
    els.mergeBtn.disabled = valid.length === 0;

    els.list.textContent = '';
    items.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = 'file-item' + (item.error ? ' error' : '');
      li.draggable = true;
      li.dataset.id = item.id;

      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = idx + 1;

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      if (item.url) {
        thumb.style.backgroundImage = `url("${item.url}")`;
      } else {
        thumb.classList.add(item.kind === 'pdf' ? 'pdf' : 'unknown');
        thumb.textContent = item.kind === 'pdf' ? 'PDF' : '?';
      }

      const info = document.createElement('div');
      info.className = 'info';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = item.file.name;
      name.title = item.file.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = item.error
        ? item.error + '（まとめる時は飛ばします）'
        : `${item.kind.toUpperCase()} ・ ${item.pages} ページ ・ ${formatSize(item.file.size)}`;
      info.append(name, meta);

      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.append(
        iconBtn('▲', '上へ', idx === 0, () => move(idx, idx - 1)),
        iconBtn('▼', '下へ', idx === items.length - 1, () => move(idx, idx + 1)),
        iconBtn('✕', '削除', false, () => remove(item.id), 'del'),
      );

      li.append(num, thumb, info, actions);
      els.list.appendChild(li);
    });
  }

  function iconBtn(label, title, disabled, onClick, extra) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn' + (extra ? ' ' + extra : '');
    b.textContent = label;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.disabled = disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  function move(from, to) {
    if (to < 0 || to >= items.length) return;
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    render();
  }

  function remove(id) {
    const idx = items.findIndex(i => i.id === id);
    if (idx < 0) return;
    if (items[idx].url) URL.revokeObjectURL(items[idx].url);
    items.splice(idx, 1);
    render();
  }

  // ---------- ドラッグで並べ替え ----------

  function clearDropMarks() {
    els.list.querySelectorAll('.drop-before, .drop-after')
      .forEach(el => el.classList.remove('drop-before', 'drop-after'));
  }

  els.list.addEventListener('dragstart', e => {
    const li = e.target.closest('.file-item');
    if (!li) return;
    dragId = Number(li.dataset.id);
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragId));
  });

  els.list.addEventListener('dragover', e => {
    if (dragId === null) return;
    e.preventDefault();
    const li = e.target.closest('.file-item');
    clearDropMarks();
    if (!li || Number(li.dataset.id) === dragId) return;
    const r = li.getBoundingClientRect();
    li.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });

  els.list.addEventListener('drop', e => {
    if (dragId === null) return;
    e.preventDefault();
    e.stopPropagation();
    const li = e.target.closest('.file-item');
    if (li && Number(li.dataset.id) !== dragId) {
      const before = li.classList.contains('drop-before');
      const from = items.findIndex(i => i.id === dragId);
      const [it] = items.splice(from, 1);
      let to = items.findIndex(i => i.id === Number(li.dataset.id));
      if (!before) to += 1;
      items.splice(to, 0, it);
    }
    dragId = null;
    render();
  });

  els.list.addEventListener('dragend', () => {
    dragId = null;
    clearDropMarks();
    els.list.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  });

  // ---------- ファイル追加の入口 ----------

  els.input.addEventListener('change', () => {
    addFiles(els.input.files);
    els.input.value = '';
  });

  ['dragenter', 'dragover'].forEach(ev => els.drop.addEventListener(ev, e => {
    if (dragId !== null) return;
    e.preventDefault();
    els.drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(ev => els.drop.addEventListener(ev, () => els.drop.classList.remove('over')));
  els.drop.addEventListener('drop', e => {
    if (dragId !== null) return;
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  });
  // ドロップ領域の外に落としてもブラウザがファイルを開かないようにする
  window.addEventListener('dragover', e => { if (dragId === null) e.preventDefault(); });
  window.addEventListener('drop', e => {
    if (dragId !== null) return;
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  els.sortName.addEventListener('click', () => {
    const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
    items.sort((a, b) => collator.compare(a.file.name, b.file.name));
    render();
  });

  els.clearAll.addEventListener('click', () => {
    items.forEach(i => i.url && URL.revokeObjectURL(i.url));
    items = [];
    setStatus('');
    render();
  });

  // ---------- 画像の向き（EXIF Orientation） ----------

  // スマホ写真は EXIF の回転情報を持つことがある。1（そのまま）以外なら値を返す。
  function jpegOrientation(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let off = 2;
    while (off + 4 < view.byteLength) {
      if (view.getUint8(off) !== 0xFF) return 1;
      const marker = view.getUint8(off + 1);
      const len = view.getUint16(off + 2);
      if (marker === 0xE1 && view.getUint32(off + 4) === 0x45786966) { // "Exif"
        const tiff = off + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const ifd = tiff + view.getUint32(tiff + 4, little);
        const count = view.getUint16(ifd, little);
        for (let i = 0; i < count; i++) {
          const entry = ifd + 2 + i * 12;
          if (entry + 12 > view.byteLength) return 1;
          if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
        }
        return 1;
      }
      if (marker === 0xDA) return 1; // 画像データ開始
      off += 2 + len;
    }
    return 1;
  }

  // ブラウザに向きを補正して描画させ、JPEG に再エンコードする
  async function normalizeJpeg(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close && bmp.close();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
    return new Uint8Array(await blob.arrayBuffer());
  }

  // ---------- 統合 ----------

  async function addImagePage(out, item, opts) {
    let img;
    if (item.kind === 'png') {
      img = await out.embedPng(item.bytes);
    } else {
      const bytes = jpegOrientation(item.bytes) > 1 ? await normalizeJpeg(item.file) : item.bytes;
      img = await out.embedJpg(bytes);
    }

    if (opts.pageSize === 'original') {
      // 72dpi 換算だと大きすぎることがあるので、長辺を A4 長辺程度に収める
      const scale = Math.min(1, (A4.h * 2) / Math.max(img.width, img.height));
      const w = img.width * scale, h = img.height * scale;
      out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
      return;
    }

    const landscape = img.width > img.height;
    const pw = landscape ? A4.h : A4.w;
    const ph = landscape ? A4.w : A4.h;
    const m = opts.margin;
    const scale = Math.min((pw - m * 2) / img.width, (ph - m * 2) / img.height);
    const w = img.width * scale, h = img.height * scale;
    out.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }

  async function merge() {
    const valid = items.filter(i => !i.error);
    if (!valid.length) return;

    const opts = {
      pageSize: document.querySelector('input[name="pageSize"]:checked').value,
      margin: Number(els.margin.value),
    };

    els.mergeBtn.disabled = true;
    try {
      const out = await PDFDocument.create();
      for (let n = 0; n < valid.length; n++) {
        const item = valid[n];
        setStatus(`まとめています… (${n + 1} / ${valid.length}) ${item.file.name}`);
        if (item.kind === 'pdf') {
          const pages = await out.copyPages(item.pdfDoc, item.pdfDoc.getPageIndices());
          pages.forEach(p => out.addPage(p));
        } else {
          await addImagePage(out, item, opts);
        }
      }
      setStatus('ファイルを作成しています…');
      const bytes = await out.save();
      download(bytes, outputName());
      setStatus(`完了しました：${out.getPageCount()} ページの PDF をダウンロードしました。`, 'ok');
    } catch (e) {
      console.error(e);
      setStatus('まとめる途中でエラーが発生しました：' + (e && e.message ? e.message : e), 'err');
    } finally {
      els.mergeBtn.disabled = false;
    }
  }

  function outputName() {
    const base = els.fileName.value.trim().replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '_');
    return (base || 'まとめ') + '.pdf';
  }

  function download(bytes, name) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function setStatus(msg, type) {
    els.status.textContent = msg;
    els.status.className = 'status' + (type ? ' ' + type : '');
  }

  els.mergeBtn.addEventListener('click', merge);
})();
