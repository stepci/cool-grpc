# cool-grpc

Simple, stupid gRPC client for Node written in Typescript

## Features

- Easy to use (inspired by `fetch` and `got`)
- Loading multiple .proto files
- Automatic message encoding/decoding
- Unary calls
- Client streaming
- Server streaming
- Hooks

## Get Started

```
npm i cool-grpc
```

```js
import { makeRequest } from 'cool-grpc'

const protos = ['./helloworld.proto']

makeRequest(protos, {
  host: '0.0.0.0:50051',
  service: 'helloworld.Greeter',
  method: 'SayHello',
  metadata: {},
  data: {
    name: 'world'
  },
  tls: {
    rootCerts: "",
    privateKey: "",
    certChain: ""
  },
  beforeRequest: (req) => {},
  afterResponse: (res) => {}
})
.then(console.log)
.catch(console.error)
```
