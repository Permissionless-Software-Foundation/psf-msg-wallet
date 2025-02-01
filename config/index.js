/*
  Configure your CLI app with these settings.
  Modify these values to suite your needs.

  More info at https://CashStack.info
*/

const config = {
  // The REST URL for the server used by minimal-slp-wallet.
  restURL: 'https://free-bch.fullstack.cash',

  // consumer-api = web 3 Cash Stack (ipfs-bch-wallet-consumer)
  // rest-api = web 2 Cash Stack (bch-api)
  interface: 'consumer-api',

  // File Staging URL
  // Any server running an instance of the ipfs-file-stager app.
  // https://github.com/Permissionless-Software-Foundation/ipfs-file-stager
  fileStagingURL: 'https://file-stage.fullstack.cash'
}

export default config
