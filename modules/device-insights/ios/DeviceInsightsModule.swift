import ExpoModulesCore
import Foundation
import UIKit

public final class DeviceInsightsView: ExpoView {
  let onNativePress = EventDispatcher()
  private let button = UIButton(type: .system)
  private var accent = "primary"
  private var accentColor: UIColor?
  private var currentLabel: String?
  private var fallbackLabel = ""
  private var availableLabel = ""
  private var unavailableLabel = ""
  private var refreshingLabel = ""
  private var isRefreshing = false
  private var isAvailable = true

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    button.translatesAutoresizingMaskIntoConstraints = false
    button.titleLabel?.adjustsFontForContentSizeCategory = true
    button.titleLabel?.font = UIFont.preferredFont(forTextStyle: .headline)
    button.titleLabel?.numberOfLines = 0
    button.titleLabel?.lineBreakMode = .byWordWrapping
    button.titleLabel?.textAlignment = .center
    button.accessibilityTraits = [.button]
    button.layer.cornerRadius = 22
    button.addTarget(self, action: #selector(pressed), for: .touchUpInside)
    addSubview(button)
    NSLayoutConstraint.activate([
      button.leadingAnchor.constraint(equalTo: leadingAnchor),
      button.trailingAnchor.constraint(equalTo: trailingAnchor),
      button.topAnchor.constraint(equalTo: topAnchor),
      button.bottomAnchor.constraint(equalTo: bottomAnchor),
      button.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
    ])
    update()
  }

  func setLabel(_ value: String?) {
    currentLabel = value
    update()
  }
  func setFallbackLabel(_ value: String?) { fallbackLabel = value ?? ""; update() }
  func setAvailableLabel(_ value: String?) { availableLabel = value ?? ""; update() }
  func setUnavailableLabel(_ value: String?) { unavailableLabel = value ?? ""; update() }
  func setRefreshingLabel(_ value: String?) { refreshingLabel = value ?? ""; update() }
  func setAccent(_ value: String?) {
    accent = value.map { ["primary", "success", "warning", "error"].contains($0) ? $0 : "primary" } ?? "primary"
    update()
  }
  func setAccentColor(_ value: String?) { accentColor = Self.parseOpaqueHexColor(value); update() }
  func setAvailable(_ value: Bool?) { isAvailable = value ?? true; update() }
  func setRefreshing(_ value: Bool?) { isRefreshing = value ?? false; update() }

  private func update() {
    let trimmed = currentLabel?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let resolvedLabel = trimmed.isEmpty ? fallbackLabel : trimmed
    let stateLabel = isRefreshing ? refreshingLabel : (isAvailable ? availableLabel : unavailableLabel)
    let resolvedAccentColor = accentColor ?? .systemBlue
    let contentColor = Self.contrastingTextColor(for: resolvedAccentColor)
    button.setTitle(isRefreshing ? "\(resolvedLabel)…" : resolvedLabel, for: .normal)
    button.backgroundColor = resolvedAccentColor
    button.setTitleColor(contentColor, for: .normal)
    button.setTitleColor(contentColor, for: .disabled)
    button.isEnabled = isAvailable && !isRefreshing
    button.accessibilityLabel = resolvedLabel
    button.accessibilityValue = stateLabel
    button.accessibilityTraits = isRefreshing || !isAvailable ? [.button, .notEnabled] : [.button]
  }

  private static func parseOpaqueHexColor(_ value: String?) -> UIColor? {
    guard let value, value.count == 7, value.first == "#" else { return nil }
    let hex = String(value.dropFirst())
    guard let rgb = UInt64(hex, radix: 16) else { return nil }
    return UIColor(
      red: CGFloat((rgb >> 16) & 0xFF) / 255,
      green: CGFloat((rgb >> 8) & 0xFF) / 255,
      blue: CGFloat(rgb & 0xFF) / 255,
      alpha: 1
    )
  }

  private static func contrastingTextColor(for color: UIColor) -> UIColor {
    var red: CGFloat = 0
    var green: CGFloat = 0
    var blue: CGFloat = 0
    guard color.getRed(&red, green: &green, blue: &blue, alpha: nil) else { return .white }

    func linear(_ value: CGFloat) -> CGFloat {
      value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
    }

    let luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
    let whiteContrast = 1.05 / (luminance + 0.05)
    let blackContrast = (luminance + 0.05) / 0.05
    return whiteContrast >= blackContrast ? .white : .black
  }

  @objc private func pressed() {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    onNativePress(["platform": "ios", "timestamp": formatter.string(from: Date())])
  }
}

public class DeviceInsightsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DeviceInsights")

    Events("onChange")

    Function("getPlatform") {
      return "ios"
    }

    AsyncFunction("getInsightsAsync") {
      let payload: [String: Any] = [
        "platform": "ios",
        "model": UIDevice.current.model.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "iOS device" : UIDevice.current.model,
        "systemVersion": UIDevice.current.systemVersion,
        "isPhysical": DeviceInsightsModule.isPhysicalDevice,
      ]
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      self.sendEvent("onChange", payload.merging(["timestamp": formatter.string(from: Date())]) { current, _ in current })
      return payload
    }

    View(DeviceInsightsView.self) {
      Events("onNativePress")
      Prop("label") { (view, value: String?) in view.setLabel(value) }
      Prop("fallbackLabel") { (view, value: String?) in view.setFallbackLabel(value) }
      Prop("availableLabel") { (view, value: String?) in view.setAvailableLabel(value) }
      Prop("unavailableLabel") { (view, value: String?) in view.setUnavailableLabel(value) }
      Prop("refreshingLabel") { (view, value: String?) in view.setRefreshingLabel(value) }
      Prop("accent") { (view, value: String?) in view.setAccent(value) }
      Prop("accentColor") { (view, value: String?) in view.setAccentColor(value) }
      Prop("available") { (view, value: Bool?) in view.setAvailable(value) }
      Prop("refreshing") { (view, value: Bool?) in view.setRefreshing(value) }
    }
  }

  private static var isPhysicalDevice: Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    return true
    #endif
  }
}
