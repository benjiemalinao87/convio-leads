import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, Target, Code, Workflow } from 'lucide-react';

const documentOptions = [
  {
    id: 'conversion-tracking',
    name: 'Conversion Tracking Plan',
    file: '/CONVERSION_TRACKING_PLAN.md',
    icon: Target,
    description: 'Comprehensive conversion tracking system implementation guide and architecture'
  },
  {
    id: 'api-docs',
    name: 'Home Project Partners Webhook API Documentation',
    file: '/webhook-api/API_DOCUMENTATION.md',
    icon: Code,
    description: 'Complete API reference including lead management and conversion tracking endpoints'
  },
  {
    id: 'appointment-flow',
    name: 'Appointment-as-a-Service Flow',
    file: '/webhook-api/APPOINTMENT_AS_A_SERVICE_FLOW.md',
    icon: Workflow,
    description: 'End-to-end visualization of the appointment routing and delivery system'
  }
];

const Documentation = () => {
  const [selectedDoc, setSelectedDoc] = useState(documentOptions[0]);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Documentation</h1>

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
                    onClick={() => {
                      setSelectedDoc(doc);
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-700 transition-colors text-left ${
                      selectedDoc.id === doc.id ? 'bg-gray-700' : ''
                    } ${doc.id === documentOptions[0].id ? 'rounded-t-lg' : ''} ${
                      doc.id === documentOptions[documentOptions.length - 1].id ? 'rounded-b-lg' : ''
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
              {markdown}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documentation;