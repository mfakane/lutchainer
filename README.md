# LUT Chainer - LUT Chaining Shader Editor

ブラウザで動作する、LUTベースのステップチェーン型シェーダエディタです。
複数のLUTとブレンドモードを段階的に組み合わせ、3Dプレビューを見ながら見た目を調整できます。

## 主な機能

- LUT Step Chain の編集
	- Step追加/削除/並び替え
	- LUT追加/削除/並び替え
	- 各Stepの Blend Mode、X/Y入力パラメータ、チャンネル演算（customRgb/customHsv）設定
- リアルタイム3Dプレビュー
	- Shape切り替え: Sphere / Cube / Torus
	- マウスドラッグで回転、ホイールでズーム
	- ライト方向ガイドと軸ギズモ表示
- Material / Light パラメータ調整
	- Base Color, Ambient, Diffuse, Specular, Spec Power, Fresnel, Fresnel Power
	- Light Azimuth / Elevation、ガイドON/OFF
- 生成コード表示
	- GLSL Fragment / GLSL Vertex / HLSL のタブ切り替え
	- クリップボードコピー
- パイプラインの保存・読み込み
	- `.lutchain` 形式（ZIP）でエクスポート/インポート
	- LUT画像を PNG ファイルとして ZIP 内に埋め込み
	- レガシー JSON ファイルの読み込みにも対応
- 操作履歴（Undo/Redo）

## UI構成

- 左パネル
	- Parameters: 接続元パラメータノード
	- Step List: 各Step設定とプレビュー
	- LUT Library: LUT画像管理
- 右パネル
	- 3D Preview
	- Material / Light 設定
	- Generated Shader ダイアログ

## セットアップ

### Nix Flakes を使う場合（推奨）

```bash
# 開発シェルに入る
nix develop

# 依存インストール + ビルド
npm install
npm run build
```

### Node.js がある環境

```bash
npm install
npm run build
```

## 起動

ビルド後、`index.html` をブラウザで直接開くだけで動作します（サーバ不要）。

### ローカルサーバで配信

```bash
# 事前に npm run build を実行
npm run serve
# http://localhost:8000
```

### Nixで起動（ビルド成果物を配信）

```bash
nix run
# http://localhost:8000
```

### Nixで成果物だけ生成

```bash
nix build
# result/ に index.html と dist/ が出力される
```

## 使い方の流れ

1. LUT Library で LUT 画像を追加
2. Step を追加し、各Stepの LUT / Blend Mode / X,Y パラメータを設定
3. 必要に応じて customRgb / customHsv の各チャンネル演算を設定
4. 自動反映ONなら変更が自動で適用、OFFなら「適用」ボタンで手動適用
5. 「コードを開く」で GLSL/HLSL を確認・コピー
6. 「保存」で `.lutchain` ファイルとしてエクスポート

### キーボードショートカット

| ショートカット | 動作 |
|--------------|------|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo |
| `Ctrl+Y` / `Cmd+Y` | Redo（代替） |

## 制限値

- 最大Step数: 32
- 最大LUT数: 12
- LUT画像ファイルサイズ上限: 12MB/枚
- パイプラインJSON上限: 64MB
- 読み込み可能なLUT画像最大辺: 4096px

## 開発

```bash
npm run dev
```

`src/main.ts` を変更すると `dist/bundle.js` が再生成されます。

型チェックのみ実行する場合:

```bash
npx tsc --noEmit
```

## Nixメモ

`package-lock.json` を更新した場合は `flake.nix` の `npmDepsHash` を再生成してください。

```bash
nix run nixpkgs#prefetch-npm-deps -- package-lock.json
```
