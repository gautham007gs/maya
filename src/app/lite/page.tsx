
import { Metadata } from 'next';
import Link from 'next/link';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

export const metadata: Metadata = {
  title: fitSeoTitle('Kruthika AI Girlfriend - Lite Version'),
  description: fitMetaDescription('Fast, lightweight AI girlfriend chat for low-end devices and slow networks.'),
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function LitePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-white p-4">
      <div className="max-w-2xl mx-auto">
        <header className="text-center py-8">
          <h1 className="text-3xl font-bold text-pink-600 mb-2">Kruthika AI</h1>
          <p className="text-gray-600">Lightweight AI Girlfriend Chat</p>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Why Lite Version?</h2>
          <ul className="space-y-2 text-gray-700">
            <li>✓ 10x faster loading (under 100KB)</li>
            <li>✓ Works on 2G/3G networks</li>
            <li>✓ Saves mobile data (90% less)</li>
            <li>✓ Runs on any device</li>
          </ul>
        </div>

        <Link 
          href="/lite/chat"
          className="block w-full bg-pink-500 hover:bg-pink-600 text-white text-center py-4 rounded-lg font-semibold transition-colors"
        >
          Start Chatting →
        </Link>

        <div className="mt-6 text-center">
          <Link href="/maya-chat" className="text-pink-600 hover:underline">
            Switch to Full Version
          </Link>
        </div>
      </div>
    </main>
  );
}
