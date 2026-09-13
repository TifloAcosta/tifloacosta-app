import Capacitor

final class TifloBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(SaveFilePlugin())
    }
}
