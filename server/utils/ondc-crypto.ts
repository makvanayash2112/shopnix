

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

// export async function createAuthorizationHeader(
//   body: string
// ): Promise<string> {

//   await sodium.ready;

//   const created =
//     Math.floor(Date.now() / 1000);

//   const expires =
//     created + 300;

//   const digest =
//     createDigest(body);

//   const signingString =
//     `(created): ${created}\n` +
//     `(expires): ${expires}\n` +
//     `digest: ${digest}`;

//   console.log("SIGNING STRING:");
//   console.log(signingString);

//   // const privateKey =
//   //   sodium.from_base64(
//   //     env.ondc.signingPrivateKey,
//   //     sodium.base64_variants.ORIGINAL
//   //   );

//   //   console.log(
//   //   "SUBSCRIBER ID:",
//   //   env.ondc.subscriberId
//   // );

//   // console.log(
//   //   "UKID:",
//   //   env.ondc.uniqueKeyId
//   // );

//   // console.log(
//   //   "PRIVATE KEY:",
//   //   env.ondc.signingPrivateKey
//   // );

//   // console.log("sodium private key:", privateKey);

//   // console.log(
//   //   "PRIVATE KEY LENGTH:",
//   //   privateKey.length
//   // );

//   // if (privateKey.length !== 64) {
//   //   throw new Error(
//   //     `ONDC private key must be 64 bytes. Current: ${privateKey.length}`
//   //   );
//   // }

//   // const signatureBytes =
//   //   sodium.crypto_sign_detached(
//   //     sodium.from_string(signingString),
//   //     privateKey
//   //   );


//   const key =
//     sodium.from_base64(
//       env.ondc.signingPrivateKey,
//       sodium.base64_variants.ORIGINAL
//     );

//   console.log("KEY LENGTH:", key.length);

//   let privateKey: Uint8Array;

//   if (key.length === 64) {

//     // USE FIRST 32 BYTES AS SEED
//     const seed = key.slice(0, 32);

//     const keyPair =
//       sodium.crypto_sign_seed_keypair(seed);

//     privateKey = keyPair.privateKey;

//   } else if (key.length === 32) {

//     const keyPair =
//       sodium.crypto_sign_seed_keypair(key);

//     privateKey = keyPair.privateKey;

//   } else {

//     throw new Error(
//       `Invalid private key length: ${key.length}`
//     );
//   }

//   console.log("PRIVATE KEY:", env.ondc.signingPrivateKey);
//   console.log("PRIVATE KEY LENGTH:", privateKey.length);
//   console.log("PRIVATE KEY (base64):", sodium.to_base64(privateKey, sodium.base64_variants.ORIGINAL));
//   console.log("PRIVATE KEY (hex):", sodium.to_hex(privateKey));
//   console.log("PRIVATE KEY (raw):", privateKey);
//   console.log("PRIVATE KEY (raw length):", privateKey.length);
//   console.log("PRIVATE KEY (first 32 bytes as seed, base64):", sodium.to_base64(privateKey.slice(0, 32), sodium.base64_variants.ORIGINAL));
//   console.log("PRIVATE KEY (first 32 bytes as seed, hex):", sodium.to_hex(privateKey.slice(0, 32)));
//   console.log("PRIVATE KEY (first 32 bytes as seed, raw):", privateKey.slice(0, 32));
//   console.log("PRIVATE KEY (first 32 bytes as seed, raw length):", privateKey.slice(0, 32).length);
//   console.log("PRIVATE KEY (last 32 bytes, base64):", sodium.to_base64(privateKey.slice(32), sodium.base64_variants.ORIGINAL));
//   console.log("PRIVATE KEY (last 32 bytes, hex):", sodium.to_hex(privateKey.slice(32)));
//   console.log("PRIVATE KEY (last 32 bytes, raw):", privateKey.slice(32));
//   console.log("PRIVATE KEY (last 32 bytes, raw length):", privateKey.slice(32).length);
//   console.log("uniqueKeyId:", env.ondc.uniqueKeyId);
//   console.log("subscriberId:", env.ondc.subscriberId);
//   console.log("signingString:", signingString);
//   console.log("sodium:", sodium);
//   console.log("sodium ready:", sodium.ready);
//   console.log("sodium crypto_sign_BYTES:", sodium.crypto_sign_BYTES);
//   console.log("sodium crypto_sign_PUBLICKEYBYTES:", sodium.crypto_sign_PUBLICKEYBYTES);
//   console.log("sodium crypto_sign_SECRETKEYBYTES:", sodium.crypto_sign_SECRETKEYBYTES);

