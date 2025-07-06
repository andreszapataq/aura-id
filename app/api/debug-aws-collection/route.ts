import { NextResponse } from 'next/server';
import { RekognitionClient, ListFacesCommand, ListCollectionsCommand } from "@aws-sdk/client-rekognition";

const COLLECTION_ID = process.env.AWS_REKOGNITION_COLLECTION_ID || "EmployeesFaces";

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET() {
  try {
    console.log('🔍 Verificando colecciones de AWS Rekognition...');

    // 1. Verificar que el cliente está configurado
    const awsConfig = {
      region: process.env.AWS_REGION,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      collectionId: COLLECTION_ID
    };

    // 2. Listar todas las colecciones
    const listCollectionsCommand = new ListCollectionsCommand({});
    const collections = await rekognition.send(listCollectionsCommand);
    
    console.log('📋 Colecciones disponibles:', collections.CollectionIds);

    // 3. Verificar si nuestra colección existe
    const collectionExists = collections.CollectionIds?.includes(COLLECTION_ID);
    
    if (!collectionExists) {
      return NextResponse.json({
        ok: false,
        message: `La colección ${COLLECTION_ID} no existe`,
        debug: {
          aws_config: awsConfig,
          available_collections: collections.CollectionIds || [],
          target_collection: COLLECTION_ID,
          collection_exists: false
        }
      });
    }

    // 4. Listar rostros en nuestra colección
    console.log(`🔎 Listando rostros en colección ${COLLECTION_ID}...`);
    const listFacesCommand = new ListFacesCommand({
      CollectionId: COLLECTION_ID,
      MaxResults: 100
    });
    
    const faces = await rekognition.send(listFacesCommand);
    
    console.log(`👥 Rostros encontrados: ${faces.Faces?.length || 0}`);
    if (faces.Faces && faces.Faces.length > 0) {
      faces.Faces.forEach((face, index) => {
        console.log(`👤 Rostro ${index + 1}:`, {
          faceId: face.FaceId,
          externalImageId: face.ExternalImageId,
          confidence: face.Confidence
        });
      });
    }

    return NextResponse.json({
      ok: true,
      debug: {
        aws_config: awsConfig,
        available_collections: collections.CollectionIds || [],
        target_collection: COLLECTION_ID,
        collection_exists: collectionExists,
        faces_count: faces.Faces?.length || 0,
        faces: faces.Faces?.map(face => ({
          faceId: face.FaceId,
          externalImageId: face.ExternalImageId,
          confidence: face.Confidence
        })) || []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error al verificar AWS:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      details: error instanceof Error ? error.stack : 'Sin detalles'
    }, { status: 500 });
  }
} 