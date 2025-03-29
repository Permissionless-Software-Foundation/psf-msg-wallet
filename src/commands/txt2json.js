/*
  This is a utility command that will convert a txt file to a JSON object.
  This tool is useful for converting a large message that could contain multiple
  paragraphs, links, special characters, etc. into a one-line string that can
  be included in a JSON file. That file can then be used as input for the
  msg-nostr-send command with the -j flag.

  Example:
  $ psf-msg-wallet txt-2-json -f test-msg.txt
*/

// Global npm libraries
import fs from 'fs'

class Txt2Json {
  constructor () {
    this.fs = fs
  }

  run (flags) {
    try {
      const { file } = flags

      const fileContent = fs.readFileSync(`./files/${file}`, 'utf8')

      // Escape special characters for JSON
      const jsonOutput = {
        message: fileContent
      }

      // Convert to JSON string
      const jsonString = JSON.stringify(jsonOutput, null, 2)

      // Output the JSON string to the console
      console.log(jsonString)

      return true
    } catch (err) {
      console.error('Error in txt-2-json: ', err)
      return 0
    }
  }
}

export default Txt2Json
