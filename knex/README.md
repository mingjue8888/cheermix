## Usage

An integrated library that wraps knex, Remember to install your database client

```
npm i -S @cheermix/knex pg
```

```typescript
import joi from "joi"
import {
  autoCommitTransaction,
  transactionMiddleware,
  transactionAuthenticate,
  Knex,
} from "@cheermix/knex"
import {
  ExpressRouter,
  validParam,
  validResponseDataAndSendIt,
  NotFoundException,
  startup,
} from "@cheermix/rest"

async function findUser(userId: number, transaction: Knex.Transaction) {
  const firstUser = await transaction<{
    id: number
    name: string
  }>("User")
    .where("id", userId)
    .select("*")
    .first()

  return firstUser
}

// Commonly used
autoCommitTransaction(async function (transaction) {
  const user = await findUser(1, transaction)
})

// Used with @cheermix/rest
const findUser: ExpressRouter = {
  method: "GET",
  path: "/users/:userId"
  middlewares: [
    validParam({
      userId: joi.number().integer().required()
    }),
    transactionMiddleware(async function (request, response, transaction) {
      const user = await findUser(request.data.param.userId, transaction)
      if (!user) {
        throw new NotFoundException()
      }

      response.data = user
    }),
    validResponseDataAndSendIt({
      id: joi.number().integer().required(),
      name: joi.string(),
    })
  ]
}

startup([findUser], {
  authenticationFindUserLogic: transactionAuthenticate((payload, transaction) =>
    findUser(Number.parseInt(payload.sub as string), transaction)
  )
})

```

## Environment

| Name            | Type   | Default Value | Is Require? | Description                  |
| --------------- | ------ | ------------- | ----------- | ---------------------------- |
| NODE_ENV        | string | development   | no          | Node environment             |
| DB_CLIENT       | string | pg            | no          | Database client              |
| DB_HOST         | string |               | yes         | Database host                |
| DB_NAME         | string |               | yes         | Database name                |
| DB_USERNAME     | string |               | yes         | Account username             |
| DB_PASSWORD     | string |               | yes         | Account password             |
| DB_POOLSIZE_MIN | number | 5             | no          | Connection pool minimum size |
| DB_POOLSIZE_MAX | number | 20            | no          | Connection pool maximum size |
