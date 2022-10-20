import * as grpc from '@grpc/grpc-js'
import * as protobuf from 'protobufjs'
import { PeerCertificate } from 'tls'

type ClientConfig = {
  host: string
  service: string
  method: string
  data: object
  tls?: ClientConfigTLS
  beforeRequest?: (req: ClientConfig) => void
  afterResponse?: (res: gRPCResponse) => void
}

type ClientConfigTLS = {
  rootCerts?: string
  privateKey?: string
  certChain?: string
  verifyOptions?: VerifyOptions
}

type VerifyOptions = {
  checkServerIdentity?: CheckServerIdentityCallback
}

type CheckServerIdentityCallback = (
  hostname: string,
  cert: PeerCertificate
) => Error | undefined

type LookupResult = {
  requestType: string
  responseType: string
}

export type gRPCResponse = {
  message: object
  size: number
}

export async function makeRequest (proto: string, { beforeRequest, afterResponse, ...clientConfig }: ClientConfig): Promise<gRPCResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      const root = await protobuf.load(proto)
      const [packageName, serviceName] = clientConfig.service.split('.')

      const { requestType, responseType } = root.lookup(`${packageName}.${clientConfig.method}`) as unknown as LookupResult
      const requestMessageType = root.lookupType(requestType)
      const responseMessageType = root.lookupType(responseType)

      const verifyError = requestMessageType.verify(clientConfig.data)
      if (verifyError) return reject(Error(verifyError))

      const message = requestMessageType.create(clientConfig.data)
      const messageEncoded = requestMessageType.encode(message).finish()

      let credentials
      if (!clientConfig.tls) {
        credentials = grpc.credentials.createInsecure()
      } else {
        credentials = grpc.credentials.createSsl(
          clientConfig.tls.rootCerts ? Buffer.from(clientConfig.tls.rootCerts) : undefined,
          clientConfig.tls.privateKey ? Buffer.from(clientConfig.tls.privateKey) : undefined,
          clientConfig.tls.certChain ? Buffer.from(clientConfig.tls.certChain) : undefined,
          clientConfig.tls.verifyOptions
        )
      }

      const client = new grpc.Client(clientConfig.host, credentials)
      if (beforeRequest) beforeRequest(clientConfig)

      client.makeUnaryRequest(`/${packageName}.${serviceName}/${clientConfig.method}`, x => x, x => x, Buffer.from(messageEncoded), (error, message) => {
        if (error) return reject(error)
        if (message) {
          const response = {
            message: responseMessageType.decode(message).toJSON(),
            size: message.byteLength
          }

          if (afterResponse) afterResponse(response)
          return resolve(response)
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}
