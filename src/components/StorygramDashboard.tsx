"use client";

import React, { useState, useEffect } from 'react';
import { Upload, BookOpen, Instagram, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const pdfViewerStyles = `
  .pdf-container {
    position: relative;
    background: white;
    border-radius: 8px;
    overflow: hidden;
  }

  .text-content {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    line-height: 1.6;
    height: 100%;
    overflow-y: auto;
  }

  .text-content ::selection {
    background: rgba(0, 100, 255, 0.3);
  }
`;

const StorygramDashboard = () => {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);
    const [pageText, setPageText] = useState('');
    const [selectedText, setSelectedText] = useState('');
    const [generatedPosts, setGeneratedPosts] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState({ current: 0, total: 0, step: '' });

    // Handle file upload
    const handleFileUpload = async (event) => {
        setError('');
        setIsProcessing(true);
        const file = event.target.files[0];

        try {
            // Validate file
            if (!file) {
                throw new Error('No file selected');
            }

            if (file.type !== 'application/pdf') {
                throw new Error('Please upload a PDF file');
            }

            // Check file size (e.g., max 50MB)
            const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
            if (file.size > MAX_FILE_SIZE) {
                throw new Error('File size exceeds 50MB limit');
            }

            // Create file URL
            let fileUrl;
            try {
                fileUrl = URL.createObjectURL(file);
            } catch (err) {
                throw new Error('Failed to create file URL');
            }

            // Load PDF
            let pdf;
            try {
                pdf = await window.pdfjsLib.getDocument(fileUrl).promise;
            } catch (err) {
                throw new Error('Failed to load PDF: ' + err.message);
            }

            // Validate PDF
            if (pdf.numPages === 0) {
                throw new Error('PDF contains no pages');
            }

            setPdfDoc(pdf);
            setPageCount(pdf.numPages);

            // Load first page
            try {
                await loadPage(1, pdf);
            } catch (err) {
                throw new Error('Failed to load first page: ' + err.message);
            }

        } catch (err) {
            setError(err.message);
            console.error('File upload error:', err);
            // Reset state on error
            setPdfDoc(null);
            setPageCount(0);
            setPageText('');
        } finally {
            setIsProcessing(false);
        }
    };

    // Load and render PDF page
    const loadPage = async (pageNumber, doc = pdfDoc) => {
        setError('');

        try {
            if (!doc) {
                throw new Error('No PDF document loaded');
            }

            if (pageNumber < 1 || pageNumber > doc.numPages) {
                throw new Error('Invalid page number');
            }

            // Get page
            const page = await doc.getPage(pageNumber).catch(() => {
                throw new Error(`Failed to load page ${pageNumber}`);
            });

            // Set up canvas
            const canvas = document.getElementById('pdf-canvas');
            if (!canvas) {
                throw new Error('Canvas element not found');
            }

            const context = canvas.getContext('2d');
            const viewport = page.getViewport({ scale: 1.5 });

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Render PDF page
            try {
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
            } catch (err) {
                throw new Error(`Failed to render page ${pageNumber}`);
            }

            // Extract and set page text
            try {
                const textContent = await page.getTextContent();
                const text = textContent.items.map(item => item.str).join(' ');
                setPageText(text);
            } catch (err) {
                throw new Error(`Failed to extract text from page ${pageNumber}`);
            }

            setCurrentPage(pageNumber);

        } catch (err) {
            console.error('Page loading error:', err);
            setError(err.message);
        }
    };

    // Process entire book in chunks
    const processEntireBook = async () => {
        setIsProcessing(true);
        setGeneratedPosts([]);
        setError('');

        try {
            if (!pdfDoc) {
                throw new Error('No PDF document loaded');
            }

            // Extract text from all pages
            let fullText = '';
            try {
                for (let i = 1; i <= pageCount; i++) {
                    setProgress({
                        current: i,
                        total: pageCount,
                        step: 'Extracting text from pages'
                    });

                    const page = await pdfDoc.getPage(i).catch(() => {
                        throw new Error(`Failed to load page ${i}`);
                    });

                    const textContent = await page.getTextContent().catch(() => {
                        throw new Error(`Failed to extract text from page ${i}`);
                    });

                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
            } catch (err) {
                throw new Error(`Text extraction failed: ${err.message}`);
            }

            // Validate extracted text
            if (!fullText.trim()) {
                throw new Error('No text content found in PDF');
            }

            // Split into chunks
            const chunks = splitIntoChunks(fullText);
            if (chunks.length === 0) {
                throw new Error('Failed to create text chunks');
            }

            setProgress({
                current: 0,
                total: chunks.length,
                step: 'Generating posts'
            });

            // Process each chunk
            const failedChunks = [];
            for (let i = 0; i < chunks.length; i++) {
                try {
                    setProgress({
                        current: i + 1,
                        total: chunks.length,
                        step: 'Generating posts'
                    });

                    const response = await fetch('https://data.fleak.ai/api/v1/events/747db339-3420-4e2d-b261-eee1c4620f6a/dev', {
                        method: 'POST',
                        headers: {
                            'api-key': 'ak_zOlvTOaPv6OgOXNwfg3S57O2zBNgZtPb',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify([{ content: chunks[i] }])
                    });

                    if (!response.ok) {
                        throw new Error(`API request failed with status ${response.status}`);
                    }

                    const data = await response.json();
                    if (!data.outputEvents?.[0]?.result) {
                        throw new Error('Invalid API response format');
                    }

                    const cleanJsonString = data.outputEvents[0].result.replace('```json\n', '').replace('\n```', '');

                    let postData;
                    try {
                        postData = JSON.parse(cleanJsonString);
                    } catch (err) {
                        throw new Error('Failed to parse API response');
                    }

                    setGeneratedPosts(prev => [...prev, {
                        ...postData,
                        chunkNumber: i + 1,
                        chunkPreview: chunks[i].substring(0, 100) + '...'
                    }]);

                } catch (err) {
                    console.error(`Failed to process chunk ${i + 1}:`, err);
                    failedChunks.push(i + 1);
                }

                // Add delay between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Report any failed chunks
            if (failedChunks.length > 0) {
                setError(`Failed to process chunks: ${failedChunks.join(', ')}`);
            }

        } catch (err) {
            setError(`Processing failed: ${err.message}`);
            console.error('Book processing error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    // Helper function to split text into chunks with validation
    const splitIntoChunks = (text, wordsPerChunk = 1000) => {
        try {
            if (typeof text !== 'string') {
                throw new Error('Invalid input: text must be a string');
            }

            const cleanText = text.replace(/\s+/g, ' ').trim();
            if (!cleanText) {
                throw new Error('Text is empty after cleaning');
            }

            const words = cleanText.split(' ');
            const chunks = [];

            for (let i = 0; i < words.length; i += wordsPerChunk) {
                const chunk = words.slice(i, i + wordsPerChunk).join(' ');
                if (chunk.trim()) {
                    chunks.push(chunk);
                }
            }

            return chunks;
        } catch (err) {
            console.error('Error splitting text into chunks:', err);
            throw new Error(`Failed to split text: ${err.message}`);
        }
    };

    // Generate post from selected text
    const generateFromSelection = async () => {
        if (!selectedText) {
            setError('Please select some text first');
            return;
        }

        setIsProcessing(true);
        try {
            const response = await fetch('https://data.fleak.ai/api/v1/events/747db339-3420-4e2d-b261-eee1c4620f6a/dev', {
                method: 'POST',
                headers: {
                    'api-key': 'ak_zOlvTOaPv6OgOXNwfg3S57O2zBNgZtPb',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([{ content: selectedText }])
            });

            const data = await response.json();
            const cleanJsonString = data.outputEvents[0].result.replace('```json\n', '').replace('\n```', '');
            const postData = JSON.parse(cleanJsonString);

            setGeneratedPosts(prev => [...prev, {
                ...postData,
                pageNumber: currentPage,
                selectedText: selectedText.substring(0, 100) + '...'
            }]);
        } catch (err) {
            setError('Error generating post');
        } finally {
            setIsProcessing(false);
        }
    };

    // Load PDF.js script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.type = 'text/javascript';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        };

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    // Monitor text selection
    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            setSelectedText(selection.toString());
        };

        document.addEventListener('selectionchange', handleSelection);
        return () => document.removeEventListener('selectionchange', handleSelection);
    }, []);

    return (
        <div className="max-w-7xl mx-auto p-6">
            <style>{pdfViewerStyles}</style>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Instagram className="w-6 h-6" />
                        InstaAuthor AI
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center gap-4">
                        <label className="flex flex-col items-center gap-2 cursor-pointer">
                            <div className="flex items-center gap-2 text-lg font-medium">
                                <Upload className="w-6 h-6" />
                                Upload your book (PDF)
                            </div>
                            <input
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </label>

                        {pdfDoc && (
                            <Button
                                className="w-full max-w-md"
                                onClick={processEntireBook}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing Entire Book...
                                    </>
                                ) : (
                                    <>
                                        <BookOpen className="w-4 h-4 mr-2" />
                                        Create Posts for the Whole Book
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {pdfDoc && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* PDF Viewer */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Book Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="pdf-container mb-4">
                                <canvas id="pdf-canvas" className="w-full"></canvas>
                            </div>

                            <div className="flex justify-between items-center mt-4">
                                <Button
                                    onClick={() => loadPage(currentPage - 1)}
                                    disabled={currentPage <= 1}
                                >
                                    <ChevronLeft className="w-4 h-4 mr-2" />
                                    Previous
                                </Button>
                                <span>Page {currentPage} of {pageCount}</span>
                                <Button
                                    onClick={() => loadPage(currentPage + 1)}
                                    disabled={currentPage >= pageCount}
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Text Content */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Copied Text from Page</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-content min-h-[600px] border rounded-lg">
                                {pageText}
                            </div>

                            {selectedText && (
                                <div className="mt-4">
                                    <p className="font-medium mb-2">Highlighted Text:</p>
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        {selectedText}
                                    </div>
                                    <Button
                                        className="w-full mt-4"
                                        onClick={generateFromSelection}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Instagram className="w-4 h-4 mr-2" />
                                                Generate Post from Highlighted Text
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Generated Posts */}
            {generatedPosts.length > 0 && (
                <div className="mt-6">
                    <h2 className="text-2xl font-bold mb-4">Generated Posts</h2>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {generatedPosts.map((post, index) => (
                            <Card key={index} className="overflow-hidden">
                                <CardContent className="p-4">
                                    <div className="mb-4">
                                        <p className="font-bold mb-2">{post.caption.hook}</p>
                                        <p className="text-sm mb-2">{post.caption.mainText}</p>
                                        <p className="text-sm italic">{post.caption.callToAction}</p>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {post.hashtags.map((tag, i) => (
                                            <span
                                                key={i}
                                                className="text-sm text-blue-600 hover:text-blue-800"
                                            >
                                                #{tag.replace(/^#+/, '')}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="text-sm text-gray-600">
                                        <p className="font-medium mb-1">Image Prompt:</p>
                                        <p className="text-sm mb-2">{post.imagePrompt.description}</p>
                                        <p className="text-sm italic">Style: {post.imagePrompt.style}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StorygramDashboard;
