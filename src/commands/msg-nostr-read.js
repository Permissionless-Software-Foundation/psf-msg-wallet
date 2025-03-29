/*
  Read e2e encrypted messages that have been posted to Nostr
*/

// Global npm libraries
import RetryQueue from '@chris.troutner/retry-queue'
import Nostr from 'nostr'
import { bytesToHex } from '@noble/hashes/utils'
import BchNostr from 'bch-nostr'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class MsgNostrRead {
  constructor () {
    // Encapsulate Dependencies
    this.walletUtil = new WalletUtil()
    this.RelayPool = Nostr.RelayPool
    this.bytesToHex = bytesToHex
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
    this.msgRead = this.msgRead.bind(this)
    this.decryptMsg = this.decryptMsg.bind(this)
    this.formatMsg = this.formatMsg.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Initialize the wallet.
      this.bchWallet = await this.walletUtil.instanceWallet(flags.name)
      await this.bchWallet.initialize()

      // Initialize the encryption library.
      this.encryptLib = this.walletUtil.instanceEncryptLib({ bchjs: this.bchWallet.bchjs })

      // Get the sender and encrypted message.
      const { sender, message } = await this.msgRead(flags)

      // Decrypt the message
      let clearMsg = await this.decryptMsg({ encryptedMsgHex: message })
      // console.log('clearMsg (1): ', clearMsg)

      // Format the message
      clearMsg = await this.formatMsg(clearMsg)

      console.log(`Sender: ${sender}`)
      console.log(`Message:\n${clearMsg}`)

      return clearMsg
    } catch (err) {
      console.error('Error in send-bch: ', err)
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
    const txid = flags.txid
    if (!txid || txid === '') {
      throw new Error('You must specify a TXID representing a message with the -t flag.')
    }

    return true
  }

  // Primary macro/orchestration function
  async msgRead (flags) {
    try {
      const { txid } = flags

      // Retrieve the encrypted message from the Nostr relay.
      const readObj = {
        txid,
        wallet: this.bchWallet
      }
      const { message, sender } = await this.bchNostr.read.getNostrMsgFromTxid(readObj)

      return { sender, message }
    } catch (error) {
      console.error('Error in msgRead()')
      throw error
    }
  }

  // Decrypt the message using the BCH wallet private key.
  async decryptMsg (inObj = {}) {
    try {
      const { encryptedMsgHex } = inObj

      // decrypt message
      const messageHex = await this.encryptLib.encryption.decryptFile(
        this.bchWallet.walletInfo.privateKey,
        encryptedMsgHex
      )

      const buf = Buffer.from(messageHex, 'hex')
      const decryptedMsg = buf.toString('utf8')
      // console.log('Message :', decryptedMsg)

      return decryptedMsg
    } catch (err) {
      console.error('Error in decryptFile(): ', err)
      throw err
    }
  }

  // Format the message. Test to see if the message is a JSON object. If it is,
  // parse the JSON and return the message component. If it is not JSON, then
  // return the message as is.
  formatMsg (msg) {
    try {
      let msgOut = ''

      try {
        msgOut = JSON.parse(msg)
        return msgOut.message
      } catch (err) {
        return msg
      }
    } catch (err) {
      console.error('Error in formatMsg(): ', err)
      throw err
    }
  }
}
export default MsgNostrRead
