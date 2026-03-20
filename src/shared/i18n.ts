import { createSignal, onCleanup, type Accessor } from 'solid-js';

export type Language = 'ja' | 'en';

type TemplateValue = string | number;
type TemplateValues = Record<string, TemplateValue>;
type LanguageChangeListener = (language: Language) => void;

type TranslationMap = Record<string, string>;

const STORAGE_KEY = 'lutchainer.language';
const SUPPORTED_LANGUAGES: Language[] = ['ja', 'en'];

const LANGUAGE_LABELS: Record<Language, string> = {
  ja: '日本語',
  en: 'English',
};

const TRANSLATIONS: Record<Language, TranslationMap> = {
  ja: {
    'common.unknownError': '不明なエラー',
    'common.on': 'ON',
    'common.off': 'OFF',

    'language.switchAria': '{language} に切り替える',

    'header.reset': '初期化',
    'header.undo': '元に戻す',
    'header.redo': 'やり直す',
    'header.undoAria': '元に戻す (Ctrl+Z / Cmd+Z)',
    'header.redoAria': 'やり直す (Ctrl+Shift+Z / Ctrl+Y)',
    'header.load': '読み込み',
    'header.save': '保存',
    'header.autoApply': '自動反映',
    'header.apply': '適用',
    'header.openCode': 'コードを開く',
    'header.switchLanguage': '言語: {language}',
    'header.languageGroupAria': '表示言語',
    'header.status.missingPipelineFileInput': 'パイプライン読込用の入力要素が見つかりません。',
    'header.status.pipelineSaveFailed': 'パイプライン保存に失敗しました: {message}',
    'header.status.pipelineInputMissing': 'パイプライン入力要素の取得に失敗しました。',
    'header.status.invalidSelectedFile': '読み込み対象ファイルが不正です。',
    'header.status.emptyFile': '空のファイルは読み込めません。',
    'header.status.pipelineLoadFailed': 'パイプライン読み込みに失敗しました: {message}',
    'header.status.autoApplyCheckboxMissing': '自動反映チェックボックスの取得に失敗しました。',
    'header.status.autoApplyCheckboxInvalid': '自動反映チェック状態が不正です。',
    'header.status.invalidAutoApplySyncValue': '自動反映の同期値が不正です: {value}',
    'header.status.invalidHistorySyncValue': 'Undo/Redo状態の同期値が不正です: {value}',
    'header.status.invalidAutoApplyInputValue': '自動反映の入力値が不正です: {value}',
    'header.status.invalidAutoApplySyncArg': '自動反映同期の引数が不正です: {value}',
    'header.status.invalidHistorySyncArg': 'Undo/Redo同期の引数が不正です: {value}',
    'header.status.invalidLanguageSelection': '言語選択値が不正です: {value}',
    'header.status.languageChanged': '表示言語を {language} に切り替えました。',

    'static.pipelineHelp': '左ノードを選択して、各StepのX/Yソケットへ接続',
    'static.previewHelp': 'ドラッグ: 回転 / ホイール: ズーム',
    'static.previewResizerAria': '3Dプレビュー表示の高さを調整',

    'pipeline.paramGroup.lightingDerivedDesc': 'ライティングや視線から計算される値',
    'pipeline.paramGroup.feedbackRgbDesc': '前回stepの色をそのまま参照するフィードバック入力',
    'pipeline.paramGroup.feedbackHsvDesc': '前回stepの色をHSV変換して参照するフィードバック入力',
    'pipeline.paramGroup.uvDesc': 'メッシュのUV座標',
    'pipeline.paramGroup.prevColorBadge': 'Prev Color',
    'pipeline.param.connectTitle': '{label} を接続',
    'pipeline.status.suppressClickFailed': 'クリック抑止判定に失敗しました。',
    'pipeline.step.empty': 'Stepがありません。下のStep追加ボタンで作成できます。',
    'pipeline.step.dragMove': 'Stepをドラッグして移動',
    'pipeline.step.remove': '削除',
    'pipeline.step.mute': 'Mute',
    'pipeline.step.unmute': 'Unmute',
    'pipeline.step.duplicate': '複製',
    'pipeline.step.titleAria': 'Step {index} のラベル',
    'pipeline.step.add': 'Step追加',
    'pipeline.step.blendMode': 'Blend Mode',
    'pipeline.step.previewAria': 'Step {index} sphere preview',
    'pipeline.status.stepLutSelectMissing': 'Step LUT セレクトの取得に失敗しました。',
    'pipeline.status.selectedLutIdInvalid': '選択されたLUT IDが不正です。',
    'pipeline.status.selectedLutMissing': '選択されたLUTが見つかりません。',
    'pipeline.status.blendModeSelectMissing': 'Blend Mode セレクトの取得に失敗しました。',
    'pipeline.status.invalidBlendMode': '不正なブレンドモードです: {blendMode}',
    'pipeline.status.stepOpSelectMissing': 'Step演算セレクトの取得に失敗しました。',
    'pipeline.status.invalidOp': '不正な演算です: {op}',
    'pipeline.status.stepLabelInputMissing': 'Stepラベル入力要素の取得に失敗しました。',
    'pipeline.status.stepLabelInvalidValue': 'Stepラベルの値が不正です。',
    'pipeline.status.stepLabelTooLong': 'Stepラベルは最大 {max} 文字です。',
    'pipeline.lut.invalidId': '不正なLUT IDです。',
    'pipeline.lut.empty': 'LUT がありません。LUT追加で読み込んでください。',
    'pipeline.lut.stats': '{width}x{height} / 使用 {count} step',
    'pipeline.lut.removeAria': '{name} を削除',
    'pipeline.lut.add': 'LUT追加',
    'pipeline.lut.fileInputMissing': 'LUTファイル入力要素が見つかりません。',
    'pipeline.lut.fileInputFetchFailed': 'LUTファイル入力要素の取得に失敗しました。',
    'pipeline.lut.fileInputInvalidValue': 'LUTファイル入力に不正な値が含まれています。',
    'pipeline.lut.addFailed': 'LUT追加処理に失敗しました: {message}',

    'panel.materialHelp': 'カラーとライティング係数',
    'panel.lightHelp': 'ライト方向と色、環境光の設定',
    'panel.materialPreset': 'Material Preset',
    'panel.lightPreset': 'Light Preset',
    'panel.presetsMenu': 'Presets',
    'panel.preset.default': 'Default',
    'panel.preset.material.matteClay': 'Matte Clay',
    'panel.preset.material.glossMetal': 'Gloss Metal',
    'panel.preset.material.neonLacquer': 'Neon Lacquer',
    'panel.preset.light.studioFront': 'Studio Front',
    'panel.preset.light.rimSide': 'Rim Side',
    'panel.preset.light.topDown': 'Top Down',
    'panel.guide': 'ガイド',
    'panel.baseColorInputMissing': 'Base Color 入力要素の取得に失敗しました。',
    'panel.baseColorInvalid': 'Base Color の値が不正です。',
    'panel.lightColorInputMissing': 'Light Color 入力要素の取得に失敗しました。',
    'panel.lightColorInvalid': 'Light Color の値が不正です。',
    'panel.ambientColorInputMissing': 'Ambient Color 入力要素の取得に失敗しました。',
    'panel.ambientColorInvalid': 'Ambient Color の値が不正です。',
    'panel.rangeInputMissing': '{label} 入力要素の取得に失敗しました。',
    'panel.rangeInvalid': '{label} の値が不正です。',
    'panel.status.materialPresetSelectMissing': 'Material Preset セレクト要素の取得に失敗しました。',
    'panel.status.materialPresetInvalidValue': 'Material Preset の値が不正です: {value}',
    'panel.status.materialPresetApplied': 'Material Preset を適用しました: {name}',
    'panel.status.lightPresetSelectMissing': 'Light Preset セレクト要素の取得に失敗しました。',
    'panel.status.lightPresetInvalidValue': 'Light Preset の値が不正です: {value}',
    'panel.status.lightPresetApplied': 'Light Preset を適用しました: {name}',
    'panel.status.materialSyncInvalid': 'Material 設定の同期値が不正です。',
    'panel.status.materialUpdateInvalid': 'Material 設定の更新値が不正です。',
    'panel.status.lightSyncInvalid': 'Light 設定の同期値が不正です。',
    'panel.status.lightUpdateInvalid': 'Light 設定の更新値が不正です。',
    'panel.status.materialSyncFailed': 'Material 設定の同期に失敗しました。',
    'panel.status.lightSyncFailed': 'Light 設定の同期に失敗しました。',

    'preview.shapeLabel': 'Shape',
    'preview.menuLabel': 'Preview Menu',
    'preview.menuPlaceholder': '操作を選択...',
    'preview.menuButtonAria': 'プレビュー操作メニューを開く',
    'preview.menuWireframeToggle': 'ワイヤーフレーム切替 ({state})',
    'preview.menuExportMainPng': '3DプレビューをPNGで保存',
    'preview.menuExportStepPng': '最終StepプレビューをPNGで保存',
    'preview.status.invalidSyncValue': 'Shapeバーの同期値が不正です: {value}',
    'preview.status.invalidSelectedShape': 'Shape選択値が不正です: {value}',
    'preview.status.invalidSyncArg': 'Shapeバー同期の引数が不正です: {value}',
    'preview.status.invalidWireframeSyncValue': 'Wireframe同期値が不正です: {value}',
    'preview.status.invalidMenuAction': 'Previewメニュー値が不正です: {value}',
    'preview.status.menuActionFailed': 'Previewメニュー操作に失敗しました: {message}',
    'preview.status.invalidWireframeSyncArg': 'Wireframe同期の引数が不正です: {value}',

    'shader.help': '現在のstep構成から生成されたシェーダコード',
    'shader.tabsAria': 'Shader source selector',
    'shader.copy': 'コピー',
    'shader.close': '閉じる',
    'shader.closeAria': 'シェーダコードダイアログを閉じる',
    'shader.meta': '{stage} shader / {lines} 行',
    'shader.status.clipboardUnavailable': 'Clipboard API が利用できません。',
    'shader.status.copySuccess': '{stage} shader をコピーしました。',
    'shader.status.copyFailed': 'シェーダコードのコピーに失敗しました。',

    'main.status.pipelineLoadedApplying': 'パイプラインを読み込みました。適用しています...',
    'main.status.stepPreviewNotInitialized': 'Stepプレビューシステムが初期化されていません。',
    'main.status.stepPreviewCpuMode': 'Stepプレビュー CPU優先モード: {state}',
    'main.status.stepPreviewWebglDrawFailed': 'Stepプレビュー(WebGL) の描画に失敗しました: {message}',
    'main.status.previewExportRendererMissing': '3Dプレビューのレンダラが初期化されていません。',
    'main.status.previewExportBytesInvalid': 'Stepプレビュー画像の生成結果が不正です。',
    'main.status.previewExportBusy': '3DプレビューPNG保存を処理中です。少し待ってから再試行してください。',
    'main.status.previewExportCaptureTimeout': '3Dプレビューのキャプチャがタイムアウトしました。',
    'main.status.previewExportMainSaved': '3DプレビューPNGを保存しました。',
    'main.status.previewExportStepSaved': '最終StepプレビューPNGを保存しました。',
    'main.status.wireframeInvalidValue': 'Wireframe状態の値が不正です: {value}',
    'main.status.wireframeChanged': 'Wireframe表示を {state} に切り替えました。',
    'main.status.stepNotFound': 'Step {stepId} が見つかりません。',
    'main.status.removeStepNotFound': '削除対象の Step {stepId} が見つかりません。',
    'main.status.stepDuplicated': 'Step を複製しました (新規ID: {stepId})。',
    'main.status.stepMuteInvalidValue': 'StepのMute値が不正です: {value}',
    'main.status.undoApplied': '元に戻しました。',
    'main.status.redoApplied': 'やり直しました。',
    'main.status.undoUnavailable': 'これ以上元に戻せません。',
    'main.status.redoUnavailable': 'これ以上やり直せません。',
    'main.status.lutRemoved': 'LUT「{name}」を削除しました。',
    'main.status.socketConnected': 'D&Dでソケットを接続しました。',
    'main.status.moveStepNotFound': '移動対象の Step {stepId} が見つかりません。',
    'main.status.stepOrderUpdated': 'Step の順序を更新しました。',
    'main.status.moveLutNotFound': '移動対象の LUT が見つかりません。',
    'main.status.lutOrderUpdated': 'LUT の順序を更新しました。',
    'main.status.applySuccess': '適用成功: {steps} step / {luts} LUT',
    'main.status.resetStepChain': 'Stepチェーンを初期化しました。',
    'main.status.pipelineIoNotInitialized': 'パイプラインI/Oシステムが初期化されていません。',
    'main.status.pipelineSaved': 'パイプラインを .lutchain ファイルとして保存しました。',
    'main.status.pipelineSaveFailed': 'パイプライン保存に失敗しました: {message}',
    'main.status.pipelineLoadFailed': 'パイプライン読み込みに失敗しました: {message}',
    'main.status.invalidLutAddInput': 'LUT追加入力が不正です。',
    'main.status.maxLutLimit': 'LUT は最大 {max} 枚までです。',
    'main.status.lutAdded': 'LUT を {count} 枚追加しました。',
    'main.status.initialPrompt': 'LUTとStepを編集して「適用」を押してください。',
  },
  en: {
    'common.unknownError': 'Unknown error',
    'common.on': 'ON',
    'common.off': 'OFF',

    'language.switchAria': 'Switch language to {language}',

    'header.reset': 'Reset',
    'header.undo': 'Undo',
    'header.redo': 'Redo',
    'header.undoAria': 'Undo (Ctrl+Z / Cmd+Z)',
    'header.redoAria': 'Redo (Ctrl+Shift+Z / Ctrl+Y)',
    'header.load': 'Load',
    'header.save': 'Save',
    'header.autoApply': 'Auto Apply',
    'header.apply': 'Apply',
    'header.openCode': 'Open Code',
    'header.switchLanguage': 'Language: {language}',
    'header.languageGroupAria': 'Display language',
    'header.status.missingPipelineFileInput': 'Pipeline file input element was not found.',
    'header.status.pipelineSaveFailed': 'Failed to save pipeline: {message}',
    'header.status.pipelineInputMissing': 'Failed to get the pipeline input element.',
    'header.status.invalidSelectedFile': 'The selected file is invalid.',
    'header.status.emptyFile': 'Cannot load an empty file.',
    'header.status.pipelineLoadFailed': 'Failed to load pipeline: {message}',
    'header.status.autoApplyCheckboxMissing': 'Failed to get the auto-apply checkbox.',
    'header.status.autoApplyCheckboxInvalid': 'Auto-apply checkbox state is invalid.',
    'header.status.invalidAutoApplySyncValue': 'Invalid auto-apply sync value: {value}',
    'header.status.invalidHistorySyncValue': 'Invalid undo/redo sync value: {value}',
    'header.status.invalidAutoApplyInputValue': 'Invalid auto-apply input value: {value}',
    'header.status.invalidAutoApplySyncArg': 'Invalid auto-apply sync argument: {value}',
    'header.status.invalidHistorySyncArg': 'Invalid undo/redo sync argument: {value}',
    'header.status.invalidLanguageSelection': 'Invalid language selection value: {value}',
    'header.status.languageChanged': 'Switched display language to {language}.',

    'static.pipelineHelp': 'Select a left node and connect it to each Step X/Y socket',
    'static.previewHelp': 'Drag: Rotate / Wheel: Zoom',
    'static.previewResizerAria': 'Adjust the 3D preview area height',

    'pipeline.paramGroup.lightingDerivedDesc': 'Values derived from lighting and view direction',
    'pipeline.paramGroup.feedbackRgbDesc': 'Feedback input that reuses the previous step RGB values',
    'pipeline.paramGroup.feedbackHsvDesc': 'Feedback input that converts previous step color into HSV',
    'pipeline.paramGroup.uvDesc': 'Mesh UV coordinates',
    'pipeline.paramGroup.prevColorBadge': 'Prev Color',
    'pipeline.param.connectTitle': 'Connect {label}',
    'pipeline.status.suppressClickFailed': 'Failed to evaluate click suppression.',
    'pipeline.step.empty': 'No steps yet. Add one with the button below.',
    'pipeline.step.dragMove': 'Drag to move this step',
    'pipeline.step.remove': 'Remove',
    'pipeline.step.mute': 'Mute',
    'pipeline.step.unmute': 'Unmute',
    'pipeline.step.duplicate': 'Duplicate',
    'pipeline.step.titleAria': 'Label for step {index}',
    'pipeline.step.add': 'Add Step',
    'pipeline.step.blendMode': 'Blend Mode',
    'pipeline.step.previewAria': 'Step {index} sphere preview',
    'pipeline.status.stepLutSelectMissing': 'Failed to get the step LUT select element.',
    'pipeline.status.selectedLutIdInvalid': 'Selected LUT ID is invalid.',
    'pipeline.status.selectedLutMissing': 'Selected LUT was not found.',
    'pipeline.status.blendModeSelectMissing': 'Failed to get the blend mode select element.',
    'pipeline.status.invalidBlendMode': 'Invalid blend mode: {blendMode}',
    'pipeline.status.stepOpSelectMissing': 'Failed to get the step operator select element.',
    'pipeline.status.invalidOp': 'Invalid operator: {op}',
    'pipeline.status.stepLabelInputMissing': 'Failed to get the step label input element.',
    'pipeline.status.stepLabelInvalidValue': 'The step label value is invalid.',
    'pipeline.status.stepLabelTooLong': 'Step labels can have up to {max} characters.',
    'pipeline.lut.invalidId': 'Invalid LUT ID.',
    'pipeline.lut.empty': 'No LUTs yet. Add one to get started.',
    'pipeline.lut.stats': '{width}x{height} / used by {count} step(s)',
    'pipeline.lut.removeAria': 'Remove {name}',
    'pipeline.lut.add': 'Add LUT',
    'pipeline.lut.fileInputMissing': 'LUT file input element was not found.',
    'pipeline.lut.fileInputFetchFailed': 'Failed to get the LUT file input element.',
    'pipeline.lut.fileInputInvalidValue': 'LUT file input contains invalid value(s).',
    'pipeline.lut.addFailed': 'Failed to add LUT(s): {message}',

    'panel.materialHelp': 'Color and lighting factors',
    'panel.lightHelp': 'Adjust light direction, light color, and ambient color',
    'panel.materialPreset': 'Material Preset',
    'panel.lightPreset': 'Light Preset',
    'panel.presetsMenu': 'Presets',
    'panel.preset.default': 'Default',
    'panel.preset.material.matteClay': 'Matte Clay',
    'panel.preset.material.glossMetal': 'Gloss Metal',
    'panel.preset.material.neonLacquer': 'Neon Lacquer',
    'panel.preset.light.studioFront': 'Studio Front',
    'panel.preset.light.rimSide': 'Rim Side',
    'panel.preset.light.topDown': 'Top Down',
    'panel.guide': 'Guide',
    'panel.baseColorInputMissing': 'Failed to get the Base Color input element.',
    'panel.baseColorInvalid': 'Base Color value is invalid.',
    'panel.lightColorInputMissing': 'Failed to get the Light Color input element.',
    'panel.lightColorInvalid': 'Light Color value is invalid.',
    'panel.ambientColorInputMissing': 'Failed to get the Ambient Color input element.',
    'panel.ambientColorInvalid': 'Ambient Color value is invalid.',
    'panel.rangeInputMissing': 'Failed to get the {label} input element.',
    'panel.rangeInvalid': '{label} value is invalid.',
    'panel.status.materialPresetSelectMissing': 'Failed to get the material preset select element.',
    'panel.status.materialPresetInvalidValue': 'Material preset value is invalid: {value}',
    'panel.status.materialPresetApplied': 'Applied material preset: {name}',
    'panel.status.lightPresetSelectMissing': 'Failed to get the light preset select element.',
    'panel.status.lightPresetInvalidValue': 'Light preset value is invalid: {value}',
    'panel.status.lightPresetApplied': 'Applied light preset: {name}',
    'panel.status.materialSyncInvalid': 'Invalid material settings sync value.',
    'panel.status.materialUpdateInvalid': 'Invalid material settings update value.',
    'panel.status.lightSyncInvalid': 'Invalid light settings sync value.',
    'panel.status.lightUpdateInvalid': 'Invalid light settings update value.',
    'panel.status.materialSyncFailed': 'Failed to synchronize material settings.',
    'panel.status.lightSyncFailed': 'Failed to synchronize light settings.',

    'preview.shapeLabel': 'Shape',
    'preview.menuLabel': 'Preview Menu',
    'preview.menuPlaceholder': 'Select an action...',
    'preview.menuButtonAria': 'Open preview action menu',
    'preview.menuWireframeToggle': 'Toggle wireframe ({state})',
    'preview.menuExportMainPng': 'Export 3D preview as PNG',
    'preview.menuExportStepPng': 'Export final step preview as PNG',
    'preview.status.invalidSyncValue': 'Invalid shape bar sync value: {value}',
    'preview.status.invalidSelectedShape': 'Invalid selected shape value: {value}',
    'preview.status.invalidSyncArg': 'Invalid shape bar sync argument: {value}',
    'preview.status.invalidWireframeSyncValue': 'Invalid wireframe sync value: {value}',
    'preview.status.invalidMenuAction': 'Invalid preview menu action: {value}',
    'preview.status.menuActionFailed': 'Preview action failed: {message}',
    'preview.status.invalidWireframeSyncArg': 'Invalid wireframe sync argument: {value}',

    'shader.help': 'Shader code generated from the current step configuration',
    'shader.tabsAria': 'Shader source selector',
    'shader.copy': 'Copy',
    'shader.close': 'Close',
    'shader.closeAria': 'Close shader code dialog',
    'shader.meta': '{stage} shader / {lines} lines',
    'shader.status.clipboardUnavailable': 'Clipboard API is not available.',
    'shader.status.copySuccess': 'Copied {stage} shader.',
    'shader.status.copyFailed': 'Failed to copy shader code.',

    'main.status.pipelineLoadedApplying': 'Pipeline loaded. Applying now...',
    'main.status.stepPreviewNotInitialized': 'Step preview system is not initialized.',
    'main.status.stepPreviewCpuMode': 'Step preview CPU-priority mode: {state}',
    'main.status.stepPreviewWebglDrawFailed': 'Step preview (WebGL) draw failed: {message}',
    'main.status.previewExportRendererMissing': 'The 3D preview renderer is not initialized.',
    'main.status.previewExportBytesInvalid': 'Generated step preview image bytes are invalid.',
    'main.status.previewExportBusy': '3D preview PNG export is already in progress. Please wait and retry.',
    'main.status.previewExportCaptureTimeout': 'Timed out while capturing the 3D preview.',
    'main.status.previewExportMainSaved': 'Saved the 3D preview PNG.',
    'main.status.previewExportStepSaved': 'Saved the final step preview PNG.',
    'main.status.wireframeInvalidValue': 'Invalid wireframe value: {value}',
    'main.status.wireframeChanged': 'Wireframe overlay set to {state}.',
    'main.status.stepNotFound': 'Step {stepId} was not found.',
    'main.status.removeStepNotFound': 'Target step {stepId} to remove was not found.',
    'main.status.stepDuplicated': 'Step duplicated (new ID: {stepId}).',
    'main.status.stepMuteInvalidValue': 'Invalid step mute value: {value}',
    'main.status.undoApplied': 'Undid the last change.',
    'main.status.redoApplied': 'Redid the last change.',
    'main.status.undoUnavailable': 'Nothing to undo.',
    'main.status.redoUnavailable': 'Nothing to redo.',
    'main.status.lutRemoved': 'Removed LUT "{name}".',
    'main.status.socketConnected': 'Connected socket by drag-and-drop.',
    'main.status.moveStepNotFound': 'Target step {stepId} to move was not found.',
    'main.status.stepOrderUpdated': 'Updated step order.',
    'main.status.moveLutNotFound': 'Target LUT to move was not found.',
    'main.status.lutOrderUpdated': 'Updated LUT order.',
    'main.status.applySuccess': 'Applied: {steps} step(s) / {luts} LUT(s)',
    'main.status.resetStepChain': 'Step chain has been reset.',
    'main.status.pipelineIoNotInitialized': 'Pipeline I/O system is not initialized.',
    'main.status.pipelineSaved': 'Pipeline saved as a .lutchain file.',
    'main.status.pipelineSaveFailed': 'Failed to save pipeline: {message}',
    'main.status.pipelineLoadFailed': 'Failed to load pipeline: {message}',
    'main.status.invalidLutAddInput': 'Invalid LUT add input.',
    'main.status.maxLutLimit': 'You can add up to {max} LUT(s).',
    'main.status.lutAdded': 'Added {count} LUT(s).',
    'main.status.initialPrompt': 'Edit LUT and steps, then press "Apply".',
  },
};

