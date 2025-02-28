import { RekognitionClient, IndexFacesCommand, SearchFacesByImageCommand, CreateCollectionCommand, ListCollectionsCommand, Attribute, QualityFilter } from "@aws-sdk/client-rekognition"

const rekognition = typeof window === 'undefined' ? new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
}) : null;

const COLLECTION_ID = "EmployeeFaces"

export async function indexFace(imageData: string, externalImageId: string) {
  try {
    // Verificar que la imagen tenga un formato válido
    if (!imageData.startsWith('data:image/jpeg;base64,') && !imageData.startsWith('data:image/png;base64,')) {
      throw new Error('Formato de imagen no válido. Debe ser JPEG o PNG en base64.');
    }
    
    // Extraer los datos base64 sin el prefijo
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    
    // Verificar que los datos no estén vacíos
    if (!base64Data || base64Data.length < 100) {
      throw new Error('Datos de imagen vacíos o demasiado pequeños.');
    }
    
    // Verificar si la colección existe
    try {
      const listCommand = new ListCollectionsCommand({});
      const collections = await rekognition?.send(listCommand);
      
      if (!collections?.CollectionIds?.includes(COLLECTION_ID)) {
        console.log(`La colección ${COLLECTION_ID} no existe. Creándola...`);
        await createCollection();
      }
    } catch (error) {
      console.error("Error al verificar la colección:", error);
      // Continuamos con el proceso aunque falle la verificación
    }
    
    const params = {
      CollectionId: COLLECTION_ID,
      Image: {
        Bytes: Buffer.from(base64Data, "base64"),
      },
      ExternalImageId: externalImageId,
      DetectionAttributes: ["DEFAULT" as Attribute],
      MaxFaces: 1, // Limitar a un solo rostro
      QualityFilter: "HIGH" as QualityFilter, // Filtrar por alta calidad
    }

    console.log(`Indexando rostro para ${externalImageId} en colección ${COLLECTION_ID}`);
    const command = new IndexFacesCommand(params)
    const response = await rekognition?.send(command)
    
    if (!response) {
      throw new Error("No se recibió respuesta de AWS Rekognition");
    }
    
    if (!response.FaceRecords || response.FaceRecords.length === 0) {
      throw new Error("No se detectó ningún rostro en la imagen");
    }
    
    const faceId = response.FaceRecords[0]?.Face?.FaceId;
    if (!faceId) {
      throw new Error("No se recibió ID de rostro en la respuesta");
    }
    
    console.log(`Rostro indexado exitosamente con ID: ${faceId}`);
    return faceId;
  } catch (error) {
    console.error("Error detallado al indexar rostro:", error);
    throw error;
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
