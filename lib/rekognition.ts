import { RekognitionClient, IndexFacesCommand, SearchFacesByImageCommand, CreateCollectionCommand, ListCollectionsCommand, Attribute, QualityFilter, DeleteFacesCommand, DeleteFacesCommandInput, DeleteFacesCommandOutput } from "@aws-sdk/client-rekognition"

const rekognition = typeof window === 'undefined' ? new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
}) : null;

const COLLECTION_ID = process.env.AWS_REKOGNITION_COLLECTION_ID || "EmployeesFaces" // Asegúrate que esta variable esté definida

/**
 * Verifica si un rostro ya existe en la colección
 * @param imageData Imagen en formato base64
 * @param similarityThreshold Umbral de similitud (0-100)
 * @returns Objeto con información del rostro encontrado o null si no se encuentra
 */
export async function checkFaceExists(imageData: string, similarityThreshold = 80) {
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
    
    // Verificar si rekognition está inicializado
    if (!rekognition) {
      throw new Error("Cliente de Rekognition no inicializado");
    }
    
    // Verificar si la colección existe
    try {
      const listCommand = new ListCollectionsCommand({});
      const collections = await rekognition.send(listCommand);
      
      if (!collections?.CollectionIds?.includes(COLLECTION_ID)) {
        console.log(`La colección ${COLLECTION_ID} no existe. No hay rostros registrados.`);
        return null;
      }
    } catch (error) {
      console.error("Error al verificar la colección:", error);
      throw error;
    }
    
    const params = {
      CollectionId: COLLECTION_ID,
      Image: {
        Bytes: Buffer.from(base64Data, "base64"),
      },
      MaxFaces: 5, // Buscar hasta 5 rostros similares
      FaceMatchThreshold: similarityThreshold, // Umbral de similitud
    }

    console.log(`Buscando rostros similares con umbral de similitud: ${similarityThreshold}%`);
    const command = new SearchFacesByImageCommand(params);
    const response = await rekognition.send(command);
    
    // Si no hay coincidencias, retornar null
    if (!response.FaceMatches || response.FaceMatches.length === 0) {
      console.log("No se encontraron rostros similares en la colección");
      return null;
    }
    
    // Ordenar por similitud (de mayor a menor)
    const matches = response.FaceMatches.sort((a, b) => 
      (b.Similarity || 0) - (a.Similarity || 0)
    );
    
    console.log(`Se encontraron ${matches.length} rostros similares. Mejor coincidencia: ${matches[0].Similarity}%, ID: ${matches[0].Face?.FaceId}`);
    
    // Retornar información del rostro más similar
    return {
      faceId: matches[0].Face?.FaceId,
      similarity: matches[0].Similarity,
      externalImageId: matches[0].Face?.ExternalImageId,
      matches: matches.map(match => ({
        faceId: match.Face?.FaceId,
        similarity: match.Similarity,
        externalImageId: match.Face?.ExternalImageId
      }))
    };
  } catch (error) {
    // Si el error es porque no hay rostros en la imagen, retornar null
    if (error instanceof Error && 
        (error.name === 'InvalidParameterException' || 
         error.message.includes('No face detected') ||
         error.message.includes('There are no faces in the collection'))) {
      console.log("No se detectó ningún rostro en la imagen o la colección está vacía");
      return null;
    }
    
    console.error("Error al verificar rostro existente:", error);
    throw error;
  }
}

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
    
    // Verificar si rekognition está inicializado
    if (!rekognition) {
      throw new Error("Cliente de Rekognition no inicializado");
    }
    
    // Verificar si la colección existe
    try {
      const listCommand = new ListCollectionsCommand({});
      const collections = await rekognition.send(listCommand);
      
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
    const response = await rekognition.send(command)
    
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
  // Extraer los datos base64 sin el prefijo
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
  
  // Verificar que los datos no estén vacíos
  if (!base64Data || base64Data.length < 100) {
    throw new Error('Datos de imagen vacíos o demasiado pequeños.');
  }
  
  // Verificar si rekognition está inicializado
  if (!rekognition) {
    throw new Error("Cliente de Rekognition no inicializado");
  }
  
  const params = {
    CollectionId: COLLECTION_ID,
    Image: {
      Bytes: Buffer.from(base64Data, "base64"),
    },
    MaxFaces: 1,
    FaceMatchThreshold: 95,
  }

  try {
    const command = new SearchFacesByImageCommand(params)
    const response = await rekognition.send(command)
    
    if (!response) {
      throw new Error("No se recibió respuesta de AWS Rekognition");
    }
    
    return response.FaceMatches?.[0]?.Face?.FaceId
  } catch (error) {
    console.error("Error searching face:", error)
    throw error
  }
}

