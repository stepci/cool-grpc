import * as grpc from '@grpc/grpc-js'
import * as protobuf from 'protobufjs'
import { PeerCertificate } from 'tls'

type ClientConfig = {
  host: string
  service: string
  method: string
  data: object
  tls?: ClientConfigTLS
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

export async function makeRequest (proto: string, { host, service, method, data, tls }: ClientConfig): Promise<gRPCResponse> {
  return new Promise(async (resolve, reject) => {
    const root = await protobuf.load(proto)
    const [packageName, serviceName] = service.split('.')

    const { requestType, responseType } = root.lookup(`${packageName}.${method}`) as unknown as LookupResult
    const requestMessageType = root.lookupType(requestType)
    const responseMessageType = root.lookupType(responseType)

    const verifyError = requestMessageType.verify(data)
    if (verifyError) return reject(Error(verifyError))

    const message = requestMessageType.create(data)
    const messageEncoded = requestMessageType.encode(message).finish()

    let credentials
    if (!tls) {
      credentials = grpc.credentials.createInsecure()
    } else {
      credentials = grpc.credentials.createSsl(
        tls.rootCerts ? Buffer.from(tls.rootCerts) : undefined,
        tls.privateKey ? Buffer.from(tls.privateKey) : undefined,
        tls.certChain ? Buffer.from(tls.certChain) : undefined,
        tls.verifyOptions
      )
    }

    const client = new grpc.Client(host, credentials)
    client.makeUnaryRequest(`/${packageName}.${serviceName}/${method}`, x => x, x => x, Buffer.from(messageEncoded), (error, message) => {
      if (error) return reject(error)
      if (message) return resolve({
        message: responseMessageType.decode(message).toJSON(),
        size: message.byteLength
      })
    })
  })
}
