/*
  The file-stage command should be run before running this command.

  This command will generate a Proof-of-Burn and a Pin Claim transaction
  for the file that was staged using the file-stage command. It will cause
  the file (CID) to be redundently pinned across multiple IPFS nodes
  (which are part of the PSFFPP network).
*/

// Global npm libraries

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import config from '../../config/index.js'

class FileStage {
  constructor () {
    // Encapsulate Dependencies
    this.walletUtil = new WalletUtil()
    this.config = config

    // Bind 'this' object to all subfunctions.
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Initialize the wallet.
      this.bchWallet = await this.walletUtil.instanceWallet(flags.name)

      // Instantiate the PSFFPP library.
      this.psffpp = this.walletUtil.instancePsffpp(this.bchWallet)

      // Get the cost to write 1MB to the PSFFPP network.
      // const writePrice = await this.psffpp.getMcWritePrice()
      // const writePrice = await this.bchWallet.getPsfWritePrice()
      // console.log(`Cost to write 1MB to the PSFFPP network: ${writePrice}`)

      // Generate a Pin Claim
      const pinObj = {
        cid: flags.cid,
        filename: flags.filename,
        fileSizeInMegabytes: parseInt(flags.size)
      }
      const { pobTxid, claimTxid } = await this.psffpp.createPinClaim(pinObj)
      console.log(`pobTxid: https://bch.loping.net/tx/${pobTxid}`)
      console.log(`claimTxid: https://bch.loping.net/tx/${claimTxid}`)
      console.log(`Check pinning status: https://pin.fullstack.cash/ipfs/pin-status/${flags.cid}`)
      console.log(`Once pinned, your file will be accessible here:`)
      console.log(`https://pin.fullstack.cash/ipfs/view/${flags.cid}`)

      return true
    } catch (err) {
      console.error('Error in file-pin: ', err)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if wallet not specified.
    const name = flags.name
    if (!name || name === '') {
      throw new Error('You must specify a wallet name with the -n flag.')
    }

    // Exit if CID is not specified.
    const cid = flags.cid
    if (!cid || cid === '') {
      throw new Error('You must specify a CID with the -c flag.')
    }

    // Exit if file size is not specified.
    let size = flags.size
    if (!size || size === '') {
      throw new Error('You must specify a file size with the -s flag.')
    }
    size = parseInt(size)
    if (isNaN(size)) {
      throw new Error('File size must be a number.')
    }

    // Exit if file name is not specified.
    const filename = flags.filename
    if (!filename || filename === '') {
      throw new Error('You must specify a file name with the -f flag.')
    }

    return true
  }
}

export default FileStage
