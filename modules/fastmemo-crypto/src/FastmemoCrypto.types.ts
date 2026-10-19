export interface FastmemoCryptoApi {
  /**
   * PBKDF2-HMAC-SHA256 over the UTF-8 bytes of `password` and the bytes of `saltHex`, as hex. Same
   * output as crypto-js' `PBKDF2(password, Hex.parse(saltHex), { hasher: SHA256 })`.
   */
  pbkdf2Sha256Async(password: string, saltHex: string, iterations: number, keyLength: number): Promise<string>;
}
