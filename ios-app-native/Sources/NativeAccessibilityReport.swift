import Foundation
import SwiftUI
import UIKit

/// Diagnostics are collected locally, never uploaded or sent automatically.
/// Never include book text, account credentials, API keys, or library paths.
enum NativeSupportDiagnostics {
    static var version: String {
        let values = Bundle.main.infoDictionary
        let release = values?["CFBundleShortVersionString"] as? String ?? MusicLocalized.message("Sin datos")
        let build = values?["CFBundleVersion"] as? String ?? MusicLocalized.message("Sin datos")
        return "\(release) (\(build))"
    }

    static var systemDetails: String {
        [
            MusicLocalized.format("Aplicación: TifloAcosta para iOS, versión %@", version),
            MusicLocalized.format("Sistema: iOS %@", UIDevice.current.systemVersion),
            MusicLocalized.format("Dispositivo: %@", UIDevice.current.model),
            MusicLocalized.format("VoiceOver: %@", MusicLocalized.message(UIAccessibility.isVoiceOverRunning ? "Activado" : "Desactivado")),
            MusicLocalized.format("Reducir movimiento: %@", MusicLocalized.message(UIAccessibility.isReduceMotionEnabled ? "Activado" : "Desactivado")),
            MusicLocalized.format("Texto en negrita del sistema: %@", MusicLocalized.message(UIAccessibility.isBoldTextEnabled ? "Activado" : "Desactivado"))
        ].joined(separator: "\n")
    }

    static func report(category: String, detail: String, steps: String,
                       includeDiagnostics: Bool, catalogSummary: String = "") -> String {
        var result = MusicLocalized.message("Incidencia de TifloAcosta") + "\n" +
            MusicLocalized.format("Sección: %@", MusicLocalized.message(category)) + "\n\n" +
            MusicLocalized.message("Descripción:") + "\n" + detail.trimmingCharacters(in: .whitespacesAndNewlines)
        if !steps.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            result += "\n\n" + MusicLocalized.message("Pasos para reproducir:") + "\n" +
                steps.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if includeDiagnostics {
            result += "\n\n" + MusicLocalized.message("Diagnóstico básico:") + "\n" + systemDetails
            if !catalogSummary.isEmpty { result += "\n" + catalogSummary }
        }
        return result
    }
}

struct NativeAccessibilityReportScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    @State private var categoryIndex = 0
    @State private var description = ""
    @State private var steps = ""
    @State private var includeDiagnostics = false
    @State private var status: String?
    @FocusState private var activeField: Field?

    private enum Field: Hashable { case description, steps }
    private let categories = [
        "Accesibilidad y VoiceOver", "TifloLector", "Recursos",
        "Actualidad", "Vídeos", "Pódcast", "Notificaciones", "Otro"
    ]

    private var catalogSummary: String {
        let updated = catalog.lastUpdated?.formatted(date: .abbreviated, time: .shortened)
            ?? MusicLocalized.message("Sin actualización confirmada")
        return MusicLocalized.format("Catálogo. Recursos: %d. Vídeos: %d. Noticias: %d. Última actualización: %@. Estado: %@.", catalog.resources.count, catalog.videos.count, catalog.news.count, updated, MusicLocalized.message(catalog.error == nil ? "Sin error declarado" : "Actualización con incidencia"))
    }

    private var reportText: String {
        NativeSupportDiagnostics.report(
            category: categories[categoryIndex],
            detail: description,
            steps: steps,
            includeDiagnostics: includeDiagnostics,
            catalogSummary: catalogSummary
        )
    }

    private var canShare: Bool {
        !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var supportMailURL: URL? {
        var components = URLComponents()
        components.scheme = "mailto"
        components.path = "tifloacosta@gmail.com"
        components.queryItems = [
            URLQueryItem(name: "subject", value: MusicLocalized.message("Incidencia de TifloAcosta")),
            URLQueryItem(name: "body", value: reportText)
        ]
        return components.url
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
                Text("Se incluirán versión de la app y de iOS, tipo genérico de dispositivo, estado de VoiceOver, ajustes de movimiento y texto en negrita y resumen del catálogo. Todo permanece en el dispositivo hasta que decidas compartirlo.")
                    .font(.footnote).foregroundStyle(.secondary)
                Text("No se adjuntan documentos, historiales, contraseñas, claves de API ni datos de cuentas. Revisa tu texto antes de compartirlo.")
                    .font(.footnote).foregroundStyle(.secondary)
                if includeDiagnostics {
                    Text(NativeSupportDiagnostics.systemDetails + "\n" + catalogSummary)
                        .font(.footnote)
                        .textSelection(.enabled)
                }
            }

            Section("Enviar o copiar") {
                if let supportMailURL {
                    Link(destination: supportMailURL) {
                        Label("Escribir a TifloAcosta por correo", systemImage: "envelope")
                    }
                    .disabled(!canShare)
                }
                ShareLink(item: reportText, subject: Text("Incidencia de TifloAcosta"),
                          preview: SharePreview("Incidencia de TifloAcosta")) {
                    Label("Compartir informe de incidencia", systemImage: "square.and.arrow.up")
                }
                .disabled(!canShare)
                Button("Copiar informe") {
                    UIPasteboard.general.string = reportText
                    status = MusicLocalized.message("Informe copiado. Puedes pegarlo en el correo o servicio que prefieras.")
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
