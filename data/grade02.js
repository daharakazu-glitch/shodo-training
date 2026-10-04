/*
 * 2年配当文字データ
 * 設計: 英語教材デザイナー 詠(Ei)
 * ※ 教材データは詠が文部科学省筆順資料に基づき作成予定
 *
 * 現在: テンプレート版（動作確認用）
 * 最終版では: ひらがな + 漢字160字を実装
 */

window.GRADE_DATA = [
  {
    id: "201",
    char: "え",
    type: "hiragana",
    reading: "え",
    word_example: "えいが（映画）",
    explanation: "ひらがなの「え」です。上の丸と下の棒で構成されています。",
    strokes: [
      { order: 1, description: "上の曲線", start: { x: 100, y: 140 }, end: { x: 260, y: 140 } },
      { order: 2, description: "左下の棒", start: { x: 100, y: 140 }, end: { x: 100, y: 260 } },
      { order: 3, description: "下の横棒", start: { x: 100, y: 260 }, end: { x: 260, y: 260 } }
    ],
    reference_pixels: [],
    boundingBox: { minX: 70, minY: 120, maxX: 310, maxY: 300 }
  },
  {
    id: "202",
    char: "お",
    type: "hiragana",
    reading: "お",
    word_example: "おかあさん（お母さん）",
    explanation: "ひらがなの「お」です。丸い形をしています。",
    strokes: [
      { order: 1, description: "上の曲線", start: { x: 100, y: 120 }, end: { x: 260, y: 120 } },
      { order: 2, description: "右側の曲線", start: { x: 260, y: 120 }, end: { x: 260, y: 280 } },
      { order: 3, description: "下の曲線", start: { x: 260, y: 280 }, end: { x: 100, y: 280 } },
      { order: 4, description: "左側の曲線", start: { x: 100, y: 280 }, end: { x: 100, y: 120 } }
    ],
    reference_pixels: [],
    boundingBox: { minX: 70, minY: 100, maxX: 310, maxY: 310 }
  },
  {
    id: "203",
    char: "亜",
    type: "kanji",
    reading: "あ",
    word_example: "亜細亜（アジア）",
    explanation: "漢字の「亜」です。四角い形が特徴です。",
    strokes: [
      { order: 1, description: "上の棒", start: { x: 80, y: 100 }, end: { x: 320, y: 100 } },
      { order: 2, description: "左側の棒", start: { x: 80, y: 100 }, end: { x: 80, y: 320 } },
      { order: 3, description: "下の棒", start: { x: 80, y: 320 }, end: { x: 320, y: 320 } },
      { order: 4, description: "右側の棒", start: { x: 320, y: 100 }, end: { x: 320, y: 320 } }
    ],
    reference_pixels: [],
    boundingBox: { minX: 50, minY: 80, maxX: 350, maxY: 340 }
  },
  // 以下、計160字を追加予定...
];

window.GRADE_META = {
  grade: 2,
  title: "2年生",
  kanji_count: 160,
  hiragana_count: 0,  // 1年で習済みのため
  total: 160
};
