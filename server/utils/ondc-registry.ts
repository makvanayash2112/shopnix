// import axios from "axios";
// import { createAuthorizationHeader }
//     from "./ondc-crypto";

// const REGISTRY_URL =
//     "https://preprod.registry.ondc.org/v2.0/lookup";

// export async function fetchPublicKey(
//     subscriberId: string,
//     uniqueKeyId?: string
// ): Promise<string | null> {

//     try {

//         console.log(
//             "[ondc-registry] Looking up:",
//             subscriberId
//         );

//         const payload: any = {
//             subscriber_id: subscriberId,
//         };

//         if (uniqueKeyId) {
//             payload.unique_key_id = uniqueKeyId;
//         }

//         console.log(
//             "[ondc-registry] Payload:",
//             payload
//         );
//         const body =
//             JSON.stringify(payload);

//         const authHeader =
//             await createAuthorizationHeader(body);



//         console.log("BODY:");
//         console.log(body);

//         console.log("AUTH HEADER:");
//         console.log(authHeader);

//         const response =
//             await axios.post(
//                 REGISTRY_URL,
//                 body,
//                 {
//                     headers: {
//                         "Content-Type":
//                             "application/json",
//                         "Authorization":
//                             authHeader,
//                     },
//                     timeout: 15000,
//                 }
//             );

//         const data =
//             response.data;

//         console.log(
//             "[ondc-registry] Lookup successful"
//         );
//         console.log(
//             "Status:",
//             response.status
//         );
//         console.log(
//             "Data:",
//             data
//         );

//         console.log("RESPONSE:", response);

//         console.log(
//             "REGISTRY RESPONSE:"
//         );

//         console.log(data);

//         if (
//             Array.isArray(data) &&
//             data.length > 0
//         ) {

//             const publicKey =
//                 data[0]
//                     ?.signing_public_key;

//             if (publicKey) {

//                 console.log(
//                     "[ondc-registry] Public key FOUND"
//                 );

//                 return publicKey;
//             }
//         }

//         console.error(
//             "[ondc-registry] No public key found"
//         );

//         return null;

//     } catch (err: any) {

//         console.error(
//             "[ondc-registry] Lookup FAILED:",
//             err?.response?.status
//         );

//         console.error(
//             "Response Data:",
//             err?.response?.data
//         );

//         return null;
//     }
// }

// // import axios from "axios";

// // const REGISTRY_URL =
// //     "https://preprod.registry.ondc.org/v2.0/lookup";

// // export async function fetchPublicKey(
// //     subscriberId: string,
// //     uniqueKeyId?: string
// // ): Promise<string | null> {

// //     try {

// //         console.log(
// //             "[ondc-registry] Looking up:",
// //             subscriberId
// //         );

// //         const payload: any = {
// //             subscriber_id: subscriberId,
// //         };

// //         if (uniqueKeyId) {
// //             payload.unique_key_id = uniqueKeyId;
// //         }

// //         const response = await axios.post(
// //             REGISTRY_URL,
// //             payload,
// //             {
// //                 headers: {
// //                     "Content-Type": "application/json",
// //                 },
// //                 timeout: 15000,
// //             }
// //         );

// //         console.log(
// //             "[ondc-registry] Status:",
// //             response.status
// //         );

// //         console.log(
// //             "[ondc-registry] Data:",
// //             response.data
// //         );

// //         const data = response.data;

// //         if (
// //             Array.isArray(data) &&
// //             data.length > 0
// //         ) {

// //             const publicKey =
// //                 data[0]?.signing_public_key;

// //             if (publicKey) {

// //                 console.log(
// //                     "[ondc-registry] Public key found"
// //                 );

// //                 return publicKey;
// //             }
// //         }

// //         console.error(
// //             "[ondc-registry] Public key missing"
// //         );

// //         return null;

// //     } catch (err: any) {

// //         console.error(
// //             "[ondc-registry] Lookup failed:",
// //             err?.response?.data || err.message
// //         );

// //         return null;
// //     }
// // }


import axios from "axios";
import { createAuthorizationHeader }
  from "./ondc-crypto";

const REGISTRY_URL =
  "https://preprod.registry.ondc.org/v2.0/lookup";

export async function fetchPublicKey(
  subscriberId: string,
  uniqueKeyId?: string
): Promise<string | null> {

  try {

    console.log(
      "[ondc-registry] Looking up:",
      subscriberId
    );

    // PAYLOAD

    const payload: Record<string, string> = {
      subscriber_id: subscriberId,
    };

    if (uniqueKeyId) {
      payload.unique_key_id =
        uniqueKeyId;
    }

    console.log(
      "[ondc-registry] Payload:"
    );

    console.log(payload);

    // IMPORTANT:
    // SIGN EXACT JSON STRING

    const body =
      JSON.stringify(payload);

    // CREATE AUTH HEADER

    const authHeader =
      await createAuthorizationHeader(
        body
      );

    console.log(
      "[ondc-registry] Auth Header Created"
    );

    // CALL REGISTRY

    const response =
      await axios({
        method: "POST",
        url: REGISTRY_URL,

        // IMPORTANT:
        // SEND OBJECT
        // NOT STRING

        data: payload,

        headers: {

          // IMPORTANT:
          // lowercase headers

          "content-type":
            "application/json",

          "accept":
            "application/json",

          "authorization":
            authHeader,
        },

        timeout: 15000,

        // IMPORTANT:
        // prevent axios body transform issues

        transformRequest: [(data) => {
          return JSON.stringify(data);
        }],
      });

    console.log(
      "[ondc-registry] Lookup successful"
    );

    console.log(
      "[ondc-registry] Status:",
      response.status
    );

    const data =
      response.data;

    console.log(
      "[ondc-registry] Response:"
    );

    console.log(data);

    // VALIDATE RESPONSE

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {

      const publicKey =
        data[0]
          ?.signing_public_key;

      if (publicKey) {

        console.log(
          "[ondc-registry] Public key found"
        );

        return publicKey;
      }
    }

    console.error(
      "[ondc-registry] Public key not found"
    );

    return null;

  } catch (err: any) {

    console.error(
      "[ondc-registry] Lookup FAILED"
    );

    console.error(
      "STATUS:",
      err?.response?.status
    );

    console.error(
      "DATA:",
      err?.response?.data
    );

    console.error(
      "MESSAGE:",
      err?.message
    );

    return null;
  }
}