# cool-grpc

Simple, stupid gRPC client for Node written in Typescript

## Get Started

```
npm i cool-grpc
```

```js
import { makeRequest } from 'cool-grpc'

makeRequest('./helloworld.proto', {
  host: '0.0.0.0:50051',
  service: 'helloworld.Greeter',
  method: 'SayHello',
  data: {
    name: 'world'
  },
  tls: {},
  beforeRequest: (req) => {},
  afterResponse: (res) => {}
})
.then(console.log)
```
