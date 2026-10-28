package com.ontech7.fastmemoinstaller

import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.Signature
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

  /**
   * `fileUri`: the downloaded APK (file://), checked before anything else; `contentUri`: the same file as a content:// URI
   * the installer may read (expo-file-system's provider). Rejects with E_NOT_VERIFIED when it isn't this app, signed with
   * this app's key: the system would refuse it anyway, after the user confirmed the install.
   */
  @ReactMethod
  fun installAsync(fileUri: String, contentUri: String, promise: Promise) {
    try {
      val path = Uri.parse(fileUri).path
      if (path == null || !isSameApp(path)) {
        promise.reject("E_NOT_VERIFIED", "The APK isn't this app signed with this app's key")
        return
      }
      val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(Uri.parse(contentUri), "application/vnd.android.package-archive")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_INSTALL", e.message, e)
    }
  }

  /** Whether the APK at `path` has this app's package name and the same signing certificates as the installed app. */
  @Suppress("DEPRECATION")
  private fun isSameApp(path: String): Boolean {
    val packageManager = reactApplicationContext.packageManager
    val packageName = reactApplicationContext.packageName

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val archive = packageManager.getPackageArchiveInfo(path, PackageManager.GET_SIGNING_CERTIFICATES) ?: return false
      if (archive.packageName != packageName) return false
      val archiveSigners = archive.signingInfo?.apkContentsSigners ?: return false
      val installedSigners =
        packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES).signingInfo?.apkContentsSigners
          ?: return false
      return sameSigners(archiveSigners, installedSigners)
    }

    val archive = packageManager.getPackageArchiveInfo(path, PackageManager.GET_SIGNATURES) ?: return false
    if (archive.packageName != packageName) return false
    val archiveSigners = archive.signatures ?: return false
    val installedSigners = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES).signatures ?: return false
    return sameSigners(archiveSigners, installedSigners)
  }

  private fun sameSigners(a: Array<Signature>, b: Array<Signature>) = a.isNotEmpty() && a.toSet() == b.toSet()
}
