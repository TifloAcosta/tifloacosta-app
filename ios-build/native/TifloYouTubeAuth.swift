import UIKit
import AuthenticationServices
import CryptoKit
import Security

// iOS-only account adapter. Google credentials never touch the embedded web UI;
// the Worker holds Google tokens in an encrypted opaque bearer and the device
// keeps that bearer in ThisDeviceOnly Keychain storage.
final class TifloNativeYouTubeAccount: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = TifloNativeYouTubeAccount()
    private let host = "https://youtube-auth.tifloacosta.com"
    private let keychainService = "com.tifloacosta.app.youtube.ios"
    private let account = "youtube-session"
    private var webSession: ASWebAuthenticationSession?
    private var checkingService = false
    private weak var presentingWindow: UIWindow?

    private func accountError(_ message: String, code: Int = -1) -> NSError {
        NSError(domain: "TifloYouTube", code: code,
                userInfo: [NSLocalizedDescriptionKey: message])
    }

    private func urlSafe(_ bytes: Data) -> String {
        bytes.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func savedSession() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var value: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &value) == errSecSuccess,
              let data = value as? Data,
              let result = String(data: data, encoding: .utf8)
        else { return nil }
        return result
    }

    private func saveSession(_ session: String) -> Bool {
        guard !session.isEmpty, let bytes = session.data(using: .utf8) else { return false }
        signOut()
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: account,
            kSecValueData as String: bytes,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    var hasLocalSession: Bool { savedSession() != nil }

    func signOut() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        presentingWindow ?? UIWindow()
    }

    func signIn(from presenter: UIViewController, completion: @escaping (Result<Void, Error>) -> Void) {
        guard webSession == nil && !checkingService else {
            completion(.failure(accountError("Ya hay un inicio de sesión en curso.")))
            return
        }
        checkingService = true
        // An iPhone update must not ask the user to authorize Google until
        // the independently deployed Worker can actually accept that login.
        send(path: "/native/capabilities", method: "GET", body: nil, requiresSession: false) {
            [weak self, weak presenter] result in
            guard let self = self else { return }
            self.checkingService = false
            guard let presenter = presenter else {
                completion(.failure(self.accountError("Se ha cerrado el reproductor.")))
                return
            }
            switch result {
            case .failure:
                completion(.failure(self.accountError("El acceso a YouTube aún no está disponible. Inténtalo más tarde.")))
            case .success(let data):
                let ready = (data["nativeAuth"] as? Bool) == true
                let protocolVersion = (data["protocol"] as? Int) ?? -1
                guard ready && protocolVersion == 1 else {
                    completion(.failure(self.accountError("El servicio de conexión con YouTube todavía no está preparado.")))
                    return
                }
                self.beginSignIn(from: presenter, completion: completion)
            }
        }
    }

    private func beginSignIn(from presenter: UIViewController, completion: @escaping (Result<Void, Error>) -> Void) {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            completion(.failure(accountError("No se pudo iniciar la autenticación segura.")))
            return
        }
        let verifier = urlSafe(Data(bytes))
        let challenge = urlSafe(Data(SHA256.hash(data: Data(verifier.utf8))))
        guard var components = URLComponents(string: host + "/auth/start") else {
            completion(.failure(accountError("Servicio de YouTube no disponible.")))
            return
        }
        components.queryItems = [URLQueryItem(name: "iosChallenge", value: challenge)]
        guard let startURL = components.url else {
            completion(.failure(accountError("Servicio de YouTube no disponible.")))
            return
        }
        presentingWindow = presenter.view.window
        let session = ASWebAuthenticationSession(url: startURL, callbackURLScheme: "tifloacosta") {
            [weak self] callback, error in
            guard let self = self else { return }
            self.webSession = nil
            self.presentingWindow = nil
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let callback = callback,
                  callback.scheme == "tifloacosta",
                  callback.host == "youtube-auth",
                  let parts = URLComponents(url: callback, resolvingAgainstBaseURL: false),
                  parts.queryItems?.first(where: { $0.name == "result" })?.value == "ok",
                  let ticket = parts.queryItems?.first(where: { $0.name == "ticket" })?.value,
                  !ticket.isEmpty else {
                completion(.failure(self.accountError("No se completó la autorización de YouTube.")))
                return
            }
            self.send(path: "/native/redeem", method: "POST",
                      body: ["ticket": ticket, "verifier": verifier],
                      requiresSession: false) { result in
                switch result {
                case .failure(let error):
                    completion(.failure(error))
                case .success(let data):
                    guard let session = data["sessionToken"] as? String, !session.isEmpty,
                          self.saveSession(session) else {
                        completion(.failure(self.accountError("No se pudo guardar la sesión en el llavero.")))
                        return
                    }
                    completion(.success(()))
                }
            }
        }
        webSession = session
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        if !session.start() {
            webSession = nil
            presentingWindow = nil
            completion(.failure(accountError("No se pudo abrir el inicio de sesión de Google.")))
        }
    }

    func spokenError(_ error: Error, spanish: Bool) -> String {
        let ns = error as NSError
        let code = ns.localizedDescription
        switch code {
        case "SESSION_EXPIRED":
            return spanish ? "La sesión de YouTube ha caducado. Conecta la cuenta de nuevo."
                           : "Your YouTube session expired. Connect again."
        case "COMMENTS_DISABLED":
            return spanish ? "El canal tiene desactivados los comentarios en este vídeo."
                           : "Comments are disabled for this video."
        case "INELIGIBLE_ACCOUNT":
            return spanish ? "Esta cuenta no permite publicar comentarios en YouTube."
                           : "This account cannot publish YouTube comments."
        case "INSUFFICIENT_PERMISSIONS":
            return spanish ? "Google no ha autorizado esta acción. Revisa los permisos de la cuenta."
                           : "Google has not authorized this action. Check account permissions."
        case "QUOTA_EXCEEDED", "RATE_LIMITED":
            return spanish ? "YouTube ha limitado temporalmente las solicitudes. Prueba más tarde."
                           : "YouTube has temporarily limited requests. Try again later."
        case "VIDEO_NOT_FOUND":
            return spanish ? "El vídeo ya no está disponible."
                           : "This video is no longer available."
        case "YOUTUBE_FORBIDDEN", "CHANNEL_NOT_FOUND":
            return spanish ? "YouTube no permite esta operación para el canal o el vídeo."
                           : "YouTube does not allow this action on the channel or video."
        case "COMMENT_TOO_LONG", "INVALID_COMMENT":
            return spanish ? "El comentario no es válido o es demasiado largo."
                           : "The comment is invalid or too long."
        case "YOUTUBE_ERROR", "PROCESSING_FAILURE", "SEARCH_UNAVAILABLE":
            return spanish ? "YouTube no ha podido completar la operación."
                           : "YouTube could not complete this operation."
        default:
            if ns.code == 401 {
                return spanish ? "La sesión de YouTube ha caducado. Vuelve a conectar la cuenta."
                               : "Your YouTube session expired. Connect again."
            }
            // Native-local errors have deliberately authored non-sensitive copy.
            if ns.domain == "TifloYouTube" && !code.isEmpty { return code }
            return spanish ? "No se pudo completar la operación. Comprueba la conexión."
                           : "The action could not be completed. Check your connection."
        }
    }

    func state(videoId: String, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        guard let id = checkedVideoId(videoId) else {
            completion(.failure(accountError("Identificador de vídeo incorrecto.")))
            return
        }
        send(path: "/native/state?videoId=" + id, method: "GET", body: nil,
             requiresSession: true, completion: completion)
    }

    func perform(action: String, videoId: String, text: String = "",
                 completion: @escaping (Result<[String: Any], Error>) -> Void) {
        guard ["subscribe", "unsubscribe", "like", "unlike", "comment"].contains(action),
              let id = checkedVideoId(videoId) else {
            completion(.failure(accountError("Acción de YouTube no permitida.")))
            return
        }
        if action == "comment" && (text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || text.count > 8000) {
            completion(.failure(accountError("Escribe un comentario válido.")))
            return
        }
        send(path: "/native/" + action, method: "POST",
             body: ["videoId": id, "text": action == "comment" ? text : ""],
             requiresSession: true, completion: completion)
    }

    private func checkedVideoId(_ candidate: String) -> String? {
        candidate.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) == nil ? nil : candidate
    }

    private func send(path: String, method: String, body: [String: String]?,
                      requiresSession: Bool,
                      completion: @escaping (Result<[String: Any], Error>) -> Void) {
        guard path.hasPrefix("/native/"), let url = URL(string: host + path) else {
            completion(.failure(accountError("Solicitud no admitida.")))
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 18
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if requiresSession {
            guard let session = savedSession() else {
                completion(.failure(accountError("Inicia sesión en YouTube para continuar.", code: 401)))
                return
            }
            request.setValue("Bearer " + session, forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        URLSession.shared.dataTask(with: request) { data, response, networkError in
            let result: Result<[String: Any], Error>
            if let networkError = networkError {
                result = .failure(networkError)
            } else if let http = response as? HTTPURLResponse,
                      let data = data,
                      let decoded = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
                if (200..<300).contains(http.statusCode) {
                    result = .success(decoded)
                } else {
                    let code = decoded["error"] as? String ?? "YOUTUBE_ERROR"
                    result = .failure(self.accountError(code, code: http.statusCode))
                }
            } else {
                result = .failure(self.accountError("Respuesta no disponible del servicio de YouTube."))
            }
            DispatchQueue.main.async { completion(result) }
        }.resume()
    }
}
