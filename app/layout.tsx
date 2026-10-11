import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Dental Studio · Prospects, previews & handoffs',description:'Your private dental website workspace.',robots:{index:false,follow:false}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#153049'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
