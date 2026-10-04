/*
 * 筆画順序データベース
 * 設計: 英語教材デザイナー 詠(Ei)
 * 文部科学省「小学校学習指導要領」の筆順に基づく
 *
 * 各文字の標準筆画情報を管理
 */

window.STROKE_ORDER_DB = {
  "あ": {
    char: "あ",
    type: "hiragana",
    strokes: [
      { order: 1, description: "上の横棒" },
      { order: 2, description: "左側の丸" },
      { order: 3, description: "右側の丸" }
    ]
  },
  "い": {
    char: "い",
    type: "hiragana",
    strokes: [
      { order: 1, description: "左の線" },
      { order: 2, description: "中央の線" },
      { order: 3, description: "右の線" }
    ]
  },
  "う": {
    char: "う",
    type: "hiragana",
    strokes: [
      { order: 1, description: "上の曲線" },
      { order: 2, description: "左側の線" },
      { order: 3, description: "下の横棒" }
    ]
  },
  "え": {
    char: "え",
    type: "hiragana",
    strokes: [
      { order: 1, description: "上の曲線" },
      { order: 2, description: "左下の棒" },
      { order: 3, description: "下の横棒" }
    ]
  },
  "お": {
    char: "お",
    type: "hiragana",
    strokes: [
      { order: 1, description: "上の曲線" },
      { order: 2, description: "右側の曲線" },
      { order: 3, description: "下の曲線" },
      { order: 4, description: "左側の曲線" }
    ]
  },
  "亜": {
    char: "亜",
    type: "kanji",
    strokes: [
      { order: 1, description: "上の棒" },
      { order: 2, description: "左側の棒" },
      { order: 3, description: "下の棒" },
      { order: 4, description: "右側の棒" }
    ]
  }
  // 詠が各文字の筆画順序を追加予定（計126～160字）
};