const languageListeners = new Set<LanguageChangeListener>();
const [languageState, setLanguageState] = createSignal<Language>(resolveInitialLanguage());

function isLanguage(value: unknown): value is Language {
  return value === 'ja' || value === 'en';
}

function isTemplateValues(value: unknown): value is TemplateValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(candidate => typeof candidate === 'string' || Number.isFinite(candidate));
}

function normalizeLanguageTag(value: unknown): Language | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }

  const primary = trimmed.split('-')[0];
  if (primary === 'ja' || primary === 'en') {
    return primary;
  }

  return null;
}

function readStoredLanguage(): Language | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeLanguageTag(raw);
  } catch {
    return null;
  }
}

function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  const candidates: unknown[] = [];
  if (Array.isArray(navigator.languages)) {
    candidates.push(...navigator.languages);
  }
  candidates.push(navigator.language);

  for (const candidate of candidates) {
    const parsed = normalizeLanguageTag(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return 'en';
}

function resolveInitialLanguage(): Language {
  const stored = readStoredLanguage();
  if (stored) {
    return stored;
  }

  return detectBrowserLanguage();
}

function persistLanguage(language: Language): void {
  if (!isLanguage(language)) {
    throw new Error(`Invalid language to persist: ${String(language)}`);
  }

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore storage errors and keep in-memory language state.
  }
}

