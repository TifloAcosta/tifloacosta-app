import Foundation

/// In-process transaction executor for fully prepared, reversible restore steps.
/// An adapter must capture its before-state and stage new files before creating
/// a Step. Apply and rollback must be synchronous and must not yield to another
/// writer. This executor does not yet provide crash recovery or live adapters.
enum NativeBackupRestoreTransaction {
    struct Step<Section: Hashable> {
        let section: Section
        let apply: () throws -> Void
        /// Must also handle a partially completed apply; safe to repeat.
        let rollback: () throws -> Void
    }

    struct RollbackFailure<Section: Hashable> {
        let section: Section
        let error: Error
    }

    enum Failure<Section: Hashable>: Error {
        case invalidPlan
        case rollbackIncomplete(original: Error, failures: [RollbackFailure<Section>])
    }

    /// Require exactly the selected sections, no duplicates. If any apply
    /// throws or cancellation is observed, undo all attempted steps including
    /// the failing one, in reverse order. Never skip remaining rollbacks.
    static func execute<Section: Hashable>(
        expected: Set<Section>, steps: [Step<Section>],
        checkCancellation: () throws -> Void = { try Task.checkCancellation() }
    ) throws {
        guard !expected.isEmpty, steps.count == expected.count,
              Set(steps.map(\.section)) == expected else {
            throw Failure<Section>.invalidPlan
        }
        try checkCancellation()
        var attempted: [Step<Section>] = []
        do {
            for step in steps {
                try checkCancellation()
                attempted.append(step)
                try step.apply()
            }
            try checkCancellation()
        } catch {
            let original = error
            var failures: [RollbackFailure<Section>] = []
            for step in attempted.reversed() {
                do { try step.rollback() }
                catch { failures.append(.init(section: step.section, error: error)) }
            }
            if !failures.isEmpty {
                throw Failure<Section>.rollbackIncomplete(original: original, failures: failures)
            }
            throw original
        }
    }
}
