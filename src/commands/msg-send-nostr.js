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
import EncryptLib from 'bch-encrypt-lib'
import { base58_to_binary as base58ToBinary } from 'base58-js'
// import { bytesToHex } from '@noble/hashes/utils'
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import { Relay, useWebSocketImplementation } from 'nostr-tools/relay'
import WebSocket from 'ws'

// Local libraries
import WalletUtil from '../lib/wallet-util.js'

useWebSocketImplementation(WebSocket)

class MsgSendNostr {
  constructor () {
    // Encapsulate Dependencies
    this.walletUtil = new WalletUtil()

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
    this.createNostrPubKey = this.createNostrPubKey.bind(this)
    this.sendMsgSignal = this.sendMsgSignal.bind(this)
    this.signalMessage = this.signalMessage.bind(this)
    this.encryptMsg = this.encryptMsg.bind(this)
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

      // Sweep any BCH and tokens from the private key.
      const txid = await this.msgSend(flags)

      console.log(`BCH successfully swept from private key ${flags.wif}`)
      console.log(`TXID: ${txid}`)
      console.log('\nView this transaction on a block explorer:')
      console.log(`https://bch.loping.net/tx/${txid}`)

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

  // Orchestration function
  async msgSend (flags) {
    try {
      // Encrypt the message with the receivers public key.
      const encryptedStr = await this.encryptMsgStr(flags)

      const eventId = await this.retryQueue.addToQueue(this.uploadToNostr, { encryptedStr })
      console.log('Encrypted message uploaded to Nostr with post event ID: ', eventId)

      // Broadcast a PS001 signal on the blockchain, to signal the recipient
      // that they have a message waiting.
      const txid = await this.sendMsgSignal(flags, eventId)

      return txid
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

      // Get public Key for reciever from the blockchain.
      // const pubKey = await this.walletService.getPubKey(bchAddress)
      const publicKey = await this.retryQueue.addToQueue(this.bchWallet.getPubKey, addr)
      // const publicKey = pubKey.pubkey.publicKey
      console.log(`BCH Public Key: ${JSON.stringify(publicKey, null, 2)}`)

      // Encrypt the message using the recievers public key.
      const encryptedMsg = await this.encryptMsg(publicKey, msg)
      console.log(`encryptedMsg: ${JSON.stringify(encryptedMsg, null, 2)}`)

      return encryptedMsg
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

      // Generate a Nostr pub key from the private key of this wallet.
      const { privKeyBuf, nostrPubKey } = this.createNostrPubKey()
      console.log('nostrPubKey: ', nostrPubKey)

      const psfRelay = 'wss://nostr-relay.psfoundation.info'

      // Generate a Nostr post.
      const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: encryptedStr
      }

      // Sign the post
      const signedEvent = finalizeEvent(eventTemplate, privKeyBuf)
      // console.log('signedEvent: ', signedEvent)
      const eventId = signedEvent.id

      // Connect to a relay.
      const relay = await Relay.connect(psfRelay)
      console.log(`connected to ${relay.url}`)

      // Publish the message to the relay.
      await relay.publish(signedEvent)

      // Close the connection to the relay.
      relay.close()

      return eventId
    } catch (err) {
      console.error('Error in uploadToNostr()')
      throw err
    }
  }

  // Generate a Nostr pubkey from the private key for this wallet.
  createNostrPubKey () {
    const wif = this.bchWallet.walletInfo.privateKey
    // console.log('wif: ', wif)

    // Extract the privaty key from the WIF, using this guide:
    // https://learnmeabitcoin.com/technical/keys/private-key/wif/
    const wifBuf = base58ToBinary(wif)
    const privKeyBuf = wifBuf.slice(1, 33)

    // const privKeyHex = bytesToHex(privKeyBuf)

    const nostrPubKey = getPublicKey(privKeyBuf)

    return { privKeyBuf, nostrPubKey }
  }

  // Generate and broadcast a PS001 message signal.
  async sendMsgSignal (flags, eventId) {
    const { addr, subject } = flags

    // Wait a couple seconds to let the indexer update its UTXO state.
    await this.bchWallet.bchjs.Util.sleep(2000)

    // Update the UTXO store in the wallet.
    await this.bchWallet.getUtxos()

    // Sign Message
    const txHex = await this.signalMessage(eventId, addr, subject)

    // Broadcast Transaction
    const txidStr = await this.bchWallet.ar.sendTx(txHex)
    console.log(`Signal Transaction ID : ${JSON.stringify(txidStr, null, 2)}`)

    return txidStr
  }

  // Generate a PS001 signal message to write to the blockchain.
  // https://github.com/Permissionless-Software-Foundation/specifications/blob/master/ps001-media-sharing.md
  async signalMessage (eventId, bchAddress, subject) {
    try {
      if (!eventId || typeof eventId !== 'string') {
        throw new Error('eventId must be a string')
      }
      if (!bchAddress || typeof bchAddress !== 'string') {
        throw new Error('bchAddress must be a string')
      }
      if (!subject || typeof subject !== 'string') {
        throw new Error('subject must be a string')
      }

      // Generate the hex transaction containing the PS001 message signal.
      const txHex = await this.msgLib.memo.writeMsgSignalNostr(
        eventId,
        [bchAddress],
        subject
      )

      if (!txHex) {
        throw new Error('Could not build a hex transaction')
      }

      return txHex
    } catch (error) {
      console.log('Error in signalMessage')
      throw error
    }
  }

  // Encrypt a message using encryptLib
  async encryptMsg (pubKey, msg) {
    try {
      // Input validation
      if (!pubKey || typeof pubKey !== 'string') {
        throw new Error('pubKey must be a string')
      }
      if (!msg || typeof msg !== 'string') {
        throw new Error('msg must be a string')
      }

      const buff = Buffer.from(msg)
      const hex = buff.toString('hex')

      const encryptedStr = await this.encryptLib.encryption.encryptFile(
        pubKey,
        hex
      )
      // console.log(`encryptedStr: ${JSON.stringify(encryptedStr, null, 2)}`)

      return encryptedStr
    } catch (error) {
      console.log('Error in encryptMsg()')
      throw error
    }
  }
}

export default MsgSendNostr
