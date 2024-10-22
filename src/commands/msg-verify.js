/*
  Cryptographically verify a message and signature was signed by a provided
  BCH address.
*/

// Global npm libraries

// Local libraries
import BchWallet from 'minimal-slp-wallet'

class MsgVerify {
  constructor () {
    // Encapsulate Dependencies

    // Bind 'this' object to all subfunctions.
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.verify = this.verify.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Initialize the wallet.
      this.bchWallet = new BchWallet()
      await this.bchWallet.walletInfoPromise

      // Sweep any BCH and tokens from the private key.
      const result = await this.verify(flags)

      console.log(`Message: ${flags.msg}`)
      console.log(`Signature: ${flags.sig}`)
      console.log(`Signature was generated by private key associated with address ${flags.addr}: ${result}`)

      return true
    } catch (err) {
      console.error('Error in msg-sign: ', err)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if address not specified.
    const addr = flags.addr
    if (!addr || addr === '') {
      throw new Error('You must specify an address with the -a flag.')
    }

    // Exit if wallet not specified.
    const msg = flags.msg
    if (!msg || msg === '') {
      throw new Error('You must specify a message to sign with the -m flag.')
    }

    // Exit if signature not specified.
    const sig = flags.sig
    if (!sig || sig === '') {
      throw new Error('You must specify a signature with the -s flag.')
    }

    return true
  }

  async verify (flags) {
    try {
      const result = this.bchWallet.bchjs.BitcoinCash.verifyMessage(
        flags.addr,
        flags.sig,
        flags.msg
      )

      return result
    } catch (err) {
      console.error('Error in verify()')
      throw err
    }
  }
}

export default MsgVerify