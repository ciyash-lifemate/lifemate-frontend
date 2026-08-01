package expo.modules.remindersound

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// expo-notifications (see SoundResolver.kt in that package) can only ever
// point a channel at a sound bundled into the app at build time - there's
// no JS-level API to hand it an arbitrary content:// URI from the user's
// own phone, which is the whole point of this module: pick a file with
// expo-document-picker, then set it as a channel's sound natively, the same
// way NotificationChannel.setSound() always could.
class ReminderSoundModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ReminderSound")

    // Storage Access Framework only grants read access to a picked file for
    // the current app session unless this is called - without it, the URI
    // stops resolving (and so the channel silently falls back to no sound)
    // the next time the app - or the phone - restarts.
    Function("takePersistableUriPermission") { uriString: String ->
      try {
        val uri = Uri.parse(uriString)
        context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        true
      } catch (e: Exception) {
        false
      }
    }

    // Channels are immutable once created (see notifications.js on the JS
    // side for the same constraint with bundled sounds) - the caller is
    // responsible for passing a channelId it hasn't used before whenever the
    // user picks a *different* file, so this always ends up creating a
    // fresh channel rather than silently reusing whatever sound an older
    // channel of the same id already locked in.
    Function("setChannelSound") { channelId: String, channelName: String, uriString: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return@Function false
      }
      try {
        val uri = Uri.parse(uriString)
        // Confirms the permission from takePersistableUriPermission is
        // still live before handing the URI to the OS - a channel created
        // with a URI the app can no longer read just plays no sound at all,
        // with nothing in the UI to explain why.
        context.contentResolver.openInputStream(uri)?.close()
          ?: throw CodedException("E_SOUND_UNREADABLE", "Could not read the selected sound file.", null)

        val attributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()

        val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH)
        channel.setSound(uri, attributes)

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.createNotificationChannel(channel)
        true
      } catch (e: CodedException) {
        throw e
      } catch (e: Exception) {
        throw CodedException("E_SOUND_CHANNEL_FAILED", "Could not set this sound as the reminder tone: ${e.message}", e)
      }
    }
  }
}
