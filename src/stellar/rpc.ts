import {
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  xdr,
  scValToNative,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { config } from "../config";

const server = new SorobanRpc.Server(config.rpcUrl, { allowHttp: false });

export async function getAdminAccount() {
  const keypair = Keypair.fromSecret(config.adminSecretKey);
  return server.getAccount(keypair.publicKey());
}

export async function callContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<xdr.ScVal> {
  const keypair = Keypair.fromSecret(config.adminSecretKey);
  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: "1000",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(keypair);

  const result = await server.sendTransaction(prepared);
  if (result.status === "ERROR") {
    throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`);
  }

  // Poll for completion
  let getResult = await server.getTransaction(result.hash);
  for (let i = 0; i < 10 && getResult.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    getResult = await server.getTransaction(result.hash);
  }

  if (getResult.status !== "SUCCESS") {
    throw new Error(`Transaction not successful: ${getResult.status}`);
  }

  return (getResult as SorobanRpc.Api.GetSuccessfulTransactionResponse)
    .returnValue ?? xdr.ScVal.scvVoid();
}

export async function getEvents(
  contractIds: string[],
  startLedger: number
): Promise<SorobanRpc.Api.EventResponse[]> {
  const response = await server.getEvents({
    startLedger,
    filters: [{ type: "contract", contractIds }],
  });
  return response.events;
}

export async function getLatestLedger(): Promise<number> {
  const info = await server.getLatestLedger();
  return info.sequence;
}

export { scValToNative, nativeToScVal };
