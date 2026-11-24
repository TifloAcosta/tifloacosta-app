import SwiftUI
import CryptoKit

struct NativeAudiocinematecaBrowser: View {
    @State private var entries: [NativeAudiocinematecaCatalogueIndex.Entry] = []
    @State private var query = ""
    @State private var kind: AccessibleCinemaKind = .all
    @State private var language: AccessibleCinemaLanguage = .all
    @State private var loading = false
    @State private var loaded = false
    @State private var errorMessage = ""
    @State private var limit = 100
    @State private var hasAccount = false
    @State private var accountScreen = false

    private var filtered: [NativeAudiocinematecaCatalogueIndex.Entry] {
        let categories: [AccessibleCinemaKind: String] = [
            .film: "peliculas", .series: "series", .documentary: "documentales", .short: "cortometrajes"
        ]
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return entries.filter { entry in
            (kind == .all || entry.category == categories[kind]) &&
            (language == .all || (language == .spain && entry.languageCode == "0") ||
                (language == .latino && entry.languageCode == "1")) &&
            (needle.isEmpty || [entry.title, entry.year, entry.genre, entry.synopsis].contains {
                $0.range(of: needle, options: [.caseInsensitive, .diacriticInsensitive]) != nil
            })
        }
    }

    var body: some View {
        List {
            if !hasAccount {
                Button("Cuenta de Audiocinemateca") { accountScreen = true }
            } else {
                Button("Cuenta de Audiocinemateca") { accountScreen = true }
                Button("Actualizar catálogo") { Task { await refresh() } }
                    .disabled(loading)
                if loading { ProgressView("Actualizando catálogo") }
                if !errorMessage.isEmpty { Text(errorMessage) }
                if loaded {
                    Section("Obras disponibles") {
                        Picker("Tipo de contenido", selection: $kind) {
                            ForEach(AccessibleCinemaKind.allCases, id: \.self) { value in
                                Text(MusicLocalized.message(value.rawValue)).tag(value)
                            }
                        }
                        Picker("Idioma", selection: $language) {
                            ForEach([AccessibleCinemaLanguage.all, .spain, .latino], id: \.self) { value in
                                Text(MusicLocalized.message(value.rawValue)).tag(value)
                            }
                        }
                        let results = filtered
                        Text(MusicLocalized.format("Resultados: %d", results.count))
                        ForEach(results.prefix(limit)) { entry in
                            NavigationLink {
                                NativeAudiocinematecaDetail(entry: entry)
                            } label: {
                                VStack(alignment: .leading) {
                                    Text(entry.title)
                                    if !entry.year.isEmpty { Text(entry.year).font(.subheadline) }
                                }
                                .accessibilityElement(children: .combine)
                            }
                        }
                        if results.count > limit {
                            Button("Cargar más resultados") { limit += 100 }
                        }
                    }
                }
            }
        }
        .navigationTitle("Audiocinemateca")
        .sheet(isPresented: $accountScreen, onDismiss: {
            entries = []
            loaded = false
            hasAccount = NativeAudiocinematecaCredentials.load() != nil
            if hasAccount { Task { await refresh() } }
        }) {
            NavigationStack {
                NativeAudiocinematecaAccountScreen()
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Cerrar") { accountScreen = false } } }
            }
        }
        .searchable(text: $query, prompt: Text("Buscar obras"))
        .onChange(of: query) { _, _ in limit = 100 }
        .onChange(of: kind) { _, _ in limit = 100 }
        .onChange(of: language) { _, _ in limit = 100 }
        .task {
            hasAccount = NativeAudiocinematecaCredentials.load() != nil
            if hasAccount && !loaded { await refresh() }
        }
        .refreshable { if hasAccount { await refresh() } }
    }

    @MainActor private func refresh() async {
        guard !loading, let account = NativeAudiocinematecaCredentials.load() else {
            return
        }
        loading = true
        errorMessage = ""
        defer { loading = false }
        do {
            let result = try await NativeAudiocinematecaCache.shared.refresh(account: account)
            try Task.checkCancellation()
            guard let current = NativeAudiocinematecaCredentials.load(),
                  current.username == account.username, current.password == account.password else {
                entries = []
                loaded = false
                return
            }
            entries = result.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
            loaded = true
        } catch is CancellationError {
            return
        } catch NativeAudiocinematecaCatalogueError.denied {
            entries = []
            loaded = false
            errorMessage = MusicLocalized.message("Audiocinemateca ha rechazado el acceso. Revisa tu cuenta.")
        } catch {
            errorMessage = MusicLocalized.message("No se ha podido actualizar el catálogo.")
        }
    }
}

