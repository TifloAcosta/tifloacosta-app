import SwiftUI
import UIKit
import AVFoundation
import UniformTypeIdentifiers
import Combine

/// Renders local video with the same AVPlayer used by the accessible native
/// pause, seek and stop buttons. The visual layer exposes no duplicate VoiceOver
/// controls and it does not capture the user's accessibility focus.
final class NativeCinemaVideoUIView: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}

struct NativeCinemaVideoSurface: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> NativeCinemaVideoUIView {
        let view = NativeCinemaVideoUIView()
        view.playerLayer.videoGravity = .resizeAspect
        view.playerLayer.player = player
        view.isAccessibilityElement = false
        view.accessibilityElementsHidden = true
        return view
    }

    func updateUIView(_ uiView: NativeCinemaVideoUIView, context: Context) {
        if uiView.playerLayer.player !== player {
            uiView.playerLayer.player = player
        }
    }

    static func dismantleUIView(_ uiView: NativeCinemaVideoUIView, coordinator: ()) {
        uiView.playerLayer.player = nil
    }
}

/// Multicines Accesibles: native entry point and verified-source directory.
/// Only the original provider can deliver third-party works unless distribution
/// and streaming permissions have been explicitly documented.
enum AccessibleCinemaLanguage: String, CaseIterable, Codable {
    case all = "Todos los idiomas"
    case spain = "Español de España"
    case latino = "Español de Latinoamérica"
    case english = "Inglés"
    case french = "Francés"
    case portuguese = "Portugués"
    case italian = "Italiano"
    case german = "Alemán"
}

enum AccessibleCinemaKind: String, CaseIterable, Codable {
    case all = "Todos los contenidos"
    case film = "Películas"
    case series = "Series"
    case documentary = "Documentales"
    case short = "Cortometrajes"
}

private struct AccessibleCinemaSource: Identifiable {
    let id: String
    let name: String
    let languages: Set<AccessibleCinemaLanguage>
    let kinds: Set<AccessibleCinemaKind>
    let address: URL?
    let access: String
    let description: String
    let geographicNotice: String
    let isAudioOnly: Bool

    var detail: String {
        let format = isAudioOnly ? "Solo audio con audiodescripción." : "Vídeo con audiodescripción según el título."
        let parts = [description, format, access, geographicNotice].filter { !$0.isEmpty }
        return parts.map { MusicLocalized.message($0) }.joined(separator: " ")
    }
}

