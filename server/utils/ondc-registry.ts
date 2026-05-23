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

        const payload: any = {
            subscriber_id: subscriberId,
        };

        if (uniqueKeyId) {
            payload.unique_key_id = uniqueKeyId;
        }

        const body =
            JSON.stringify(payload);

        const authHeader =
            await createAuthorizationHeader(body);

        console.log("BODY:");
        console.log(body);

        console.log("AUTH HEADER:");
        console.log(authHeader);

        const response =
            await axios.post(
                REGISTRY_URL,
                body,
                {
                    headers: {
                        "Content-Type":
                            "application/json",
                        "Authorization":
                            authHeader,
                    },
                    timeout: 15000,
                }
            );

        const data =
            response.data;

        console.log(
            "REGISTRY RESPONSE:"
        );

        console.log(data);

        if (
            Array.isArray(data) &&
            data.length > 0
        ) {

            const publicKey =
                data[0]
                    ?.signing_public_key;

            if (publicKey) {

                console.log(
                    "[ondc-registry] Public key FOUND"
                );

                return publicKey;
            }
        }

        console.error(
            "[ondc-registry] No public key found"
        );

        return null;

    } catch (err: any) {

        console.error(
            "[ondc-registry] Lookup FAILED:",
            err?.response?.status
        );

        console.error(
            "Response Data:",
            err?.response?.data
        );

        return null;
    }
}