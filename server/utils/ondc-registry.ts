import axios from "axios";

export async function fetchPublicKey(
  subscriberId: string
): Promise<string | null> {

  try {

    const response =
      await axios.post(
        "https://registry.ondc.org/v2.0/lookup",
        {
          subscriber_id: subscriberId,
        }
      );

    const subscriber =
      response.data?.[0];

    if (!subscriber) {
      return null;
    }

    return subscriber.signing_public_key;

  } catch (err) {

    console.error(
      "[ondc-registry] Failed to fetch public key",
      err
    );

    return null;
  }
}