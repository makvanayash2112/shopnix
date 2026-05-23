import axios from "axios";
import https from "https";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export async function fetchPublicKey(
  subscriberId: string
): Promise<string | null> {

  try {

    const response = await axios.post(
      "https://registry.ondc.org/v2.0/lookup",
      {
        subscriber_id: subscriberId,
      },
      {
        httpsAgent,
      }
    );

    const subscriber =
      response.data?.[0];

    if (!subscriber) {

      console.error(
        "[ondc-registry] Subscriber not found"
      );

      return null;
    }

    console.log(
      "[ondc-registry] Public key fetched"
    );

    return subscriber.signing_public_key;

  } catch (err) {

    console.error(
      "[ondc-registry] Failed lookup",
      err
    );

    return null;
  }
}