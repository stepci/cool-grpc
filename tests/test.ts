import { makeRequest } from '../src'

makeRequest('./helloworld.proto', {
  host: '0.0.0.0:50051',
  service: 'helloworld.Greeter',
  method: 'SayHello',
  data: {
    name: 'world'
  },
  tls: {}
})
.then(console.log)
