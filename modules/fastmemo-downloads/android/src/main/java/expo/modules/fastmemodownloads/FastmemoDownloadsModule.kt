package expo.modules.fastmemodownloads

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Model downloads through the system's DownloadManager (ADR-028): they go on with the screen off and the app in the
 * background or closed, resume after the network drops, and show their progress in a notification.
 */
class FastmemoDownloadsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val manager: DownloadManager
    get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  // The app's own folders on the shared storage: the download manager can't write the app's private files. Both on the same
  // storage, a finished download moves from one to the other by a rename.
  private fun folder(name: String): File =
    File(context.getExternalFilesDir(null) ?: throw IllegalStateException("No shared storage"), name).apply { mkdirs() }

  override fun definition() = ModuleDefinition {
    Name("FastmemoDownloads")

    Function("modelsDir") { Uri.fromFile(folder(MODELS)).toString() + "/" }

    // A file being downloaded has its full size from the start (the space is reserved): it's written in a staging folder,
    // never where a model is looked for, so a cut-off one can't pass for whole.
    AsyncFunction("startAsync") { url: String, fileName: String, title: String, description: String ->
      // an earlier file of that name would make the download manager write another name
      File(folder(STAGING), fileName).delete()
      val request = DownloadManager.Request(Uri.parse(url))
        .setTitle(title)
        .setDescription(description)
        // shown while it runs, not once done: tapping it then would try to open the model file
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        .setDestinationInExternalFilesDir(context, STAGING, fileName)
        .setAllowedOverMetered(true)
        .setAllowedOverRoaming(true)
      manager.enqueue(request).toDouble()
    }

    AsyncFunction("queryAsync") { id: Double -> query(id.toLong()) }

    AsyncFunction("finishAsync") { id: Double, fileName: String ->
      val from = File(folder(STAGING), fileName)
      val to = File(folder(MODELS), fileName)
      val moved = from.exists() && (!to.exists() || to.delete()) && from.renameTo(to)
      // forgets the download: its file is no longer where it was written, so nothing else goes
      manager.remove(id.toLong())
      moved
    }

    AsyncFunction("cancelAsync") { id: Double, fileName: String ->
      manager.remove(id.toLong())
      File(folder(STAGING), fileName).delete()
      Unit
    }

    // expo-file-system can't delete here: it checks the folder through the file's path ("<file>/..")
    AsyncFunction("deleteAsync") { fileName: String ->
      require('/' !in fileName && fileName != "..") { "A file name, not a path" }
      File(folder(MODELS), fileName).delete()
      Unit
    }

    AsyncFunction("clearStagingAsync") {
      folder(STAGING).listFiles()?.forEach { it.delete() }
      Unit
    }
  }

  private fun query(id: Long): Map<String, Any> {
    manager.query(DownloadManager.Query().setFilterById(id))?.use { cursor ->
      if (cursor.moveToFirst()) {
        val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
        return mapOf(
          "status" to when (status) {
            DownloadManager.STATUS_PENDING -> "pending"
            DownloadManager.STATUS_RUNNING -> "running"
            DownloadManager.STATUS_PAUSED -> "paused"
            DownloadManager.STATUS_SUCCESSFUL -> "successful"
            else -> "failed"
          },
          "downloaded" to cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).toDouble(),
          "total" to cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)).toDouble(),
          "reason" to cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)),
        )
      }
    }
    // removed from its notification, or already finished here
    return mapOf("status" to "missing", "downloaded" to 0.0, "total" to -1.0, "reason" to 0)
  }

  companion object {
    private const val MODELS = "models"
    private const val STAGING = "model-downloads"
  }
}
