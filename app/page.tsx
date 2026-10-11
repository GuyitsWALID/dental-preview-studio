import { redirect } from 'next/navigation';
import { requireOwner, localDemo } from '@/lib/server/auth';
import { readWorkspace } from '@/lib/server/store';
import Studio from '@/components/Studio';
export const dynamic='force-dynamic';
export default async function Home() {
  try {await requireOwner();}catch {redirect('/login');}
  const record=await readWorkspace();
  return <Studio initial={record} local={localDemo()}/>;
}
