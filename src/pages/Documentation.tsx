import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, Target, Code, Workflow, Database, ArrowLeft, Users, TrendingUp, Webhook } from 'lucide-react';
import MermaidDiagram from '@/components/MermaidDiagram';
import { Button } from '@/components/ui/button';

const documentOptions = [
  {
    id: 'database-schema',
    name: 'Database Schema Documentation',
    file: '/database_diagram.md',
    icon: Database,
    description: 'Comprehensive database architecture guide with relationships, business logic, and developer guidelines'
  },
  {
    id: 'conversion-tracking',
    name: 'Conversion Tracking Plan',
    file: '/CONVERSION_TRACKING_PLAN.md',
    icon: Target,
    description: 'Comprehensive conversion tracking system implementation guide and architecture'
  },
  {
    id: 'api-docs',
    name: 'Buyerfound Webhook API Documentation',
    file: '/webhook-api/API_DOCUMENTATION.md',
    icon: Code,
    description: 'Complete API reference including enhanced contact search, lead management, and conversion tracking endpoints'
  },
  {
    id: 'webhook-lead-receiving',
    name: 'Webhook Lead Receiving Implementation',
    file: '/WEBHOOK_LEAD_RECEIVING_IMPLEMENTATION.md',
    icon: Webhook,
    description: 'Technical deep-dive into webhook lead processing: architecture, validation, deduplication, and database storage with ASCII diagrams'
  },
  {
    id: 'appointment-flow',
    name: 'Appointment-as-a-Service Flow',
    file: '/webhook-api/APPOINTMENT_AS_A_SERVICE_FLOW.md',
    icon: Workflow,
    description: 'End-to-end visualization of the appointment routing and delivery system'
  },
  {
    id: 'appointment-routing',
    name: 'Appointment Routing & Forwarding Guide',
    file: '/webhook-api/APPOINTMENT_ROUTING_GUIDE.md',
    icon: Target,
    description: 'Comprehensive guide to appointment routing algorithms, rules management, and workspace forwarding'
  },
  {
    id: 'sales-demo',
    name: 'Sales Demonstration Guide',
    file: '/webhook-api/SALES_DEMONSTRATION_GUIDE.md',
    icon: Users,
    description: 'Complete sales demonstration playbook with business logic, ASCII diagrams, and revenue model for partner demos'
  },
  {
    id: 'marketing-strategy',
    name: 'Marketing Strategy Guide',
    file: '/webhook-api/MARKETING_STRATEGY_GUIDE.md',
    icon: TrendingUp,
    description: 'Comprehensive marketing strategy with outreach scripts, campaign tactics, and partner acquisition framework'
  }
];

const Documentation = () => {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [selectedDoc, setSelectedDoc] = useState(() => {
    // Find the document based on URL parameter, default to first if not found
    return documentOptions.find(doc => doc.id === docId) || documentOptions[0];
  });
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // If no valid docId is provided, redirect to selection
  useEffect(() => {
    if (!docId || !documentOptions.find(doc => doc.id === docId)) {
      navigate('/docs', { replace: true });
      return;
    }
    // Update selected document when docId changes
    const doc = documentOptions.find(doc => doc.id === docId);
    if (doc) {
      setSelectedDoc(doc);
    }
  }, [docId, navigate]);

  // Extract mermaid diagrams from markdown
  const { processedMarkdown, mermaidDiagrams } = useMemo(() => {
    // Pattern to catch mermaid blocks
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)\n```/g;

    let processedMd = markdown;
    let firstDiagram: { id: string; content: string; title: string } | null = null;

    // Find only the first mermaid diagram
    const match = mermaidRegex.exec(markdown);
    if (match) {
      const content = match[1].trim();
      if (content && content.includes('erDiagram')) {
        firstDiagram = {
          id: 'interactive-database-schema',
          content: content,
          title: "Interactive Database Schema"
        };
      }
    }

    // Remove all mermaid code blocks from markdown completely
    processedMd = processedMd.replace(/```mermaid\s*\n[\s\S]*?\n```/g, '');

    // Also remove any remaining mermaid text patterns
    processedMd = processedMd.replace(/erDiagram[\s\S]*?(?=##|$)/g, '');

    return {
      processedMarkdown: processedMd,
      mermaidDiagrams: firstDiagram ? [firstDiagram] : []
    };
  }, [markdown]);

  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      try {
        const response = await fetch(selectedDoc.file, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        const text = await response.text();
        setMarkdown(text);
      } catch (error) {
        console.error('Error loading document:', error);
        setMarkdown('# Error\n\nFailed to load documentation file.');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [selectedDoc]);

  const handleDocumentChange = (doc: typeof documentOptions[0]) => {
    setSelectedDoc(doc);
    setDropdownOpen(false);
    navigate(`/docs/${doc.id}`);
  };

  const handleBackToSelection = () => {
    navigate('/docs');
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToSelection}
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Documentation
            </Button>
            <h1 className="text-2xl font-bold text-white">Documentation</h1>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <selectedDoc.icon className="w-4 h-4" />
              <span>{selectedDoc.name}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-10">
                {documentOptions.map((doc) => (
                  <button
                    type="button"
                    key={doc.id}
                    onClick={() => handleDocumentChange(doc)}
                    className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-700 transition-colors text-left ${selectedDoc.id === doc.id ? 'bg-gray-700' : ''
                      } ${doc.id === documentOptions[0].id ? 'rounded-t-lg' : ''} ${doc.id === documentOptions[documentOptions.length - 1].id ? 'rounded-b-lg' : ''
                      }`}
                  >
                    <doc.icon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-white font-medium">{doc.name}</div>
                      <div className="text-gray-400 text-sm mt-0.5">{doc.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-gray-400">{selectedDoc.description}</p>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="prose prose-invert max-w-none">
            {/* Render any mermaid diagrams first */}
            {mermaidDiagrams.map((diagram, index) => (
              <MermaidDiagram
                key={diagram.id}
                diagram={diagram.content}
                title={index === 0 ? "Interactive Database Schema" : diagram.title}
                className="mb-8"
              />
            ))}

            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-3xl font-bold text-white mb-4 mt-6 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-2xl font-semibold text-white mb-3 mt-6">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xl font-semibold text-white mb-2 mt-4">{children}</h3>,
                h4: ({ children }) => <h4 className="text-lg font-semibold text-white mb-2 mt-3">{children}</h4>,
                p: ({ children }) => <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc ml-6 text-gray-300 mb-4 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-6 text-gray-300 mb-4 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-gray-300 mb-1">{children}</li>,
                code: ({ children, className }) => {
                  const isInline = !className?.includes('language-');
                  return isInline ? (
                    <code className="bg-gray-800 text-blue-400 px-1.5 py-0.5 rounded text-sm">{children}</code>
                  ) : (
                    <code className="block bg-gray-800 text-gray-300 p-4 rounded-lg overflow-x-auto my-4 text-sm">{children}</code>
                  );
                },
                pre: ({ children }) => <pre className="bg-gray-800 rounded-lg overflow-x-auto my-4">{children}</pre>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 my-4 text-gray-400 italic">{children}</blockquote>
                ),
                a: ({ children, href }) => (
                  <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
                hr: () => <hr className="border-gray-700 my-6" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full divide-y divide-gray-700">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-gray-800">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-gray-700">{children}</tbody>,
                tr: ({ children }) => <tr>{children}</tr>,
                th: ({ children }) => (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {children}
                  </th>
                ),
                td: ({ children }) => <td className="px-4 py-2 text-gray-300">{children}</td>,
              }}
            >
              {processedMarkdown}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documentation;