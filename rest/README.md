![A perfectly mixed cocktail](https://github.com/mingjue8888/cheermix/blob/master/logo.jpg?raw=true)

![code style](https://img.shields.io/badge/code_style-functional-blue)
![gitter](https://img.shields.io/gitter/room/mingjue8888/cheermix)
![npm version](https://img.shields.io/npm/v/%40cheermix%2Frest)
![npm download](https://img.shields.io/npm/dw/%40cheermix%2Frest)
![npm license](https://img.shields.io/npm/l/%40cheermix%2Frest)

**CheerMix** is an integrated framework based on **Express** and other tool libraries. **CheerMix** selects tool libraries that are lighter, more robust, easier to learn and less demanding, allowing developers to focus more on their services. Code is designed to help developers build servers more quickly. **CheerMix** integrates these tools very well. It is simply an art, making your code written more declarative and functional. You can even view the code as a document, programming and writing documents are the same.

## Getting Started

It is recommended that you use the latest node version. **CheerMix** has not tested the compatibility with lower versions.

### Installation

```
npm i -S @cheermix/rest
```

### Hello World

First, you create a main.ts in the root directory, and then create a folder called routes. You can name it whatever you want. I like to put the x.route.ts and x.spec.ts files here. I also create another folder called services. I like to separate reading and writing, such as x.command.ts and x.query.ts.

```typescript
// file: routes/hello.route.ts
import joi from "joi"
import {
  ExpressRouter,
  asyncMiddleware,
  validQuery,
  validResponseDataAndSendIt,
} from "@cheermix/rest"

const helloworld: ExpressRouter = {
  method: "GET",
  path: "/helloworld",
  middlewares: [
    validQuery({
      // CheerMix integrates joi so you don't need to install it
      mustNumber: joi.number().integer(),
      name: joi.string().default("cheermix"),
    }),
    asyncMiddleware(async function (reqeust, response) {
      response.data = {
        message: `${request.data.query.name}: hello world!`,
      }
    }),
    validResponseDataAndSendIt({
      message: joi.string().required(),
    }),
  ],
}

export default [
  helloworld,
  // Another ExpressRouters
]

// file: main.ts
import "dotenv/config"
import { startup } from "@cheermix/rest"
import { flatten } from "lodash"
import helloRoutes from "./routes/hello.route"

// I'm going to put these routes into another array,
// so routers is a two-dimensional array,
// so we're going to use lodash's flatten to flatten it.
const routers = flatten([
  helloRoutes,
  // Another Routes
])

export default startup(routers)
```

### Testing

I like to use mocha and supertest for testing, let’s add it to the project.

```
npm i -D mocha supertest @types/mocha @types/supertest ts-mocha ts-node typescript
```

Let's create a hello.spec.ts in the routes folder.

```typescript
// file: routes/hello.spec.ts
import app from "../main"
import joi from "joi"
import request from "supertest"

describe("Hello", function () {
  it("Test /helloworld", async function () {
    await request(app).get("/helloworld?mustNumber=Satoshi").expect(400)
    await request(app)
      .get("/helloworld?name=Satoshi")
      .expect(200)
      .then(function (response) {
        joi.assert(response.body.message, joi.string().required())
      })
  })
})
```

### Jwt Authentication

Now we need to set login restrictions for /helloworld. You need to place the token in the Authorization header of the request, such as: Authorization: Bearer \<token>.

```typescript
// file: routes/hello.route.ts
import {
  ExpressRouter,
  asyncMiddleware,
  validQuery,
  validResponseDataAndSendIt,
  hasAuthorization, // 1.import this middleware
} from "@cheermix/rest"

const helloworld: ExpressRouter = {
  method: "GET",
  path: "/helloworld",
  middlewares: [
    hasAuthorization, // 2.using it
    validQuery({
      mustNumber: joi.number().integer(),
      name: joi.string().default("cheermix"),
    }),
    asyncMiddleware(async function (reqeust, response) {
      // 5.Get the user info
      request.user?.name
      response.data = {
        message: `${request.data.query.name}: hello world!`,
      }
    }),
    validResponseDataAndSendIt({
      message: joi.string().required(),
    }),
  ],
}

// file: main.ts
// 4.You can override the user type in ExpressRequest
//   so that you have corresponding field prompts in the IDE
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        name: string
        roles: string[]
      }
    }
  }
}

export default startup(routers, {
  // 3.Implement the logic of findUser
  async authenticationFindUserLogic(payload) {
    const userId = payload.sub as string
    // Fetch DB or write it in services/user.query.ts ...
    return {
      userId,
      name: "Satoshi",
      roles: ["admin"],
    }
  },
})
```

Well done, you've learned.

## Exception Handling

**CheerMix** has common exception types and unified exception handling, which look like this:

```typescript
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
```

When you throw these exceptions in any RequestHandler wrapped by asyncMiddleware, **CheerMix** will handle the corresponding response code, and you will also receive exception information in the response body. Usually, I will throw exceptions in the service. It can be said that all the Middleware provided by **CheerMix** has been wrapped.

```typescript
// file: routes/hello.route.ts
import {
  ExpressRouter,
  asyncMiddleware,
  validQuery,
  validResponseDataAndSendIt,
  NotFoundException, // 1.import exception type
} from "@cheermix/rest"
// import ...
// const helloworld: ExpressRouter ...

// Let's add another ExpressRouter
const findSomething: ExpressRouter = {
  method: "GET",
  path: "/something/:somethingId",
  middlewares: [
    validParam({
      somethingId: joi.number().integer().greater(1).required(),
    }),
    asyncMiddleware(async function (reqeust, response) {
      throw new NotFoundException("something doesn't exist") // 2.using it
    }),
  ],
}

export default [helloworld, findSomething]
```

If you feel that these Exceptions are not enough, you can expand HttpServerException.

```typescript
// file: errors.ts
import { HttpServerException } from "@cheermix/rest"

export class TeapotException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 418
  }
}

// file: routes/hello.route.ts
import { TeapotException } from "../errors.ts"

const findSomething: ExpressRouter = {
  method: "GET",
  path: "/something/:somethingId",
  middlewares: [
    validParam({
      somethingId: joi.number().integer().greater(1).required(),
    }),
    asyncMiddleware(async function (reqeust, response) {
      throw new TeapotException(
        "Haha, want to crawl our data again? It's time for me to catch you."
      )
    }),
  ],
}

// Omit some codes ...
```

## Environment

**CheerMix** has some environment variables that can be used to make adjustments to the integrated tools. **CheerMix** is easy to configure. I like to use **dotenv** to scan my .env file and load variables into the node process. You can also put these variables in vscode's launch.json or pm2's ecosystem.config.js. **Dotenv** is not directly integrated here and is up to you.

| Name                                 | Type                                             | Default Value           | Description                                                                          |
| ------------------------------------ | ------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------ |
| LOGGER_LEVEL                         | "error"<br>"warn"<br>"info"<br>"http"<br>"debug" | "debug"                 | Log printing level                                                                   |
| LOGGER_COLORIZE                      | boolean                                          | true                    | Log coloring                                                                         |
| LOGGER_TEXT_ALIGN                    | boolean                                          | true                    | Log text format adaptive                                                             |
| LOGGER_TIME_FORMAT                   | string                                           | YYYY-MM-DD HH:mm:ss.SSS | Log time format                                                                      |
| NODE_TIMEZONE                        | string                                           | Asia/Hong_Kong          | Dayjs timezone                                                                       |
| NODE_PORT                            | integer                                          | 80                      | Server port                                                                          |
| NODE_ENV                             | string                                           | development             | Runtime environment                                                                  |
| EXPRESS_REQUEST<br>\_LIMIT_TIMEFRAME | millisecond                                      | 1000                    | Limit the time range of requests for the same IP for a certain period of time        |
| EXPRESS_REQUEST<br>\_LIMIT_MAX       | integer                                          | 20                      | Limit the maximum number of requests for the same IP within a certain period of time |
| JWT_SECRET                           | string                                           | hello world!            | Jwt Secret                                                                           |
| JWT_EXPIRES                          | millisecond                                      | 48 hours                | Jwt expiration time                                                                  |
| JWT_REFRESH_TIME                     | millisecond                                      | 1 hour                  | Jwt refresh time                                                                     |

## API Reference

### interface ExpressRouter

Convenient for you to write the route of type

| Field       | Type                        | Description        |
| ----------- | --------------------------- | ------------------ |
| method      | "GET","POST","PUT","DELETE" | Http method        |
| path        | string                      | Uri                |
| middlewares | Middleware                  | Express Middleware |

### interface StartupOptions

Startup Options

| Field                        | Type                                       | Description                          |
| ---------------------------- | ------------------------------------------ | ------------------------------------ |
| authenticationFindUserLogic? | (payload: JwtPayload) => Promise\<unknown> | Specify your findUser implementation |
| middlewaresExtension?        | Middleware[]                               | You can also expand other Middleware |

### interface Page

page type

| Field    | Type    | Description              |
| -------- | ------- | ------------------------ |
| page     | number  | Page number              |
| pageSize | number  | Page size                |
| sortBy?  | string  | Sort field               |
| isDesc?  | boolean | Whether in reverse order |

### const hasAuthorization: Middleware

Verify whether your request header contains hasAuthorization

### const file: multer.Multer

File upload and download tool, see [Multer](https://www.npmjs.com/package/multer) for specific usage.

### function asyncMiddleware(asyncHandler): Middleware

A wrapper for the async RequestHandler which will then catch the Exception

| Parameter    | Type                                                     | Description         |
| ------------ | -------------------------------------------------------- | ------------------- |
| asyncHandler | (reqeust: Request, response: Response) => Promise\<void> | Your RequestHandler |

### function validParam(joiSchema): Middleware

Verify the variables on the path and automatically convert the type and set the default value. The data can be found in request.data.param

| Parameter | Type                          | Description |
| --------- | ----------------------------- | ----------- |
| joiSchema | Record<string, joi.AnySchema> | Joi schema  |

### function validQuery(joiSchema): Middleware

Verify the parameters after "?" in the path and automatically convert the type and set the default value. You can find the data in request.data.query

| Parameter | Type                          | Description |
| --------- | ----------------------------- | ----------- |
| joiSchema | Record<string, joi.AnySchema> | Joi schema  |

### function validBody(joiSchema): Middleware

Verify the json in the request body and automatically convert the type and set the default value. The data can be found in request.data.body

| Parameter | Type                          | Description |
| --------- | ----------------------------- | ----------- |
| joiSchema | Record<string, joi.AnySchema> | Joi schema  |

### function validPage(inWhere): Middleware

Verify the data about the page in the request and automatically convert the type and set the default value. You can find the data in request.data.page

| Parameter | Type       | Description                        |
| --------- | ---------- | ---------------------------------- |
| inWhere   | query,body | Tell cheermix where your page data |

### function validResponseDataAndSendIt(joiSchema): Middleware

Verify the data in response.data and respond

| Parameter | Type                          | Description |
| --------- | ----------------------------- | ----------- |
| joiSchema | Record<string, joi.AnySchema> | Joi schema  |

### function signPassword(password): string

Bcrypt encryption

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| password  | string |             |

### function validPassword(password, saltyPassword): boolean

Verify password

| Parameter     | Type   | Description                   |
| ------------- | ------ | ----------------------------- |
| password      | string | Password before encryption    |
| saltyPassword | string | Encrypt the salted ciphertext |

### function signJwt(subject, refreshToken?): { accessToken: string; refreshToken: string }

Sign Json web token

| Parameter     | Type   | Description                                                                                             |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| subject       | string | Usually put the user ID                                                                                 |
| refreshToken? | string | Before the JWT_EXPIRES setting expires, you can get a new access token by passing in the Refresh token. |
