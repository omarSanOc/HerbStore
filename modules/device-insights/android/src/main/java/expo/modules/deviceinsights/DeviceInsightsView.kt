package expo.modules.deviceinsights

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class DeviceInsightsView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val button = Button(context)
  private val onNativePress by EventDispatcher<Map<String, Any>>()
  private var accent = "primary"
  private var accentColor: Int? = null

  var label: String? = null
    set(value) { field = value; update() }
  var fallbackLabel: String = ""
    set(value) { field = value; update() }
  var availableLabel: String = ""
    set(value) { field = value; update() }
  var unavailableLabel: String = ""
    set(value) { field = value; update() }
  var refreshingLabel: String = ""
    set(value) { field = value; update() }
  var available: Boolean = true
    set(value) { field = value; update() }
  var refreshing: Boolean = false
    set(value) { field = value; update() }

  init {
    button.gravity = Gravity.CENTER
    button.minHeight = dp(48)
    button.minWidth = dp(48)
    button.isAllCaps = false
    button.setSingleLine(false)
    button.setPadding(dp(16), dp(8), dp(16), dp(8))
    button.setOnFocusChangeListener { _, _ -> updateBackground() }
    button.setOnClickListener {
      val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
      formatter.timeZone = TimeZone.getTimeZone("UTC")
      onNativePress(mapOf("platform" to "android", "timestamp" to formatter.format(Date())))
    }
    addView(button, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
    update()
  }

  fun setAccent(value: String?) {
    accent = value?.takeIf { it in allowedAccents } ?: "primary"
    update()
  }

  fun setAccentColor(value: String?) {
    accentColor = parseOpaqueHexColor(value)
    update()
  }

  private fun update() {
    val resolvedLabel = label?.trim().takeUnless { it.isNullOrEmpty() } ?: fallbackLabel
    val stateLabel = if (refreshing) refreshingLabel else if (available) availableLabel else unavailableLabel
    button.text = if (refreshing) "$resolvedLabel…" else resolvedLabel
    button.isEnabled = available && !refreshing
    button.contentDescription = listOf(resolvedLabel, stateLabel).filter { it.isNotBlank() }.joinToString(", ")
    updateBackground()
  }

  private fun updateBackground() {
    val backgroundColor = accentColor ?: themedAccentColor()
    val foregroundColor = contrastingTextColor(backgroundColor)
    button.background = GradientDrawable().apply {
      cornerRadius = dp(24).toFloat()
      setColor(backgroundColor)
      if (button.isFocused) setStroke(dp(2), foregroundColor)
    }
    button.setTextColor(foregroundColor)
  }

  private fun parseOpaqueHexColor(value: String?): Int? {
    if (value == null || !value.matches(Regex("^#[0-9A-Fa-f]{6}$"))) return null
    val rgb = value.substring(1).toLongOrNull(16) ?: return null
    return (0xFF000000L or rgb).toInt()
  }

  private fun themedAccentColor(): Int {
    val resolved = TypedValue()
    return if (context.theme.resolveAttribute(android.R.attr.colorAccent, resolved, true)) {
      resolved.data
    } else {
      button.currentTextColor
    }
  }

  private fun contrastingTextColor(backgroundColor: Int): Int {
    fun linear(channel: Int): Double {
      val value = channel / 255.0
      return if (value <= 0.04045) value / 12.92 else Math.pow((value + 0.055) / 1.055, 2.4)
    }

    val luminance = 0.2126 * linear(Color.red(backgroundColor)) +
      0.7152 * linear(Color.green(backgroundColor)) +
      0.0722 * linear(Color.blue(backgroundColor))
    val whiteContrast = 1.05 / (luminance + 0.05)
    val blackContrast = (luminance + 0.05) / 0.05
    return if (whiteContrast >= blackContrast) Color.WHITE else Color.BLACK
  }

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

  companion object {
    private val allowedAccents = setOf("primary", "success", "warning", "error")
  }
}
