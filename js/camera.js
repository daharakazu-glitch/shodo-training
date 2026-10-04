/*
 * PCカメラ制御
 * 実装: フロントエンドエンジニア 匠(Takumi)
 *
 * 書いた作品（半紙）をPCのカメラで撮影し、採点に渡せる ImageData にする。
 * カメラが使えない環境では、ファイル選択（写真の読み込み）で代替できる。
 */

window.Camera = (function () {
  let stream = null;
  let videoEl = null;
  let deviceId = null;

  const DEVICE_KEY = "shodo_camera_device";

  /* ============================================================
   * 起動・停止
   * ========================================================== */

  /**
   * カメラを起動して video 要素に流す
   *
   * @param {HTMLVideoElement} video
   * @param {string} [preferredDeviceId]
   * @returns {Promise<{ok:boolean,error?:string}>}
   */
  async function start(video, preferredDeviceId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { ok: false, error: "このブラウザはカメラに対応していません。写真を読み込んでください。" };
    }

    stop();

    videoEl = video;
    const wanted = preferredDeviceId || loadSavedDevice();

    const constraints = {
      audio: false,
      video: wanted
        ? { deviceId: { exact: wanted }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      // 指定デバイスが使えない／背面カメラが無い場合は既定のカメラで再試行
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      } catch (e2) {
        return { ok: false, error: describeError(e2) };
      }
    }

    deviceId = currentTrackDeviceId();
    if (deviceId) saveDevice(deviceId);

    video.srcObject = stream;
    video.setAttribute("playsinline", "");
    video.muted = true;

    try {
      await video.play();
    } catch (e) {
      /* 自動再生が止められても srcObject は繋がっているので続行する */
    }

    await waitForVideoSize(video);

    return { ok: true };
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
  }

  function isActive() {
    return stream !== null;
  }

  /**
   * video の解像度が確定するまで待つ（撮影サイズが 0 になるのを防ぐ）
   * @private
   */
  function waitForVideoSize(video) {
    if (video.videoWidth > 0) return Promise.resolve();

    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        video.removeEventListener("loadedmetadata", finish);
        resolve();
      };
      video.addEventListener("loadedmetadata", finish);
      setTimeout(finish, 2000);
    });
  }

  /**
   * getUserMedia の例外を小学生・先生向けの日本語にする
   * @private
   */
  function describeError(e) {
    const name = e && e.name ? e.name : "";

    if (name === "NotAllowedError" || name === "SecurityError") {
      return "カメラの使用がブロックされています。ブラウザのアドレスバーのカメラアイコンから許可してください。";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return "カメラが見つかりませんでした。写真を読み込んでください。";
    }
    if (name === "NotReadableError") {
      return "カメラが他のアプリで使われています。そのアプリを閉じてからもう一度お試しください。";
    }
    return "カメラを起動できませんでした。写真を読み込んでください。";
  }

  /* ============================================================
   * デバイス選択
   * ========================================================== */

  /**
   * 使えるカメラの一覧。label はカメラ許可後にしか取れないので
   * 一覧を出すのは start() 後が望ましい。
   *
   * @returns {Promise<Array<{deviceId:string,label:string}>>}
   */
  async function listDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      return all
        .filter(d => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `カメラ ${i + 1}`
        }));
    } catch (e) {
      return [];
    }
  }

  function currentDeviceId() {
    return deviceId;
  }

  /** @private */
  function currentTrackDeviceId() {
    if (!stream) return null;
    const track = stream.getVideoTracks()[0];
    if (!track) return null;

    const settings = track.getSettings ? track.getSettings() : {};
    return settings.deviceId || null;
  }

  /** @private */
  function saveDevice(id) {
    try {
      localStorage.setItem(DEVICE_KEY, id);
    } catch (e) {
      /* 保存できなくても動作に影響はない */
    }
  }

  /** @private */
  function loadSavedDevice() {
    try {
      return localStorage.getItem(DEVICE_KEY);
    } catch (e) {
      return null;
    }
  }

  /* ============================================================
   * 撮影
   * ========================================================== */

  /**
   * 現在のカメラ映像を1枚取り込む。
   * 長辺が maxSize を超える場合は縮小する（解析は 128x128 に落とすので十分）。
   *
   * @param {number} [maxSize=1280]
   * @returns {{imageData:ImageData,dataUrl:string,width:number,height:number}|null}
   */
  function capture(maxSize) {
    if (!videoEl || !videoEl.videoWidth) return null;

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const limit = maxSize || 1280;
    const scale = Math.min(1, limit / Math.max(vw, vh));

    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);

    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;

    const ctx = cv.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, w, h);

    return {
      imageData: ctx.getImageData(0, 0, w, h),
      dataUrl: cv.toDataURL("image/jpeg", 0.8),
      width: w,
      height: h
    };
  }

  /**
   * ファイル（写真）から取り込む。カメラが使えない環境の代替手段。
   *
   * @param {File} file
   * @param {number} [maxSize=1280]
   * @returns {Promise<{imageData:ImageData,dataUrl:string,width:number,height:number}>}
   */
  function loadFromFile(file, maxSize) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("画像ファイルを選んでください。"));
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        const limit = maxSize || 1280;
        const scale = Math.min(1, limit / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;

        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);

        resolve({
          imageData: ctx.getImageData(0, 0, w, h),
          dataUrl: cv.toDataURL("image/jpeg", 0.8),
          width: w,
          height: h
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("この画像は読み込めませんでした。"));
      };

      img.src = url;
    });
  }

  /**
   * 撮影画像から切り出した1文字のサムネイルを作る（手本登録の確認用）
   *
   * @param {string} dataUrl 元画像
   * @param {{minX:number,minY:number,maxX:number,maxY:number}} box 切り出し範囲
   * @param {number} [size=120]
   * @returns {Promise<string>} dataURL
   */
  function cropThumb(dataUrl, box, size) {
    return new Promise(resolve => {
      const s = size || 120;
      const img = new Image();

      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = s;
        cv.height = s;

        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, s, s);

        const bw = box.maxX - box.minX + 1;
        const bh = box.maxY - box.minY + 1;
        const side = Math.max(bw, bh);

        // 正方形で切り出す（元画像の範囲に収める）
        const cx = box.minX + bw / 2;
        const cy = box.minY + bh / 2;
        const sx = Math.max(0, Math.min(img.width - side, cx - side / 2));
        const sy = Math.max(0, Math.min(img.height - side, cy - side / 2));

        ctx.drawImage(img, sx, sy, side, side, 0, 0, s, s);
        resolve(cv.toDataURL("image/jpeg", 0.7));
      };

      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  return {
    start,
    stop,
    isActive,
    listDevices,
    currentDeviceId,
    capture,
    loadFromFile,
    cropThumb
  };
})();
