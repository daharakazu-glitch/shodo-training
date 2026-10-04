/*
 * 1年配当文字データ
 * 設計: 英語教材デザイナー 詠(Ei)
 * ※ 教材データは詠が文部科学省筆順資料に基づき作成予定
 *
 * 現在: テンプレート版（動作確認用）
 * 最終版では: ひらがな46字 + 漢字80字 = 計126字を実装
 */

window.GRADE_DATA = [
  // === ひらがな ===
  {
    id: "001",
    char: "あ",
    type: "hiragana",
    reading: "あ",
    word_example: "赤い（あかい）",
    explanation: "ひらがなの「あ」です。やさしい角度で、丸くなぞってみましょう。",
    strokes: [
      { order: 1, description: "上の横棒", start: { x: 80, y: 100 }, end: { x: 280, y: 100 } },
      { order: 2, description: "左側の丸", start: { x: 100, y: 100 }, end: { x: 100, y: 280 } },
      { order: 3, description: "右側の丸", start: { x: 240, y: 150 }, end: { x: 240, y: 280 } }
    ],
    reference_pixels: [],  // 詠が生成
    boundingBox: { minX: 50, minY: 80, maxX: 330, maxY: 320 }
  },
  {
    id: "002",
    char: "い",
    type: "hiragana",
    reading: "い",
    word_example: "いぬ（犬）",
    explanation: "ひらがなの「い」です。3本の斜めの線で構成されています。",
    strokes: [
      { order: 1, description: "左の線", start: { x: 100, y: 120 }, end: { x: 100, y: 280 } },
      { order: 2, description: "中央の線", start: { x: 180, y: 120 }, end: { x: 180, y: 280 } },
      { order: 3, description: "右の線", start: { x: 260, y: 120 }, end: { x: 260, y: 280 } }
    ],
    reference_pixels: [],
    boundingBox: { minX: 70, minY: 100, maxX: 310, maxY: 300 }
  },
  {
    id: "003",
    char: "う",
    type: "hiragana",
    reading: "う",
    word_example: "うどん",
    explanation: "ひらがなの「う」です。上の丸と下の棒が特徴です。",
    strokes: [
      { order: 1, description: "上の曲線", start: { x: 100, y: 140 }, end: { x: 260, y: 140 } },
      { order: 2, description: "左側の線", start: { x: 100, y: 140 }, end: { x: 100, y: 240 } },
      { order: 3, description: "下の横棒", start: { x: 100, y: 240 }, end: { x: 260, y: 240 } }
    ],
    reference_pixels: [],
    boundingBox: { minX: 70, minY: 120, maxX: 310, maxY: 280 }
  },
  // 以下、計126字を追加予定...
  // 詠の責任: 正確な筆画順序・見本字データ・学習補足情報
];

window.GRADE_META = {
  grade: 1,
  title: "1年生",
  kanji_count: 80,
  hiragana_count: 46,
  total: 126
};
