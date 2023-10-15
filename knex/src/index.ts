import knex from "knex"
import logger from "@cheermix/logger"
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
import { JwtPayload } from "jsonwebtoken"

export { Knex }

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

export async function autoCommitTransaction<T>(
  asyncFunction: (transaction: Knex.Transaction) => Promise<T>
) {
  const transaction = await getTransaction()
  try {
    const result = await asyncFunction(transaction)
    await transaction.commit()
    return result
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

export function transactionMiddleware(
  transactionHandler: (
    reqeust: Request,
    response: Response,
    transaction: Knex.Transaction
  ) => Promise<void>
): RequestHandler | Handler {
  return function (reqeust, response, next) {
    autoCommitTransaction(async function (transaction) {
      await transactionHandler(reqeust, response, transaction)
    })
      .then(() => next())
      .catch(error => next(error))
  }
}

export function transactionAuthenticate(
  findUser: (payload: JwtPayload, transaction: Knex.Transaction) => Promise<unknown>
) {
  return function (payload: JwtPayload): Promise<unknown> {
    return autoCommitTransaction(async function (transaction) {
      return findUser(payload, transaction)
    })
  }
}
