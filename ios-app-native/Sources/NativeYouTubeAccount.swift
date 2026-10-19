import Foundation
import SwiftUI
import AuthenticationServices
import CryptoKit
import Security
import UIKit

/// Sesión oficial de Google autorizada por el usuario.
/// Solo se guarda en Keychain un ticket cifrado de TifloAcosta,
/// nunca la contraseña ni una clave de desarrollador.
@MainActor
final class NativeYouTubeAccountStore: NSObject, ObservableObject {
    @Published private(set) var authenticated = false
    @Published private(set) var busy = false
    @Published private(set) var subscribed: Bool?
    @Published private(set) var rating: String?
    @Published private(set) var message: String?

    private let baseURL = URL(string: "https://youtube-auth.tifloacosta.com")!
    private let keychainService = "com.tifloacosta.app.youtube-account"
    private var credential: String?
    private var expiresAt: Double = 0
    private var activeVideoID: String?
    private var browserSession: ASWebAuthenticationSession?
    private var presentationContext: NativeYouTubeAuthWindow?

    private struct SessionData: Decodable {
        let authenticated: Bool
        let token: String?
        let expiresAt: Double?
    }

    private struct VideoState: Decodable {
        let authenticated: Bool
        let subscribed: Bool
        let rating: String
    }

    private struct ActionState: Decodable {
        let subscribed: Bool?
        let rating: String?
        let commented: Bool?
    }

    private struct APIError: Decodable {
        let error: String
    }

    private struct StoredAccount: Codable {
        let token: String
        let expiresAt: Double
    }

    override init() {
        super.init()
        if let data = loadCredential(),
           let snapshot = try? JSONDecoder().decode(StoredAccount.self, from: data),
           snapshot.expiresAt > Date().timeIntervalSince1970 * 1000 {
            credential = snapshot.token
            expiresAt = snapshot.expiresAt
            authenticated = true
        } else {
            eraseCredential()
        }
    }

