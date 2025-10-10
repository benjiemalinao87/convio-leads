import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Target, Code, Workflow, ArrowRight, BookOpen, Users, TrendingUp, Webhook } from 'lucide-react';

const documentOptions = [
  {
    id: 'database-schema',
    name: 'Database Schema Documentation',
    file: '/database_diagram.md',
    icon: Database,
    description: 'Comprehensive database architecture guide with relationships, business logic, and developer guidelines',
    color: 'bg-blue-500'
  },
  {
    id: 'conversion-tracking',
    name: 'Conversion Tracking Plan',
    file: '/CONVERSION_TRACKING_PLAN.md',
    icon: Target,
    description: 'Comprehensive conversion tracking system implementation guide and architecture',
    color: 'bg-green-500'
  },
  {
    id: 'api-docs',
    name: 'Home Project Partners Webhook API Documentation',
    file: '/webhook-api/API_DOCUMENTATION.md',
    icon: Code,
    description: 'Complete API reference including enhanced contact search, lead management, and conversion tracking endpoints',
    color: 'bg-purple-500'
  },
  {
    id: 'webhook-lead-receiving',
    name: 'Webhook Lead Receiving Implementation',
    file: '/WEBHOOK_LEAD_RECEIVING_IMPLEMENTATION.md',
    icon: Webhook,
    description: 'Technical deep-dive into webhook lead processing: architecture, validation, deduplication, and database storage with ASCII diagrams',
    color: 'bg-cyan-500'
  },
  {
    id: 'appointment-flow',
    name: 'Appointment-as-a-Service Flow',
    file: '/webhook-api/APPOINTMENT_AS_A_SERVICE_FLOW.md',
    icon: Workflow,
    description: 'End-to-end visualization of the appointment routing and delivery system',
    color: 'bg-orange-500'
  },
  {
    id: 'appointment-routing',
    name: 'Appointment Routing & Forwarding Guide',
    file: '/webhook-api/APPOINTMENT_ROUTING_GUIDE.md',
    icon: Target,
    description: 'Comprehensive guide to appointment routing algorithms, rules management, and workspace forwarding',
    color: 'bg-red-500'
  },
  {
    id: 'sales-demo',
    name: 'Sales Demonstration Guide',
    file: '/webhook-api/SALES_DEMONSTRATION_GUIDE.md',
    icon: Users,
    description: 'Complete sales demonstration playbook with business logic, ASCII diagrams, and revenue model for partner demos',
    color: 'bg-indigo-500'
  },
  {
    id: 'marketing-strategy',
    name: 'Marketing Strategy Guide',
    file: '/webhook-api/MARKETING_STRATEGY_GUIDE.md',
    icon: TrendingUp,
    description: 'Comprehensive marketing strategy with outreach scripts, campaign tactics, and partner acquisition framework',
    color: 'bg-pink-500'
  }
];

const DocumentationSelection = () => {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const handleDocumentSelect = (docId: string) => {
    navigate(`/docs/${docId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Documentation Center
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Choose from our comprehensive documentation collection to explore system architecture,
            API references, and implementation guides.
          </p>
        </div>

        {/* Documentation Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {documentOptions.map((doc) => {
            const Icon = doc.icon;
            const isHovered = hoveredCard === doc.id;

            return (
              <div
                key={doc.id}
                className={`group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/25 ${
                  isHovered ? 'border-blue-400 bg-gray-800/70' : ''
                }`}
                onMouseEnter={() => setHoveredCard(doc.id)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => handleDocumentSelect(doc.id)}
              >
                {/* Icon */}
                <div className={`inline-flex p-3 rounded-lg ${doc.color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors">
                  {doc.name}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  {doc.description}
                </p>

                {/* Arrow indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                    Click to read
                  </span>
                  <ArrowRight className={`h-4 w-4 text-gray-500 transition-all duration-300 ${
                    isHovered ? 'text-blue-400 translate-x-1' : ''
                  }`} />
                </div>

                {/* Hover effect overlay */}
                <div className={`absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 transition-opacity duration-300 ${
                  isHovered ? 'opacity-100' : ''
                }`} />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm">
            Select any documentation card above to begin reading
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocumentationSelection;
