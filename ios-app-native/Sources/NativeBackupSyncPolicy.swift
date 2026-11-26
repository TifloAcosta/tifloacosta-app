import Foundation

/// Synchronization is a history of immutable copies, not a last-writer-wins
/// database. No scheduled operation may restore or remove a generation.
enum NativeBackupSyncPolicy {
    enum Availability: Equatable {
        case localOnly, cloudOnly, both, awaitingCloud, conflict, failed
    }
    struct Remote {
        let generation: UUID
        let manifest: NativeBackupManifest?
        let state: Availability
    }
    struct Entry {
        let generation: UUID
        let local: NativeBackupManifest?
        let remote: NativeBackupManifest?
        let availability: Availability

        var hasLocalCopy: Bool { local != nil }
        var canRequestCloudRestore: Bool {
            remote != nil && (availability == .both || availability == .cloudOnly)
        }
    }

    /// The UUID, date and complete artifact list must agree. Matching names,
    /// dates or sizes alone are never evidence that two copies are identical.
    static func history(local: [NativeBackupManifest], remote: [Remote]) -> [Entry] {
        var localByID: [UUID: NativeBackupManifest] = [:]
        var remoteByID: [UUID: Remote] = [:]
        var ambiguous = Set<UUID>()
        for item in local {
            if let previous = localByID[item.generation], previous != item { ambiguous.insert(item.generation) }
            localByID[item.generation] = item
        }
        for item in remote {
            if let previous = remoteByID[item.generation],
               previous.manifest != item.manifest || previous.state != item.state {
                ambiguous.insert(item.generation)
            }
            if let manifest = item.manifest, manifest.generation != item.generation { ambiguous.insert(item.generation) }
            remoteByID[item.generation] = item
        }
        return Set(localByID.keys).union(remoteByID.keys).map { id in
            let here = localByID[id], there = remoteByID[id]
            let availability: Availability
            if ambiguous.contains(id) || there?.state == .conflict ||
                (here != nil && there?.manifest != nil && here != there?.manifest) {
                availability = .conflict
            } else if let there {
                switch there.state {
                case .failed: availability = .failed
                case .awaitingCloud: availability = .awaitingCloud
                case .cloudOnly, .both:
                    availability = there.manifest == nil ? .awaitingCloud : (here == nil ? .cloudOnly : .both)
                case .localOnly: availability = here == nil ? .awaitingCloud : .localOnly
                case .conflict: availability = .conflict
                }
            } else { availability = .localOnly }
            return Entry(generation: id, local: here, remote: there?.manifest, availability: availability)
        }.sorted {
            let a = $0.local?.createdAt ?? $0.remote?.createdAt ?? .distantPast
            let b = $1.local?.createdAt ?? $1.remote?.createdAt ?? .distantPast
            if a != b { return a > b }
            return $0.generation.uuidString < $1.generation.uuidString
        }
    }

    /// Advisory only: never erase cloud copies, a pending generation, a
    /// conflict, a local-only copy, or one of the newest local copies covering
    /// each section. The user must explicitly approve any later removal and
    /// the remote artifacts must be verified again before deletion.
    static func localSpaceCandidates(history: [Entry], pending: UUID?,
                                     keepPerSection: Int = 2,
                                     remoteHistoryComplete: Bool) -> [UUID] {
        guard remoteHistoryComplete, keepPerSection >= 1 else { return [] }
        var protected = Set<UUID>()
        if let pending { protected.insert(pending) }
        let sorted = history.sorted {
            let a = $0.local?.createdAt ?? .distantPast, b = $1.local?.createdAt ?? .distantPast
            return a == b ? $0.generation.uuidString < $1.generation.uuidString : a > b
        }
        for section in NativeBackupManifest.Section.allCases {
            let local = sorted.filter { entry in
                entry.local?.artifacts.contains { $0.section == section } == true
            }
            protected.formUnion(local.prefix(keepPerSection).map(\.generation))
        }
        return sorted.reversed().compactMap { entry in
            guard entry.availability == .both, let local = entry.local,
                  local == entry.remote, !protected.contains(entry.generation) else { return nil }
            return entry.generation
        }
    }
}

