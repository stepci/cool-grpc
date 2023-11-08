import { gRPCRequest } from '.'

import * as grpc from '@grpc/grpc-js'

export default function getCredentials (clientConfig: gRPCRequest) {
  let credentials
  if (clientConfig.tls && Object.keys(clientConfig.tls).length !== 0) {
    credentials = grpc.credentials.createSsl(
      clientConfig.tls.rootCerts
        ? Buffer.isBuffer(clientConfig.tls.rootCerts)
          ? clientConfig.tls.rootCerts
          : Buffer.from(clientConfig.tls.rootCerts)
        : undefined,
      clientConfig.tls.privateKey
        ? Buffer.isBuffer(clientConfig.tls.privateKey)
          ? clientConfig.tls.privateKey
          : Buffer.from(clientConfig.tls.privateKey)
        : undefined,
      clientConfig.tls.certChain
        ? Buffer.isBuffer(clientConfig.tls.certChain)
          ? clientConfig.tls.certChain
          : Buffer.from(clientConfig.tls.certChain)
        : undefined,
      clientConfig.tls.verifyOptions
    )
  } else {
    credentials = grpc.credentials.createInsecure()
  }

  return credentials
}
