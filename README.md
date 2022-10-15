# lady-gg

Simple, stupid gRPC client for Node written in Typescript

## Get Started

```
npm i lady-gg
```

```js
import { makeRequest } from 'lady-gg'

makeRequest('./helloworld.proto', {
  url: '0.0.0.0:50051',
  service: 'helloworld.Greeter',
  method: 'SayHello',
  data: {
    name: 'world'
  },
  options: {}
})
.then(console.log)
```
