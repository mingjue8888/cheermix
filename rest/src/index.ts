import express from "express"
import {
  Handler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
  json,
  urlencoded,
} from "express"
import joi from "joi"
import { ValidationError } from "joi"
import { JwtPayload, sign, verify } from "jsonwebtoken"
import multer from "multer"
import { MulterError } from "multer"
import { ExtractJwt, Strategy, StrategyOptions } from "passport-jwt"
import passport from "passport"
import rateLimit from "express-rate-limit"
import morgan from "morgan"
import cors from "cors"
import compression from "compression"
import logger from "@cheermix/logger"
import { getUnixTimestamp } from "@cheermix/timeutil"
import { compareSync, genSaltSync, hashSync } from "bcrypt"

interface ProcessEnvironment {
  NODE_PORT: number

  EXPRESS_REQUEST_LIMIT_TIMEFRAME: number
  EXPRESS_REQUEST_LIMIT_MAX: number

  JWT_SECRET: string
  JWT_EXPIRES: number
  JWT_REFRESH_TIME: number
}

export const {
  NODE_PORT,

  EXPRESS_REQUEST_LIMIT_TIMEFRAME,
  EXPRESS_REQUEST_LIMIT_MAX,

  JWT_SECRET,
  JWT_EXPIRES,
  JWT_REFRESH_TIME,
} = joi.attempt<joi.ObjectSchema<ProcessEnvironment>>(
  process.env,
  joi.object({
    NODE_PORT: joi.number().integer().default(80),

    EXPRESS_REQUEST_LIMIT_TIMEFRAME: joi.number().integer().default(1000),
    EXPRESS_REQUEST_LIMIT_MAX: joi.number().integer().default(20),

    JWT_SECRET: joi.string().default("hello world!"),
    JWT_EXPIRES: joi
      .number()
      .integer()
      .default(1000 * 60 * 60 * 48),
    JWT_REFRESH_TIME: joi
      .number()
      .integer()
      .default(1000 * 60 * 60),
  }),
  {
    allowUnknown: true,
  }
)

type ResponseJoiData = unknown
type RequestJoiData = {
  param: any
  query: any
  body: any
}

declare global {
  namespace Express {
    interface Request {
      data: RequestJoiData
    }
    interface Response {
      data: ResponseJoiData
    }
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE"
export type Middleware = RequestHandler | Handler

export interface ExpressRouter {
  method: HttpMethod
  path: string
  middlewares: Middleware[]
}

export abstract class HttpServerException extends Error {
  abstract getHttpResponseStatusCode(): number
}

export class WrongParameterException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 400
  }
}

export class NotFoundException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 404
  }
}

export class UnauthorizedException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 401
  }
}

export class NoPermissionException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 403
  }
}

export class ServerErrorException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 500
  }
}

export function asyncMiddleware(
  asyncHandler: (reqeust: Request, response: Response) => Promise<void>
): Middleware {
  return function (reqeust, response, next) {
    asyncHandler(reqeust, response)
      .then(() => next())
      .catch(error => next(error))
  }
}

export function validParam(joiSchema: Record<string, joi.AnySchema>): Middleware {
  return asyncMiddleware(async function (reqeust) {
    reqeust.data.param = joi.attempt(reqeust.params, joi.object(joiSchema), {
      allowUnknown: true,
    })
  })
}

export function validQuery(joiSchema: Record<string, joi.AnySchema>): Middleware {
  return asyncMiddleware(async function (reqeust) {
    reqeust.data.query = joi.attempt(reqeust.query, joi.object(joiSchema), {
      allowUnknown: true,
    })
  })
}

export function validBody(joiSchema: Record<string, joi.AnySchema>): Middleware {
  return asyncMiddleware(async function (reqeust) {
    reqeust.data.body = joi.attempt(reqeust.body, joi.object(joiSchema), {
      allowUnknown: true,
    })
  })
}

function dataInitialize(reqeust: Request, _response: Response, next: NextFunction) {
  Reflect.set(reqeust, "data", {})
  next()
}

export function validResponseDataAndSendIt(joiSchema: Record<string, joi.AnySchema>): Middleware {
  return asyncMiddleware(async function (_request, response) {
    try {
      response.data = joi.attempt(response.data, joi.object(joiSchema))
    } catch (error) {
      throw new ServerErrorException(`response validation error: ${error.message}`)
    }
    response.send(response.data)
  })
}

