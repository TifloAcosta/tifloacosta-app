import Foundation

/// Reproduces the native application's request and strict JSON decoder, without
/// using a browser or printing returned video titles, query contents or secrets.
private struct SearchResult: Decodable {
    let id: String?
    let kind: String?
    let channelId: String?
    let title: String
    let channelTitle: String
    let description: String
    let publishedAt: String?
    let durationSeconds: Int?
}

private struct SearchPage: Decodable {
    let items: [SearchResult]
    let nextPageToken: String
}

@main
struct YouTubeNativeURLSessionProbe {
    static func main() async {
        let endpoint = URL(string: "https://youtube-auth.tifloacosta.com/search")!
        var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "q", value: "VoiceOver"),
            URLQueryItem(name: "filter", value: "all")
        ]
        var request = URLRequest(url: components.url!)
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("https://tifloacosta.com", forHTTPHeaderField: "Origin")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard status == 200 else {
                print("Native search: HTTP status \(status); no returned query data logged")
                exit(1)
            }
            let decoded = try JSONDecoder().decode(SearchPage.self, from: data)
            guard !decoded.items.isEmpty else {
                print("Native search: HTTP 200 but no results")
                exit(1)
            }
            print("Native URLSession: HTTP \(status), decoded \(decoded.items.count) results, " +
                  "next page token present: \(!decoded.nextPageToken.isEmpty)")
        } catch let error as URLError {
            print("Native URLSession failure: URLError \(error.code.rawValue)")
            exit(1)
        } catch let error as DecodingError {
            print("Native JSON decoding failure: \(String(describing: error))")
            exit(1)
        } catch {
            print("Native search failed: \(String(describing: type(of: error)))")
            exit(1)
        }
    }
}
