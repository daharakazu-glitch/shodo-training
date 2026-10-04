/*
 * 2年配当文字データ（毛筆版）
 * 設計: 英語教材デザイナー 詠(Ei)
 *
 * 形式は grade01.js と同じ。各画に ending（tome / hane / harai / none）を定義する。
 * 2年では「おれ」のある画と、そのあとの「はね」を重点的に扱う。
 */

window.GRADE_DATA = [
  {
    id: "101",
    char: "工",
    type: "kanji",
    reading: "こう",
    word_example: "工（こう）さく",
    explanation: "よこ画・たて画・よこ画の三画。すべて終わりを止めます。",
    point: "上のよこ画より下のよこ画を長くし、たて画を中心に通します。",
    strokes: [
      {
        order: 1,
        name: "上のよこ画",
        ending: "tome",
        hint: "やや短めに。終わりで筆を押さえて止めます。",
        path: [{ x: 72, y: 104 }, { x: 330, y: 98 }]
      },
      {
        order: 2,
        name: "中のたて画",
        ending: "tome",
        hint: "字の中心をまっすぐ下ろして止めます。",
        path: [{ x: 200, y: 102 }, { x: 200, y: 300 }]
      },
      {
        order: 3,
        name: "下のよこ画",
        ending: "tome",
        hint: "上の画より長く。字を下から支えます。",
        path: [{ x: 56, y: 308 }, { x: 200, y: 300 }, { x: 344, y: 306 }]
      }
    ]
  },
  {
    id: "102",
    char: "牛",
    type: "kanji",
    reading: "うし",
    word_example: "牛（うし）にゅう",
    explanation: "短いはらい・よこ画二本・たて画の四画です。",
    point: "二本目より三本目のよこ画を長くし、たて画でつらぬきます。",
    strokes: [
      {
        order: 1,
        name: "みじかいはらい",
        ending: "harai",
        hint: "左下へ短く、力をぬいて払います。",
        path: [{ x: 156, y: 68 }, { x: 112, y: 128 }]
      },
      {
        order: 2,
        name: "上のよこ画",
        ending: "tome",
        hint: "短めに書いて止めます。",
        path: [{ x: 120, y: 146 }, { x: 288, y: 138 }]
      },
      {
        order: 3,
        name: "下のよこ画",
        ending: "tome",
        hint: "いちばん長い画。のびのびと運んで止めます。",
        path: [{ x: 58, y: 236 }, { x: 200, y: 228 }, { x: 342, y: 234 }]
      },
      {
        order: 4,
        name: "たて画",
        ending: "tome",
        hint: "二本のよこ画をつらぬき、下で止めます。",
        path: [{ x: 198, y: 100 }, { x: 198, y: 352 }]
      }
    ]
  },
  {
    id: "103",
    char: "刀",
    type: "kanji",
    reading: "かたな",
    word_example: "刀（かたな）",
    explanation: "おれて下り、最後に左上へはね上げます。",
    point: "おれるところを角にして、終わりのはねを小さくても出します。",
    strokes: [
      {
        order: 1,
        name: "おれてはねる画",
        ending: "hane",
        hint: "下まで下りたら、筆先を左上へはね上げます。",
        path: [
          { x: 84, y: 110 }, { x: 170, y: 102 }, { x: 244, y: 104 },
          { x: 254, y: 216 }, { x: 228, y: 296 }, { x: 180, y: 318 }
        ]
      },
      {
        order: 2,
        name: "左のはらい",
        ending: "harai",
        hint: "よこ画の下から左下へ、細くして払います。",
        path: [{ x: 136, y: 108 }, { x: 108, y: 214 }, { x: 64, y: 334 }]
      }
    ]
  },
  {
    id: "104",
    char: "心",
    type: "kanji",
    reading: "こころ",
    word_example: "心（こころ）",
    explanation: "点三つと、大きくそって右上へはねる画でできています。",
    point: "そる画を広くとり、三つの点をちょうどよい間かくに置きます。",
    strokes: [
      {
        order: 1,
        name: "左の点",
        ending: "tome",
        hint: "右下へ向けて置き、終わりを止めます。",
        path: [{ x: 84, y: 140 }, { x: 108, y: 192 }]
      },
      {
        order: 2,
        name: "そってはねる画",
        ending: "hane",
        hint: "下で大きくそらせ、最後に右上へはね上げます。",
        path: [
          { x: 150, y: 122 }, { x: 140, y: 226 }, { x: 186, y: 296 },
          { x: 268, y: 308 }, { x: 322, y: 266 }
        ]
      },
      {
        order: 3,
        name: "中の点",
        ending: "tome",
        hint: "左下へ短く置いて止めます。",
        path: [{ x: 216, y: 118 }, { x: 196, y: 182 }]
      },
      {
        order: 4,
        name: "右の点",
        ending: "tome",
        hint: "三つの点のいちばん上。左下へ向けて止めます。",
        path: [{ x: 304, y: 100 }, { x: 278, y: 166 }]
      }
    ]
  },
  {
    id: "105",
    char: "太",
    type: "kanji",
    reading: "た",
    word_example: "太（ふと）い",
    explanation: "「大」に点を加えた字です。",
    point: "よこ画を長くとり、二本のはらいをつり合わせます。",
    strokes: [
      {
        order: 1,
        name: "よこ画",
        ending: "tome",
        hint: "少し右上がりに運び、終わりで止めます。",
        path: [{ x: 56, y: 128 }, { x: 200, y: 120 }, { x: 344, y: 126 }]
      },
      {
        order: 2,
        name: "左のはらい",
        ending: "harai",
        hint: "中心から左下へ、だんだん細くして払います。",
        path: [{ x: 208, y: 56 }, { x: 150, y: 194 }, { x: 66, y: 330 }]
      },
      {
        order: 3,
        name: "右のはらい",
        ending: "harai",
        hint: "左のはらいと同じ長さをめざして右下へ払います。",
        path: [{ x: 176, y: 176 }, { x: 250, y: 252 }, { x: 328, y: 330 }]
      },
      {
        order: 4,
        name: "下の点",
        ending: "tome",
        hint: "左下へ向けて置き、しっかり止めます。",
        path: [{ x: 168, y: 250 }, { x: 140, y: 318 }]
      }
    ]
  },
  {
    id: "106",
    char: "方",
    type: "kanji",
    reading: "ほう",
    word_example: "方（ほう）こう",
    explanation: "点・よこ画・おれてはねる画・はらいの四画です。",
    point: "おれる画のはねと、左のはらいをどちらもはっきり出します。",
    strokes: [
      {
        order: 1,
        name: "上の点",
        ending: "harai",
        hint: "左下へ短く払います。",
        path: [{ x: 142, y: 66 }, { x: 110, y: 122 }]
      },
      {
        order: 2,
        name: "よこ画",
        ending: "tome",
        hint: "長く運んで、終わりで止めます。",
        path: [{ x: 60, y: 156 }, { x: 200, y: 148 }, { x: 340, y: 152 }]
      },
      {
        order: 3,
        name: "おれてはねる画",
        ending: "hane",
        hint: "右で折って下り、最後に左上へはね上げます。",
        path: [
          { x: 176, y: 154 }, { x: 284, y: 150 }, { x: 290, y: 248 },
          { x: 262, y: 316 }, { x: 214, y: 334 }
        ]
      },
      {
        order: 4,
        name: "左のはらい",
        ending: "harai",
        hint: "よこ画の下から左下へ、細くして払います。",
        path: [{ x: 152, y: 156 }, { x: 110, y: 252 }, { x: 64, y: 344 }]
      }
    ]
  },
  {
    id: "107",
    char: "弓",
    type: "kanji",
    reading: "ゆみ",
    word_example: "弓（ゆみ）や",
    explanation: "おれる画を三段かさねます。最後の画ははねます。",
    point: "三段の高さをそろえ、たての線を一本にそろえます。",
    strokes: [
      {
        order: 1,
        name: "上のおれる画",
        ending: "tome",
        hint: "よこに進んで折り、少し下げて止めます。",
        path: [{ x: 96, y: 88 }, { x: 272, y: 82 }, { x: 256, y: 152 }]
      },
      {
        order: 2,
        name: "中のよこ画",
        ending: "tome",
        hint: "短く水平に運んで止めます。",
        path: [{ x: 104, y: 160 }, { x: 262, y: 154 }]
      },
      {
        order: 3,
        name: "おれてはねる画",
        ending: "hane",
        hint: "下まで回したら、左上へはね上げます。",
        path: [
          { x: 96, y: 232 }, { x: 266, y: 226 }, { x: 248, y: 302 },
          { x: 172, y: 334 }, { x: 106, y: 312 }
        ]
      }
    ]
  },
  {
    id: "108",
    char: "毛",
    type: "kanji",
    reading: "け",
    word_example: "毛（け）ひつ",
    explanation: "はらい・よこ画二本・まがってはねる画の四画です。",
    point: "最後の画で大きくまがり、右上へはね上げます。",
    strokes: [
      {
        order: 1,
        name: "みじかいはらい",
        ending: "harai",
        hint: "左下へ短く、力をぬいて払います。",
        path: [{ x: 211, y: 54 }, { x: 70, y: 117 }]
      },
      {
        order: 2,
        name: "上のよこ画",
        ending: "tome",
        hint: "短めに運んで止めます。",
        path: [{ x: 63, y: 176 }, { x: 242, y: 164 }]
      },
      {
        order: 3,
        name: "下のよこ画",
        ending: "tome",
        hint: "上の画より長く運んで止めます。",
        path: [{ x: 54, y: 255 }, { x: 255, y: 233 }]
      },
      {
        order: 4,
        name: "まがってはねる画",
        ending: "hane",
        hint: "下でゆるやかに右へまがり、最後に上へはねます。",
        path: [
          { x: 190, y: 44 }, { x: 180, y: 200 }, { x: 173, y: 313 },
          { x: 200, y: 356 }, { x: 240, y: 352 }, { x: 311, y: 281 },
          { x: 368, y: 239 }
        ]
      }
    ]
  }
];

window.GRADE_META = {
  grade: 2,
  title: "2年生",
  kanji_count: 160,
  hiragana_count: 0,
  total: 160
};