/// The list contains original platform URLs only. An external link is never
/// represented as if a particular film had been checked or could play inline.
/// Audesc source IDs are reserved for a permission-verified catalogue feed:
/// never publish a personally shared Drive link in a public source repository.
private enum AccessibleCinemaDirectory {
    static let sources: [AccessibleCinemaSource] = [
        .init(id: "audesc-es", name: "Audesc España",
              languages: [.spain], kinds: [.film, .series, .documentary, .short],
              address: nil, access: "Enlace oficial pendiente de incorporación segura.",
              description: "Biblioteca de películas, series, documentales y cortometrajes audiodescritos.",
              geographicNotice: "", isAudioOnly: true),
        .init(id: "audesc-latino", name: "Audesc Latino",
              languages: [.latino], kinds: [.film, .series, .documentary],
              address: nil, access: "Enlace oficial pendiente de incorporación segura.",
              description: "Biblioteca con audiodescripción y voces del ámbito latinoamericano.",
              geographicNotice: "", isAudioOnly: true),
        .init(id: "foal", name: "FOAL, ocio en audio",
              languages: [.latino, .spain], kinds: [.film, .series],
              address: URL(string: "https://www.foal.es/es/recursos/ocio-en-audio"),
              access: "Acceso gratuito desde la página oficial.",
              description: "La Fundación ONCE para América Latina enlaza películas y una serie completas en MP3.",
              geographicNotice: "", isAudioOnly: true),
        .init(id: "audiocinemateca", name: "Audiocinemateca",
              languages: [.spain, .latino], kinds: [.film, .series, .documentary, .short],
              // The catalogue page is accessible after authentication on
              // Audiocinemateca. No protected API or private download URL is
              // accessed by TifloAcosta without the partner's agreed contract.
              address: URL(string: "https://audiocinemateca.com/catalogo"),
              access: "Registro gratuito e inicio de sesión en el servicio original.",
              description: "Películas, series, documentales y cortos audiodescritos.",
              geographicNotice: "", isAudioOnly: true),
        // AMI is dedicated to described media rather than a general-purpose
        // television catalogue. Separate the English and French services so
        // language filters never send users to a mismatched homepage.
        .init(id: "ami", name: "AMI-tv y AMI+",
              languages: [.english], kinds: [.series, .documentary],
              address: URL(string: "https://www.ami.ca/tv"),
              access: "Servicio especializado en programas con descripción integrada.",
              description: "Programación accesible con audiodescripción integrada.",
              geographicNotice: "Disponibilidad variable fuera de Canadá.", isAudioOnly: false),
        .init(id: "ami-fr", name: "AMI-télé",
              languages: [.french], kinds: [.series, .documentary],
              address: URL(string: "https://www.amitele.ca/"),
              access: "Servicio especializado en programas con descripción integrada.",
              description: "Programación accesible en francés con descripción integrada.",
              geographicNotice: "Disponibilidad variable fuera de Canadá.", isAudioOnly: false),
        // ARD is generalist, but this official destination shows its
        // audio-described collection, never the undifferentiated homepage.
        .init(id: "ard", name: "ARD Mediathek, audiodescripción",
              languages: [.german], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.ardmediathek.de/audiodeskription"),
              access: "Colección oficial de audiodescripción.",
              description: "Producciones en alemán con audiodescripción.",
              geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        // ARTE has different official audio-description collections per
        // language; each filter must open the appropriate language variant.
        .init(id: "arte", name: "ARTE (francés)",
              languages: [.french], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.arte.tv/fr/videos/programmes-en-audiodescription/"),
              access: "Colección oficial de audiodescripción.",
              description: "Programas en francés seleccionados por audiodescripción.",
              geographicNotice: "Derechos y disponibilidad dependientes del país.", isAudioOnly: false),
        .init(id: "arte-de", name: "ARTE (alemán)",
              languages: [.german], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.arte.tv/de/videos/programme-mit-audiodeskription/"),
              access: "Colección oficial de audiodescripción.",
              description: "Programas en alemán seleccionados por audiodescripción.",
              geographicNotice: "Derechos y disponibilidad dependientes del país.", isAudioOnly: false)
    ]
}

/// Public collections explicitly described by their official publishers.
/// A collection is not an individual film and is never presented as one.
private struct AccessibleCinemaCollection: Identifiable {
    let id: String
    let title: String
    let publisher: String
    let language: AccessibleCinemaLanguage
    let kind: AccessibleCinemaKind
    let summary: String
    let originalAddress: URL
}

private enum AccessibleCinemaCollections {
    static let items: [AccessibleCinemaCollection] = [
        .init(id: "foal-films",
              title: "50 películas con audiodescripción",
              publisher: "Fundación ONCE para América Latina (FOAL)",
              language: .latino,
              kind: .film,
              summary: "Películas completas en formato MP3. La página oficial ofrece acceso a la carpeta de audio sin necesidad de descargar cada película.",
              originalAddress: URL(string: "https://bit.ly/2yMtJrk")!),
        .init(id: "foal-game-of-thrones",
              title: "Juego de Tronos, ocho temporadas",
              publisher: "Fundación ONCE para América Latina (FOAL)",
              language: .latino,
              kind: .series,
              summary: "Serie completa, solo audio con audiodescripción. Enlace al catálogo publicado oficialmente por FOAL.",
              originalAddress: URL(string: "https://bit.ly/3bND3dg")!)
    ]
}

struct NativeAccessibleCinemaScreen: View {
    @State private var searchText = ""
    @AppStorage("native-cinema-language-index-v1") private var languageIndex = 0
    @AppStorage("native-cinema-content-index-v1") private var contentIndex = 0
    @AppStorage("native-cinema-import-language-index-v1") private var importLanguageIndex = 1
    @AppStorage("native-cinema-import-kind-index-v1") private var importKindIndex = 1
    @State private var selectingPersonalFiles = false
    @State private var importStatus = ""
    @State private var pendingDeletion: NativeCinemaLocalItem?
    @State private var confirmDeletion = false
    // Shared instances allow personal playback to continue after leaving Multicines.
    @StateObject private var personalLibrary = NativeCinemaLocalLibrary.shared
    @StateObject private var personalPlayer = NativeCinemaAudioPlayer.shared

