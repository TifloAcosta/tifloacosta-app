import AuthenticationServices
import CryptoKit
import Foundation
import Security
import SwiftUI
import UIKit

/// Shared account management for every TifloAcosta feature, not just Mi música.
/// Provider client IDs and callback URLs are public configuration values supplied
/// through Info.plist after registering the corresponding native application.
@MainActor
final class NativeCloudAccountStore: NSObject, ObservableObject {
    static let shared = NativeCloudAccountStore()

    @Published private(set) var connected: Set<NativeCloudProvider> = []
    @Published private(set) var busy: Set<NativeCloudProvider> = []
    @Published private(set) var message: String?
    @Published private(set) var pickedGoogleDriveIDs: [String] = []

    private struct Configuration {
        let clientID: String
        let redirectURI: String
        let authorizationURL: URL
        let tokenURL: URL
        let scopes: String
    }

    private struct Credential: Codable {
        let accessToken: String
        let refreshToken: String?
        let expiresAt: Date
    }

    private let keychainService = "com.tifloacosta.app.cloud-accounts"
    private var browserSession: ASWebAuthenticationSession?
    private var revisions: [NativeCloudProvider: UUID] = [:]
    private var refreshing: Set<NativeCloudProvider> = []

    func sessionRevision(for provider: NativeCloudProvider) -> UUID? { revisions[provider] }
    private var configurations: [NativeCloudProvider: Configuration] = [:]

    override init() {
        super.init()
        for provider in NativeCloudProvider.releaseProviders {
            if let config = Self.loadConfiguration(for: provider) {
                configurations[provider] = config
                if loadCredential(for: provider) != nil { connected.insert(provider) }
            }
        }
    }

    /// No account UI is enabled until its own native OAuth registration exists.
    func isAvailable(_ provider: NativeCloudProvider) -> Bool {
        provider.enabledForRelease && configurations[provider] != nil
    }

