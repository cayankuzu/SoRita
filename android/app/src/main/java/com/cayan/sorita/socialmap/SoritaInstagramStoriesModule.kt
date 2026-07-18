package com.cayan.sorita.socialmap

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class SoritaInstagramStoriesModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "SoritaInstagramStories"
    private const val INSTAGRAM_PACKAGE_NAME = "com.instagram.android"
    private const val INSTAGRAM_STORY_ACTION = "com.instagram.share.ADD_TO_STORY"
    private const val FILE_PROVIDER_SUFFIX = ".instagramstories.fileprovider"
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun shareLink(url: String, topBackgroundColor: String, bottomBackgroundColor: String, promise: Promise) {
    try {
      val activity =
        reactApplicationContext.currentActivity
          ?: throw IllegalStateException("Instagram Stories icin aktif activity bulunamadi.")
      val packageManager = reactContext.packageManager
      val launchIntent = packageManager.getLaunchIntentForPackage(INSTAGRAM_PACKAGE_NAME)
        ?: throw IllegalStateException("Instagram uygulamasi bulunamadi.")
      val stickerUri = createStickerAssetUri()
      val intent = Intent(INSTAGRAM_STORY_ACTION).apply {
        setDataAndType(stickerUri, "image/png")
        setPackage(INSTAGRAM_PACKAGE_NAME)
        putExtra("content_url", url)
        putExtra("top_background_color", topBackgroundColor)
        putExtra("bottom_background_color", bottomBackgroundColor)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        clipData = android.content.ClipData.newUri(
          reactContext.contentResolver,
          "sorita-story-sticker",
          stickerUri
        )
      }

      val resolveInfo = intent.resolveActivity(packageManager)
      if (resolveInfo == null) {
        activity.startActivity(launchIntent)
        throw IllegalStateException("Instagram Stories bu cihazda acilamadi.")
      }

      reactContext.grantUriPermission(
        INSTAGRAM_PACKAGE_NAME,
        stickerUri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION
      )
      activity.startActivity(intent)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("E_INSTAGRAM_STORY_SHARE_FAILED", error.message, error)
    }
  }

  private fun createStickerAssetUri(): Uri {
    val cacheDirectory = File(reactContext.cacheDir, "instagram-stories")
    if (!cacheDirectory.exists() && !cacheDirectory.mkdirs()) {
      throw IOException("Instagram Stories onbellek klasoru olusturulamadi.")
    }

    val stickerFile = File(cacheDirectory, "sorita-story-sticker.png")
    val bitmap =
      BitmapFactory.decodeResource(reactContext.resources, R.drawable.splashscreen_logo)
        ?: throw IOException("Instagram Stories gorseli yuklenemedi.")

    FileOutputStream(stickerFile).use { outputStream ->
      if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)) {
        throw IOException("Instagram Stories gorseli yazilamadi.")
      }
    }
    bitmap.recycle()

    return FileProvider.getUriForFile(
      reactContext,
      reactContext.packageName + FILE_PROVIDER_SUFFIX,
      stickerFile
    )
  }
}
