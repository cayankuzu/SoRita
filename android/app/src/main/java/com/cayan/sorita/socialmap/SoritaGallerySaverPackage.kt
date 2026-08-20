package com.cayan.sorita.socialmap

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SoritaGallerySaverPackage : ReactPackage {
  @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(
      SoritaGallerySaverModule(reactContext),
      SoritaInstagramStoriesModule(reactContext),
    )
  }

  @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
