/*
  wallet-based utility functions used by several different commands
*/

// Global npm libraries.
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'
import BchWallet from 'minimal-slp-wallet'
import MsgLib from 'bch-message-lib'
import EncryptLib from 'bch-encrypt-lib'
import PSFFPP from 'psffpp'

// Local libraries
import config from '../../config/index.js'

// Global variables
const __dirname = import.meta.dirname

class WalletUtil {
  constructor () {
    // Encapsulate all dependencies
    this.fs = fs
    this.config = config
    this.BchWallet = BchWallet
    this.MsgLib = MsgLib

    // Bind 'this' object to all subfunctions.
    this.saveWallet = this.saveWallet.bind(this)
    this.instanceWallet = this.instanceWallet.bind(this)
    this.instanceMsgLib = this.instanceMsgLib.bind(this)
    this.instanceEncryptLib = this.instanceEncryptLib.bind(this)
    this.instancePsffpp = this.instancePsffpp.bind(this)
  }

  // Save wallet data to a JSON file.
  async saveWallet (filename, walletData) {
    await this.fs.writeFile(filename, JSON.stringify(walletData, null, 2))

    return true
  }

  // Takes the wallet filename as input and returns an instance of
  // minimal-slp-wallet. Note: It will usually be best to run the
  // bchwallet.initialize() command after calling this function, to retrieve
  // the UTXOs held by the wallet.
  async instanceWallet (walletName) {
    try {
      // Input validation
      if (!walletName || typeof walletName !== 'string') {
        throw new Error('walletName is required.')
      }

      const filename = `${__dirname.toString()}/../../.wallets/${walletName}.json`

      // Load the wallet file.
      const walletStr = await readFile(filename)
      let walletData = JSON.parse(walletStr)
      walletData = walletData.wallet

      // Use info from the config file on how to initialize the wallet lib.
      const advancedConfig = {}
      advancedConfig.restURL = this.config.restURL
      advancedConfig.interface = this.config.interface
      advancedConfig.hdPath = walletData.hdPath

      const bchWallet = new this.BchWallet(walletData.mnemonic, advancedConfig)

      await bchWallet.walletInfoPromise

      return bchWallet
    } catch (err) {
      console.error('Error in wallet-util.js/instanceWallet()')
      throw err
    }
  }

  // Instantiate the bch-message-lib library with an instance of minimal-slp-wallet.
  instanceMsgLib (wallet) {
    if (!wallet) {
      throw new Error('Must pass instance of minimal-slp-wallet.')
    }

    const msgLib = new this.MsgLib({ wallet })

    return msgLib
  }

  // Instantiate the
  instanceEncryptLib (inObj = {}) {
    const { bchjs } = inObj

    if (!bchjs) {
      throw new Error('Must pass instance of bch-js when instatiating bch-encrypt-lib')
    }

    const encryptLib = new EncryptLib({ bchjs })

    return encryptLib
  }

  // Instantiate the PSFFPP library.
  instancePsffpp (wallet) {
    const psffpp = new PSFFPP({ wallet })

    return psffpp
  }
}

export default WalletUtil
