import { NextResponse } from 'next/server';
import { createCollection } from '@/lib/rekognition';

export async function POST() {
  try {
    const result = await createCollection();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ message: 'Collection already exists' });
    }
    
    console.error('Error creating collection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create collection' },
      { status: 500 }
    );
  }
} 