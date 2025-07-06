import { NextResponse } from 'next/server';
import { supabaseAdmin } from "@/lib/supabase-admin";
import { RekognitionClient, ListFacesCommand } from "@aws-sdk/client-rekognition";

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST() {
  try {
    console.log('🔍 DIAGNÓSTICO COMPLETO DEL SISTEMA');
    
    // 1. Verificar empleados en base de datos
    const { data: employees, error: empError } = await supabaseAdmin
      .from("employees")
      .select("*");
    
    console.log('👥 Empleados en base de datos:', employees);
    console.log('❌ Error empleados:', empError);
    
    // 2. Verificar rostros en AWS Rekognition
    let faces: Array<{FaceId?: string, Confidence?: number, ExternalImageId?: string}> = [];
    let awsError = null;
    
    try {
      const listCommand = new ListFacesCommand({
        CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID || "EmployeesFaces"
      });
      
      const awsResponse = await rekognition.send(listCommand);
      faces = (awsResponse.Faces || []) as Array<{FaceId?: string, Confidence?: number, ExternalImageId?: string}>;
      console.log('👤 Rostros en AWS:', faces.length);
    } catch (error) {
      awsError = error;
      console.error('❌ Error AWS:', error);
    }
    
    // 3. Verificar logs de acceso
    const { data: logs, error: logsError } = await supabaseAdmin
      .from("access_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      database: {
        employees: {
          count: employees?.length || 0,
          data: employees,
          error: empError
        },
        access_logs: {
          count: logs?.length || 0,
          recent: logs,
          error: logsError
        }
      },
      aws: {
        faces: {
          count: faces.length,
          data: faces.map(f => ({
            faceId: f.FaceId || '',
            confidence: f.Confidence || 0,
            externalImageId: f.ExternalImageId || ''
          })),
          error: awsError
        },
        collection_id: process.env.AWS_REKOGNITION_COLLECTION_ID || "EmployeesFaces"
      },
      diagnosis: {
        system_status: (employees?.length || 0) > 0 && faces.length > 0 ? 'READY' : 'INCOMPLETE',
        issues: [
          ...((employees?.length || 0) === 0 ? ['No hay empleados en base de datos'] : []),
          ...(faces.length === 0 ? ['No hay rostros en AWS Rekognition'] : []),
          ...((employees?.length || 0) !== faces.length ? ['Desincronización entre base de datos y AWS'] : [])
        ]
      }
    });
  } catch (error) {
    console.error("💥 Error en diagnóstico:", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 