function wrongParameterExceptionTransaform(
  error: Error,
  _reqeust: Request,
  _response: Response,
  next: NextFunction
) {
  if (error instanceof ValidationError) {
    next(new WrongParameterException("Validtion Error:" + JSON.stringify(error.details)))
  } else if (error instanceof MulterError) {
    next(new WrongParameterException(error.message))
  } else {
    next(error)
  }
}

function errorHandler(error: Error, _reqeust: Request, response: Response, next: NextFunction) {
  if (error instanceof HttpServerException) {
    response.status(error.getHttpResponseStatusCode()).send({ message: error.message })
  } else {
    response.status(500).send({
      message: `Server error: ${error.message}, please make contact with backend developer!`,
    })
  }
  next(error)
}

function printError(error: Error, _reqeust: Request, _response: Response, next: NextFunction) {
  logger.error(error.stack)
  next(error)
}

export const hasAuthorization: Middleware = passport.authenticate("jwt", { session: false })

interface StartupOptions {
  middlewaresExtension?: Middleware[]
  authenticationFindUserLogic?: (payload: JwtPayload) => Promise<unknown>
  exceptionTransaform?: (error: Error, next: NextFunction) => void
}

export function startup(routers: ExpressRouter[], options?: StartupOptions) {
  if (options?.authenticationFindUserLogic) {
    const jwtStrategyOptions: StrategyOptions = {
      secretOrKey: JWT_SECRET,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    }

    const strategy = new Strategy(jwtStrategyOptions, function (payload, next) {
      if (options?.authenticationFindUserLogic) {
        options
          .authenticationFindUserLogic(payload)
          .then(user => user || Promise.reject(new NotFoundException("User does not exist")))
          .then(user => next(null, user))
          .catch(err => next(err, false))
      }
    })

    passport.use(strategy)
  }

  const router = routers.reduce(
    (router, er) =>
      Reflect.get(router, er.method.toLowerCase()).bind(router)(er.path, ...er.middlewares),
    Router()
  )

  const requestLogger = morgan(":method :url :status :res[content-length] - :response-time ms", {
    stream: {
      write: message => logger.http(message),
    },
  })

  const beforeRoutersApp = express()
    .use(rateLimit({ windowMs: EXPRESS_REQUEST_LIMIT_TIMEFRAME, max: EXPRESS_REQUEST_LIMIT_MAX }))
    .use(requestLogger)
    .use(cors({ optionsSuccessStatus: 200 }))
    .use(compression())
    .use(urlencoded({ extended: true }))
    .use(json())
    .use(passport.initialize())
    .use(dataInitialize)

  if (options?.middlewaresExtension) {
    options?.middlewaresExtension.forEach(middleware => beforeRoutersApp.use(middleware))
  }

  const passRoutersApp = beforeRoutersApp.use(router)

  if (options?.exceptionTransaform) {
    passRoutersApp.use(function (
      error: Error,
      _request: Request,
      _response: Response,
      next: NextFunction
    ) {
      if (options?.exceptionTransaform) {
        options?.exceptionTransaform(error, next)
      } else {
        next(error)
      }
    })
  }

  const app = passRoutersApp
    .use(wrongParameterExceptionTransaform)
    .use(errorHandler)
    .use(printError)
    .listen(NODE_PORT, () => logger.info(`Server is running on port ${NODE_PORT}`))

  return app
}

export const file = multer()

export function signJwt(subject: string, refreshToken?: string) {
  const now = getUnixTimestamp(0)
  const accessTokenPayload = {
    sub: subject,
    exp: getUnixTimestamp(JWT_REFRESH_TIME),
    iat: now,
  }

  if (refreshToken) {
    const refreshTokenPayload = verify(refreshToken, JWT_SECRET) as JwtPayload
    if (refreshTokenPayload.sub !== subject) {
      throw new WrongParameterException("Not the same user")
    }
    if (!refreshTokenPayload.exp) {
      throw new WrongParameterException("Wrong refresh token")
    }
    if (refreshTokenPayload.exp < now) {
      throw new WrongParameterException("Refresh token be overdue")
    }

    return {
      accessToken: sign(accessTokenPayload, JWT_SECRET),
      refreshToken,
    }
  }

  const refreshTokenPayload = {
    sub: subject,
    exp: getUnixTimestamp(JWT_EXPIRES),
    iat: now,
  }

  return {
    accessToken: sign(accessTokenPayload, JWT_SECRET),
    refreshToken: sign(refreshTokenPayload, JWT_SECRET),
  }
}

export function signPassword(password: string) {
  return hashSync(password, genSaltSync())
}

export function validPassword(password: string, saltyPassword: string) {
  return compareSync(password, saltyPassword)
}
