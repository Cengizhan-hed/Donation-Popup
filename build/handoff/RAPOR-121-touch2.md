# RAPOR 121-touch2 (teşhis; davranış/eşik değişmedi)
- Dal v121-touch2, yalnız tests/e2e/helpers/mobile-a11y.mjs.
- probeTouchTargets ihlal satırlarına: inDialog, dialogOpen, kind, product, cssW/cssH/minW/padding/display/boxSizing, hasStepper/stepperDisplay/stepperHeight, pluginSheets (path+media+sheet|cors|no-sheet), fontsStatus, reducedMotion, layerAnimations, topIsSelf (elementFromPoint), diagError.
- İhlalde tam sayfa PNG: build/e2e/debug/<env>/a11y-touch-<device>.png.
- Kanıt: lint:js 0; JS birim 756/0; yerel e2e:queue e2e:quick geçti 8/0 hata, 15.8 sn (ihlal yok, teşhis yolu yerelde tetiklenmedi).
- Not: ihlal yokken yeni kod çalışmaz; uzak koşuda ihlalde detail JSON'una (ilk 8 satır) girer.
