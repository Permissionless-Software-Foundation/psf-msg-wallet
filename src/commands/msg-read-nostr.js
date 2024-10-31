/*
  Read e2e encrypted messages that have been posted to Nostr
*/

// Global npm libraries
import RetryQueue from '@chris.troutner/retry-queue'
import EncryptLib from 'bch-encrypt-lib'
import Nostr from 'nostr'
import { bytesToHex } from '@noble/hashes/utils'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class MsgReadNostr {
  constructor () {
    // Encapsulate Dependencies
    this.walletUtil = new WalletUtil()
    this.RelayPool = Nostr.RelayPool
    this.bytesToHex = bytesToHex

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
    this.getSenderFromTx = this.getSenderFromTx.bind(this)
    this.getAndDecrypt = this.getAndDecrypt.bind(this)
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
      // To-Do: Move this instantiation to the walletUtil library.
      this.encryptLib = new EncryptLib({ bchjs: this.bchWallet.bchjs })

      const { sender, message } = await this.msgRead(flags)
      console.log(`Sender: ${sender}`)
      console.log(`Message:\n${message}`)

      return message
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

      // Get TX Data
      const txDataResult = await this.bchWallet.getTxData([txid])
      const txData = txDataResult[0]
      // console.log(`txData: ${JSON.stringify(txData, null, 2)}`)

      const sender = this.getSenderFromTx(txData)
      // console.log('sender: ', sender)

      // get the Nostr eventId from tx OP_RETURN
      const eventId = this.getEventIdFromTx(txData)
      console.log(`Nostr Event ID: ${eventId}`)

      // Get the encrypted message from Nostr and decrypt it.
      const message = await this.getAndDecrypt(eventId)

      return { sender, message }
    } catch (error) {
      console.error('Error in msgRead()')
      throw error
    }
  }

  // Given data on a TX, get the sender. This is assumed to be the address
  // behind the first input of the transaction.
  getSenderFromTx (txData) {
    const sender = txData.vin[0].address

    return sender
  }

  // decode and get transaction eventId from OP_RETURN
  getEventIdFromTx (txData) {
    try {
      // Input validation
      if (!txData) {
        throw new Error('txData object is required.')
      }
      let eventId = ''

      // Loop through all the vout entries in this transaction.
      for (let j = 0; j < txData.vout.length; j++) {
        // for (let j = 0; j < 5; j++) {
        const thisVout = txData.vout[j]
        // console.log(`thisVout: ${JSON.stringify(thisVout,null,2)}`)

        // Assembly code representation of the transaction.
        const asm = thisVout.scriptPubKey.asm
        // console.log(`asm: ${asm}`)

        // Decode the transactions assembly code.
        const msg = this.msgLib.memo.decodeTransaction(asm, '-21101')

        if (msg) {
          // Filter the code to see if it contains an IPFS eventId And Subject.
          const data = this.msgLib.memo.filterMSG(msg, 'MSG NOSTR')
          // console.log('data: ', data)
          if (data && data.hash) {
            eventId = data.hash
          }
        }
      }

      if (!eventId) {
        throw new Error('Message not found!')
      }

      return eventId
    } catch (error) {
      console.log('Error in getEventIdFromTx()')
      throw error
    }
  }

  // Retrieve the encrypted data from a Nostr relay and decrypt it.
  async getAndDecrypt (eventId) {
    // Define the relay pool.
    const psf = 'wss://nostr-relay.psfoundation.info'
    const relays = [psf]
    const pool = this.RelayPool(relays)

    const nostrData = new Promise((resolve, reject) => {
      pool.on('open', relay => {
        relay.subscribe('REQ', { ids: [eventId] })
      })

      pool.on('eose', relay => {
        relay.close()
      })

      pool.on('event', (relay, subId, ev) => {
        resolve(ev)
      })
    })

    const event = await nostrData
    // console.log('event: ', event)

    const encryptedData = event.content

    // decrypt message
    const messageHex = await this.encryptLib.encryption.decryptFile(
      this.bchWallet.walletInfo.privateKey,
      encryptedData
    )
    // console.log(`messageHex: ${messageHex}`)

    const buf = Buffer.from(messageHex, 'hex')
    const decryptedMsg = buf.toString('utf8')
    // console.log('Message :', decryptedMsg)

    return decryptedMsg
  }
}

export default MsgReadNostr