function notifyLanguageListeners(language: Language): void {
  for (const listener of languageListeners) {
    listener(language);
  }
}

function formatTemplate(template: string, values?: TemplateValues): string {
  if (typeof template !== 'string') {
    throw new Error('formatTemplate: template must be a string.');
  }

  if (values === undefined) {
    return template;
  }

  if (!isTemplateValues(values)) {
    throw new Error('formatTemplate: values must be a plain object of string/number values.');
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const replacement = values[key];
    if (replacement === undefined) {
      return `{${key}}`;
    }
    return String(replacement);
  });
}

function ensureSupportedLanguage(language: unknown): asserts language is Language {
  if (!isLanguage(language)) {
    throw new Error(`Unsupported language: ${String(language)}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }
}

export function getLanguage(): Language {
  return languageState();
}

export function setLanguage(language: unknown): Language {
  ensureSupportedLanguage(language);

  if (languageState() === language) {
    return languageState();
  }

  setLanguageState(language);
  persistLanguage(language);
  notifyLanguageListeners(language);
  return language;
}

export function toggleLanguage(): Language {
  const next: Language = getLanguage() === 'ja' ? 'en' : 'ja';
  return setLanguage(next);
}

export function getLanguageLabel(language: unknown, displayLanguage: unknown = getLanguage()): string {
  ensureSupportedLanguage(language);
  ensureSupportedLanguage(displayLanguage);
  return LANGUAGE_LABELS[language];
}

export function t(key: unknown, values?: TemplateValues): string {
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error(`Invalid translation key: ${String(key)}`);
  }

  const currentLanguage = getLanguage();
  const template = TRANSLATIONS[currentLanguage][key] ?? TRANSLATIONS.en[key] ?? key;
  return formatTemplate(template, values);
}

export function subscribeLanguageChange(listener: unknown): () => void {
  if (typeof listener !== 'function') {
    throw new Error('subscribeLanguageChange: listener must be a function.');
  }

  const typedListener = listener as LanguageChangeListener;
  languageListeners.add(typedListener);

  return () => {
    languageListeners.delete(typedListener);
  };
}

export function useLanguage(): Accessor<Language> {
  const [language, setLanguageSignal] = createSignal<Language>(getLanguage());
  const dispose = subscribeLanguageChange((nextLanguage: Language) => {
    setLanguageSignal(nextLanguage);
  });

  onCleanup(dispose);
  return language;
}
