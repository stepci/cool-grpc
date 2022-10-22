import * as grpc from '@grpc/grpc-js'
import * as protobuf from 'protobufjs'
import { PeerCertificate } from 'tls'

export type gRPCRequest = {
  host: string
  service: string
  method: string
  data: object | object[]
  metadata?: gRPCRequestMetadata
  tls?: gRPCRequestTLS
  beforeRequest?: (req: gRPCRequest) => void
  afterResponse?: (res: gRPCResponse) => void
}

export type gRPCRequestMetadata = {
  [key: string]: string | Buffer
}

export type gRPCRequestTLS = {
  rootCerts?: string
  privateKey?: string
  certChain?: string
  verifyOptions?: VerifyOptions
}

export type VerifyOptions = {
  checkServerIdentity?: CheckServerIdentityCallback
}

export type CheckServerIdentityCallback = (
  hostname: string,
  cert: PeerCertificate
) => Error | undefined

type LookupResult = {
  requestType: string
  responseType: string
  requestStream: boolean
  responseStream: boolean
}

export type gRPCResponse = {
  data: object | object[]
  size: number
}

export async function makeRequest (proto: string | string[], { beforeRequest, afterResponse, ...clientConfig }: gRPCRequest): Promise<gRPCResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      const root = await protobuf.load(proto)
      const [packageName, serviceName] = clientConfig.service.split('.')

      const { requestType, responseType, requestStream, responseStream } = root.lookup(`${packageName}.${clientConfig.method}`) as unknown as LookupResult
      if (requestStream && responseStream) return reject(new Error(`cool-grpc doesn't support bidirectional streams at the moment`))

      const requestMessageType = root.lookupType(requestType)
      const responseMessageType = root.lookupType(responseType)

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

      // Unary call
      if (!requestStream && !responseStream) {
        const message = requestMessageType.create(clientConfig.data)
        const messageEncoded = Buffer.from(requestMessageType.encode(message).finish())

        client.makeUnaryRequest(`/${packageName}.${serviceName}/${clientConfig.method}`, x => x, x => x, messageEncoded, (error, message) => {
          if (error) return reject(error)
          if (message) {
            const response = {
              data: responseMessageType.decode(message).toJSON(),
              size: message.byteLength
            }

            if (afterResponse) afterResponse(response)
            return resolve(response)
          }
        })
      }

      // Client-side streaming
      if (requestStream) {
        const metadata = new grpc.Metadata()
        for (const key in clientConfig.metadata) {
          metadata.add(key, clientConfig.metadata[key])
        }

        const stream = client.makeClientStreamRequest(`/${packageName}.${serviceName}/${clientConfig.method}`, x => x as Buffer, x => x, metadata, {}, (error, message) => {
          if (error) return reject(error)
          if (message) {
            const response = {
              data: responseMessageType.decode(message).toJSON(),
              size: message.byteLength
            }

            if (afterResponse) afterResponse(response)
            return resolve(response)
          }
        })

        const data = Array.isArray(clientConfig.data) ? clientConfig.data : [clientConfig.data]
        data.map((messageData) => {
          const message = requestMessageType.create(messageData)
          const messageEncoded = Buffer.from(requestMessageType.encode(message).finish())
          stream.write(messageEncoded)
        })

        stream.end()
      }

      // Server-side streaming
      if (responseStream) {
        const message = requestMessageType.create(clientConfig.data)
        const messageEncoded = Buffer.from(requestMessageType.encode(message).finish())
        const metadata = new grpc.Metadata()
        for (const key in clientConfig.metadata) {
          metadata.add(key, clientConfig.metadata[key])
        }

        const stream = client.makeServerStreamRequest(`/${packageName}.${serviceName}/${clientConfig.method}`, x => x, x => x, messageEncoded, metadata, {})
        const messages: object[] = []
        let totalSize = 0

        stream.on('data', (message: Buffer | undefined) => {
          if (message) {
            messages.push(responseMessageType.decode(message).toJSON())
            totalSize += message.byteLength
          }
        })

        stream.on('end', () => {
          const response = {
            data: messages,
            size: totalSize
          }

          if (afterResponse) afterResponse(response)
          resolve(response)
        })

        stream.on('error', reject)
      }
    } catch (e) {
      reject(e)
    }
  })
}
