import { makeRequest } from '../src/index'

makeRequest('./tests/helloworld.proto', {
  host: 'localhost:50051',
  service: 'helloworld.Greeter',
  method: 'SayHello',
  metadata: {},
  data: {
    name: 'hello'
  },
  beforeRequest: (req) => {},
  afterResponse: (res) => {},
})
.then(console.log)
