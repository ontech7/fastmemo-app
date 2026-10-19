import CommonCrypto
import ExpoModulesCore

public class FastmemoCryptoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FastmemoCrypto")

    // An AsyncFunction runs off the JS thread, so the UI keeps animating meanwhile.
    AsyncFunction("pbkdf2Sha256Async") { (password: String, saltHex: String, iterations: Int, keyLength: Int) throws -> String in
      try pbkdf2Sha256Hex(password: password, saltHex: saltHex, iterations: iterations, keyLength: keyLength)
    }
  }
}

enum Pbkdf2Error: Error {
  case invalidArgument
  case derivationFailed(Int32)
}

/** PBKDF2-HMAC-SHA256 over the UTF-8 bytes of `password`, byte-identical to crypto-js' output. */
func pbkdf2Sha256Hex(password: String, saltHex: String, iterations: Int, keyLength: Int) throws -> String {
  guard iterations > 0, keyLength > 0, let salt = bytes(fromHex: saltHex) else { throw Pbkdf2Error.invalidArgument }
  // HMAC zero-pads its key to the block size, so an empty password is the same key as a single zero byte.
  var passwordBytes = Array(password.utf8)
  if passwordBytes.isEmpty { passwordBytes = [0] }

  var derived = [UInt8](repeating: 0, count: keyLength)
  let status = passwordBytes.withUnsafeBufferPointer { passwordBuffer in
    passwordBuffer.withMemoryRebound(to: CChar.self) { passwordChars in
      CCKeyDerivationPBKDF(
        CCPBKDFAlgorithm(kCCPBKDF2),
        passwordChars.baseAddress, passwordChars.count,
        salt, salt.count,
        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
        UInt32(iterations),
        &derived, derived.count
      )
    }
  }
  guard status == kCCSuccess else { throw Pbkdf2Error.derivationFailed(status) }
  return derived.map { String(format: "%02x", $0) }.joined()
}

private func bytes(fromHex hex: String) -> [UInt8]? {
  let chars = Array(hex.utf8)
  guard chars.count % 2 == 0 else { return nil }
  var out = [UInt8]()
  out.reserveCapacity(chars.count / 2)
  var i = 0
  while i < chars.count {
    guard let byte = UInt8(String(decoding: chars[i..<i + 2], as: UTF8.self), radix: 16) else { return nil }
    out.append(byte)
    i += 2
  }
  return out
}
