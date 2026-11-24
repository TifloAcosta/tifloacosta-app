import SwiftUI

/// Official provider collections. Playback remains with RAI until a supported
/// integration contract is confirmed; never resolve private media endpoints.
struct NativeRaiPlaySoundScreen: View {
    let kind: AccessibleCinemaKind
    var body: some View {
        List {
            if kind == .all || kind == .film {
                Link("Películas", destination: URL(string: "https://www.raiplaysound.it/generi/Audiodescrizioni-Film-a910d15a-ac26-42da-b970-0e4f1b46c0f0.html")!)
            }
            if kind == .all || kind == .series {
                Link("Series", destination: URL(string: "https://www.raiplaysound.it/generi/Audiodescrizioni-fiction-333aeffb-471a-429d-9b88-8f5b4c9e50d9.html")!)
            }
            if kind == .all || kind == .film || kind == .series || kind == .short {
                Link("Cartoni animati", destination: URL(string: "https://www.raiplaysound.it/generi/Audiodescrizioni-cartoni-69f5b569-e19e-41d0-afe9-17a9b2861946.html")!)
            }
            Link("Todos los contenidos", destination: URL(string: "https://www.raiplaysound.it/generi/Audiodescrizioni-Tutti-i-podcast-f93943af-3ab2-4bc8-b6bf-c288ccd4f755.html")!)
            Text("Acceso sujeto a derechos territoriales.")
        }
        .navigationTitle("RaiPlay Sound")
    }
}
