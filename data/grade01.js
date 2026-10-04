/*
 * 1年配当文字データ（毛筆版）
 * 設計: 英語教材デザイナー 詠(Ei)
 *
 * 毛筆の学習に合わせ、各画に「とめ・はね・はらい」を定義する。
 *   ending: "tome"（とめ）/ "hane"（はね）/ "harai"（はらい）/ "none"（評価しない）
 *   path  : 書き順アニメーションがたどる座標列（0〜400 の正方形）
 *   hint  : その画で気をつけること（生徒に見せる言葉）
 *
 * 書き順は文部科学省「小学校学習指導要領」の筆順に従う。
 * 写真では書いた順序は分からないため、書き順は採点せずアニメーションで教える。
 */

window.GRADE_DATA = [
  /* === ひらがな（毛筆のとめ・はね・はらいが分かりやすい字） === */
  {
    id: "001",
    char: "し",
    type: "hiragana",
    reading: "し",
    word_example: "しろ（白）",
    explanation: "たて長に下りて、最後に筆先を上へはね上げます。",
    point: "下までまっすぐ下りてから、ゆっくり曲げてはねます。",
    strokes: [
      {
        order: 1,
        name: "たての画",
        ending: "hane",
        hint: "下で急に曲げず、やわらかく回してから上へはねます。",
        path: [
          { x: 160, y: 72 }, { x: 150, y: 150 }, { x: 140, y: 228 },
          { x: 142, y: 280 }, { x: 178, y: 320 }, { x: 250, y: 326 },
          { x: 330, y: 292 }
        ]
      }
    ]
  },
  {
    id: "002",
    char: "つ",
    type: "hiragana",
    reading: "つ",
    word_example: "つき（月）",
    explanation: "よこに進んで大きく回し、左下へすうっと払います。",
    point: "まるく広く回してから、だんだん細くして払います。",
    strokes: [
      {
        order: 1,
        name: "まわる画",
        ending: "harai",
        hint: "終わりで力をぬいて、筆先を細くしていきます。",
        path: [
          { x: 78, y: 124 }, { x: 180, y: 112 }, { x: 280, y: 122 },
          { x: 330, y: 170 }, { x: 316, y: 232 }, { x: 240, y: 276 },
          { x: 130, y: 288 }
        ]
      }
    ]
  },
  {
    id: "003",
    char: "く",
    type: "hiragana",
    reading: "く",
    word_example: "くち（口）",
    explanation: "左下へ向かって折れ、右下へ払います。",
    point: "折れるところをとがらせすぎず、ふっくら曲げます。",
    strokes: [
      {
        order: 1,
        name: "おれる画",
        ending: "harai",
        hint: "折れたあと、力をぬきながら右下へ払います。",
        path: [
          { x: 250, y: 76 }, { x: 186, y: 150 }, { x: 156, y: 200 },
          { x: 212, y: 262 }, { x: 252, y: 322 }
        ]
      }
    ]
  },

  /* === 漢字 === */
  {
    id: "011",
    char: "一",
    type: "kanji",
    reading: "いち",
    word_example: "一ねんせい（一年生）",
    explanation: "よこ画が一本だけの字です。毛筆のきほんになります。",
    point: "筆を置く・運ぶ・止める、の三つをはっきりさせます。",
    strokes: [
      {
        order: 1,
        name: "よこ画",
        ending: "tome",
        hint: "終わりで筆を止め、少し押さえてから静かに離します。",
        path: [{ x: 62, y: 206 }, { x: 200, y: 196 }, { x: 338, y: 204 }]
      }
    ]
  },
  {
    id: "012",
    char: "二",
    type: "kanji",
    reading: "に",
    word_example: "二ほん（二本）",
    explanation: "よこ画が二本。上を短く、下を長く書きます。",
    point: "二本の間の余白をそろえ、どちらも終わりを止めます。",
    strokes: [
      {
        order: 1,
        name: "上のよこ画",
        ending: "tome",
        hint: "短めに書いて、終わりをきちんと止めます。",
        path: [{ x: 104, y: 142 }, { x: 300, y: 134 }]
      },
      {
        order: 2,
        name: "下のよこ画",
        ending: "tome",
        hint: "上の画より長く。終わりで止めます。",
        path: [{ x: 70, y: 272 }, { x: 200, y: 264 }, { x: 330, y: 270 }]
      }
    ]
  },
  {
    id: "013",
    char: "十",
    type: "kanji",
    reading: "じゅう",
    word_example: "十さい（十才）",
    explanation: "よこ画とたて画が中心で交わります。",
    point: "交わるところを字の真ん中にそろえます。",
    strokes: [
      {
        order: 1,
        name: "よこ画",
        ending: "tome",
        hint: "水平よりほんの少し右上がりに運び、止めます。",
        path: [{ x: 58, y: 172 }, { x: 200, y: 164 }, { x: 342, y: 170 }]
      },
      {
        order: 2,
        name: "たて画",
        ending: "tome",
        hint: "まっすぐ下ろして、下で止めます。",
        path: [{ x: 200, y: 52 }, { x: 200, y: 350 }]
      }
    ]
  },
  {
    id: "014",
    char: "人",
    type: "kanji",
    reading: "ひと",
    word_example: "人（ひと）",
    explanation: "左へのはらいと右へのはらい、二本のはらいでできています。",
    point: "二本のはらいを、同じ長さ・同じ勢いにそろえます。",
    strokes: [
      {
        order: 1,
        name: "左のはらい",
        ending: "harai",
        hint: "だんだん力をぬいて、左下へすうっと細くします。",
        path: [{ x: 202, y: 68 }, { x: 150, y: 184 }, { x: 78, y: 330 }]
      },
      {
        order: 2,
        name: "右のはらい",
        ending: "harai",
        hint: "いちど沈めてから、右下へ力をぬいて払います。",
        path: [{ x: 196, y: 140 }, { x: 262, y: 240 }, { x: 332, y: 338 }]
      }
    ]
  },
  {
    id: "015",
    char: "大",
    type: "kanji",
    reading: "おお",
    word_example: "大きい（おおきい）",
    explanation: "よこ画・左はらい・右はらいの三画です。",
    point: "よこ画をのびのびと長く、二本のはらいで大きく広げます。",
    strokes: [
      {
        order: 1,
        name: "よこ画",
        ending: "tome",
        hint: "いちばん長い画です。終わりを止めます。",
        path: [{ x: 54, y: 138 }, { x: 200, y: 130 }, { x: 346, y: 136 }]
      },
      {
        order: 2,
        name: "左のはらい",
        ending: "harai",
        hint: "中心から左下へ、細くなるように払います。",
        path: [{ x: 206, y: 62 }, { x: 150, y: 202 }, { x: 66, y: 340 }]
      },
      {
        order: 3,
        name: "右のはらい",
        ending: "harai",
        hint: "左のはらいと同じくらいの長さで、右下へ払います。",
        path: [{ x: 176, y: 186 }, { x: 252, y: 262 }, { x: 330, y: 340 }]
      }
    ]
  },
  {
    id: "016",
    char: "小",
    type: "kanji",
    reading: "しょう",
    word_example: "小さい（ちいさい）",
    explanation: "中心のたて画と、左右の点でできています。",
    point: "たて画を真ん中に、左右の点を同じ高さからはじめます。",
    strokes: [
      {
        order: 1,
        name: "中のたて画",
        ending: "tome",
        hint: "まっすぐ下ろして、下で止めます。",
        path: [{ x: 200, y: 72 }, { x: 200, y: 322 }]
      },
      {
        order: 2,
        name: "左の点",
        ending: "harai",
        hint: "左下へ短く払います。",
        path: [{ x: 104, y: 140 }, { x: 82, y: 244 }]
      },
      {
        order: 3,
        name: "右の点",
        ending: "tome",
        hint: "右下へ向けて置き、終わりを止めます。",
        path: [{ x: 298, y: 140 }, { x: 320, y: 248 }]
      }
    ]
  },
  {
    id: "017",
    char: "川",
    type: "kanji",
    reading: "かわ",
    word_example: "川（かわ）",
    explanation: "三本のたて画。左はらい、中と右はたて画です。",
    point: "三本の間の余白を同じ広さにそろえます。",
    strokes: [
      {
        order: 1,
        name: "左のはらい",
        ending: "harai",
        hint: "やや内側へ曲げながら、左下へ払います。",
        path: [{ x: 86, y: 68 }, { x: 66, y: 200 }, { x: 52, y: 322 }]
      },
      {
        order: 2,
        name: "中のたて画",
        ending: "tome",
        hint: "三本のうちいちばん短く。下で止めます。",
        path: [{ x: 200, y: 112 }, { x: 200, y: 318 }]
      },
      {
        order: 3,
        name: "右のたて画",
        ending: "tome",
        hint: "いちばん長く下ろして、下で止めます。",
        path: [{ x: 320, y: 80 }, { x: 322, y: 348 }]
      }
    ]
  },
  {
    id: "018",
    char: "木",
    type: "kanji",
    reading: "き",
    word_example: "木（き）",
    explanation: "よこ画・たて画・左はらい・右はらいの四画です。",
    point: "たて画を中心にまっすぐ。左右のはらいを対にそろえます。",
    strokes: [
      {
        order: 1,
        name: "よこ画",
        ending: "tome",
        hint: "少し右上がりに運び、終わりで止めます。",
        path: [{ x: 56, y: 152 }, { x: 200, y: 144 }, { x: 344, y: 150 }]
      },
      {
        order: 2,
        name: "たて画",
        ending: "tome",
        hint: "字の中心をまっすぐ通し、下で止めます。",
        path: [{ x: 200, y: 56 }, { x: 200, y: 354 }]
      },
      {
        order: 3,
        name: "左のはらい",
        ending: "harai",
        hint: "交わったところから左下へ、細くして払います。",
        path: [{ x: 194, y: 154 }, { x: 130, y: 232 }, { x: 66, y: 320 }]
      },
      {
        order: 4,
        name: "右のはらい",
        ending: "harai",
        hint: "左のはらいとつり合うように、右下へ払います。",
        path: [{ x: 206, y: 154 }, { x: 270, y: 230 }, { x: 334, y: 316 }]
      }
    ]
  },
  {
    id: "019",
    char: "力",
    type: "kanji",
    reading: "ちから",
    word_example: "力（ちから）",
    explanation: "よこから折れて下り、最後に左上へはね上げます。",
    point: "折れるところを角にして、終わりのはねをはっきり出します。",
    strokes: [
      {
        order: 1,
        name: "おれてはねる画",
        ending: "hane",
        hint: "下まで下りたら、筆先を左上へ短くはね上げます。",
        path: [
          { x: 76, y: 112 }, { x: 170, y: 104 }, { x: 250, y: 106 },
          { x: 262, y: 218 }, { x: 236, y: 300 }, { x: 186, y: 322 }
        ]
      },
      {
        order: 2,
        name: "左のはらい",
        ending: "harai",
        hint: "よこ画の下から左下へ、力をぬいて払います。",
        path: [{ x: 228, y: 108 }, { x: 158, y: 232 }, { x: 86, y: 344 }]
      }
    ]
  },
  {
    id: "020",
    char: "上",
    type: "kanji",
    reading: "うえ",
    word_example: "上（うえ）",
    explanation: "たて画・短いよこ画・長いよこ画の三画です。",
    point: "三つの画すべてで、終わりをしっかり止めます。",
    strokes: [
      {
        order: 1,
        name: "たて画",
        ending: "tome",
        hint: "中心にまっすぐ下ろして止めます。",
        path: [{ x: 178, y: 86 }, { x: 178, y: 272 }]
      },
      {
        order: 2,
        name: "短いよこ画",
        ending: "tome",
        hint: "たて画から右へ短く出して止めます。",
        path: [{ x: 178, y: 196 }, { x: 288, y: 190 }]
      },
      {
        order: 3,
        name: "長いよこ画",
        ending: "tome",
        hint: "いちばん長い画。字を下から支えるように止めます。",
        path: [{ x: 62, y: 282 }, { x: 200, y: 274 }, { x: 340, y: 282 }]
      }
    ]
  }
];

window.GRADE_META = {
  grade: 1,
  title: "1年生",
  kanji_count: 80,
  hiragana_count: 46,
  total: 126
};
