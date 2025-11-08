"use client";

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface LegalDocumentProps {
    filePath: string;
    title: string;
}

const LegalDocument: React.FC<LegalDocumentProps> = ({ filePath, title }) => {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load document');
                }
                return response.text();
            })
            .then(text => {
                setContent(text);
                setLoading(false);
            })
            .catch(error => {
                console.error('Error loading markdown:', error);
                setError('Failed to load document. Please try again later.');
                setLoading(false);
            });
    }, [filePath]);

    return (
        <Card className="w-full max-w-4xl mx-auto my-8 bg-[#1b1b1b] border border-[#272727]">
            <CardHeader>
                <h1 className="text-2xl font-bold text-center text-white/90">{title}</h1>
            </CardHeader>
            <CardContent className="prose prose-blue max-w-none min-h-[200px] border border-[#272727] border-l-0 border-r-0 border-b-0">
                {loading ? (
                    <div className="flex items-center justify-center h-[200px] text-white">
                        Loading....
                    </div>
                ) : error ? (
                    <div className="text-center text-red-600 py-8">
                        {error}
                    </div>
                ) : (
                    <ReactMarkdown
                        components={{
                            h1: ({ children }) => <h1 className="text-2xl text-white/80 font-bold mt-8 mb-4">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xl text-white/80 font-semibold mt-6 mb-3">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-lg text-white/80 font-medium mt-4 mb-2">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc text-white/80 pl-6 mb-4">{children}</ul>,
                            li: ({ children }) => <li className="mb-1 text-white/80">{children}</li>,
                            p: ({ children }) => <p className="mb-4 text-white/80">{children}</p>,
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                )}
            </CardContent>
        </Card>
    );
};

export default LegalDocument;