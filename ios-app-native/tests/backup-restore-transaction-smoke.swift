import Foundation

@main
struct BackupRestoreTransactionSmoke {
    enum SampleError: Error { case apply, rollback }
    typealias Transaction = NativeBackupRestoreTransaction
    typealias Step = Transaction.Step<String>

    static func main() throws {
        var state = [String]()
        func step(_ name: String, fail: Bool = false, failRollback: Bool = false) -> Step {
            Step(section: name, apply: {
                state.append(name)
                if fail { throw SampleError.apply }
            }, rollback: {
                state.append("undo-" + name)
                if failRollback { throw SampleError.rollback }
            })
        }
        try Transaction.execute(expected: ["reader", "music"],
            steps: [step("reader"), step("music")])
        precondition(state == ["reader", "music"])
        state = []
        do {
            try Transaction.execute(expected: ["reader", "music"],
                steps: [step("reader"), step("music", fail: true)])
            fatalError("Failed apply reported success")
        } catch SampleError.apply {}
        precondition(state == ["reader", "music", "undo-music", "undo-reader"])
        state = []
        do {
            try Transaction.execute(expected: ["reader", "music"],
                steps: [step("reader"), step("music", fail: true, failRollback: true)])
            fatalError("Rollback failure hidden")
        } catch Transaction.Failure<String>.rollbackIncomplete(let original, let failures) {
            precondition(original is SampleError)
            precondition(failures.count == 1 && failures.first?.section == "music")
        }
        precondition(state == ["reader", "music", "undo-music", "undo-reader"])
        state = []
        do {
            try Transaction.execute(expected: ["reader", "music"],
                steps: [step("reader"), step("reader")])
            fatalError("Duplicate section accepted")
        } catch Transaction.Failure<String>.invalidPlan {}
        precondition(state.isEmpty)
        var calls = 0
        do {
            try Transaction.execute(expected: ["reader", "music"],
                steps: [step("reader"), step("music")], checkCancellation: {
                    calls += 1
                    if calls == 3 { throw CancellationError() }
                })
            fatalError("Cancellation ignored")
        } catch is CancellationError {}
        precondition(state == ["reader", "undo-reader"])
        state = []
        calls = 0
        do {
            try Transaction.execute(expected: ["reader", "music"],
                steps: [step("reader"), step("music")], checkCancellation: {
                    calls += 1
                    if calls == 4 { throw CancellationError() }
                })
            fatalError("Cancellation at commit ignored")
        } catch is CancellationError {}
        precondition(state == ["reader", "music", "undo-music", "undo-reader"])
        print("Six restore transaction smoke scenarios passed")
    }
}
