# iOS Splash Screens

This directory should contain iOS splash screens for optimal PWA experience.

## Required Splash Screens

The following splash screen images are referenced in `client/index.html`:

### iPhone Splash Screens (Portrait)
- `iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png` - 1290x2796px
- `iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png` - 1179x2556px
- `iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_portrait.png` - 1284x2778px
- `iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png` - 1170x2532px
- `iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png` - 1125x2436px
- `iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png` - 1242x2688px
- `iPhone_11__iPhone_XR_portrait.png` - 828x1792px
- `iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png` - 1242x2208px
- `iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png` - 750x1334px
- `4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait.png` - 640x1136px

### iPad Splash Screens (Portrait)
- `12.9__iPad_Pro_portrait.png` - 2048x2732px
- `11__iPad_Pro__10.5__iPad_Pro_portrait.png` - 1668x2388px
- `10.9__iPad_Air_portrait.png` - 1640x2360px
- `10.5__iPad_Air_portrait.png` - 1668x2224px
- `10.2__iPad_portrait.png` - 1620x2160px
- `9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_portrait.png` - 1536x2048px
- `8.3__iPad_Mini_portrait.png` - 1488x2266px

## Generating Splash Screens

You can use tools like:
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [Appscope](https://appsco.pe/developer/splash-screens)
- Manual creation with design tools matching the XNRT cosmic theme

### Quick Generation with PWA Asset Generator

```bash
npx pwa-asset-generator client/public/icon-512.png client/public/splash \
  --background "#000000" \
  --splash-only \
  --type png \
  --quality 100
```

## Fallback Behavior

If splash screens are not present, iOS will:
1. Show a white/black screen (based on theme-color)
2. Fall back gracefully - the app will still work

The app icon and theme colors are already configured for a good experience even without custom splash screens.
