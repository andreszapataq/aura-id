import { NextResponse } from 'next/server';
import { RekognitionClient, DeleteCollectionCommand, CreateCollectionCommand } from "@aws-sdk/client-rekognition";

const COLLECTION_ID = "EmployeeFaces";

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Función para recrear la colección (eliminar y volver a crear)
async function recreateCollection() {
  try {
    console.log(`Intentando eliminar colección ${COLLECTION_ID}...`);
    try {
      const deleteCollectionCommand = new DeleteCollectionCommand({
        CollectionId: COLLECTION_ID
      });
      await rekognition.send(deleteCollectionCommand);
      console.log(`Colección ${COLLECTION_ID} eliminada exitosamente`);
    } catch (deleteError) {
      // Ignorar errores si la colección no existe
      console.log(`Error al eliminar colección (posiblemente no existe): ${deleteError instanceof Error ? deleteError.message : 'Error desconocido'}`);
    }
    
    // Esperar un momento para asegurar que AWS procese la eliminación
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`Creando nueva colección ${COLLECTION_ID}...`);
    const createCollectionCommand = new CreateCollectionCommand({
      CollectionId: COLLECTION_ID
    });
    await rekognition.send(createCollectionCommand);
    console.log(`Colección ${COLLECTION_ID} creada exitosamente`);
    
    return true;
  } catch (error) {
    console.error("Error al recrear la colección:", error);
    return false;
  }
}

export async function GET(request: Request) {
  try {
    // Verificar si se proporciona una clave de API para seguridad
    const url = new URL(request.url);
    const apiKey = url.searchParams.get('key');
    
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({
        ok: false,
        error: 'Acceso no autorizado',
        message: 'Se requiere una clave de API válida'
      }, { status: 401 });
    }
    
    // Recrear la colección
    console.log("Iniciando proceso de limpieza de la colección...");
    const success = await recreateCollection();
    
    if (success) {
      return NextResponse.json({
        ok: true,
        message: 'Colección recreada exitosamente. Todos los rostros han sido eliminados.'
      });
    } else {
      return NextResponse.json({
        ok: false,
        error: 'Error al recrear la colección',
        message: 'No se pudo limpiar la colección de rostros'
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error general:", error);
    return NextResponse.json({
      ok: false,
      error: 'Error en el servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 