import { makeRequest } from '../src'

makeRequest('./tests/route_guide.proto', {
  host: 'localhost:50051',
  service: 'routeguide.RouteGuide',
  method: 'ListFeatures',
  metadata: {},
  data: {
    lo: {
      latitude: 407838351,
      longitude: -746143763
    },
    hi: {
      latitude: 410248224,
      longitude: -747127767
    }
  },
  beforeRequest: (req) => {},
  afterResponse: (res) => {}
})
.then(console.log)
