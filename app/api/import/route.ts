import { NextResponse } from 'next/server';
import { assertSameOrigin, HttpError, requireOwner } from '@/lib/server/auth';
import { parseWorkbook } from '@/lib/prospects';
import { stageImport, importPage, cancelImport } from '@/lib/server/imports';
export const runtime='nodejs';
const fail=(error:unknown)=>NextResponse.json({error:error instanceof Error?error.message:'The workbook could not be read.'},{status:error instanceof HttpError?error.status:400});
const privateHeaders={'Cache-Control':'private, no-store'};
export async function GET(request:Request) {
  try {await requireOwner();const u=new URL(request.url);return NextResponse.json(await importPage(u.searchParams.get('importId') || '',Number(u.searchParams.get('offset') || 0)),{headers:privateHeaders});} catch(e) {return fail(e);}
}
export async function DELETE(request:Request) {
  try {await requireOwner();assertSameOrigin(request);await cancelImport(new URL(request.url).searchParams.get('importId') || '');return NextResponse.json({cancelled:true},{headers:privateHeaders});} catch(e) {return fail(e);}
}
export async function POST(request:Request) {
  try {
    await requireOwner();assertSameOrigin(request);
    if (Number(request.headers.get('content-length'))>3*1024*1024)throw new HttpError(413,'Choose a workbook smaller than 2 MB.');
    const form=await request.formData(),file=form.get('file');
    if (!(file instanceof File))throw new HttpError(400,'Choose an .xlsx workbook.');
    const parsed=await parseWorkbook(await file.arrayBuffer(),file.name,String(form.get('sheet') || '') || undefined);
    return NextResponse.json(await stageImport(parsed),{headers:privateHeaders});
  } catch(error) {return fail(error);}
}
