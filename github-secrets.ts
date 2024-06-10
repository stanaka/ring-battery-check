import "dotenv/config";
import * as Octokit from "@octokit/request";
import libsodium from 'libsodium-wrappers';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// const octokit = new Octokit({
//   auth: GITHUB_TOKEN
// });

const octokitRequestWithAuth = Octokit.request.defaults({
    headers: {
        authorization: "token " + GITHUB_TOKEN
    }
})

interface PublicKeyResponse {
  key_id: string;
  key: string;
}

async function getPublicKey(repository: string): Promise<PublicKeyResponse> {
    const owner = repository.split('/')[0]
    const repo = repository.split('/')[1]
    const response = await octokitRequestWithAuth('GET /repos/{owner}/{repo}/actions/secrets/public-key', {
        owner,
        repo
    });
    return response.data;
}

async function encryptSecret(publicKey: string, secretValue: string): Promise<string> {
    await libsodium.ready

    // Convert the message and key to Uint8Array's (Buffer implements that interface)
    const messageBytes = Buffer.from(secretValue);
    const keyBytes = Buffer.from(publicKey, 'base64');
    
    // Encrypt using LibSodium.
    const encryptedBytes = libsodium.crypto_box_seal(messageBytes, keyBytes)
    
    // Base64 the encrypted secret
    return Buffer.from(encryptedBytes).toString('base64');
}

export const updateSecret = async (repository: string, secretName: string, secretValue: string) => {
    //try {
        const publicKey = await getPublicKey(repository);
        const key = publicKey.key;
        const key_id = publicKey.key_id;

        const encryptedValue = await encryptSecret(key, secretValue);

        const owner = repository.split('/')[0]
        const repo = repository.split('/')[1]

        await octokitRequestWithAuth('PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}', {
            owner,
            repo,
            secret_name: secretName,
            encrypted_value: encryptedValue,
            key_id: key_id
        });

        console.log(`Secret ${secretName} updated successfully.`);
    //} catch (error) {
    //    console.error(`Error updating secret: ${error}`);
    //}
}

