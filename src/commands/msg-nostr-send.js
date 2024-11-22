/*
  This command will send an E2EE message to a BCH address.

  1. The public key for the given address is retrieved from the blockchain. This
  requires that the address has made at least one transaction.
  2. The message is encrypted using the public key.
  3. The encrypted message is uploaded to a Nostr relay.
  4. An notification signal is broadcasted to the blockchain to notify the receiver of the message.
*/

// Global npm libraries
import RetryQueue from '@chris.troutner/retry-queue'
import BchNostr from 'bch-nostr'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class MsgNostrSend {
  constructor () {
    // Encapsulate Dependencies
    this.walletUtil = new WalletUtil()
    this.bchNostr = new BchNostr()

    const options = {
      concurrency: 1,
      attempts: 5,
      retryPeriod: 1000
    }
    this.retryQueue = new RetryQueue(options)

    // Bind 'this' object to all subfunctions.
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.msgSend = this.msgSend.bind(this)
    this.encryptMsgStr = this.encryptMsgStr.bind(this)
    this.uploadToNostr = this.uploadToNostr.bind(this)
    this.sendMsgSignal = this.sendMsgSignal.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Initialize the wallet.
      this.bchWallet = await this.walletUtil.instanceWallet(flags.name)
      await this.bchWallet.initialize()

      // Initialize the message library.
      this.msgLib = this.walletUtil.instanceMsgLib(this.bchWallet)

      // Initialize the encryption library.
      this.encryptLib = this.walletUtil.instanceEncryptLib({ bchjs: this.bchWallet.bchjs })

      // Send the message. (Primary orchestration function)
      const { txid, eventId } = await this.msgSend(flags)

      console.log('Message sent successfully!')
      console.log(`Message signal TXID: ${txid}`)
      console.log(`Encrypted message uploaded as Nostr event ID: ${eventId}`)

      return true
    } catch (err) {
      console.error('Error in msg-nostr-send: ', err)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if wallet not specified.
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    // Exit if address not specified.
    const addr = flags.addr
    if (!addr || addr === '') {
      throw new Error('You must specify an address to send to with the -a flag.')
    }

    // Exit if message not specified.
    const msg = flags.msg
    if (!msg || msg === '') {
      throw new Error('You must specify a message with the -m flag.')
    }

    return true
  }

  // Primary, orchestration function
  async msgSend (flags) {
    try {
      // Encrypt the message with the receivers public key.
      const encryptedStr = await this.encryptMsgStr(flags)

      const eventId = await this.retryQueue.addToQueue(this.uploadToNostr, { encryptedStr })
      console.log('Encrypted message uploaded to Nostr with post event ID: ', eventId)

      // Broadcast a PS001 signal on the blockchain, to signal the recipient
      // that they have a message waiting.
      flags.eventId = eventId
      const { txid } = await this.sendMsgSignal(flags)

      return { txid, eventId }
    } catch (err) {
      console.error('Error in msgSend()')
      throw err
    }
  }

  // Encrypt the message string. Returns a hexidecimal string representing
  // the encrypted message.
  async encryptMsgStr (flags) {
    try {
      const { addr, msg } = flags

      // Get public Key for reciever, from the blockchain.
      const publicKey = await this.retryQueue.addToQueue(this.bchWallet.getPubKey, addr)
      // console.log(`BCH Public Key: ${JSON.stringify(publicKey, null, 2)}`)

      // Convert the original message to a hex representation.
      const buff = Buffer.from(msg)
      const hex = buff.toString('hex')

      // Encrypt the hex string representing the message.
      const encryptedStr = await this.encryptLib.encryption.encryptFile(
        publicKey,
        hex
      )

      // Return the encrypted hex string.
      return encryptedStr
    } catch (err) {
      console.error('Error in encryptMsgStr()')
      throw err
    }
  }

  // Upload the encrypted message to Nostr. Returns the event ID of the posted
  // message.
  async uploadToNostr (inObj = {}) {
    try {
      const { encryptedStr } = inObj

      // Generate nostr private and public keys from the BCH wallet private key.
      const wif = this.bchWallet.walletInfo.privateKey
      const { privKeyBuf, nostrPubKey } = this.bchNostr.keys.createNostrPubKeyFromWif({ wif })

      const relayWs = 'wss://nostr-relay.psfoundation.info'

      const uploadObj = {
        privKeyBuf,
        nostrPubKey,
        relayWs,
        msg: encryptedStr
      }

      // Upload the encrypted message to Nostr
      const eventId = await this.bchNostr.post.uploadToNostr(uploadObj)

      return eventId
    } catch (err) {
      console.error('Error in uploadToNostr()')
      throw new Error(err.message)
    }
  }

  // Generate and broadcast a PS001 message signal.
  async sendMsgSignal (inObj) {
    const { addr, subject, eventId } = inObj

    // Create and broadcast a message signal on the BCH blockchain.
    const sendObj = {
      wallet: this.bchWallet,
      addr,
      subject,
      eventId
    }
    const { txid } = await this.bchNostr.signal.sendMsgSignal(sendObj)

    return { txid }
  }
}

export default MsgNostrSend
