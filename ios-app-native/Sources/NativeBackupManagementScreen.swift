import SwiftUI
import UIKit

private extension NativeBackupManifest.Section {
    var backupLabel: String {
        switch self {
        case .reader: return "TifloLector"
        case .music: return "Mi música"
        case .cinema: return "Multicines Accesibles"
        case .podcasts: return "Pódcast"
        case .radio: return "Emisoras favoritas"
        case .preferences: return "Preferencias y favoritos"
        }
    }
}

private extension NativeBackupAutomaticState.Frequency {
    var backupLabel: String {
        switch self {
        case .daily: return "Cada día"
        case .weekly: return "Cada semana"
        case .monthly: return "Cada 30 días"
        }
    }
}

private extension NativeBackupSyncPolicy.Availability {
    var backupLabel: String {
        switch self {
        case .localOnly: return "Solo en este dispositivo"
        case .cloudOnly: return "Solo en iCloud"
        case .both: return "En este dispositivo y en iCloud"
        case .awaitingCloud: return "Pendiente de sincronización con iCloud"
        case .conflict: return "Conflicto entre copias"
        case .failed: return "Error de sincronización"
        }
    }
}

/// A dedicated modal, rather than a new home section. Creation, upload,
/// download, preview and commit are distinct operations. Only the final
/// confirmed restore can modify live stores.
@MainActor
struct NativeBackupManagementScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.locale) private var locale
    @EnvironmentObject private var library: NativeReaderLibrary
    @EnvironmentObject private var inbox: NativeShareInbox
    @EnvironmentObject private var favorites: NativeFavoritesStore
    @EnvironmentObject private var activity: NativeReadingActivity
    @EnvironmentObject private var podcastLibrary: NativePodcastLibrary
    @EnvironmentObject private var podcastDownloads: NativePodcastDownloads
    @EnvironmentObject private var podcastPlayer: NativePodcastPlayer
    @ObservedObject private var backups = NativeBackupCoordinator.shared

    @State private var sections = NativeBackupCoordinator.supportedSections
    @State private var automaticSections = NativeBackupCoordinator.supportedSections
    @State private var frequency: NativeBackupAutomaticState.Frequency = .weekly
    @State private var configuration: NativeBackupAutomaticState?
    @State private var entries: [NativeBackupSyncPolicy.Entry] = []
    @State private var metadataComplete = false
    @State private var cloudUnavailable = false
    @State private var configurationUnreadable = false
    @State private var status = ""
    @State private var phase = ""
    @State private var job: Task<Void, Never>?
    @State private var preview: NativeBackupCoordinator.RestoreReport?
    @State private var confirmation: Confirmation?
    @State private var selectedEntry: NativeBackupSyncPolicy.Entry?
    @AccessibilityFocusState private var focusedStatus: Bool

    private enum Confirmation: String, Identifiable {
        case createCloud, upload, download, restore, configure, disable
        var id: String { rawValue }
        var title: String {
            switch self {
            case .createCloud, .upload: return "Enviar copia a iCloud"
            case .download: return "Descargar copia de iCloud"
            case .restore: return "Confirmar restauración"
            case .configure: return "Activar copias automáticas"
            case .disable: return "Desactivar copias automáticas"
            }
        }
        var message: String {
            switch self {
            case .createCloud, .upload:
                return "Los contenidos seleccionados se guardarán en tu cuenta de iCloud. No se incluyen contraseñas ni claves de acceso."
            case .download:
                return "Se descargará y comprobará la copia. Todavía no se modificarán tus bibliotecas."
            case .restore:
                return "Se añadirán los elementos que falten. Los elementos y ajustes que ya existen se conservarán. Revisa el informe antes de continuar."
            case .configure:
                return "Autorizas el envío periódico de los contenidos seleccionados a la cuenta actual de iCloud. Las copias se comprueban cuando TifloAcosta está abierto."
            case .disable:
                return "Se detendrán las futuras copias automáticas. Las copias existentes y las pendientes se conservarán."
            }
        }
    }

    private var busy: Bool { job != nil || backups.operationInProgress }
    private var canCollect: Bool {
        scenePhase == .active && backups.isManagingBackups && !backups.requiresRecovery &&
            inbox.readyForBackupManagement && podcastPlayer.episode == nil &&
            NativeRemotePlaybackOwner.current == nil && library.readyForGlobalRestore &&
            NativeMusicBackupAdapter.readyForRestore && podcastLibrary.readyForGlobalRestore &&
            podcastDownloads.downloadingID == nil
    }

    private func selectionBinding(_ section: NativeBackupManifest.Section, automatic: Bool) -> Binding<Bool> {
        Binding(get: { (automatic ? automaticSections : sections).contains(section) }, set: { enabled in
            if automatic {
                if enabled { automaticSections.insert(section) } else { automaticSections.remove(section) }
            } else {
                if enabled { sections.insert(section) } else { sections.remove(section) }
            }
        })
    }

    private func sectionNames(_ manifest: NativeBackupManifest) -> String {
        manifest.artifacts.map { MusicLocalized.message($0.section.backupLabel) }.joined(separator: ", ")
    }

    private func dateLabel(_ date: Date) -> String {
        date.formatted(Date.FormatStyle(date: .abbreviated, time: .shortened, locale: locale))
    }

    private func sizeLabel(_ manifest: NativeBackupManifest) -> String {
        // Manifest validation caps artifact sizes before cloud import. Avoid
        // overflow even when reading an older local manifest.
        var total: Int64 = 0
        for item in manifest.artifacts {
            let (next, overflow) = total.addingReportingOverflow(item.byteCount)
            if overflow { return MusicLocalized.message("Tamaño desconocido") }
            total = next
        }
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: total)
    }

    private func announce(_ key: String) {
        status = MusicLocalized.message(key)
        UIAccessibility.post(notification: .announcement, argument: status)
    }

    private func loadConfiguration() {
        do {
            configuration = try backups.automaticConfiguration()
            configurationUnreadable = false
            if let configuration {
                automaticSections = configuration.sections
                frequency = configuration.frequency
            }
        } catch { configurationUnreadable = true }
    }

    private func refreshHistory() async throws {
        let history = try await backups.synchronizedHistory()
        try Task.checkCancellation()
        entries = history.entries
        metadataComplete = history.initialMetadataGatheringComplete
        cloudUnavailable = history.cloudError != nil
    }

    private func start(_ label: String, operation: @escaping @MainActor () async throws -> Void) {
        guard !busy else { return }
        phase = label
        status = ""
        job = Task { @MainActor in
            defer { job = nil; phase = "" }
            do { try await operation() }
            catch is CancellationError { announce("Operación cancelada. Se conservan las copias existentes.") }
            catch NativeBackupCoordinator.Failure.incompleteRestore(let updated) {
                preview = updated
                announce("El informe ha cambiado. Revísalo y confirma de nuevo.")
            } catch NativeBackupCoordinator.Failure.liveStoresNotQuiescent {
                announce("Cierra las reproducciones y espera a que terminen las importaciones.")
            } catch NativeBackupCloudStore.Failure.noAccount {
                announce("No hay una cuenta de iCloud disponible. La copia local se conserva.")
            } catch NativeBackupCloudStore.Failure.automaticAuthorizationRequired {
                announce("La autorización de iCloud ya no está disponible. Configura de nuevo las copias automáticas.")
            } catch NativeBackupCloudStore.Failure.conflict {
                announce("Se ha detectado un conflicto. No se ha sustituido ninguna copia.")
            } catch {
                if backups.requiresRecovery {
                    announce("No se pudo completar la recuperación de la copia de seguridad.")
                } else {
                    announce("No se pudo completar la operación. Las copias existentes no se han eliminado.")
                }
            }
            focusedStatus = true
        }
    }

    private func create(cloud: Bool) {
        let selected = sections
        start("Preparando copia de seguridad") {
            guard canCollect else { throw NativeBackupCoordinator.Failure.liveStoresNotQuiescent }
            let manifest = try await backups.create(sections: selected, reader: library,
                podcastLibrary: podcastLibrary, podcastDownloads: podcastDownloads,
                favorites: favorites, activity: activity)
            announce("Copia local creada correctamente.")
            if cloud {
                phase = "Enviando copia a iCloud"
                let result = try await backups.uploadToICloud(generation: manifest.generation)
                announce(result == .uploaded ? "Copia confirmada en iCloud." : "Copia local guardada. La subida a iCloud está pendiente.")
            }
            try await refreshHistory()
        }
    }

    private func upload(_ entry: NativeBackupSyncPolicy.Entry) {
        start("Enviando copia a iCloud") {
            let result = try await backups.uploadToICloud(generation: entry.generation)
            announce(result == .uploaded ? "Copia confirmada en iCloud." : "Copia local guardada. La subida a iCloud está pendiente.")
            try await refreshHistory()
        }
    }

    private func download(_ entry: NativeBackupSyncPolicy.Entry) {
        start("Descargando y verificando copia") {
            _ = try await backups.downloadFromICloud(generation: entry.generation)
            announce("Copia descargada y verificada. Tus datos no han cambiado.")
            try await refreshHistory()
        }
    }

    private func restore(generation: UUID, approved: NativeBackupCoordinator.RestoreOmissionSummary? = nil) {
        start(approved == nil ? "Preparando informe de restauración" : "Restaurando copia de seguridad") {
            guard canCollect else { throw NativeBackupCoordinator.Failure.liveStoresNotQuiescent }
            let report = try await backups.restoreLocalGeneration(generation: generation, reader: library,
                podcastLibrary: podcastLibrary, podcastDownloads: podcastDownloads, favorites: favorites,
                activity: activity, approvedOmissions: approved, previewOnly: approved == nil,
                liveStoresAreQuiescent: { canCollect && !Task.isCancelled })
            if approved == nil {
                preview = report
                announce("Informe preparado. Todavía no se han modificado los datos.")
            } else {
                preview = nil
                announce("Restauración finalizada. Se han conservado los elementos existentes.")
                try await refreshHistory()
            }
        }
    }

    private func configure() {
        let selected = automaticSections, period = frequency
        start("Guardando programación de copias") {
            try await backups.configureAutomaticBackups(sections: selected, frequency: period)
            loadConfiguration()
            announce("Copias automáticas activadas.")
        }
    }

    private func disable() {
        start("Guardando programación de copias") {
            try backups.disableAutomaticBackups()
            loadConfiguration()
            announce("Copias automáticas desactivadas. Las copias existentes se conservan.")
        }
    }

    @ViewBuilder private var manualSection: some View {
        Section("Crear copia de seguridad") {
            Text("Selecciona los contenidos de la copia. Los pódcast se guardan como referencias; no se copian sus archivos descargados.")
                .font(.footnote)
            ForEach(NativeBackupManifest.Section.allCases, id: \.self) { section in
                Toggle(LocalizedStringKey(section.backupLabel), isOn: selectionBinding(section, automatic: false))
                    .accessibilityIdentifier("tiflo.backup.select." + section.rawValue)
            }
            Button("Seleccionar todo") { sections = NativeBackupCoordinator.supportedSections }
            Button("Crear copia local") { create(cloud: false) }
                .disabled(sections.isEmpty || !canCollect)
                .accessibilityIdentifier("tiflo.backup.create.local")
            Button("Crear copia en iCloud") { confirmation = .createCloud }
                .disabled(sections.isEmpty || !canCollect)
                .accessibilityIdentifier("tiflo.backup.create.cloud")
            if !canCollect { Text("Cierra las reproducciones y espera a que terminen las importaciones.").font(.footnote) }
        }
        .disabled(busy || preview != nil)
        .listRowBackground(TifloVisual.surfaceRaised)
    }

    @ViewBuilder private var automaticSection: some View {
        Section("Copias automáticas") {
            if configurationUnreadable {
                Text("No se ha podido leer la programación. Puedes desactivarla y volver a configurarla.")
            } else if let configuration {
                Text("Copias automáticas activadas.")
                Text(LocalizedStringKey(configuration.frequency.backupLabel))
                if let date = configuration.lastCompleted {
                    LabeledContent("Última copia confirmada", value: dateLabel(date))
                }
                if configuration.pending != nil { Text("Hay una copia automática pendiente.") }
            } else { Text("Copias automáticas desactivadas.") }
            Text("Las copias automáticas se comprueban cuando TifloAcosta está abierto en la pantalla de inicio. iOS no garantiza su ejecución con la aplicación cerrada.")
                .font(.footnote)
            if let notice = backups.automaticNotice {
                switch notice {
                case .pending: Text("Copia local guardada. La subida a iCloud está pendiente.")
                case .completed: Text("Copia confirmada en iCloud.")
                case .failed: Text("No se pudo completar la última copia automática.")
                }
            }
            ForEach(NativeBackupManifest.Section.allCases, id: \.self) { section in
                Toggle(LocalizedStringKey(section.backupLabel), isOn: selectionBinding(section, automatic: true))
            }
            Picker("Periodicidad", selection: $frequency) {
                ForEach(NativeBackupAutomaticState.Frequency.allCases, id: \.self) { item in
                    Text(LocalizedStringKey(item.backupLabel)).tag(item)
                }
            }
            Button(LocalizedStringKey(configuration == nil ? "Activar copias automáticas" : "Guardar programación")) {
                confirmation = .configure
            }
            .disabled(automaticSections.isEmpty || configurationUnreadable || configuration?.pending != nil)
            if configuration != nil || configurationUnreadable {
                Button("Desactivar copias automáticas") { confirmation = .disable }
            }
        }
        .disabled(busy || preview != nil)
        .listRowBackground(TifloVisual.surfaceRaised)
    }

    @ViewBuilder private var historySection: some View {
        Section("Historial de copias") {
            Button("Actualizar historial") {
                start("Consultando historial de copias") { try await refreshHistory() }
            }
            if cloudUnavailable {
                Text("No se ha podido consultar iCloud. Las copias locales siguen disponibles.").font(.footnote)
            } else if !metadataComplete {
                Text("iCloud todavía está comprobando las copias disponibles.").font(.footnote)
            }
            if entries.isEmpty {
                if metadataComplete && !cloudUnavailable { Text("No se han encontrado copias de seguridad.") }
                else { Text("No se puede confirmar aún si hay copias en iCloud.") }
            }
            ForEach(entries, id: \.generation) { entry in
                VStack(alignment: .leading, spacing: 8) {
                    if let manifest = entry.local ?? entry.remote {
                        Text(dateLabel(manifest.createdAt)).font(.headline).accessibilityAddTraits(.isHeader)
                        Text(sectionNames(manifest))
                        Text(sizeLabel(manifest))
                    } else { Text("Información de la copia pendiente").font(.headline) }
                    Text(LocalizedStringKey(entry.availability.backupLabel))
                    if entry.hasLocalCopy {
                        Button("Revisar restauración") { restore(generation: entry.generation) }
                            .disabled(!canCollect)
                            .accessibilityHint("Comprueba los datos sin modificar las bibliotecas.")
                        if entry.availability == .localOnly || entry.availability == .awaitingCloud || entry.availability == .failed {
                            Button("Enviar copia a iCloud") { selectedEntry = entry; confirmation = .upload }
                        }
                    } else if entry.canRequestCloudRestore {
                        Button("Descargar copia de iCloud") { selectedEntry = entry; confirmation = .download }
                    }
                    if entry.availability == .conflict {
                        Text("No se sustituirá ninguna de las versiones.").font(.footnote)
                    }
                }
                .accessibilityElement(children: .contain)
            }
        }
        .disabled(busy || preview != nil)
        .listRowBackground(TifloVisual.surfaceRaised)
    }

    @ViewBuilder private func countRow(_ label: String, _ count: Int) -> some View {
        if count > 0 { LabeledContent(LocalizedStringKey(label), value: String(count)) }
    }

    @ViewBuilder private func restoreSection(_ report: NativeBackupCoordinator.RestoreReport) -> some View {
        Section("Informe de restauración") {
            Text(dateLabel(report.manifest.createdAt))
            Text(sectionNames(report.manifest))
            Text("Todavía no se han modificado tus datos. Los elementos existentes se conservarán.")
            countRow("Elementos existentes que se conservarán", report.preservedExisting.count)
            countRow("Referencias de pódcast pendientes de descarga", report.pendingPodcastDownloads.count)
            countRow("Emisoras pendientes de localizar", report.unresolvedRadioStations.count)
            countRow("Ajustes no compatibles o pendientes", report.omittedSettings.count)
            countRow("Perfiles y reglas musicales pendientes", report.omittedMusicProfilesAndRules.count)
            countRow("Referencias de pódcast excluidas", report.excludedPodcastReferences)
            countRow("Posiciones de pódcast no incorporadas", report.omittedPodcastPositions)
            countRow("Elementos del historial de lectura no incorporados", report.omittedReadingHistory)
            countRow("Elementos del historial de cine no incorporados", report.omittedCinemaHistory)
            if !report.hasOmissions { Text("No se han detectado omisiones.") }
            Button("Restaurar esta copia") { confirmation = .restore }
                .disabled(!canCollect || busy)
                .accessibilityIdentifier("tiflo.backup.restore.confirm")
            Button("Cancelar restauración", role: .cancel) { preview = nil }
                .disabled(busy)
        }
        .listRowBackground(TifloVisual.surfaceRaised)
    }

    var body: some View {
        NavigationStack {
            Form {
                if busy {
                    Section {
                        ProgressView {
                            if let section = backups.progressSection {
                                Text(MusicLocalized.format("Preparando copia: %@", MusicLocalized.message(section.backupLabel)))
                            } else { Text(LocalizedStringKey(phase.isEmpty ? "Procesando copia de seguridad" : phase)) }
                        }
                        .accessibilityIdentifier("tiflo.backup.progress")
                        .accessibilityAddTraits(.updatesFrequently)
                        Button("Cancelar operación", role: .cancel) { job?.cancel() }
                            .disabled(job == nil)
                    }
                }
                if !status.isEmpty {
                    Section {
                        Text(status)
                            .accessibilityFocused($focusedStatus)
                            .accessibilityIdentifier("tiflo.backup.status")
                    }
                }
                if let report = preview { restoreSection(report) }
                manualSection
                automaticSection
                historySection
            }
            .tifloScreenSurface()
            .navigationTitle("Copias de seguridad")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }.disabled(busy)
                }
            }
            .interactiveDismissDisabled(busy)
            .confirmationDialog(LocalizedStringKey(confirmation?.title ?? "Copias de seguridad"),
                isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }),
                titleVisibility: .visible, presenting: confirmation) { action in
                    Button("Continuar") {
                        switch action {
                        case .createCloud: create(cloud: true)
                        case .upload: if let entry = selectedEntry { upload(entry) }
                        case .download: if let entry = selectedEntry { download(entry) }
                        case .restore: if let report = preview { restore(generation: report.manifest.generation, approved: report.omissionSummary) }
                        case .configure: configure()
                        case .disable: disable()
                        }
                    }
                    Button("Cancelar", role: .cancel) {}
                } message: { action in
                    Text(LocalizedStringKey(action.message))
                }
            .onAppear {
                loadConfiguration()
                start("Consultando historial de copias") { try await refreshHistory() }
            }
            .onDisappear { job?.cancel() }
            .onChange(of: scenePhase) { _, value in
                if value != .active { job?.cancel() }
            }
            .onChange(of: backups.progressSection) { _, section in
                if let section {
                    UIAccessibility.post(notification: .announcement,
                        argument: MusicLocalized.format("Preparando copia: %@", MusicLocalized.message(section.backupLabel)))
                }
            }
        }
    }
}
