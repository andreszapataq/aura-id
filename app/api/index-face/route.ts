import { NextResponse } from 'next/server';
import { indexFace } from '@/lib/rekognition';

export async function POST(request: Request) {
  try {
    const { imageData, employeeId } = await request.json();
    
    if (!imageData || !employeeId) {
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      );
    }

    const faceId = await indexFace(imageData, employeeId);
    
    if (!faceId) {
      return NextResponse.json(
        { error: 'No face detected in the image' }, 
        { status: 400 }
      );
    }

    return NextResponse.json({ faceId });
  } catch (error) {
    console.error('Error indexing face:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to index face' }, 
      { status: 500 }
    );
  }
} 