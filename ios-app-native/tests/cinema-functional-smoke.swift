import Foundation

@main
struct CinemaFunctionalSmoke {
    struct Row: Identifiable, Equatable { let id: Int; let value: String }
    static func main() {
        precondition(NativeCinemaRules.matches("  AMELIE ", fields: ["Amélie"]))
        precondition(NativeCinemaRules.matches("1999", fields: ["Film", "1999"]))
        precondition(!NativeCinemaRules.matches("unknown", fields: ["Film"]))
        precondition(NativeCinemaRules.permits("all", all: "all", actual: "it"))
        precondition(!NativeCinemaRules.permits("es", all: "all", actual: "it"))
        precondition(NativeCinemaRules.seekTarget(position: 12.5, delta: -30, duration: 300) == 0)
        precondition(NativeCinemaRules.seekTarget(position: 295.5, delta: 30, duration: 300) == 300)
        precondition(NativeCinemaRules.seekTarget(position: 12.25, delta: 30, duration: 0) == 42.25)
        precondition(NativeCinemaRules.seekTarget(position: .nan, delta: 30, duration: 300) == nil)
        precondition(NativeCinemaRules.orderedParts([(2,3,"b"),(3,3,"c"),(1,3,"a")]) == ["a","b","c"])
        precondition(NativeCinemaRules.orderedParts([(1,3,"a"),(3,3,"c")]) == nil)
        precondition(NativeCinemaRules.orderedParts([(1,2,"a"),(1,2,"b")]) == nil)
        precondition(NativeCinemaRules.orderedParts([(1,2,"a"),(2,3,"b")]) == nil)
        let rows = (0..<100).map { Row(id: $0, value: "old") }
        let updated = NativeCinemaRules.upsert(Row(id: 4, value: "new"), in: rows)
        precondition(updated.count == 100 && updated.first?.value == "new" && updated.filter { $0.id == 4 }.count == 1)
        let added = NativeCinemaRules.upsert(Row(id: 101, value: "new"), in: rows)
        precondition(added.count == 100 && added.last?.id == 98)
        precondition(NativeCinemaRules.canDeclareEmpty(completed: true, count: 0, unavailable: 0, partial: 0, attempted: 1))
        precondition(!NativeCinemaRules.canDeclareEmpty(completed: true, count: 0, unavailable: 1, partial: 0, attempted: 1))
        precondition(!NativeCinemaRules.canDeclareEmpty(completed: true, count: 0, unavailable: 0, partial: 1, attempted: 1))
        precondition(!NativeCinemaRules.canDeclareEmpty(completed: true, count: 0, unavailable: 0, partial: 0, attempted: 0))
        let keys = ["first", "second", "third"]
        precondition(NativeCinemaRules.preferredPartIndex(keys: keys, recent: [("second", false), ("first", true)], fromBeginning: false) == 1)
        precondition(NativeCinemaRules.preferredPartIndex(keys: keys, recent: [("second", true)], fromBeginning: false) == 2)
        precondition(NativeCinemaRules.preferredPartIndex(keys: keys, recent: [("third", true)], fromBeginning: false) == 0)
        precondition(NativeCinemaRules.preferredPartIndex(keys: keys, recent: [("second", false)], fromBeginning: true) == 0)
        precondition(NativeCinemaRules.preferredPartIndex(keys: keys, recent: [("unrelated", false)], fromBeginning: false) == 0)
        print("Cinema: 24 functional checks passed")
    }
}
