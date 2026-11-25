import Foundation

enum NativeCinemaRules {
    static func matches(_ query: String, fields: [String]) -> Bool {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return term.isEmpty || fields.contains { $0.localizedStandardContains(term) }
    }
    static func permits<T: Equatable>(_ selected: T, all: T, actual: T) -> Bool {
        selected == all || selected == actual
    }
    static func seekTarget(position: Double, delta: Double, duration: Double) -> Double? {
        guard position.isFinite, delta.isFinite else { return nil }
        let candidate = position + delta
        guard candidate.isFinite else { return nil }
        return max(0, duration.isFinite && duration > 0 ? min(duration, candidate) : candidate)
    }
    static func orderedParts<T>(_ values: [(Int, Int, T)]) -> [T]? {
        guard let total = values.first?.1, (1...100).contains(total),
              values.allSatisfy({ $0.1 == total }), values.count == total,
              Set(values.map { $0.0 }) == Set(1...total) else { return nil }
        return values.sorted { $0.0 < $1.0 }.map { $0.2 }
    }
    static func upsert<T: Identifiable>(_ value: T, in entries: [T], limit: Int = 100) -> [T] {
        Array(([value] + entries.filter { $0.id != value.id }).prefix(max(0, limit)))
    }
    static func canDeclareEmpty(completed: Bool, count: Int, unavailable: Int, partial: Int, attempted: Int) -> Bool {
        completed && count == 0 && unavailable == 0 && partial == 0 && attempted > 0
    }
}
