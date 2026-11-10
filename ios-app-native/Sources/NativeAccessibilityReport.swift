import Foundation
import SwiftUI
import UIKit

/// Diagnostics are collected locally, never uploaded or sent automatically.
/// Never include book text, account credentials, API keys, or library paths.
enum NativeSupportDiagnostics {
    static var version: String {
        let values = Bundle.main.infoDictionary
        let release = values?["CFBundleShortVersionString"] as? String ?? "Sin datos"
        let build = values?["CFBundleVersion"] as? String ?? "Sin datos"
        return "\(release) (\(build))"
    }

    static var systemDetails: String {
        "Aplicación: TifloAcosta para iOS, versión \(version)\n" +
        "Sistema: iOS \(UIDevice.current.systemVersion)\n" +
        "Dispositivo: \(UIDevice.current.model)\n" +
        "VoiceOver: \(UIAccessibility.isVoiceOverRunning ? "activado" : "desactivado")"
    }

    static func report(category: String, detail: String, steps: String,
                       includeDiagnostics: Bool) -> String {
        var result = "Incidencia de TifloAcosta\n" +
            "Sección: \(category)\n\n" +
            "Descripción:\n\(detail.trimmingCharacters(in: .whitespacesAndNewlines))"
        if !steps.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            result += "\n\nPasos para reproducir:\n" +
                steps.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if includeDiagnostics { result += "\n\nDiagnóstico básico:\n" + systemDetails }
        return result
    }
}

struct NativeAccessibilityReportScreen: View {
    @State private var categoryIndex = 0
    @State private var description = ""
    @State private var steps = ""
    @State private var includeDiagnostics = true
    @State private var status: String?
    @FocusState private var activeField: Field?

    private enum Field: Hashable { case description, steps }
    private let categories = [
        "Accesibilidad y VoiceOver", "TifloLector", "Recursos",
        "Actualidad", "Vídeos", "Pódcast", "Notificaciones", "Otro"
    ]

    private var reportText: String {
        NativeSupportDiagnostics.report(
            category: categories[categoryIndex],
            detail: description,
            steps: steps,
            includeDiagnostics: includeDiagnostics
        )
    }

    private var canShare: Bool {
        !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        Form {
            Section("Describe la incidencia") {
                NativeAdjustableChoice(
                    title: "Sección de la aplicación",
                    choices: categories,
                    selectedIndex: $categoryIndex
                )

                Text("¿Qué ha sucedido?").font(.headline)
                TextEditor(text: $description)
                    .frame(minHeight: 110)
                    .focused($activeField, equals: .description)
                    .accessibilityLabel("Descripción de la incidencia")
                    .accessibilityHint("Explica qué sucede y qué debería ocurrir.")

                Text("Pasos para reproducir el fallo (opcional)").font(.headline)
                TextEditor(text: $steps)
                    .frame(minHeight: 90)
                    .focused($activeField, equals: .steps)
                    .accessibilityLabel("Pasos para reproducir el fallo")
            }

            Section("Información técnica") {
                Toggle("Incluir diagnóstico básico", isOn: $includeDiagnostics)
                Text("Solo se incluirán versión de TifloAcosta, versión de iOS, tipo genérico de dispositivo y estado de VoiceOver.")
                    .font(.footnote).foregroundStyle(.secondary)
                Text("No se adjuntan documentos, historiales, contraseñas, claves de API ni datos de cuentas. Revisa tu texto antes de compartirlo.")
                    .font(.footnote).foregroundStyle(.secondary)
                if includeDiagnostics {
                    Text(NativeSupportDiagnostics.systemDetails)
                        .font(.footnote)
                        .textSelection(.enabled)
                }
            }

            Section("Enviar o copiar") {
                ShareLink(item: reportText, subject: Text("Incidencia de TifloAcosta"),
                          preview: SharePreview("Incidencia de TifloAcosta")) {
                    Label("Compartir informe de incidencia", systemImage: "square.and.arrow.up")
                }
                .disabled(!canShare)
                Button("Copiar informe") {
                    UIPasteboard.general.string = reportText
                    status = "Informe copiado. Puedes pegarlo en el correo o servicio que prefieras."
                    UIAccessibility.post(notification: .announcement, argument: status)
                }
                .disabled(!canShare)
                Text("El informe solo se comparte cuando eliges una aplicación y confirmas el envío. No se envía automáticamente.")
                    .font(.footnote).foregroundStyle(.secondary)
                if let status {
                    Text(status).font(.footnote).accessibilityAddTraits(.updatesFrequently)
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Comunicar incidencia")
    }
}
