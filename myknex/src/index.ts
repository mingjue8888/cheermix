import knex from "knex"
import logger from "@cheermix/mywinston"
import { Knex } from "knex"
import {
  DB_CLIENT,
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_POOLSIZE_MAX,
  DB_POOLSIZE_MIN,
  DB_USERNAME,
  NODE_ENV,
} from "./environment"
import delay from "delay"
import { Handler, Request, RequestHandler, Response } from "express"

export function buildKnex(host: string, database: string, user: string, password: string) {
  return knex({
    client: DB_CLIENT,
    connection: {
      host,
      user,
      password,
      database,
      charset: "utf8",
    },
    pool: {
      max: DB_POOLSIZE_MAX,
      min: DB_POOLSIZE_MIN,
      idleTimeoutMillis: 10000,
      acquireTimeoutMillis: 30000,
    },
    debug: NODE_ENV == "development",
    log: {
      debug: logger.debug,
      error: logger.error,
    },
  })
}

const defaultKnex = buildKnex(DB_HOST, DB_NAME, DB_USERNAME, DB_PASSWORD)

export default defaultKnex

export async function getTransaction(retry: number = 0): Promise<Knex.Transaction> {
  try {
    if (retry >= 5) {
      throw new Error("Get knex transaction fail")
    }
    return defaultKnex.transaction()
  } catch (error) {
    await delay(2000)
    return getTransaction(retry + 1)
  }
}

export async function autoCommitTransaction(
  asyncFunction: (transaction: Knex.Transaction) => Promise<void>
) {
  const transaction = await getTransaction()
  try {
    await asyncFunction(transaction)
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

type Middleware = RequestHandler | Handler

function _asyncMiddlewareCopy(
  asyncHandler: (reqeust: Request, response: Response) => Promise<void>
): Middleware {
  return function (reqeust, response, next) {
    asyncHandler(reqeust, response)
      .then(() => next())
      .catch(error => next(error))
  }
}

export function transactionMiddleware(
  transactionHandler: (
    reqeust: Request,
    response: Response,
    transaction: Knex.Transaction
  ) => Promise<void>
): Middleware {
  return _asyncMiddlewareCopy(async function (request, response) {
    await autoCommitTransaction(async function (transaction) {
      await transactionHandler(request, response, transaction)
    })
  })
}
