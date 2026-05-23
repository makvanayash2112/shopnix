// import sodium from "libsodium-wrappers";
// import crypto from "crypto";
// import { env } from "../config/env";
// import { fetchPublicKey } from "./ondc-registry";

// function createDigest(body: string) {

//   const hash = crypto
//     .createHash("sha256")
//     .update(body)
//     .digest("base64");

//   return `SHA-256=${hash}`;
// }

// export async function createAuthorizationHeader(
//   payload: Record<string, unknown>
// ): Promise<string> {

//   await sodium.ready;

//   const created =
//     Math.floor(Date.now() / 1000);

//   const expires =
//     created + 300;

//   const body =
//     JSON.stringify(payload);

//   const digest =
//     createDigest(body);

//   const signingString =
//     `(created): ${created}\n` +
//     `(expires): ${expires}\n` +
//     `digest: ${digest}`;

//   try {

//     const privateKey =
//       sodium.from_base64(
//         env.ondc.signingPrivateKey,
//         sodium.base64_variants.ORIGINAL
//       );

//     const signatureBytes =
//       sodium.crypto_sign_detached(
//         signingString,
//         privateKey
//       );

//     const signature =
//       sodium.to_base64(
//         signatureBytes,
//         sodium.base64_variants.ORIGINAL
//       );

//     const keyId =
//       `${env.ondc.subscriberId}` +
//       `|${env.ondc.uniqueKeyId}` +
//       `|ed25519`;

//     return (
//       `Signature ` +
//       `keyId="${keyId}",` +
//       `algorithm="ed25519",` +
//       `created="${created}",` +
//       `expires="${expires}",` +
//       `headers="(created) (expires) digest",` +
//       `signature="${signature}"`
//     );

//   } catch (err) {

//     console.error(
//       "[ondc] Signature creation failed",
//       err
//     );

//     return "";
//   }
// }

// export async function verifyAuthorizationHeader(
//   authHeader: string | undefined,
//   rawBody: string
// ): Promise<boolean> {

//   try {

//     await sodium.ready;

//     if (!authHeader) {

//       console.error(
//         "[ondc] Missing Authorization header"
//       );

//       return false;
//     }

//     const keyIdMatch =
//       authHeader.match(/keyId="([^"]+)"/);

//     const createdMatch =
//       authHeader.match(/created="([^"]+)"/);

//     const expiresMatch =
//       authHeader.match(/expires="([^"]+)"/);

//     const signatureMatch =
//       authHeader.match(/signature="([^"]+)"/);

//     if (
//       !keyIdMatch ||
//       !createdMatch ||
//       !expiresMatch ||
//       !signatureMatch
//     ) {

//       console.error(
//         "[ondc] Invalid auth header"
//       );

//       return false;
//     }

//     const keyId =
//       keyIdMatch[1];

//     const created =
//       createdMatch[1];

//     const expires =
//       expiresMatch[1];

//     const signature =
//       signatureMatch[1];

//     const now =
//       Math.floor(Date.now() / 1000);

//     if (now > Number(expires)) {

//       console.error(
//         "[ondc] Signature expired"
//       );

//       return false;
//     }

//     const digest =
//       createDigest(rawBody);

//     const signingString =
//       `(created): ${created}\n` +
//       `(expires): ${expires}\n` +
//       `digest: ${digest}`;

//     const subscriberId =
//       keyId.split("|")[0];

//     const publicKey =
//       await fetchPublicKey(subscriberId);

//     if (!publicKey) {

//       console.error(
//         "[ondc] Public key missing"
//       );

//       return false;
//     }

//     const publicKeyBytes =
//       sodium.from_base64(
//         publicKey,
//         sodium.base64_variants.ORIGINAL
//       );

//     const signatureBytes =
//       sodium.from_base64(
//         signature,
//         sodium.base64_variants.ORIGINAL
//       );

