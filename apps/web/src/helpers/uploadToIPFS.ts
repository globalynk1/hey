import { S3 } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import {
  EVER_API,
  EVER_BUCKET,
  EVER_REGION,
  HEY_API_URL
} from "@hey/data/constants";
import type { IPFSResponse } from "@hey/types/misc";
import axios from "axios";
import { v4 as uuid } from "uuid";

const FALLBACK_TYPE = "image/jpeg";

/**
 * Returns an S3 client with temporary credentials obtained from the STS service.
 *
 * @returns S3 client instance.
 */
const getS3Client = async (): Promise<S3> => {
  const { data } = await axios.get(`${HEY_API_URL}/sts/token`);
  const client = new S3({
    credentials: {
      accessKeyId: data?.accessKeyId,
      secretAccessKey: data?.secretAccessKey,
      sessionToken: data?.sessionToken
    },
    endpoint: EVER_API,
    maxAttempts: 10,
    region: EVER_REGION
  });

  return client;
};

/**
 * Uploads a set of files to the IPFS network via S3 and returns an array of MediaSet objects.
 *
 * @param data Files to upload to IPFS.
 * @param onProgress Callback to be called when the upload progress changes.
 * @returns Array of MediaSet objects.
 */
const uploadToIPFS = async (
  data: any,
  onProgress?: (percentage: number) => void
): Promise<IPFSResponse[]> => {
  try {
    const files = Array.from(data);
    const client = await getS3Client();
    const currentDate = new Date()
      .toLocaleDateString("en-GB")
      .replace(/\//g, "-");

    const attachments = await Promise.all(
      files.map(async (_: any, i: number) => {
        const file = data[i];
        const params = {
          Body: file,
          Bucket: EVER_BUCKET,
          ContentType: file.type,
          Key: `${currentDate}/${uuid()}`
        };
        const task = new Upload({ client, params });
        task.on("httpUploadProgress", (e) => {
          const loaded = e.loaded || 0;
          const total = e.total || 0;
          const progress = (loaded / total) * 100;
          onProgress?.(Math.round(progress));
        });
        await task.done();
        const result = await client.headObject(params);
        const metadata = result.Metadata;
        const cid = metadata?.["ipfs-hash"];

        return { mimeType: file.type || FALLBACK_TYPE, uri: `ipfs://${cid}` };
      })
    );

    return attachments;
  } catch {
    return [];
  }
};

/**
 * Uploads a file to the IPFS network via S3 and returns a MediaSet object.
 *
 * @param file File to upload to IPFS.
 * @returns MediaSet object or null if the upload fails.
 */
export const uploadFileToIPFS = async (
  file: File,
  onProgress?: (percentage: number) => void
): Promise<IPFSResponse> => {
  try {
    const ipfsResponse = await uploadToIPFS([file], onProgress);
    const metadata = ipfsResponse[0];

    return { mimeType: file.type || FALLBACK_TYPE, uri: metadata.uri };
  } catch {
    return { mimeType: file.type || FALLBACK_TYPE, uri: "" };
  }
};

export default uploadToIPFS;
