package com.cayan.sorita.socialmap

import android.content.ContentValues
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.IOException
import java.util.Locale

class SoritaGallerySaverModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "SoritaGallerySaver"
    private const val APP_DIRECTORY_NAME = "SoRita"
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun saveToGallery(sourceUriValue: String, fileName: String?, mimeType: String?, promise: Promise) {
    try {
      promise.resolve(saveToGalleryInternal(sourceUriValue, fileName, mimeType))
    } catch (error: Throwable) {
      promise.reject("E_GALLERY_SAVE_FAILED", error.message, error)
    }
  }

  private fun saveToGalleryInternal(
    sourceUriValue: String,
    fileName: String?,
    mimeType: String?
  ): String {
    val sourceUri = Uri.parse(sourceUriValue)
    val resolvedMimeType = resolveMimeType(sourceUri, fileName, mimeType)
    val fileExtension = resolveFileExtension(sourceUri, fileName, resolvedMimeType)
    val displayName = buildDisplayName(sourceUri, fileName, resolvedMimeType, fileExtension)
    val isVideo = resolvedMimeType.startsWith("video/")

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      saveToMediaStore(sourceUri, displayName, resolvedMimeType, isVideo)
    } else {
      saveToLegacyGalleryDirectory(sourceUri, displayName, resolvedMimeType, isVideo)
    }
  }

  private fun saveToMediaStore(
    sourceUri: Uri,
    displayName: String,
    mimeType: String,
    isVideo: Boolean
  ): String {
    val resolver = reactContext.contentResolver
    val collection =
      if (isVideo) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    val relativePath =
      "${if (isVideo) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES}/$APP_DIRECTORY_NAME"
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
      put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
      put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val destinationUri =
      resolver.insert(collection, values) ?: throw IOException("Gallery destination could not be created.")

    try {
      copyUriContents(sourceUri, destinationUri)
      values.clear()
      values.put(MediaStore.MediaColumns.IS_PENDING, 0)
      resolver.update(destinationUri, values, null, null)
      return destinationUri.toString()
    } catch (error: Throwable) {
      resolver.delete(destinationUri, null, null)
      throw error
    }
  }

  private fun saveToLegacyGalleryDirectory(
    sourceUri: Uri,
    displayName: String,
    mimeType: String,
    isVideo: Boolean
  ): String {
    val publicDirectory =
      Environment.getExternalStoragePublicDirectory(
        if (isVideo) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES
      )
    val targetDirectory = File(publicDirectory, APP_DIRECTORY_NAME)

    if (!targetDirectory.exists() && !targetDirectory.mkdirs()) {
      throw IOException("Gallery directory could not be created.")
    }

    val destinationFile = createUniqueFile(targetDirectory, displayName)

    openSourceInputStream(sourceUri).use { inputStream ->
      destinationFile.outputStream().use { outputStream ->
        inputStream.copyTo(outputStream)
      }
    }

    MediaScannerConnection.scanFile(
      reactContext,
      arrayOf(destinationFile.absolutePath),
      arrayOf(mimeType),
      null
    )

    return Uri.fromFile(destinationFile).toString()
  }

  private fun copyUriContents(sourceUri: Uri, destinationUri: Uri) {
    val resolver = reactContext.contentResolver

    openSourceInputStream(sourceUri).use { inputStream ->
      val outputStream =
        resolver.openOutputStream(destinationUri) ?: throw IOException("Gallery output stream could not be opened.")

      outputStream.use { stream ->
        inputStream.copyTo(stream)
      }
    }
  }

  private fun openSourceInputStream(sourceUri: Uri) =
    reactContext.contentResolver.openInputStream(sourceUri)
      ?: throw IOException("Gallery source stream could not be opened.")

  private fun resolveMimeType(sourceUri: Uri, fileName: String?, mimeType: String?): String {
    val explicitMimeType = mimeType?.trim()?.lowercase(Locale.ROOT)

    if (!explicitMimeType.isNullOrEmpty()) {
      return explicitMimeType
    }

    val resolverMimeType = reactContext.contentResolver.getType(sourceUri)?.trim()?.lowercase(Locale.ROOT)

    if (!resolverMimeType.isNullOrEmpty()) {
      return resolverMimeType
    }

    val fileExtension = extractExtension(fileName ?: sourceUri.lastPathSegment ?: sourceUri.path ?: "")

    if (!fileExtension.isNullOrEmpty()) {
      val resolvedFromExtension =
        MimeTypeMap.getSingleton().getMimeTypeFromExtension(fileExtension.lowercase(Locale.ROOT))

      if (!resolvedFromExtension.isNullOrEmpty()) {
        return resolvedFromExtension
      }
    }

    return "image/jpeg"
  }

  private fun resolveFileExtension(sourceUri: Uri, fileName: String?, mimeType: String): String {
    val explicitExtension = extractExtension(fileName ?: sourceUri.lastPathSegment ?: sourceUri.path ?: "")

    if (!explicitExtension.isNullOrEmpty()) {
      return explicitExtension.lowercase(Locale.ROOT)
    }

    return MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)?.lowercase(Locale.ROOT)
      ?: if (mimeType.startsWith("video/")) "mp4" else "jpg"
  }

  private fun buildDisplayName(
    sourceUri: Uri,
    fileName: String?,
    mimeType: String,
    fileExtension: String
  ): String {
    val rawName = fileName ?: sourceUri.lastPathSegment ?: sourceUri.path ?: ""
    val baseName = sanitizeBaseName(removeExtension(rawName))
      .ifEmpty {
        if (mimeType.startsWith("video/")) {
          "sorita-video-${System.currentTimeMillis()}"
        } else {
          "sorita-image-${System.currentTimeMillis()}"
        }
      }

    return "$baseName.$fileExtension"
  }

  private fun createUniqueFile(directory: File, displayName: String): File {
    val baseName = removeExtension(displayName)
    val extension = extractExtension(displayName)

    var candidate = File(directory, displayName)
    var suffix = 2

    while (candidate.exists()) {
      val nextFileName =
        if (extension.isNullOrEmpty()) "$baseName-$suffix" else "$baseName-$suffix.$extension"
      candidate = File(directory, nextFileName)
      suffix += 1
    }

    return candidate
  }

  private fun extractExtension(value: String): String? {
    val sanitizedValue = value.substringBefore('?').substringBefore('#').trim()
    val extension = sanitizedValue.substringAfterLast('.', "")

    return extension.takeIf { it.isNotBlank() && it.length <= 10 }
  }

  private fun removeExtension(value: String): String {
    val sanitizedValue = value.substringBefore('?').substringBefore('#').trim()
    val lastSeparatorIndex = maxOf(sanitizedValue.lastIndexOf('/'), sanitizedValue.lastIndexOf('\\'))
    val fileName = if (lastSeparatorIndex >= 0) sanitizedValue.substring(lastSeparatorIndex + 1) else sanitizedValue
    val extension = extractExtension(fileName) ?: return fileName
    return fileName.removeSuffix(".$extension")
  }

  private fun sanitizeBaseName(value: String): String {
    return value
      .replace(Regex("[^A-Za-z0-9._-]"), "-")
      .replace(Regex("-+"), "-")
      .trim('-', '.', ' ')
  }
}