//     const verified =
//       sodium.crypto_sign_verify_detached(
//         signatureBytes,
//         signingString,
//         publicKeyBytes
//       );

//     if (!verified) {

//       console.error(
//         "[ondc] Signature verification failed"
//       );

//       return false;
//     }

//     console.log(
//       "[ondc] Signature verified"
//     );

//     return true;

//   } catch (err) {

//     console.error(
//       "[ondc] Verification error",
//       err
//     );

//     return false;
//   }
// }


import sodium from "libsodium-wrappers";
import crypto from "crypto";
import { env } from "../config/env";
import { fetchPublicKey } from "./ondc-registry";

function createDigest(body: string) {

  const hash = crypto
    .createHash("sha256")
    .update(body)
    .digest("base64");

  return `SHA-256=${hash}`;
}

export async function createAuthorizationHeader(
  body: string
): Promise<string> {

  await sodium.ready;

  const created =
    Math.floor(Date.now() / 1000);

  const expires =
    created + 300;

  const digest =
    createDigest(body);

  const signingString =
    `(created): ${created}\n` +
    `(expires): ${expires}\n` +
    `digest: ${digest}`;

  console.log("SIGNING STRING:");
  console.log(signingString);

  const privateKey =
    sodium.from_base64(
      env.ondc.signingPrivateKey,
      sodium.base64_variants.ORIGINAL
    );

  console.log(
    "PRIVATE KEY LENGTH:",
    privateKey.length
  );

  // const signatureBytes =
  //   sodium.crypto_sign_detached(
  //     signingString,
  //     privateKey
  //   );

  const signatureBytes =
    sodium.crypto_sign_detached(
      sodium.from_string(signingString),
      privateKey
    );

  const signature =
    sodium.to_base64(
      signatureBytes,
      sodium.base64_variants.ORIGINAL
    );

  const keyId =
    `${env.ondc.subscriberId}` +
    `|${env.ondc.uniqueKeyId}` +
    `|ed25519`;

  const authHeader =
    `Signature ` +
    `keyId="${keyId}",` +
    `algorithm="ed25519",` +
    `created="${created}",` +
    `expires="${expires}",` +
    `headers="(created) (expires) digest",` +
    `signature="${signature}"`;

  console.log("AUTH HEADER:");
  console.log(authHeader);

  return authHeader;
}

export async function verifyAuthorizationHeader(
  authHeader: string | undefined,
  rawBody: string
): Promise<boolean> {
  try {
    await sodium.ready;

    if (!authHeader) {
      console.error("[ondc] Missing auth header");
      return false;
    }

    const keyId =
      authHeader.match(/keyId="([^"]+)"/)?.[1];

    const created =
      authHeader.match(/created="([^"]+)"/)?.[1];

    const expires =
      authHeader.match(/expires="([^"]+)"/)?.[1];

    const signature =
      authHeader.match(/signature="([^"]+)"/)?.[1];

    if (
      !keyId ||
      !created ||
      !expires ||
      !signature
    ) {
      console.error("[ondc] Invalid auth header");
      return false;
    }

    const digest =
      createDigest(rawBody);

    const signingString =
      `(created): ${created}\n` +
      `(expires): ${expires}\n` +
      `digest: ${digest}`;

    const subscriberId =
      keyId.split("|")[0];

    const publicKey =
      await fetchPublicKey(subscriberId);

    if (!publicKey) {
      console.error("[ondc] Public key missing");
      return false;
    }

    const verified =
      sodium.crypto_sign_verify_detached(
        sodium.from_base64(
          signature,
          sodium.base64_variants.ORIGINAL
        ),
        // signingString,
        sodium.from_string(signingString),
        sodium.from_base64(
          publicKey,
          sodium.base64_variants.ORIGINAL
        )
      );

    console.log("VERIFIED:", verified);

    return verified;

  } catch (err) {
    console.error(err);
    return false;
  }
}