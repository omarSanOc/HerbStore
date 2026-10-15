package expo.modules.deviceinsights

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.os.Build
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class DeviceInsightsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeviceInsights")

    Events("onChange")

    Function("getPlatform") {
      "android"
    }

    AsyncFunction("getInsightsAsync") {
      val model = Build.MODEL.trim().ifEmpty { "Android device" }
      val systemVersion = Build.VERSION.RELEASE.trim().ifEmpty { "unknown" }
      val payload = mapOf(
        "platform" to "android",
        "model" to model,
        "systemVersion" to systemVersion,
        "isPhysical" to !isEmulator(),
      )
      val timestampFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
      timestampFormat.timeZone = TimeZone.getTimeZone("UTC")
      sendEvent("onChange", payload + ("timestamp" to timestampFormat.format(Date())))
      payload
    }

    View(DeviceInsightsView::class) {
      Events("onNativePress")
      Prop("label") { view, value: String? -> view.label = value }
      Prop("fallbackLabel") { view, value: String? -> view.fallbackLabel = value.orEmpty() }
      Prop("availableLabel") { view, value: String? -> view.availableLabel = value.orEmpty() }
      Prop("unavailableLabel") { view, value: String? -> view.unavailableLabel = value.orEmpty() }
      Prop("refreshingLabel") { view, value: String? -> view.refreshingLabel = value.orEmpty() }
      Prop("accent") { view, value: String? -> view.setAccent(value) }
      Prop("accentColor") { view, value: String? -> view.setAccentColor(value) }
      Prop("available") { view, value: Boolean? -> view.available = value ?: true }
      Prop("refreshing") { view, value: Boolean? -> view.refreshing = value ?: false }
    }
  }

  private fun isEmulator(): Boolean {
    return Build.FINGERPRINT.startsWith("generic") ||
      Build.FINGERPRINT.startsWith("unknown") ||
      Build.MODEL.contains("google_sdk", ignoreCase = true) ||
      Build.MODEL.contains("emulator", ignoreCase = true) ||
      Build.MODEL.contains("android sdk built for", ignoreCase = true)
  }
}
