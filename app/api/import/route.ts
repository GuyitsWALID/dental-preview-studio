import { NextResponse } from 'next/server';
import { assertSameOrigin, HttpError, requireOwner } from '@/lib/server/auth';
import { readWorkspace } from '@/lib/server/store';
import { parseWorkbook, previewImport } from '@/lib/prospects';
export const runtime='nodejs';
export async function POST(request:Request) {
  try {
    await requireOwner();assertSameOrigin(request);
    if (Number(request.headers.get('content-length'))>3*1024*1024)throw new HttpError(413,'Choose a workbook smaller than 2 MB.');
    const form=await request.formData(),file=form.get('file');
    if (!(file instanceof File))throw new HttpError(400,'Choose an .xlsx workbook.');
    const parsed=await parseWorkbook(await file.arrayBuffer(),file.name,String(form.get('sheet') || '') || undefined);
    const {state,revision}=await readWorkspace();
    return NextResponse.json({parsed,entries:previewImport(state.prospects,parsed),revision},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:'The workbook could not be read.'},{status:error instanceof HttpError?error.status:400});}
}