    private static func loadConfiguration(for provider: NativeCloudProvider) -> Configuration? {
        guard provider.enabledForRelease else { return nil }
        let suffix: String
        let auth: String
        let token: String
        let scopes: String
        switch provider {
        case .googleDrive:
            suffix = "Google"
            auth = "https://accounts.google.com/o/oauth2/v2/auth"
            token = "https://oauth2.googleapis.com/token"
            scopes = "https://www.googleapis.com/auth/drive.file"
        case .dropbox:
            suffix = "Dropbox"
            auth = "https://www.dropbox.com/oauth2/authorize"
            token = "https://api.dropboxapi.com/oauth2/token"
            scopes = "files.metadata.read files.content.read"
        case .oneDrive:
            suffix = "OneDrive"
            auth = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
            token = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
            scopes = "offline_access Files.Read"
        }
        guard let id = Bundle.main.object(forInfoDictionaryKey: "CloudOAuth\(suffix)ClientID") as? String,
              let redirect = Bundle.main.object(forInfoDictionaryKey: "CloudOAuth\(suffix)RedirectURI") as? String,
              !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let callback = URLComponents(string: redirect),
              let scheme = callback.scheme, !scheme.isEmpty,
              (callback.host != nil || !callback.path.isEmpty),
              let types = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]],
              types.contains(where: { ($0["CFBundleURLSchemes"] as? [String])?.contains(scheme) == true }),
              let authorizationURL = URL(string: auth), let tokenURL = URL(string: token) else { return nil }
        return Configuration(clientID: id, redirectURI: redirect,
                             authorizationURL: authorizationURL, tokenURL: tokenURL, scopes: scopes)
    }

    private func keychainQuery(for provider: NativeCloudProvider) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: keychainService,
         kSecAttrAccount as String: provider.rawValue]
    }

    private func loadCredential(for provider: NativeCloudProvider) -> Credential? {
        var query = keychainQuery(for: provider)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(Credential.self, from: data)
    }

    private func save(_ credential: Credential, for provider: NativeCloudProvider) throws {
        let data = try JSONEncoder().encode(credential)
        let query = keychainQuery(for: provider)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var entry = query
            for (key, value) in attributes { entry[key] = value }
            guard SecItemAdd(entry as CFDictionary, nil) == errSecSuccess else {
                throw NativeCloudStorageError.unavailable
            }
        } else if status != errSecSuccess {
            throw NativeCloudStorageError.unavailable
        }
        connected.insert(provider)
    }

    func disconnect(provider: NativeCloudProvider) {
        revisions[provider] = UUID()
        SecItemDelete(keychainQuery(for: provider) as CFDictionary)
        connected.remove(provider)
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func randomVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else { return "" }
        return base64URL(Data(bytes))
    }

    func connect(provider: NativeCloudProvider) async throws {
        guard let configuration = configurations[provider], busy.isEmpty,
              !refreshing.contains(provider) else {
            throw NativeCloudStorageError.unavailable
        }
        let verifier = Self.randomVerifier()
        let state = Self.randomVerifier()
        guard !verifier.isEmpty, !state.isEmpty,
              let callbackScheme = URLComponents(string: configuration.redirectURI)?.scheme else {
            throw NativeCloudStorageError.unavailable
        }
        let challenge = Self.base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        var url = URLComponents(url: configuration.authorizationURL, resolvingAgainstBaseURL: false)!
        url.queryItems = [
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "client_id", value: configuration.clientID),
            URLQueryItem(name: "redirect_uri", value: configuration.redirectURI),
            URLQueryItem(name: "scope", value: configuration.scopes),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]
        if provider == .dropbox {
            url.queryItems?.append(URLQueryItem(name: "token_access_type", value: "offline"))
        } else if provider == .googleDrive {
            // Native Google Picker grants per-file access without broad Drive scopes.
            url.queryItems?.append(contentsOf: [
                URLQueryItem(name: "prompt", value: "consent"),
                URLQueryItem(name: "trigger_onepick", value: "true"),
                URLQueryItem(name: "access_type", value: "offline")
            ])
        }
        guard let authorizationURL = url.url else { throw NativeCloudStorageError.invalidResponse }
        let revision = UUID()
        revisions[provider] = revision
        busy.insert(provider)
        defer { busy.remove(provider); browserSession = nil }
        let callback = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(url: authorizationURL, callbackURLScheme: callbackScheme) { url, error in
                if let error {
                    if (error as NSError).code == ASWebAuthenticationSessionError.Code.canceledLogin.rawValue {
                        continuation.resume(throwing: CancellationError())
                    } else { continuation.resume(throwing: error) }
                } else if let url { continuation.resume(returning: url) }
                else { continuation.resume(throwing: NativeCloudStorageError.invalidResponse) }
            }
            browserSession = session
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            if !session.start() { continuation.resume(throwing: NativeCloudStorageError.unavailable) }
        }
        let response = URLComponents(url: callback, resolvingAgainstBaseURL: false)
        let expected = URLComponents(string: configuration.redirectURI)
        guard response?.scheme == expected?.scheme,
              response?.host == expected?.host,
              response?.path == expected?.path,
              response?.queryItems?.first(where: { $0.name == "state" })?.value == state,
              let code = response?.queryItems?.first(where: { $0.name == "code" })?.value,
              !code.isEmpty else { throw NativeCloudStorageError.unauthorized }
        try Task.checkCancellation()
        guard revisions[provider] == revision else { throw CancellationError() }
        let credential = try await exchange(code: code, verifier: verifier, configuration: configuration)
        try Task.checkCancellation()
        guard revisions[provider] == revision else { throw CancellationError() }
        try save(credential, for: provider)
        if provider == .googleDrive {
            let selected = response?.queryItems?.first(where: { $0.name == "picked_file_ids" })?.value ?? ""
            pickedGoogleDriveIDs = Array(Set(selected.split(separator: ",").map(String.init)
                .filter { !$0.isEmpty && $0.count <= 512 })).sorted()
        }
    }

    /// Returns user-picked items for any caller (music, reader or later modules).
    /// With drive.file, arbitrary root enumeration is intentionally unavailable.
    func selectGoogleDriveFiles() async throws -> [NativeCloudItem] {
        pickedGoogleDriveIDs = []
        try await connect(provider: .googleDrive)
        let token = try await validAccessToken(for: .googleDrive)
        let transport = try NativeCloudStorage(provider: .googleDrive, accessToken: token)
        var items: [NativeCloudItem] = []
        for id in pickedGoogleDriveIDs.prefix(100) {
            items.append(try await transport.googleDriveSelection(id: id))
        }
        return items
    }

    private func exchange(code: String, verifier: String, configuration: Configuration) async throws -> Credential {
        try await tokenRequest(configuration: configuration, parameters: [
            "grant_type": "authorization_code", "code": code,
            "code_verifier": verifier, "redirect_uri": configuration.redirectURI,
            "client_id": configuration.clientID
        ], previousRefreshToken: nil)
    }

    private func tokenRequest(configuration: Configuration, parameters: [String: String],
                              previousRefreshToken: String?) async throws -> Credential {
        var request = URLRequest(url: configuration.tokenURL)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var body = URLComponents()
        body.queryItems = parameters.sorted(by: { $0.key < $1.key }).map { URLQueryItem(name: $0.key, value: $0.value) }
        request.httpBody = body.percentEncodedQuery?
            .replacingOccurrences(of: "+", with: "%2B").data(using: .utf8)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              data.count < 100_000,
              let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = json["access_token"] as? String, !access.isEmpty else {
            throw NativeCloudStorageError.unauthorized
        }
        let seconds = (json["expires_in"] as? NSNumber)?.doubleValue ?? 3600
        guard seconds > 0 else { throw NativeCloudStorageError.invalidResponse }
        return Credential(accessToken: access,
                          refreshToken: (json["refresh_token"] as? String) ?? previousRefreshToken,
                          expiresAt: Date().addingTimeInterval(seconds))
    }

    func validAccessToken(for provider: NativeCloudProvider) async throws -> String {
        guard isAvailable(provider) else { throw NativeCloudStorageError.unavailable }
        guard let current = loadCredential(for: provider) else {
            connected.remove(provider)
            throw NativeCloudStorageError.unauthenticated
        }
        if current.expiresAt > Date().addingTimeInterval(60) { return current.accessToken }
        guard let configuration = configurations[provider], let refresh = current.refreshToken else {
            disconnect(provider: provider)
            throw NativeCloudStorageError.unauthenticated
        }
        guard !busy.contains(provider), refreshing.insert(provider).inserted else {
            throw NativeCloudStorageError.unavailable
        }
        defer { refreshing.remove(provider) }
        let revision = revisions[provider]
        let renewed = try await tokenRequest(configuration: configuration, parameters: [
            "grant_type": "refresh_token", "refresh_token": refresh,
            "client_id": configuration.clientID
        ], previousRefreshToken: refresh)
        try Task.checkCancellation()
        guard revisions[provider] == revision, connected.contains(provider) else {
            throw CancellationError()
        }
        try save(renewed, for: provider)
        return renewed.accessToken
    }
}

extension NativeCloudAccountStore: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
    }
}
