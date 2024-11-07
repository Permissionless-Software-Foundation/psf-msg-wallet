/*
  Check for received messages in a wallet

  ...when Nostr is used as the medium to store encrypted messages.
*/

// Global npm libraries
// import RetryQueue from '@chris.troutner/retry-queue'
import EncryptLib from 'bch-encrypt-lib'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
// import { base58_to_binary as base58ToBinary } from 'base58-js'
// import { bytesToHex } from '@noble/hashes/utils'
// import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
// import { Relay, useWebSocketImplementation } from 'nostr-tools/relay'
// import WebSocket from 'ws'
import Table from 'cli-table'

// useWebSocketImplementation(WebSocket)

class MsgCheckNostr {
  constructor () {
    // Encapsulate Dependencies
    this.walletUtil = new WalletUtil()

    // const options = {
    //   concurrency: 1,
    //   attempts: 5,
    //   retryPeriod: 1000
    // }
    // this.retryQueue = new RetryQueue(options)

    // Bind 'this' object to all subfunctions.
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.msgCheck = this.msgCheck.bind(this)
    this.filterMessages = this.filterMessages.bind(this)
    this.displayTable = this.displayTable.bind(this)
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

      // Check for new message signals on the blockchain.
      await this.msgCheck(flags)

      return true
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

    return true
  }

  // Primary macro function for checking messages.
  async msgCheck (flags) {
    try {
      const cashAddress = this.bchWallet.walletInfo.cashAddress

      // Get message signals from the blockchain.
      console.log(`cashAddress ${cashAddress}`)
      const messages = await this.msgLib.memo.readMsgSignal(cashAddress, 'MSG NOSTR')
      console.log('message: ', messages)

      // Filter out sent messages, so user only sees recieved messages.
      const receiveMessages = this.filterMessages(cashAddress, messages)
      if (!receiveMessages.length) {
        console.log('No Messages Found!')
        return false
      }

      // Display the messages on the screen.
      this.displayTable(receiveMessages)

      return true
    } catch (err) {
      console.error('Error in msgCheck()')
      throw err
    }
  }

  // Ignores send messages
  // returns only received messages
  filterMessages (bchAddress, messages) {
    try {
      if (!bchAddress || typeof bchAddress !== 'string') {
        throw new Error('bchAddress must be a string.')
      }
      if (!Array.isArray(messages)) {
        throw new Error('messages must be an array.')
      }
      const filtered = []

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i]
        if (message.sender !== bchAddress) {
          filtered.push(message)
        }
      }
      return filtered
    } catch (error) {
      console.log('Error in filterMessages()')
      throw error
    }
  }

  // Display table in a table on the command line using cli-table.
  displayTable (data) {
    const table = new Table({
      head: ['Subject', 'Transaction ID'],
      colWidths: [25, 80]
    })

    for (let i = 0; i < data.length; i++) {
      const _data = [data[i].subject, data[i].txid]
      table.push(_data)
    }

    const tableStr = table.toString()

    // Cut down on screen spam when running unit tests.
    console.log(tableStr)

    return tableStr
  }
}

export default MsgCheckNostr
