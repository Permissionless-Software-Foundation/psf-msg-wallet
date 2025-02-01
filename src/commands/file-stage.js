/*
  Upload a file to the file staging IPFS node. This will stage the file
  for pinning across the PSFFPP network.
*/

// Global npm libraries
import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'
import config from '../../config/index.js'

class FileStage {
  constructor () {
    // Encapsulate Dependencies
    this.walletUtil = new WalletUtil()
    this.config = config
    this.axios = axios

    // Bind 'this' object to all subfunctions.
    this.run = this.run.bind(this)
    this.validateFlags = this.validateFlags.bind(this)
    this.uploadFile = this.uploadFile.bind(this)
    this.getFileSize = this.getFileSize.bind(this)
  }

  async run (flags) {
    try {
      this.validateFlags(flags)

      // Get the size of the file.
      const fileSize = await this.getFileSize(flags)

      if (fileSize > 100) {
        throw new Error('File size must be less than 100MB.')
      }

      const cid = await this.uploadFile(flags)

      console.log(`File uploaded successfully. CID:\n${cid}`)
      console.log(`File size: ${fileSize} MB`)

      return true
    } catch (err) {
      console.error('Error in send-bch: ', err)
      return 0
    }
  }

  validateFlags (flags = {}) {
    // Exit if file is not specified.
    const filePath = flags.filePath
    if (!filePath || filePath === '') {
      throw new Error('You must specify a file path with the -f flag.')
    }

    return true
  }

  async uploadFile (flags = {}) {
    try {
      const { filePath } = flags
      console.log('Uploading file: ', filePath)

      // Create a read stream from the file
      const fileStream = fs.createReadStream(filePath)

      // Create a new FormData instance
      const form = new FormData()

      // Append the file stream to the form data
      // The key "file" matches whatever your server expects under its multipart field name
      form.append('file', fileStream)

      // Make a POST request to the server with the form data
      const response = await this.axios.post(`${this.config.fileStagingURL}/ipfs/upload`, form, {
        headers: {
          // `form.getHeaders()` contains the correct `Content-Type: multipart/form-data; boundary=...`
          ...form.getHeaders()
        }
      })

      // console.log('File uploaded successfully:', response.data);

      const cid = response.data.cid

      return cid
    } catch (err) {
      console.error('Error in uploadFile: ', err)
      return false
    }
  }

  // Returns the size of the file in Megabytes.
  async getFileSize (flags = {}) {
    try {
      const { filePath } = flags

      const stats = fs.statSync(filePath)
      const fileSizeInBytes = stats.size
      let fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024)

      // Round the file size to two decimal points
      fileSizeInMegabytes = fileSizeInMegabytes * 100
      fileSizeInMegabytes = Math.ceil(fileSizeInMegabytes)
      fileSizeInMegabytes = fileSizeInMegabytes / 100

      // console.log(`File ${filePath} is ${fileSizeInMegabytes} MB.`)

      return fileSizeInMegabytes
    } catch (err) {
      console.error('Error in getFileSize()')
      throw err
    }
  }
}

export default FileStage
