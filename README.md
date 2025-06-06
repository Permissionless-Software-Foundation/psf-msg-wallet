# psf-msg-wallet

This is a command-line interface (CLI) forked from [psf-bch-wallet](https://github.com/Permissionless-Software-Foundation/psf-bch-wallet). This fork has all the same commands, but adds additional commands around sending an end-to-end encrypted (**E2EE**) message to any BCH address, similar to email. It uses a [Nostr](https://nostr.org/) relay to store the encrypted message, until the receiver can download and decrypt it with their BCH wallet.

Commands have also been added for uploading files to the [PSF IPFS network](https://psffpp.com). In the future, commands will be added for encrypting and decrypting files using a BCH wallet.

## Installation

This software requires node.js v20 or higher. Instructions for installation:

- `git clone https://github.com/Permissionless-Software-Foundation/psf-msg-wallet`
- `cd psf-msg-wallet`
- `npm install`

## Usage

### Display Help

- `node psf-msg-wallet.js help`

-----

### Message Commands

This fork retains all the commands available in [psf-bch-wallet](https://github.com/Permissionless-Software-Foundation/psf-bch-wallet). Check that README for additional commands.

-----
-----

#### Check For New Messages

Check for new messages. If your address has recieved a message signal, the TXID of the message signal will be displayed. You'll need that TXID to download the message for decrypting and reading.

##### Arguments
- `-n` - flag to give your wallet name, to check for message signals sent to your address.

##### Example
- `node psf-msg-wallet.js msg-nostr-check -n wallet1`

-----

#### Send E2EE Message

Send an end-to-end encrypted message to a BCH address. The 'subject' is not encrypted, but the message contents are. The receiver will need to have made at least one transaction with their address in order to send them a message. That way, their public key can be retrieved from the blockchain.

The command requires either the `-m` or the `-j` flag. `-m` is used to send a simple message from the command line. The `-j` flag allows for large complex messages with text and data to be passed. `-j` allows you to use a JSON files in the `files/` directory as a message. It must contain a `messages` property, but can include other properties for passing data.

Optionally, you can attach JSON data to the message usin the `-d` flag. The data must exist in a file in the `files/` directory. It must be formatted at JSON with a `data` property. The value of the `data` property will be attached to the data section of the encrypted message.

##### Arguments
- `-n` - flag to specify the wallet paying for the message signal (required).
- `-a` - The BCH address of the receiver. (required)
- `-s` - An un-encrypted subject line (optional).
- `-m` - A string of text to send as a message. This will be encrypted with the receivers public key.
- `-j` - The file name in the `files/` directory containing the message.
- `-d` - The file name in the `files/` directory containing data to attach to the message (optional).


##### Example

- Send a simple one-line message:
  - `node psf-msg-wallet.js msg-nostr-send -n wallet1 -s test -m "This is an encrypted message" -a bitcoincash:qqfrps47nxdvak55h3x97dqmglcaczegusma02uhqt`

- Send a long message from a JSON file:
  - `node psf-msg-wallet.js msg-nostr-send -n wallet1 -s test -j test-msg.json -a bitcoincash:qqfrps47nxdvak55h3x97dqmglcaczegusma02uhqt`

- Send a long message including JSON data:
  - `node psf-msg-wallet.js msg-nostr-send -n wallet1 -s test -j test-msg.json -d data.json -a bitcoincash:qqfrps47nxdvak55h3x97dqmglcaczegusma02uhqt`

-----

#### Convert a Text File to JSON

This command is useful command for sending large encrypted messages. Put your long message into a text file in the `files/` directory, and this command will parse it into a JSON object. You can then add any extra data to the JSON object that you'd like to have included with the message.

##### Arguments
- `-f` - filename for the text file in the `files/` directory (required).

##### Example

- `node psf-msg-wallet.js txt2json -f test-file.txt`

-----

#### Read E2EE Message

Download an E2EE message from a Nostr relay, and decrypt it using the private key from your wallet.

##### Arguments

- `-n` - specify the wallet to check for messages (required).
- `-t` - The TXID of the message signal. This is provided by the `msg-check-nostr` command (required).
- `-d` - Display any JSON data attached to the message (optional).

##### Example

- Read a message:
  - `node psf-msg-wallet.js msg-nostr-read -n wallet1 -t e7537fbeebb367e09793286f636ec6a4a0b04ba556ec90691b5e0107d18cc5cb`

- Read a message with JSON data, and display that data:
  - `node psf-msg-wallet.js msg-nostr-read -n wallet1 -d -t e7537fbeebb367e09793286f636ec6a4a0b04ba556ec90691b5e0107d18cc5cb`



-----
-----

### File Commands

These commands are useful for working with the [PSFFPP](https://psffpp.com) to upload a file. A link to the file can then be included in message.

-----

#### Stage a File for Pinning

Stage a file for pinning to the [PSF IPFS network](https://psffpp.com).

##### Arguments

- `-f` - specify the absolute file path for the file to be staged (required).

##### Example

- `node psf-msg-wallet.js file-stage -f test.txt`

-----

#### Pin a Staged File

Pin a staged file to the [PSF IPFS network](https://psffpp.com).

##### Arguments

- `-n` - specify the wallet to pay for the pinning (required).
- `-c` - specify the CID of the file to be pinned (required).
- `-s` - specify the size of the file in megabytes (required) If the file is less than 1MB, use 1.
- `-f` - specify the name of the file to be pinned (required).

##### Example

- `node psf-msg-wallet.js file-pin -n wallet1 -c bafkreidsivvxjiz4c2jmhn2myckfcso6grk7yqk3iysjna4i2ed4w6mzeu -s 1 -f README.md`