import Foundation
import Combine
import Network

/// Connection preferences belong to Mi música; they do not change iOS-wide data settings.
/// Check immediately before each app-managed transfer. A new check is needed for every file.
final class NativeMusicConnectionPolicy: ObservableObject {
    static let shared = NativeMusicConnectionPolicy()

    @Published private(set) var path: NWPath?
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.tifloacosta.music.network")

    private init() {
        monitor.pathUpdateHandler = { [weak self] updated in
            DispatchQueue.main.async { self?.path = updated }
        }
        monitor.start(queue: queue)
    }

    private func permitted(allowCellular: Bool) -> Bool {
        guard let path, path.status == .satisfied else { return false }
        if path.usesInterfaceType(.wifi) || path.usesInterfaceType(.wiredEthernet) { return true }
        if path.usesInterfaceType(.cellular) { return allowCellular }
        return false
    }

    func canDownload(allowCellular: Bool) -> Bool { permitted(allowCellular: allowCellular) }
    func canStream(allowCellular: Bool) -> Bool { permitted(allowCellular: allowCellular) }
}
