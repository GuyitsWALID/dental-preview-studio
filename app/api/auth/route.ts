import { NextResponse } from 'next/server';
import { assertSameOrigin, configured, HttpError, localDemo, ownerId, sessionClient } from '@/lib/server/auth';
export async function POST(request:Request) {
  try {
    assertSameOrigin(request);const body=await request.json();
    if(localDemo())return NextResponse.json({ok:true});
    if(!configured())throw new HttpError(503,'Configure Supabase and your owner account first.');
    const client=await sessionClient();
    if(body.action==='logout'){await client.auth.signOut();return NextResponse.json({ok:true});}
    const email=typeof body.email==='string'?body.email.trim():'',password=typeof body.password==='string'?body.password:'';
    if(!email || !password || password.length>1000)throw new HttpError(400,'Enter your owner email and password.');
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error || data.user?.id!==ownerId()){await client.auth.signOut();throw new HttpError(401,'The owner email or password is incorrect.');}
    return NextResponse.json({ok:true});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Sign-in failed.'},{status:error instanceof HttpError?error.status:400});}
}
