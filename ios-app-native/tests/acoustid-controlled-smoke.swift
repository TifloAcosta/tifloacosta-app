import Foundation

@main
struct AcoustIDControlledSmoke {
    @MainActor
    static func main() async throws {
        let revoked = try NativeAcoustIDLookup.keyState(in: Data(#"{"status":"ok","key":{"state":"revoked"}}"#.utf8))
        precondition(revoked == .revoked)
        let rejected = Data(#"{"status":"error","error":{"code":4}}"#.utf8)
        do {
            _ = try NativeAcoustIDLookup.match(in: rejected)
            fatalError("Expected authentication error")
        } catch let error as URLError { precondition(error.code == .userAuthenticationRequired) }

        let ambiguous = Data(#"{"status":"ok","results":[{"score":0.99,"recordings":[{"title":"Title","artists":[{"name":"A"}]},{"title":"Title","artists":[{"name":"B"}]}]}]}"#.utf8)
        let ambiguousMatch = try NativeAcoustIDLookup.match(in: ambiguous)
        precondition(ambiguousMatch == nil)

        do {
            let _: Data = try await NativeAcoustIDLookup.send { throw URLError(.notConnectedToInternet) }
            fatalError("Expected connection error")
        } catch let error as URLError { precondition(error.code == .notConnectedToInternet) }

        var requested: [Int] = []
        do {
            _ = try await NativeAcoustIDLookup.identifyBatch([1, 2, 3]) { id in
                requested.append(id)
                if id == 2 {
                    return try await NativeAcoustIDLookup.send { throw URLError(.cancelled) }
                }
                return true
            }
            fatalError("Expected cancellation")
        } catch is CancellationError { precondition(requested == [1, 2]) }

        requested = []
        do {
            _ = try await NativeAcoustIDLookup.identifyBatch([1, 2, 3]) { id in
                requested.append(id)
                return try NativeAcoustIDLookup.match(in: rejected) != nil
            }
            fatalError("Expected credential error")
        } catch let error as URLError {
            precondition(error.code == .userAuthenticationRequired && requested == [1])
        }
        print("AcoustID controlled responses and batch cancellation passed.")
    }
}