export async function createCollection() {
  try {
    // Verificar si rekognition está inicializado
    if (!rekognition) {
      throw new Error("Cliente de Rekognition no inicializado");
    }
    
    // Primero verificamos si la colección ya existe
    const listCommand = new ListCollectionsCommand({});
    const collections = await rekognition.send(listCommand);
    
    if (collections?.CollectionIds?.includes(COLLECTION_ID)) {
      console.log(`La colección ${COLLECTION_ID} ya existe`);
      return { message: "Collection already exists" };
    }

    // Si no existe, la creamos
    const command = new CreateCollectionCommand({
      CollectionId: COLLECTION_ID,
    });
    
    await rekognition.send(command);
    console.log(`Colección ${COLLECTION_ID} creada exitosamente`);
    return { message: "Collection created successfully" };
  } catch (error) {
    console.error("Error creating collection:", error);
    throw error;
  }
}

/**
 * Busca un rostro en la colección de empleados
 * @param imageData Imagen en formato base64
 * @returns Objeto con información del rostro encontrado o null si no se encuentra
 */
export async function searchFacesByImage(imageData: string) {
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
    
    // Verificar si rekognition está inicializado
    if (!rekognition) {
      throw new Error("Cliente de Rekognition no inicializado");
    }
    
    // Verificar si la colección existe
    try {
      const listCommand = new ListCollectionsCommand({});
      const collections = await rekognition.send(listCommand);
      
      if (!collections?.CollectionIds?.includes(COLLECTION_ID)) {
        console.log(`La colección ${COLLECTION_ID} no existe. No hay rostros registrados.`);
        return null;
      }
    } catch (error) {
      console.error("Error al verificar la colección:", error);
      throw error;
    }
    
    const params = {
      CollectionId: COLLECTION_ID,
      Image: {
        Bytes: Buffer.from(base64Data, 'base64')
      },
      FaceMatchThreshold: 80, // Usar el mismo umbral que en checkFaceExists
      MaxFaces: 5 // Buscar hasta 5 rostros similares
    };
    
    console.log(`Buscando rostros similares con umbral de similitud: 80%`);
    const command = new SearchFacesByImageCommand(params);
    const response = await rekognition.send(command);
    
    if (!response.FaceMatches || response.FaceMatches.length === 0) {
      console.log("No se encontraron rostros similares en la colección");
      return null;
    }
    
    // Ordenar por similitud (de mayor a menor)
    const matches = response.FaceMatches.sort((a, b) => 
      (b.Similarity || 0) - (a.Similarity || 0)
    );
    
    console.log(`Se encontraron ${matches.length} rostros similares. Mejor coincidencia: ${matches[0].Similarity}%, ID: ${matches[0].Face?.FaceId}`);
    
    // Retornar información del rostro más similar
    return {
      faceId: matches[0].Face?.FaceId,
      similarity: matches[0].Similarity,
      externalImageId: matches[0].Face?.ExternalImageId,
      matches: matches.map(match => ({
        faceId: match.Face?.FaceId,
        similarity: match.Similarity,
        externalImageId: match.Face?.ExternalImageId
      }))
    };
  } catch (error) {
    // Si el error es porque no hay rostros en la imagen, retornar null
    if (error instanceof Error && 
        (error.name === 'InvalidParameterException' || 
         error.message.includes('No face detected') ||
         error.message.includes('There are no faces in the collection'))) {
      console.log("No se detectó ningún rostro en la imagen o la colección está vacía");
      return null;
    }
    
    console.error("Error al buscar rostro:", error);
    throw error;
  }
}

/**
 * Elimina un rostro específico de la colección de Rekognition usando su FaceId.
 * @param faceId El ID del rostro a eliminar.
 * @returns Un array con los IDs de los rostros eliminados (debería ser solo uno).
 * @throws Error si falla la operación o faltan configuraciones.
 */
export async function deleteFace(faceId: string): Promise<string[] | undefined> {
  if (!rekognition) {
    throw new Error("Cliente de Rekognition no inicializado en el servidor.");
  }
  if (!COLLECTION_ID) {
    throw new Error("AWS_REKOGNITION_COLLECTION_ID no está configurado en las variables de entorno.");
  }
  if (!faceId) {
      throw new Error("Se requiere un faceId para eliminar.");
  }

  const params: DeleteFacesCommandInput = {
    CollectionId: COLLECTION_ID,
    FaceIds: [faceId], // DeleteFaces espera un array de IDs
  };

  try {
    console.log(`Intentando eliminar FaceId: ${faceId} de la colección ${COLLECTION_ID}`);
    const command = new DeleteFacesCommand(params);
    const response: DeleteFacesCommandOutput = await rekognition.send(command);

    console.log("Respuesta de DeleteFaces:", response);

    if (!response.DeletedFaces || response.DeletedFaces.length === 0) {
        console.warn(`No se confirmó la eliminación de ${faceId}. La respuesta no incluyó el ID en DeletedFaces.`);
        // Podrías lanzar un error aquí si quieres ser más estricto
        // throw new Error(`No se pudo confirmar la eliminación de ${faceId}`);
    }

    // Devuelve el array de IDs eliminados (puede estar vacío si algo raro pasó)
    return response.DeletedFaces; 

  } catch (error) {
    console.error(`Error al eliminar FaceId ${faceId} de Rekognition:`, error);
    // Re-lanzar el error para que sea manejado por el llamador
    throw error;
  }
}