struct NativeAudiocinematecaDetail: View {
    let entry: NativeAudiocinematecaCatalogueIndex.Entry
    var body: some View {
        List {
            Section("Ficha de la obra") {
                Text(entry.title).accessibilityAddTraits(.isHeader)
                if !entry.year.isEmpty { Text(entry.year) }
                if !entry.genre.isEmpty { Text(entry.genre) }
                if entry.languageCode == "0" { Text("Español de España") }
                if entry.languageCode == "1" { Text("Español de Latinoamérica") }
                if !entry.synopsis.isEmpty { Text(entry.synopsis) }
            }
            if entry.category == "series" {
                let seasons = Set(entry.parts.compactMap(\.season)).sorted {
                    $0.localizedStandardCompare($1) == .orderedAscending
                }
                ForEach(seasons, id: \.self) { season in
                    NavigationLink(MusicLocalized.format("Temporada %@", season)) {
                        List {
                            ForEach(entry.parts.filter { $0.season == season }.sorted {
                                $0.number.localizedStandardCompare($1.number) == .orderedAscending
                            }) { part in
                                NativeAudiocinematecaPlaybackRow(entry: entry, part: part, label: MusicLocalized.format("Episodio %@: %@", part.number, part.title))
                            }
                        }
                        .navigationTitle(MusicLocalized.format("Temporada %@", season))
                    }
                }
            } else if !entry.parts.isEmpty {
                Section("Partes de la obra") {
                    ForEach(entry.parts) { part in
                        NativeAudiocinematecaPlaybackRow(entry: entry, part: part, label: entry.parts.count == 1 ? MusicLocalized.message("Reproducir") : MusicLocalized.format("Parte %@", part.number))
                    }
                }
            }
            Link("Abrir Audiocinemateca en la web", destination: URL(string: "https://audiocinemateca.com/catalogo")!)
        }
        .navigationTitle(entry.title)
    }
}

private struct NativeAudiocinematecaPlaybackRow: View {
    let entry: NativeAudiocinematecaCatalogueIndex.Entry
    let part: NativeAudiocinematecaCatalogueIndex.Part
    let label: String
    @ObservedObject private var player = NativeCinemaAudioPlayer.shared
    @ObservedObject private var library = NativeCinemaLocalLibrary.shared
    @State private var failed = false

    private var reference: String {
        let identity = entry.id + ":" + (part.season ?? "") + ":" + part.number + ":" + part.url.absoluteString
        return "audiocinemateca:" + SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    var body: some View {
        VStack(alignment: .leading) {
            if player.currentCloudReference == reference {
                Text(label)
                if let error = player.playbackError { Text(error) }
                Button(player.playing ? "Pausar" : "Reproducir") {
                    player.toggle(library: library)
                }
                .disabled(player.playbackError != nil)
                Button("Retroceder treinta segundos") { player.seek(by: -30, library: library) }
                Button("Avanzar treinta segundos") { player.seek(by: 30, library: library) }
                Button("Detener reproducción") { player.pauseAndSave(library: library) }
            } else {
                Button(label) {
                    failed = false
                    guard let account = NativeAudiocinematecaCredentials.load(),
                          let loader = NativeAudiocinematecaResourceLoader(url: part.url, account: account, allowsCellular: true) else {
                        failed = true
                        return
                    }
                    do {
                        try player.openAudiocinematecaStream(asset: loader.makeAsset(), loader: loader,
                            title: entry.title + (part.title.isEmpty ? "" : " — " + part.title),
                            reference: reference, isVideo: false, library: library)
                    } catch {
                        loader.cancel()
                        failed = true
                    }
                }
            }
            if failed { Text("No se pudo reproducir este archivo. Comprueba que el formato es compatible.") }
        }
    }
}
