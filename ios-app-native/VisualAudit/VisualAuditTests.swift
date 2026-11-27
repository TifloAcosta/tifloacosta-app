import XCTest

/// Diagnostic captures from an unsigned, disposable simulator installation.
final class VisualAuditTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launch(_ app: XCUIApplication, textSize: Int) {
        if app.state != .notRunning { app.terminate() }
        app.launchArguments = ["-AppleLanguages", "(es)", "-AppleLocale", "es_ES",
                               "-native-ios-language", "0", "-native-ios-color-scheme", "0",
                               "-native-ios-text-size", String(textSize)]
        app.launch()
    }

    private func reveal(_ app: XCUIApplication, _ element: XCUIElement) -> Bool {
        if element.exists && element.isHittable { return true }
        for _ in 0..<12 {
            app.swipeUp()
            if element.exists && element.isHittable { return true }
        }
        for _ in 0..<12 {
            app.swipeDown()
            if element.exists && element.isHittable { return true }
        }
        return false
    }

    private func capture(_ app: XCUIApplication, _ label: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = label
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func openRoot(_ app: XCUIApplication, _ key: String) {
        let element = app.descendants(matching: .any).matching(identifier: "tiflo.home." + key).firstMatch
        XCTAssertTrue(reveal(app, element), "Root not reachable: " + key)
        element.tap()
    }

    private func openLabel(_ app: XCUIApplication, _ label: String) {
        let predicate = NSPredicate(format: "label == %@", label)
        let button = app.buttons.matching(predicate).firstMatch
        if reveal(app, button) { button.tap(); return }
        let element = app.descendants(matching: .any).matching(predicate).firstMatch
        XCTAssertTrue(reveal(app, element), "Control not reachable: " + label)
        element.tap()
    }

    private func audit(_ textSize: Int) {
        let app = XCUIApplication()
        let sections = [("Actualidad", "news"), ("Recursos", "resources"),
                        ("TifloLector", "reader"), ("Mi Música", "music"),
                        ("Multicines Accesibles", "cinema"), ("Novedades", "updates"),
                        ("Descargar desde un enlace", "downloads"), ("Favoritos", "favorites"),
                        ("Vídeos", "videos"), ("Podcast", "podcast"), ("Configuración", "settings")]
        launch(app, textSize: textSize)
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "tiflo.home.Actualidad").firstMatch.waitForExistence(timeout: 30))
        capture(app, "00-home")
        for (index, section) in sections.enumerated() {
            launch(app, textSize: textSize)
            openRoot(app, section.0)
            capture(app, String(format: "%02d-%@", index + 1, section.1))
        }

        for (provider, name) in [("Google Drive", "google-drive"), ("Dropbox", "dropbox")] {
            launch(app, textSize: textSize)
            openRoot(app, "Mi Música")
            openLabel(app, "Nubes")
            capture(app, "12-cloud-menu-" + name)
            openLabel(app, provider)
            capture(app, "13-cloud-" + name)
            // Do not connect accounts or import files.
        }
        launch(app, textSize: textSize)
        openRoot(app, "Configuración")
        let backup = app.buttons.matching(identifier: "tiflo.settings.backups").firstMatch
        XCTAssertTrue(reveal(app, backup))
        backup.tap()
        let close = app.buttons.matching(identifier: "tiflo.backup.close").firstMatch
        XCTAssertTrue(close.waitForExistence(timeout: 30))
        capture(app, "14-backups")
        // No changes to backup configuration, no uploads or restoration.
    }

    func testStandard() { audit(0) }
    func testLarge() { audit(3) }
}
