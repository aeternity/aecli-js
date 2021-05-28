/*
 * ISC License (ISC)
 * Copyright (c) 2018 aeternity developers
 *
 *  Permission to use, copy, modify, and/or distribute this software for any
 *  purpose with or without fee is hereby granted, provided that the above
 *  copyright notice and this permission notice appear in all copies.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 *  REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 *  AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 *  INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 *  LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 *  OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 *  PERFORMANCE OF THIS SOFTWARE.
 */

import { Command } from 'commander'
import { TxBuilder } from '@aeternity/aepp-sdk'
import { HASH_TYPES, NODE_URL, NODE_INTERNAL_URL } from './utils/constant'
import { initChain } from './utils/cli'
import {
  print, printBlock, printBlockTransactions,
  printName, printOracle, printQueries,
  printTransaction, printUnderscored,
} from './utils/print'
import { getBlock, updateNameStatus, validateName } from './utils/helpers'

export default new Command('inspect')
  .arguments('<identifier>')
  .description('Get information about an entity by its identifier')
  .on('--help', () => console.log([
    '',
    'You can use this command to get info about account, block, transaction or name.',
    '',
    'Examples:',
    '  `aecli inspect testName.test` --> get info about AENS `name`',
    '  `aecli inspect ak_134defawsgf34gfq4f` --> get info about `account`',
    '  `aecli inspect kh_134defawsgf34gfq4f` --> get info about `key block` by block `hash`',
    '  `aecli inspect mh_134defawsgf34gfq4f` --> get info about `micro block` by block `hash`',
    '  `aecli inspect 1234` --> get info about `block` by block `height`',
    '  `aecli inspect th_asfwegfj34234t34t` --> get info about `transaction` by transaction `hash`',
  ].join('\n')))
  .option('-u --url [hostname]', 'Node to connect to', NODE_URL)
  .option('--internalUrl [internal]', 'Node to connect to (internal)', NODE_INTERNAL_URL)
  .option('-f --force', 'Ignore node version compatibility check')
  .option('--json', 'Print result in json format')
  .action(async (identifier, { json, ...options }) => {
    const pref = identifier.split('_')[0]

    if (pref === HASH_TYPES.rawTransaction) {
      checkPref(identifier, HASH_TYPES.rawTransaction)
      const { tx, txType: type } = TxBuilder.unpackTx(identifier)
      if (json) print({ tx: tx, type })
      else {
        printUnderscored('Tx Type', type)
        Object.entries(tx).forEach(entry => printUnderscored(...entry))
      }
      return
    }

    const client = await initChain(options)

    if (+identifier) {
      printBlock(await client.api.getKeyBlockByHeight(+identifier), json)
      return
    }

    switch (pref) {
      case HASH_TYPES.block:
      case HASH_TYPES.micro_block:
        printBlock(await getBlock(identifier)(client), json)
        break
      case HASH_TYPES.account:
        const { nonce } = await client.api.getAccountByPubkey(identifier)
        const balance = await client.balance(identifier)
        const transactions = (await client.api.getPendingAccountTransactionsByPubkey(identifier)).transactions
        if (json) {
          print({ identifier, balance, nonce, transactions })
        } else {
          printUnderscored('Account ID', identifier)
          printUnderscored('Account balance', balance)
          printUnderscored('Account nonce', nonce)
          print('Account Transactions: ')
          printBlockTransactions(transactions)
        }
        break
      case HASH_TYPES.transaction:
        printTransaction(await client.tx(identifier), json)
        break
      case HASH_TYPES.contract:
        printTransaction(await client.api.getContract(identifier), json)
        break
      case HASH_TYPES.oracle:
        printOracle(await client.getOracle(identifier), json)
        const { oracleQueries } = await client.getOracleQueries(identifier)
        if (oracleQueries) printQueries(oracleQueries, json)
        break
      default:
        validateName(identifier)
        printName(await updateNameStatus(identifier)(client), json)
        break
    }
  })
