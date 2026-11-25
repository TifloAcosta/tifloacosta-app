import Foundation
import Security

enum NativeAcoustIDKeychain {
    enum Slot: String { case active, pending }

    private static func query(_ slot: Slot) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.tifloacosta.app.acoustid",
         kSecAttrAccount as String: slot.rawValue]
    }

    static func read(_ slot: Slot) throws -> String? {
        var attributes = query(slot)
        attributes[kSecReturnData as String] = true
        attributes[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(attributes as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        try check(status)
        return (result as? Data).flatMap { String(data: $0, encoding: .utf8) }
    }

    static func save(_ key: String, in slot: Slot) throws {
        let attributes = query(slot)
        let data = [kSecValueData as String: Data(key.utf8)]
        let status = SecItemUpdate(attributes as CFDictionary, data as CFDictionary)
        if status != errSecItemNotFound { try check(status); return }
        var item = attributes
        item[kSecValueData as String] = Data(key.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        try check(SecItemAdd(item as CFDictionary, nil))
    }

    static func remove(_ slot: Slot) throws {
        let status = SecItemDelete(query(slot) as CFDictionary)
        if status != errSecItemNotFound { try check(status) }
    }

    private static func check(_ status: OSStatus) throws {
        guard status == errSecSuccess else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }
    }
}
