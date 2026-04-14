
  # SoRita

  This is a code bundle for SoRita. The original project is available at https://www.figma.com/design/xFI0Mxo8e6GdMVNfWu0eSm/SoRita.

  ## Web development

  Run `npm install` to install the dependencies.

  Run `npm run dev` to start the Vite web server.

  ## Expo + Android emulator

  Run `npx expo start` to start the Expo project. The native shell will use the live Vite app when `npm run dev` is running, otherwise it falls back to the bundled mobile HTML build in `mobile-web/index.html`.

  Run `npm run android` to start both the Vite server and Expo together for Android emulator development.

  If Metro shows a stale module resolution error after dependency changes, run `npm run clean:metro` and then `npm run expo:android`.

  If Android Studio does not show any available emulator device yet, create an AVD first from Device Manager before running `npm run android`.

  ## Native fallback bundle

  Run `npm run build:mobile-web` whenever you want to refresh the bundled HTML version used by Expo when the live Vite server is unavailable.
  
