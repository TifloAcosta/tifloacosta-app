import UIKit

// Native, separately navigable account actions. Login never opens inside
// YouTube's iframe: ASWebAuthenticationSession owns the Google consent UI.
final class TifloYouTubeAccountControls: UIView {
    weak var presenter: UIViewController?
    private let videoId: String
    private let spanish: Bool

    private let toggleButton = UIButton(type: .system)
    private let accountPanel = UIStackView()
    private let signInButton = UIButton(type: .system)
    private let subscribeButton = UIButton(type: .system)
    private let likeButton = UIButton(type: .system)
    private let commentButton = UIButton(type: .system)
    private let publishButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)
    private let signOutButton = UIButton(type: .system)
    private let editor = UITextView()
    private let accountStatus = UILabel()
    private var expanded = false
    private var editorVisible = false

    init(videoId: String, spanish: Bool, presenter: UIViewController) {
        self.videoId = videoId
        self.spanish = spanish
        self.presenter = presenter
        super.init(frame: .zero)
        build()
    }

    required init?(coder: NSCoder) { return nil }

    private func button(_ control: UIButton, es: String, en: String, action: Selector) {
        control.setTitle(spanish ? es : en, for: .normal)
        control.titleLabel?.numberOfLines = 0
        control.titleLabel?.adjustsFontForContentSizeCategory = true
        control.contentHorizontalAlignment = .leading
        control.addTarget(self, action: action, for: .touchUpInside)
        control.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
    }

    private func build() {
        button(toggleButton, es: "Acciones de YouTube", en: "YouTube account actions",
               action: #selector(toggle))
        toggleButton.accessibilityValue = spanish ? "Contraído" : "Collapsed"
        toggleButton.accessibilityHint = spanish
            ? "Permite conectar una cuenta y acceder a Me gusta, suscripción y comentarios."
            : "Connect an account and use Like, Subscribe and Comment."

        button(signInButton, es: "Conectar mi cuenta de YouTube",
               en: "Connect my YouTube account", action: #selector(signIn))
        button(subscribeButton, es: "Suscribirme al canal",
               en: "Subscribe to channel", action: #selector(subscribe))
        button(likeButton, es: "Me gusta este vídeo", en: "Like this video",
               action: #selector(like))
        button(commentButton, es: "Escribir un comentario", en: "Write a comment",
               action: #selector(openEditor))
        button(publishButton, es: "Publicar comentario",
               en: "Publish comment", action: #selector(publish))
        button(cancelButton, es: "Cancelar comentario",
               en: "Cancel comment", action: #selector(cancelEditor))
        button(signOutButton, es: "Desconectar cuenta de YouTube",
               en: "Disconnect YouTube account", action: #selector(signOut))

        accountStatus.numberOfLines = 0
        accountStatus.font = UIFont.preferredFont(forTextStyle: .footnote)
        accountStatus.adjustsFontForContentSizeCategory = true
        accountStatus.text = spanish
            ? "Puedes ver el vídeo sin iniciar sesión."
            : "You can watch without signing in."

        editor.isEditable = true
        editor.font = UIFont.preferredFont(forTextStyle: .body)
        editor.adjustsFontForContentSizeCategory = true
        editor.backgroundColor = .secondarySystemBackground
        editor.layer.cornerRadius = 8
        editor.accessibilityLabel = spanish ? "Texto del comentario" : "Comment text"
        editor.heightAnchor.constraint(equalToConstant: 90).isActive = true

        let list = UIStackView(arrangedSubviews: [
            accountStatus, signInButton, subscribeButton, likeButton,
            commentButton, editor, publishButton, cancelButton, signOutButton
        ])
        list.axis = .vertical
        list.spacing = 8
        list.translatesAutoresizingMaskIntoConstraints = false

        // Use a single parent screen scroll view. A nested 175-point scroll
        // hides subscription and comment controls from VoiceOver exploration.
        accountPanel.axis = .vertical
        accountPanel.spacing = 8
        accountPanel.addArrangedSubview(list)
        let root = UIStackView(arrangedSubviews: [toggleButton, accountPanel])
        root.axis = .vertical
        root.spacing = 4
        root.translatesAutoresizingMaskIntoConstraints = false
        addSubview(root)
        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: leadingAnchor),
            root.trailingAnchor.constraint(equalTo: trailingAnchor),
            root.topAnchor.constraint(equalTo: topAnchor),
            root.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        accountPanel.isHidden = true
        editor.isHidden = true
        publishButton.isHidden = true
        cancelButton.isHidden = true
        updateAccess()
    }

    private func announce(_ message: String) {
        accountStatus.text = message
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    private func updateAccess() {
        let connected = TifloNativeYouTubeAccount.shared.hasLocalSession
        signInButton.isHidden = connected
        signOutButton.isHidden = !connected
        subscribeButton.isHidden = true
        likeButton.isHidden = true
        commentButton.isHidden = !connected
        if !connected {
            editorVisible = false
            editor.isHidden = true
            publishButton.isHidden = true
            cancelButton.isHidden = true
        }
    }

    private func refresh() {
        updateAccess()
        guard TifloNativeYouTubeAccount.shared.hasLocalSession else {
            accountStatus.text = spanish
                ? "Inicia sesión para marcar Me gusta, suscribirte o comentar."
                : "Sign in to like, subscribe or comment."
            return
        }
        accountStatus.text = spanish ? "Consultando cuenta de YouTube…" : "Checking YouTube account…"
        TifloNativeYouTubeAccount.shared.state(videoId: videoId) { [weak self] result in
            guard let self = self, self.expanded else { return }
            switch result {
            case .success(let data):
                let channel = data["channelTitle"] as? String ?? ""
                let subscribed = data["subscribed"] as? Bool ?? false
                let liked = (data["rating"] as? String) == "like"
                self.subscribeButton.isHidden = subscribed
                self.likeButton.isHidden = liked
                if !subscribed {
                    self.subscribeButton.setTitle(
                        self.spanish ? "Suscribirme al canal " + channel
                                     : "Subscribe to " + channel,
                        for: .normal
                    )
                }
                var items: [String] = []
                if !channel.isEmpty {
                    items.append((self.spanish ? "Canal: " : "Channel: ") + channel)
                }
                if subscribed { items.append(self.spanish ? "Ya estás suscrito." : "Already subscribed.") }
                if liked { items.append(self.spanish ? "Ya has marcado Me gusta." : "Already liked.") }
                self.accountStatus.text = items.isEmpty
                    ? (self.spanish ? "Cuenta conectada." : "Account connected.")
                    : items.joined(separator: " ")
                // A completed Like/Subscribe action may hide its triggering
                // button; move VoiceOver to a stable status instead.
                UIAccessibility.post(notification: .layoutChanged, argument: self.accountStatus)
            case .failure(let error):
                self.announce(TifloNativeYouTubeAccount.shared.spokenError(error, spanish: self.spanish))
                if (error as NSError).code == 401 {
                    TifloNativeYouTubeAccount.shared.signOut()
                    self.updateAccess()
                    UIAccessibility.post(notification: .layoutChanged, argument: self.signInButton)
                }
            }
        }
    }

    @objc private func toggle() {
        expanded.toggle()
        accountPanel.isHidden = !expanded
        toggleButton.accessibilityValue = expanded
            ? (spanish ? "Expandido" : "Expanded")
            : (spanish ? "Contraído" : "Collapsed")
        if expanded { refresh() }
    }

    @objc private func signIn() {
        guard let presenter = presenter else { return }
        signInButton.isEnabled = false
        TifloNativeYouTubeAccount.shared.signIn(from: presenter) { [weak self] result in
            guard let self = self else { return }
            self.signInButton.isEnabled = true
            switch result {
            case .success:
                self.announce(self.spanish ? "Cuenta conectada correctamente." : "Account connected successfully.")
                self.refresh()
            case .failure(let error):
                self.announce(TifloNativeYouTubeAccount.shared.spokenError(error, spanish: self.spanish))
            }
        }
    }

    private func execute(_ action: String, success: String, text: String = "") {
        subscribeButton.isEnabled = false
        likeButton.isEnabled = false
        publishButton.isEnabled = false
        TifloNativeYouTubeAccount.shared.perform(action: action, videoId: videoId, text: text) {
            [weak self] result in
            guard let self = self else { return }
            self.subscribeButton.isEnabled = true
            self.likeButton.isEnabled = true
            self.publishButton.isEnabled = true
            switch result {
            case .success:
                self.announce(success)
                if action == "comment" {
                    self.editor.text = ""
                    self.closeEditor()
                }
                self.refresh()
            case .failure(let error):
                self.announce(TifloNativeYouTubeAccount.shared.spokenError(error, spanish: self.spanish))
                if (error as NSError).code == 401 {
                    TifloNativeYouTubeAccount.shared.signOut()
                    self.updateAccess()
                    UIAccessibility.post(notification: .layoutChanged, argument: self.signInButton)
                }
            }
        }
    }

    @objc private func subscribe() {
        execute("subscribe", success: spanish ? "Suscripción realizada." : "Subscribed.")
    }

    @objc private func like() {
        execute("like", success: spanish ? "Has marcado Me gusta." : "Video liked.")
    }

    @objc private func openEditor() {
        editorVisible = true
        editor.isHidden = false
        publishButton.isHidden = false
        cancelButton.isHidden = false
        editor.becomeFirstResponder()
    }

    private func closeEditor() {
        editorVisible = false
        editor.resignFirstResponder()
        editor.isHidden = true
        publishButton.isHidden = true
        cancelButton.isHidden = true
        UIAccessibility.post(notification: .layoutChanged, argument: commentButton)
    }

    @objc private func cancelEditor() { closeEditor() }

    @objc private func publish() {
        let message = editor.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else {
            announce(spanish ? "Escribe primero el comentario." : "Write your comment first.")
            return
        }
        execute("comment", success: spanish ? "Comentario publicado." : "Comment published.", text: message)
    }

    @objc private func signOut() {
        TifloNativeYouTubeAccount.shared.signOut()
        updateAccess()
        announce(spanish ? "Cuenta desconectada de TifloAcosta." : "Account disconnected from TifloAcosta.")
        UIAccessibility.post(notification: .layoutChanged, argument: signInButton)
    }
}
