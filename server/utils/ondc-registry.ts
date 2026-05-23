// // // // // import axios from "axios";
// // // // // import https from "https";

// // // // // const httpsAgent = new https.Agent({
// // // // //   rejectUnauthorized: false,
// // // // // });

// // // // // export async function fetchPublicKey(
// // // // //   subscriberId: string
// // // // // ): Promise<string | null> {

// // // // //   try {

// // // // //     const response = await axios.post(
// // // // //       "https://registry.ondc.org/v2.0/lookup",
// // // // //       {
// // // // //         subscriber_id: subscriberId,
// // // // //       },
// // // // //       {
// // // // //         httpsAgent,
// // // // //       }
// // // // //     );

// // // // //     const subscriber =
// // // // //       response.data?.[0];

// // // // //     if (!subscriber) {

// // // // //       console.error(
// // // // //         "[ondc-registry] Subscriber not found"
// // // // //       );

// // // // //       return null;
// // // // //     }

// // // // //     console.log(
// // // // //       "[ondc-registry] Public key fetched"
// // // // //     );

// // // // //     return subscriber.signing_public_key;

// // // // //   } catch (err) {

// // // // //     console.error(
// // // // //       "[ondc-registry] Failed lookup",
// // // // //       err
// // // // //     );

// // // // //     return null;
// // // // //   }
// // // // // }

// // // // import { ONDC_PUBLIC_KEYS }
// // // //     from "./ondc-public-keys";

// // // // export async function fetchPublicKey(
// // // //     subscriberId: string
// // // // ): Promise<string | null> {

// // // //     const key =
// // // //         ONDC_PUBLIC_KEYS[subscriberId];

// // // //     if (!key) {

// // // //         console.error(
// // // //             "[ondc] Public key not found:",
// // // //             subscriberId
// // // //         );

// // // //         return null;
// // // //     }

// // // //     return key;
// // // // }


// // // import axios from "axios";

// // // export async function fetchPublicKey(
// // //     subscriberId: string
// // // ): Promise<string | null> {

// // //     try {

// // //         const response = await axios.post(
// // //             "https://registry.ondc.org/lookup",
// // //             {
// // //                 subscriber_id: subscriberId,
// // //             },
// // //             {
// // //                 timeout: 10000,
// // //                 headers: {
// // //                     "Content-Type": "application/json",
// // //                 },
// // //             }
// // //         );

// // //         const data =
// // //             response.data;

// // //         if (
// // //             !Array.isArray(data) ||
// // //             !data.length
// // //         ) {

// // //             console.error(
// // //                 "[ondc-registry] Subscriber not found"
// // //             );

// // //             return null;
// // //         }

// // //         return data[0]
// // //             ?.signing_public_key || null;

// // //     } catch (err) {

// // //         console.error(
// // //             "[ondc-registry] Lookup failed",
// // //             err
// // //         );

// // //         return null;
// // //     }
// // // }


// // import axios from "axios";
// // import https from "https";

// // export async function fetchPublicKey(
// //     subscriberId: string
// // ): Promise<string | null> {

// //     const httpsAgent = new https.Agent({
// //         rejectUnauthorized: false,   // Only for ONDC registry
// //     });

// //     try {
// //         const response = await axios.post(
// //             "https://registry.ondc.org/lookup",   // or try /v2.0/lookup
// //             {
// //                 subscriber_id: subscriberId,
// //             },
// //             {
// //                 httpsAgent,
// //                 timeout: 10000,
// //                 headers: {
// //                     "Content-Type": "application/json",
// //                 },
// //             }
// //         );

// //         const data = response.data;

// //         if (!Array.isArray(data) || !data.length) {
// //             console.error("[ondc-registry] Subscriber not found");
// //             return null;
// //         }

// //         return data[0]?.signing_public_key || null;

// //     } catch (err: any) {
// //         console.error("[ondc-registry] Lookup failed", err?.message || err);
// //         return null;
// //     }
// // }


// import axios from "axios";
// import https from "https";

// const REGISTRY_URL = "https://preprod.registry.ondc.org/v2.0/lookup";

// export async function fetchPublicKey(
//   subscriberId: string
// ): Promise<string | null> {

//   const httpsAgent = new https.Agent({
//     rejectUnauthorized: false
//   });

//   try {
//     console.log(`[ondc-registry] Looking up: ${subscriberId}`);

//     const response = await axios.post(
//       REGISTRY_URL,
//       {
//         subscriber_id: subscriberId,
//       },
//       {
//         httpsAgent,
//         timeout: 15000,
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const data = response.data;

//     if (Array.isArray(data) && data.length > 0) {
//       const publicKey = data[0]?.signing_public_key;
//       if (publicKey) {
//         console.log(`[ondc-registry] Public key FOUND for ${subscriberId}`);
//         return publicKey;
//       }
//     }

//     console.error("[ondc-registry] No public key returned");
//     return null;

//   } catch (err: any) {
//     console.error("[ondc-registry] Lookup FAILED:", err?.message || err);
//     return null;
//   }
// }

import axios from "axios";
import https from "https";
import { createAuthorizationHeader } from "./ondc-crypto";   // ← Import this

const REGISTRY_URL = "https://preprod.registry.ondc.org/v2.0/lookup";

export async function fetchPublicKey(
    subscriberId: string
): Promise<string | null> {

    // const httpsAgent = new https.Agent({
    //     rejectUnauthorized: false
    // });

    try {
        console.log(`[ondc-registry] Looking up: ${subscriberId}`);

        // Create payload for registry lookup
        const payload = {
            subscriber_id: subscriberId,
            country: "IND",
            // You can add "domain": "ONDC:RET10" if needed
        };

        // Create Authorization header using your signing key
        const authHeader = await createAuthorizationHeader(payload);

        if (!authHeader) {
            console.error("[ondc-registry] Failed to create auth header");
            return null;
        }

        const response = await axios.post(
            REGISTRY_URL,
            payload,
            {
                // httpsAgent,
                timeout: 15000,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": authHeader,
                },
            }
        );

        const data = response.data;

        if (Array.isArray(data) && data.length > 0) {
            const publicKey = data[0]?.signing_public_key;
            if (publicKey) {
                console.log(`[ondc-registry] Public key FOUND for ${subscriberId}`);
                return publicKey;
            }
        }

        console.error("[ondc-registry] No public key in response");
        return null;

    } catch (err: any) {
        console.error("[ondc-registry] Lookup FAILED:", err?.response?.status || err?.message);
        if (err?.response?.data) {
            console.error("Response Data:", err.response.data);
        }
        return null;
    }
}