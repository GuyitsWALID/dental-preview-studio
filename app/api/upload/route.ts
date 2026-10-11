import { NextResponse } from 'next/server';
import { assertSameOrigin, HttpError, localDemo, requireOwner } from '@/lib/server/auth';
import { saveImage } from '@/lib/server/projects';
export async function POST(request:Request) {
  try {
    await requireOwner();assertSameOrigin(request);
    if(!localDemo())throw new HttpError(400,'Use the signed direct upload flow.');
    const data=await request.formData(),file=data.get('file');
    if(!(file instanceof File) || file.size>5*1024*1024)throw new HttpError(400,'Choose an image up to 5 MB.');
    return NextResponse.json({asset:await saveImage(Buffer.from(await file.arrayBuffer()))});
  } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:'Upload failed.'},{status:error instanceof HttpError?error.status:400});}
}