    private func keychainBase() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: "google-youtube"
        ]
    }

    private func loadCredential() -> Data? {
        var query = keychainBase()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &value) == errSecSuccess else { return nil }
        return value as? Data
    }

    private func eraseCredential() {
        SecItemDelete(keychainBase() as CFDictionary)
    }

    private func persist(_ session: SessionData) throws {
        guard session.authenticated, let token = session.token,
              let expiration = session.expiresAt,
              !token.isEmpty, expiration > Date().timeIntervalSince1970 * 1000 else {
            throw NSError(domain: "TifloYouTube", code: 1)
        }
        let saved = try JSONEncoder().encode(StoredAccount(token: token, expiresAt: expiration))
        eraseCredential()
        var query = keychainBase()
        query[kSecValueData as String] = saved
        query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else {
            throw NSError(domain: "TifloYouTube", code: 2)
        }
        credential = token
        expiresAt = expiration
        authenticated = true
    }

    private func announce(_ text: String) {
        message = text
        UIAccessibility.post(notification: .announcement, argument: text)
    }

    private func errorText(_ code: String) -> String {
        switch code {
        case "COMMENTS_DISABLED": return "Los comentarios están desactivados en este vídeo."
        case "VIDEO_NOT_FOUND", "INVALID_VIDEO": return "El vídeo no está disponible."
        case "SESSION_EXPIRED", "NATIVE_AUTH_INVALID":
            return "La sesión con Google ha caducado. Vuelve a iniciar sesión."
        case "INELIGIBLE_ACCOUNT": return "La cuenta de YouTube no permite realizar esta acción."
        case "INSUFFICIENT_PERMISSIONS": return "Google no ha concedido los permisos necesarios."
        case "QUOTA_EXCEEDED", "RATE_LIMITED": return "YouTube ha alcanzado temporalmente su límite de solicitudes."
        case "COMMENT_TOO_LONG": return "El comentario es demasiado largo."
        case "YOUTUBE_FORBIDDEN": return "YouTube no permite esta operación con esta cuenta."
        case "CHANNEL_NOT_FOUND": return "No se encuentra el canal de YouTube."
        default: return "No se pudo completar la operación con YouTube."
        }
    }

    private func endpoint(_ path: String) -> URL {
        baseURL.appendingPathComponent(path)
    }

    private func call<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: [String: String]? = nil,
        bearer: String? = nil
    ) async throws -> T {
        var request = URLRequest(url: endpoint(path))
        request.httpMethod = method
        request.timeoutInterval = 25
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let bearer = bearer ?? credential, !bearer.isEmpty {
            request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw YouTubeFailure("NETWORK")
        }
        guard (200...299).contains(http.statusCode) else {
            let code = (try? JSONDecoder().decode(APIError.self, from: data).error) ?? "NETWORK"
            throw YouTubeFailure(code)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private struct YouTubeFailure: Error {
        let code: String
        init(_ code: String) { self.code = code }
    }

    private func forget() {
        eraseCredential()
        credential = nil
        expiresAt = 0
        authenticated = false
        subscribed = nil
        rating = nil
    }

    func signOut() {
        // El servidor no guarda sesiones iOS: el ticket en Keychain es el único
        // medio que usa esta instalación para continuar autenticada.
        forget()
        announce("Se ha cerrado la sesión de YouTube en TifloAcosta.")
    }

    func verifySession() async {
        guard authenticated else { return }
        if expiresAt <= Date().timeIntervalSince1970 * 1000 {
            forget()
            return
        }
        do {
            let session: SessionData = try await call("session")
            if !session.authenticated { forget() }
        } catch {
            // No eliminar la sesión únicamente por un fallo de conectividad.
        }
    }

    func signIn(videoID: String) {
        guard !busy, browserSession == nil else { return }
        activeVideoID = videoID
        var bytes = Data(count: 32)
        let result = bytes.withUnsafeMutableBytes { ptr in
            SecRandomCopyBytes(kSecRandomDefault, 32, ptr.baseAddress!)
        }
        guard result == errSecSuccess else {
            announce("No fue posible iniciar la autorización de Google.")
            return
        }
        let verifier = bytes.base64URLEncodedString()
        let digest = SHA256.hash(data: Data(verifier.utf8))
        let challenge = Data(digest).base64URLEncodedString()
        var components = URLComponents(url: endpoint("auth/native/start"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "challenge", value: challenge)]
        guard let authorizationURL = components.url else { return }
        busy = true
        message = "Abriendo identificación segura de Google."
        let context = NativeYouTubeAuthWindow()
        let session = ASWebAuthenticationSession(url: authorizationURL, callbackURLScheme: "tifloacosta") { [weak self] callback, error in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.browserSession = nil
                self.presentationContext = nil
                if let error {
                    self.busy = false
                    let code = (error as NSError).code
                    let canceled = (error as NSError).domain == ASWebAuthenticationSessionError.errorDomain
                        && code == ASWebAuthenticationSessionError.Code.canceledLogin.rawValue
                    self.announce(canceled
                        ? "Se ha cancelado el inicio de sesión con Google."
                        : "No se pudo abrir o completar la identificación segura de Google. Comprueba la conexión e inténtalo de nuevo.")
                    return
                }
                guard let callback, callback.scheme == "tifloacosta",
                      callback.host == "youtube-auth",
                      let query = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems else {
                    self.busy = false
                    self.announce("Google no devolvió una respuesta válida a TifloAcosta.")
                    return
                }
                if let reason = query.first(where: { $0.name == "error" })?.value {
                    self.busy = false
                    switch reason {
                    case "denied":
                        self.announce("No se han concedido los permisos solicitados por YouTube. Revisa el consentimiento de Google.")
                    case "missing_refresh_token":
                        self.announce("Google no ha facilitado la autorización necesaria para mantener la sesión. Repite el acceso y acepta los permisos.")
                    default:
                        self.announce("Google no pudo completar la autorización. Comprueba los permisos de la aplicación de TifloAcosta en Google.")
                    }
                    return
                }
                guard let ticket = query.first(where: { $0.name == "ticket" })?.value,
                      !ticket.isEmpty else {
                    self.busy = false
                    self.announce("La respuesta de Google no contiene la autorización esperada.")
                    return
                }
                await self.exchange(ticket: ticket, verifier: verifier)
            }
        }
        presentationContext = context
        browserSession = session
        session.presentationContextProvider = context
        session.prefersEphemeralWebBrowserSession = false
        if !session.start() {
            busy = false
            browserSession = nil
            presentationContext = nil
            announce("No fue posible abrir la identificación de Google.")
        }
    }

    private func exchange(ticket: String, verifier: String) async {
        defer { busy = false }
        do {
            let result: SessionData = try await call(
                "auth/native/exchange", method: "POST",
                body: ["ticket": ticket, "verifier": verifier], bearer: ""
            )
            try persist(result)
            announce("Sesión de YouTube iniciada.")
            if let videoID = activeVideoID { await loadState(videoID: videoID) }
        } catch {
            let code = (error as? YouTubeFailure)?.code ?? "NETWORK"
            announce(code == "NATIVE_AUTH_INVALID"
                ? "La autorización recibida por TifloAcosta ha caducado o no es válida. Inicia sesión nuevamente."
                : "No se pudo validar la sesión de Google con el servicio de YouTube. Comprueba la conexión e inténtalo de nuevo.")
        }
    }

    func loadState(videoID: String) async {
        activeVideoID = videoID
        subscribed = nil
        rating = nil
        guard authenticated else { return }
        do {
            let state: VideoState = try await call("state?videoId=\(videoID)")
            guard activeVideoID == videoID else { return }
            subscribed = state.subscribed
            rating = state.rating
            message = nil
        } catch {
            handle(error)
        }
    }

    private func handle(_ error: Error) {
        let code = (error as? YouTubeFailure)?.code ?? "NETWORK"
        if code == "SESSION_EXPIRED" { forget() }
        announce(errorText(code))
    }

    private func perform(_ path: String, videoID: String, text: String? = nil) async -> Bool {
        guard authenticated, !busy else { return false }
        busy = true
        defer { busy = false }
        do {
            var body = ["videoId": videoID]
            if let text { body["text"] = text }
            let result: ActionState = try await call(path, method: "POST", body: body)
            if let subscribed = result.subscribed { self.subscribed = subscribed }
            if let rating = result.rating { self.rating = rating }
            announce(path == "comment" ? "Comentario publicado en YouTube." :
                path == "like" ? "Me gusta añadido." :
                path == "unlike" ? "Me gusta retirado." :
                path == "subscribe" ? "Suscripción realizada." : "Suscripción cancelada.")
            return true
        } catch {
            handle(error)
            return false
        }
    }

    func setLiked(_ liked: Bool, videoID: String) async {
        _ = await perform(liked ? "like" : "unlike", videoID: videoID)
    }

    func setSubscribed(_ value: Bool, videoID: String) async {
        _ = await perform(value ? "subscribe" : "unsubscribe", videoID: videoID)
    }

    func publishComment(_ text: String, videoID: String) async -> Bool {
        let cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else {
            announce("Escribe un comentario antes de publicarlo.")
            return false
        }
        return await perform("comment", videoID: videoID, text: cleaned)
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private final class NativeYouTubeAuthWindow: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first(where: { $0.activationState == .foregroundActive })?
            .keyWindow ?? ASPresentationAnchor()
    }
}
