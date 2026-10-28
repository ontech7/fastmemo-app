package com.ontech7.fastmemoinstaller

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The GitHub APK's updater (ADR-031): hands a downloaded APK to the system installer. Linked only into that build
 * (react-native.config.js), so its presence is how the app knows it is the APK.
 */
class FastmemoInstallerModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "FastmemoInstaller"

  /** Whether the user lets FastMemo install apps (asked once, in the system settings). */
  @ReactMethod
  fun canInstallAsync(promise: Promise) {
    promise.resolve(
      Build.VERSION.SDK_INT < Build.VERSION_CODES.O || reactApplicationContext.packageManager.canRequestPackageInstalls()
    )
  }

  /** Opens the system page where the user lets FastMemo install apps. */
  @ReactMethod
  fun openInstallSettingsAsync(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${reactApplicationContext.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_SETTINGS", e.message, e)
    }
  }

  /** `contentUri`: the APK as a content:// URI the installer may read (expo-file-system's provider). */
  @ReactMethod
  fun installAsync(contentUri: String, promise: Promise) {
    try {
      val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(Uri.parse(contentUri), "application/vnd.android.package-archive")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_INSTALL", e.message, e)
    }
  }
}
