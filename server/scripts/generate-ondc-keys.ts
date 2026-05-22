import sodium from "libsodium-wrappers";

async function generateKeys() {
  await sodium.ready;
  const keypair = sodium.crypto_sign_keypair();
  
  const publicKey = sodium.to_base64(keypair.publicKey, sodium.base64_variants.ORIGINAL);
  const privateKey = sodium.to_base64(keypair.privateKey, sodium.base64_variants.ORIGINAL);

  console.log("\n--- ONDC Ed25519 Keys Generated Successfully ---\n");
  console.log("PUBLIC KEY (Paste this into the ONDC Portal):");
  console.log(publicKey);
  console.log("\nPRIVATE KEY (Save this in your .env file as ONDC_SIGNING_PRIVATE_KEY):");
  console.log(privateKey);
  console.log("\n------------------------------------------------\n");
}

generateKeys().catch(console.error);