//   const signatureBytes =
//     sodium.crypto_sign_detached(
//       sodium.from_string(signingString),
//       privateKey
//     );

//   console.log(
//     "SIGNATURE BYTES LENGTH:",
//     signatureBytes.length
//   );

//   const signature =
//     sodium.to_base64(
//       signatureBytes,
//       sodium.base64_variants.ORIGINAL
//     );

//   console.log(
//     "SIGNATURE LENGTH:",
//     signature.length
//   );

//   console.log(
//     "SIGNATURE:",
//     signature
//   );

//   const keyId =
//     `${env.ondc.subscriberId}` +
//     `|${env.ondc.uniqueKeyId}` +
//     `|ed25519`;

//   const authHeader =
//     `Signature ` +
//     `keyId="${keyId}",` +
//     `algorithm="ed25519",` +
//     `created="${created}",` +
//     `expires="${expires}",` +
//     `headers="(created) (expires) digest",` +
//     `signature="${signature}"`;

//   console.log("AUTH HEADER:");
//   console.log(authHeader);

//   return authHeader;
// }

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

  const signingKey =
    sodium.from_base64(
      env.ondc.signingPrivateKey,
      sodium.base64_variants.ORIGINAL
    );

  console.log(
    "SIGNING KEY LENGTH:",
    signingKey.length
  );

  if (signingKey.length !== 64) {

    throw new Error(
      `Invalid ONDC signing key length: ${signingKey.length}`
    );
  }

  // IMPORTANT
  // DIRECTLY USE 64-BYTE SECRET KEY

  const signatureBytes =
    sodium.crypto_sign_detached(
      sodium.from_string(signingString),
      signingKey
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

      console.error(
        "[ondc] Missing auth header"
      );

      return false;
    }

    const keyId =
      authHeader.match(
        /keyId="([^"]+)"/
      )?.[1];

    const created =
      authHeader.match(
        /created="([^"]+)"/
      )?.[1];

    const expires =
      authHeader.match(
        /expires="([^"]+)"/
      )?.[1];

    const signature =
      authHeader.match(
        /signature="([^"]+)"/
      )?.[1];

    if (
      !keyId ||
      !created ||
      !expires ||
      !signature
    ) {

      console.error(
        "[ondc] Invalid auth header"
      );

      return false;
    }

    const digest =
      createDigest(rawBody);

    console.log("RAW BODY:");
    console.log(rawBody);

    const signingString =
      `(created): ${created}\n` +
      `(expires): ${expires}\n` +
      `digest: ${digest}`;


    console.log("SIGNING STRING:");
    console.log(signingString);

    // const [
    //   subscriberId,
    //   uniqueKeyId
    // ] = keyId.split("|");

    const parts =
      keyId.split("|");

    const subscriberId =
      parts[0];

    const uniqueKeyId =
      parts[1];

    console.log(
      "VERIFY SUBSCRIBER:",
      subscriberId
    );

    console.log(
      "VERIFY UKID:",
      uniqueKeyId
    );

    const publicKey =
      await fetchPublicKey(
        subscriberId,
        uniqueKeyId
      );

    console.log(
      "FETCHED PUBLIC KEY:",
      publicKey
    );

    if (!publicKey) {

      console.error(
        "[ondc] Public key missing"
      );

      return false;
    }

    const verified =
      sodium.crypto_sign_verify_detached(
        sodium.from_base64(
          signature,
          sodium.base64_variants.ORIGINAL
        ),
        sodium.from_string(signingString),
        sodium.from_base64(
          publicKey,
          sodium.base64_variants.ORIGINAL
        )
      );

    console.log(
      "VERIFIED:",
      verified
    );

    return verified;

  } catch (err) {

    console.error(err);

    return false;
  }
}