/// Opt-in, per-device policy; the state file is never included in the exported
/// preferences. An opaque random marker in the authorized iCloud container
/// binds automatic uploads to the account that the user approved.
struct NativeBackupAutomaticState: Codable, Equatable {
    enum Frequency: String, Codable, CaseIterable {
        case daily, weekly, monthly
        var interval: TimeInterval {
            switch self {
            case .daily: return 24 * 60 * 60
            case .weekly: return 7 * 24 * 60 * 60
            case .monthly: return 30 * 24 * 60 * 60
            }
        }
    }
    enum Decision: Equatable { case wait, create(UUID), resume(UUID) }
    static let retryInterval: TimeInterval = 30 * 60
    let version: Int
    let authorization: UUID
    let sections: Set<NativeBackupManifest.Section>
    let frequency: Frequency
    var pending: UUID?
    var lastAttempt: Date?
    var lastCompleted: Date?

    init(authorization: UUID, sections: Set<NativeBackupManifest.Section>, frequency: Frequency) {
        self.version = 1
        self.authorization = authorization
        self.sections = sections
        self.frequency = frequency
    }

    func validate() throws {
        guard version == 1, !sections.isEmpty,
              (lastAttempt?.timeIntervalSinceReferenceDate.isFinite ?? true),
              (lastCompleted?.timeIntervalSinceReferenceDate.isFinite ?? true) else {
            throw NativeBackupAutomaticStateStore.Failure.invalidState
        }
    }

    func decision(at now: Date, nextID: UUID = UUID()) -> Decision {
        guard now.timeIntervalSinceReferenceDate.isFinite else { return .wait }
        // Do not permanently stall when a device clock is corrected backwards.
        if let attempt = lastAttempt, now >= attempt,
           now.timeIntervalSince(attempt) < Self.retryInterval { return .wait }
        if let pending { return .resume(pending) }
        if let completed = lastCompleted, now >= completed,
           now.timeIntervalSince(completed) < frequency.interval { return .wait }
        return .create(nextID)
    }

    /// Reserve before collecting archives. A crash or retry must reuse this
    /// generation; never create a new copy merely because an upload is slow.
    mutating func recordAttempt(generation: UUID, at now: Date) throws {
        guard pending == nil || pending == generation else { throw NativeBackupAutomaticStateStore.Failure.invalidState }
        pending = generation
        lastAttempt = now
    }

    mutating func markUploaded(generation: UUID, at now: Date) throws {
        guard pending == generation else { throw NativeBackupAutomaticStateStore.Failure.invalidState }
        pending = nil
        lastAttempt = now
        lastCompleted = now
    }
}

/// The local opt-in and reserved generation are persisted atomically. No
/// user identifier, credential or account token is stored. Missing state
/// means disabled; malformed state blocks automation rather than enabling it.
struct NativeBackupAutomaticStateStore {
    enum Failure: Error { case invalidState }
    let url: URL
    private let fm = FileManager.default
    private static let maximumBytes = 16 * 1024

    func load() throws -> NativeBackupAutomaticState? {
        let attributes: [FileAttributeKey: Any]
        do { attributes = try fm.attributesOfItem(atPath: url.path) }
        catch {
            let error = error as NSError
            if error.domain == NSCocoaErrorDomain &&
                [NSFileNoSuchFileError, NSFileReadNoSuchFileError].contains(error.code) { return nil }
            if error.domain == NSPOSIXErrorDomain && error.code == 2 { return nil }
            throw error
        }
        guard attributes[.type] as? FileAttributeType == .typeRegular,
              let count = (attributes[.size] as? NSNumber)?.intValue,
              count > 0, count <= Self.maximumBytes else { throw Failure.invalidState }
        let state = try JSONDecoder().decode(NativeBackupAutomaticState.self, from: Data(contentsOf: url))
        try state.validate()
        return state
    }

    func save(_ state: NativeBackupAutomaticState) throws {
        try state.validate()
        var parent = url.deletingLastPathComponent()
        try fm.createDirectory(at: parent, withIntermediateDirectories: true)
        guard (try fm.attributesOfItem(atPath: parent.path))[.type] as? FileAttributeType == .typeDirectory
        else { throw Failure.invalidState }
        let data = try JSONEncoder().encode(state)
        guard data.count <= Self.maximumBytes else { throw Failure.invalidState }
        #if os(iOS)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try parent.setResourceValues(values)
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: url, options: .atomic)
        #endif
    }

    func disable() throws {
        // Disable is an explicit user action and may also clear a corrupt
        // policy. It never removes the pending generation or any cloud file.
        do { try fm.removeItem(at: url) }
        catch {
            let error = error as NSError
            if error.domain == NSCocoaErrorDomain &&
                [NSFileNoSuchFileError, NSFileReadNoSuchFileError].contains(error.code) { return }
            if error.domain == NSPOSIXErrorDomain && error.code == 2 { return }
            throw error
        }
    }
}
