// // import axios from "axios";
// // import https from "https";

// // const httpsAgent = new https.Agent({
// //   rejectUnauthorized: false,
// // });

// // export async function fetchPublicKey(
// //   subscriberId: string
// // ): Promise<string | null> {

// //   try {

// //     const response = await axios.post(
// //       "https://registry.ondc.org/v2.0/lookup",
// //       {
// //         subscriber_id: subscriberId,
// //       },
// //       {
// //         httpsAgent,
// //       }
// //     );

// //     const subscriber =
// //       response.data?.[0];

// //     if (!subscriber) {

// //       console.error(
// //         "[ondc-registry] Subscriber not found"
// //       );

// //       return null;
// //     }

// //     console.log(
// //       "[ondc-registry] Public key fetched"
// //     );

// //     return subscriber.signing_public_key;

// //   } catch (err) {

// //     console.error(
// //       "[ondc-registry] Failed lookup",
// //       err
// //     );

// //     return null;
// //   }
// // }

// import { ONDC_PUBLIC_KEYS }
//     from "./ondc-public-keys";

// export async function fetchPublicKey(
//     subscriberId: string
// ): Promise<string | null> {

//     const key =
//         ONDC_PUBLIC_KEYS[subscriberId];

//     if (!key) {

//         console.error(
//             "[ondc] Public key not found:",
//             subscriberId
//         );

//         return null;
//     }

//     return key;
// }


import axios from "axios";

export async function fetchPublicKey(
    subscriberId: string
): Promise<string | null> {

    try {

        const response = await axios.post(
            "https://registry.ondc.org/lookup",
            {
                subscriber_id: subscriberId,
            },
            {
                timeout: 10000,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        const data =
            response.data;

        if (
            !Array.isArray(data) ||
            !data.length
        ) {

            console.error(
                "[ondc-registry] Subscriber not found"
            );

            return null;
        }

        return data[0]
            ?.signing_public_key || null;

    } catch (err) {

        console.error(
            "[ondc-registry] Lookup failed",
            err
        );

        return null;
    }
}