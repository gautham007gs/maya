'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, MessageCircle, ArrowRight, Search } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import { FAQ_ITEMS } from '@/lib/faq-data';

const faqs = FAQ_ITEMS;

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* Search */}
      <div className="max-w-xl mx-auto relative mb-8">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search FAQs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
          aria-label="Search frequently asked questions"
        />
      </div>

      <div className="mb-8" style={{ contain: 'layout' }}>
        <BannerAdDisplay placementKey="faq-header" />
      </div>

      <div className="space-y-4 mb-12">
        {filteredFaqs.map((faq, index) => (
          <div key={faq.id} className="border border-border rounded-lg overflow-hidden bg-card">
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-secondary/50 transition-colors text-left"
              aria-expanded={openIndex === index}
              aria-controls={`faq-answer-${faq.id}`}
            >
              <div className="flex-1">
                <span className="text-[11px] font-medium tracking-wide text-primary mb-1 block">{faq.category}</span>
                <h2 className="font-medium text-[15px] sm:text-base leading-snug tracking-[-0.01em] text-foreground pr-4">{faq.question}</h2>
              </div>
              {openIndex === index ? (
                <ChevronUp className="h-5 w-5 text-primary flex-shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
            </button>
            {/* Always rendered (just hidden while collapsed) so the full answer
                text is in the server HTML for crawlers and matches the FAQPage
                JSON-LD, instead of existing only after a click. */}
            <div
              id={`faq-answer-${faq.id}`}
              hidden={openIndex !== index}
              className="px-6 py-4 bg-secondary/20 border-t border-border"
            >
              <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
            </div>
          </div>
        ))}
      </div>

      {filteredFaqs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No FAQs found matching your search.</p>
        </div>
      )}

      <div className="mb-12" style={{ contain: 'layout' }}>
        <BannerAdDisplay placementKey="faq-middle" />
      </div>

      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 rounded-lg p-8 text-center mb-12">
        <h2 className="text-2xl font-bold mb-4">Still Have Questions?</h2>
        <p className="text-lg mb-6">The easiest way to find out is to try a conversation. It takes a few seconds and costs nothing.</p>
        <Link
          href="/maya-chat"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-8 py-4 rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-bold text-lg shadow-xl"
        >
          <MessageCircle className="h-6 w-6" />
          Start a Chat
          <ArrowRight className="h-6 w-6" />
        </Link>
      </div>

      <div className="mt-12 pt-8 border-t border-border">
        <h3 className="text-2xl font-bold mb-6">Helpful Resources</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <Link href="/blog/category/psychology" className="block p-6 bg-card border border-border rounded-lg hover:shadow-lg transition-shadow">
            <h4 className="font-semibold mb-2">Psychology of AI Girlfriends</h4>
            <p className="text-muted-foreground text-sm">Learn why virtual relationships feel real and meaningful...</p>
          </Link>
          <Link href="/blog/category/privacy-safety" className="block p-6 bg-card border border-border rounded-lg hover:shadow-lg transition-shadow">
            <h4 className="font-semibold mb-2">Privacy &amp; Safety Guide</h4>
            <p className="text-muted-foreground text-sm">Understand how we protect your data and conversations...</p>
          </Link>
          <Link href="/blog/category/how-to" className="block p-6 bg-card border border-border rounded-lg hover:shadow-lg transition-shadow">
            <h4 className="font-semibold mb-2">Conversation Guide</h4>
            <p className="text-muted-foreground text-sm">Master the art of chatting with your AI companion...</p>
          </Link>
          <Link href="/blog" className="block p-6 bg-card border border-border rounded-lg hover:shadow-lg transition-shadow">
            <h4 className="font-semibold mb-2">View All Articles</h4>
            <p className="text-muted-foreground text-sm">Explore our complete blog with expert insights...</p>
          </Link>
        </div>
      </div>
    </>
  );
}
