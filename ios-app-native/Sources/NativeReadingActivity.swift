import Foundation
import Combine

/// Local reading activity, separate from permanent Favorites and from the
/// TifloLector library. A catalog refresh must not erase the user's history.
@MainActor
final class NativeReadingActivity: ObservableObject {
    @Published private(set) var savedForLater: Set<NativeFavoriteKey> = []
    @Published private(set) var recentlyRead: [NativeFavoriteKey] = []

    private let laterKey = "native-ios-read-later-v1"
    private let historyKey = "native-ios-reading-history-v1"

    init() {
        if let data = UserDefaults.standard.data(forKey: laterKey),
           let values = try? JSONDecoder().decode(Set<NativeFavoriteKey>.self, from: data) {
            savedForLater = values.filter { $0.kind == .resource || $0.kind == .news }
        }
        if let data = UserDefaults.standard.data(forKey: historyKey),
           let values = try? JSONDecoder().decode([NativeFavoriteKey].self, from: data) {
            var unique = Set<NativeFavoriteKey>()
            recentlyRead = values.filter {
                ($0.kind == .resource || $0.kind == .news) && unique.insert($0).inserted
            }.prefix(100).map { $0 }
        }
    }


    /// Component of the preferences transaction. Do not execute independently
    /// of the complete preferences adapter.
    func prepareBackupActivity(_ plan: NativeBackupPersonalDataMerge.ReadingPlan, recovery: NativeBackupRecoveryBuilder? = nil) throws
        -> (apply: () throws -> Void, rollback: () throws -> Void) {
        let oldLater = savedForLater, oldHistory = recentlyRead
        let before = NativeBackupDefaultsBeforeState(defaults: .standard, keys: [laterKey, historyKey], recovery: recovery)
        let encoder = JSONEncoder()
        let laterBytes = try encoder.encode(plan.savedForLater)
        let historyBytes = try encoder.encode(plan.recentlyRead)
        return ({
            UserDefaults.standard.set(laterBytes, forKey: self.laterKey)
            UserDefaults.standard.set(historyBytes, forKey: self.historyKey)
            self.savedForLater = plan.savedForLater
            self.recentlyRead = plan.recentlyRead
        }, {
            before.restore()
            self.savedForLater = oldLater
            self.recentlyRead = oldHistory
        })
    }

    func isSaved(_ kind: NativeFavoriteKind, item: NativeCatalogItem) -> Bool {
        savedForLater.contains(NativeFavoriteKey(kind, item))
    }

    @discardableResult
    func toggleReadLater(_ kind: NativeFavoriteKind, item: NativeCatalogItem) -> Bool {
        guard kind == .resource || kind == .news else { return false }
        let key = NativeFavoriteKey(kind, item)
        let saved: Bool
        if savedForLater.contains(key) {
            savedForLater.remove(key)
            saved = false
        } else {
            savedForLater.insert(key)
            saved = true
        }
        if let data = try? JSONEncoder().encode(savedForLater) {
            UserDefaults.standard.set(data, forKey: laterKey)
        }
        return saved
    }

    func markOpened(_ kind: NativeFavoriteKind, item: NativeCatalogItem) {
        guard kind == .resource || kind == .news else { return }
        let key = NativeFavoriteKey(kind, item)
        recentlyRead.removeAll { $0 == key }
        recentlyRead.insert(key, at: 0)
        if recentlyRead.count > 100 { recentlyRead.removeLast(recentlyRead.count - 100) }
        if let data = try? JSONEncoder().encode(recentlyRead) {
            UserDefaults.standard.set(data, forKey: historyKey)
        }
    }

    func clearHistory() {
        recentlyRead = []
        UserDefaults.standard.removeObject(forKey: historyKey)
    }
}
