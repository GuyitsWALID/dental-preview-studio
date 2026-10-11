import { redirect } from 'next/navigation';
import { configured, localDemo } from '@/lib/server/auth';
import Login from '@/components/Login';
export const dynamic='force-dynamic';
export default function Page(){if(localDemo())redirect('/');return <Login configured={configured()}/>;}
