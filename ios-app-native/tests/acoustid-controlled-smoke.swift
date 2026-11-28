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

        let required = Data(#"{"status":"error","error":{"code":21}}"#.utf8)
        precondition(NativeAcoustIDLookup.requiresUserKey(in: required))
        do {
            _ = try NativeAcoustIDLookup.match(in: required)
            fatalError("Expected required user key")
        } catch let error as URLError { precondition(error.code == .userAuthenticationRequired) }
        let appError = Data(#"{"status":"error","error":{"code":3}}"#.utf8)
        precondition(!NativeAcoustIDLookup.requiresUserKey(in: appError))
        let successful = Data(#"{"status":"ok","results":[{"score":0.99,"recordings":[{"title":"Title","artists":[{"name":"Artist"}]}]}]}"#.utf8)
        let matched = try NativeAcoustIDLookup.match(in: successful)
        precondition(matched?.title == "Title" && matched?.artist == "Artist")

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
        var progress: [[Int]] = []
        let counts = try await NativeAcoustIDLookup.identifyBatch([1, 2, 3], onProgress: {
            progress.append([$0, $1, $2])
        }) { id in
            if id == 2 { throw URLError(.notConnectedToInternet) }
            return id == 1
        }
        precondition(counts.matched == 1 && counts.failed == 1)
        precondition(progress == [[1, 1, 0], [2, 1, 1], [3, 1, 1]])
        progress = []
        do {
            _ = try await NativeAcoustIDLookup.identifyBatch([1, 2, 3], onProgress: {
                progress.append([$0, $1, $2])
            }) { id in
                if id == 2 { throw CancellationError() }
                return true
            }
            fatalError("Expected cancellation")
        } catch is CancellationError {
            precondition(progress == [[1, 1, 0]])
        }
        print("AcoustID controlled responses, partial results and batch cancellation passed.")
    }
}
