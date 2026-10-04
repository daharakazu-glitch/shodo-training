# 書道トレーニング（ShodoTraining）

小学生向けの書道学習Webアプリです。ひらがな・漢字をペンでなぞって、自動採点される練習アプリです。

## 機能

- **Canvas ペントレース**: マウスやタッチペンでなぞる練習
- **自動採点**: 字形と筆画順序を比較して 100 点満点で採点
- **進捗管理**: localStorage で学習履歴を自動保存（ログイン不要）
- **段階的フィードバック**: スコアに応じて励ましメッセージを表示

## 対象

- 小学1～6年生
- 教室での一斉学習、または家庭学習での利用

## 技術スタック

- HTML5 + CSS3
- Vanilla JavaScript（フレームワーク不要）
- Canvas API（描画・採点）
- localStorage（進捗管理）
- GitHub Pages（静的ホスティング）

## ファイル構成

```
shodo-training/
├── index.html                 # ダッシュボード
├── lesson-01.html            # 1年レッスン
├── lesson-02.html            # 2年レッスン
├── css/style.css             # スタイル
├── js/
│   ├── storage.js            # 進捗管理
│   ├── dashboard.js          # ダッシュボード
│   ├── lesson.js             # レッスン制御
│   ├── scorer.js             # 採点エンジン
│   └── feedback.js           # フィードバック
├── data/
│   ├── grade01.js            # 1年文字データ
│   ├── grade02.js            # 2年文字データ
│   └── strokes-db.js         # 筆画座標DB
└── assets/                   # 画像・音声
```

## 使い方

1. `index.html` をブラウザで開く
2. 学年を選択
3. 文字をなぞる
4. 採点結果を確認

## 開発

### 必要な環境
- テキストエディタ（VS Code 推奨）
- Git
- GitHub CLI（デプロイ時）

### ローカルテスト
```bash
# 簡易 HTTP サーバー（Node.js）
npx http-server

# または Python
python3 -m http.server
```

### デプロイ
```bash
git add .
git commit -m "メッセージ"
git push origin main
# GitHub Pages が自動ビルド・デプロイ
```

## チーム

- **蒼司（PM）**: プロジェクト管理
- **詠（教材）**: 学習コンテンツ設計
- **彩（UX/UI）**: デザイン・CSS
- **匠（エンジニア）**: 実装
- **澄（QA）**: テスト・品質保証

## ライセンス

© 2026 AIチーム
