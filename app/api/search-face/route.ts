import { NextResponse } from 'next/server';
import { searchFace } from '@/lib/rekognition';

export async function POST(request: Request) {
  try {
    const { imageData } = await request.json();
    
    if (!imageData) {
      return NextResponse.json(
        { error: 'Missing image data' }, 
        { status: 400 }
      );
    }

    const faceId = await searchFace(imageData);
    
    if (!faceId) {
      return NextResponse.json({ 
        status: 'FACE_NOT_FOUND',
        message: 'Face not found in registered employees'
      });
    }

    return NextResponse.json({ faceId });
  } catch (error) {
    console.error('Error searching face:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search face' }, 
      { status: 500 }
    );
  }
} 