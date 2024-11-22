/*
  Check for received messages in a wallet

  ...when Nostr is used as the medium to store encrypted messages.
*/

// Global npm libraries
// import RetryQueue from '@chris.troutner/retry-queue'
import BchNostr from 'bch-nostr'
import Table from 'cli-table'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

class MsgNostrCheck {
  constructor () {
    // Encapsulate Dependencies
    this.walletUtil = new WalletUtil()
    this.bchNostr = new BchNostr()

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
      // this.encryptLib = this.walletUtil.instanceEncryptLib({ bchjs: this.bchWallet.bchjs })

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

      const checkObj = {
        wallet: this.bchWallet,
        addr: cashAddress,
        limit: 5
      }

      const msgs = await this.bchNostr.signal.checkMsgs(checkObj)

      // Display the messages on the screen.
      // this.displayTable(receiveMessages)
      this.displayTable(msgs)

      return true
    } catch (err) {
      console.error('Error in msgCheck()')
      throw err
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

export default MsgNostrCheck
