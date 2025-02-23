import { RekognitionClient, IndexFacesCommand, SearchFacesByImageCommand, CreateCollectionCommand, ListCollectionsCommand, Attribute } from "@aws-sdk/client-rekognition"

const rekognition = typeof window === 'undefined' ? new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
}) : null;

const COLLECTION_ID = "EmployeeFaces"

export async function indexFace(imageData: string, externalImageId: string) {
  const params = {
    CollectionId: COLLECTION_ID,
    Image: {
      Bytes: Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ""), "base64"),
    },
    ExternalImageId: externalImageId,
    DetectionAttributes: ["DEFAULT" as Attribute],
  }

  try {
    const command = new IndexFacesCommand(params)
    const response = await rekognition?.send(command)
    if (!response) throw new Error("Failed to get response from Rekognition")
    return response.FaceRecords?.[0]?.Face?.FaceId
  } catch (error) {
    console.error("Error indexing face:", error)
    throw error
  }
}

export async function searchFace(imageData: string) {
  const params = {
    CollectionId: COLLECTION_ID,
    Image: {
      Bytes: Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ""), "base64"),
    },
    MaxFaces: 1,
    FaceMatchThreshold: 95,
  }

  try {
    const command = new SearchFacesByImageCommand(params)
    const response = await rekognition?.send(command)
    if (!response) throw new Error("Failed to get response from Rekognition")
    return response.FaceMatches?.[0]?.Face?.FaceId
  } catch (error) {
    console.error("Error searching face:", error)
    throw error
  }
}

export async function createCollection() {
  try {
    // Primero verificamos si la colección ya existe
    const listCommand = new ListCollectionsCommand({});
    const collections = await rekognition?.send(listCommand);
    
    if (collections?.CollectionIds?.includes(COLLECTION_ID)) {
      return { message: "Collection already exists" };
    }

    // Si no existe, la creamos
    const command = new CreateCollectionCommand({
      CollectionId: COLLECTION_ID,
    });
    
    await rekognition?.send(command);
    return { message: "Collection created successfully" };
  } catch (error) {
    console.error("Error creating collection:", error);
    throw error;
  }
}
