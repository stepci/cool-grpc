import { makeRequest } from '../src'

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