    private var selectedLanguage: AccessibleCinemaLanguage {
        AccessibleCinemaLanguage.allCases[min(max(0, languageIndex), AccessibleCinemaLanguage.allCases.count - 1)]
    }

    private var selectedKind: AccessibleCinemaKind {
        AccessibleCinemaKind.allCases[min(max(0, contentIndex), AccessibleCinemaKind.allCases.count - 1)]
    }

    private var filtered: [AccessibleCinemaSource] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return AccessibleCinemaDirectory.sources.filter { source in
            let languageMatches = selectedLanguage == .all || source.languages.contains(selectedLanguage)
            let typeMatches = selectedKind == .all || source.kinds.contains(selectedKind)
            let queryMatches = query.isEmpty || [MusicLocalized.message(source.name), source.description, source.detail]
                .contains(where: { $0.localizedStandardContains(query) })
            return languageMatches && typeMatches && queryMatches
        }
    }

    private var featuredCollections: [AccessibleCinemaCollection] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return AccessibleCinemaCollections.items.filter { item in
            (selectedLanguage == .all || item.language == selectedLanguage)
                && (selectedKind == .all || item.kind == selectedKind)
                && (query.isEmpty || [
                    MusicLocalized.message(item.title), item.publisher,
                    MusicLocalized.message(item.summary)
                ].contains(where: { $0.localizedStandardContains(query) }))
        }
    }

    private var personalItems: [NativeCinemaLocalItem] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return personalLibrary.items.filter { item in
            (selectedLanguage == .all || selectedLanguage == item.language)
                && (selectedKind == .all || selectedKind == item.kind)
                && (query.isEmpty || item.title.localizedStandardContains(query))
        }
        .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }

    private func clock(_ seconds: Double) -> String {
        let value = Int(max(0, min(seconds.isFinite ? seconds : 0, 86_400_000)))
        return String(format: "%02d:%02d:%02d", value / 3600,
                      (value % 3600) / 60, value % 60)
    }

    @MainActor private func importPersonalFiles(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            importStatus = error.localizedDescription
        case .success(let files):
            var imported = 0
            var problems: [String] = []
            let language = AccessibleCinemaLanguage.allCases[
                min(max(1, importLanguageIndex), AccessibleCinemaLanguage.allCases.count - 1)]
            let kind = AccessibleCinemaKind.allCases[
                min(max(1, importKindIndex), AccessibleCinemaKind.allCases.count - 1)]
            for file in files {
                do {
                    try personalLibrary.importAudio(from: file, language: language, kind: kind)
                    imported += 1
                } catch {
                    problems.append(file.lastPathComponent + ": " + error.localizedDescription)
                }
            }
            importStatus = MusicLocalized.format("Archivos importados: %d. Fallos: %d.", imported, problems.count)
            if let first = problems.first { importStatus += " " + first }
            UIAccessibility.post(notification: .announcement, argument: importStatus)
        }
    }

    @MainActor private func importCloudAudio(_ url: URL) throws {
        let language = AccessibleCinemaLanguage.allCases[
            min(max(1, importLanguageIndex), AccessibleCinemaLanguage.allCases.count - 1)]
        let kind = AccessibleCinemaKind.allCases[
            min(max(1, importKindIndex), AccessibleCinemaKind.allCases.count - 1)]
        let item = try personalLibrary.importAudio(from: url, language: language, kind: kind)
        importStatus = MusicLocalized.format("Archivo incorporado: %@", item.title)
    }

    var body: some View {
        List {
            Section("Explorar Multicines Accesibles") {
                TextField("Buscar plataformas y contenidos audiodescritos", text: $searchText)
                    .textInputAutocapitalization(.sentences)
                    .submitLabel(.search)
                    .accessibilityHint("Filtra por nombre o descripción de la fuente.")
                NativeAdjustableChoice(
                    title: "Idioma de audiodescripción",
                    choices: AccessibleCinemaLanguage.allCases.map(\.rawValue),
                    selectedIndex: $languageIndex
                )
                NativeAdjustableChoice(
                    title: "Tipo de contenido",
                    choices: AccessibleCinemaKind.allCases.map(\.rawValue),
                    selectedIndex: $contentIndex
                )
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Mi colección personal") {
                Text("Añade tus propios archivos de audio o vídeo. Se conservarán en el iPhone para reproducirlos en TifloAcosta, con la última posición de escucha.")
                    .font(.footnote)
                NativeAdjustableChoice(
                    title: "Idioma de los archivos que vas a importar",
                    choices: Array(AccessibleCinemaLanguage.allCases.dropFirst()).map(\.rawValue),
                    selectedIndex: Binding(
                        get: { max(0, importLanguageIndex - 1) },
                        set: { importLanguageIndex = $0 + 1 }))
                NativeAdjustableChoice(
                    title: "Tipo de archivo que vas a importar",
                    choices: Array(AccessibleCinemaKind.allCases.dropFirst()).map(\.rawValue),
                    selectedIndex: Binding(
                        get: { max(0, importKindIndex - 1) },
                        set: { importKindIndex = $0 + 1 }))
                Button("Importar audio o vídeo desde Archivos") {
                    selectingPersonalFiles = true
                }
                .frame(minHeight: 44, alignment: .leading)
                if !importStatus.isEmpty {
                    Text(importStatus)
                        .font(.footnote)
                        .accessibilityAddTraits(.updatesFrequently)
                }
                if personalItems.isEmpty {
                    Text("No hay obras personales para estos filtros.")
                        .font(.footnote)
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                ForEach(personalItems) { item in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(item.title)
                            .font(.headline)
                            .accessibilityAddTraits(.isHeader)
                        Text(item.language.rawValue + ", " + item.kind.rawValue)
                            .font(.subheadline)
                        Button("Reproducir: \(item.title)") {
                            do { try personalPlayer.open(item, library: personalLibrary) }
                            catch { importStatus = error.localizedDescription }
                        }
                        .frame(minHeight: 44, alignment: .leading)
                        if personalPlayer.currentID == item.id {
                            if let playbackError = personalPlayer.playbackError {
                                Text(playbackError)
                                    .foregroundStyle(TifloVisual.secondaryText)
                                    .accessibilityAddTraits(.updatesFrequently)
                            }
                            if item.isVideoFile, let videoPlayer = personalPlayer.videoPlayer {
                                NativeCinemaVideoSurface(player: videoPlayer)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 210)
                                    .accessibilityHidden(true)
                            }
                            Text("Posición: \(clock(personalPlayer.seconds)). Duración: \(clock(personalPlayer.duration)).")
                                .font(.subheadline)
                            Button(personalPlayer.playing ? "Pausar reproducción" : "Reanudar reproducción") {
                                personalPlayer.toggle(library: personalLibrary)
                            }
                            .disabled(personalPlayer.playbackError != nil)
                            Button("Retroceder treinta segundos") {
                                personalPlayer.seek(by: -30, library: personalLibrary)
                            }
                            Button("Avanzar treinta segundos") {
                                personalPlayer.seek(by: 30, library: personalLibrary)
                            }
                            Button("Detener reproducción") {
                                personalPlayer.pauseAndSave(library: personalLibrary)
                            }
                        }
                        Button("Eliminar de mi colección: \(item.title)", role: .destructive) {
                            pendingDeletion = item
                            confirmDeletion = true
                        }
                    }
                    .accessibilityElement(children: .contain)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Nubes") {
                Text("Selecciona tus propios archivos de audio desde una nube conectada. Se importarán a tu colección personal con el idioma y el tipo elegidos arriba.")
                    .font(.footnote)
                NavigationLink("Google Drive") {
                    NativeCloudGooglePickerScreen(
                        onImport: { _ in },
                        allowCellularDownloads: true,
                        onImportValidated: { url in try importCloudAudio(url) }
                    )
                }
                NavigationLink("Dropbox") {
                    NativeCloudFolderBrowserScreen(
                        provider: .dropbox,
                        onImport: { _ in },
                        allowCellularDownloads: true,
                        onImportValidated: { url in try importCloudAudio(url) }
                    )
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            if !featuredCollections.isEmpty {
                Section("Colecciones de obras audiodescritas") {
                    ForEach(featuredCollections) { item in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(MusicLocalized.message(item.title))
                                .font(.headline)
                                .accessibilityAddTraits(.isHeader)
                            Text(item.publisher)
                                .font(.subheadline.weight(.semibold))
                            Text(MusicLocalized.message(item.summary))
                                .font(.subheadline)
                                .foregroundStyle(TifloVisual.secondaryText)
                            Link("Explorar colección en la fuente original",
                                 destination: item.originalAddress)
                                .frame(minHeight: 44, alignment: .leading)
                        }
                        .accessibilityElement(children: .contain)
                    }
                }
                .listRowBackground(TifloVisual.surfaceRaised)
            }

            Section("Fuentes de audiodescripción") {
                if filtered.isEmpty {
                    ContentUnavailableView("No hay fuentes para estos filtros",
                                           systemImage: "film",
                                           description: Text("Prueba otro idioma o tipo de contenido."))
                }
                ForEach(filtered) { source in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(MusicLocalized.message(source.name))
                            .font(.headline)
                            .accessibilityAddTraits(.isHeader)
                        Text(source.detail)
                            .font(.subheadline)
                            .foregroundStyle(TifloVisual.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                        if ["audesc-es", "audesc-latino", "foal"].contains(source.id) {
                            if NativeCinemaPublicDrive.configuredKey != nil {
                                if source.id == "foal" {
                                    NavigationLink("50 películas con audiodescripción") {
                                        NativeCinemaPublishedDriveBrowser(
                                            sourceID: source.id,
                                            sourceName: MusicLocalized.message("FOAL, películas"),
                                            foalCollection: "foal-films")
                                    }
                                    NavigationLink("Juego de Tronos, ocho temporadas") {
                                        NativeCinemaPublishedDriveBrowser(
                                            sourceID: source.id,
                                            sourceName: MusicLocalized.message("FOAL, serie"),
                                            foalCollection: "foal-game-of-thrones")
                                    }
                                } else {
                                    NavigationLink("Explorar catálogo audiodescrito") {
                                        NativeCinemaPublishedDriveBrowser(
                                            sourceID: source.id,
                                            sourceName: MusicLocalized.message(source.name),
                                            foalCollection: nil)
                                    }
                                }
                            }
                            NavigationLink("Explorar carpeta de Google Drive") {
                                NativeCinemaDriveBrowser(
                                    sourceID: source.id,
                                    sourceName: MusicLocalized.message(source.name))
                            }
                            .frame(minHeight: 44, alignment: .leading)
                        }
                        if let address = source.address {
                            Link("Abrir plataforma original: \(MusicLocalized.message(source.name))", destination: address)
                                .font(.body.weight(.semibold))
                                .frame(minHeight: 44, alignment: .leading)
                        } else if !["audesc-es", "audesc-latino"].contains(source.id) {
                            Text("Fuente pendiente de conexión segura")
                                .font(.subheadline)
                                .foregroundStyle(TifloVisual.secondaryText)
                        }
                    }
                    .accessibilityElement(children: .contain)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Sobre el acceso") {
                Text("Las plataformas muestran obras audiodescritas según su catálogo, país y permisos. Abrir la web oficial no significa que todas sus películas tengan audiodescripción.")
                    .font(.footnote)
                Text("Los catálogos públicos se actualizan desde Google Drive cuando la conexión pública está configurada. También puedes elegir carpetas autorizadas con tu propia cuenta.")
                    .font(.footnote)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Multicines Accesibles")
        .fileImporter(
            isPresented: $selectingPersonalFiles,
            allowedContentTypes: [.audio, .movie],
            allowsMultipleSelection: true
        ) { result in
            Task { @MainActor in importPersonalFiles(result) }
        }
        .confirmationDialog(
            MusicLocalized.format("¿Eliminar «%@»?", pendingDeletion?.title ?? ""),
            isPresented: $confirmDeletion, titleVisibility: .visible
        ) {
            Button("Eliminar archivo personal", role: .destructive) {
                guard let item = pendingDeletion else { return }
                if personalPlayer.currentID == item.id {
                    personalPlayer.pauseAndSave(library: personalLibrary)
                }
                do { try personalLibrary.remove(item) }
                catch { importStatus = error.localizedDescription }
                pendingDeletion = nil
            }
            Button("Cancelar", role: .cancel) { pendingDeletion = nil }
        } message: {
            Text("Se eliminará el archivo guardado en esta colección personal.")
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            personalPlayer.refresh(library: personalLibrary)
        }
        .onDisappear { personalPlayer.refresh(library: personalLibrary) }
    }
}
