import { NextResponse } from 'next/server';
import { RekognitionClient, DeleteCollectionCommand, CreateCollectionCommand, ListCollectionsCommand } from "@aws-sdk/client-rekognition";

const COLLECTION_ID = process.env.AWS_REKOGNITION_COLLECTION_ID || "EmployeesFaces";

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
    // Primero verificar si hay colecciones existentes y eliminar todas las variantes
    const listCommand = new ListCollectionsCommand({});
    const collections = await rekognition.send(listCommand);
    
    // Eliminar cualquier variante de la colección que pueda existir
    const collectionVariants = ["EmployeeFaces", "EmployeesFaces"];
    
    for (const variant of collectionVariants) {
      if (collections.CollectionIds?.includes(variant)) {
        console.log(`Eliminando colección ${variant}...`);
        try {
          const deleteCollectionCommand = new DeleteCollectionCommand({
            CollectionId: variant
          });
          await rekognition.send(deleteCollectionCommand);
          console.log(`Colección ${variant} eliminada exitosamente`);
        } catch (deleteError) {
          console.log(`Error al eliminar colección ${variant}: ${deleteError instanceof Error ? deleteError.message : 'Error desconocido'}`);
        }
      }
    }
    
    // Esperar un momento para asegurar que AWS procese la eliminación
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Crear la colección con el nombre correcto
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

export async function POST(request: Request) {
  try {
    // Verificar si se proporciona una clave de API para seguridad (opcional)
    const body = await request.json();
    const force = body.force || false;
    
    if (!force) {
      // Verificar si hay alguna clave de API en la solicitud
      const apiKey = body.apiKey;
      if (apiKey && apiKey !== process.env.ADMIN_API_KEY) {
        return NextResponse.json({
          ok: false,
          error: 'Clave de API inválida',
          message: 'La clave de API proporcionada no es válida'
        }, { status: 401 });
      }
    }
    
    // Recrear la colección
    console.log("Iniciando proceso de limpieza de la colección...");
    const success = await recreateCollection();
    
    if (success) {
      return NextResponse.json({
        ok: true,
        message: 'Colección recreada exitosamente. Todos los rostros han sido eliminados.',
        collection_id: COLLECTION_ID
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