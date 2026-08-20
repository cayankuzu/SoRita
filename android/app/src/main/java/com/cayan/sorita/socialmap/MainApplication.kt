package com.cayan.sorita.socialmap

import android.app.Application
import android.content.res.Configuration
import android.os.Build

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(SoritaGallerySaverPackage())
        },
      useDevSupport = BuildConfig.USE_METRO
    )
  }

  override fun onCreate() {
    super.onCreate()
    if (BuildConfig.USE_METRO) {
      getSharedPreferences("${packageName}_preferences", MODE_PRIVATE)
        .edit()
        .putString("debug_http_host", resolveDebugMetroHost())
        .putBoolean("hot_module_replacement", true)
        .putBoolean("js_dev_mode_debug", true)
        .apply()
    }
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  private fun resolveDebugMetroHost(): String {
    val metroPort = resources.getInteger(R.integer.react_native_dev_server_port)

    return if (isRunningOnAndroidEmulator()) {
      "10.0.2.2:$metroPort"
    } else {
      "localhost:$metroPort"
    }
  }

  private fun isRunningOnAndroidEmulator(): Boolean {
    val fingerprint = Build.FINGERPRINT.lowercase()
    val model = Build.MODEL.lowercase()
    val manufacturer = Build.MANUFACTURER.lowercase()
    val brand = Build.BRAND.lowercase()
    val device = Build.DEVICE.lowercase()
    val product = Build.PRODUCT.lowercase()

    return fingerprint.startsWith("generic") ||
      fingerprint.contains("emulator") ||
      model.contains("google_sdk") ||
      model.contains("emulator") ||
      model.contains("android sdk built for") ||
      manufacturer.contains("genymotion") ||
      (brand.startsWith("generic") && device.startsWith("generic")) ||
      product.contains("sdk_gphone") ||
      product.contains("google_sdk") ||
      product.contains("emulator")
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
