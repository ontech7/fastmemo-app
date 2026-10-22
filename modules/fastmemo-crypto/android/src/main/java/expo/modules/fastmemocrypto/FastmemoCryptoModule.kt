package expo.modules.fastmemocrypto

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class FastmemoCryptoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FastmemoCrypto")

    // An AsyncFunction runs off the JS thread, so the UI keeps animating meanwhile.
    AsyncFunction("pbkdf2Sha256Async") { password: String, saltHex: String, iterations: Int, keyLength: Int ->
      toHex(pbkdf2Sha256(password.toByteArray(Charsets.UTF_8), fromHex(saltHex), iterations, keyLength))
    }
  }
}

/**
 * PBKDF2 (RFC 8018) with HMAC-SHA256, over raw bytes. Written out rather than taken from
 * SecretKeyFactory, whose char[] password leaves the byte encoding to the provider: the key must be
 * byte-identical to crypto-js' on every platform, accented passphrases included.
 */
internal fun pbkdf2Sha256(password: ByteArray, salt: ByteArray, iterations: Int, keyLength: Int): ByteArray {
  require(iterations > 0 && keyLength > 0) { "iterations and keyLength must be positive" }
  val mac = Mac.getInstance("HmacSHA256")
  // HMAC zero-pads its key to the block size, so an empty password is the same key as a single zero
  // byte (SecretKeySpec rejects empty keys).
  mac.init(SecretKeySpec(if (password.isEmpty()) ByteArray(1) else password, "HmacSHA256"))

  val hLen = mac.macLength
  val out = ByteArray(keyLength)
  val u = ByteArray(hLen)
  val t = ByteArray(hLen)
  var block = 1
  var offset = 0
  while (offset < keyLength) {
    mac.update(salt)
    mac.update(byteArrayOf((block ushr 24).toByte(), (block ushr 16).toByte(), (block ushr 8).toByte(), block.toByte()))
    mac.doFinal(u, 0)
    u.copyInto(t)
    for (i in 1 until iterations) {
      mac.update(u)
      mac.doFinal(u, 0)
      for (j in 0 until hLen) t[j] = (t[j].toInt() xor u[j].toInt()).toByte()
    }
    val length = minOf(hLen, keyLength - offset)
    t.copyInto(out, offset, 0, length)
    offset += length
    block++
  }
  return out
}

private fun fromHex(hex: String): ByteArray {
  require(hex.length % 2 == 0) { "invalid hex" }
  return ByteArray(hex.length / 2) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
}

private fun toHex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
