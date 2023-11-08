import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { PeerCertificate } from 'tls'
import getCredentials from './credentials'

export type gRPCRequest = {
  host: string
  service: string
  method: string
  data: object | object[]
  metadata?: gRPCRequestMetadata
  tls?: gRPCRequestTLS
  beforeRequest?: (req: gRPCRequest) => void
  afterResponse?: (res: gRPCResponse) => void
  loaderOptions?: protoLoader.Options
  signal?: AbortSignal
  options?: grpc.CallOptions
}

export type gRPCRequestMetadata = {
  [key: string]: string | Buffer
}

export type gRPCRequestTLS = {
  rootCerts?: string | Buffer
  privateKey?: string | Buffer
  certChain?: string | Buffer
  verifyOptions?: VerifyOptions
}

export type VerifyOptions = {
  checkServerIdentity?: CheckServerIdentityCallback
}

export type CheckServerIdentityCallback = (
  hostname: string,
  cert: PeerCertificate
) => Error | undefined

export type gRPCResponse = {
  data: object | object[]
  size: number,
  statusCode: number,
  statusMessage: string,
  metadata: {
    [key: string]: (string | Buffer)[];
  }
}

const defaultLoaderOptions = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}

export async function makeRequest (proto: string | string[], { beforeRequest, afterResponse, loaderOptions = defaultLoaderOptions, options = {}, ...clientConfig }: gRPCRequest): Promise<gRPCResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      const packageDefinition = await protoLoader.load(proto, loaderOptions) as any
      const [packageName, serviceName] = clientConfig.service.split(/\.(?=[^\.]+$)/)

      const { requestSerialize, responseDeserialize, requestStream, responseStream } = packageDefinition[`${packageName}.${serviceName}`][clientConfig.method]
      if (requestStream && responseStream) return reject(new Error(`cool-grpc doesn't support bidirectional streams at the moment`))

      const credentials = getCredentials(clientConfig)
      const client = new grpc.Client(clientConfig.host, credentials)
      if (beforeRequest) beforeRequest(clientConfig)

      const metadata = new grpc.Metadata()
      for (const key in clientConfig.metadata) {
        metadata.add(key, clientConfig.metadata[key])
      }

      // Unary call
      if (!requestStream && !responseStream) {
        const messageEncoded = requestSerialize(clientConfig.data)

        const response: gRPCResponse = { data: {}, size: 0, statusCode: 0, statusMessage: '', metadata: {} }
        const res = client.makeUnaryRequest(`/${packageName}.${serviceName}/${clientConfig.method}`, x => x, x => x, messageEncoded, metadata, options, (error, message) => {
          if (error) return reject(error)
          if (message) {
            response.data = responseDeserialize(message)
            response.size = message.byteLength

            if (afterResponse) afterResponse(response)
            return resolve(response)
          }
        })

        res.on('status', status => {
          response.statusCode = status.code
          response.statusMessage = status.details
        })

        res.on('metadata', metadata => {
          response.metadata = metadata.toJSON()
        })

        clientConfig.signal?.addEventListener('abort', () => {
          res.cancel()
        })
      }

      // Client-side streaming
      if (requestStream) {
        const response: gRPCResponse = { data: {}, size: 0, statusCode: 0, statusMessage: '', metadata: {} }
        const stream = client.makeClientStreamRequest(`/${packageName}.${serviceName}/${clientConfig.method}`, x => x as Buffer, x => x, metadata, options, (error, message) => {
          if (error) return reject(error)
          if (message) {
            response.data = responseDeserialize(message),
            response.size = message.byteLength

            if (afterResponse) afterResponse(response)
            return resolve(response)
          }
        })

        const data = Array.isArray(clientConfig.data) ? clientConfig.data : [clientConfig.data]
        data.map((messageData) => {
          const messageEncoded = requestSerialize(messageData)
          stream.write(messageEncoded)
        })

        stream.on('status', status => {
          response.statusCode = status.code
          response.statusMessage = status.details
        })

        stream.on('metadata', metadata => {
          response.metadata = metadata.toJSON()
        })

        stream.end()

        clientConfig.signal?.addEventListener('abort', () => {
          stream.cancel()
        })
      }

      // Server-side streaming
      if (responseStream) {
        const messageEncoded = requestSerialize(clientConfig.data)

        const response: gRPCResponse = { data: {}, size: 0, statusCode: 0, statusMessage: '', metadata: {} }
        const stream = client.makeServerStreamRequest(`/${packageName}.${serviceName}/${clientConfig.method}`, x => x, x => x, messageEncoded, metadata, options)
        const messages: object[] = []
        let totalSize = 0

        stream.on('data', (message: Buffer | undefined) => {
          if (message) {
            messages.push(responseDeserialize(message))
            totalSize += message.byteLength
          }
        })

        stream.on('end', () => {
          response.data = messages
          response.size = totalSize

          if (afterResponse) afterResponse(response)
          resolve(response)
        })

        stream.on('error', reject)

        stream.on('status', status => {
          response.statusCode = status.code
          response.statusMessage = status.details
        })

        stream.on('metadata', metadata => {
          response.metadata = metadata.toJSON()
        })

        clientConfig.signal?.addEventListener('abort', () => {
          stream.cancel()
        })
      }
    } catch (e) {
      reject(e)
    }
  })
}
